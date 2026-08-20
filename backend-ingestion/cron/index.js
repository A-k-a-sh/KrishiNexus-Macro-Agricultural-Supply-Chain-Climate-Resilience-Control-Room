const cron = require('node-cron');
const { runWeatherRefresh } = require('./weatherRefresh');
const { runMarketPriceRefresh } = require('./marketPriceRefresh');
const { runAlertAggregation } = require('./alertAggregation');
const { runAnalyticsSnapshot } = require('./analyticsSnapshot');

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
  runMarketPriceRefresh().catch((err) =>
    console.error('[cron] Initial market price refresh failed:', err.message)
  );
  runAlertAggregation().catch((err) =>
    console.error('[cron] Initial alert aggregation failed:', err.message)
  );

  // Then schedule every 6 hours
  cron.schedule('0 */6 * * *', () => {
    console.log('[cron] Running scheduled weather refresh...');
    runWeatherRefresh().catch((err) =>
      console.error('[cron] Scheduled weather refresh failed:', err.message)
    );
  });
  
  // Market prices update once a day, but we'll fetch twice a day (every 12 hours) to ensure we don't miss updates
  cron.schedule('0 */12 * * *', () => {
    console.log('[cron] Running scheduled market price refresh...');
    runMarketPriceRefresh().catch((err) =>
      console.error('[cron] Scheduled market price refresh failed:', err.message)
    );
  });

  // Daily alert aggregation at 01:00
  cron.schedule('0 1 * * *', () => {
    console.log('[cron] Running scheduled alert aggregation...');
    runAlertAggregation().catch((err) =>
      console.error('[cron] Scheduled alert aggregation failed:', err.message)
    );
  });

  // Daily analytics snapshot at 23:55
  cron.schedule('55 23 * * *', () => {
    console.log('[cron] Running scheduled analytics snapshot...');
    runAnalyticsSnapshot().catch((err) =>
      console.error('[cron] Scheduled analytics snapshot failed:', err.message)
    );
  });

  console.log('[cron] Weather refresh scheduled every 6 hours.');
  console.log('[cron] Market price refresh scheduled every 12 hours.');
  console.log('[cron] Alert aggregation scheduled daily at 01:00.');
  console.log('[cron] Analytics snapshot scheduled daily at 23:55.');
}

module.exports = { startCronJobs };