require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { connectDb, getDb } = require('../db/connect');
const { fetchJsonOrText, getEnvBaseUrl, unwrapPayload } = require('./bamisClient');

const DISEASE_BASE_URL = getEnvBaseUrl('BAMIS_DISEASE_BASE_URL', 'http://localhost:5002/api/fetch-diseases');

function normalizeDiseasePayload(diseaseId, payload) {
  const data = unwrapPayload(payload);
  const rawText = data.rawText || data.text || '';

  return {
    _id: `disease_${diseaseId}`,
    diseaseId: String(diseaseId),
    sourceUrl: `${DISEASE_BASE_URL}/${diseaseId}`,
    diseaseName: data.diseaseName || data.name || data.cropName || data.heading?.replace(/^.*-\s*/, '') || `disease_${diseaseId}`,
    heading: data.heading || data.title || `Disease ${diseaseId}`,
    featuredImage: data.featuredImage || data.image || null,
    images: data.images || [],
    sections: data.sections || [],
    rawText,
    scrapedAt: new Date().toISOString(),
    length: rawText.length,
  };
}

async function scrapeDiseases(start = 1, end = 150) {
  await connectDb();
  const db = getDb();
  const results = [];

  for (let diseaseId = start; diseaseId <= end; diseaseId++) {
    const url = `${DISEASE_BASE_URL}/${diseaseId}`;
    try {
      const payload = await fetchJsonOrText(url);
      const doc = normalizeDiseasePayload(diseaseId, payload);

      if (!doc.rawText || doc.rawText.trim().length === 0) {
        console.warn(`[scrapeDiseases] diseaseId=${diseaseId} returned empty text — skipped`);
        continue;
      }

      await db.collection('raw_diseases').replaceOne({ _id: doc._id }, doc, { upsert: true });
      results.push(doc);
      console.log(`[scrapeDiseases] saved diseaseId=${diseaseId} (${doc.diseaseName})`);
    } catch (error) {
      if (error.status === 404) continue;
      console.warn(`[scrapeDiseases] diseaseId=${diseaseId} failed: ${error.message}`);
    }
  }

  console.log(`[scrapeDiseases] completed with ${results.length} documents`);
  return results;
}

if (require.main === module) {
  scrapeDiseases().catch((error) => {
    console.error('[scrapeDiseases] Failed:', error);
    process.exit(1);
  });
}

module.exports = { scrapeDiseases, normalizeDiseasePayload };