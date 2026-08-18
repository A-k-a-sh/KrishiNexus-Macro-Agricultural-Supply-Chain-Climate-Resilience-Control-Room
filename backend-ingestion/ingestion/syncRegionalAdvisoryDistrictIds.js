require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { connectDb, getDb } = require('../db/connect');
const zilaIdMap = require('./zilaIdMap.json');

async function syncRegionalAdvisoryDistrictIds() {
  await connectDb();
  const db = getDb();

  const docs = await db.collection('regional_advisories').find({}).project({ _id: 1, sourceId: 1, bamisZilaId: 1, districtId: 1 }).toArray();
  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const zilaId = String(doc.bamisZilaId || doc.sourceId || '');
    const mappedDistrictId = zilaIdMap[zilaId];

    if (!mappedDistrictId) {
      skipped++;
      continue;
    }

    if (String(doc.districtId) === String(mappedDistrictId)) {
      continue;
    }

    await db.collection('regional_advisories').updateOne(
      { _id: doc._id },
      { $set: { districtId: String(mappedDistrictId) } }
    );
    updated++;
  }

  console.log(`[syncRegionalAdvisoryDistrictIds] updated ${updated} docs, skipped ${skipped}`);
}

if (require.main === module) {
  syncRegionalAdvisoryDistrictIds().catch((error) => {
    console.error('[syncRegionalAdvisoryDistrictIds] failed:', error);
    process.exit(1);
  });
}

module.exports = { syncRegionalAdvisoryDistrictIds };
