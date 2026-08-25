require('dotenv').config({ path: __dirname + '/../../.env' });
const { connectDb } = require('../connect');
const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// Geometry helpers — dependency-free, mirroring
// frontend/src/components/Map/BangladeshMap.jsx (guarded by
// scripts/map-validation). We assign each upazila POLYGON to its parent district
// by geometry, then take that polygon's centroid as the upazila's coordinates.
//
// This replaces the previous approach, which matched each bdapi upazila name
// against the ENTIRE national geojson. That mis-placed ~166 of 544 upazilas —
// the 13 repeated names (Kaliganj ×4, Daulatpur ×3, Kotwali ×3, …) collided, and
// unmatched names silently fell back to the district centroid. Scoping the name
// match to the geometrically-correct district removes both failure modes.
//
// Winding order is irrelevant here: centroid and even-odd point-in-polygon are
// both orientation-independent, so we don't normalize winding in the seed.
// -----------------------------------------------------------------------------
function ringSignedArea(ring) {
  let area = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function ringCentroid(ring) {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    twiceArea += cross;
    x += (ring[j][0] + ring[i][0]) * cross;
    y += (ring[j][1] + ring[i][1]) * cross;
  }
  if (twiceArea === 0) return [ring[0][0], ring[0][1]];
  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

// Centroid of the feature's largest ring, so an island fragment of a multipart
// upazila never places the whole shape's marker out at sea.
function representativePoint(feature) {
  let biggestRing = null;
  let biggestArea = -1;
  for (const rings of polygonsOf(feature.geometry)) {
    const area = Math.abs(ringSignedArea(rings[0]));
    if (area > biggestArea) {
      biggestArea = area;
      biggestRing = rings[0];
    }
  }
  return biggestRing ? ringCentroid(biggestRing) : null;
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > point[1]) !== (yj > point[1])
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function featureContainsPoint(feature, point) {
  for (const rings of polygonsOf(feature.geometry)) {
    if (!pointInRing(point, rings[0])) continue;
    let inHole = false;
    for (let k = 1; k < rings.length; k++) {
      if (pointInRing(point, rings[k])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

function featureBbox(feature) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const rings of polygonsOf(feature.geometry)) {
    for (const p of rings[0]) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
  }
  return [x0, y0, x1, y1];
}

// → { [districtId]: Feature[] } — every upazila polygon assigned to exactly one
// district; points landing just outside every polygon fall back to the nearest
// district centroid so nothing is dropped.
function groupUpazilasByDistrict(upazilaFc, districtFc, shapeNameToId) {
  const districts = districtFc.features
    .map((f) => ({
      id: shapeNameToId[f.properties.shapeName],
      bbox: featureBbox(f),
      point: representativePoint(f),
      feature: f,
    }))
    .filter((d) => d.id);

  const grouped = {};
  for (const feature of upazilaFc.features) {
    const point = representativePoint(feature);
    if (!point) continue;

    let parent = districts.find(
      (d) => point[0] >= d.bbox[0] && point[0] <= d.bbox[2]
        && point[1] >= d.bbox[1] && point[1] <= d.bbox[3]
        && featureContainsPoint(d.feature, point),
    );

    if (!parent) {
      let bestDistance = Infinity;
      for (const d of districts) {
        if (!d.point) continue;
        const dx = d.point[0] - point[0];
        const dy = d.point[1] - point[1];
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) { bestDistance = distance; parent = d; }
      }
    }
    if (!parent) continue;

    (grouped[String(parent.id)] = grouped[String(parent.id)] || []).push(feature);
  }
  return grouped;
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Optimal string alignment distance (Levenshtein + adjacent transposition).
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Find the geojson polygon (within this district's set) for a bdapi upazila
// name. Same three tiers as the frontend's findUpazilaRecord, reversed to search
// polygons for a name: exact → containment → bounded, clearly-separated fuzzy.
function findPolygonForName(rawName, polygons) {
  if (!polygons || !polygons.length) return null;
  const name = normalizeName(rawName);
  if (!name) return null;

  const exact = polygons.find((p) => normalizeName(p.properties.shapeName) === name);
  if (exact) return exact;

  if (name.length < 4) return null;
  const substring = polygons.find((p) => {
    const s = normalizeName(p.properties.shapeName);
    return s.length >= 4 && (s.includes(name) || name.includes(s));
  });
  if (substring) return substring;

  if (name.length < 5) return null;
  let best = null;
  let bestDist = Infinity;
  let secondDist = Infinity;
  for (const p of polygons) {
    const s = normalizeName(p.properties.shapeName);
    if (s.length < 4 || Math.abs(s.length - name.length) > 2) continue;
    const dist = editDistance(name, s);
    if (dist < bestDist) { secondDist = bestDist; bestDist = dist; best = p; }
    else if (dist < secondDist) { secondDist = dist; }
  }
  return best && bestDist <= 2 && secondDist - bestDist >= 2 ? best : null;
}

async function seedUpazilas() {
  const db = await connectDb();
  const upazilasCollection = db.collection('upazilas');
  const districtsCollection = db.collection('districts');

  console.log('Fetching districts from MongoDB...');
  const districts = await districtsCollection.find({}).toArray();

  console.log('Loading GeoJSON + district name-map...');
  const publicDir = path.join(__dirname, '../../../frontend/public');
  const dataDir = path.join(__dirname, '../../../frontend/src/data');
  const upazilaFc = JSON.parse(fs.readFileSync(path.join(publicDir, 'bd-upazilas.geojson'), 'utf8'));
  const districtFc = JSON.parse(fs.readFileSync(path.join(publicDir, 'bd-districts.geojson'), 'utf8'));
  const shapeNameToId = JSON.parse(fs.readFileSync(path.join(dataDir, 'geoNameMap.json'), 'utf8'));

  // Assign every upazila polygon to its parent district ONCE, geometrically.
  const polygonsByDistrict = groupUpazilasByDistrict(upazilaFc, districtFc, shapeNameToId);
  console.log(
    `Geometrically grouped ${Object.values(polygonsByDistrict).reduce((n, a) => n + a.length, 0)} `
    + `polygons across ${Object.keys(polygonsByDistrict).length} districts.`,
  );

  let totalUpazilasInserted = 0;
  let matchedByGeometry = 0;
  let fellBackToDistrict = 0;

  for (const district of districts) {
    const districtId = district._id;
    const districtPolygons = polygonsByDistrict[String(districtId)] || [];
    console.log(`Fetching upazilas for ${district.name} (ID: ${districtId})...`);

    try {
      let response = null;
      let retries = 3;
      while (retries > 0) {
        await new Promise((r) => setTimeout(r, 1500));
        response = await fetch(`https://bdapis.pro.bd/geo/v2.0/upazilas/${districtId}`);
        if (response.ok) break;
        console.warn(`Got ${response.status} for district ${districtId}. Retrying...`);
        retries--;
        await new Promise((r) => setTimeout(r, 5000));
      }

      if (!response || !response.ok) {
        console.warn(`Failed to fetch API for district ${districtId} after retries.`);
        continue;
      }

      const resData = await response.json();
      if (!resData.success || !resData.data) continue;

      for (const uz of resData.data) {
        // Match this bdapi upazila to a polygon WITHIN its own district only.
        const match = findPolygonForName(uz.name, districtPolygons);

        let lat = district.lat;
        let lon = district.lon;
        if (match) {
          const point = representativePoint(match); // [lon, lat]
          if (point) {
            lon = point[0];
            lat = point[1];
            matchedByGeometry++;
          }
        } else {
          fellBackToDistrict++;
          console.warn(`⚠️  No polygon within ${district.name} for "${uz.name}" — using district coords.`);
        }

        const newDoc = {
          _id: uz.id,
          name: uz.name,
          bnName: uz.bn_name,
          districtId,
          divisionId: district.divisionId,
          lat,
          lon,
          liveWeather: {},
          riskStatus: 'green',
          activeAlerts: [],
        };

        await upazilasCollection.updateOne(
          { _id: newDoc._id },
          { $set: newDoc },
          { upsert: true },
        );
        totalUpazilasInserted++;
      }
    } catch (e) {
      console.error(`Error fetching for district ${districtId}:`, e.message);
    }
  }

  console.log(`\n✅ Seeding complete! Processed ${totalUpazilasInserted} upazilas.`);
  console.log(`   Coordinates from matched polygon: ${matchedByGeometry}`);
  console.log(`   Fell back to district centroid  : ${fellBackToDistrict}`);
  process.exit(0);
}

// Only connect to the database and run when executed directly, so the geometry
// helpers above can be unit-tested (require()'d) without a live DB.
if (require.main === module) {
  seedUpazilas().catch(console.error);
}

module.exports = {
  ringSignedArea,
  representativePoint,
  featureContainsPoint,
  featureBbox,
  groupUpazilasByDistrict,
  normalizeName,
  editDistance,
  findPolygonForName,
};
