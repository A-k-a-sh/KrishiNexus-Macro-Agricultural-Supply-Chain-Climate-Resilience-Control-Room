const { getDb } = require('../connect');

async function seedDistrictsFromBdapi() {
  const response = await fetch('https://bdapi.vercel.app/api/v.1/district');

  if (!response.ok) {
    throw new Error(`Failed to fetch bdapi districts: ${response.status}`);
  }

  const payload = await response.json();
  const districts = payload?.data || payload || [];
  const db = getDb();
  const ids = districts.map((district) => String(district.id));

  for (const district of districts) {
    const document = {
      _id: String(district.id),
      divisionId: String(district.division_id),
      bamisZilaId: district.bamisZilaId || null,
      name: district.name,
      bnName: district.bn_name,
      lat: district.lat,
      lon: district.lon,
      url: district.url || null,
      liveWeather: null,
      riskStatus: 'green',
      activeAlerts: [],
      activeCrops: [],
    };

    await db.collection('districts').replaceOne({ _id: document._id }, document, { upsert: true });
  }

  await db.collection('districts').deleteMany({ _id: { $nin: ids } });

  console.log(`[seedDistricts] Seeded ${districts.length} districts from bdapi`);
  return districts.length;
}

module.exports = { seedDistrictsFromBdapi };

if (require.main === module) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
  const { connectDb } = require('../connect');

  connectDb()
    .then(seedDistrictsFromBdapi)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[seedDistricts] Failed:', error);
      process.exit(1);
    });
}