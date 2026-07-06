/**
 * rebuildChunks.js
 *
 * Rebuilds ragContextChunk using the richer source text (fullText / rawText)
 * and re-embeds all documents in crop_pathology and crop_thresholds.
 *
 * RESUMABLE: Uses a `rebuiltAt` timestamp field so re-runs safely skip
 * already-processed documents. Safe to run multiple times until complete.
 *
 * Run:
 *   node backend/ingestion/rebuildChunks.js
 *   (or from the backend/ folder: node ingestion/rebuildChunks.js)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const { embedText } = require('../services/geminiEmbed');

const RATE_LIMIT_DELAY_MS = 800; // 600ms between calls → ~100 req/min (well within 1500/min free tier)

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Rebuild and re-embed a single collection.
 * @param {import('mongodb').Db} db
 * @param {'crop_pathology'|'crop_thresholds'} collectionName
 */
async function rebuildCollection(db, collectionName) {
  const col = db.collection(collectionName);

  // Only process docs that haven't been rebuilt yet
  const docs = await col.find({ rebuiltAt: { $exists: false } }).toArray();
  console.log(`\n[${collectionName}] ${docs.length} docs need rebuilding...`);

  if (docs.length === 0) {
    console.log(`[${collectionName}] ✓ Already fully rebuilt. Skipping.`);
    return 0;
  }

  // For crop_pathology: pre-load raw_diseases into a map for quick lookup
  let rawDiseasesMap = {};
  if (collectionName === 'crop_pathology') {
    const rawDocs = await db.collection('raw_diseases').find({}).toArray();
    for (const rd of rawDocs) {
      rawDiseasesMap[rd.diseaseId] = rd;
    }
    console.log(`  Loaded ${rawDocs.length} raw_diseases docs for cross-reference.`);
  }

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    let newChunk;

    if (collectionName === 'crop_pathology') {
      // Priority: sourceRawText (clean per-section text) > fullText > raw_diseases section > raw_diseases page
      let richText = (doc.sourceRawText || doc.fullText || '').trim();

      if (richText.length < 15 && doc.sourceId) {
        const rawSource = rawDiseasesMap[doc.sourceId];
        if (rawSource) {
          // Try matching section by index from the _id (e.g. path_7_2 → index 2)
          const idParts = (doc._id || '').split('_');
          const sectionIdx = parseInt(idParts[idParts.length - 1]);
          const sections = rawSource.sections || [];
          if (!isNaN(sectionIdx) && sections[sectionIdx]) {
            richText = (sections[sectionIdx].text || '').trim();
          }
          // Still empty? Use the disease page's full rawText as last resort
          if (richText.length < 15) {
            richText = (rawSource.rawText || '').trim();
          }
        }
      }

      if (richText.length < 15) {
        console.warn(`  [skip] ${doc._id} — no usable text found`);
        skipped++;
        continue;
      }

      // cropName in stored docs = the BAMIS page title (crop category, e.g. "ধান আউশ")
      // diseaseName = the section title (e.g. "বাদামী দাগ"), but may also be the crop category
      // for fallback full-page chunks where both fields are the same.
      // Use the parent raw_diseases.diseaseName as the authoritative crop label.
      const rawSource = rawDiseasesMap[doc.sourceId];
      const cropLabel = doc.cropName || (rawSource ? rawSource.diseaseName : '') || doc.diseaseName || '';
      newChunk = `ফসল: ${cropLabel}। রোগ তথ্য: ${richText}`;

    } else {
      // crop_thresholds: ragContextChunk already has rawText baked in — just re-embed
      const existingChunk = (doc.ragContextChunk || '').trim();
      if (existingChunk.length < 20) {
        console.warn(`  [skip] ${doc._id} — ragContextChunk too short`);
        skipped++;
        continue;
      }
      newChunk = existingChunk;
    }

    // Re-embed
    let embedding;
    try {
      embedding = await embedText(newChunk);
    } catch (err) {
      console.error(`  [embed error] ${doc._id}: ${err.message}`);
      if (err.message.includes('429') || err.message.toLowerCase().includes('quota')) {
        console.error(`\n⚠ Quota limit hit after ${updated} updates. Re-run to resume from here.\n`);
        break;
      }
      skipped++;
      continue;
    }

    await col.updateOne(
      { _id: doc._id },
      {
        $set: {
          ragContextChunk: newChunk,
          embedding,
          rebuiltAt: new Date().toISOString(),
        },
      }
    );

    updated++;
    if (updated % 10 === 0) {
      console.log(`  ${updated}/${docs.length} rebuilt...`);
    }

    await sleep(RATE_LIMIT_DELAY_MS);
  }

  console.log(
    `[${collectionName}] Done. ${updated} rebuilt, ${skipped} skipped.`
  );
  return updated;
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI not set. Check backend/.env');
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY not set. Check backend/.env');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  console.log('✓ Connected to MongoDB');

  const db = client.db();

  try {
    await rebuildCollection(db, 'crop_pathology');
    await rebuildCollection(db, 'crop_thresholds');
  } finally {
    await client.close();
    console.log('\n✓ Done. Disconnected from MongoDB.');
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
