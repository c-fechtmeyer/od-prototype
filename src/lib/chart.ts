// Small helpers shared by the model-page charts.
import { formatMoney } from "./format";

// Axis label for a price tick: compact, without trailing zeros ($1M, not $1.00M).
export const priceTickLabel = (v: number) => formatMoney(v).replace(/\.0+(?=[kMB])/, "");

// Clean 1-2-5 steps on a log price axis; thinned to 1-3 steps when the range is wide.
export function logPriceTicks(min: number, max: number): number[] {
  const steps = (mults: number[]) => {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
      for (const m of mults) {
        const v = m * 10 ** e;
        if (v >= min && v <= max) out.push(v);
      }
    }
    return out;
  };
  const fine = steps([1, 2, 5]);
  if (fine.length <= 7 && fine.length >= 3) return fine;
  if (fine.length > 7) return steps([1, 3]);
  return steps([1, 1.5, 2, 3, 5, 7]);
}

// Year boundaries for long spans; quarter starts when there's less than ~2 years.
export function timeTicks(t0: number, t1: number, plotW: number): { v: number; label: string }[] {
  const start = new Date(t0);
  const spanYears = (t1 - t0) / (365.25 * 86_400_000);
  const ticks: { v: number; label: string }[] = [];
  if (spanYears >= 2) {
    const every = plotW / spanYears < 48 ? 2 : 1;
    for (let yr = start.getUTCFullYear() + 1; Date.UTC(yr, 0, 1) <= t1; yr++) {
      if ((yr - start.getUTCFullYear() - 1) % every === 0) ticks.push({ v: Date.UTC(yr, 0, 1), label: String(yr) });
    }
  } else {
    const d = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 3) * 3 + 3, 1));
    for (; d.getTime() <= t1; d.setUTCMonth(d.getUTCMonth() + 3)) {
      ticks.push({
        v: d.getTime(),
        label: d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      });
    }
  }
  return ticks;
}

// Round count ticks from 0 (0, 5, 10, ...), about four of them.
export function countTicks(max: number): number[] {
  const raw = Math.max(max, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, ([1, 2, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude);
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  return ticks;
}

export function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (values: number[]) => quantile([...values].sort((a, b) => a - b), 0.5);

const YEAR_MS = 365.25 * 86_400_000;

export type TrendPoint = { t: number; price: number; sparse: boolean };

// A robust LOESS trend through sales over time. At each of `steps` evenly spaced
// times from the first sale to the last, it fits a straight line to log price over
// the nearby sales, weighted by a tricube kernel ±window wide, and takes that line's
// value there. Where fewer than minPoints sales fall inside the window, it widens to
// the nearest minPoints. Inside a gap (no sale within a quarter window), a fit would
// extrapolate from one side, so the trend bridges the gap with a straight line in log
// price instead. Widened and bridged steps are flagged sparse. Two rounds of bisquare
// reweighting take the pull out of outlier sales; their residuals are read off the
// grid, between steps, rather than refit at every sale. Null when there are too few
// sales for a trend.
export function loessTrend(
  sales: { t: number; price: number }[],
  { windowMs, minPoints, steps = 400, iterations = 2 }: { windowMs: number; minPoints: number; steps?: number; iterations?: number },
): TrendPoint[] | null {
  const sorted = [...sales].sort((a, b) => a.t - b.t);
  const n = sorted.length;
  if (n < minPoints) return null;
  const start = sorted[0].t;
  const xs = sorted.map((s) => (s.t - start) / YEAR_MS); // years, for well-scaled sums
  const ys = sorted.map((s) => Math.log10(s.price));
  const span = xs[n - 1];
  if (!(span > 0)) return null;
  const h0 = windowMs / YEAR_MS;
  const robust = new Float64Array(n).fill(1);

  // First index with xs[i] >= v (or > v when `after`).
  const bound = (v: number, after: boolean) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < v || (after && xs[mid] === v)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const fit = (x: number) => {
    let lo = bound(x - h0, false);
    let hi = bound(x + h0, true);
    let h = h0;
    const widened = hi - lo < minPoints;
    if (widened) {
      // Grow toward the nearer neighbor until the window holds minPoints sales.
      while (hi - lo < minPoints) {
        if (hi >= n || (lo > 0 && x - xs[lo - 1] <= xs[hi] - x)) lo--;
        else hi++;
      }
      h = Math.max(x - xs[lo], xs[hi - 1] - x) * 1.001; // so the farthest sale still counts
    }
    let s0 = 0, s1 = 0, s2 = 0, t0 = 0, t1 = 0;
    for (let i = lo; i < hi; i++) {
      const d = xs[i] - x;
      const u = 1 - (Math.abs(d) / h) ** 3;
      const w = u * u * u * robust[i];
      s0 += w;
      s1 += w * d;
      s2 += w * d * d;
      t0 += w * ys[i];
      t1 += w * d * ys[i];
    }
    const det = s0 * s2 - s1 * s1;
    // The local line's value at x; its mean when the sales sit at one time.
    const v = det > 1e-12 ? (s2 * t0 - s1 * t1) / det : t0 / s0;
    return { v, widened };
  };

  const grid = Array.from({ length: steps + 1 }, (_, s) => (span * s) / steps);
  let fits = grid.map(fit);
  for (let it = 0; it < iterations; it++) {
    const residuals = xs.map((x, i) => {
      const g = Math.min(steps - 1, Math.floor((x / span) * steps));
      const f = (x - grid[g]) / (grid[g + 1] - grid[g]);
      return ys[i] - (fits[g].v + f * (fits[g + 1].v - fits[g].v));
    });
    const scale = 6 * (median(residuals.filter(Number.isFinite).map(Math.abs)) ?? 0);
    if (!(scale > 0)) break;
    residuals.forEach((r, i) => {
      const u = 1 - (r / scale) ** 2;
      robust[i] = Math.abs(r) < scale ? u * u : 0;
    });
    fits = grid.map(fit);
  }

  // Bridge each run of gap steps straight across, from the step before it to the step
  // after. The first and last steps sit on sales, so neither is ever in a gap.
  const vs = fits.map((f) => f.v);
  const gap = grid.map((x, s) => {
    if (fits[s].widened) return false;
    const i = bound(x, false);
    return Math.min(i > 0 ? x - xs[i - 1] : Infinity, i < n ? xs[i] - x : Infinity) > h0 / 4;
  });
  for (let s = 1; s < steps; s++) {
    if (!gap[s]) continue;
    let e = s;
    while (gap[e]) e++;
    for (let j = s; j < e; j++) vs[j] = vs[s - 1] + ((vs[e] - vs[s - 1]) * (j - s + 1)) / (e - s + 1);
    s = e;
  }

  const out: TrendPoint[] = [];
  vs.forEach((v, s) => {
    if (Number.isFinite(v)) out.push({ t: start + grid[s] * YEAR_MS, price: 10 ** v, sparse: fits[s].widened || gap[s] });
  });
  return out.length > 1 ? out : null;
}

// The trend's price at time t, between its first and last sale; null outside.
export function trendAt(trend: TrendPoint[], t: number): number | null {
  if (t < trend[0].t || t > trend[trend.length - 1].t) return null;
  const i = Math.max(1, trend.findIndex((p) => p.t >= t));
  const a = trend[i - 1];
  const b = trend[i];
  const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return 10 ** (Math.log10(a.price) + f * (Math.log10(b.price) - Math.log10(a.price)));
}

// Gaussian kernel density estimate of `values`, evaluated at each point of `grid`.
// Bandwidth by Silverman's rule of thumb. Null when there are too few values for a
// meaningful curve.
export function kde(values: number[], grid: number[], minValues = 3): number[] | null {
  const n = values.length;
  if (n < minValues) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  const iqr = (quantile(sorted, 0.75) ?? 0) - (quantile(sorted, 0.25) ?? 0);
  const spread = Math.min(sd, iqr / 1.34) || sd || 0.05;
  const h = Math.max(0.9 * spread * n ** -0.2, 1e-3);
  const norm = 1 / (n * h * Math.sqrt(2 * Math.PI));
  return grid.map((g) => norm * values.reduce((s, v) => s + Math.exp(-0.5 * ((g - v) / h) ** 2), 0));
}
