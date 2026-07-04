require('dotenv').config({ path: '../.env' });

const { connectDb } = require('../db/connect');
const { parseBulletins } = require('./parseBulletins');
const { parseDiseases } = require('./parseDiseases');
const { parseThresholds } = require('./parseThresholds');
const { embedAll } = require('./embedAndStore');

/**
 * BAMIS zilaId → bdapi district _id mapping.
 *
 * ⚠️ THIS MAP IS INCOMPLETE — YOU MUST VERIFY AND FILL IN ALL 64 ENTRIES.
 *
 * How to build this map:
 * 1. Fetch all 64 bulletins from raw_bulletins collection
 * 2. Each bulletin's rawText starts with "জেলা: {district name in Bengali}"
 * 3. Match that Bengali name against bdapi /district data (bnName field)
 * 4. Fill in the correct bdapi district _id for each bamisZilaId below
 *
 * Format: { "bamisZilaId": "bdapiDistrictId" }
 *
 * The entries below are EXAMPLES ONLY — the numeric IDs may not be correct.
 * Do not assume bamisZilaId === bdapiDistrictId. Verify each one.
 */
const ZILA_ID_MAP = {
  // "bamisZilaId": "bdapiDistrictId"
  // Fill these in after running your mapping verification script
  // Example entries (VERIFY BEFORE USE):
  // "1":  "20",  // Dhaka
  // "2":  "26",  // Faridpur
  // "22": "4",   // Barisal
  // ...add all 64
};

/**
 * Master ingestion pipeline. Run this once after scraping, then re-run
 * whenever new bulletins/diseases/thresholds are scraped.
 *
 * Steps:
 *  1. Parse raw_bulletins → regional_advisories (chunks, no embeddings yet)
 *  2. Parse raw_diseases  → crop_pathology      (chunks, no embeddings yet)
 *  3. Parse raw_thresholds → crop_thresholds    (chunks, no embeddings yet)
 *  4. embedAll()          → calls Gemini embedding API for all null-embedding docs
 *
 * Safe to re-run: parsers use upsert, embedAndStore skips already-embedded docs.
 *
 * Run with:
 *   node server/ingestion/runIngestion.js
 */
async function runIngestion() {
  console.log('=== KrishiNexus Ingestion Pipeline Starting ===\n');

  await connectDb();

  // ── Step 1: Parse bulletins ───────────────────────────────────────────────
  console.log('--- Step 1: Parsing bulletins ---');
  if (Object.keys(ZILA_ID_MAP).length === 0) {
    console.warn(
      '[runIngestion] WARNING: ZILA_ID_MAP is empty. Bulletin parsing will skip all documents.\n' +
      'Fill in server/ingestion/runIngestion.js ZILA_ID_MAP before running.'
    );
  }
  await parseBulletins(ZILA_ID_MAP);

  // ── Step 2: Parse diseases ────────────────────────────────────────────────
  console.log('\n--- Step 2: Parsing diseases ---');
  await parseDiseases();

  // ── Step 3: Parse thresholds ──────────────────────────────────────────────
  console.log('\n--- Step 3: Parsing thresholds ---');
  await parseThresholds();

  // ── Step 4: Embed all newly parsed chunks ─────────────────────────────────
  console.log('\n--- Step 4: Embedding all chunks via Gemini API ---');
  console.log('This may take 1-2 minutes depending on corpus size...');
  await embedAll();

  console.log('\n=== Ingestion Pipeline Complete ===');
  process.exit(0);
}

runIngestion().catch((err) => {
  console.error('\n[runIngestion] Pipeline failed:', err);
  process.exit(1);
});