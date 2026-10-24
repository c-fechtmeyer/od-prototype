"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Delta } from "@/components/delta";
import { Segmented } from "@/components/table-parts";
import { STATUS_LABEL, auctionUrl, isSold, resultPrice } from "@/lib/auction";
import { logPriceTicks, priceTickLabel, timeTicks } from "@/lib/chart";
import type { FamilyAuction } from "@/lib/family";
import { formatCount, formatDate, formatDollars, formatMoney, formatMoneyChange, pctChange } from "@/lib/format";

const HEIGHT = 360;
const MARGIN = { top: 12, right: 16, bottom: 30, left: 56 };
const R = 4; // same markers as the scatter
const HIT = 14;
const SOLD_OPACITY = 0.6;
const UNSOLD_OPACITY = 0.55;
// With a car selected, every other car fades back to this.
const FADED_OPACITY = 0.1;

type Event = { a: FamilyAuction; price: number; sold: boolean; isHighBid: boolean };

// One car: every listing of its VIN, newest first, and the ones with a result to
// plot, oldest first. `change` (relative) and `dollarChange` are its latest sale
// against its first, when it has sold at least twice.
type Car = {
  vin: string;
  listings: FamilyAuction[];
  events: Event[];
  change: number | null;
  dollarChange: number | null;
};

type Emphasis = "normal" | "faded" | "hovered" | "selected";

// Which cars to show, by the same latest-vs-first-sale change as the list. A car sold
// fewer than twice has no change, so it shows only under All.
type Trend = "all" | "up" | "down";
const TRENDS = ["all", "up", "down"] as const;
const TREND_LABEL: Record<Trend, string> = { all: "All", up: "Increased", down: "Decreased" };

const matchesTrend = (car: Car, trend: Trend) =>
  trend === "all" || (car.change != null && (trend === "up" ? car.change > 0 : car.change < 0));

// Cars listed more than once, matched by VIN: one line per car through each of its
// results over time, on the scatter's log price axis and markers. Canceled listings
// have no result, so they're left off the chart but kept in the car's history. The
// list on the left selects a car, as does clicking one of its dots.
export function SameVinSales({ auctions }: { auctions: FamilyAuction[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ car: number; event: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trend, setTrend] = useState<Trend>("all");

  const cars = useMemo(() => repeatCars(auctions), [auctions]);
  const hasCars = cars.length > 0;
  // Indices of the cars the trend buttons leave showing. The axes still fit every
  // car, so switching doesn't rescale the chart.
  const shown = useMemo(() => cars.flatMap((c, i) => (matchesTrend(c, trend) ? [i] : [])), [cars, trend]);
  const trendCounts = useMemo(
    () => Object.fromEntries(TRENDS.map((t) => [t, cars.filter((c) => matchesTrend(c, t)).length])) as Record<Trend, number>,
    [cars],
  );

  const pickTrend = (t: Trend) => {
    setTrend(t);
    setHover(null);
    // Keep the selected car only if it's still showing.
    setSelected((s) => (cars.some((c) => c.vin === s && matchesTrend(c, t)) ? s : null));
  };

  // The plot only exists when there are cars to draw.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasCars]);
  const canceled = shown.reduce((n, i) => n + cars[i].listings.filter((a) => a.status === "canceled").length, 0);
  const plotted = shown.reduce((n, i) => n + cars[i].events.length, 0);

  const chart = useMemo(() => (width > 0 && cars.length ? layout(cars, width) : null), [cars, width]);

  // Keep the selected car's list item in view when it's picked from the chart.
  useEffect(() => {
    const list = listRef.current;
    const item = selected ? itemRefs.current.get(selected) : null;
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - 4), behavior: "smooth" });
    }
  }, [selected]);

  // The line-and-dot layer changes with the data, width or selection, not on every
  // hover. The selected car draws last, so it sits on top.
  const marks = useMemo(() => {
    if (!chart) return null;
    const isSelected = (i: number) => Number(cars[i].vin === selected);
    const order = [...shown].sort((i, j) => isSelected(i) - isSelected(j));
    return order.map((i) => (
      <CarMarks
        key={cars[i].vin}
        car={cars[i]}
        xy={chart.xy[i]}
        emphasis={selected == null ? "normal" : cars[i].vin === selected ? "selected" : "faded"}
      />
    ));
  }, [chart, cars, shown, selected]);

  const nearest = (mx: number, my: number) => {
    if (!chart) return null;
    let best: { car: number; event: number } | null = null;
    let bestD = HIT * HIT;
    for (const car of shown) {
      for (const [event, [x, y]] of chart.xy[car].entries()) {
        const d = (x - mx) ** 2 + (y - my) ** 2;
        if (d <= bestD) {
          bestD = d;
          best = { car, event };
        }
      }
    }
    return best;
  };

  const local = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  const hovered = hover && chart ? { car: cars[hover.car], xy: chart.xy[hover.car], event: hover.event } : null;

  return (
    <section aria-labelledby="same-vin-title" className="rounded-2xl border border-line bg-surface/80 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="same-vin-title" className="text-base font-semibold">
            Same-VIN Sales
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted">
            Cars listed more than once, one line per VIN through the sale price, or the high bid when the reserve
            wasn&apos;t met.{hasCars && " Pick a car to see its history."}
          </p>
        </div>
        {hasCars && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                <circle cx="5" cy="5" r="4" className="fill-chart-sold" />
              </svg>
              Sold
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                <circle cx="5" cy="5" r="3.5" className="fill-none stroke-chart-unsold" strokeWidth="1.5" />
              </svg>
              Reserve not met
            </span>
            <span className="tabular-nums">
              {formatCount(shown.length)} car{shown.length === 1 ? "" : "s"}
              <span className="text-faint"> · {formatCount(plotted)} results</span>
            </span>
            {canceled > 0 && <span className="text-faint">{formatCount(canceled)} canceled, not plotted</span>}
          </div>
        )}
      </div>

      {!hasCars ? (
        <p className="grid h-[160px] place-items-center text-sm text-faint">No repeat sales available.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Segmented
              label="Show cars"
              options={TRENDS}
              value={trend}
              onChange={pickTrend}
              describedBy="same-vin-trend-note"
              format={(t) => (
                <span className="inline-flex items-center gap-1.5">
                  {t !== "all" && (
                    <svg viewBox="0 0 8 8" className={`size-[7px] ${t === "up" ? "text-up" : "text-down"}`} aria-hidden="true">
                      <path d={t === "up" ? "M4 1 7.5 7h-7z" : "M4 7 .5 1h7z"} fill="currentColor" />
                    </svg>
                  )}
                  {TREND_LABEL[t]}
                  <span className="text-faint">{formatCount(trendCounts[t])}</span>
                </span>
              )}
            />
            <p id="same-vin-trend-note" className="text-[11px] text-faint">
              By latest sale vs. first sale. Cars sold fewer than twice show only under All.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line lg:h-[360px]">
              <div className="flex justify-between gap-3 border-b border-line px-3 py-2 text-[11px] text-faint">
                <span>Latest Listing</span>
                <span>Result · vs. First Sale</span>
              </div>
              <ul ref={listRef} className="relative max-h-[280px] divide-y divide-line/60 overflow-y-auto lg:max-h-none lg:flex-1">
                {shown.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-faint">
                    No cars sold for {trend === "up" ? "more" : "less"} than their first sale.
                  </li>
                )}
                {shown.map((i) => cars[i]).map((c) => (
                  <CarItem
                    key={c.vin}
                    car={c}
                    selected={c.vin === selected}
                    onToggle={() => setSelected((s) => (s === c.vin ? null : c.vin))}
                    itemRef={(el) => {
                      if (el) itemRefs.current.set(c.vin, el);
                      return () => {
                        itemRefs.current.delete(c.vin);
                      };
                    }}
                  />
                ))}
              </ul>
            </div>

            <div ref={wrapRef} className="relative min-w-0" style={{ height: HEIGHT }}>
              {chart && (
                <svg
                  width={width}
                  height={HEIGHT}
                  role="img"
                  aria-label={`Line chart of ${formatCount(shown.length)} cars listed more than once${trend === "all" ? "" : `, whose latest sale is ${trend === "up" ? "above" : "below"} their first`}, each car's results over time. The list beside it names every car.`}
                  className="block touch-none select-none"
                  onPointerMove={(e) => setHover(nearest(...local(e)))}
                  onPointerDown={(e) => setHover(nearest(...local(e)))}
                  onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
                  onClick={(e) => {
                    // A dot selects its car; a click on empty space clears the selection.
                    const hit = nearest(...local(e));
                    setSelected(hit ? cars[hit.car].vin : null);
                  }}
                  style={{ cursor: hover ? "pointer" : "default" }}
                >
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

                  {marks}

                  {/* The hovered car's line comes forward so its other results are easy to find. */}
                  {hovered && hovered.car.vin !== selected && <CarMarks car={hovered.car} xy={hovered.xy} emphasis="hovered" />}
                  {hovered && (
                    <circle
                      cx={hovered.xy[hovered.event][0]}
                      cy={hovered.xy[hovered.event][1]}
                      r={R + 3}
                      className="fill-none stroke-fg"
                      strokeWidth={1.5}
                    />
                  )}
                </svg>
              )}
              {hovered && (
                <Tooltip
                  car={hovered.car}
                  event={hovered.car.events[hovered.event]}
                  x={hovered.xy[hovered.event][0]}
                  y={hovered.xy[hovered.event][1]}
                  width={width}
                  selected={hovered.car.vin === selected}
                />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const LINE_STYLE: Record<Emphasis, { className: string; opacity: number; width: number }> = {
  normal: { className: "stroke-muted", opacity: 0.35, width: 1.25 },
  faded: { className: "stroke-muted", opacity: FADED_OPACITY, width: 1.25 },
  hovered: { className: "stroke-fg", opacity: 0.55, width: 1.5 },
  selected: { className: "stroke-forest-300", opacity: 0.9, width: 2 },
};

// One car's line and dots, styled for how much it stands out right now.
function CarMarks({ car, xy, emphasis }: { car: Car; xy: (readonly [number, number])[]; emphasis: Emphasis }) {
  const line = LINE_STYLE[emphasis];
  const dot = (sold: boolean) =>
    emphasis === "faded" ? FADED_OPACITY : emphasis === "normal" ? (sold ? SOLD_OPACITY : UNSOLD_OPACITY) : 1;
  return (
    <g>
      <polyline
        points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
        className={`fill-none ${line.className}`}
        strokeOpacity={line.opacity}
        strokeWidth={line.width}
        strokeLinejoin="round"
      />
      {car.events.map((e, i) =>
        e.sold ? (
          <circle key={e.a.id} cx={xy[i][0]} cy={xy[i][1]} r={R} className="fill-chart-sold" fillOpacity={dot(true)} />
        ) : (
          <circle
            key={e.a.id}
            cx={xy[i][0]}
            cy={xy[i][1]}
            r={R - 0.5}
            className="fill-surface stroke-chart-unsold"
            fillOpacity={emphasis === "faded" ? 0 : 1}
            strokeWidth={1.5}
            strokeOpacity={dot(false)}
          />
        ),
      )}
    </g>
  );
}

function CarItem({
  car,
  selected,
  onToggle,
  itemRef,
}: {
  car: Car;
  selected: boolean;
  onToggle: () => void;
  itemRef: React.Ref<HTMLLIElement>;
}) {
  const latest = car.listings[0];
  const last = car.events.at(-1)!;
  return (
    <li ref={itemRef} className={selected ? "bg-surface-3/60" : undefined}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={selected}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-300 ${selected ? "" : "hover:bg-surface-2"}`}
      >
        <span className="min-w-0">
          <span className={`line-clamp-2 text-sm font-medium ${selected ? "text-forest-200" : "text-fg"}`}>
            {latest.title ?? "Untitled listing"}
          </span>
          <span className="mt-0.5 block text-xs text-faint tabular-nums">
            {formatCount(car.listings.length)} listings · last {formatDate(latest.ended)}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5 tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-sm text-fg">
            <ResultMarker sold={last.sold} />
            {formatMoney(last.price)}
          </span>
          {car.change != null && (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-muted">{formatMoneyChange(car.dollarChange!)}</span>
              <Delta value={car.change} vs="since its first sale" />
            </span>
          )}
        </span>
      </button>
      {selected && <History car={car} />}
    </li>
  );
}

// Every listing of the selected car, newest first, each linking to Cars & Bids.
function History({ car }: { car: Car }) {
  return (
    <div className="px-3 pb-3">
      <div className="font-mono text-[11px] text-faint">VIN {car.vin}</div>
      <ol className="mt-1.5 space-y-1">
        {car.listings.map((a) => {
          const { price, isHighBid } = resultPrice(a);
          return (
            <li key={a.id}>
              <a
                href={auctionUrl(a.id)}
                target="_blank"
                rel="noreferrer"
                className="group grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="text-fg tabular-nums group-hover:underline group-hover:decoration-forest-700 group-hover:underline-offset-4">
                    {formatDate(a.ended)}
                  </span>
                  <span className="text-faint">
                    {" "}
                    · {STATUS_LABEL[a.status]}
                    {a.mileage != null && ` · ${formatCount(a.mileage)} mi`}
                  </span>
                </span>
                <span className="text-right whitespace-nowrap text-muted tabular-nums">
                  {a.status === "canceled" || price == null ? (
                    "—"
                  ) : isSold(a) && !isHighBid ? (
                    <span className="font-medium text-fg">{formatDollars(price)}</span>
                  ) : (
                    <>
                      <span className="text-faint">{isSold(a) ? "High bid " : "Bid to "}</span>
                      {formatDollars(price)}
                    </>
                  )}
                  <span className="ml-1 text-faint" aria-hidden="true">
                    ↗
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ResultMarker({ sold }: { sold: boolean }) {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" role="img" aria-label={sold ? "Sold" : "Reserve not met"}>
      {sold ? (
        <circle cx="5" cy="5" r="4" className="fill-chart-sold" />
      ) : (
        <circle cx="5" cy="5" r="3.5" className="fill-none stroke-chart-unsold" strokeWidth="1.5" />
      )}
    </svg>
  );
}

function Tooltip({
  car,
  event: e,
  x,
  y,
  width,
  selected,
}: {
  car: Car;
  event: Event;
  x: number;
  y: number;
  width: number;
  selected: boolean;
}) {
  const W = 250;
  const left = x + 14 + W > width ? Math.max(0, x - 14 - W) : x + 14;
  const top = Math.min(Math.max(0, y - 24), HEIGHT - 150);
  const a = e.a;
  const n = car.listings.length - car.listings.indexOf(a); // listings are newest first
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-lg border border-line-strong/70 bg-surface-3/90 px-3 py-2.5 text-xs leading-relaxed shadow-lg shadow-black/30 backdrop-blur-md"
      style={{ left, top, width: W }}
    >
      <div className="font-medium text-fg">{a.title ?? "Untitled listing"}</div>
      <div className="text-faint">
        {formatDate(a.ended)}
        {a.mileage != null && ` · ${formatCount(a.mileage)} mi`}
      </div>
      <div className="mt-1.5 text-fg">
        {e.sold ? (
          <>
            {e.isHighBid ? "Sold · high bid " : "Sold for "}
            <span className="font-semibold">{formatDollars(e.price)}</span>
            {e.isHighBid && <span className="block text-faint">Final sale price not published</span>}
          </>
        ) : (
          <>
            Bid to <span className="font-semibold">{formatDollars(e.price)}</span>
            <span className="text-faint"> · reserve not met</span>
          </>
        )}
      </div>
      <div className="mt-1 text-faint">
        Listing {n} of {car.listings.length}
        {!selected && " · click to select this car"}
      </div>
    </div>
  );
}

// Group the auctions by VIN and keep the cars with at least two results to connect.
// Auctions come newest first, so each car's listings do too, and the cars end up in
// order of their latest listing.
function repeatCars(auctions: FamilyAuction[]): Car[] {
  const byVin = new Map<string, FamilyAuction[]>();
  for (const a of auctions) {
    if (!a.vin) continue;
    const listings = byVin.get(a.vin);
    if (listings) listings.push(a);
    else byVin.set(a.vin, [a]);
  }
  const cars: Car[] = [];
  for (const [vin, listings] of byVin) {
    if (listings.length < 2) continue;
    const events: Event[] = [];
    for (const a of [...listings].reverse()) {
      if (a.status === "canceled") continue;
      const { price, isHighBid } = resultPrice(a);
      if (price == null || price <= 0) continue;
      events.push({ a, price, sold: isSold(a), isHighBid });
    }
    if (events.length < 2) continue;
    const sales = events.filter((e) => e.sold);
    const [first, last] = sales.length >= 2 ? [sales[0].price, sales.at(-1)!.price] : [null, null];
    cars.push({
      vin,
      listings,
      events,
      change: pctChange(last, first),
      dollarChange: first != null && last != null ? last - first : null,
    });
  }
  return cars;
}

// Scales, ticks, and every car's points on screen for the current width.
function layout(cars: Car[], width: number) {
  const plotW = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const events = cars.flatMap((c) => c.events);

  let t0 = Math.min(...events.map((e) => e.a.ended));
  let t1 = Math.max(...events.map((e) => e.a.ended));
  const tPad = Math.max((t1 - t0) * 0.02, 15 * 86_400_000);
  t0 -= tPad;
  t1 += tPad;

  let lo = Math.log10(Math.min(...events.map((e) => e.price)));
  let hi = Math.log10(Math.max(...events.map((e) => e.price)));
  const lPad = Math.max((hi - lo) * 0.05, 0.08);
  lo -= lPad;
  hi += lPad;

  const x = (t: number) => MARGIN.left + ((t - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => MARGIN.top + (1 - (Math.log10(v) - lo) / (hi - lo)) * plotH;

  return {
    xy: cars.map((c) => c.events.map((e) => [x(e.a.ended), y(e.price)] as const)),
    yTicks: logPriceTicks(10 ** lo, 10 ** hi).map((v) => ({ v, y: y(v) })),
    xTicks: timeTicks(t0, t1, plotW).map((t) => ({ ...t, x: x(t.v) })),
  };
}
