/**
 * scrapeDamPdf.js  (Option A – improved)
 * ---------------------------------------
 * Phase 3.4 – DAM daily division-level retail price scraper
 *
 * Source : দৈনিক বিভাগীয় খুচরা বাজারদর
 * Listing: https://dam.gov.bd/pages/static-pages/6922e0d1933eb65569e28b21
 *
 * Improvements over v1:
 *  - Parses listing TABLE so each PDF is tagged with correct date + division
 *  - Expanded commodity dictionary that matches even garbled Bengali from pdftotext
 *  - Clean output records (no messy rawLine in final data)
 *
 * Usage:
 *   node scrapeDamPdf.js
 *   node scrapeDamPdf.js --max-dates 1
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const LISTING_URL = 'https://dam.gov.bd/pages/static-pages/6922e0d1933eb65569e28b21';
const OUTPUT_DIR = path.join(__dirname, 'output');
const USER_AGENT = 'Mozilla/5.0 (compatible; KrishiNexusBot/1.0)';

// Column order on the listing page (confirmed from HTML header)
const DIVISION_ORDER = [
  { labelBn: 'ঢাকা',       id: 'dhaka',       labelEn: 'Dhaka' },
  { labelBn: 'চট্টগ্রাম',  id: 'chittagong',  labelEn: 'Chittagong' },
  { labelBn: 'খুলনা',      id: 'khulna',      labelEn: 'Khulna' },
  { labelBn: 'রাজশাহী',    id: 'rajshahi',    labelEn: 'Rajshahi' },
  { labelBn: 'বরিশাল',     id: 'barisal',     labelEn: 'Barisal' },
  { labelBn: 'রংপুর',      id: 'rangpur',     labelEn: 'Rangpur' },
  { labelBn: 'সিলেট',      id: 'sylhet',      labelEn: 'Sylhet' },
  { labelBn: 'ময়মনসিংহ',   id: 'mymensingh',  labelEn: 'Mymensingh' },
];

/**
 * Commodity dictionary.
 * `keys` are substrings that survive pdftotext garbling.
 * Order matters – more specific patterns first.
 */
const COMMODITY_DICT = [
  // Flour / Atta
  { keys: ['প্যোরেট', 'প্যাকেট', 'packet'], name: 'Wheat flour (packet)', unit: 'KG' },
  { keys: ['আটো', 'আটা', 'ata'], name: 'Wheat flour (loose)', unit: 'KG' },

  // Lentils / Dal
  { keys: ['মসুর (উন্নি)', 'মসুর (উন্নত)', 'মসুর উন্নত'], name: 'Lentils (masur, fine)', unit: 'KG' },
  { keys: ['মসুর (কমোটো)', 'মসুর (মোটা)', 'মসুর মোটা'], name: 'Lentils (masur, coarse)', unit: 'KG' },
  { keys: ['মসুর'], name: 'Lentils (masur)', unit: 'KG' },
  { keys: ['মুগ (সরু', 'মুগ সরু', 'মুগ (উন্নি)'], name: 'Beans (mung, fine)', unit: 'KG' },
  { keys: ['মুগ -(কমোটো)', 'মুগ (মোটা)', 'মুগ মোটা', 'মুগ -'], name: 'Beans (mung, coarse)', unit: 'KG' },
  { keys: ['মুগ'], name: 'Beans (mung)', unit: 'KG' },
  { keys: ['ক সোরী', 'খেসারী', 'khesari'], name: 'Lentils (khesari)', unit: 'KG' },
  { keys: ['মোশ েলোই', 'মাষ কলাই', 'maskalai'], name: 'Black gram (maskalai)', unit: 'KG' },
  { keys: ['বুট', 'boot', 'chickpea'], name: 'Chickpeas', unit: 'KG' },
  { keys: ['েলোই', 'কলাই', 'kalai'], name: 'Gram (kalai)', unit: 'KG' },

  // Oils
  { keys: ['সয়োনর্ি (ক োলো)', 'সয়াবিন (খোলা)', 'soybean'], name: 'Oil (soybean, loose)', unit: 'L' },
  { keys: ['সয়োনর্ি (েযোি ৫', 'সয়োনর্ি (েযোি 5', 'সয়াবিন (ক্যান ৫'], name: 'Oil (soybean, 5L can)', unit: '5L' },
  { keys: ['সয়োনর্ি (েযোি', 'সয়াবিন (ক্যান'], name: 'Oil (soybean, 1L can)', unit: 'L' },
  { keys: ['সয়োনর্ি', 'সয়াবিন'], name: 'Oil (soybean)', unit: 'L' },
  { keys: ['পোম (ক োলো)', 'পাম (খোলা)', 'palm'], name: 'Oil (palm, loose)', unit: 'L' },
  { keys: ['পোম', 'পাম'], name: 'Oil (palm)', unit: 'L' },
  { keys: ['সনরেো', 'সরিষা', 'mustard'], name: 'Oil (mustard, loose)', unit: 'L' },

  // Sugar / Salt
  { keys: ['আমেোিীকৃি', 'আমদানিকৃত', 'নিনি', 'চিনি'], name: 'Sugar', unit: 'KG' },
  { keys: ['লবণ', 'salt'], name: 'Salt (iodized)', unit: 'KG' },

  // Onion / Garlic / Ginger / Chili
  { keys: ['কেঁয়োি (কেশী)', 'পেঁয়াজ (দেশী)', 'onion.*local'], name: 'Onions (local)', unit: 'KG' },
  { keys: ['কেঁয়োি', 'পেঁয়াজ', 'onion'], name: 'Onions', unit: 'KG' },
  { keys: ['রসুি (কেশী)', 'রসুন (দেশী)'], name: 'Garlic (local)', unit: 'KG' },
  { keys: ['রসুি', 'রসুন', 'garlic'], name: 'Garlic', unit: 'KG' },
  { keys: ['আেো', 'আদা', 'ginger'], name: 'Ginger', unit: 'KG' },
  { keys: ['মরিচ', 'chili', 'chilli'], name: 'Chili', unit: 'KG' },
  { keys: ['হলুদ', 'turmeric'], name: 'Turmeric', unit: 'KG' },

  // Potato / Vegetables
  { keys: ['আলু', 'potato'], name: 'Potatoes', unit: 'KG' },
  { keys: ['টমেটো', 'tomato'], name: 'Tomatoes', unit: 'KG' },
  { keys: ['বেগুন', 'eggplant'], name: 'Eggplants', unit: 'KG' },

  // Rice
  { keys: ['স্বর্না', 'স্বরনা', 'swarna'], name: 'Rice (Swarna)', unit: 'KG' },
  { keys: ['পাজাম', 'pajam'], name: 'Rice (Pajam)', unit: 'KG' },
  { keys: ['জিরাশাইল', 'zirashail'], name: 'Rice (Zirashail)', unit: 'KG' },
  { keys: ['ব্রি ধান', 'brri'], name: 'Rice (BRRI)', unit: 'KG' },
  { keys: ['চাল', 'rice'], name: 'Rice', unit: 'KG' },

  // Meat / Eggs / Fish
  { keys: ['গরু', 'beef'], name: 'Meat (beef)', unit: 'KG' },
  { keys: ['খাসী', 'খাসি', 'mutton'], name: 'Meat (mutton)', unit: 'KG' },
  { keys: ['মুরনগ', 'মুরগী', 'মুরগি', 'chicken'], name: 'Meat (chicken)', unit: 'KG' },
  { keys: ['কসোিোলী', 'সোনালী', 'sonali'], name: 'Meat (chicken, sonali)', unit: 'KG' },
  { keys: ['ডিম', 'egg'], name: 'Eggs', unit: 'piece' },
  { keys: ['রুই', 'rui'], name: 'Fish (rui)', unit: 'KG' },
  { keys: ['ইলিশ', 'hilsa'], name: 'Fish (hilsa)', unit: 'KG' },
  { keys: ['পাঙ্গাস', 'pangas'], name: 'Fish (pangasius)', unit: 'KG' },
  { keys: ['তেলাপিয়া', 'tilapia'], name: 'Fish (tilapia)', unit: 'KG' },

  // Dairy
  { keys: ['দুধ', 'milk'], name: 'Milk', unit: 'L' },
];

// ---------- helpers ----------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      { headers: { 'User-Agent': USER_AGENT }, timeout: 45000, rejectUnauthorized: false },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchBuffer(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const EN_DIGITS = '0123456789';
function bnToEn(str) {
  return str.replace(/[০-৯]/g, (d) => EN_DIGITS[BN_DIGITS.indexOf(d)]);
}

function parseDateToken(token) {
  const t = bnToEn(token);
  const m = t.match(/(\d{1,2})-(\d{1,2})-(20\d{2})/);
  if (!m) return null;
  const d = m[1], mo = m[2], y = m[3];
  return y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0');
}

/**
 * Parse listing HTML → [{ date, divisionId, divisionLabel, pdfUrl }]
 */
function parseListing(html) {
  const results = [];
  const rows = html.split(/<tr[^>]*>/i);

  for (const row of rows) {
    const dateMatch = row.match(/([০-৯]{1,2}-[০-৯]{1,2}-[০-৯]{4}|\d{1,2}-\d{1,2}-20\d{2})/);
    if (!dateMatch) continue;

    const date = parseDateToken(dateMatch[1]);
    if (!date) continue;

    const pdfs = [];
    const re = /https:\/\/objectstorage[^"'>\s]+\.pdf/gi;
    let m;
    while ((m = re.exec(row)) !== null) pdfs.push(m[0]);
    if (pdfs.length === 0) continue;

    pdfs.slice(0, 8).forEach((pdfUrl, idx) => {
      const div = DIVISION_ORDER[idx] || { id: 'col' + idx, labelBn: 'col' + idx, labelEn: 'col' + idx };
      results.push({
        date: date,
        divisionId: div.id,
        divisionLabel: div.labelEn,
        divisionLabelBn: div.labelBn,
        pdfUrl: pdfUrl,
      });
    });
  }
  return results;
}

function pdfToText(pdfPath) {
  try {
    return execSync('pdftotext -layout "' + pdfPath + '" -', {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
  } catch (e) {
    return '';
  }
}

function matchCommodity(line) {
  const lower = line.toLowerCase();
  for (const entry of COMMODITY_DICT) {
    for (const key of entry.keys) {
      if (key.length < 3) continue;
      if (line.includes(key) || lower.includes(key.toLowerCase())) {
        return { name: entry.name, unit: entry.unit };
      }
    }
  }
  return null;
}

function extractRows(text, meta) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  const rangeRe = /(\d{1,4}(?:\.\d{1,2})?)\s*[-–—]\s*(\d{1,4}(?:\.\d{1,2})?)/;

  for (const line of lines) {
    const m = line.match(rangeRe);
    if (!m) continue;

    const minPrice = parseFloat(m[1]);
    const maxPrice = parseFloat(m[2]);
    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) continue;
    if (minPrice > maxPrice || maxPrice > 5000 || minPrice < 1) continue;

    const matched = matchCommodity(line);
    if (!matched) continue;

    const price = Math.round(((minPrice + maxPrice) / 2) * 100) / 100;

    rows.push({
      date: meta.date,
      divisionId: meta.divisionId,
      divisionLabel: meta.divisionLabel,
      commodity: matched.name,
      unit: matched.unit,
      minPrice: minPrice,
      maxPrice: maxPrice,
      price: price,
      priceType: 'Retail',
      currency: 'BDT',
      source: 'DAM',
    });
  }

  const seen = new Set();
  return rows.filter((r) => {
    if (seen.has(r.commodity)) return false;
    seen.add(r.commodity);
    return true;
  });
}

async function scrapeDamPdf(options) {
  options = options || {};
  const maxDates = options.maxDates || 1;
  ensureDir(OUTPUT_DIR);

  console.log('[DAM] Fetching listing page...');
  const html = (await fetchBuffer(LISTING_URL)).toString('utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'dam_listing.html'), html);

  const entries = parseListing(html);
  console.log('[DAM] Parsed ' + entries.length + ' PDF entries from listing');

  const byDate = new Map();
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }
  const dates = Array.from(byDate.keys()).sort().reverse().slice(0, maxDates);
  console.log('[DAM] Processing dates: ' + dates.join(', '));

  const allRecords = [];

  for (const date of dates) {
    const dayEntries = byDate.get(date);
    for (const entry of dayEntries) {
      const pdfName = date + '_' + entry.divisionId + '.pdf';
      const pdfPath = path.join(OUTPUT_DIR, pdfName);

      try {
        process.stdout.write('[DAM] ' + date + ' / ' + entry.divisionLabel + ' ... ');
        const buf = await fetchBuffer(entry.pdfUrl);
        fs.writeFileSync(pdfPath, buf);

        const text = pdfToText(pdfPath);
        fs.writeFileSync(pdfPath.replace(/\.pdf$/i, '.txt'), text);

        const rows = extractRows(text, entry);
        
        // Data Broadcasting to Districts
        const damMap = require('./damDivisionToDistricts.json');
        const districtIds = damMap[entry.divisionId] || [];
        const broadcastedRows = [];
        
        for (const row of rows) {
          if (districtIds.length > 0) {
            for (const dId of districtIds) {
              broadcastedRows.push({
                ...row,
                districtId: dId,
                marketName: entry.divisionLabel + ' Division Average (DAM)'
              });
            }
          } else {
            broadcastedRows.push(row);
          }
        }
        
        console.log(broadcastedRows.length + ' broadcasted records (from ' + rows.length + ' commodities)');
        allRecords.push.apply(allRecords, broadcastedRows);
      } catch (err) {
        console.log('FAIL: ' + err.message);
      }
    }
  }

  const outPath = path.join(OUTPUT_DIR, 'dam_prices_latest.json');
  fs.writeFileSync(outPath, JSON.stringify(allRecords, null, 2));
  console.log('[DAM] Total records: ' + allRecords.length + ' → ' + outPath);

  const summary = {};
  for (const r of allRecords) {
    summary[r.divisionLabel] = (summary[r.divisionLabel] || 0) + 1;
  }
  console.log('[DAM] Per division:', summary);

  return allRecords;
}

if (require.main === module) {
  let maxDates = 1;
  if (process.argv.includes('--max-dates')) {
    maxDates = parseInt(process.argv[process.argv.indexOf('--max-dates') + 1], 10) || 1;
  }

  scrapeDamPdf({ maxDates: maxDates })
    .then((rows) => {
      console.log('\n=== SAMPLE (first 12) ===');
      console.log(JSON.stringify(rows.slice(0, 12), null, 2));
      const unknown = rows.filter((r) => r.commodity === 'Unknown').length;
      console.log('\nTotal: ' + rows.length + '  |  Unknown commodities: ' + unknown);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { scrapeDamPdf };
