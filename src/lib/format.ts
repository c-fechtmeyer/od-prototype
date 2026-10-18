// Pure display helpers, shared by server and client components.

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

// $22.8M, $4.30M, $59k, $7k
export function formatMoney(n: number | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e8) return `$${Math.round(n / 1e6)}M`;
  if (abs >= 1e7) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${Number((n / 1e3).toFixed(abs >= 1e4 ? 0 : 1))}k`;
  return `$${Math.round(n)}`;
}

export function formatRange(lo: number | null, hi: number | null): string {
  if (lo == null || hi == null) return "—";
  return `${formatMoney(lo)}–${formatMoney(hi).slice(1)}`;
}

export function formatPct(r: number | null, digits = 1): string {
  return r == null ? "—" : `${(r * 100).toFixed(digits)}%`;
}

// Relative change, cur vs prior; null when there's no prior base to compare to.
export function pctChange(cur: number | null, prior: number | null): number | null {
  if (cur == null || prior == null || prior === 0) return null;
  return (cur - prior) / prior;
}

export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
