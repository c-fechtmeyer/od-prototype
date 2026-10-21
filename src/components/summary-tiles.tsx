import { Delta } from "@/components/delta";
import { InfoTip } from "@/components/info-tip";
import { INSUFFICIENT, formatCount, pctChange } from "@/lib/format";
import type { MarketSummary, SummaryStats, WindowKey, WindowStats } from "@/lib/markets";
import { METRICS } from "@/lib/metrics";

type Tile<S extends WindowStats> = {
  key: string;
  label: string;
  definition: string;
  format: (s: S) => string;
  delta: (cur: S, prior: S) => number | null;
  deltaKind: "pct" | "pp";
  context?: string; // right of the 365D value, e.g. "of 48 tracked"
  badge?: string; // a pill at the end of the 180D line, e.g. "+3 new"
};

const PRICE_DEFINITION =
  "The middle 50% of sale prices: 25th to 75th percentile of sold auctions, reserve and no-reserve. YoY is the change in the median sale price.";

const ACTIVE_MARKETS: Omit<Tile<SummaryStats>, "definition"> = {
  key: "active",
  label: "Active Markets",
  format: (s) => formatCount(s.activeMarkets),
  delta: (c, p) => pctChange(c.activeMarkets, p.activeMarkets),
  deltaKind: "pct",
};

// Home: every Cars & Bids auction, not just the families in the table.
const SUMMARY_TILES: Tile<SummaryStats>[] = [
  { ...METRICS.auctions, definition: "Every Cars & Bids listing that ended in the window, including canceled auctions." },
  { ...METRICS.volume, definition: "Total sale amount of auctions that sold in the window, including sold-after deals." },
  { ...METRICS.price, definition: PRICE_DEFINITION },
  { ...ACTIVE_MARKETS, definition: "Model families with at least one auction that ended in the window." },
];

// Make page: the Home tiles, scoped to one make. Active Markets also carries how many
// of the make's families are tracked at all (`tracked`) and how many of those are new.
export function makeTiles(tracked: number, added: number): Tile<SummaryStats>[] {
  return [
    { ...METRICS.auctions, definition: "Every listing of this make that ended in the window, including canceled auctions." },
    { ...METRICS.volume, definition: "Total sale amount of this make's auctions that sold in the window, including sold-after deals." },
    { ...METRICS.price, definition: PRICE_DEFINITION },
    {
      ...ACTIVE_MARKETS,
      definition: `This make's model families with at least one auction that ended in the window, out of the ${formatCount(tracked)} with any observed auction on Cars & Bids. New models are families whose first observed auction ended in the last 365 days.`,
      context: `of ${formatCount(tracked)} tracked`,
      badge: added > 0 ? `+${formatCount(added)} new` : undefined,
    },
  ];
}

// Model page: the same first three tiles, scoped to one family, plus sell-through.
export const FAMILY_TILES: Tile<WindowStats>[] = [
  { ...METRICS.auctions, definition: "Every listing of this model that ended in the window, including canceled auctions." },
  { ...METRICS.volume, definition: "Total sale amount of this model's auctions that sold in the window, including sold-after deals." },
  { ...METRICS.price, definition: PRICE_DEFINITION },
  {
    ...METRICS.sellThrough,
    definition:
      "Share of auctions that sold, including sold-after deals, out of all auctions that ran to the end (canceled auctions excluded). YoY is in percentage points.",
  },
];

export function SummaryTiles({ summary }: { summary: MarketSummary }) {
  return <KpiTiles label="All Cars & Bids auctions" tiles={SUMMARY_TILES} windows={summary.windows} />;
}

export function KpiTiles<S extends WindowStats>({
  label,
  tiles,
  windows,
}: {
  label: string;
  tiles: Tile<S>[];
  windows: Record<WindowKey, S>;
}) {
  const { c365, p365, c180, p180 } = windows;
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((m) => {
        const value = m.format(c365);
        return (
          <div key={m.key} className="relative rounded-xl border border-line bg-surface/80 px-4 py-3.5">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted">
              {/* The icon is glued to the label's last word, so a wrapped label never leaves it alone on a line. */}
              <span>
                {m.label.slice(0, m.label.lastIndexOf(" ") + 1)}
                <span className="whitespace-nowrap">
                  {m.label.slice(m.label.lastIndexOf(" ") + 1)}
                  <InfoTip id={`tile-def-${m.key}`} label={m.label} className="ml-1.5 align-[-3px]">
                    {m.definition}
                    <span className="mt-1.5 block text-faint">
                      365D and 180D are the last 365 and 180 days. YoY compares each with the same span a year earlier.
                    </span>
                  </InfoTip>
                </span>
              </span>
              <span className="hidden text-[10px] tracking-wide whitespace-nowrap text-faint sm:inline">365D · YoY</span>
            </div>
            <div className="flex min-h-[34px] flex-wrap items-baseline gap-x-2.5">
              {value === INSUFFICIENT ? (
                <span className="self-center text-sm text-faint">{value}</span>
              ) : (
                <>
                  <span className="text-[22px] font-semibold tracking-tight whitespace-nowrap sm:text-[26px]">{value}</span>
                  <Delta value={m.delta(c365, p365)} kind={m.deltaKind} className="text-sm font-medium" />
                </>
              )}
              {m.context && <span className="ml-auto text-xs whitespace-nowrap text-muted tabular-nums">{m.context}</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs whitespace-nowrap text-muted">
              <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-faint">
                180D
              </span>
              {m.format(c180) === INSUFFICIENT ? (
                <span className="text-faint">{INSUFFICIENT}</span>
              ) : (
                <>
                  <span className="tabular-nums">{m.format(c180)}</span>
                  <Delta value={m.delta(c180, p180)} kind={m.deltaKind} />
                </>
              )}
              {m.badge && (
                <span className="ml-auto rounded bg-forest-900 px-1.5 py-0.5 font-medium text-forest-300 tabular-nums">
                  {m.badge}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
