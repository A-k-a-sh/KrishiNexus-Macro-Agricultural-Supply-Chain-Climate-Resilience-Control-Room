const { getDb } = require('../db/connect');

/**
 * Aggregates active alerts from districts and upazilas into the alert_records collection.
 */
async function runAlertAggregation() {
  console.log('[cron] Starting alert aggregation...');
  const startedAt = new Date();
  let documentsProcessed = 0;
  let documentsEmbedded = 0; // Not applicable here, but keeping for log consistency
  const errors = [];
  const db = getDb();

  try {
    const districts = await db.collection('districts').find({}).toArray();
    const upazilas = await db.collection('upazilas').find({}).toArray();

    documentsProcessed = districts.length + upazilas.length;

    // Helper function to process alerts from a specific source
    const processAlerts = async (sourceDocs, sourceType) => {
      for (const doc of sourceDocs) {
        if (!doc.activeAlerts || doc.activeAlerts.length === 0) continue;

        for (const alert of doc.activeAlerts) {
          // Find if this specific alert already exists
          const existingAlert = await db.collection('alert_records').findOne({
            sourceId: doc._id,
            alertType: alert.type,
            cropAffected: alert.cropAffected
          });

          if (existingAlert) {
            if (existingAlert.status === 'active') {
              // Update raisedAt for existing active alert
              await db.collection('alert_records').updateOne(
                { _id: existingAlert._id },
                { $set: { raisedAt: new Date() } }
              );
            }
            // If acknowledged, do not overwrite
          } else {
            // Insert new alert
            await db.collection('alert_records').insertOne({
              sourceType: sourceType,
              sourceId: doc._id,
              sourceName: doc.name,
              divisionId: doc.divisionId,
              alertType: alert.type,
              label: alert.label,
              cropAffected: alert.cropAffected,
              severity: alert.severity,
              triggerReason: alert.triggerReason,
              raisedAt: new Date(),
              status: 'active',
              acknowledgedBy: null,
              acknowledgedAt: null,
              notes: ''
            });
          }
        }
      }
    };

    await processAlerts(districts, 'district');
    await processAlerts(upazilas, 'upazila');

    console.log('[cron] Alert aggregation completed successfully.');
  } catch (err) {
    console.error('[cron] Alert aggregation failed:', err.message);
    errors.push(err.message);
  } finally {
    // Log the job
    await db.collection('ingestion_logs').insertOne({
      jobName: 'alert_aggregation',
      startedAt,
      completedAt: new Date(),
      status: errors.length === 0 ? 'success' : (documentsProcessed > 0 ? 'partial' : 'failed'),
      documentsProcessed,
      documentsEmbedded,
      errors
    });
  }
}

module.exports = { runAlertAggregation };
