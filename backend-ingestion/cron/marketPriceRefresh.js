const { scrapeWfpCsv } = require('../ingestion/scrapeWfpCsv');
const { scrapeDamPdf } = require('../ingestion/scrapeDamPdf');

async function runMarketPriceRefresh() {
  console.log('[cron] Starting market price refresh...');
  
  try {
    console.log('[cron] Running WFP scraper (fetching last 10 days to be safe)...');
    await scrapeWfpCsv({ days: 10 });
    console.log('[cron] WFP scraper complete.');
  } catch (err) {
    console.error('[cron] WFP scraper failed:', err.message);
  }

  try {
    console.log('[cron] Running DAM scraper (fetching last 2 days to be safe)...');
    await scrapeDamPdf({ days: 2 });
    console.log('[cron] DAM scraper complete.');
  } catch (err) {
    console.error('[cron] DAM scraper failed:', err.message);
  }
  
  console.log('[cron] Market price refresh finished.');
}

module.exports = { runMarketPriceRefresh };
