require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { connectDb } = require('../db/connect');
const { parseBulletins } = require('./parseBulletins');
const { parseDiseases } = require('./parseDiseases');
const { parseThresholds } = require('./parseThresholds');
const { embedAll } = require('./embedAndStore');
const { seedDistrictsFromBdapi } = require('../db/seeds/seedDistricts');
const { seedDivisionsFromBdapi } = require('../db/seeds/seedDivisions');
const zilaIdMap = require('./zilaIdMap.json');

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
 *   node backend/ingestion/runIngestion.js
 */
async function runIngestion() {
  console.log('=== KrishiNexus Ingestion Pipeline Starting ===\n');

  await connectDb();

  console.log('--- Step 0: Seeding bdapi divisions and districts ---');
  await seedDivisionsFromBdapi();
  await seedDistrictsFromBdapi();

  // ── Step 1: Parse bulletins ───────────────────────────────────────────────
  console.log('--- Step 1: Parsing bulletins ---');
  if (Object.keys(zilaIdMap).length === 0) {
    console.warn(
      '[runIngestion] WARNING: zilaIdMap.json is empty. Bulletin parsing will skip all documents.\n' +
      'Fill in backend/ingestion/zilaIdMap.json before running.'
    );
  }
  await parseBulletins(zilaIdMap);

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