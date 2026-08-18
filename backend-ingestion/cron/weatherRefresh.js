const { getDb } = require('../db/connect');
const { fetchWeather } = require('../services/weatherFetcher');
const { scoreDistrict } = require('../services/riskScorer');

async function processRegionBatch(db, collectionName, regions) {
  let successCount = 0;
  let failCount = 0;

  const CONCURRENCY_LIMIT = 4;
  const chunks = [];
  for (let i = 0; i < regions.length; i += CONCURRENCY_LIMIT) {
    chunks.push(regions.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (region) => {
        try {
          const liveWeather = await fetchWeather(region.lat, region.lon);
          const regionWithWeather = { ...region, liveWeather };
          const { riskStatus, activeAlerts } = await scoreDistrict(regionWithWeather);

          await db.collection(collectionName).updateOne(
            { _id: region._id },
            {
              $set: {
                liveWeather,
                riskStatus,
                activeAlerts,
              },
            }
          );
          successCount++;
        } catch (err) {
          failCount++;
          console.error(`[weatherRefresh] Failed for ${collectionName} ${region._id}:`, err.message);
        }
      })
    );
    await new Promise((r) => setTimeout(r, 150));
  }

  return { successCount, failCount };
}

async function runWeatherRefresh() {
  const db = getDb();
  
  // 1. Process Districts
  const districts = await db
    .collection('districts')
    .find({}, { projection: { _id: 1, lat: 1, lon: 1, activeCrops: 1 } })
    .toArray();

  console.log(`[weatherRefresh] Starting refresh for ${districts.length} districts...`);
  const distResults = await processRegionBatch(db, 'districts', districts);
  
  // 2. Process Upazilas
  const upazilas = await db
    .collection('upazilas')
    .find({}, { projection: { _id: 1, lat: 1, lon: 1, activeCrops: 1 } })
    .toArray();

  console.log(`[weatherRefresh] Starting refresh for ${upazilas.length} upazilas...`);
  const upaResults = await processRegionBatch(db, 'upazilas', upazilas);

  console.log(
    `[weatherRefresh] Done. Districts - Success: ${distResults.successCount}, Failed: ${distResults.failCount}. Upazilas - Success: ${upaResults.successCount}, Failed: ${upaResults.failCount}`
  );
}

module.exports = { runWeatherRefresh };