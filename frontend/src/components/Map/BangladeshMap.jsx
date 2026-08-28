import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { useAppContext } from '../../context/AppContext';
import { motion } from 'framer-motion';
import DistrictTooltip from './DistrictTooltip';
import RiskLegend from './RiskLegend';
import SHAPE_NAME_TO_ID from '../../data/geoNameMap.json';

const GEO_URL = '/bd-districts.geojson';
const UPAZILA_GEO_URL = '/bd-upazilas.geojson';

// Risk status → SVG fill / stroke colors from the design system
const RISK_STYLE = {
  red: { fill: '#450a0a', stroke: '#ef4444', strokeWidth: 0.8 },
  yellow: { fill: '#451a03', stroke: '#f59e0b', strokeWidth: 0.6 },
  green: { fill: '#052e16', stroke: '#00ff88', strokeWidth: 0.5 },
  default: { fill: '#1e293b', stroke: '#475569', strokeWidth: 0.4 }, // Made brighter so it never blends into the page background
};

// Interaction palette. Three tiers, none of which collide with the
// red/yellow/green risk colors, so "what am I pointing at, and at which level"
// is always readable:
//   cyan    → district scope  (selected district ring, district hover)
//   violet  → upazila hover   (transient "you could pick this")
//   magenta → upazila selected("you picked this")
const DISTRICT_COLOR = '#22d3ee';         // cyan
const UPAZILA_HOVER_COLOR = '#a78bfa';    // violet
const UPAZILA_SELECTED_COLOR = '#f472b6'; // magenta

const DISTRICT_SELECTED_STYLE = { fill: '#0c3f52', stroke: DISTRICT_COLOR, strokeWidth: 2 };
const UPAZILA_SELECTED_STYLE = { fill: '#4c1d3d', stroke: UPAZILA_SELECTED_COLOR, strokeWidth: 1.4 };

// While drilled in, the parent district sits UNDERNEATH the upazila polygons, so
// it has to be a neutral backdrop. If it kept its cyan selected fill, any sliver
// not covered by an upazila polygon would look exactly like an already-selected
// upazila — which is precisely how the phantom-cyan-patch bug presented.
const DRILL_BACKDROP_STYLE = { fill: '#0f172a', stroke: '#334155', strokeWidth: 0.4 };

// An upazila polygon we can't tie to a database record: draw the true boundary
// but dimmed, and don't pretend it's selectable.
const UPAZILA_NO_DATA_STYLE = { fill: '#161f2e', stroke: '#3b475c', strokeWidth: 0.35 };

// --- GeoJSON winding-order normalization -------------------------------------
// d3-geo (used internally by react-simple-maps' geoPath) treats polygons on a
// SPHERE, not a plane. It uses ring winding order to decide which side is
// "inside": an exterior ring must wind counter-clockwise. If it winds the wrong
// way, d3 interprets the polygon as its COMPLEMENT — i.e. the entire globe minus
// the shape — and fills the whole map. The bd-upazilas.geojson asset (exported
// from geoBoundaries ADM3 via mapshaper) has every ring inverted, so on drill-in
// each upazila painted a full-canvas fill that hid all district outlines — the
// "map outline disappeared" bug. bd-districts.geojson is wound correctly, so the
// base map always worked.
//
// We can't rely on an absolute CW/CCW test here without pulling in d3-geo, but we
// don't need to: the districts are known-good, and in this projection their
// exterior rings have NEGATIVE planar (shoelace) signed area. So we normalize any
// polygon whose exterior ring has POSITIVE signed area to match. This is a no-op
// on all 64 districts and corrects all 544 upazilas. Validated with d3-geo:
// post-fix, 0 districts change, 0 upazilas remain inverted, and upazila centroids
// resolve inside their parent district (e.g. geoContains(Comilla, Barura)=true).
function ringSignedArea(ring) {
  let area = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

function normalizePolygon(rings) {
  // rings[0] is the exterior ring; holes follow. Reverse every ring together so
  // interior/exterior relationships are preserved.
  if (rings.length && ringSignedArea(rings[0]) > 0) {
    for (const ring of rings) ring.reverse();
  }
}

function normalizeWinding(featureCollection) {
  if (!featureCollection || !Array.isArray(featureCollection.features)) return featureCollection;
  for (const feature of featureCollection.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      normalizePolygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) normalizePolygon(polygon);
    }
  }
  return featureCollection;
}
// -----------------------------------------------------------------------------

// --- Geometric parent-district resolution ------------------------------------
// upazilaGeoNameMap.json only covers 378 of the 544 ADM3 polygons, and 13 of the
// names in it are ambiguous (there are 4 different "Kaliganj" upazilas, 3
// "Daulatpur", 3 "Kotwali", ...), so a name lookup alone both MISSES polygons and
// MIS-ASSIGNS them. Filtering the drill-down by that map left real holes — e.g.
// Sunamganj lost 3 upazilas, Rangamati 4, Khagrachhari 4 — and the parent
// district's own cyan fill showed through those holes, looking like patches that
// were already selected and reporting district info on hover.
//
// So we don't ask the name map which district a polygon belongs to; we ask the
// geometry. Each upazila's representative point is tested against the district
// polygons (planar even-odd ray casting, matching how these shapes are drawn in
// the projected plane). Verified against d3-geo: identical result on 544/544
// features, ~11ms for the whole file, computed once and memoized.
function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

// Area-weighted centroid of a ring — guaranteed to fall inside a convex-ish ring
// and, unlike a naive average of vertices, is not dragged off-shape by dense
// coastline detail.
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

// Representative point = centroid of the feature's LARGEST ring, so island
// fragments of a multipart upazila never speak for the whole shape.
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
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
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

// → { [districtId]: Feature[] }, every upazila polygon assigned to exactly one
// district. The 4 features whose representative point lands just outside every
// district polygon (coastal/riverine edge cases) fall back to the nearest
// district centroid, so the map never silently drops a shape.
function groupUpazilasByDistrict(upazilaFc, districtFc) {
  const districts = districtFc.features
    .map((f) => ({
      id: SHAPE_NAME_TO_ID[f.properties.shapeName],
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

    (grouped[String(parent.id)] ||= []).push(feature);
  }
  return grouped;
}

// Match a polygon to its database record WITHIN its parent district only. Scoping
// by district is what disambiguates the repeated names — there are four
// "Kaliganj" upazilas nationally, but only one inside any given district.
function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Optimal string alignment distance: Levenshtein plus a discount for a single
// adjacent transposition, which is the most common romanization drift here
// ("Dharampasha" ↔ "Dharmapasha" is one swap). Bails early once the length gap
// alone exceeds 2, since tier 3 never accepts a distance above that.
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

function findUpazilaRecord(geo, upazilaList) {
  if (!upazilaList || !upazilaList.length) return null;
  const shapeName = normalizeName(geo.properties.shapeName);
  if (!shapeName) return null;

  // Tier 1 — exact normalized match.
  const exact = upazilaList.find((u) => normalizeName(u.name) === shapeName);
  if (exact) return exact;

  if (shapeName.length < 4) return null;

  // Tier 2 — containment: "Kawkhali (Betbunia)" ⊃ "Kawkhali", "Baghai Chhari" →
  // "Baghaichhari". 4+ chars so a fragment can't swallow an unrelated name.
  const substring = upazilaList.find((u) => {
    const name = normalizeName(u.name);
    return name.length >= 4 && (name.includes(shapeName) || shapeName.includes(name));
  });
  if (substring) return substring;

  // Tier 3 — bounded fuzzy match. Safe ONLY because it's scoped to this
  // district's ~10 records (a national fuzzy match would mis-pair the repeated
  // names). Recovers drift the containment test misses — transpositions
  // ("Dharampasha"/"Dharmapasha") and alternate romanizations ("Sulla"/"Shalla").
  // Accept the closest record only when it is within 2 edits AND markedly closer
  // than the runner-up, so (a) a granularity-only polygon with no real record
  // can't grab a neighbour, and (b) two similar names can't be confused.
  if (shapeName.length < 5) return null;
  let best = null;
  let bestDist = Infinity;
  let secondDist = Infinity;
  for (const u of upazilaList) {
    const name = normalizeName(u.name);
    // Skip records that can't be within 2 edits on length alone, so a far name
    // never poses as a close runner-up and defeats the separation guard below.
    if (name.length < 4 || Math.abs(name.length - shapeName.length) > 2) continue;
    const dist = editDistance(shapeName, name);
    if (dist < bestDist) { secondDist = bestDist; bestDist = dist; best = u; }
    else if (dist < secondDist) { secondDist = dist; }
  }
  return best && bestDist <= 2 && secondDist - bestDist >= 2 ? best : null;
}
// -----------------------------------------------------------------------------

export default function BangladeshMap() {
  const {
    allDistricts, selectedDistrict, selectDistrict,
    isDrilledIn, setIsDrilledIn,
    selectedUpazila, selectUpazila,
    upazilasByDistrict, ensureUpazilas
  } = useAppContext();

  // Build a lookup: bdapi district _id → district object (for fast access on hover/click)
  const [districtById, setDistrictById] = useState({});
  useEffect(() => {
    const map = {};
    for (const d of allDistricts) map[d._id] = d;
    setDistrictById(map);
  }, [allDistricts]);

  useEffect(() => {
    if (isDrilledIn && selectedDistrict) ensureUpazilas(selectedDistrict._id);
  }, [isDrilledIn, selectedDistrict, ensureUpazilas]);

  // Manually fetch GeoJSON to prevent react-simple-maps from colliding cache when using multiple Geographies
  const [districtGeoData, setDistrictGeoData] = useState(null);
  const [upazilaGeoData, setUpazilaGeoData] = useState(null);

  useEffect(() => {
    fetch(GEO_URL)
      .then(res => res.json())
      .then(data => {
        // Tag features so we can distinguish them in the combined array
        data.features.forEach(f => f.properties.geoType = 'district');
        // Correct any inverted rings so d3-geo never renders a shape as its
        // whole-globe complement (no-op for the already-correct district file).
        setDistrictGeoData(normalizeWinding(data));
      })
      .catch(console.error);

    fetch(UPAZILA_GEO_URL)
      .then(res => res.json())
      .then(data => {
        data.features.forEach(f => f.properties.geoType = 'upazila');
        // The ADM3 upazila polygons ship with inverted winding — normalize so
        // they render as their real small shapes instead of full-canvas fills.
        setUpazilaGeoData(normalizeWinding(data));
      })
      .catch(console.error);
  }, []);

  // Assign every upazila polygon to a district once, up front — not per drill-in.
  const upazilasByDistrictGeo = useMemo(() => {
    if (!districtGeoData || !upazilaGeoData) return {};
    return groupUpazilasByDistrict(upazilaGeoData, districtGeoData);
  }, [districtGeoData, upazilaGeoData]);

  // The upazila polygons for the district currently drilled into.
  const activeUpazilaFeatures = useMemo(() => {
    if (!isDrilledIn || !selectedDistrict) return [];
    return upazilasByDistrictGeo[String(selectedDistrict._id)] || [];
  }, [isDrilledIn, selectedDistrict, upazilasByDistrictGeo]);

  // …and the matching database records, which arrive separately from the API.
  const activeUpazilaList = useMemo(() => (
    selectedDistrict ? (upazilasByDistrict[selectedDistrict._id] || []) : []
  ), [selectedDistrict, upazilasByDistrict]);

  // Compute the combined GeoJSON object dynamically to avoid multiple <Geographies> components
  const combinedGeoData = useMemo(() => {
    if (!districtGeoData) return null;

    let combinedFeatures = [...districtGeoData.features];

    if (isDrilledIn && selectedDistrict && activeUpazilaFeatures.length) {
      combinedFeatures = [...combinedFeatures, ...activeUpazilaFeatures];

      // Redraw the selected district's border ON TOP of its upazilas as an
      // outline-only overlay so the "you are here" boundary stays crisp instead
      // of being buried under the upazila fills. pointer-events are disabled on
      // it (see render) so upazila clicks still pass through.
      const selectedGeo = districtGeoData.features.find(
        f => String(SHAPE_NAME_TO_ID[f.properties.shapeName]) === String(selectedDistrict._id)
      );
      if (selectedGeo) {
        combinedFeatures = [
          ...combinedFeatures,
          { ...selectedGeo, properties: { ...selectedGeo.properties, geoType: 'district-outline' } },
        ];
      }
    }

    return {
      type: "FeatureCollection",
      features: combinedFeatures
    };
  }, [districtGeoData, isDrilledIn, selectedDistrict, activeUpazilaFeatures]);

  const [tooltip, setTooltip] = useState({ visible: false, district: null, upazila: null, x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([90.35, 23.68]); // Bangladesh centroid — ZoomableGroup pans here

  // A tween reads its start point from refs (so it never re-subscribes to state)
  // and stores its RAF handle so a fresh move can cancel one already in flight.
  const zoomRef = useRef(zoom);
  const centerRef = useRef(center);
  const tweenRef = useRef(null);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => () => { if (tweenRef.current) cancelAnimationFrame(tweenRef.current); }, []);

  const prefersReducedMotion = () => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Glide the viewport to a target instead of snapping — the drill-in zoom is the
  // map's signature moment. User drag/wheel keeps updating instantly through
  // onMoveEnd; only these programmatic moves tween, and reduced-motion skips it.
  const animateView = useCallback((targetCenter, targetZoom) => {
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current);
    if (prefersReducedMotion()) {
      setCenter(targetCenter);
      setZoom(targetZoom);
      return;
    }
    const [c0, c1] = centerRef.current;
    const z0 = zoomRef.current;
    const duration = 550;
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    let start = null;
    const frame = (now) => {
      if (start === null) start = now;
      const e = easeOutCubic(Math.min(1, (now - start) / duration));
      setCenter([c0 + (targetCenter[0] - c0) * e, c1 + (targetCenter[1] - c1) * e]);
      setZoom(z0 + (targetZoom - z0) * e);
      tweenRef.current = e < 1 ? requestAnimationFrame(frame) : null;
    };
    tweenRef.current = requestAnimationFrame(frame);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((current) => Math.min(8, +(current + 0.75).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((current) => Math.max(1, +(current - 0.75).toFixed(2)));
  }, []);

  const resetView = useCallback(() => {
    animateView([90.35, 23.68], 1);
    selectDistrict(null);
  }, [selectDistrict, animateView]);

  useEffect(() => {
    const onReset = () => resetView();
    window.addEventListener('map-reset', onReset);
    return () => window.removeEventListener('map-reset', onReset);
  }, [resetView]);

  const handleDistrictClick = useCallback((geo) => {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    if (!id) return;
    const district = districtById[id];
    if (!district) return;

    // drillIn: true clears any previous drill state (selected upazila) and enters
    // drill-down for this district in one update, so clicking a second district
    // while already drilled in just switches — no "← Back to Districts" first.
    // Framing is handled by the drill-in effect below, so a district picked from
    // the left-nav tree gets exactly the same camera move as one clicked here.
    selectDistrict(district, { drillIn: true });
  }, [districtById, selectDistrict]);

  // Frame the drilled-in district. This lives in an effect rather than in the
  // click handler so a district chosen from the left-nav tree gets the same
  // camera move as one clicked on the map. Deliberately keyed on the district id
  // only — it must not re-fire and yank the view back while the user pans.
  const drilledDistrictId = isDrilledIn && selectedDistrict ? selectedDistrict._id : null;
  useEffect(() => {
    if (!drilledDistrictId || !selectedDistrict) return;
    animateView([parseFloat(selectedDistrict.lon), parseFloat(selectedDistrict.lat)], 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drilledDistrictId]);

  const handleUpazilaClick = useCallback((geo) => {
    const upz = findUpazilaRecord(geo, activeUpazilaList);
    if (upz) selectUpazila(selectedDistrict, upz);
  }, [activeUpazilaList, selectUpazila, selectedDistrict]);

  const handleDistrictMouseEnter = useCallback((geo, evt) => {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    const district = id ? districtById[id] : null;
    setTooltip({ visible: true, district, upazila: null, shapeName, x: evt.clientX, y: evt.clientY });
  }, [districtById]);

  const handleUpazilaMouseEnter = useCallback((geo, evt) => {
    const shapeName = geo.properties.shapeName;
    const upazila = findUpazilaRecord(geo, activeUpazilaList);
    // district stays null on purpose: without a record the tooltip should say so
    // rather than quietly falling back to the parent district's numbers, which
    // made unmatched polygons look like they were reporting their own data.
    setTooltip({ visible: true, district: null, upazila, shapeName, x: evt.clientX, y: evt.clientY });
  }, [activeUpazilaList]);

  const handleMouseMove = useCallback((evt) => {
    setTooltip((t) => ({ ...t, x: evt.clientX, y: evt.clientY }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip({ visible: false, district: null, upazila: null, x: 0, y: 0 });
  }, []);

  function getUpazilaStyle(geo) {
    const upazila = findUpazilaRecord(geo, activeUpazilaList);

    // No database record → show the real boundary, dimmed, and signal that it
    // isn't selectable rather than letting a click silently do nothing.
    if (!upazila) {
      const s = UPAZILA_NO_DATA_STYLE;
      const base = { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, outline: 'none' };
      return {
        default: base,
        hover: { ...base, stroke: UPAZILA_HOVER_COLOR, strokeWidth: 0.8, cursor: 'not-allowed' },
        pressed: base,
      };
    }

    // Committed selection: magenta, held through hover/pressed so the ring never
    // flickers back to the hover colour while the cursor sits on it.
    if (selectedUpazila && String(upazila._id) === String(selectedUpazila._id)) {
      const selected = {
        ...UPAZILA_SELECTED_STYLE,
        outline: 'none',
        cursor: 'pointer',
        filter: `drop-shadow(0 0 4px ${UPAZILA_SELECTED_COLOR}cc)`,
      };
      return { default: selected, hover: selected, pressed: selected };
    }

    const risk = upazila.riskStatus || 'default';
    const s = RISK_STYLE[risk] || RISK_STYLE.default;
    return {
      default: { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, outline: 'none' },
      hover: { fill: '#2b2145', stroke: UPAZILA_HOVER_COLOR, strokeWidth: 1.2, outline: 'none', cursor: 'pointer' },
      pressed: { fill: '#2b2145', outline: 'none' },
    };
  }

  function getDistrictStyle(geo) {
    const shapeName = geo.properties.shapeName;
    const id = SHAPE_NAME_TO_ID[shapeName];
    const district = id ? districtById[id] : null;
    const isSelected = selectedDistrict && district && String(district._id) === String(selectedDistrict._id);

    // Drilled in: this polygon is only a backdrop behind the upazilas, so keep it
    // neutral — see DRILL_BACKDROP_STYLE.
    if (isSelected && isDrilledIn) {
      const s = DRILL_BACKDROP_STYLE;
      const base = { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, outline: 'none' };
      return { default: base, hover: base, pressed: base };
    }

    if (isSelected) {
      const selected = { ...DISTRICT_SELECTED_STYLE, outline: 'none' };
      return { default: selected, hover: selected, pressed: selected };
    }

    const risk = district?.riskStatus || 'default';
    const s = RISK_STYLE[risk] || RISK_STYLE.default;
    return {
      default: { fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, outline: 'none' },
      hover: { fill: '#123543', stroke: DISTRICT_COLOR, strokeWidth: 1, outline: 'none', cursor: 'pointer' },
      pressed: { fill: '#1e2a42', outline: 'none' },
    };
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100%',
        // Depth: the map floats in a pool of lifted blue-slate that falls off to a
        // darker vignette at the edges, so the country reads as raised off the panel.
        background: 'radial-gradient(115% 85% at 50% 40%, #12203a 0%, #0a0e1a 46%, #06090f 100%)',
      }}
    >
      {/* Animated Sweeping Light Grid Overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen opacity-70 z-0">
        <defs>
          <pattern id="grid-pattern-map" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
          </pattern>
          <pattern id="grid-pattern-glow-map" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(16,185,129,0.7)" strokeWidth="1"/>
          </pattern>
          <radialGradient id="soft-glow-map" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="glow-mask-map">
            <motion.circle 
              r="500"
              fill="url(#soft-glow-map)"
              animate={{ 
                cx: ['-10%', '110%', '50%', '-10%'], 
                cy: ['-10%', '50%', '110%', '-10%'] 
              }}
              transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern-map)" />
        <rect width="100%" height="100%" fill="url(#grid-pattern-glow-map)" mask="url(#glow-mask-map)" />
      </svg>

      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 8 }}>
        {isDrilledIn && (
          <button
            onClick={() => {
              setIsDrilledIn(false);
              animateView([90.35, 23.68], 1);
            }}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', padding: '4px 10px',
              borderRadius: 'var(--radius-sm)', fontSize: 11,
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >
            ← Back to Districts
          </button>
        )}
        <button
          onClick={zoomOut}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '4px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          − Zoom
        </button>
        <button
          onClick={zoomIn}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '4px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          + Zoom
        </button>
        <button
          onClick={resetView}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '4px 10px',
            borderRadius: 'var(--radius-sm)', fontSize: 11,
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          ↩ Reset
        </button>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 5500,
        }}
        width={900}
        height={800}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          onMoveEnd={({ zoom: z, coordinates }) => {
            setZoom(z);
            setCenter(coordinates);
          }}
        >
          {combinedGeoData && (
            <Geographies geography={combinedGeoData}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const geoType = geo.properties.geoType;

                  if (geoType === 'district') {
                    // Pulse a soft red glow on high-risk districts so the eye is
                    // drawn to them on the overview — skipped for the selected
                    // district, which already carries its own cyan treatment.
                    const rid = SHAPE_NAME_TO_ID[geo.properties.shapeName];
                    const rdistrict = rid ? districtById[rid] : null;
                    const isRedRisk = rdistrict?.riskStatus === 'red'
                      && !(selectedDistrict && String(rdistrict._id) === String(selectedDistrict._id));
                    return (
                      <Geography
                        key={`district-${geo.rsmKey}`}
                        className={isRedRisk ? 'rsm-risk-pulse' : undefined}
                        geography={geo}
                        onClick={() => handleDistrictClick(geo)}
                        onMouseEnter={(evt) => handleDistrictMouseEnter(geo, evt)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        style={getDistrictStyle(geo)}
                      />
                    );
                  }

                  // The selected district's border, re-drawn on top of its
                  // upazilas as a neon ring: a soft breathing halo plus a crisp
                  // bright core. Non-scaling strokes keep the ring a constant
                  // width at any zoom; pointer-events:none lets upazila clicks
                  // underneath still register. Animation lives in globals.css.
                  if (geoType === 'district-outline') {
                    const base = {
                      fill: 'none',
                      stroke: DISTRICT_COLOR,
                      vectorEffect: 'non-scaling-stroke',
                      pointerEvents: 'none',
                      outline: 'none',
                      strokeLinejoin: 'round',
                    };
                    // strokeWidth/opacity for the halo are driven by the CSS
                    // keyframes, so they're intentionally not set inline here.
                    const halo = { ...base };
                    const core = { ...base, strokeWidth: 2 };
                    return [
                      <Geography
                        key={`district-halo-${geo.rsmKey}`}
                        className="rsm-district-halo"
                        geography={geo}
                        style={{ default: halo, hover: halo, pressed: halo }}
                      />,
                      <Geography
                        key={`district-core-${geo.rsmKey}`}
                        className="rsm-district-core"
                        geography={geo}
                        style={{ default: core, hover: core, pressed: core }}
                      />,
                    ];
                  }

                  if (geoType === 'upazila') {
                    return (
                      <Geography
                        key={`upazila-${geo.rsmKey}`}
                        geography={geo}
                        onClick={() => handleUpazilaClick(geo)}
                        onMouseEnter={(evt) => handleUpazilaMouseEnter(geo, evt)}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        style={getUpazilaStyle(geo)}
                      />
                    );
                  }

                  return null;
                })
              }
            </Geographies>
          )}
        </ZoomableGroup>
      </ComposableMap>

      <RiskLegend />

      {tooltip.visible && (
        <DistrictTooltip
          district={tooltip.district}
          upazila={tooltip.upazila}
          shapeName={tooltip.shapeName}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}