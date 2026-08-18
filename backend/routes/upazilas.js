const { Router } = require('express');
const { getDb } = require('../db/connect');

const router = Router();

const PUBLIC_PROJECTION = {
  _id: 1,
  districtId: 1,
  divisionId: 1,
  name: 1,
  bnName: 1,
  lat: 1,
  lon: 1,
  riskStatus: 1,
  activeAlerts: 1,
  liveWeather: 1,
};

/**
 * GET /api/upazilas
 * Returns all 487 upazilas. Optionally filter by districtId.
 */
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    
    // Allow filtering by district if passed as query param: /api/upazilas?districtId=1
    const query = {};
    if (req.query.districtId) {
      query.districtId = req.query.districtId;
    }

    const upazilas = await db
      .collection('upazilas')
      .find(query, { projection: PUBLIC_PROJECTION })
      .toArray();

    res.json({ ok: true, data: upazilas });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/upazilas/:id
 * Returns a single upazila's full detail.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const upazila = await db
      .collection('upazilas')
      .findOne({ _id: req.params.id }, { projection: PUBLIC_PROJECTION });

    if (!upazila) {
      return res.status(404).json({ ok: false, message: 'Upazila not found' });
    }

    res.json({ ok: true, data: upazila });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
