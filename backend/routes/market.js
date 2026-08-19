const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connect');

/**
 * GET /api/market/:districtId
 * Fetch market prices for a specific district.
 * Query Params:
 * - date (optional, YYYY-MM-DD): Fetch prices for a specific date
 * - source (optional): Filter by 'WFP' or 'DAM'
 */
router.get('/:districtId', async (req, res, next) => {
  try {
    const { districtId } = req.params;
    const { date, source } = req.query;

    const db = getDb();
    const collection = db.collection('market_prices');

    const query = { districtId };
    
    if (date) {
      query.date = date;
    }
    
    if (source) {
      query.source = source.toUpperCase();
    }

    const prices = await collection.find(query).sort({ date: -1, commodity: 1 }).toArray();

    res.json(prices);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/market/:districtId/latest
 * Convenience endpoint to fetch the most recent prices for a district.
 * It aggregates the latest available date per commodity and source, 
 * so WFP (which might be weeks old) and DAM (which is daily) both appear.
 */
router.get('/:districtId/latest', async (req, res, next) => {
  try {
    const { districtId } = req.params;
    const db = getDb();
    
    const prices = await db.collection('market_prices').aggregate([
      { $match: { districtId } },
      { $sort: { date: -1 } }, // Sort by date descending so the first document is the newest
      { $group: {
          _id: { commodity: "$commodity", source: "$source" },
          doc: { $first: "$$ROOT" } // Keep only the newest document per commodity/source
      }},
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { commodity: 1 } } // Sort final output alphabetically
    ]).toArray();

    res.json(prices);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
