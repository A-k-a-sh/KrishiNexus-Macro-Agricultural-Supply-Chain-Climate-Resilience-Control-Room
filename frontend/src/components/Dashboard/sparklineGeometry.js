// Pure geometry for the telemetry sparklines, kept out of the component so it can
// be unit-tested directly (see scripts/ui-validation/) rather than through a
// render. The component owns the SVG; this owns where the points go.

/**
 * Map a numeric series onto a fixed-size box.
 *
 * @param series raw values — may contain nulls, undefined or non-numeric entries
 * @returns null when there is nothing plottable, otherwise { points, xs, ys, isFlat }
 */
export function sparklinePoints(series, width = 96, height = 22, pad = 2) {
  // Drop gaps BEFORE coercing: Open-Meteo returns null for a day it has no value
  // for, and Number(null) is 0 — which would draw a phantom dip to the floor
  // instead of simply skipping the day.
  const points = (series || [])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter((n) => Number.isFinite(n));

  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const isFlat = max === min;

  const stepX = (width - pad * 2) / (points.length - 1);
  // A week with no variation belongs in the middle of the box. Scaling it would
  // pin it to the bottom edge, which reads as "lowest" rather than "unchanged" —
  // the common case for rainfall in a dry week.
  const y = (v) => (isFlat
    ? height / 2
    : height - pad - ((v - min) / (max - min)) * (height - pad * 2));

  return {
    points,
    isFlat,
    xs: points.map((_, i) => pad + i * stepX),
    ys: points.map(y),
  };
}
