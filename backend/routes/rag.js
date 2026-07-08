const path = require('path');
const { Router } = require('express');
const { getDb } = require('../db/connect');
const { embedText } = require('../services/geminiEmbed');
const { generateText } = require('../services/geminiGenerate');
const { vectorSearch } = require('../services/vectorSearch');

const router = Router();

// ── zilaIdMap: zilaId (BAMIS 1-66) → districtId (app ID) ────────────────────
// We need the reverse: districtId → zilaId, so we flip it at startup.
const zilaIdMap = require(path.join(__dirname, '../../others/data, chunk, embeed/data/zilaIdMap.json'));
// districtIdToZilaId: { "12": "1", "36": "50", ... }
const districtIdToZilaId = Object.fromEntries(
  Object.entries(zilaIdMap).map(([zilaId, districtId]) => [districtId, zilaId])
);

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are KrishiNexus, an AI agricultural crisis advisor for Bangladesh.
You assist institutional decision-makers — agricultural extension officers and supply chain managers.
Speak in precise, professional language.
Prioritise information from the official BAMIS bulletin document when present in context.
If the context does not contain enough information to answer, use your own agricultural knowledge.
Give a precise response of 250 words or less. Do not mention whether the response comes from the context or your own knowledge.
If the operator writes in Bangla, respond in Bangla. Otherwise respond in English.`;

/**
 * POST /api/rag/query
 * Body: { question: string, districtId: string, language?: "en"|"bn" }
 *
 * Steps:
 *  1. Fetch district doc + raw BAMIS bulletin (parallel)
 *  2. Embed the question
 *  3. $vectorSearch across regional_advisories, crop_pathology, crop_thresholds
 *  4. Build prompt: bulletin (primary) + vector results + live weather
 *  5. Call Gemini generation
 *  6. Return answer
 */
router.post('/query', async (req, res, next) => {
  try {
    const { question, districtId, language = 'en' } = req.body;
    if (!question || !districtId) {
      return res.status(400).json({ ok: false, message: '`question` and `districtId` are required' });
    }

    const db = getDb();

    // ── 1. Resolve zilaId and fetch district + bulletin in parallel ────────────
    const zilaId = districtIdToZilaId[String(districtId)] || null;

    const [district, bulletinDoc] = await Promise.all([
      db.collection('districts').findOne(
        { _id: districtId },
        { projection: { name: 1, bnName: 1, liveWeather: 1, activeAlerts: 1, activeCrops: 1 } }
      ),
      zilaId
        ? db.collection('raw_bulletins').findOne(
            { zilaId: String(zilaId) },
            { projection: { text: 1, rawText: 1, districtNameBn: 1 }, sort: { scrapedAt: -1 } }
          )
        : Promise.resolve(null),
    ]);

    if (!district) {
      return res.status(404).json({ ok: false, message: 'District not found' });
    }

    // ── 2. Augment query for better vector match ───────────────────────────────
    const cropNames = district.activeCrops?.map((c) => c.crop).join(', ') || '';
    const augmentedQuery = `[${district.name}] ${cropNames ? `[Crops: ${cropNames}] ` : ''}${question}`;

    // ── 3. Embed + parallel vector searches ────────────────────────────────────
    const queryVector = await embedText(augmentedQuery);
    const [advisories, pathology, thresholds] = await Promise.all([
      vectorSearch('regional_advisories', queryVector, 'embedding', { districtId }, 5),
      vectorSearch('crop_pathology',       queryVector, 'embedding', null, 5),
      vectorSearch('crop_thresholds',      queryVector, 'embedding', null, 2),
    ]);

    // ── 4. Build context blocks ────────────────────────────────────────────────
    const w = district.liveWeather || {};
    const alertLabels = district.activeAlerts?.map((a) => a.label).join(', ') || 'None';
    const cropList    = district.activeCrops?.map((c) => `${c.crop} (${c.stage})`).join(', ') || 'Unknown';

    // Raw bulletin text (capped at 3000 chars to keep prompt size manageable)
    const bulletinRaw = bulletinDoc?.text || bulletinDoc?.rawText || '';
    const bulletinBlock = bulletinRaw
      ? `--- Official BAMIS Bulletin (${district.bnName || district.name}) ---\n${bulletinRaw.slice(0, 3000)}${bulletinRaw.length > 3000 ? '\n[... bulletin continues ...]' : ''}`
      : '';

    const vectorBlocks = [
      ...advisories.map((d, i) => `--- District Advisory ${i + 1} ---\n${d.ragContextChunk}`),
      ...pathology.map((d, i)  => `--- Disease Info ${i + 1} ---\n${d.ragContextChunk}`),
      ...thresholds.map((d, i) => `--- Crop Threshold ${i + 1} ---\n${d.ragContextChunk}`),
    ].join('\n\n');

    const contextBlocks = [bulletinBlock, vectorBlocks].filter(Boolean).join('\n\n');

    const userPrompt = `
DISTRICT: ${district.name} / ${district.bnName} (ID: ${districtId})
LIVE WEATHER (as of ${w.fetchedAt || 'N/A'}):
- Today max temp:     ${w.tempMaxToday ?? 'N/A'}°C
- Today min temp:     ${w.tempMinToday ?? 'N/A'}°C
- Today max humidity: ${w.humidityMaxToday ?? 'N/A'}%
- 7-day precipitation forecast (mm): ${w.precipitationSum7Day?.join(', ') ?? 'N/A'}
- Forecast dates: ${w.forecastDates?.join(', ') ?? 'N/A'}
ACTIVE CROPS: ${cropList}
ACTIVE ALERTS: ${alertLabels}
RETRIEVED CONTEXT DOCUMENTS:
${contextBlocks}
OPERATOR QUESTION:
${question}
`.trim();

    // ── 5. Generate answer ─────────────────────────────────────────────────────
    const answer = await generateText(SYSTEM_PROMPT, userPrompt);

    // ── 6. Respond ─────────────────────────────────────────────────────────────
    res.json({
      ok: true,
      answer,
      meta: {
        districtId,
        districtName: district.name,
        zilaId: zilaId || null,
        hasBulletin: !!bulletinRaw,
        retrievedAdvisories: advisories.length,
        retrievedPathology: pathology.length,
        retrievedThresholds: thresholds.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;