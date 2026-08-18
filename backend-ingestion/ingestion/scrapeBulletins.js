require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { connectDb, getDb } = require('../db/connect');
const { fetchJsonOrText, getEnvBaseUrl, unwrapPayload, extractDistrictNameFromText } = require('./bamisClient');

const BULLENTIN_BASE_URL = getEnvBaseUrl('BAMIS_BULLETIN_BASE_URL', 'http://localhost:5001/api/fetch-bulletin');

function normalizeBulletinPayload(zilaId, payload) {
  const data = unwrapPayload(payload);
  const rawText = data.rawText || data.text || data.content || data.bulletinText || '';

  return {
    _id: `bulletin_${zilaId}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    zilaId: String(zilaId),
    sourceUrl: `${BULLENTIN_BASE_URL}/${zilaId}`,
    bulletinNo: String(data.bulletinNo || data.bulletin_no || data.no || zilaId),
    districtNameBn: data.districtNameBn || data.bnName || extractDistrictNameFromText(rawText),
    scrapedAt: new Date().toISOString(),
    rawText,
    length: rawText.length,
  };
}

async function scrapeBulletins(start = 1, end = 64) {
  await connectDb();
  const db = getDb();
  const results = [];

  for (let zilaId = start; zilaId <= end; zilaId++) {
    const url = `${BULLENTIN_BASE_URL}/${zilaId}`;
    try {
      const payload = await fetchJsonOrText(url);
      const doc = normalizeBulletinPayload(zilaId, payload);

      if (!doc.rawText || doc.rawText.trim().length === 0) {
        console.warn(`[scrapeBulletins] zilaId=${zilaId} returned empty text — skipped`);
        continue;
      }

      await db.collection('raw_bulletins').replaceOne({ _id: doc._id }, doc, { upsert: true });
      results.push(doc);
      console.log(`[scrapeBulletins] saved zilaId=${zilaId} (${doc.districtNameBn || 'unknown'})`);
    } catch (error) {
      console.warn(`[scrapeBulletins] zilaId=${zilaId} failed: ${error.message}`);
    }
  }

  console.log(`[scrapeBulletins] completed with ${results.length} documents`);
  return results;
}

if (require.main === module) {
  scrapeBulletins().catch((error) => {
    console.error('[scrapeBulletins] Failed:', error);
    process.exit(1);
  });
}

module.exports = { scrapeBulletins, normalizeBulletinPayload };