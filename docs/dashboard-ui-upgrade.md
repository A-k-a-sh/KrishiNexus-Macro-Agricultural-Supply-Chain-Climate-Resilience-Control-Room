# Dashboard UI Upgrade: Decisions, Bugs & Fixes

**Page:** `/dashboard`
**Panels:** [`LeftNav.jsx`](../frontend/src/components/Dashboard/LeftNav.jsx) · [`BangladeshMap.jsx`](../frontend/src/components/Map/BangladeshMap.jsx) · [`TelemetryPanel.jsx`](../frontend/src/components/Dashboard/TelemetryPanel.jsx)
**Validation:** [`scripts/ui-validation/`](../scripts/ui-validation/) — run `npm test` there
**Companion doc:** [`map-drilldown-fixes.md`](map-drilldown-fixes.md) — the data-layer bugs underneath this UI

---

## TL;DR

Once the map's [three data bugs](map-drilldown-fixes.md) were fixed, the dashboard
worked but didn't yet *read* as one instrument. Four changes made it one, and
building them surfaced three defects of their own.

| Change | What it does | Commit |
| --- | --- | --- |
| Map depth & motion | Radial vignette behind the country; eased camera tween on drill-in; a slow pulse on red-risk districts | `00d5b3a` |
| Unified panel chrome | One `.panel-head` rail across all three panels; a `Bangladesh / District / Upazila` drill path over the map | `c43f2ad` |
| Searchable region tree | Left nav becomes one Division → District → Upazila tree with national search | `bd96ba4` |
| Telemetry sparklines | 7-day trend lines on the climate cards | `31ff3a6` |
| Extract + test | Pure `sparklineGeometry.js` / `regionTree.js` + 61 regression checks | `c48d776` |

| # | Bug | Root cause | Fix |
| - | --- | ---------- | --- |
| 1 | A missing forecast day drew a **hard dip to the floor** | Open-Meteo returns `null` for a day it has no value for, and `Number(null)` is `0` — coercion happened before filtering | Drop gaps **before** coercing |
| 2 | A rainless week drew a line **along the bottom edge**, reading as "lowest" | `(v - min) / (max - min)` is `0/0` when a series never varies; the naive guard resolved it to the floor | A flat series sits at **mid-height** |
| 3 | (latent) `buildRegionTree` matched **nothing** for `'Dhaka'` | It lower-cased the *candidate* but trusted the caller to lower-case the *query* | The function **normalizes its own query** |

---

## The design constraint

The map already had a colour language and it was worth keeping, not replacing:
**cyan means district, magenta means upazila**. Everything below either speaks that
language or stays quiet.

The two accents are now CSS variables in `globals.css` —
`--scope-district: #22d3ee`, `--scope-upazila: #f472b6` — with a comment pointing
at the map's palette as the source of truth. That's what lets the left nav's
selected-row border, the drill path over the map, and the intelligence panel's
header all agree with the polygon colours without any of them importing from the
map component.

---

## Change #1 — depth and motion on the map

### Background

A flat `#0a0e1a` fill behind the country made the map look like a screenshot of a
map. The country needed to sit *in* something.

```css
radial-gradient(115% 85% at 50% 40%, #12203a 0%, #0a0e1a 46%, #06090f 100%)
```

The light centre is placed slightly above the middle because that's where
Bangladesh's landmass actually sits in the projection — so the vignette darkens
into the corners the country never occupies.

### Eased drill-in

Snapping `zoom` from 1 to 4 in a single frame loses the connection between the
national view and the district you just clicked. A `requestAnimationFrame` tween
with `easeOutCubic` over 550ms keeps it:

```js
const animateView = useCallback((targetCenter, targetZoom) => {
  if (tweenRef.current) cancelAnimationFrame(tweenRef.current);
  if (prefersReducedMotion()) { setCenter(targetCenter); setZoom(targetZoom); return; }
  // …tween from centerRef.current / zoomRef.current
}, []);
```

Three details that matter:

- **Refs hold the start point.** Reading `center`/`zoom` from state would put them
  in the dependency array, re-creating `animateView` on every tween frame.
- **A new move cancels the running one.** Two overlapping tweens would fight over
  `setCenter` and jitter.
- **The framing lives in an effect, not the click handler.** Keyed on the drilled
  district's `_id`:

  ```js
  const drilledDistrictId = isDrilledIn && selectedDistrict ? selectedDistrict._id : null;
  useEffect(() => {
    if (!drilledDistrictId || !selectedDistrict) return;
    animateView([parseFloat(selectedDistrict.lon), parseFloat(selectedDistrict.lat)], 4);
  }, [drilledDistrictId]);
  ```

  So a district picked in the **left-nav tree** gets the identical camera move as
  one clicked on the **map** — one source of framing, not two. Keying on the id
  alone (rather than the whole district object) also means it can't re-fire and
  yank the view back while the user is panning.

### Risk pulse

Red-risk districts pulse on a 2.4s cycle so the eye finds them without reading the
legend. The interesting constraint: **react-simple-maps writes `fill` and `stroke`
as inline styles**, which beat any stylesheet rule. Rather than fight specificity,
the animation targets a property the library never sets inline:

```css
@keyframes risk-pulse-red {
  0%, 100% { filter: drop-shadow(0 0 1.5px rgba(239, 68, 68, 0.45)); }
  50%      { filter: drop-shadow(0 0 7px rgba(239, 68, 68, 0.95)); }
}
```

The currently-selected district is excluded — it already has the neon selection
ring, and two competing glows on one polygon is noise.

Reduced motion is honoured in **both** layers: `@media (prefers-reduced-motion)`
freezes the pulse at a mid-intensity glow (so the information survives), and
`window.matchMedia(...)` in `animateView` jumps the camera instead of tweening.

---

## Change #2 — one chrome for three panels

Each panel had grown its own header treatment. They're now one `.panel-head` rail:
34px tall, mono, uppercase, `--text-muted`, with an optional right-aligned value in
the scope accent.

Over the map that rail carries the **drill path**, which does two jobs at once —
it says where you are and it says what you can do:

```
BANGLADESH / RANGPUR / BADARGANJ          SCROLL TO ZOOM · DRAG TO PAN
```

The hint on the right changes with state: `Click a district to drill in` at the
national level, `Scroll to zoom · drag to pan` once drilled in. Naming the gesture
that's currently available beats a static legend.

This required restructuring the centre column into a flex column so the rail sits
*above* the map rather than over it — the map's zoom controls are absolutely
positioned, and overlapping them with the rail would have put two interactive
layers in the same pixels.

---

## Change #3 — one searchable region tree

### Before

Two disconnected lists: districts grouped by division, and — only after drilling
in — a separate upazila list. Reaching an upazila meant knowing its district first.

### After

One continuous Division → District → Upazila tree with a search that spans all
three levels, in English or Bangla.

**The row renderer is shared.** District and upazila rows differ only in indent and
in which accent marks *selected*, so one `RegionRow` handles both instead of two
near-identical 30-line blocks.

**Search rules are unioned, not prioritised.** A district survives a query if:

- its own name or `bnName` matches, **or**
- its division's name matches, **or**
- any of its upazilas match.

Only the third case narrows the subtree to the hits and force-opens it — so *the
reason a district survived is always visible without a click*. In the first two
cases the full subtree shows, because narrowing it would hide siblings the user can
plainly see match.

All of this is pure, and lives in
[`regionTree.js`](../frontend/src/components/Dashboard/regionTree.js) so it can be
tested directly. 31 checks pin it, including the case that reads as a bug until you
say it out loud: **`Dhaka` is both a division and a district**, so searching it
widens to the whole division rather than narrowing to the one district.

### Making national search affordable

Searching has to look inside districts the user never opened, which needs the
national upazila list (~495 records). `GET /api/upazilas` with no `districtId`
returns all of them in one request, and it fires **only on the first query of ≥2
characters** — first paint never pays for it.

### Centralized loading

Both the map (on drill-in) and the nav (on expand, and on search) need upazilas, so
the fetch moved into `AppContext`. Refs track what's loaded and what's in flight, so
two callers asking in the same instant produce **one** request:

```js
const loadedRef   = useRef({}); // districtId → true
const inFlightRef = useRef({}); // districtId | '*' → Promise
```

`ensureAllUpazilas` merges with `{ ...grouped, ...prev }` — already-fetched
districts win. Same data either way, but keeping their array identity avoids
re-rendering rows that didn't change.

Removing the map's old dynamic `import('../../api')` in favour of this also cleared
a pre-existing Vite build warning.

### `selectUpazila`, and why it exists

Picking an upazila in the nav implies its district *and* drill-down — three state
updates. Chaining `selectDistrict(...)` then `setSelectedUpazila(...)` from the nav
would depend on two React-18-batched updates landing in the right order, which is
exactly [Bug #3](map-drilldown-fixes.md#bug-3--drill-down-state-was-one-call-site-from-breaking).
So the intent is one function in the context:

```js
function selectUpazila(district, upazila) {
  if (district) setSelectedDistrict(district);
  setIsDrilledIn(true);
  setSelectedUpazila(upazila);
}
```

---

## Change #4 — sparklines, and the two bugs in them

The climate cards showed today's number with no history. Four cards now carry a
7-day trend: max temp, humidity, min temp, and 7-day rain total.

Only three have sparklines. **The weather record has no humidity 7-day array** —
the available series are `tempMax7Day`, `tempMin7Day` and `precipitationSum7Day` —
and inventing one, or reusing another card's shape, would be a chart that lies. The
humidity card shows its number and stops.

Drawn by hand rather than with a fourth recharts instance: at 96×22 a chart's axes,
legend and tooltip are all cost and no signal. The geometry is pure and lives in
[`sparklineGeometry.js`](../frontend/src/components/Dashboard/sparklineGeometry.js);
the component owns only the SVG.

### Bug #1 — the phantom dip

Open-Meteo returns `null` for a forecast day it has no value for, and
`Number(null) === 0`. Coercing before filtering plotted `[12, null, 8]` as
`[12, 0, 8]`:

```
   before                    after
   ╲                        ╲
    ╲    ╱                   ╲___
     ╲  ╱
      ╲╱   ← "it stopped raining"
```

A dip to the floor reads as *a measured zero*. The truth is *we don't know about
that day*, which is a gap, not a value. The fix is one line of ordering:

```js
const points = (series || [])
  .filter((v) => v !== null && v !== undefined && v !== '')  // ← drop gaps FIRST
  .map(Number)
  .filter((n) => Number.isFinite(n));
```

`''` is in there because `Number('')` is also `0`.

### Bug #2 — the flat week on the floor

With `max === min`, the normalizer `(v - min) / (max - min)` is `0/0`. The naive
guard resolved it to the bottom edge — so a **rainless week**, the commonest
rainfall series in the dry season, drew a line along the floor. In a box whose
bottom edge means "lowest in range", that reads as *lowest*, when it means
*unchanged*.

```js
const y = (v) => (isFlat
  ? height / 2
  : height - pad - ((v - min) / (max - min)) * (height - pad * 2));
```

A series with fewer than two plottable points returns `null` and the component
renders no SVG at all — one dot with no line is noise, not a trend.

---

## Verification

The extracted modules are pure, so they're testable without a browser, a DOM, or a
build step. [`scripts/ui-validation/`](../scripts/ui-validation/) imports the
**shipped** modules directly — no copies:

```bash
node scripts/ui-validation/validate-sparkline.mjs     # 30 checks
node scripts/ui-validation/validate-region-tree.mjs   # 31 checks
```

Beyond the two bugs above, the sparkline checks pin SVG y-axis orientation (a
rising series must *descend* in y — getting this backwards silently draws every
trend upside down), padding inset, uniform x spacing, negative values, and custom
dimensions. The tree checks pin every search rule, Bangla names on both levels, and
partially-loaded subtrees.

What these **cannot** cover, and still needs the running app: the vignette, the
tween's feel, the pulse timing, and live click-through against MongoDB + bdapi.

```bash
cd frontend && npm run dev
```

---

## Known limitations (honest edges)

- **Humidity has no sparkline** and won't until the weather fetcher stores a 7-day
  humidity array. This is a data gap, not a layout gap.
- **The nav's national search needs the full upazila fetch.** Type a 2-character
  query on a cold cache and matches outside the open district appear when the
  request lands — a `Loading upazilas…` hint says so rather than showing a
  confidently empty result.
- **The drill path is not clickable.** It reports position; the map's
  "← Back to Districts" button and the nav's "← All districts" do the navigating.
- **Sparklines have no tooltip.** Deliberate at this size — the shape of the week
  is the whole message. Exact daily values are in the `WeatherChart` below.

---

## Change map

| File | Change |
| --- | --- |
| `frontend/src/components/Map/BangladeshMap.jsx` | radial vignette; `animateView` RAF tween + reduced-motion guard; framing moved to a `drilledDistrictId` effect; red-risk pulse class; consumes `ensureUpazilas` / `selectUpazila` |
| `frontend/src/components/Dashboard/LeftNav.jsx` | rewritten as one Division → District → Upazila tree; shared `RegionRow`; search box; lazy national fetch |
| `frontend/src/components/Dashboard/regionTree.js` | **new** — pure tree build + search filter, with self-normalizing query |
| `frontend/src/components/Dashboard/TelemetryPanel.jsx` | 4-card climate grid; hand-drawn `Sparkline` with `useId` gradient ids; `rain7Day` total |
| `frontend/src/components/Dashboard/sparklineGeometry.js` | **new** — pure series → box geometry (gap filtering, flat-series handling) |
| `frontend/src/pages/Dashboard.jsx` | centre column restructured to a flex column; `.panel-head` drill path; right panel header unified |
| `frontend/src/context/AppContext.jsx` | `ensureUpazilas` / `ensureAllUpazilas` with ref-based dedupe; `selectUpazila` explicit multi-state intent |
| `frontend/src/styles/globals.css` | `--scope-district` / `--scope-upazila` tokens; `.panel-head` family; `risk-pulse-red` keyframes + reduced-motion guard |
| `scripts/ui-validation/*` | this doc's regression checks |
