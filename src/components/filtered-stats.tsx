import { Delta } from "@/components/delta";
import { isSold } from "@/lib/auction";
import { quantile } from "@/lib/chart";
import type { FamilyAuction } from "@/lib/family";
import { INSUFFICIENT, formatCount, formatMoney, formatRange } from "@/lib/format";
import type { WindowStats } from "@/lib/markets";
import { METRICS } from "@/lib/metrics";

// The same window stats the KPI tiles use, computed in the browser from a set of
// auctions, so they can follow the scatter's filters. Definitions match the SQL:
// auctions include canceled ones, prices come from sold auctions with a published
// sale price, and sell-through leaves canceled auctions out.
export function windowStats(auctions: FamilyAuction[]): WindowStats {
  const sold = auctions.filter(isSold);
  const prices = sold
    .map((a) => a.saleAmount)
    .filter((p) => p != null)
    .sort((a, b) => a - b);
  return {
    auctions: auctions.length,
    volume: prices.reduce((s, p) => s + p, 0),
    p25: quantile(prices, 0.25),
    p50: quantile(prices, 0.5),
    p75: quantile(prices, 0.75),
    noReserveAuctions: auctions.filter((a) => a.noReserve).length,
    soldAuctions: sold.length,
    completedAuctions: auctions.filter((a) => a.status !== "canceled").length,
  };
}

// A cut of the data under the scatter: last 365 days against the 365 before, for
// whatever the filters currently select.
export function FilteredStats({ auctions, filtered }: { auctions: FamilyAuction[]; filtered: boolean }) {
  const cur = windowStats(auctions.filter((a) => a.yearWindow === 0));
  const prior = windowStats(auctions.filter((a) => a.yearWindow === 1));

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
        <span className="font-medium text-muted">
          {filtered ? "Selected auctions" : "All auctions"} · last 365 days
        </span>
        <span className="text-faint">YoY compares with the same filters over the year before</span>
      </div>

      {/* Phones: the three single numbers share a row and Sale Prices follows. From lg up: one row,
          in reading order. */}
      <dl className="grid grid-cols-3 gap-x-4 gap-y-4 lg:grid-cols-[1fr_1.6fr_1fr_1fr] lg:gap-x-6 lg:divide-x lg:divide-line">
        <Stat
          label="Auctions"
          value={METRICS.auctions.format(cur)}
          delta={METRICS.auctions.delta(cur, prior)}
          before={METRICS.auctions.format(prior)}
        />
        <div className="order-last col-span-3 lg:order-none lg:col-span-1 lg:pl-6">
          <dt className="text-xs text-muted">Sale Prices</dt>
          <dd className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
            <span>
              <span className="block text-[11px] text-faint">Median</span>
              <Value text={cur.p50 == null ? INSUFFICIENT : formatMoney(cur.p50)}>
                <Delta value={METRICS.price.delta(cur, prior)} className="text-xs" />
              </Value>
              <span className="block text-[11px] text-faint tabular-nums">
                Yr earlier {prior.p50 == null ? INSUFFICIENT : formatMoney(prior.p50)}
              </span>
            </span>
            <span>
              <span className="block text-[11px] text-faint">25th–75th percentile</span>
              <Value text={formatRange(cur.p25, cur.p75)} />
              <span className="block text-[11px] text-faint tabular-nums">
                Yr earlier {formatRange(prior.p25, prior.p75)}
              </span>
            </span>
          </dd>
        </div>
        <Stat
          label="No Reserve %"
          value={METRICS.noReserve.format(cur)}
          delta={METRICS.noReserve.delta(cur, prior)}
          kind="pp"
          before={METRICS.noReserve.format(prior)}
        />
        <Stat
          label="Sell Through Rate"
          value={METRICS.sellThrough.format(cur)}
          delta={METRICS.sellThrough.delta(cur, prior)}
          kind="pp"
          before={METRICS.sellThrough.format(prior)}
          note={`${formatCount(cur.soldAuctions)} of ${formatCount(cur.completedAuctions)} sold`}
        />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  kind = "pct",
  before,
  note,
}: {
  label: string;
  value: string;
  delta: number | null;
  kind?: "pct" | "pp";
  before: string;
  note?: string;
}) {
  return (
    <div className="lg:pl-6 lg:first:pl-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1">
        <span className="block text-[11px] text-faint">{note ?? " "}</span>
        <Value text={value}>
          <Delta value={delta} kind={kind} className="text-xs" />
        </Value>
        <span className="block text-[11px] text-faint tabular-nums">Yr earlier {before}</span>
      </dd>
    </div>
  );
}

// A stat's headline number, or quiet "Insufficient Data" when it can't be computed.
function Value({ text, children }: { text: string; children?: React.ReactNode }) {
  if (text === INSUFFICIENT) return <span className="block py-0.5 text-sm text-faint">{text}</span>;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-lg font-semibold tracking-tight tabular-nums">{text}</span>
      {children}
    </span>
  );
}
