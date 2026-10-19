"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { auctionUrl, isSold, resultPrice } from "@/lib/auction";
import { countTicks, kde, logPriceTicks, median, priceTickLabel } from "@/lib/chart";
import type { FamilyAuction } from "@/lib/family";
import { formatCount, formatDate, formatDollars } from "@/lib/format";

const HEIGHT = 300;
const MARGIN = { top: 24, right: 16, bottom: 30, left: 40 }; // top leaves room for the median labels
const HIT = 12;
const GRID_POINTS = 160;

type Dot = { a: FamilyAuction; price: number; x: number; y: number };

// Last year's sales as a dot histogram (one dot per sale, stacked in price bins) on
// the same log price axis as the scatter. Behind them are two density curves, the
// last 365 days and the 365 days before, each scaled to its own sales so the area
// under it tracks volume.
export function PriceDistribution({ auctions }: { auctions: FamilyAuction[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { current, prior } = useMemo(() => {
    const sales = (w: 0 | 1) =>
      auctions
        .filter((a) => a.yearWindow === w && isSold(a))
        .map((a) => ({ a, price: resultPrice(a).price ?? 0 }))
        .filter((s) => s.price > 0);
    return { current: sales(0), prior: sales(1) };
  }, [auctions]);

  const chart = useMemo(
    () => (width > 0 && current.length ? layout(current, prior.map((s) => s.price), width) : null),
    [current, prior, width],
  );

  const nearest = (mx: number, my: number) => {
    if (!chart) return null;
    let best: number | null = null;
    let bestD = HIT * HIT;
    chart.dots.forEach((d, i) => {
      const dist = (d.x - mx) ** 2 + (d.y - my) ** 2;
      if (dist <= bestD) {
        bestD = dist;
        best = i;
      }
    });
    return best;
  };
  const local = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const hovered = hover != null && chart ? chart.dots[hover] : null;

  return (
    <section aria-labelledby="price-distribution-title" className="h-full rounded-2xl border border-line bg-surface/80 p-4 sm:p-5">
      <div className="mb-4">
        <h2 id="price-distribution-title" className="text-base font-semibold">
          Price Distribution
        </h2>
        <p className="mt-1 text-xs text-muted">
          Sales in the last 365 days, one dot each, with price curves and median lines for this year and the year
          before.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
              <circle cx="5" cy="5" r="4" className="fill-chart-sold" />
            </svg>
            Sale
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full bg-chart-current" aria-hidden="true" />
            Last 365 days <span className="text-faint tabular-nums">({formatCount(current.length)})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 rounded-full bg-muted" aria-hidden="true" />
            Year earlier <span className="text-faint tabular-nums">({formatCount(prior.length)})</span>
            {!chart?.priorCurve && <span className="text-faint">· Insufficient Data</span>}
          </span>
        </div>
      </div>

      <div ref={wrapRef} className="relative" style={{ height: HEIGHT }}>
        {current.length === 0 && (
          <p className="grid h-full place-items-center text-sm text-faint">
            Insufficient Data: no sales in the last 365 days.
          </p>
        )}
        {chart && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Distribution of ${formatCount(current.length)} sale prices over the last 365 days, with the year before for comparison. The table below lists every result.`}
            className="block touch-none select-none"
            onPointerMove={(e) => setHover(nearest(...local(e)))}
            onPointerDown={(e) => setHover(nearest(...local(e)))}
            onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
            onClick={(e) => {
              const i = nearest(...local(e));
              if (i != null && (e.nativeEvent as PointerEvent).pointerType !== "touch") {
                window.open(auctionUrl(chart.dots[i].a.id), "_blank", "noopener,noreferrer");
              }
            }}
            style={{ cursor: hover != null ? "pointer" : "default" }}
          >
            {chart.yTicks.map((t) => (
              <g key={`y${t.v}`}>
                <line x1={MARGIN.left} x2={width - MARGIN.right} y1={t.y} y2={t.y} className="stroke-line" />
                <text x={MARGIN.left - 8} y={t.y} dy="0.32em" textAnchor="end" className="fill-faint text-[11px] tabular-nums">
                  {t.v}
                </text>
              </g>
            ))}
            {chart.xTicks.map((t) => (
              <g key={`x${t.v}`}>
                <line x1={t.x} x2={t.x} y1={MARGIN.top} y2={HEIGHT - MARGIN.bottom} className="stroke-line" />
                <text x={t.x} y={HEIGHT - MARGIN.bottom + 18} textAnchor="middle" className="fill-faint text-[11px] tabular-nums">
                  {priceTickLabel(t.v)}
                </text>
              </g>
            ))}
            <text
              transform={`translate(10 ${MARGIN.top + (HEIGHT - MARGIN.top - MARGIN.bottom) / 2}) rotate(-90)`}
              textAnchor="middle"
              className="fill-faint text-[10px]"
            >
              Sales
            </text>

            {/* Curves first (translucent), then the dots, then the curve lines on top. */}
            {chart.priorCurve && <path d={chart.priorCurve.area} className="fill-muted" fillOpacity={0.12} />}
            {chart.currentCurve && <path d={chart.currentCurve.area} className="fill-chart-current" fillOpacity={0.18} />}
            {chart.dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={chart.r} className="fill-chart-sold" fillOpacity={0.75} />
            ))}
            {chart.priorCurve && (
              <path d={chart.priorCurve.line} className="fill-none stroke-muted" strokeWidth={2} strokeLinejoin="round" />
            )}
            {chart.currentCurve && (
              <path
                d={chart.currentCurve.line}
                className="fill-none stroke-chart-current"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}
            {/* Median lines, labelled at the top: the right-hand line's label sits to its right,
                the left-hand one's to its left, so the two never overlap. */}
            {chart.medians.map((m) => (
              <g key={m.key}>
                <line
                  x1={m.x}
                  x2={m.x}
                  y1={MARGIN.top - 4}
                  y2={HEIGHT - MARGIN.bottom}
                  className={m.key === "current" ? "stroke-chart-current" : "stroke-muted"}
                  strokeWidth={1.5}
                />
                <text
                  x={m.side === "right" ? m.x + 5 : m.x - 5}
                  y={MARGIN.top - 8}
                  textAnchor={m.side === "right" ? "start" : "end"}
                  className="fill-muted text-[10px] font-medium tabular-nums"
                >
                  {priceTickLabel(m.value)}
                </text>
              </g>
            ))}
            {hovered && (
              <circle cx={hovered.x} cy={hovered.y} r={chart.r + 3} className="fill-none stroke-fg" strokeWidth={1.5} />
            )}
          </svg>
        )}
        {hovered && <Tooltip dot={hovered} width={width} />}
      </div>
    </section>
  );
}

function Tooltip({ dot, width }: { dot: Dot; width: number }) {
  const W = 240;
  const left = dot.x + 14 + W > width ? Math.max(0, dot.x - 14 - W) : dot.x + 14;
  const top = Math.min(Math.max(0, dot.y - 24), HEIGHT - 110);
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-line-strong/70 bg-surface-3/90 px-3 py-2.5 text-xs leading-relaxed shadow-lg shadow-black/30 backdrop-blur-md"
      style={{ left, top, width: W }}
    >
      <div className="font-medium text-fg">{dot.a.title ?? "Untitled listing"}</div>
      <div className="text-faint">{formatDate(dot.a.ended)}</div>
      <div className="mt-1.5 text-fg">
        Sold for <span className="font-semibold">{formatDollars(dot.price)}</span>
      </div>
      <div className="mt-1 text-faint">Click to open on Cars &amp; Bids</div>
    </div>
  );
}

function layout(current: { a: FamilyAuction; price: number }[], priorPrices: number[], width: number) {
  const plotW = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const bottom = HEIGHT - MARGIN.bottom;

  // Shared log-price domain covering both years.
  const curLogs = current.map((s) => Math.log10(s.price));
  const priorLogs = priorPrices.map((p) => Math.log10(p));
  const all = [...curLogs, ...priorLogs];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = Math.max((hi - lo) * 0.06, 0.08);
  lo -= pad;
  hi += pad;
  const x = (lp: number) => MARGIN.left + ((lp - lo) / (hi - lo)) * plotW;

  // Equal-width bins in log space, about 14px each.
  const bins = Math.min(48, Math.max(12, Math.round(plotW / 14)));
  const binW = (hi - lo) / bins;
  const binPx = plotW / bins;
  const stacks = new Map<number, { a: FamilyAuction; price: number }[]>();
  current.forEach((s, i) => {
    const b = Math.min(bins - 1, Math.max(0, Math.floor((curLogs[i] - lo) / binW)));
    stacks.set(b, [...(stacks.get(b) ?? []), s]);
  });
  const maxStack = Math.max(...[...stacks.values()].map((s) => s.length));

  // Density curves, scaled to expected sales per bin so they share the dots' y axis.
  const grid = Array.from({ length: GRID_POINTS }, (_, i) => lo + ((hi - lo) * i) / (GRID_POINTS - 1));
  const scaled = (logs: number[]) => kde(logs, grid)?.map((d) => d * logs.length * binW) ?? null;
  const curDensity = scaled(curLogs);
  const priorDensity = scaled(priorLogs);

  const yMax = Math.max(maxStack, ...(curDensity ?? [0]), ...(priorDensity ?? [0]), 1) * 1.08;
  const unit = plotH / yMax;
  const y = (count: number) => bottom - count * unit;
  const r = Math.max(1.5, Math.min(binPx, unit) / 2 - 0.6);

  const dots: Dot[] = [];
  for (const [b, stack] of stacks) {
    const cx = MARGIN.left + (b + 0.5) * binPx;
    stack
      .sort((p, q) => p.price - q.price)
      .forEach((s, k) => dots.push({ ...s, x: cx, y: y(k + 0.5) }));
  }

  const curve = (density: number[] | null) => {
    if (!density) return null;
    const pts = density.map((d, i) => `${x(grid[i]).toFixed(1)},${y(d).toFixed(1)}`);
    const line = `M${pts.join("L")}`;
    return { line, area: `${line}L${x(hi).toFixed(1)},${bottom}L${x(lo).toFixed(1)},${bottom}Z` };
  };

  // Each year's median sale price, shown when that year has enough sales for a curve.
  const medianLine = (key: "current" | "prior", prices: number[], density: number[] | null) => {
    const value = density ? median(prices) : null;
    return value == null ? null : { key, value, x: x(Math.log10(value)) };
  };
  const lines = [
    medianLine("current", current.map((s) => s.price), curDensity),
    medianLine("prior", priorPrices, priorDensity),
  ].filter((m) => m != null);
  // On a tie, this year's label goes right and the year before's goes left.
  const right = lines.reduce((best, m, i) => (m.x > lines[best].x ? i : best), 0);
  const medians = lines.map((m, i) => ({ ...m, side: (i === right ? "right" : "left") as "left" | "right" }));

  return {
    dots,
    r,
    medians,
    currentCurve: curve(curDensity),
    priorCurve: curve(priorDensity),
    yTicks: countTicks(yMax).map((v) => ({ v, y: y(v) })),
    xTicks: logPriceTicks(10 ** lo, 10 ** hi).map((v) => ({ v, x: x(Math.log10(v)) })),
  };
}
