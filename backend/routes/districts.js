const { Router } = require('express');
const { getDb } = require('../db/connect');

const router = Router();

// Fields safe to return to the frontend — never return bamisZilaId or internal mapping fields
const PUBLIC_PROJECTION = {
  _id: 1,
  divisionId: 1,
  name: 1,
  bnName: 1,
  lat: 1,
  lon: 1,
  riskStatus: 1,
  activeAlerts: 1,
  activeCrops: 1,
  liveWeather: 1,
};

/**
 * GET /api/districts
 * Returns all 64 districts with risk + weather data.
 * Called once on dashboard mount to colour the map and populate the left nav.
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const districts = await db
      .collection('districts')
      .find({}, { projection: PUBLIC_PROJECTION })
      .toArray();

    res.json({ ok: true, data: districts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/districts/:id
 * Returns a single district's full detail.
 * Called when the user clicks a district on the map.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const district = await db
      .collection('districts')
      .findOne({ _id: req.params.id }, { projection: PUBLIC_PROJECTION });

    if (!district) {
      return res.status(404).json({ ok: false, message: 'District not found' });
    }

    res.json({ ok: true, data: district });
  } catch (err) {
    next(err);
  }
});

module.exports = router;