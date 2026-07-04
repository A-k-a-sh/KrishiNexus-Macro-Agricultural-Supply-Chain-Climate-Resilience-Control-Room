require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { connectDb, getDb } = require('../db/connect');
const { fetchJsonOrText, getEnvBaseUrl, unwrapPayload } = require('./bamisClient');

const THRESHOLD_BASE_URL = getEnvBaseUrl('BAMIS_THRESHOLD_BASE_URL', 'http://localhost:5003/api/fetch-thresholds');

function normalizeThresholdPayload(thresholdId, payload) {
  const data = unwrapPayload(payload);
  const rawText = data.rawText || data.text || '';

  return {
    _id: `threshold_${thresholdId}`,
    thresholdId: String(thresholdId),
    sourceUrl: `${THRESHOLD_BASE_URL}/${thresholdId}`,
    heading: data.heading || data.title || `Threshold ${thresholdId}`,
    images: data.images || [],
    rawText,
    scrapedAt: new Date().toISOString(),
    length: rawText.length,
  };
}

async function scrapeThresholds(start = 1, end = 100) {
  await connectDb();
  const db = getDb();
  const results = [];

  for (let thresholdId = start; thresholdId <= end; thresholdId++) {
    const url = `${THRESHOLD_BASE_URL}/${thresholdId}`;
    try {
      const payload = await fetchJsonOrText(url);
      const doc = normalizeThresholdPayload(thresholdId, payload);

      if (!doc.rawText || doc.rawText.trim().length === 0) {
        console.warn(`[scrapeThresholds] thresholdId=${thresholdId} returned empty text — skipped`);
        continue;
      }

      await db.collection('raw_thresholds').replaceOne({ _id: doc._id }, doc, { upsert: true });
      results.push(doc);
      console.log(`[scrapeThresholds] saved thresholdId=${thresholdId}`);
    } catch (error) {
      if (error.status === 404) continue;
      console.warn(`[scrapeThresholds] thresholdId=${thresholdId} failed: ${error.message}`);
    }
  }

  console.log(`[scrapeThresholds] completed with ${results.length} documents`);
  return results;
}

if (require.main === module) {
  scrapeThresholds().catch((error) => {
    console.error('[scrapeThresholds] Failed:', error);
    process.exit(1);
  });
}

module.exports = { scrapeThresholds, normalizeThresholdPayload };