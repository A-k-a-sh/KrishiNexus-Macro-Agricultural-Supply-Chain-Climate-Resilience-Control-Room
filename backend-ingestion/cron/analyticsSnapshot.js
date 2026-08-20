const { getDb } = require('../db/connect');

/**
 * Takes a daily snapshot of the riskStatus for all districts.
 * Used for the analytics risk-trends chart.
 */
async function runAnalyticsSnapshot() {
  console.log('[cron] Starting analytics snapshot...');
  const startedAt = new Date();
  let documentsProcessed = 0;
  const errors = [];
  const db = getDb();

  try {
    const districts = await db.collection('districts').find({}).toArray();
    documentsProcessed = districts.length;
    
    // Use the current date truncated to midnight for the snapshot date
    const snapshotDate = new Date();
    snapshotDate.setHours(0, 0, 0, 0);

    const snapshots = districts.map(doc => ({
      districtId: doc._id,
      districtName: doc.name,
      divisionId: doc.divisionId,
      riskStatus: doc.riskStatus || 'green',
      date: snapshotDate,
      createdAt: new Date()
    }));

    if (snapshots.length > 0) {
      // Upsert so if run multiple times a day it just updates the current day's record
      for (const snap of snapshots) {
        await db.collection('analytics_snapshots').updateOne(
          { districtId: snap.districtId, date: snap.date },
          { $set: snap },
          { upsert: true }
        );
      }
    }

    console.log('[cron] Analytics snapshot completed successfully.');
  } catch (err) {
    console.error('[cron] Analytics snapshot failed:', err.message);
    errors.push(err.message);
  } finally {
    // Log the job
    await db.collection('ingestion_logs').insertOne({
      jobName: 'analytics_snapshot',
      startedAt,
      completedAt: new Date(),
      status: errors.length === 0 ? 'success' : (documentsProcessed > 0 ? 'partial' : 'failed'),
      documentsProcessed,
      documentsEmbedded: 0,
      errors
    });
  }
}

module.exports = { runAnalyticsSnapshot };
