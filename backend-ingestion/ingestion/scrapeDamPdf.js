const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { connectDb } = require('../db/connect');

const OUTPUT_JSON = path.join(__dirname, 'output', 'dam_prices_latest.json');
const DAM_MAP = require('./damDivisionToDistricts.json');

/**
 * Scrape DAM PDF by invoking the robust python parser (pdfplumber)
 * Then broadcast the division-level data to all mapped district IDs
 * and upsert them into the database.
 */
async function scrapeDamPdf(options = {}) {
  const days = options.days || 1;
  
  console.log(`[DAM] Running python scraper for the last ${days} days...`);
  
  try {
    // execute python scraper
    execSync(`python3 scrape_dam_pdfplumber.py --days ${days}`, { 
      cwd: __dirname, 
      stdio: 'inherit',
      env: process.env
    });
  } catch (err) {
    console.error('[DAM] Python scraper failed:', err.message);
    throw err;
  }
  
  console.log('[DAM] Python scraper finished. Reading output...');
  if (!fs.existsSync(OUTPUT_JSON)) {
    throw new Error('Output JSON not found from python scraper');
  }
  
  const rawRecords = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
  console.log(`[DAM] Parsed ${rawRecords.length} raw division records. Applying Data Broadcasting...`);
  
  const broadcastedRows = [];
  for (const row of rawRecords) {
    // Skip unmapped/unknown commodities
    if (row.commodity === 'Unknown') continue;
    
    const districtIds = DAM_MAP[row.divisionId] || [];
    for (const dId of districtIds) {
      broadcastedRows.push({
        districtId: String(dId),
        marketName: `${row.divisionLabel} Division Average (DAM)`,
        commodity: row.commodity,
        pricePerKg: row.price,
        currency: row.currency || 'BDT',
        date: row.date,
        source: 'DAM'
      });
    }
  }
  
  console.log(`[DAM] Broadcasted into ${broadcastedRows.length} district records.`);
  
  const db = await connectDb();
  const bulkOps = [];
  
  for (const r of broadcastedRows) {
    const commoditySlug = r.commodity.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    // e.g. price_40_wheat_flour_packet_white_20260819
    const docId = `price_${r.districtId}_${commoditySlug}_${r.date.replace(/-/g, '')}`;
    
    bulkOps.push({
      updateOne: {
        filter: { _id: docId },
        update: { 
          $set: {
            ...r,
            fetchedAt: new Date()
          } 
        },
        upsert: true
      }
    });
  }
  
  if (bulkOps.length > 0) {
    console.log(`[DAM] Upserting ${bulkOps.length} records to DB...`);
    const result = await db.collection('market_prices').bulkWrite(bulkOps, { ordered: false });
    console.log(`[DAM] Upsert complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
  } else {
    console.log(`[DAM] No records to upsert.`);
  }
  
  return broadcastedRows;
}

if (require.main === module) {
  // Load config from backend env
  require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
  
  const daysArg = process.argv.includes('--days')
    ? parseInt(process.argv[process.argv.indexOf('--days') + 1], 10) || 1
    : 1;

  scrapeDamPdf({ days: daysArg })
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { scrapeDamPdf };
