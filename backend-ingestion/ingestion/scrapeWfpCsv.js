/**
 * scrapeWfpCsv.js
 * ----------------
 * Phase 3.3 – WFP / HDX food prices scraper for Bangladesh
 *
 * Source: https://data.humdata.org/dataset/wfp-food-prices-for-bangladesh
 * Direct CSV (updated periodically by WFP):
 *   https://data.humdata.org/dataset/c76eabb7-fdb5-43b7-a5c4-09091bb8acde/resource/966ab7ac-56d6-4dac-8eba-dfe815d59a52/download/wfp_food_prices_bgd.csv
 *
 * What it does:
 *  1. Downloads the full Bangladesh food prices CSV
 *  2. Parses rows
 *  3. Maps market names → districtId (via wfpMarketMap)
 *  4. Normalizes into market_prices shape
 *  5. Optionally filters to recent N days
 *
 * Usage:
 *   node scrapeWfpCsv.js
 *   node scrapeWfpCsv.js --days 90
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
// csv-parse is optional – we fall back to a minimal parser if not installed

const CSV_URL = process.env.WFP_CSV_URL ||
  'https://data.humdata.org/dataset/c76eabb7-fdb5-43b7-a5c4-09091bb8acde/resource/966ab7ac-56d6-4dac-8eba-dfe815d59a52/download/wfp_food_prices_bgd.csv';

const OUTPUT_DIR = path.join(__dirname, 'output');
const USER_AGENT = 'Mozilla/5.0 (compatible; KrishiNexusBot/1.0; +https://krishinexus.gov.bd)';

/**
 * Simple market → districtId map.
 * Keys are WFP "market" values (or admin2).
 * Values should match your districts collection _id / districtId strings.
 * Extend this after MANUAL STEP 3 review.
 */
const WFP_MARKET_MAP = require('./wfpMarketMap.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 120000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchBuffer(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/** Minimal CSV parser if csv-parse is not installed */
function parseCsvManual(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // handle quoted fields simply
    const cols = [];
    let cur = '';
    let inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ',' && !inQ) {
        cols.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function parseCsv(text) {
  try {
    const { parse } = require('csv-parse/sync');
    return parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch {
    return parseCsvManual(text);
  }
}

/**
 * Normalize a WFP row into market_prices shape
 */
function normalizeRow(r) {
  const market = r.market || r.admin2 || '';
  const districtId = WFP_MARKET_MAP[market] || null;

  // Prefer per-KG. WFP sometimes uses 100 KG for wholesale rice/wheat.
  let price = parseFloat(r.price);
  let unit = (r.unit || 'KG').toUpperCase();
  if (unit === '100 KG' && !Number.isNaN(price)) {
    price = Math.round((price / 100) * 100) / 100;
    unit = 'KG';
  }

  return {
    date: r.date, // YYYY-MM-DD
    commodity: r.commodity,
    category: r.category || null,
    market,
    marketId: r.market_id || null,
    admin1: r.admin1 || null, // division-ish
    admin2: r.admin2 || null, // district-ish
    districtId,
    latitude: r.latitude ? parseFloat(r.latitude) : null,
    longitude: r.longitude ? parseFloat(r.longitude) : null,
    unit,
    priceType: r.pricetype || 'Retail', // Retail / Wholesale
    priceflag: r.priceflag || null,
    currency: r.currency || 'BDT',
    price: Number.isNaN(price) ? null : price,
    usdprice: r.usdprice ? parseFloat(r.usdprice) : null,
    source: 'WFP',
  };
}

/**
 * Main scrape function
 * @param {object} options
 * @param {number} options.days  only keep rows from last N days (default 0 = all)
 * @returns {Promise<object[]>}
 */
async function scrapeWfpCsv(options = {}) {
  const { days = 0 } = options;
  ensureDir(OUTPUT_DIR);

  console.log('[WFP] Downloading CSV...');
  const buf = await fetchBuffer(CSV_URL);
  const csvPath = path.join(OUTPUT_DIR, 'wfp_bangladesh.csv');
  fs.writeFileSync(csvPath, buf);
  console.log(`[WFP] Saved ${buf.length} bytes → ${csvPath}`);

  const text = buf.toString('utf8');
  const rawRows = parseCsv(text);
  console.log(`[WFP] Parsed ${rawRows.length} rows`);

  let records = rawRows.map(normalizeRow).filter((r) => r.price != null);

  if (days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    records = records.filter((r) => r.date >= cutoffStr);
    console.log(`[WFP] Filtered to last ${days} days → ${records.length} rows`);
  }

  // Stats
  const markets = new Set(records.map((r) => r.market));
  const commodities = new Set(records.map((r) => r.commodity));
  const mapped = records.filter((r) => r.districtId).length;
  console.log(`[WFP] Unique markets: ${markets.size}`);
  console.log(`[WFP] Unique commodities: ${commodities.size}`);
  console.log(`[WFP] Rows with districtId mapped: ${mapped}/${records.length}`);

  const outJson = path.join(OUTPUT_DIR, 'wfp_prices_normalized.json');
  // Write a sample + summary (full file can be large)
  const sample = records.slice(-500); // last 500
  fs.writeFileSync(
    outJson,
    JSON.stringify(
      {
        total: records.length,
        sampleCount: sample.length,
        markets: [...markets].sort(),
        commodities: [...commodities].sort(),
        sample,
      },
      null,
      2
    )
  );
  console.log(`[WFP] Wrote summary → ${outJson}`);

  // DB Upsert
  const { connectDb } = require('../db/connect');
  const db = await connectDb();
  const bulkOps = [];
  
  for (const r of records) {
    if (!r.districtId) continue;
    
    const commoditySlug = r.commodity.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const docId = `price_${r.districtId}_${commoditySlug}_${r.date.replace(/-/g, '')}`;
    
    const doc = {
      districtId: r.districtId,
      marketName: r.market,
      commodity: r.commodity,
      pricePerKg: r.price,
      currency: r.currency,
      date: r.date,
      source: 'WFP',
      fetchedAt: new Date()
    };
    
    bulkOps.push({
      updateOne: {
        filter: { _id: docId },
        update: { $set: doc },
        upsert: true
      }
    });
  }
  
  if (bulkOps.length > 0) {
    console.log(`[WFP] Upserting ${bulkOps.length} records to DB...`);
    const result = await db.collection('market_prices').bulkWrite(bulkOps, { ordered: false });
    console.log(`[WFP] Upsert complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`);
  } else {
    console.log(`[WFP] No records with districtId to upsert.`);
  }

  return records;
}

// CLI
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });
  
  const daysArg = process.argv.includes('--days')
    ? parseInt(process.argv[process.argv.indexOf('--days') + 1], 10) || 90
    : 90;

  scrapeWfpCsv({ days: daysArg })
    .then((rows) => {
      console.log('\n=== SAMPLE RECORDS (last 5) ===');
      console.log(JSON.stringify(rows.slice(-5), null, 2));
      console.log(`\nTotal returned: ${rows.length}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { scrapeWfpCsv, WFP_MARKET_MAP };
