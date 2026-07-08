const { Router } = require('express');
const { getDb } = require('../db/connect');
const { embedText } = require('../services/geminiEmbed');
const { generateText } = require('../services/geminiGenerate');
const { vectorSearch } = require('../services/vectorSearch');
const router = Router();
// ── System prompt (constant) ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are KrishiNexus, an AI agricultural crisis advisor for Bangladesh.
You assist institutional decision-makers — agricultural extension officers and supply chain managers.
Speak in precise, professional language.
ONLY cite information found in the provided context documents.
If the context does not contain enough information to answer, say so clearly — do not invent advice.
Never invent crop varieties, chemical names, dosages, or prices.
If the operator writes in Bangla, respond in Bangla. Otherwise respond in English.`;
/**
 * POST /api/rag/query
 * Body: { question: string, districtId: string, language?: "en"|"bn" }
 *
 * Steps:
 *  1. Embed the question
 *  2. $vectorSearch across regional_advisories (district-scoped), crop_pathology, crop_thresholds
 *  3. Fetch district's current liveWeather + activeAlerts
 *  4. Build prompt with retrieved context + live weather
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
    // ── 1. Fetch district first (we need crop names to augment the query) ─────
    const district = await db
      .collection('districts')
      .findOne(
        { _id: districtId },
        { projection: { name: 1, bnName: 1, liveWeather: 1, activeAlerts: 1, activeCrops: 1 } }
      );
    if (!district) {
      return res.status(404).json({ ok: false, message: 'District not found' });
    }
    // ── 2. Augment the question with district context for better embedding match ─
    const cropNames = district.activeCrops?.map((c) => c.crop).join(', ') || '';
    const augmentedQuery = `[${district.name}] ${cropNames ? `[Crops: ${cropNames}] ` : ''}${question}`;
    // ── 3. Embed the augmented question ───────────────────────────────────────
    const queryVector = await embedText(augmentedQuery);
    // ── 4. Parallel vector searches (increased k for better recall) ───────────
    const [advisories, pathology, thresholds] = await Promise.all([
      // District-scoped advisories — filter by districtId so we only get relevant region
      vectorSearch(
        'regional_advisories',
        queryVector,
        'advisory_vector_index',
        { districtId },   // pre-filter: only this district's advisories
        5                 // was 3 — Sylhet has 6 chunks, most districts have 4-8
      ),
      // Disease info — not district-specific, search all
      vectorSearch('crop_pathology', queryVector, 'pathology_vector_index', null, 5),  // was 2
      // Crop thresholds — not district-specific, search all
      vectorSearch('crop_thresholds', queryVector, 'threshold_vector_index', null, 2),
      vectorSearch('crop_thresholds', queryVector, 'threshold_vector_index', null, 3), // was 2
    ]);
    
    // ── 5. Build weather + alert context (district already fetched in step 1) ─
    
    const w = district.liveWeather || {};
    const alertLabels =
      district.activeAlerts?.map((a) => a.label).join(', ') || 'None';
    const cropList =
      district.activeCrops?.map((c) => `${c.crop} (${c.stage})`).join(', ') || 'Unknown';
    // ── 6. Build prompt ───────────────────────────────────────────────────────
    const contextBlocks = [
      ...advisories.map((d, i) => `--- District Advisory ${i + 1} ---\n${d.ragContextChunk}`),
      ...pathology.map((d, i) => `--- Disease Info ${i + 1} ---\n${d.ragContextChunk}`),
      ...thresholds.map((d, i) => `--- Crop Threshold ${i + 1} ---\n${d.ragContextChunk}`),
    ].join('\n\n');
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
    // ── 7. Generate answer ────────────────────────────────────────────────────
    const answer = await generateText(SYSTEM_PROMPT, userPrompt);
    // ── 8. Respond ────────────────────────────────────────────────────────────
    res.json({
      ok: true,
      answer,
      meta: {
        districtId,
        districtName: district.name,
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