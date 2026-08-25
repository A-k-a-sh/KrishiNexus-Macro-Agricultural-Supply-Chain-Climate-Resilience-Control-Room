# Interactive Map: Drill-Down Bugs, Root Causes & Fixes

**Component:** [`frontend/src/components/Map/BangladeshMap.jsx`](../frontend/src/components/Map/BangladeshMap.jsx)
**Page:** `/dashboard` (centre panel)
**Stack:** React 18 + `react-simple-maps` v3 (which wraps `d3-geo`'s `geoPath`)
**Validation:** [`scripts/map-validation/`](../scripts/map-validation/) — run `npm test` there
**Companion doc:** [`dashboard-ui-upgrade.md`](dashboard-ui-upgrade.md) — the UI built on top of these fixes

---

## TL;DR

The dashboard map lets you click a district to drill into its upazilas. Three
defects were found and fixed, each rooted in the **data**, not the rendering:

| # | Symptom | Root cause | Fix |
| - | ------- | ---------- | --- |
| 1 | Clicking a district made **the whole map outline vanish** | 544 upazila polygons shipped with **inverted winding**; on a sphere d3-geo drew each as the *entire globe minus the shape* | Normalize ring winding to the districts' known-good orientation |
| 2 | Some areas inside a drilled-in district looked **already-selected (cyan)** and showed the **parent district's** info on hover | Upazilas were filtered through a name-map that covered only **378 / 544** polygons and **collided 13 repeated names**; the missing polygons were holes the district's cyan fill showed through | Assign every polygon to its parent district **geometrically**; match DB records **within that district only** |
| 3 | (latent) drill-down state could be silently cleared | `selectDistrict` hard-set `isDrilledIn = false` and relied on React batching the click handler's follow-up `true` | Make drill intent an **explicit argument** |

All fixes are verified against the real GeoJSON, including a cross-check against
`d3-geo` itself. See [Verification](#verification).

---

## Background: two data sources that don't quite agree

The map fuses two independent datasets, and every bug below lives in the seam
between them:

- **Geometry** — static GeoJSON in `frontend/public/`:
  - `bd-districts.geojson` — **64** ADM2 district polygons (from geoBoundaries)
  - `bd-upazilas.geojson` — **544** ADM3 upazila polygons (from geoBoundaries)
- **Attributes** — MongoDB, seeded from the bdapi service: district & upazila
  records with `riskStatus`, `liveWeather`, `activeAlerts`, and crucially a
  `name`. There are roughly **495** official upazilas.

The two are stitched by name. `frontend/src/data/geoNameMap.json` maps each
district polygon's `shapeName` to its bdapi `_id` (64 clean entries — districts
have no name collisions). Upazilas are where it gets hard: **544 polygons vs
~495 records, with 13 names repeated across the country.**

---

## Bug #1 — "the map outline disappeared"

### Symptom
On the base map everything looked fine. Click a district to drill in and the
entire country outline — every district border — vanished behind a flat fill.

### Root cause: spherical winding order
`react-simple-maps` renders through `d3-geo`'s `geoPath`, which treats polygons
as lying on a **sphere**, not a flat plane. On a sphere there is no "outside" —
so d3 uses **ring winding order** to decide which side of a boundary is the
interior. Wind the exterior ring the correct way and you get the country; wind
it backwards and d3 fills its **complement — the whole globe minus the shape.**

`bd-upazilas.geojson` (exported from geoBoundaries ADM3 via mapshaper) had
**every ring inverted**. Each upazila therefore painted a full-canvas fill.
Stack 544 of them on drill-in and every district outline underneath is buried.
`bd-districts.geojson` happened to be wound correctly, which is why the base map
always worked and only *drilling in* broke.

### The fix
We don't need an absolute clockwise/counter-clockwise test (that would mean
importing `d3-geo` into app code, and it isn't a declared dependency). The
districts are known-good, and in this projection their exterior rings have
**negative planar (shoelace) signed area.** So we flip any ring whose signed
area is positive to match:

```js
function ringSignedArea(ring) {            // shoelace formula
  let area = 0;
  for (let i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return area / 2;
}

function normalizePolygon(rings) {
  // rings[0] = exterior, rest = holes. Reverse together to preserve them.
  if (rings.length && ringSignedArea(rings[0]) > 0) {
    for (const ring of rings) ring.reverse();
  }
}
```

`normalizeWinding()` walks both `Polygon` and `MultiPolygon` features and is
called once on each GeoJSON file right after fetch. It's a **no-op on all 64
districts** and **corrects all 544 upazilas.**

### Proof
- Districts: 386 exterior rings, **0** inverted before, **0** after (untouched).
- Upazilas: 899 exterior rings, **899** inverted before, **0** after.
- Via `d3-geo`: largest upazila area after the fix is `3.99e-5` steradians
  (a real, tiny shape — a globe-complement would be ≈ 4π ≈ 12.566), **0 / 544**
  polygons render as a globe, and **544 / 544** upazila representative points
  fall inside their parent district (`geoContains`).

---

## Bug #2 — phantom cyan patches inside a drilled-in district

### Symptom
Drill into certain districts (Sunamganj, Rangamati, Khagrachhari, Netrakona…)
and 1–4 sub-areas were **already tinted cyan**, as if pre-selected. Hovering one
showed **the parent district's** name and telemetry, not an upazila's.

### Root cause: an incomplete, colliding name-map — and z-order
The old drill-down filtered the 544 upazila polygons through
`upazilaGeoNameMap.json`, a build artifact generated by
[`backend/db/seeds/seedUpazilas.js`](../backend/db/seeds/seedUpazilas.js). That
seed matched each bdapi upazila name against the **entire national** GeoJSON:

```js
// seedUpazilas.js — searches ALL 544 features for each name
let match = geojson.features.find(f => normalize(f.properties.shapeName) === uzNameNorm);
// …loose includes() fallback…
geoNameMap[match.properties.shapeName] = uz.id;   // last write wins on collisions
```

Two failure modes compounded:

1. **Collisions.** 544 polygons share only **527 distinct names**; 13 names
   repeat — `Kaliganj` ×4, `Daulatpur` ×3, `Kotwali` ×3, `Companiganj`,
   `Durgapur`, `Kachua`, `Lohagara`, `Mirpur` ×2. A national lookup can't tell
   them apart, so IDs landed on the wrong polygon or overwrote each other.
2. **Incomplete coverage.** The map ended up with only **378 / 544** polygons.
   The other 166 were never drawn.

The undrawn polygons left **holes** in the drilled-in view. And the selected
district polygon sat *underneath* the upazilas painted in its **cyan selected
fill** — so each hole showed through as a cyan patch, and because the only thing
under the cursor there was the district polygon, hover reported district info.
That's the bug, exactly.

Per-district, the missing counts matched the report precisely:

| District | Drawn before | Now | Holes closed |
| --- | --- | --- | --- |
| Sunamganj | 8 / 11 | 11 / 11 | 3 |
| Rangamati | 6 / 10 | 10 / 10 | 4 |
| Khagrachhari | 4 / 8 | 8 / 8 | 4 |
| Netrakona | 9 / 10 | 10 / 10 | 1 |
| Bandarban | 6 / 6 | 6 / 6 | 0 |

### The fix — three parts

**a) Ask the geometry, not the name.** Every upazila polygon is assigned to its
parent district by point-in-polygon, once, up front and memoized:

- `representativePoint(feature)` — area-weighted centroid of the feature's
  **largest** ring (so an island fragment of a multipart upazila never speaks
  for the whole shape).
- Bounding-box fast-reject → even-odd **ray-cast** (`featureContainsPoint`,
  honouring holes) against each district polygon.
- A **nearest-district-centroid fallback** for the handful of points that land
  just outside every polygon (coastal/riverine edges), so a shape is **never
  silently dropped**.

Result: **544 / 544** polygons assigned, all **64** districts covered, **0**
unassigned — identical to `d3-geo`'s `geoContains`, in ~11 ms.

**b) Match DB records within the district only.** `findUpazilaRecord` now
searches just the ~8–12 records of the drilled-in district in three tiers —
exact normalized name → 4+ char containment → **bounded fuzzy** (optimal-string-
alignment edit distance ≤ 2, accepted only when the winner is clearly closer
than the runner-up). Scoping is what makes fuzzy matching safe and disambiguates
the repeats: there are four `Kaliganj`s nationally, but only one in any given
district, so even a fuzzy match can't cross district lines.

**c) Make holes impossible to misread.** Two defensive changes so this class of
bug can't visually recur even if a polygon slips through:
- The drilled-in district is repainted as a **neutral slate backdrop**
  (`DRILL_BACKDROP_STYLE`), not cyan — a sliver of it can no longer look
  selected.
- A polygon with no DB record renders **dimmed** with `cursor: not-allowed` and
  an honest **"Not in database"** tooltip, instead of quietly borrowing the
  parent district's numbers.

### Proof
See the table above and [Verification](#verification). Matcher spot-checks:
`Baghai Chhari → Baghaichhari` (exact after normalizing),
`Kawkhali (Betbunia) → Kawkhali` (containment), `Dakshin Sunamganj` correctly
beats `Sunamganj Sadar` (exact over containment), fuzzy recovers
`Dharampasha → Dharmapasha` (transposition) and `Sulla → Shalla`, while
ambiguous or distant names are rejected and short fragments guarded (`Ram` does
**not** match `Ramganj`).

---

## Bug #3 — drill-down state was one call site from breaking

`selectDistrict` used to hard-code `setIsDrilledIn(false)`, and the map's click
handler set it back to `true` on the very next line. That only worked because
React 18 **batched** the two updates into one render. Any non-batched caller (or
a future `await` between them) would clear the drill state the click was meant to
enter. Fixed by making intent explicit — the caller owns the decision:

```js
function selectDistrict(district, { drillIn = false } = {}) {
  setSelectedDistrict(district);
  setSelectedUpazila(null);
  setIsDrilledIn(Boolean(district) && drillIn);
}
```

`handleDistrictClick` passes `{ drillIn: true }`; clicking a second district
while drilled in now **switches directly** (no "← Back to Districts" first). The
left-nav caller keeps its old non-drilling behaviour.

---

## The interaction colour system

Three tiers, none colliding with the red/yellow/green risk palette, so "what am
I pointing at, and at which level" is always readable:

| Scope | Colour | When |
| --- | --- | --- |
| District | **cyan** `#22d3ee` | selected district ring + district hover |
| Upazila hover | **violet** `#a78bfa` | transient "you could pick this" |
| Upazila selected | **magenta** `#f472b6` | committed pick (glow held across hover/pressed so it never flickers) |

The selected district's border is redrawn *on top* of its upazilas as a
non-scaling **neon ring** (soft breathing halo + crisp core; animation in
`globals.css`, disabled under `prefers-reduced-motion`) with
`pointer-events: none` so upazila clicks underneath still register.

---

## Known limitations (honest edges)

- **~30 polygons carry a repeated name**, and **544 polygons > ~495 records**:
  geoBoundaries ADM3 is finer than bdapi's upazila list (metropolitan thanas,
  splits). Some polygons therefore have **no** matching record and correctly
  show "Not in database". This is a granularity mismatch, not a rendering bug.
- **Letter-transposition and romanization drift** (`Dharampasha`/`Dharmapasha`,
  `Sulla`/`Shalla`) is now recovered by the tier-3 district-scoped fuzzy match.
  It is deliberately conservative (≤ 2 edits, clear-gap winner), so a genuinely
  record-less polygon still falls through to "Not in database" rather than
  grabbing a neighbour.
- `seedUpazilas.js` now assigns upazila coordinates by the **same geometric
  grouping + district-scoped matching** (no more national name-search), and the
  dead `upazilaGeoNameMap.json` has been removed. Re-run the seed (needs Atlas +
  bdapi) to refresh the ~166 upazilas whose `lat`/`lon` were previously
  mis-placed by the old matcher.

---

## Verification

The map pipeline is pure and data-driven, so it's testable without a browser or
a database. See [`scripts/map-validation/`](../scripts/map-validation/). The
scripts extract and run the **shipped** helpers (not a copy) and, where `d3-geo`
resolves, cross-check against the same library react-simple-maps uses.

```bash
node scripts/map-validation/validate-winding.mjs    # Bug #1
node scripts/map-validation/validate-coverage.mjs   # Bug #2
```

Live click-through still needs the running app (MongoDB + bdapi for attributes):

```bash
cd frontend && npm run dev
```

---

## Follow-ups (not yet done)

- Optionally relabel "Not in database" → "No live data" for polygons that are
  genuinely finer than the record set.
- Re-run `seedUpazilas.js` against the live DB to persist the corrected upazila
  coordinates.

---

## Change map

| File | Change |
| --- | --- |
| `frontend/src/components/Map/BangladeshMap.jsx` | winding normalization; geometric parent assignment; within-district record matching (exact → containment → bounded fuzzy); three-tier palette; neutral drill backdrop; honest no-data style |
| `frontend/src/context/AppContext.jsx` | `selectDistrict(district, { drillIn })` explicit intent |
| `frontend/src/styles/globals.css` | neon ring keyframes + reduced-motion guard |
| `backend/db/seeds/seedUpazilas.js` | geometric parent assignment + district-scoped matching for seeded coordinates (replaces national name-search); geometry unit-testable via a `require.main` guard |
| `frontend/src/data/upazilaGeoNameMap.json` | **removed** — superseded by geometric assignment |
| `scripts/map-validation/*` | this doc's regression checks |

---

## What came next

With the data layer honest, the dashboard was rebuilt around it — unified panel
chrome, a searchable region tree, camera easing, and telemetry sparklines. The
decisions, plus three more bugs found while making them, are in
[`dashboard-ui-upgrade.md`](dashboard-ui-upgrade.md).
