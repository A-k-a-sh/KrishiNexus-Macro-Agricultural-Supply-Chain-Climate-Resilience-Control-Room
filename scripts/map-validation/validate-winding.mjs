// Validates the fix for BUG #1 — "the map outline disappeared on drill-in".
//
// Root cause: d3-geo (inside react-simple-maps) interprets polygon rings on a
// SPHERE. An exterior ring wound the wrong way is read as its COMPLEMENT — the
// whole globe minus the shape — and fills the entire canvas. Every ADM3 upazila
// polygon shipped with inverted winding, so each one painted a full-canvas fill
// that buried all district outlines. Districts shipped correct, so the base map
// always worked.
//
// Fix: normalizeWinding() flips any exterior ring whose PLANAR (shoelace) signed
// area is positive, matching the districts' known-good negative-area convention.
//
// This script runs the SHIPPED normalizeWinding/ringSignedArea (see _extract.mjs)
// and asserts: before the fix every upazila ring is inverted; after it, none are.
// If d3-geo is resolvable it adds the definitive spherical check — no feature may
// have an area anywhere near a full sphere (4π sr).
import { loadJson, clone, loadMapHelpers, tryLoadD3Geo } from './_extract.mjs';

const { ringSignedArea, normalizeWinding, source } = loadMapHelpers();

// An exterior ring with POSITIVE planar signed area is "inverted" relative to the
// district convention (which is negative). Count per exterior ring.
function countInverted(fc) {
  let rings = 0;
  let inverted = 0;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates]
      : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const p of polys) {
      rings++;
      if (ringSignedArea(p[0]) > 0) inverted++;
    }
  }
  return { rings, inverted };
}

console.log(`\n  Running shipped helpers from BangladeshMap.jsx (${source.lines} lines)\n`);
console.log('  BUG #1 — GeoJSON winding normalization');
console.log('  ' + '-'.repeat(62));

let failures = 0;
const files = [
  ['districts', 'frontend/public/bd-districts.geojson'],
  ['upazilas', 'frontend/public/bd-upazilas.geojson'],
];

for (const [label, rel] of files) {
  const original = loadJson(rel);
  const before = countInverted(original);
  const after = countInverted(normalizeWinding(clone(original)));
  const ok = after.inverted === 0;
  if (!ok) failures++;
  console.log(
    `  ${label.padEnd(10)} exterior rings=${String(before.rings).padStart(3)}  `
    + `inverted before=${String(before.inverted).padStart(3)}  after=${String(after.inverted).padStart(3)}  `
    + (ok ? 'PASS' : 'FAIL'),
  );
}

// Districts must be a NO-OP (they were already correct); upazilas must ALL flip.
const districtsBefore = countInverted(loadJson(files[0][1])).inverted;
const upazilasBefore = countInverted(loadJson(files[1][1])).inverted;
if (districtsBefore !== 0) {
  console.log(`  FAIL  expected districts to need no correction, saw ${districtsBefore} inverted`);
  failures++;
}
if (upazilasBefore === 0) {
  console.log('  FAIL  expected upazilas to start fully inverted, saw 0 — did the asset change?');
  failures++;
}

// --- Definitive spherical cross-check (only if d3-geo resolves) --------------
const d3 = await tryLoadD3Geo();
if (d3?.geoArea && d3?.geoContains) {
  console.log('\n  Spherical cross-check via d3-geo (4π sr ≈ 12.566 = whole globe)');
  console.log('  ' + '-'.repeat(62));
  const upazilas = normalizeWinding(clone(loadJson(files[1][1])));
  const districts = normalizeWinding(clone(loadJson(files[0][1])));

  let maxArea = 0;
  let globeComplements = 0;
  for (const f of upazilas.features) {
    const a = d3.geoArea(f);
    if (a > maxArea) maxArea = a;
    if (a > Math.PI) globeComplements++; // > half the sphere ⇒ inside-out
  }
  const areaOk = globeComplements === 0;
  if (!areaOk) failures++;
  console.log(`  largest upazila area after fix : ${maxArea.toExponential(3)} sr  (tiny ⇒ real shape)`);
  console.log(`  polygons rendering as globe    : ${globeComplements} / ${upazilas.features.length}  ${areaOk ? 'PASS' : 'FAIL'}`);

  // Spot-check: a district must spherically contain its own upazilas' points.
  const { representativePoint, groupUpazilasByDistrict } = loadMapHelpers();
  const grouped = groupUpazilasByDistrict(upazilas, districts);
  const nameToId = loadMapHelpers().SHAPE_NAME_TO_ID;
  let contained = 0;
  let checked = 0;
  for (const d of districts.features) {
    const id = nameToId[d.properties.shapeName];
    for (const u of (grouped[String(id)] || [])) {
      const pt = representativePoint(u);
      if (!pt) continue;
      checked++;
      if (d3.geoContains(d, pt)) contained++;
    }
  }
  const containOk = contained === checked;
  if (!containOk) failures++;
  console.log(`  upazila points inside parent   : ${contained} / ${checked}  ${containOk ? 'PASS' : 'FAIL'}`);
} else {
  console.log('\n  (d3-geo not resolvable — skipping spherical cross-check; planar test above still holds)');
}

console.log(`\n  ${failures === 0 ? '✓ ALL PASS' : `✗ ${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
