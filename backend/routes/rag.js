const path = require('path');
const { Router } = require('express');
const { getDb } = require('../db/connect');
const { embedText } = require('../services/geminiEmbed');
const { generateText } = require('../services/geminiGenerate');
const { vectorSearch, searchAdvisories } = require('../services/vectorSearch');
const { classifyQuery } = require('../utils/queryRouter');

const router = Router();

// ── zilaIdMap: zilaId (BAMIS 1-66) → districtId (app ID) ────────────────────
// We need the reverse: districtId → zilaId, so we flip it at startup.
const zilaIdMap = require('../../backend-ingestion/ingestion/zilaIdMap.json');
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
Try to Give a precise response within 250 words most of the time. Do not mention whether the response comes from the context or your own knowledge.
If the operator writes in Bangla, respond in Bangla. Otherwise respond in English.`;

async function handleMarketQuery(req, res, question, districtId) {
  const db = getDb();

  // Extract commodity name from question using simple keyword matching
  // This is enough for common cases — does not need Gemini
  const commodityMap = {
    'চাল': 'Rice (Coarse)', 'ধান': 'Rice (Coarse)', 'rice': 'Rice (Coarse)',
    'আটা': 'Wheat Flour', 'গম': 'Wheat Flour', 'wheat': 'Wheat Flour',
    'পেঁয়াজ': 'Onion', 'পিঁয়াজ': 'Onion', 'onion': 'Onion',
    'আলু': 'Potato', 'potato': 'Potato',
    'মসুর': 'Lentil', 'lentil': 'Lentil',
  };

  const lower = question.toLowerCase();
  let commodity = null;
  for (const [kw, name] of Object.entries(commodityMap)) {
    if (lower.includes(kw)) { commodity = name; break; }
  }

  // Build query
  const filter = { date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) } };
  if (commodity) filter.commodity = commodity;
  if (districtId) filter.districtId = districtId;

  const prices = await db.collection('market_prices')
    .find(filter)
    .sort({ date: -1 })
    .limit(10)
    .toArray();

  // National average for comparison
  let nationalAvg = null;
  if (commodity) {
    const avg = await db.collection('market_prices').aggregate([
      { $match: { commodity, date: { $gte: filter.date.$gte } } },
      { $group: { _id: null, avg: { $avg: '$pricePerKg' } } }
    ]).toArray();
    nationalAvg = avg[0]?.avg ?? null;
  }

  // Use Gemini only to format the answer in natural language
  const dataContext = prices.length > 0
    ? prices.map(p => `${p.marketName || p.districtId}: ${p.commodity} — ৳${p.pricePerKg}/kg (${p.date}, source: ${p.source})`).join('\n')
    : 'No price data found for the requested commodity/district.';

  const prompt = `
You are an agricultural price information assistant for Bangladesh.
Answer the following question based ONLY on the price data below.
If data is missing, say so clearly. Do not invent prices.
Respond in the same language as the question.

PRICE DATA:
${dataContext}
${nationalAvg ? `National average for ${commodity}: ৳${nationalAvg.toFixed(2)}/kg` : ''}

QUESTION: ${question}
  `.trim();

  const answer = await generateText('', prompt);

  return res.json({
    ok: true,
    answer,
    queryType: 'market',
    sourceData: prices,
    meta: { priceRecordsFound: prices.length, commodity, districtId }
  });
}

async function handleGeneralQuery(req, res, question, queryVector) {
  // No districtId filter — search all pathology and threshold chunks globally on Primary Cluster
  const [pathology, thresholds] = await Promise.all([
    vectorSearch('crop_pathology', queryVector, 'embedding', null, 7),
    vectorSearch('crop_thresholds', queryVector, 'embedding', null, 5),
  ]);

  const contextBlocks = [
    ...pathology.map((d, i) => `--- Disease Info ${i + 1} ---\n${d.ragContextChunk}`),
    ...thresholds.map((d, i) => `--- Crop Info ${i + 1} ---\n${d.ragContextChunk}`),
  ].join('\n\n');

  const systemPrompt = `You are an agricultural knowledge assistant for Bangladesh.
Answer the user's question using ONLY the provided context documents.
If the answer is not in the context, say "তথ্য পাওয়া যায়নি" (Information not available).
Never invent chemical names, dosages, or variety codes.
Respond in the same language as the question.`;

  const userPrompt = `CONTEXT:\n${contextBlocks}\n\nQUESTION: ${question}`;
  const answer = await generateText(systemPrompt, userPrompt);

  return res.json({
    ok: true,
    answer,
    queryType: 'general',
    sourceImages: pathology.filter(d => d.searchScore >= 0.78).flatMap(d => d.images || []).slice(0, 4),
    sourceLinks: [
      ...pathology.filter(d => d.searchScore >= 0.78).map(d => ({ label: `BAMIS — ${d.diseaseName || d.cropName}`, url: d.sourceUrl })),
      ...thresholds.filter(d => d.searchScore >= 0.78).map(d => ({ label: `BAMIS — ${d.cropName}`, url: d.sourceUrl })),
    ].filter((v, i, a) => a.findIndex(x => x.url === v.url) === i),
    meta: { pathologyChunks: pathology.length, thresholdChunks: thresholds.length }
  });
}

/**
 * POST /api/rag/query
 * Body: { question: string, districtId: string, language?: "en"|"bn", useHybrid?: boolean }
 *
 * Steps:
 *  1. Fetch district doc + raw BAMIS bulletin (parallel)
 *  2. Embed the question
 *  3. Hybrid/Vector search across regional_advisories + vector search on pathology & thresholds
 *  4. Build prompt: bulletin (primary) + vector/hybrid results + live weather
 *  5. Call Gemini generation
 *  6. Return answer
 */
router.post('/query', async (req, res, next) => {
  try {
    const { question, districtId, language = 'en', useHybrid = false } = req.body;
    if (!question || !districtId) {
      return res.status(400).json({ ok: false, message: '`question` and `districtId` are required' });
    }

    const queryType = classifyQuery(question, districtId);

    if (queryType === 'market') {
      return handleMarketQuery(req, res, question, districtId);
    }

    if (queryType === 'general') {
      const queryVector = await embedText(question);
      return handleGeneralQuery(req, res, question, queryVector);
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

    // ── 3. Embed + parallel hybrid/vector searches ─────────────────────────────
    const queryVector = await embedText(augmentedQuery);
    const [advisories, pathology, thresholds] = await Promise.all([
      searchAdvisories(queryVector, question, 5, { districtId }, useHybrid),
      vectorSearch('crop_pathology', queryVector, 'embedding', null, 5),
      vectorSearch('crop_thresholds', queryVector, 'embedding', null, 2),
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
      ...advisories.map((d, i) => `--- District Advisory ${i + 1} (${d.searchMode || 'vector'}) ---\n${d.ragContextChunk}`),
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
      queryType: 'advisory',
      sourceImages: [
        ...pathology.filter(d => d.searchScore >= 0.78).flatMap(d => d.images || []),
      ].slice(0, 4),
      sourceLinks: [
        ...advisories.map(d => ({ label: `BAMIS Bulletin — ${d.crop || ''}`, url: d.sourceUrl })),
        ...pathology.filter(d => d.searchScore >= 0.78).map(d => ({ label: `BAMIS Disease — ${d.diseaseName || ''}`, url: d.sourceUrl })),
      ].filter((v, i, a) => a.findIndex(x => x.url === v.url) === i),
      meta: {
        districtId,
        districtName: district.name,
        zilaId: zilaId || null,
        hasBulletin: !!bulletinRaw,
        useHybrid,
        searchMode: advisories[0]?.searchMode || (useHybrid ? 'hybrid' : 'vector'),
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