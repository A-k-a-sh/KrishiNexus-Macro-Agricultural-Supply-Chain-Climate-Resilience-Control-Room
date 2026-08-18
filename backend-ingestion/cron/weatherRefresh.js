const { getDb } = require('../db/connect');
const { fetchWeather } = require('../services/weatherFetcher');
const { scoreDistrict } = require('../services/riskScorer');

/**
 * Refresh live weather and recompute risk scores for all 64 districts.
 *
 * - Fetches Open-Meteo for each district sequentially (100ms gap to be polite)
 * - Runs riskScorer after each weather update
 * - Writes liveWeather + riskStatus + activeAlerts back to the districts document
 *
 * Called by the cron scheduler every 6 hours.
 * Can also be run manually: node -e "require('./cron/weatherRefresh').runWeatherRefresh()"
 */
async function runWeatherRefresh() {
  const db = getDb();
  const districts = await db
    .collection('districts')
    .find({}, { projection: { _id: 1, lat: 1, lon: 1, activeCrops: 1 } })
    .toArray();

  console.log(`[weatherRefresh] Starting refresh for ${districts.length} districts...`);

  let successCount = 0;
  let failCount = 0;

  // Run in chunks/concurrency-limited batches to prevent timeouts in serverless execution environments (e.g. Vercel)
  const CONCURRENCY_LIMIT = 4;
  const chunks = [];
  for (let i = 0; i < districts.length; i += CONCURRENCY_LIMIT) {
    chunks.push(districts.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (district) => {
        try {
          // Fetch live weather from Open-Meteo
          const liveWeather = await fetchWeather(district.lat, district.lon);

          // Score risk using fresh weather + existing activeCrops
          const districtWithWeather = { ...district, liveWeather };
          const { riskStatus, activeAlerts } = await scoreDistrict(districtWithWeather);

          // Write everything back in one update
          await db.collection('districts').updateOne(
            { _id: district._id },
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
          console.error(`[weatherRefresh] Failed for district ${district._id}:`, err.message);
        }
      })
    );
    // 150ms gap between batches to be polite to Open-Meteo API
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(
    `[weatherRefresh] Done. Success: ${successCount}, Failed: ${failCount}`
  );
}

module.exports = { runWeatherRefresh };