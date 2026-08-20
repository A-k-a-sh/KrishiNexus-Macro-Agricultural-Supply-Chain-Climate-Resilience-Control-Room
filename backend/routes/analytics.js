const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connect');

// GET /api/analytics/risk-trends
// Query params: days (default 90)
// Returns: [{ districtId, districtName, redDays, yellowDays, greenDays }] sorted by redDays desc
router.get('/risk-trends', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const db = getDb();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          date: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: { districtId: "$districtId", districtName: "$districtName" },
          redDays: { $sum: { $cond: [{ $eq: ["$riskStatus", "red"] }, 1, 0] } },
          yellowDays: { $sum: { $cond: [{ $eq: ["$riskStatus", "yellow"] }, 1, 0] } },
          greenDays: { $sum: { $cond: [{ $eq: ["$riskStatus", "green"] }, 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          districtId: "$_id.districtId",
          districtName: "$_id.districtName",
          redDays: 1,
          yellowDays: 1,
          greenDays: 1
        }
      },
      {
        $sort: { redDays: -1, yellowDays: -1, districtId: 1 }
      }
    ];

    const results = await db.collection('analytics_snapshots').aggregate(pipeline).toArray();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/dispatch-summary
// Query params: days (default 30)
// Returns: [{ fromDivisionName, toDistrictName, crop, totalMtons, count }] sorted by totalMtons desc
router.get('/dispatch-summary', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const db = getDb();

    // In dispatch records, timestamp might be createdAt or dispatchedAt, checking 02_database.md: createdAt
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: cutoffDate.toISOString() },
          status: "dispatched"
        }
      },
      {
        $group: {
          _id: {
            fromDivisionName: "$fromDivisionName",
            toDistrictName: "$toDistrictName",
            crop: "$crop"
          },
          totalMtons: { $sum: "$cargoWeightMtons" },
          count: { $sum: 1 },
          latestDate: { $max: "$createdAt" }
        }
      },
      {
        $project: {
          _id: 0,
          fromDivisionName: "$_id.fromDivisionName",
          toDistrictName: "$_id.toDistrictName",
          crop: "$_id.crop",
          totalMtons: 1,
          count: 1,
          latestDate: 1
        }
      },
      {
        $sort: { totalMtons: -1 }
      }
    ];

    const results = await db.collection('dispatch_records').aggregate(pipeline).toArray();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/ingestion-health
// Query params: limit (default 20)
// Returns: last N ingestion_log records sorted by startedAt desc
router.get('/ingestion-health', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const db = getDb();

    const results = await db.collection('ingestion_logs')
      .find({})
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray();

    res.json(results);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
