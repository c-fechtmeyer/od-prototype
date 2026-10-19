"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { EMPTY_FILTERS, type Filters, ScatterFilters, buildOptions, matches } from "@/components/scatter-filters";
import { auctionUrl, isSold, resultPrice } from "@/lib/auction";
import { logPriceTicks, priceTickLabel } from "@/lib/chart";
import type { FamilyAuction } from "@/lib/family";
import { formatCount, formatDate, formatDollars } from "@/lib/format";

const HEIGHT = 380;
const MARGIN = { top: 12, right: 16, bottom: 30, left: 56 };
const R = 4; // >= 8px markers
const HIT = 14; // hover radius, larger than the mark
// Partly transparent, so clusters build up darker where auctions overlap.
const SOLD_OPACITY = 0.6;
const UNSOLD_OPACITY = 0.55;
// Auctions outside the filters stay on the chart, barely visible, and don't respond to hover.
const FILTERED_OUT_OPACITY = 0.08;

type Point = { a: FamilyAuction; t: number; price: number; sold: boolean; isHighBid: boolean };

// One dot per auction: when it ended (x) against its result price (y, log scale).
// Sold auctions are solid; reserve-not-met auctions are light rings. Canceled
// auctions have no result, so they're counted in the legend but not plotted. The
// filters above the plot fade out the auctions they exclude.
export function AuctionScatter({ auctions }: { auctions: FamilyAuction[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, canceled } = useMemo(() => {
    const points: Point[] = [];
    let canceled = 0;
    for (const a of auctions) {
      if (a.status === "canceled") {
        canceled++;
        continue;
      }
      const { price, isHighBid } = resultPrice(a);
      if (price == null || price <= 0) continue;
      points.push({ a, t: a.ended, price, sold: isSold(a), isHighBid });
    }
    return { points, canceled };
  }, [auctions]);

  const options = useMemo(() => buildOptions(points.map((p) => p.a)), [points]);
  const inFilter = useMemo(() => points.map((p) => matches(p.a, filters)), [points, filters]);
  const shown = inFilter.filter(Boolean).length;
  const sold = points.filter((p, i) => p.sold && inFilter[i]).length;
  const unsold = shown - sold;

  const chart = useMemo(() => (width > 0 && points.length ? layout(points, width) : null), [points, width]);

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

  const local = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const hovered = hover != null && chart && inFilter[hover] ? { p: points[hover], xy: chart.xy[hover] } : null;

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
          {canceled > 0 && <span className="text-faint">{formatCount(canceled)} canceled, not shown</span>}
        </div>
      </div>

      {points.length > 0 && (
        <ScatterFilters
          options={options}
          filters={filters}
          onChange={setFilters}
          shown={shown}
          total={points.length}
        />
      )}

      <div ref={wrapRef} className="relative" style={{ height: HEIGHT }}>
        {points.length === 0 && (
          <p className="grid h-full place-items-center text-sm text-faint">No auction results to plot yet.</p>
        )}
        {chart && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Scatter plot of ${formatCount(points.length)} auction results over time. The table below lists every result.`}
            className="block touch-none select-none"
            onPointerMove={(e) => setHover(nearest(...local(e)))}
            onPointerDown={(e) => setHover(nearest(...local(e)))}
            onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
            onClick={(e) => {
              // Touch taps show the tooltip instead; the results table links every auction.
              const i = nearest(...local(e));
              if (i != null && (e.nativeEvent as PointerEvent).pointerType !== "touch") {
                window.open(auctionUrl(points[i].a.id), "_blank", "noopener,noreferrer");
              }
            }}
            style={{ cursor: hover != null ? "pointer" : "default" }}
          >
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

            {hovered && (
              <circle cx={hovered.xy[0]} cy={hovered.xy[1]} r={R + 3} className="fill-none stroke-fg" strokeWidth={1.5} />
            )}
          </svg>
        )}
        {hovered && <Tooltip point={hovered.p} x={hovered.xy[0]} y={hovered.xy[1]} width={width} />}
      </div>
    </section>
  );
}

function Tooltip({ point: p, x, y, width }: { point: Point; x: number; y: number; width: number }) {
  const W = 260;
  const left = x + 14 + W > width ? Math.max(0, x - 14 - W) : x + 14;
  const top = Math.min(Math.max(0, y - 24), HEIGHT - 150);
  const a = p.a;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-line-strong/70 bg-surface-3/90 px-3 py-2.5 text-xs leading-relaxed shadow-lg shadow-black/30 backdrop-blur-md"
      style={{ left, top, width: W }}
    >
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
    </div>
  );
}

// Scales, ticks, and every dot's screen position for the current width.
function layout(points: Point[], width: number) {
  const plotW = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  let t0 = Math.min(...points.map((p) => p.t));
  let t1 = Math.max(...points.map((p) => p.t));
  const tPad = Math.max((t1 - t0) * 0.02, 15 * 86_400_000);
  t0 -= tPad;
  t1 += tPad;

  let lo = Math.log10(Math.min(...points.map((p) => p.price)));
  let hi = Math.log10(Math.max(...points.map((p) => p.price)));
  const lPad = Math.max((hi - lo) * 0.05, 0.08);
  lo -= lPad;
  hi += lPad;

  const x = (t: number) => MARGIN.left + ((t - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => MARGIN.top + (1 - (Math.log10(v) - lo) / (hi - lo)) * plotH;

  return {
    xy: points.map((p) => [x(p.t), y(p.price)] as const),
    yTicks: logPriceTicks(10 ** lo, 10 ** hi).map((v) => ({ v, y: y(v) })),
    xTicks: timeTicks(t0, t1, plotW).map((t) => ({ ...t, x: x(t.v) })),
  };
}

// Year boundaries for long spans; quarter starts when there's less than ~2 years.
function timeTicks(t0: number, t1: number, plotW: number): { v: number; label: string }[] {
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
