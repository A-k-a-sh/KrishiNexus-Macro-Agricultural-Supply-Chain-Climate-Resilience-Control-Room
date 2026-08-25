# Map validation scripts

Regression checks for the Bangladesh district → upazila drill-down map. They
guard the two data-pipeline bugs documented in
[`docs/map-drilldown-fixes.md`](../../docs/map-drilldown-fixes.md):

1. **Winding** — every GeoJSON polygon must render as its real shape, never as a
   full-canvas "globe complement" (the *map-disappeared* bug).
2. **Coverage** — every one of the 544 upazila polygons must be assigned to
   exactly one parent district (the *phantom-cyan-patch* bug), and the DB-record
   name matcher must behave — including the cases that should honestly fail.

## What makes these trustworthy

The scripts do **not** re-implement the geometry. `_extract.mjs` slices the pure
helper region straight out of
[`BangladeshMap.jsx`](../../frontend/src/components/Map/BangladeshMap.jsx) and
evaluates it, so the tests run the **exact functions the app ships**. Edit a
helper and the test picks up the change automatically; move the region markers
and the loader fails loudly instead of silently passing a stale copy.

Where [`d3-geo`](https://github.com/d3/d3-geo) is resolvable (it ships as a
transitive dependency under `frontend/node_modules`, which is why app code must
never import it but a dev script may), each test adds a **definitive spherical
cross-check** — the same `geoPath`/`geoContains` math react-simple-maps uses
internally. If it isn't resolvable the planar assertions still run and the
cross-check is skipped with a note.

## Run

```bash
# from the repo root
node scripts/map-validation/validate-winding.mjs
node scripts/map-validation/validate-coverage.mjs

# or, from this directory
npm test
```

Each script prints a PASS/FAIL line per check and exits non-zero on any failure,
so they drop straight into CI.

## Expected output (current data)

```
BUG #1 — GeoJSON winding normalization
  districts  exterior rings=386  inverted before=  0  after=  0  PASS
  upazilas   exterior rings=899  inverted before=899  after=  0  PASS
  largest upazila area after fix : 3.993e-5 sr   (tiny ⇒ real shape)
  polygons rendering as globe    : 0 / 544        PASS
  upazila points inside parent   : 544 / 544      PASS

BUG #2 — geometric parent-district coverage
  every polygon assigned : 544 / 544   PASS
  all districts covered  : 64 / 64     PASS
  no district left empty               PASS
  Sunamganj 8→11, Rangamati 6→10, Khagrachhari 4→8, Netrakona 9→10  (holes closed)
  name matcher: 7/7 cases                PASS
  assignment == d3-geo geoContains: 544/544  PASS
```

## Data sources under test

| File | Rows | Role |
| --- | --- | --- |
| `frontend/public/bd-districts.geojson` | 64 | ADM2 district polygons (winding correct) |
| `frontend/public/bd-upazilas.geojson` | 544 | ADM3 upazila polygons (winding was inverted) |
| `frontend/src/data/geoNameMap.json` | 64 | district `shapeName` → bdapi district `_id` |

## See also

[`scripts/ui-validation/`](../ui-validation/README.md) covers the dashboard's pure
UI logic — sparkline geometry and left-nav region search — on the same principle of
running the shipped code rather than a copy of it.
