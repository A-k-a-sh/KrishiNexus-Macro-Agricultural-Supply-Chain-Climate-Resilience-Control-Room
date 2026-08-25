# UI validation scripts

Regression checks for the `/dashboard` panel logic — the parts of the UI that are
arithmetic and filtering rather than layout, and so can be tested honestly without
a browser.

1. **Sparkline geometry** — the 7-day trend lines on the CLIMATE TELEMETRY cards.
   Guards two bugs found while building them: a `null` forecast day coerced to `0`
   (drawing a phantom dip to the floor), and a flat week pinned to the bottom edge
   (reading as "lowest" instead of "unchanged").
2. **Region-tree search** — the left-nav Division → District → Upazila tree. The
   nav is the only way to reach an upazila without hunting for its polygon, so a
   search that quietly drops a match makes a region unreachable.

## What makes these trustworthy

The scripts `import` the shipped modules directly —
[`sparklineGeometry.js`](../../frontend/src/components/Dashboard/sparklineGeometry.js)
and [`regionTree.js`](../../frontend/src/components/Dashboard/regionTree.js) — so
they run the **exact functions the app renders with**. No copies, no string
extraction: both modules are pure and free of React and JSX precisely so the tests
can reach them (`frontend/package.json` declares `"type": "module"`, so a plain
`.mjs` runner can load them with no build step and no dependencies).

This is the same principle as
[`scripts/map-validation/`](../map-validation/README.md), which slices its helpers
out of `BangladeshMap.jsx` because they live inside a component. Here the logic was
extracted into its own module instead, which is the better shape when you have the
choice.

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

## Coverage

| Check | Cases | Pins |
| --- | --- | --- |
| `validate-sparkline.mjs` | 30 | null/undefined/`''`/non-numeric gaps, <2 plottable points, flat series at mid-height, SVG y-axis orientation, padding inset, uniform x spacing, negative values, custom dimensions |
| `validate-region-tree.mjs` | 31 | browse-all, district-name hit, division-name hit (incl. the Dhaka division/district name collision), upazila-only hit force-opening its parent, Bangla `bnName` on both levels, case and whitespace normalization, unloaded subtrees, empty result, empty input |

## Notable behaviours these lock in

- **A missing day is skipped, not zeroed.** Open-Meteo returns `null` for a day it
  has no value for, and `Number(null) === 0`. Filtering happens *before* coercion.
- **A flat week sits mid-box.** `(v - min) / (max - min)` is `0/0` when a series
  never varies — the common case for rainfall in a dry week.
- **Search rules are unioned, not prioritised.** A district survives on its own
  name, its division's name, *or* an upazila hit. Only the upazila-only case
  narrows the subtree and force-opens it, so the reason a district survived is
  always visible without a click.
- **`Dhaka` is both a division and a district.** The division rule fires first, so
  the search widens to the whole division. Surprising until said out loud, hence
  its own case.
