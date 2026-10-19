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
