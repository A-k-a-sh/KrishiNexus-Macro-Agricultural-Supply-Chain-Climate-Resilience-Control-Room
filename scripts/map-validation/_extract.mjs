// Shared loader for the map-validation scripts.
//
// The point of these tests is to exercise the EXACT functions the app ships,
// not a re-typed copy that can drift out of sync. So instead of duplicating the
// geometry helpers here, we slice the pure helper region out of the map
// component's source and evaluate it. If someone edits a helper in
// BangladeshMap.jsx, these tests run the edited version automatically.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');

export function repoPath(...parts) {
  return path.join(REPO, ...parts);
}

export function loadJson(rel) {
  return JSON.parse(fs.readFileSync(repoPath(rel), 'utf8'));
}

// Deep clone via JSON so a test can normalize a copy while keeping the original
// (the geometry helpers mutate ring arrays in place).
export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const COMPONENT = 'frontend/src/components/Map/BangladeshMap.jsx';

// Extract every pure helper defined between `ringSignedArea` and the component's
// default export, evaluate them in a sandbox with the district name-map injected,
// and hand them back. Throws loudly if the markers move, so a silent mismatch
// can't masquerade as a pass.
export function loadMapHelpers() {
  const src = fs.readFileSync(repoPath(COMPONENT), 'utf8');
  const start = src.indexOf('function ringSignedArea');
  const end = src.indexOf('export default function');
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate the helper region in ${COMPONENT}. `
      + 'Markers "function ringSignedArea" / "export default function" moved?');
  }
  const helpers = src.slice(start, end);
  const SHAPE_NAME_TO_ID = loadJson('frontend/src/data/geoNameMap.json');

  // eslint-disable-next-line no-new-func
  const factory = new Function('SHAPE_NAME_TO_ID', `${helpers}
    return {
      ringSignedArea, normalizePolygon, normalizeWinding,
      polygonsOf, ringCentroid, representativePoint,
      pointInRing, featureContainsPoint, featureBbox,
      groupUpazilasByDistrict, normalizeName, findUpazilaRecord,
    };
  `);

  return { SHAPE_NAME_TO_ID, source: { lines: helpers.split('\n').length }, ...factory(SHAPE_NAME_TO_ID) };
}

// Optional d3-geo cross-check. It's a transitive dependency (present under
// frontend/node_modules but NOT declared in package.json), so the app must never
// import it — but a validation script may, when it happens to be resolvable.
export async function tryLoadD3Geo() {
  const candidates = [
    'd3-geo',
    path.join(REPO, 'frontend/node_modules/d3-geo/src/index.js'),
  ];
  for (const spec of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await import(spec);
    } catch {
      /* try next */
    }
  }
  return null;
}
