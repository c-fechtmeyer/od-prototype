import { Delta } from "@/components/delta";
import { formatCount, pctChange } from "@/lib/format";
import type { MarketSummary, SummaryStats } from "@/lib/markets";
import { METRICS } from "@/lib/metrics";

type Tile = {
  key: string;
  label: string;
  help: string;
  format: (s: SummaryStats) => string;
  delta: (cur: SummaryStats, prior: SummaryStats) => number | null;
  deltaKind: "pct" | "pp";
};

const TILES: Tile[] = [
  METRICS.auctions,
  METRICS.volume,
  METRICS.price,
  {
    key: "active",
    label: "Active Markets",
    help: "Model families with at least one auction in the window.",
    format: (s) => formatCount(s.activeMarkets),
    delta: (c, p) => pctChange(c.activeMarkets, p.activeMarkets),
    deltaKind: "pct",
  },
];

// All of Cars & Bids, for context on the family rows below.
export function SummaryTiles({ summary }: { summary: MarketSummary }) {
  const { c365, p365, c180, p180 } = summary.windows;
  return (
    <section aria-label="All Cars & Bids auctions" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TILES.map((m) => (
        <div key={m.key} className="rounded-xl border border-line bg-surface/80 px-4 py-3.5" title={m.help}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted">
            {m.label}
            <span className="hidden text-[10px] tracking-wide whitespace-nowrap text-faint sm:inline">365D · YoY</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="text-[22px] font-semibold tracking-tight whitespace-nowrap sm:text-[26px]">{m.format(c365)}</span>
            <Delta value={m.delta(c365, p365)} kind={m.deltaKind} className="text-sm font-medium" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs whitespace-nowrap text-muted">
            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-faint">
              180D
            </span>
            <span className="tabular-nums">{m.format(c180)}</span>
            <Delta value={m.delta(c180, p180)} kind={m.deltaKind} />
          </div>
        </div>
      ))}
    </section>
  );
}
