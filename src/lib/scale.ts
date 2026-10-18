// A shared log scale for sale prices, so every row's range bar sits on the same
// axis: a 911's band lands right of a 3 Series', and a YoY shift reads as a
// proportional move whatever the price level.

export type LogScale = { lo: number; hi: number; ticks: number[] };

// Half-decade steps keep tick labels evenly spaced on a log axis.
const TICK_STEPS = [1e3, 3e3, 1e4, 3e4, 1e5, 3e5, 1e6, 3e6];

export function logScale(values: number[]): LogScale {
  const finite = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!finite.length) return { lo: 1e4, hi: 1e5, ticks: [1e4, 3e4, 1e5] };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  // Pad by ~12% in log space so the end bands don't touch the track edge.
  const pad = (Math.log10(max) - Math.log10(min)) * 0.06 || 0.1;
  const lo = 10 ** (Math.log10(min) - pad);
  const hi = 10 ** (Math.log10(max) + pad);
  return { lo, hi, ticks: TICK_STEPS.filter((t) => t >= lo && t <= hi) };
}

// Position of v on the scale, 0..1 (clamped).
export function scalePos(s: LogScale, v: number): number {
  const t = (Math.log10(v) - Math.log10(s.lo)) / (Math.log10(s.hi) - Math.log10(s.lo));
  return Math.min(1, Math.max(0, t));
}
