# UI validation scripts

Regression checks for the dashboard's **pure UI logic** — the parts of the
interface where a silent arithmetic or filtering mistake produces a plausible
picture rather than a crash, so a build passing tells you nothing.

1. **Sparkline geometry** — the 7-day trend lines on the CLIMATE TELEMETRY
   cards must map a series onto the card honestly: missing forecast days skipped
   rather than plotted as zero, a flat week drawn flat rather than on the floor,
   and the maximum at the top (SVG `y` grows *downward*, so this is easy to
   invert).
2. **Region-tree search** — the left nav is the only way to reach an upazila
   without hunting for its polygon on the map, so a search that quietly drops a
   match makes a region unreachable.

## What makes these trustworthy

The scripts do **not** re-implement the logic. Each one imports the shipped
module directly:

| Script | Imports |
| --- | --- |
| `validate-sparkline.mjs` | [`sparklineGeometry.js`](../../frontend/src/components/Dashboard/sparklineGeometry.js) |
| `validate-region-tree.mjs` | [`regionTree.js`](../../frontend/src/components/Dashboard/regionTree.js) |

Both modules were extracted out of their components for exactly this reason: the
component owns the SVG and the caret state, the module owns the maths and the
filtering, and the module is what ships. Edit either one and the test picks the
change up on the next run — no copy to drift, and no DOM or render harness
needed. (`frontend/package.json` sets `"type": "module"`, which is what lets a
plain `.mjs` script import them.)

This mirrors the approach in
[`scripts/map-validation/`](../map-validation/README.md), which slices the pure
geometry helpers out of `BangladeshMap.jsx` to test the functions the app ships.

## Run

```bash
# from the repo root
node scripts/ui-validation/validate-sparkline.mjs
node scripts/ui-validation/validate-region-tree.mjs

# or, from this directory
npm test
```

Each script prints a PASS/FAIL line per check and exits non-zero on any failure,
so they drop straight into CI.

## Bugs these pin

Both were caught by these checks before the feature shipped, and both would have
rendered something that looked fine.

### Sparkline — a missing day drawn as zero

Open-Meteo returns `null` for a forecast day it has no value for, and
`Number(null) === 0`. Coercing before filtering turned a rain series of
`[12, null, 8]` into `[12, 0, 8]` — a hard dip to the floor of the card that
reads as *"the rain stopped"* when the truth is *"we have no figure for that
day"*. Fix: drop gaps **before** coercing.

### Sparkline — an unchanged week pinned to the floor

With `max === min` the normalizer `(v - min) / (max - min)` is `0/0`. The first
guard sent a flat series to the bottom edge, so a rainless week — the single most
common rainfall series in the dry season — drew a line along the floor, reading
as *"lowest"* rather than *"unchanged"*. Fix: a flat series sits at mid-height.

### Region tree — case-sensitivity as a latent trap

`buildRegionTree` originally documented its query as *"already lower-cased"*, and
its one caller obliged. The test called it with `'COMILLA'` and got nothing back.
The app was not broken, but an exported search helper that silently matches
nothing on `'Dhaka'` is a trap for the next caller, so it now normalizes its own
input.

## Behaviour pinned by the tree tests

Worth stating plainly, because two of these look like bugs until you say them out
loud:

- A district matched **by its own name** shows its **full** upazila subtree.
  Narrowing it would hide siblings the user can plainly see match.
- **`Dhaka` is both a division and a district.** The division rule fires first,
  so searching it widens to the whole division (Dhaka *and* Gazipur) rather than
  narrowing to the one district.
- A district kept **only** by upazila hits shows just those hits, force-opened,
  so the reason it survived is visible without a click.
- A division a search emptied is dropped; an empty division while *browsing* is
  kept, because its absence would read as "no such division" rather than "no
  results".
- Bangla `bnName` matches on both levels.
