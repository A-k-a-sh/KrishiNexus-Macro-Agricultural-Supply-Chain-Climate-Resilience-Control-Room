const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connect');
const { ObjectId } = require('mongodb');

// GET /api/alerts
// Returns array of alert_record documents sorted by raisedAt desc
router.get('/', async (req, res, next) => {
  try {
    const { status = 'active', severity, divisionId, districtId } = req.query;
    
    // Build match query
    const match = { status };
    if (severity) match.severity = severity;
    if (divisionId) match.divisionId = divisionId;
    if (districtId) {
      // NOTE: for district alerts, sourceId is the districtId. 
      // If we wanted upazilas too, we'd need more complex logic. 
      // But standard filter allows just checking sourceId for district.
      match.sourceId = districtId;
    }

    // Since app.js mounted this with role(['logistics_manager', 'admin']), 
    // we don't need region scoping for field_officers here.
    
    const db = getDb();
    const alerts = await db.collection('alert_records')
      .find(match)
      .sort({ raisedAt: -1 })
      .toArray();

    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/alerts/:id/acknowledge
// Body: { notes: "optional note" }
router.patch('/:id/acknowledge', async (req, res, next) => {
  try {
    const alertId = req.params.id;
    const { notes } = req.body;
    
    const db = getDb();
    
    const updateResult = await db.collection('alert_records').findOneAndUpdate(
      { _id: new ObjectId(alertId) },
      { 
        $set: { 
          status: 'acknowledged',
          acknowledgedBy: req.user.userId,
          acknowledgedAt: new Date(),
          notes: notes || ''
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!updateResult.value && !updateResult) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(updateResult.value || updateResult);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
