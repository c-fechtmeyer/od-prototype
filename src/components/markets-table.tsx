"use client";

import { useMemo, useState } from "react";
import { Delta } from "@/components/delta";
import { RangeBar } from "@/components/range-bar";
import {
  DEFAULT_SORT,
  MetricHeader,
  Monogram,
  PriceLegend,
  SearchBox,
  type Sort,
  SortButton,
  SortChip,
  matchesQuery,
  nextSort,
  sortRows,
} from "@/components/table-parts";
import type { Market, WindowKey } from "@/lib/markets";
import { METRICS, type Metric } from "@/lib/metrics";
import type { LogScale } from "@/lib/scale";

const ROWS: { cur: WindowKey; prior: WindowKey; label: string; long: string }[] = [
  { cur: "c365", prior: "p365", label: "365D", long: "Last 365 days" },
  { cur: "c180", prior: "p180", label: "180D", long: "Last 180 days" },
];

// The Home table: a few families, each row stacking the 365D and 180D windows.
export function MarketsTable({ markets, scale }: { markets: Market[]; scale: LogScale }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  const rows = useMemo(() => {
    const metric = sort.key === "rank" ? null : METRICS[sort.key];
    return sortRows(
      markets.filter((m) => matchesQuery(m, query)),
      sort,
      (m) => metric?.sortValue(m.windows.c365) ?? null,
    );
  }, [markets, query, sort]);

  const onSort = (key: Sort["key"]) => setSort((s) => nextSort(s, key));

  return (
    <section aria-label="Markets" className="mt-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} />
        {sort.key !== "rank" && (
          <SortChip label={`${METRICS[sort.key].label} (365D)`} onReset={() => setSort(DEFAULT_SORT)} />
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/80">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th scope="col" className="w-14 border-b border-line py-3 pl-5 font-medium">
                <SortButton active={sort.key === "rank"} dir={sort.dir} onClick={() => onSort("rank")}>
                  #
                </SortButton>
              </th>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b border-line bg-surface py-3 pr-4 font-medium sm:static sm:bg-transparent"
              >
                Model Family
              </th>
              <th scope="col" className="w-16 border-b border-line py-3 font-medium">
                Window
              </th>
              <MetricHeader metric={METRICS.auctions} sort={sort} onSort={onSort} />
              <MetricHeader metric={METRICS.volume} sort={sort} onSort={onSort} />
              <MetricHeader metric={METRICS.price} sort={sort} onSort={onSort}>
                <PriceLegend scale={scale} />
              </MetricHeader>
              <MetricHeader metric={METRICS.noReserve} sort={sort} onSort={onSort} className="pr-5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <MarketRow key={m.familyId} market={m} scale={scale} striped={i % 2 === 1} />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-6 py-14 text-center text-sm text-muted">No markets match “{query}”.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-faint">
        YoY compares each window with the same span a year earlier. Hover a value for its definition and year-ago
        figure.
      </p>
    </section>
  );
}

function MarketRow({ market: m, scale, striped }: { market: Market; scale: LogScale; striped: boolean }) {
  const bg = striped ? "bg-surface-2" : "bg-surface";
  const cell = `border-b border-line/60 py-3 align-middle ${bg} group-hover:bg-surface-3`;

  return (
    <tr className="group">
      <td className={`${cell} pl-5 text-[13px] text-faint tabular-nums`}>{m.rank}</td>
      <th scope="row" className={`${cell} sticky left-0 z-10 pr-4 text-left font-normal sm:static`}>
        <div className="flex items-center gap-3">
          <Monogram make={m.makeName} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-[15px] font-semibold text-fg">{m.familyName}</span>
              <span className="text-[13px] text-muted">{m.makeName}</span>
            </div>
            {m.generations.length > 0 && (
              <div className="mt-0.5 text-xs whitespace-nowrap text-faint" title={m.generations.join(", ")}>
                {m.generations.length} generation{m.generations.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      </th>
      <td className={cell}>
        <Stack>
          {ROWS.map((r) => (
            <span
              key={r.label}
              title={r.long}
              className="w-fit rounded bg-surface-3 px-1.5 py-0.5 text-[10px] leading-none font-medium tracking-wide text-faint"
            >
              {r.label}
            </span>
          ))}
        </Stack>
      </td>
      {(["auctions", "volume"] as const).map((key) => (
        <td key={key} className={cell}>
          <Stack>
            {ROWS.map((r) => (
              <ValueLine key={r.label} metric={METRICS[key]} market={m} row={r} valueWidth={key === "volume" ? 72 : 56} />
            ))}
          </Stack>
        </td>
      ))}
      <td className={cell}>
        <Stack>
          {ROWS.map((r) => {
            const cur = m.windows[r.cur];
            const prior = m.windows[r.prior];
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-[92px] font-medium text-fg tabular-nums">{METRICS.price.format(cur)}</span>
                <RangeBar scale={scale} current={cur} prior={prior} label={r.long} />
                <Delta value={METRICS.price.delta(cur, prior)} className="w-16 text-xs" />
              </div>
            );
          })}
        </Stack>
      </td>
      <td className={`${cell} pr-5`}>
        <Stack>
          {ROWS.map((r) => (
            <ValueLine key={r.label} metric={METRICS.noReserve} market={m} row={r} valueWidth={52} />
          ))}
        </Stack>
      </td>
    </tr>
  );
}

function ValueLine({
  metric,
  market,
  row,
  valueWidth,
}: {
  metric: Metric;
  market: Market;
  row: (typeof ROWS)[number];
  valueWidth: number;
}) {
  const cur = market.windows[row.cur];
  const prior = market.windows[row.prior];
  const extra =
    metric.key === "noReserve" ? ` (${cur.noReserveAuctions} of ${cur.auctions} auctions)` : "";
  return (
    <div
      className="flex items-center gap-3"
      title={`${row.long}: ${metric.format(cur)}${extra}\nYear earlier: ${metric.format(prior)}`}
    >
      <span className="font-medium text-fg tabular-nums" style={{ width: valueWidth }}>
        {metric.format(cur)}
      </span>
      <Delta value={metric.delta(cur, prior)} kind={metric.deltaKind} className="text-xs" />
    </div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="grid auto-rows-[24px] items-center gap-1">{children}</div>;
}
