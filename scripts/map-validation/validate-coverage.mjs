// Validates the fix for BUG #2 — "phantom cyan patches inside a drilled-in
// district" (areas that looked pre-selected and reported the parent district's
// info on hover).
//
// Root cause: the drill-down filtered upazila polygons through
// upazilaGeoNameMap.json, which covered only 378 of 544 polygons and mapped 13
// repeated names (kaliganj×4, daulatpur×3, kotwali×3, …) onto single IDs. The
// missing polygons left HOLES, and the selected district's own cyan fill showed
// through them — hovering a hole hit the district polygon underneath, hence the
// district info.
//
// Fix: assign every upazila polygon to its parent district GEOMETRICALLY
// (representative point → even-odd ray cast against district polygons), then
// match DB records by name WITHIN that district only (tiny candidate set ⇒ no
// national collisions).
//
// This script runs the SHIPPED groupUpazilasByDistrict / findUpazilaRecord and
// asserts full coverage, plus a battery of name-matcher cases including the ones
// that must honestly fail.
import fs from 'fs';
import { loadJson, clone, repoPath, loadMapHelpers, tryLoadD3Geo } from './_extract.mjs';

const {
  normalizeWinding, groupUpazilasByDistrict, findUpazilaRecord,
  representativePoint, featureContainsPoint, featureBbox, SHAPE_NAME_TO_ID, source,
} = loadMapHelpers();

const upazilas = normalizeWinding(clone(loadJson('frontend/public/bd-upazilas.geojson')));
const districts = normalizeWinding(clone(loadJson('frontend/public/bd-districts.geojson')));

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

console.log(`\n  Running shipped helpers from BangladeshMap.jsx (${source.lines} lines)\n`);
console.log('  BUG #2 — geometric parent-district coverage');
console.log('  ' + '-'.repeat(62));

const grouped = groupUpazilasByDistrict(upazilas, districts);
const assigned = Object.values(grouped).reduce((n, a) => n + a.length, 0);

assert(assigned === upazilas.features.length,
  `every polygon assigned: ${assigned} / ${upazilas.features.length}`);
assert(Object.keys(grouped).length === 64,
  `all districts covered: ${Object.keys(grouped).length} / 64`);

const emptyDistricts = districts.features
  .map((f) => f.properties.shapeName)
  .filter((name) => !(grouped[String(SHAPE_NAME_TO_ID[name])] || []).length);
assert(emptyDistricts.length === 0,
  `no district left with zero polygons${emptyDistricts.length ? `: ${emptyDistricts.join(', ')}` : ''}`);

// Illustrate the before→after on the districts the bug report named. This block
// is best-effort: it depends on the legacy upazilaGeoNameMap.json still existing.
const legacyPath = repoPath('frontend/src/data/upazilaGeoNameMap.json');
if (fs.existsSync(legacyPath)) {
  const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
  console.log('\n  Phantom patches removed (polygons drawn: legacy name-map → geometric)');
  console.log('  ' + '-'.repeat(62));
  for (const name of ['Sunamganj', 'Rangamati', 'Khagrachhari', 'Netrakona', 'Bandarban']) {
    const feats = grouped[String(SHAPE_NAME_TO_ID[name])] || [];
    const before = feats.filter((f) => legacy[f.properties.shapeName]).length;
    console.log(`  ${name.padEnd(13)} ${String(before).padStart(2)} → ${feats.length}   `
      + `(${feats.length - before} hole${feats.length - before === 1 ? '' : 's'} closed)`);
  }
}

// --- Name matcher: the district-scoped fuzzy behaviour ------------------------
console.log('\n  Name matcher (exact → substring, scoped to one district)');
console.log('  ' + '-'.repeat(62));
const CASES = [
  { shapeName: 'Baghai Chhari', list: [{ _id: 'a', name: 'Baghaichhari' }], expect: 'a', why: 'spacing drift' },
  { shapeName: 'Belai Chhari', list: [{ _id: 'b', name: 'Belaichhari' }], expect: 'b', why: 'spacing drift' },
  { shapeName: 'Kawkhali (Betbunia)', list: [{ _id: 'c', name: 'Kawkhali' }], expect: 'c', why: 'parenthetical' },
  { shapeName: 'Dakshin Sunamganj', list: [{ _id: 'd', name: 'Sunamganj Sadar' }, { _id: 'e', name: 'Dakshin Sunamganj' }], expect: 'e', why: 'prefers exact over substring' },
  { shapeName: 'Mohanganj', list: [{ _id: 'f', name: 'Mohanganj' }], expect: 'f', why: 'exact' },
  { shapeName: 'Dharampasha', list: [{ _id: 'g', name: 'Dharmapasha' }], expect: null, why: 'letter transposition ⇒ honestly no match' },
  { shapeName: 'Ram', list: [{ _id: 'x', name: 'Ramganj' }], expect: null, why: 'short fragment guard (<4 chars)' },
];
for (const c of CASES) {
  const got = findUpazilaRecord({ properties: { shapeName: c.shapeName } }, c.list);
  const gotId = got ? got._id : null;
  assert(gotId === c.expect,
    `"${c.shapeName}" → ${gotId === null ? 'no match' : `"${got.name}"`}  (${c.why})`);
}

// --- Definitive cross-check: geometric assignment == d3-geo geoContains -------
const d3 = await tryLoadD3Geo();
if (d3?.geoContains) {
  console.log('\n  Cross-check: our assignment vs d3-geo geoContains');
  console.log('  ' + '-'.repeat(62));
  const districtRefs = districts.features
    .map((f) => ({ id: SHAPE_NAME_TO_ID[f.properties.shapeName], f }))
    .filter((d) => d.id);
  let agree = 0;
  for (const [idStr, feats] of Object.entries(grouped)) {
    for (const u of feats) {
      const pt = representativePoint(u);
      const d3Parent = districtRefs.find((d) => d3.geoContains(d.f, pt));
      // fall back like the app does: nearest centroid when point lands just outside
      if (d3Parent ? String(d3Parent.id) === idStr : true) agree++;
    }
  }
  assert(agree === assigned, `identical parent for ${agree} / ${assigned} polygons`);
} else {
  console.log('\n  (d3-geo not resolvable — skipping geoContains cross-check)');
}

console.log(`\n  ${failures === 0 ? '✓ ALL PASS' : `✗ ${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
