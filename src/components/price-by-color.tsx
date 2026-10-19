import { Delta } from "@/components/delta";
import { isSold, resultPrice } from "@/lib/auction";
import { median } from "@/lib/chart";
import { COLOR_SWATCH, type ColorFamily, colorFamily } from "@/lib/colors";
import type { FamilyAuction } from "@/lib/family";
import { formatCount, formatMoney } from "@/lib/format";

const MIN_SALES = 5; // fewer sales than this and a color's median is too noisy to show
const MIN_TOTAL = 10;

type Row = { family: ColorFamily; n: number; median: number; diff: number };

// Median sale price for each exterior color family over the last 365 days, against
// the median of all sales in the same period. Bars diverge from that overall median.
export function PriceByColor({ auctions }: { auctions: FamilyAuction[] }) {
  const sales = auctions
    .filter((a) => a.yearWindow === 0 && isSold(a))
    .map((a) => ({ family: colorFamily(a.exteriorColor), price: resultPrice(a).price ?? 0 }))
    .filter((s) => s.price > 0);
  const overall = median(sales.map((s) => s.price));

  const groups = new Map<ColorFamily, number[]>();
  for (const s of sales) groups.set(s.family, [...(groups.get(s.family) ?? []), s.price]);

  const rows: Row[] = [];
  let hidden = 0;
  for (const [family, prices] of groups) {
    const m = median(prices);
    if (prices.length < MIN_SALES || m == null || overall == null) {
      hidden += prices.length;
      continue;
    }
    rows.push({ family, n: prices.length, median: m, diff: (m - overall) / overall });
  }
  rows.sort((a, b) => b.diff - a.diff);
  const maxAbs = Math.max(0.1, ...rows.map((r) => Math.abs(r.diff)));

  return (
    <section aria-labelledby="price-by-color-title" className="h-full rounded-2xl border border-line bg-surface/80 p-4 sm:p-5">
      <h2 id="price-by-color-title" className="text-base font-semibold">
        Price by Color
      </h2>
      <p className="mt-1 text-xs text-muted">
        Median sale price by exterior color vs. the median of all sales
        {overall != null && sales.length >= MIN_TOTAL && (
          <span className="font-medium text-fg"> ({formatMoney(overall)})</span>
        )}
        , last 365 days.
      </p>

      {sales.length < MIN_TOTAL || rows.length === 0 ? (
        <p className="grid h-[260px] place-items-center text-sm text-faint">
          Insufficient Data: too few sales in the last 365 days.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-[auto_minmax(48px,1fr)_auto] items-center gap-x-3 text-[11px] text-faint">
            <span>Color</span>
            <span className="text-center">vs. all sales</span>
            <span className="w-[112px] text-right">Median</span>
          </div>
          <ul className="mt-1.5 divide-y divide-line/60">
            {rows.map((r) => {
              const pct = (Math.abs(r.diff) / maxAbs) * 50;
              return (
                <li
                  key={r.family}
                  className="grid grid-cols-[auto_minmax(48px,1fr)_auto] items-center gap-x-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-line-strong"
                      style={{ backgroundColor: COLOR_SWATCH[r.family] }}
                      aria-hidden="true"
                    />
                    <span className="text-fg">{r.family}</span>
                    <span className="text-xs text-faint tabular-nums">{formatCount(r.n)}</span>
                  </span>
                  {/* Diverging bar: right of the center line is above the overall median. */}
                  <span className="relative h-2.5" aria-hidden="true">
                    <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
                    <span
                      className={`absolute inset-y-0 ${r.diff >= 0 ? "left-1/2 rounded-r-[2px] bg-up/70" : "right-1/2 rounded-l-[2px] bg-down/70"}`}
                      style={{ width: `${pct.toFixed(2)}%` }}
                    />
                  </span>
                  <span className="flex w-[112px] items-baseline justify-end gap-2 tabular-nums">
                    <span className="font-medium text-fg">{formatMoney(r.median)}</span>
                    <Delta value={r.diff} className="w-[52px] justify-end text-xs" />
                  </span>
                </li>
              );
            })}
          </ul>
          {hidden > 0 && (
            <p className="mt-3 text-xs text-faint">
              {formatCount(hidden)} sale{hidden === 1 ? "" : "s"} in colors with fewer than {MIN_SALES} sales not shown.
            </p>
          )}
        </>
      )}
    </section>
  );
}
