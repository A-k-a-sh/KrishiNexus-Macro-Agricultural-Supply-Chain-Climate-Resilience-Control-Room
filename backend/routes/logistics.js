const { Router } = require('express');
const { getDb } = require('../db/connect');

const router = Router();

// Division centroids for Haversine distance calculation
// Source: geographic centres of Bangladesh's 8 divisions
const DIVISION_CENTROIDS = {
  '1': { name: 'Chattagram', lat: 22.8,  lon: 91.8 },
  '2': { name: 'Rajshahi',   lat: 24.4,  lon: 88.6 },
  '3': { name: 'Khulna',     lat: 22.8,  lon: 89.5 },
  '4': { name: 'Barishal',   lat: 22.3,  lon: 90.4 },
  '5': { name: 'Sylhet',     lat: 24.9,  lon: 91.9 },
  '6': { name: 'Dhaka',      lat: 23.7,  lon: 90.4 },
  '7': { name: 'Rangpur',    lat: 25.7,  lon: 89.2 },
  '8': { name: 'Mymensingh', lat: 24.7,  lon: 90.4 },
};

/** Haversine formula — returns distance in km between two lat/lon points */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * POST /api/logistics/calculate
 * Body: { districtId: string, crop: string, severityFactor: number (0–0.75) }
 *
 * Returns the deficit calculation and best surplus division routing plan.
 */
router.post('/calculate', async (req, res, next) => {
  try {
    const { districtId, crop, severityFactor = 0.25 } = req.body;

    if (!districtId || !crop) {
      return res.status(400).json({ ok: false, message: '`districtId` and `crop` are required' });
    }

    const db = getDb();

    // ── Fetch the district (need divisionId + lat/lon) ────────────────────────
    const district = await db
      .collection('districts')
      .findOne({ _id: districtId }, { projection: { name: 1, divisionId: 1, lat: 1, lon: 1 } });

    if (!district) {
      return res.status(404).json({ ok: false, message: 'District not found' });
    }

    // ── Fetch BBS production baseline for this district + crop ────────────────
    const baseline = await db
      .collection('market_production_baselines')
      .findOne({ districtId, crop });

    const baselineMtons = baseline?.latestBaselineMtons ?? 0;
    const projectedDeficit = +(baselineMtons * severityFactor).toFixed(2);

    // ── Find best surplus division (highest stock, excluding district's own division) ──
    const stocks = await db
      .collection('warehouse_stocks')
      .find({ crop, divisionId: { $ne: district.divisionId } })
      .sort({ reserveMtons: -1 })
      .toArray();

    if (stocks.length === 0) {
      return res.json({
        ok: true,
        data: {
          districtId,
          districtName: district.name,
          crop,
          severityFactor,
          baselineMtons,
          projectedDeficit,
          surplusDivision: null,
          message: 'No surplus divisions found for this crop.',
        },
      });
    }

    const bestStock = stocks[0];
    const surplusCentroid = DIVISION_CENTROIDS[bestStock.divisionId];

    // Distance from surplus division centroid to the deficit district
    const distanceKm = surplusCentroid
      ? Math.round(haversineKm(district.lat, district.lon, surplusCentroid.lat, surplusCentroid.lon))
      : null;

    // Recommended cargo: cover the deficit + 5% buffer, but cap at 30% of the surplus reserve
    const rawRecommended = projectedDeficit * 1.05;
    const cap = bestStock.reserveMtons * 0.3;
    const recommendedCargo = +Math.min(rawRecommended, cap).toFixed(2);

    // Simplified price pressure index: 1% yield loss ≈ 0.72% price increase
    const pricePressurePct = +(severityFactor * 72).toFixed(1);

    res.json({
      ok: true,
      data: {
        districtId,
        districtName: district.name,
        crop,
        severityFactor,
        baselineMtons,
        projectedDeficit,
        pricePressurePct,
        surplusDivision: {
          divisionId: bestStock.divisionId,
          divisionName: bestStock.divisionName,
          reserveMtons: bestStock.reserveMtons,
        },
        distanceKm,
        recommendedCargo,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/logistics/dispatch
 * Body: { fromDivisionId, toDistrictId, crop, cargoWeightMtons,
 *         severityFactor, projectedDeficit, aiManifestText? }
 *
 * Creates a dispatch_records document and reduces warehouse_stocks for the source division.
 */
router.post('/dispatch', async (req, res, next) => {
  try {
    const {
      fromDivisionId,
      toDistrictId,
      crop,
      cargoWeightMtons,
      severityFactor,
      projectedDeficit,
      aiManifestText = null,
    } = req.body;

    if (!fromDivisionId || !toDistrictId || !crop || !cargoWeightMtons) {
      return res.status(400).json({ ok: false, message: 'Missing required dispatch fields' });
    }

    const db = getDb();

    // Verify there's enough stock before dispatching
    const stock = await db
      .collection('warehouse_stocks')
      .findOne({ divisionId: fromDivisionId, crop });

    if (!stock || stock.reserveMtons < cargoWeightMtons) {
      return res.status(400).json({
        ok: false,
        message: `Insufficient stock in division ${fromDivisionId} for ${crop}. Available: ${stock?.reserveMtons ?? 0} M.Ton`,
      });
    }

    // Fetch district name for the record
    const district = await db
      .collection('districts')
      .findOne({ _id: toDistrictId }, { projection: { name: 1 } });

    const dispatchId = `dispatch_${Date.now()}`;

    const dispatchRecord = {
      _id: dispatchId,
      fromDivisionId,
      fromDivisionName: stock.divisionName,
      toDistrictId,
      toDistrictName: district?.name ?? toDistrictId,
      crop,
      cargoWeightMtons,
      status: 'dispatched',
      climateSeverityFactorUsed: severityFactor,
      projectedDeficitMtons: projectedDeficit,
      aiManifestText,
      createdAt: new Date().toISOString(),
    };

    // Insert dispatch record + reduce warehouse stock atomically (best-effort — no transactions on M0 free tier)
    await db.collection('dispatch_records').insertOne(dispatchRecord);
    await db.collection('warehouse_stocks').updateOne(
      { divisionId: fromDivisionId, crop },
      {
        $inc: { reserveMtons: -cargoWeightMtons },
        $set: { lastUpdated: new Date().toISOString() },
      }
    );

    res.json({ ok: true, data: dispatchRecord });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logistics/warehouse-stocks
 * Returns all 24 warehouse stock documents for the Zone C table.
 */
router.get('/warehouse-stocks', async (req, res, next) => {
  try {
    const db = getDb();
    const stocks = await db
      .collection('warehouse_stocks')
      .find({})
      .sort({ divisionName: 1, crop: 1 })
      .toArray();

    res.json({ ok: true, data: stocks });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/logistics/dispatch-records
 * Returns last 10 dispatch records for the logistics page history table.
 */
router.get('/dispatch-records', async (req, res, next) => {
  try {
    const db = getDb();
    const records = await db
      .collection('dispatch_records')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    res.json({ ok: true, data: records });
  } catch (err) {
    next(err);
  }
});

module.exports = router;