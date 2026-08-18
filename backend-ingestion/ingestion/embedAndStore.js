const { getDb } = require('../db/connect');
const { embedText } = require('../services/geminiEmbed');

/**
 * Embed all documents in a collection that have embedding: null.
 *
 * Reads `ragContextChunk` from each document, calls Gemini embedding API,
 * writes the resulting 768-float vector back into the `embedding` field.
 *
 * - Skips documents that already have a non-null embedding (safe to re-run)
 * - 60ms delay between API calls to stay within free-tier rate limits
 * - Logs progress every 10 documents
 *
 * @param {string} collectionName
 * @returns {Promise<{ embedded: number, skipped: number, failed: number }>}
 */
async function embedCollection(collectionName) {
  const db = getDb();
  const col = db.collection(collectionName);

  // Only process documents that don't have an embedding yet
  const docs = await col.find({ embedding: null }).toArray();

  console.log(`[embedAndStore] ${collectionName}: ${docs.length} documents need embedding`);

  let embedded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    if (!doc.ragContextChunk || doc.ragContextChunk.trim().length === 0) {
      console.warn(`[embedAndStore] ${collectionName} doc ${doc._id}: empty ragContextChunk — skipping`);
      skipped++;
      continue;
    }

    try {
      const vector = await embedText(doc.ragContextChunk);

      await col.updateOne(
        { _id: doc._id },
        { $set: { embedding: vector } }
      );

      embedded++;

      if (embedded % 10 === 0) {
        console.log(`[embedAndStore] ${collectionName}: ${embedded}/${docs.length} embedded...`);
      }
    } catch (err) {
      failed++;
      console.error(`[embedAndStore] ${collectionName} doc ${doc._id} failed: ${err.message}`);
      // Continue — don't abort the whole run for one failed embed
    }

    // 60ms gap between API calls — free tier safe
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log(
    `[embedAndStore] ${collectionName} complete — embedded: ${embedded}, skipped: ${skipped}, failed: ${failed}`
  );

  return { embedded, skipped, failed };
}

/**
 * Embed all three RAG-ready collections.
 * Call this after parseBulletins, parseDiseases, parseThresholds have run.
 */
async function embedAll() {
  const results = {};

  results.regional_advisories = await embedCollection('regional_advisories');
  results.crop_pathology      = await embedCollection('crop_pathology');
  results.crop_thresholds     = await embedCollection('crop_thresholds');

  const total = Object.values(results).reduce((sum, r) => sum + r.embedded, 0);
  const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);

  console.log(`\n[embedAndStore] All done. Total embedded: ${total}, Total failed: ${totalFailed}`);

  if (totalFailed > 0) {
    console.warn(`[embedAndStore] ${totalFailed} documents failed to embed. Re-run embedAndStore to retry (they still have embedding: null).`);
  }

  return results;
}

module.exports = { embedAll, embedCollection };