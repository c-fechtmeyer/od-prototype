"use client";

import { useMemo, useState } from "react";
import { Delta } from "@/components/delta";
import { RangeBar } from "@/components/range-bar";
import {
  DEFAULT_SORT,
  FamilyLink,
  MetricHeader,
  MetricValue,
  Monogram,
  PAGE_SIZES,
  type PageSize,
  Pagination,
  PriceLegend,
  SearchBox,
  Segmented,
  type Sort,
  SortButton,
  SortChip,
  familyHref,
  matchesQuery,
  nextSort,
  paginate,
  sortRows,
  useRowClick,
} from "@/components/table-parts";
import { INSUFFICIENT } from "@/lib/format";
import type { Market, WindowKey } from "@/lib/markets";
import { METRICS, type Metric } from "@/lib/metrics";
import type { LogScale } from "@/lib/scale";

const WINDOWS = {
  "365D": { cur: "c365", prior: "p365", long: "Last 365 days" },
  "180D": { cur: "c180", prior: "p180", long: "Last 180 days" },
} as const satisfies Record<string, { cur: WindowKey; prior: WindowKey; long: string }>;
type WindowLabel = keyof typeof WINDOWS;

// The Markets tab: every family, one compact line each, for one window at a time.
export function MarketsList({ markets, scale }: { markets: Market[]; scale: LogScale }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [windowLabel, setWindowLabel] = useState<WindowLabel>("365D");
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const win = WINDOWS[windowLabel];
  const onRowClick = useRowClick();

  const rows = useMemo(() => {
    const metric = sort.key === "rank" ? null : METRICS[sort.key];
    return sortRows(
      markets.filter((m) => matchesQuery(m, query)),
      sort,
      (m) => metric?.sortValue(m.windows[win.cur]) ?? null,
    );
  }, [markets, query, sort, win]);

  const { pageCount, current, first, visible } = paginate(rows, page, pageSize);

  // Any change to what's listed, or how, starts back at page 1.
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(0);
    };
  const onSort = (key: Sort["key"]) => {
    setSort((s) => nextSort(s, key));
    setPage(0);
  };

  return (
    <section aria-label="All markets">
      {/* Toolbar. Room is left here for the filters to come. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={reset(setQuery)} />
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-xs font-medium text-muted">Data window</span>
          <Segmented
            label="Data window"
            options={Object.keys(WINDOWS) as WindowLabel[]}
            value={windowLabel}
            onChange={reset(setWindowLabel)}
            describedBy="window-help"
          />
          <span id="window-help" className="text-xs text-faint">
            Changes the displayed data only, not the ranking.
          </span>
        </div>
        {sort.key !== "rank" && (
          <SortChip
            label={`${METRICS[sort.key].label} (${windowLabel})`}
            onReset={() => reset(setSort)(DEFAULT_SORT)}
          />
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/80">
        <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th scope="col" className="w-16 border-b border-line py-3 pl-5 align-bottom font-medium">
                <SortButton active={sort.key === "rank"} dir={sort.dir} onClick={() => onSort("rank")}>
                  #
                </SortButton>
              </th>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b border-line bg-surface py-3 pr-4 align-bottom font-medium sm:static sm:bg-transparent"
              >
                Model Family
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
            {visible.map((m, i) => {
              const cur = m.windows[win.cur];
              const prior = m.windows[win.prior];
              const bg = i % 2 === 1 ? "bg-surface-2" : "bg-surface";
              const cell = `border-b border-line/60 py-2.5 align-middle ${bg} group-hover:bg-surface-3`;
              return (
                <tr key={m.familyId} className="group cursor-pointer" onClick={onRowClick(familyHref(m))}>
                  <td className={`${cell} pl-5 text-[13px] text-faint tabular-nums`}>{m.rank}</td>
                  <th scope="row" className={`${cell} sticky left-0 z-10 pr-4 text-left font-normal sm:static`}>
                    <div className="flex items-center gap-2.5 whitespace-nowrap">
                      <Monogram make={m.makeName} size="sm" />
                      <FamilyLink href={familyHref(m)}>{m.familyName}</FamilyLink>
                      <span className="text-[13px] text-muted">{m.makeName}</span>
                      {m.generations.length > 0 && (
                        <span className="text-xs text-faint" title={m.generations.join(", ")}>
                          · {m.generations.length} gen{m.generations.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </th>
                  <td className={cell}>
                    <MetricCell metric={METRICS.auctions} cur={cur} prior={prior} long={win.long} width={52} />
                  </td>
                  <td className={cell}>
                    <MetricCell metric={METRICS.volume} cur={cur} prior={prior} long={win.long} width={72} />
                  </td>
                  <td className={cell}>
                    {cur.p25 == null ? (
                      <MetricValue text={INSUFFICIENT} width={92} />
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="w-[92px] font-medium text-fg tabular-nums">{METRICS.price.format(cur)}</span>
                        <RangeBar scale={scale} current={cur} prior={prior} label={win.long} />
                        <Delta value={METRICS.price.delta(cur, prior)} className="text-xs" />
                      </div>
                    )}
                  </td>
                  <td className={`${cell} pr-5`}>
                    <MetricCell metric={METRICS.noReserve} cur={cur} prior={prior} long={win.long} width={52} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-6 py-14 text-center text-sm text-muted">No markets match “{query}”.</p>
        )}
      </div>

      <Pagination
        noun="markets"
        total={rows.length}
        first={first}
        shown={visible.length}
        current={current}
        pageCount={pageCount}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={reset(setPageSize)}
      />
    </section>
  );
}

// One window's value and its YoY change. When the value itself can't be computed,
// a single "Insufficient Data" stands in for both.
function MetricCell({
  metric,
  cur,
  prior,
  long,
  width,
}: {
  metric: Metric;
  cur: Market["windows"][WindowKey];
  prior: Market["windows"][WindowKey];
  long: string;
  width: number;
}) {
  const text = metric.format(cur);
  if (text === INSUFFICIENT) return <MetricValue text={text} width={width} />;
  const extra = metric.key === "noReserve" ? ` (${cur.noReserveAuctions} of ${cur.auctions} auctions)` : "";
  return (
    <div className="flex items-center gap-3" title={`${long}: ${text}${extra}\nYear earlier: ${metric.format(prior)}`}>
      <MetricValue text={text} width={width} />
      <Delta value={metric.delta(cur, prior)} kind={metric.deltaKind} className="text-xs" />
    </div>
  );
}
