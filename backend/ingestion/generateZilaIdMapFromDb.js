require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { connectDb, getDb } = require('../db/connect');

const MAP_PATH = path.resolve(__dirname, 'zilaIdMap.json');

function extractZilaIdFromUrl(url) {
  if (!url) return null;
  const parts = String(url).split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return (/^\d+$/.test(last)) ? String(last) : null;
}

async function generateFromDb() {
  await connectDb();
  const db = getDb();

  const cursor = db.collection('regional_advisories').find({}, { projection: { sourceUrl: 1, districtId: 1, sourceId: 1 } });
  const map = {};
  const seen = new Set();

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const zilaId = extractZilaIdFromUrl(doc.sourceUrl) || (doc.sourceId ? String(doc.sourceId) : null);
    const districtId = doc.districtId ? String(doc.districtId) : null;
    if (zilaId && districtId && !seen.has(zilaId)) {
      map[zilaId] = districtId;
      seen.add(zilaId);
    }
  }

  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n');

  // Update districts with bamisZilaId where applicable
  for (const [zilaId, districtId] of Object.entries(map)) {
    await db.collection('districts').updateOne({ _id: districtId }, { $set: { bamisZilaId: zilaId } });
  }

  console.log(`[generateZilaIdMapFromDb] mapped ${Object.keys(map).length} zila ids and wrote ${MAP_PATH}`);
  return map;
}

if (require.main === module) {
  generateFromDb().catch((err) => {
    console.error('[generateZilaIdMapFromDb] failed:', err);
    process.exit(1);
  });
}

module.exports = { generateFromDb };
