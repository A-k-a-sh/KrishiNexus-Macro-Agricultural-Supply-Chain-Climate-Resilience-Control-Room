require('dotenv').config();
const { getDb, getSearchDb } = require('../db/connect');
const { parseBulletinDoc } = require('../ingestion/parseBulletins');
const { embedText } = require('../services/geminiEmbed');
const bamisClient = require('../ingestion/bamisClient');
const zilaIdMap = require('../ingestion/zilaIdMap.json');

// Reverse map: bamisZilaId → bdapi districtId
const zilaToDistrict = {};
for (const [zilaId, districtId] of Object.entries(zilaIdMap)) {
  zilaToDistrict[zilaId] = districtId;
}

const DELAY_MS = 600; // Updated to 600ms for safety with Gemini quotas

async function bulletinReIngestion() {
  const db = getDb();
  let searchDb = null;
  try {
    searchDb = getSearchDb ? getSearchDb() : null;
  } catch (_) {}

  const startedAt = new Date();
  let processed = 0;
  let unchanged = 0;
  let embedded = 0;
  const errors = [];

  console.log('[bulletinReIngestion] Starting weekly bulletin check...');

  const zilaIds = Object.keys(zilaIdMap);

  for (const zilaId of zilaIds) {
    try {
      // Step 1: Scrape current bulletin from BAMIS
      const scraped = await bamisClient.fetchBulletin(zilaId);
      if (!scraped || !scraped.bulletinNo) {
        errors.push(`zilaId ${zilaId}: scrape returned no bulletinNo`);
        continue;
      }

      // Step 2: Check what's stored
      const stored = await db.collection('raw_bulletins')
        .findOne({ zilaId }, { projection: { bulletinNo: 1 } });

      if (stored && stored.bulletinNo === scraped.bulletinNo) {
        // Bulletin hasn't changed — skip embedding
        unchanged++;
        continue;
      }

      // Step 3: Update raw_bulletins
      await db.collection('raw_bulletins').replaceOne(
        { zilaId },
        {
          zilaId,
          sourceUrl: scraped.sourceUrl,
          bulletinNo: scraped.bulletinNo,
          scrapedAt: new Date().toISOString(),
          rawText: scraped.text || scraped.rawText,
          length: (scraped.text || scraped.rawText || '').length,
        },
        { upsert: true }
      );

      // Step 4: Re-parse into chunks
      const districtId = zilaToDistrict[zilaId];
      if (!districtId) {
        errors.push(`zilaId ${zilaId}: no districtId mapping`);
        continue;
      }

      const chunks = parseBulletinDoc(
        { zilaId, bulletinNo: scraped.bulletinNo, scrapedAt: new Date().toISOString(),
          sourceUrl: scraped.sourceUrl, text: scraped.text || scraped.rawText },
        districtId
      );

      // Step 5: Re-embed each chunk and upsert into regional_advisories across BOTH clusters
      for (const chunk of chunks) {
        try {
          const embedding = await embedText(chunk.ragContextChunk);
          const updatePayload = { ...chunk, embedding };

          // Upsert to Primary Cluster 1
          await db.collection('regional_advisories').replaceOne(
            { _id: chunk._id },
            updatePayload,
            { upsert: true }
          );

          // Also upsert to Search Cluster 2 (for Hybrid RAG)
          if (searchDb && searchDb !== db) {
            await searchDb.collection('regional_advisories').replaceOne(
              { _id: chunk._id },
              updatePayload,
              { upsert: true }
            );
          }

          embedded++;
          await new Promise(r => setTimeout(r, DELAY_MS));
        } catch (embedErr) {
          errors.push(`${chunk._id}: embed failed — ${embedErr.message}`);
        }
      }

      processed++;
      console.log(`[bulletinReIngestion] zilaId ${zilaId}: updated (bulletinNo ${scraped.bulletinNo}), ${chunks.length} chunks re-embedded and synced`);

    } catch (err) {
      errors.push(`zilaId ${zilaId}: ${err.message}`);
    }
  }

  // Write ingestion log
  await db.collection('ingestion_logs').insertOne({
    jobName: 'bamis_bulletin_re_ingestion',
    startedAt,
    completedAt: new Date(),
    status: errors.length === 0 ? 'success' : (processed > 0 ? 'partial' : 'failed'),
    documentsProcessed: processed,
    documentsEmbedded: embedded,
    unchangedSkipped: unchanged,
    errors,
  });

  console.log(`[bulletinReIngestion] Done. Updated: ${processed}, Unchanged: ${unchanged}, Embedded: ${embedded}, Errors: ${errors.length}`);
}

module.exports = { bulletinReIngestion };
