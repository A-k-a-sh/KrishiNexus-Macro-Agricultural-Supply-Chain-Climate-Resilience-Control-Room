const cron = require('node-cron');
const { runWeatherRefresh } = require('./weatherRefresh');

// /**
//  * Start all cron jobs.
//  * Called once from server.js after DB is connected.
//  *
//  * Schedule: every 6 hours at minute 0
//  * Cron syntax: "0 */6 * * *"
 
//  **//


function startCronJobs() {
  // Run once immediately on server start so the map has data from the first request
  runWeatherRefresh().catch((err) =>
    console.error('[cron] Initial weather refresh failed:', err.message)
  );

  // Then schedule every 24 hours
  cron.schedule('0 */24 * * *', () => {
    console.log('[cron] Running scheduled weather refresh...');
    runWeatherRefresh().catch((err) =>
      console.error('[cron] Scheduled weather refresh failed:', err.message)
    );
  });

  console.log('[cron] Weather refresh scheduled every 6 hours.');
}

module.exports = { startCronJobs };