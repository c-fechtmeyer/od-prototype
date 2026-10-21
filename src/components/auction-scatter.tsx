"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FilteredStats } from "@/components/filtered-stats";
import { InfoTip } from "@/components/info-tip";
import {
  EMPTY_FILTERS,
  type Filters,
  ScatterFilters,
  buildOptions,
  isFiltered,
  matches,
} from "@/components/scatter-filters";
import { Segmented } from "@/components/table-parts";
import { auctionUrl, isSold, resultPrice } from "@/lib/auction";
import { type TrendPoint, logPriceTicks, loessTrend, priceTickLabel, timeTicks, trendAt } from "@/lib/chart";
import type { FamilyAuction } from "@/lib/family";
import { formatCount, formatDate, formatDollars, formatMoney } from "@/lib/format";

const HEIGHT = 380;
const MARGIN = { top: 12, right: 16, bottom: 30, left: 56 };
const R = 4; // >= 8px markers
const HIT = 14; // hover radius, larger than the mark
// How far above or below a trend line still counts as on it: about its casing, wider for a finger.
const LINE_HIT = 5;
const LINE_HIT_TOUCH = 12;
// Partly transparent, so clusters build up darker where auctions overlap.
const SOLD_OPACITY = 0.6;
const UNSOLD_OPACITY = 0.55;
// Auctions outside the filters stay on the chart, barely visible, and don't respond to hover.
const FILTERED_OUT_OPACITY = 0.08;
// Calendar years alternate between a faint wash and none.
const YEAR_BAND_OPACITY = 0.03;
const DAY = 86_400_000;
// Trend lines: a ±6-month window, widened to the nearest 30 sales where sales are sparse.
const TREND = { windowMs: 182 * DAY, minPoints: 30 };

// Date ranges, in years back from when the data was loaded (null: all time).
const RANGE_YEARS = { "All Time": null, "5 Years": 5, "3 Years": 3, "1 Year": 1 } as const;
type Range = keyof typeof RANGE_YEARS;
const RANGES = Object.keys(RANGE_YEARS) as Range[];

function rangeStart(range: Range, asOf: number): number {
  const years = RANGE_YEARS[range];
  if (years == null) return -Infinity;
  const d = new Date(asOf);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.getTime();
}

type Point = { a: FamilyAuction; t: number; price: number; sold: boolean; isHighBid: boolean };
// What's under the pointer: an auction's dot, or a trend line at a month start.
type Hover = { kind: "dot"; i: number } | { kind: "month"; t: number } | null;

// One dot per auction: when it ended (x) against its result price (y, log scale).
// Sold auctions are solid; reserve-not-met auctions are light rings. Canceled
// auctions have no result, so they're counted in the legend but not plotted. The
// filters above the plot fade out the auctions they exclude; the date range below
// them sets the time axis, and only auctions inside it are plotted or counted. Trend
// lines follow sold prices for all sales and, once a filter is set, for the selection.
export function AuctionScatter({ auctions, asOf }: { auctions: FamilyAuction[]; asOf: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<Hover>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [range, setRange] = useState<Range>("3 Years");
  const since = rangeStart(range, asOf);
  const clipId = `plot-${useId().replace(/[^\w-]/g, "")}`;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Every auction with a result to plot, over all time. The filter options come from
  // these, so they stay put when the date range changes.
  const plottable = useMemo(() => {
    const out: Point[] = [];
    for (const a of auctions) {
      if (a.status === "canceled") continue;
      const { price, isHighBid } = resultPrice(a);
      if (price == null || price <= 0) continue;
      out.push({ a, t: a.ended, price, sold: isSold(a), isHighBid });
    }
    return out;
  }, [auctions]);
  const points = useMemo(() => plottable.filter((p) => p.t >= since), [plottable, since]);
  const canceled = useMemo(
    () => auctions.filter((a) => a.status === "canceled" && a.ended >= since).length,
    [auctions, since],
  );

  const options = useMemo(() => buildOptions(plottable.map((p) => p.a)), [plottable]);

  // Trends run over every sold auction in the history, so the date range only windows
  // them and never changes their shape.
  const sales = useMemo(() => plottable.filter((p) => p.sold), [plottable]);
  const trend = useMemo(() => loessTrend(sales, TREND), [sales]);
  const filtered = isFiltered(filters);
  const selectedTrend = useMemo(
    () => (filtered ? loessTrend(sales.filter((p) => matches(p.a, filters)), TREND) : null),
    [sales, filters, filtered],
  );
  // Every auction the filters select, canceled ones included, for the stats under the chart.
  const selected = useMemo(() => auctions.filter((a) => matches(a, filters)), [auctions, filters]);
  const inFilter = useMemo(() => points.map((p) => matches(p.a, filters)), [points, filters]);
  const shown = inFilter.filter(Boolean).length;
  const sold = points.filter((p, i) => p.sold && inFilter[i]).length;
  const unsold = shown - sold;

  const chart = useMemo(
    () => (width > 0 && points.length ? layout(points, width, since, asOf) : null),
    [points, width, since, asOf],
  );
  const trendLines = useMemo(
    () =>
      chart && {
        all: trend && trendSegments(trend, chart),
        selected: selectedTrend && trendSegments(selectedTrend, chart),
      },
    [chart, trend, selectedTrend],
  );

  // The dot layer changes with the data, width or filters, not on every hover.
  // Filtered-out dots draw first, so the ones in view always sit on top.
  const dots = useMemo(() => {
    if (!chart) return null;
    const rank = (i: number) => (inFilter[i] ? 2 : 0) + (points[i].sold ? 1 : 0);
    const order = chart.xy.map((_, i) => i).sort((i, j) => rank(i) - rank(j));
    return order.map((i) => {
      const [x, y] = chart.xy[i];
      const out = !inFilter[i];
      return points[i].sold ? (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={R}
          className="fill-chart-sold"
          fillOpacity={out ? FILTERED_OUT_OPACITY : SOLD_OPACITY}
        />
      ) : (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={R - 0.5}
          className="fill-none stroke-chart-unsold"
          strokeWidth={1.5}
          strokeOpacity={out ? FILTERED_OUT_OPACITY : UNSOLD_OPACITY}
        />
      );
    });
  }, [chart, points, inFilter]);

  const nearest = (mx: number, my: number) => {
    if (!chart) return null;
    let best: number | null = null;
    let bestD = HIT * HIT;
    chart.xy.forEach(([x, y], i) => {
      if (!inFilter[i]) return; // filtered-out auctions don't respond to hover or click
      const d = (x - mx) ** 2 + (y - my) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  // On a trend line, the month start nearest the pointer that the trend covers.
  const trendMonth = (mx: number, my: number, reach: number) => {
    if (!chart || mx < MARGIN.left || mx > width - MARGIN.right) return null;
    const s = chart.scales;
    const lines = [trend, selectedTrend].filter((l) => l != null);
    const t = s.time(mx);
    const onLine = lines.some((l) => {
      const v = trendAt(l, t);
      return v != null && Math.abs(s.y(v) - my) <= reach;
    });
    if (!onLine) return null;
    const d = new Date(t);
    const months = [Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)];
    months.sort((a, b) => Math.abs(a - t) - Math.abs(b - t));
    return months.find((m) => m >= s.t0 && m <= s.t1 && lines.some((l) => trendAt(l, m) != null)) ?? null;
  };

  // The trend lines run through the thick of the dots, so on a line (a narrow band) the
  // line wins, and off it the nearest dot in reach.
  const hitTest = (mx: number, my: number, touch: boolean): Hover => {
    const month = trendMonth(mx, my, touch ? LINE_HIT_TOUCH : LINE_HIT);
    if (month != null) return { kind: "month", t: month };
    const i = nearest(mx, my);
    return i == null ? null : { kind: "dot", i };
  };

  const local = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, (e.nativeEvent as PointerEvent).pointerType === "touch"] as const;
  };

  const hovered =
    hover?.kind === "dot" && chart && inFilter[hover.i] ? { p: points[hover.i], xy: chart.xy[hover.i] } : null;

  // Each trend's value at the hovered month start, for the markers and readout.
  const hoveredMonth = (() => {
    if (hover?.kind !== "month" || !chart) return null;
    const s = chart.scales;
    const rows = [
      { key: "all", label: "All Sales Trend", line: trend, stroke: "stroke-chart-trend", fill: "fill-chart-trend" },
      {
        key: "selected",
        label: "Selected Trend",
        line: selectedTrend,
        stroke: "stroke-chart-trend-selected",
        fill: "fill-chart-trend-selected",
      },
    ].flatMap(({ line, ...r }) => {
      const v = line && trendAt(line, hover.t);
      return v == null ? [] : [{ ...r, v, y: s.y(v) }];
    });
    return rows.length ? { t: hover.t, x: s.x(hover.t), rows } : null;
  })();

  return (
    <section aria-labelledby="auction-results-title" className="rounded-2xl border border-line bg-surface/80 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="auction-results-title" className="text-base font-semibold">
            Auction Results
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted">
            One dot per auction: the sale price, or the high bid when the reserve wasn&apos;t met.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
              <circle cx="5" cy="5" r="4" className="fill-chart-sold" />
            </svg>
            Sold <span className="text-faint tabular-nums">{formatCount(sold)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
              <circle cx="5" cy="5" r="3.5" className="fill-none stroke-chart-unsold" strokeWidth="1.5" />
            </svg>
            Reserve not met <span className="text-faint tabular-nums">{formatCount(unsold)}</span>
          </span>
          {trend && (
            <span className="inline-flex items-center gap-1.5">
              <LineKey className="stroke-chart-trend" />
              All Sales Trend
              <InfoTip id="scatter-trend-def" label="the trend lines">
                A smoothed line through sold prices: at each date, a straight line fitted to the sales within about
                six months either side, nearest weighted most, with outlier sales discounted. The line is dashed where
                sales are thin (it reaches out to the nearest 30) and across gaps with no sales (it bridges them
                straight).
                <span className="mt-1.5 block text-faint">
                  Worked out over every sale on record, so the date range only zooms in. Selected Trend does the same
                  for the auctions the filters select.
                </span>
              </InfoTip>
            </span>
          )}
          {filtered &&
            (selectedTrend ? (
              <span className="inline-flex items-center gap-1.5">
                <LineKey className="stroke-chart-trend-selected" />
                Selected Trend
              </span>
            ) : (
              trend && <span className="text-faint">Too few selected sales for a trend</span>
            ))}
          {canceled > 0 && <span className="text-faint">{formatCount(canceled)} canceled, not shown</span>}
        </div>
      </div>

      {plottable.length > 0 && (
        <>
          <ScatterFilters
            options={options}
            filters={filters}
            onChange={setFilters}
            shown={shown}
            total={points.length}
          />
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[11px] font-medium text-muted">Date Range</span>
            <Segmented
              label="Date range"
              options={RANGES}
              value={range}
              onChange={(r) => {
                setRange(r);
                setHover(null); // hover indexes into the points in range
              }}
            />
          </div>
        </>
      )}

      <div ref={wrapRef} className="relative" style={{ height: HEIGHT }}>
        {points.length === 0 && (
          <p className="grid h-full place-items-center text-sm text-faint">
            {plottable.length ? "No auction results in this date range." : "No auction results to plot yet."}
          </p>
        )}
        {chart && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Scatter plot of ${formatCount(points.length)} auction results over time. The table below lists every result.`}
            className="block touch-none select-none"
            onPointerMove={(e) => setHover(hitTest(...local(e)))}
            onPointerDown={(e) => setHover(hitTest(...local(e)))}
            onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
            onClick={(e) => {
              // Touch taps show the tooltip instead; the results table links every auction.
              const [mx, my, touch] = local(e);
              const hit = hitTest(mx, my, touch);
              if (hit?.kind === "dot" && !touch) {
                window.open(auctionUrl(points[hit.i].a.id), "_blank", "noopener,noreferrer");
              }
            }}
            style={{ cursor: hover?.kind === "dot" ? "pointer" : "default" }}
          >
            {chart.yearBands.map((b) => (
              <rect
                key={b.year}
                x={b.x0}
                y={MARGIN.top}
                width={b.x1 - b.x0}
                height={HEIGHT - MARGIN.top - MARGIN.bottom}
                className="fill-fg"
                fillOpacity={YEAR_BAND_OPACITY}
              />
            ))}

            {/* Grid and axes: solid hairlines, one step off the surface. */}
            {chart.yTicks.map((t) => (
              <g key={`y${t.v}`}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={t.y} y2={t.y} className="stroke-line" />
                <text x={MARGIN.left - 8} y={t.y} dy="0.32em" textAnchor="end" className="fill-faint text-[11px] tabular-nums">
                  {priceTickLabel(t.v)}
                </text>
              </g>
            ))}
            {chart.xTicks.map((t) => (
              <g key={`x${t.v}`}>
                <line x1={t.x} x2={t.x} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="stroke-line" />
                <text x={t.x} y={HEIGHT - MARGIN.bottom + 18} textAnchor="middle" className="fill-faint text-[11px] tabular-nums">
                  {t.label}
                </text>
              </g>
            ))}
            <text
              transform={`translate(12 ${MARGIN.top + (HEIGHT - MARGIN.top - MARGIN.bottom) / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-faint text-[10px]"
            >
              Price (log scale)
            </text>

            {dots}

            {trendLines && (
              <g clipPath={`url(#${clipId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
                <clipPath id={clipId}>
                  <rect
                    x={MARGIN.left}
                    y={MARGIN.top}
                    width={width - MARGIN.left - MARGIN.right}
                    height={HEIGHT - MARGIN.top - MARGIN.bottom}
                  />
                </clipPath>
                {trendLines.all && <TrendLine segments={trendLines.all} className="stroke-chart-trend" />}
                {trendLines.selected && (
                  <TrendLine segments={trendLines.selected} className="stroke-chart-trend-selected" />
                )}
              </g>
            )}

            {hoveredMonth && (
              <g>
                <line
                  x1={hoveredMonth.x}
                  x2={hoveredMonth.x}
                  y1={MARGIN.top}
                  y2={HEIGHT - MARGIN.bottom}
                  className="stroke-line-strong"
                />
                {hoveredMonth.rows.map((r) => (
                  <circle key={r.key} cx={hoveredMonth.x} cy={r.y} r={R} className={`${r.fill} stroke-surface`} strokeWidth={2} />
                ))}
              </g>
            )}

            {hovered && (
              <circle cx={hovered.xy[0]} cy={hovered.xy[1]} r={R + 3} className="fill-none stroke-fg" strokeWidth={1.5} />
            )}
          </svg>
        )}
        {hovered && <Tooltip point={hovered.p} x={hovered.xy[0]} y={hovered.xy[1]} width={width} />}
        {hoveredMonth && (
          <TipBox x={hoveredMonth.x} y={Math.min(...hoveredMonth.rows.map((r) => r.y))} width={width} w={200} h={90}>
            <div className="font-medium text-fg">{formatDate(hoveredMonth.t)}</div>
            {hoveredMonth.rows.map((r) => (
              <div key={r.key} className="mt-1 flex items-center gap-2">
                <LineKey className={r.stroke} />
                <span className="font-semibold text-fg tabular-nums">{formatMoney(r.v)}</span>
                <span className="text-faint">{r.label}</span>
              </div>
            ))}
          </TipBox>
        )}
      </div>
      {auctions.length > 0 && <FilteredStats auctions={selected} filtered={isFiltered(filters)} />}
    </section>
  );
}

// A short stroke in a trend line's color, for the legend.
function LineKey({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 14 10" className="h-2.5 w-3.5" aria-hidden="true">
      <line x1="1" x2="13" y1="5" y2="5" className={className} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// A trend line on a casing in the surface color, so it reads over the dots. Stretches
// where sales were too thin for the usual window are dashed.
function TrendLine({ segments, className }: { segments: Segment[]; className: string }) {
  return (
    <>
      {segments.map((s, i) => (
        <path key={`casing${i}`} d={s.d} className="stroke-surface" strokeWidth={5} strokeOpacity={0.7} />
      ))}
      {segments.map((s, i) => (
        <path key={i} d={s.d} className={className} strokeWidth={2} strokeDasharray={s.sparse ? "4 6" : undefined} />
      ))}
    </>
  );
}

// A tooltip panel w wide beside (x, y): to the right, or to the left near the right
// edge, and kept inside the plot's height (h is about how tall it gets).
function TipBox({
  x,
  y,
  width,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  width: number;
  w: number;
  h: number;
  children: React.ReactNode;
}) {
  const left = x + 14 + w > width ? Math.max(0, x - 14 - w) : x + 14;
  const top = Math.min(Math.max(0, y - 24), HEIGHT - h);
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-line-strong/70 bg-surface-3/90 px-3 py-2.5 text-xs leading-relaxed shadow-lg shadow-black/30 backdrop-blur-md"
      style={{ left, top, width: w }}
    >
      {children}
    </div>
  );
}

function Tooltip({ point: p, x, y, width }: { point: Point; x: number; y: number; width: number }) {
  const a = p.a;
  return (
    <TipBox x={x} y={y} width={width} w={260} h={150}>
      <div className="font-medium text-fg">{a.title ?? "Untitled listing"}</div>
      <div className="text-faint">
        {formatDate(a.ended)}
        {a.generation && ` · ${a.generation}`}
        {a.mileage != null && ` · ${formatCount(a.mileage)} mi`}
      </div>
      <div className="mt-1.5 text-fg">
        {p.sold ? (
          p.isHighBid ? (
            <>
              Sold · high bid <span className="font-semibold">{formatDollars(p.price)}</span>
              <span className="block text-faint">Final sale price not published</span>
            </>
          ) : (
            <>
              Sold for <span className="font-semibold">{formatDollars(p.price)}</span>
              {a.status === "sold_after" && <span className="text-faint"> (after the auction)</span>}
            </>
          )
        ) : (
          <>
            Bid to <span className="font-semibold">{formatDollars(p.price)}</span>
            <span className="text-faint"> · reserve not met</span>
          </>
        )}
      </div>
      {a.noReserve && <div className="text-faint">No reserve</div>}
      <div className="mt-1 text-faint">Click to open on Cars &amp; Bids</div>
    </TipBox>
  );
}

// Scales, ticks, year bands, and every dot's screen position for the current width.
// The time axis runs from the start of the date range (or just before the first
// auction, if that's later) to just past when the data was loaded.
function layout(points: Point[], width: number, since: number, asOf: number) {
  const plotW = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const first = Math.min(...points.map((p) => p.t));
  const last = Math.max(asOf, ...points.map((p) => p.t));
  const tPad = Math.max((last - Math.max(first, since)) * 0.02, 15 * DAY);
  const t0 = Math.max(since, first - tPad);
  const t1 = last + tPad;

  let lo = Math.log10(Math.min(...points.map((p) => p.price)));
  let hi = Math.log10(Math.max(...points.map((p) => p.price)));
  const lPad = Math.max((hi - lo) * 0.05, 0.08);
  lo -= lPad;
  hi += lPad;

  const x = (t: number) => MARGIN.left + ((t - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => MARGIN.top + (1 - (Math.log10(v) - lo) / (hi - lo)) * plotH;
  const time = (px: number) => t0 + ((px - MARGIN.left) / plotW) * (t1 - t0); // x's inverse
  const scales = { t0, t1, x, y, time };

  // Even years get the wash, so a year keeps its shade whatever the range.
  const yearBands: { year: number; x0: number; x1: number }[] = [];
  for (let yr = new Date(t0).getUTCFullYear(); Date.UTC(yr, 0, 1) < t1; yr++) {
    if (yr % 2) continue;
    yearBands.push({ year: yr, x0: x(Math.max(t0, Date.UTC(yr, 0, 1))), x1: x(Math.min(t1, Date.UTC(yr + 1, 0, 1))) });
  }

  return {
    scales,
    xy: points.map((p) => [x(p.t), y(p.price)] as const),
    yearBands,
    yTicks: logPriceTicks(10 ** lo, 10 ** hi).map((v) => ({ v, y: y(v) })),
    xTicks: timeTicks(t0, t1, plotW).map((t) => ({ ...t, x: x(t.v) })),
  };
}

type Segment = { d: string; sparse: boolean };

// A trend as SVG path segments on the chart's scales, split where it turns sparse or
// dense. Steps outside the time axis are dropped, bar one either side so the line
// runs on to the clipped edge.
function trendSegments(trend: TrendPoint[], { scales: s }: ReturnType<typeof layout>): Segment[] {
  const segments: Segment[] = [];
  let cur: Segment | null = null;
  trend.forEach((p, i) => {
    if ((trend[i + 1]?.t ?? Infinity) < s.t0 || (trend[i - 1]?.t ?? -Infinity) > s.t1) return;
    const xy = `${s.x(p.t).toFixed(1)},${s.y(p.price).toFixed(1)}`;
    if (cur?.sparse === p.sparse) {
      cur.d += `L${xy}`;
      return;
    }
    if (cur) cur.d += `L${xy}`; // run the last segment on to where the next one starts
    cur = { d: `M${xy}`, sparse: p.sparse };
    segments.push(cur);
  });
  return segments;
}
