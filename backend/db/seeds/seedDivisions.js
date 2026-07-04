const { getDb } = require('../connect');

async function seedDivisionsFromBdapi() {
  const response = await fetch('https://bdapi.vercel.app/api/v.1/division');

  if (!response.ok) {
    throw new Error(`Failed to fetch bdapi divisions: ${response.status}`);
  }

  const payload = await response.json();
  const divisions = payload?.data || payload || [];
  const db = getDb();
  const ids = divisions.map((division) => String(division.id));

  for (const division of divisions) {
    const document = {
      _id: String(division.id),
      name: division.name,
      bnName: division.bn_name,
      url: division.url || null,
    };

    await db.collection('divisions').replaceOne({ _id: document._id }, document, { upsert: true });
  }

  await db.collection('divisions').deleteMany({ _id: { $nin: ids } });

  console.log(`[seedDivisions] Seeded ${divisions.length} divisions from bdapi`);
  return divisions.length;
}

module.exports = { seedDivisionsFromBdapi };

if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  const { connectDb } = require('../connect');

  connectDb()
    .then(seedDivisionsFromBdapi)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seedDivisions] Failed:', error);
      process.exit(1);
    });
}