// Validates the telemetry sparkline geometry — the 7-day trend lines on the
// dashboard's CLIMATE TELEMETRY cards.
//
// Two real bugs were caught here before shipping, and both are pinned below:
//
//   1. PHANTOM DIP. Open-Meteo returns `null` for a forecast day it has no value
//      for, and `Number(null) === 0`. Coercing before filtering plotted a rain
//      series of [12, null, 8] as [12, 0, 8] — a hard dip to the floor that reads
//      as "it stopped raining" when the truth is "we don't know about that day".
//      Fix: drop gaps BEFORE coercing.
//
//   2. FLAT WEEK PINNED TO THE FLOOR. With max === min the normalizer
//      (v - min) / (max - min) is 0/0, and the naive guard sent it to the bottom
//      edge — so a rainless week (the single most common rainfall series in the
//      dry season) drew a line along the floor, reading as "lowest" rather than
//      "unchanged". Fix: a flat series sits at mid-height.
//
// This script imports the SHIPPED module directly, so it runs the exact function
// the app renders with.
import { sparklinePoints } from '../../frontend/src/components/Dashboard/sparklineGeometry.js';

const W = 96;
const H = 22;
const PAD = 2;

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const inBox = (g) =>
  g.xs.every((x) => x >= PAD - 1e-9 && x <= W - PAD + 1e-9) &&
  g.ys.every((y) => y >= PAD - 1e-9 && y <= H - PAD + 1e-9);

console.log('\n  Running shipped sparklinePoints() from sparklineGeometry.js\n');

// ── Degenerate input: nothing plottable ───────────────────────────────────────
// A single point is not a trend, and drawing one dot with no line is noise. Every
// one of these must return null so the component renders no SVG at all rather
// than an empty or one-point box.
console.log('  Degenerate input returns null (component renders nothing)');
console.log('  ' + '-'.repeat(62));

assert(sparklinePoints(undefined, W, H, PAD) === null, 'undefined series');
assert(sparklinePoints(null, W, H, PAD) === null, 'null series');
assert(sparklinePoints([], W, H, PAD) === null, 'empty array');
assert(sparklinePoints([7], W, H, PAD) === null, 'single value (not a trend)');
assert(sparklinePoints([null, null], W, H, PAD) === null, 'all values missing');
assert(sparklinePoints([5, null], W, H, PAD) === null, 'one real value after filtering');
assert(sparklinePoints(['n/a', 'x'], W, H, PAD) === null, 'all values non-numeric');

// ── BUG #1 — nulls must be dropped, not coerced to zero ──────────────────────
console.log('\n  BUG #1 — missing days are skipped, never plotted as 0');
console.log('  ' + '-'.repeat(62));

const gapped = sparklinePoints([12, null, 8], W, H, PAD);
assert(gapped.points.length === 2, `[12, null, 8] keeps 2 points, not 3 (got ${gapped.points.length})`);
assert(!gapped.points.includes(0), `no phantom 0 in points: [${gapped.points}]`);
assert(near(Math.min(...gapped.points), 8) && near(Math.max(...gapped.points), 12),
  `range stays 8..12, floor is not dragged to 0`);

// The same trap by other names: undefined from a short array, '' from a CSV-ish
// payload. Number('') is also 0.
const mixedGaps = sparklinePoints([3, undefined, 9, '', 6], W, H, PAD);
assert(mixedGaps.points.length === 3 && !mixedGaps.points.includes(0),
  `undefined and '' are dropped too: [${mixedGaps.points}]`);

const strings = sparklinePoints(['31.2', '30.8', '33.5'], W, H, PAD);
assert(strings && strings.points.length === 3 && near(strings.points[0], 31.2),
  'numeric strings still coerce (API sometimes sends them)');

// ── BUG #2 — a flat series sits mid-box, not on the floor ────────────────────
console.log('\n  BUG #2 — an unchanged week reads as flat, not as lowest');
console.log('  ' + '-'.repeat(62));

const dryWeek = sparklinePoints([0, 0, 0, 0, 0, 0, 0], W, H, PAD);
assert(dryWeek.isFlat === true, 'zero-rain week is flagged isFlat');
assert(dryWeek.ys.every((y) => near(y, H / 2)),
  `flat week draws at mid-height ${H / 2}, not the floor ${H - PAD} (got ${dryWeek.ys[0]})`);
assert(dryWeek.ys.every((y) => Number.isFinite(y)), 'no NaN from the 0/0 normalizer');

const flatNonZero = sparklinePoints([27, 27, 27], W, H, PAD);
assert(flatNonZero.isFlat && flatNonZero.ys.every((y) => near(y, H / 2)),
  'a steady-temperature week is flat too, at the same mid-height');

// ── Normal series: orientation, extents, spacing ─────────────────────────────
// SVG y grows downward, so the series MAXIMUM must map to the SMALLEST y. Getting
// this backwards silently draws every trend upside down.
console.log('\n  Normal series — orientation, extents and spacing');
console.log('  ' + '-'.repeat(62));

const rising = sparklinePoints([10, 20, 30], W, H, PAD);
assert(rising.isFlat === false, 'a varying series is not flagged flat');
assert(near(rising.ys[2], PAD), `max value hits the top inset y=${PAD} (got ${rising.ys[2]})`);
assert(near(rising.ys[0], H - PAD), `min value hits the bottom inset y=${H - PAD} (got ${rising.ys[0]})`);
assert(rising.ys[0] > rising.ys[1] && rising.ys[1] > rising.ys[2],
  'a rising series descends in y (SVG y grows downward)');
assert(near(rising.ys[1], H / 2), 'the midpoint of a linear ramp lands mid-box');

const falling = sparklinePoints([30, 20, 10], W, H, PAD);
assert(falling.ys[0] < falling.ys[2], 'a falling series ascends in y');

assert(near(rising.xs[0], PAD) && near(rising.xs[2], W - PAD),
  `x spans the full inset width ${PAD}..${W - PAD}`);
const gaps = rising.xs.slice(1).map((x, i) => x - rising.xs[i]);
assert(gaps.every((g) => near(g, gaps[0])), 'x spacing is uniform');

const week = sparklinePoints([28, 31, 33, 30, 29, 34, 32], W, H, PAD);
assert(week.xs.length === 7 && week.ys.length === 7, 'a 7-day series yields 7 points');
assert(inBox(week), 'every point stays inside the padded box (stroke is never clipped)');
assert(near(week.ys[5], PAD), 'the hottest day (34°) is the topmost point');

// Negative values are legal — a cold snap in the north can go below zero, and the
// range must shift rather than clamp at 0.
const belowZero = sparklinePoints([-3, 0, 4], W, H, PAD);
assert(near(belowZero.ys[0], H - PAD) && near(belowZero.ys[2], PAD),
  'negative minimums scale correctly instead of clamping at zero');
assert(inBox(belowZero), 'negative series stays inside the box');

// The component passes its own width/height; the geometry must not assume 96×22.
const wide = sparklinePoints([1, 5], 200, 60, 4);
assert(near(wide.xs[1], 196) && near(wide.ys[1], 4),
  'custom width/height/pad are honoured');

console.log(
  failures === 0
    ? '\n  All sparkline geometry checks passed.\n'
    : `\n  ${failures} check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
