"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Delta } from "@/components/delta";
import { RangeAxis, RangeBar } from "@/components/range-bar";
import type { Market, WindowKey } from "@/lib/markets";
import { METRICS, type Metric, type MetricKey } from "@/lib/metrics";
import type { LogScale } from "@/lib/scale";

type Sort = { key: "rank" | MetricKey; dir: "asc" | "desc" };

const ROWS: { cur: WindowKey; prior: WindowKey; label: string; long: string }[] = [
  { cur: "c365", prior: "p365", label: "365D", long: "Last 365 days" },
  { cur: "c180", prior: "p180", label: "180D", long: "Last 180 days" },
];

export function MarketsTable({ markets, scale }: { markets: Market[]; scale: LogScale }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "rank", dir: "asc" });
  const [watchOnly, setWatchOnly] = useState(false);
  const watchlist = useWatchlist();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, like the screenshot's search box; Escape clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = markets.filter((m) => {
      if (watchOnly && !watchlist.set.has(m.familyId)) return false;
      if (!q) return true;
      return [m.makeName, m.familyName, m.bodyStyle ?? "", ...m.generations].join(" ").toLowerCase().includes(q);
    });
    if (sort.key === "rank") return sort.dir === "asc" ? filtered : [...filtered].reverse();
    const metric = METRICS[sort.key];
    return [...filtered].sort((a, b) => {
      const av = metric.sortValue(a.windows.c365);
      const bv = metric.sortValue(b.windows.c365);
      if (av == null) return 1;
      if (bv == null) return -1;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [markets, query, sort, watchOnly, watchlist.set]);

  const toggleSort = (key: Sort["key"]) =>
    setSort((s) => {
      if (s.key !== key) return { key, dir: key === "rank" ? "asc" : "desc" };
      if (key === "rank") return { key, dir: s.dir === "asc" ? "desc" : "asc" };
      return s.dir === "desc" ? { key, dir: "asc" } : { key: "rank", dir: "asc" };
    });

  return (
    <section aria-label="Markets" className="mt-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm focus-within:border-forest-600 sm:w-80">
          <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-faint" aria-hidden="true">
            <path
              d="m14.5 14.5 3 3M16 9A7 7 0 1 1 2 9a7 7 0 0 1 14 0Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <span className="sr-only">Search markets</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search make, model, generation…"
            className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line-strong px-1.5 font-mono text-[11px] text-faint">/</kbd>
        </label>

        <button
          type="button"
          role="switch"
          aria-checked={watchOnly}
          onClick={() => setWatchOnly((v) => !v)}
          className="flex h-10 items-center gap-2.5 rounded-lg px-1 text-sm font-medium text-fg"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${watchOnly ? "bg-forest-500" : "bg-surface-3"}`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-fg shadow transition-transform ${watchOnly ? "translate-x-[18px]" : "translate-x-0.5"}`}
            />
          </span>
          Watchlist only
          {watchlist.size > 0 && (
            <span className="rounded bg-forest-900 px-1.5 text-xs text-forest-300 tabular-nums">{watchlist.size}</span>
          )}
        </button>

        {sort.key !== "rank" && (
          <button
            type="button"
            onClick={() => setSort({ key: "rank", dir: "asc" })}
            className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-muted hover:text-fg"
          >
            Sorted by {METRICS[sort.key].label} (365D)
            <span aria-hidden="true">×</span>
            <span className="sr-only">Reset sort</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/80">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th scope="col" className="w-12 border-b border-line py-3 pl-4">
                <span className="sr-only">Watch</span>
              </th>
              <th scope="col" className="w-10 border-b border-line py-3 font-medium">
                <SortButton active={sort.key === "rank"} dir={sort.dir} onClick={() => toggleSort("rank")}>
                  #
                </SortButton>
              </th>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b border-line bg-surface py-3 pr-4 font-medium sm:static sm:bg-transparent"
              >
                Model family
              </th>
              <th scope="col" className="w-16 border-b border-line py-3 font-medium">
                Window
              </th>
              <MetricHeader metric={METRICS.auctions} sort={sort} onSort={toggleSort} />
              <MetricHeader metric={METRICS.volume} sort={sort} onSort={toggleSort} />
              <MetricHeader metric={METRICS.price} sort={sort} onSort={toggleSort}>
                <div className="mt-2 flex items-center gap-3">
                  <span className="w-[92px] text-[10px] font-normal text-faint">
                    <Swatch className="h-[6px] bg-chart-current" /> now{" "}
                    <Swatch className="ml-1.5 h-[3px] bg-chart-prior" /> yr ago
                  </span>
                  <RangeAxis scale={scale} />
                </div>
              </MetricHeader>
              <MetricHeader metric={METRICS.success} sort={sort} onSort={toggleSort} last />
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <MarketRow
                key={m.familyId}
                market={m}
                scale={scale}
                striped={i % 2 === 1}
                watched={watchlist.has(m.familyId)}
                onToggleWatch={() => watchlist.toggle(m.familyId)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-6 py-14 text-center text-sm text-muted">
            {watchOnly && watchlist.size === 0
              ? "Your watchlist is empty. Tap the heart on a row to add it."
              : `No markets match “${query}”.`}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-faint">
        YoY compares each window with the same span a year earlier. Hover a value for its definition and year-ago
        figure.
      </p>
    </section>
  );
}

function MarketRow({
  market: m,
  scale,
  striped,
  watched,
  onToggleWatch,
}: {
  market: Market;
  scale: LogScale;
  striped: boolean;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const bg = striped ? "bg-surface-2" : "bg-surface";
  const cell = `border-b border-line/60 py-3 align-middle ${bg} group-hover:bg-surface-3`;
  const detail =
    m.generations.length > 0
      ? `${m.generations.length} generation${m.generations.length > 1 ? "s" : ""}`
      : m.modelCount > 1
        ? `${m.modelCount} models`
        : null;

  return (
    <tr className="group">
      <td className={`${cell} pl-4`}>
        <button
          type="button"
          onClick={onToggleWatch}
          aria-pressed={watched}
          aria-label={`${watched ? "Remove" : "Add"} ${m.makeName} ${m.familyName} ${watched ? "from" : "to"} watchlist`}
          className={`grid size-8 place-items-center rounded-full transition-colors hover:bg-forest-900 ${watched ? "text-forest-400" : "text-faint hover:text-muted"}`}
        >
          <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden="true">
            <path
              d="M10 17s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 10 6.2a3.6 3.6 0 0 1 6.5 2.2C16.5 13.1 10 17 10 17Z"
              fill={watched ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </td>
      <td className={`${cell} text-[13px] text-faint tabular-nums`}>{m.rank}</td>
      <th scope="row" className={`${cell} sticky left-0 z-10 pr-4 text-left font-normal sm:static`}>
        <div className="flex items-center gap-3">
          <Monogram make={m.makeName} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-[15px] font-semibold text-fg">{m.familyName}</span>
              <span className="text-[13px] text-muted">{m.makeName}</span>
            </div>
            <div
              className="mt-0.5 text-xs whitespace-nowrap text-faint"
              title={m.generations.length ? `Generations: ${m.generations.join(", ")}` : undefined}
            >
              {[m.bodyStyle, detail].filter(Boolean).join(" · ")}
            </div>
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
            <ValueLine key={r.label} metric={METRICS.success} market={m} row={r} valueWidth={52} />
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
    metric.key === "success" ? ` (${cur.reserveSold} of ${cur.reserveAuctions} reserve auctions sold)` : "";
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

function MetricHeader({
  metric,
  sort,
  onSort,
  last,
  children,
}: {
  metric: Metric;
  sort: Sort;
  onSort: (key: MetricKey) => void;
  last?: boolean;
  children?: React.ReactNode;
}) {
  const active = sort.key === metric.key;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`border-b border-line py-3 align-bottom font-medium ${last ? "pr-5" : "pr-4"}`}
    >
      <SortButton active={active} dir={sort.dir} onClick={() => onSort(metric.key)} title={metric.help}>
        {metric.label}
      </SortButton>
      {children}
    </th>
  );
}

function SortButton({
  active,
  dir,
  onClick,
  title,
  children,
}: {
  active: boolean;
  dir: Sort["dir"];
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-fg ${active ? "text-fg" : ""}`}
    >
      {children}
      <svg viewBox="0 0 10 14" className="h-3 w-2.5 shrink-0" aria-hidden="true">
        <path d="M5 1 8.5 5h-7z" className={active && dir === "asc" ? "fill-forest-400" : "fill-faint/50"} />
        <path d="M5 13 1.5 9h7z" className={active && dir === "desc" ? "fill-forest-400" : "fill-faint/50"} />
      </svg>
    </button>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="grid auto-rows-[24px] items-center gap-1">{children}</div>;
}

function Swatch({ className }: { className: string }) {
  return <span className={`inline-block w-2.5 rounded-[1px] align-middle ${className}`} aria-hidden="true" />;
}

// Stand-in for a family photo until images are wired up: the make's initials.
function Monogram({ make }: { make: string }) {
  const words = make.split(/[\s-]+/).filter(Boolean);
  const text =
    words.length > 1 ? words.map((w) => w[0]).join("") : make.length <= 4 && make === make.toUpperCase() ? make : make[0];
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-forest-700 to-forest-900 text-[12px] font-semibold tracking-tight text-forest-200 ring-1 ring-forest-700/70"
      aria-hidden="true"
    >
      {text}
    </span>
  );
}

// Watched families live in localStorage: per-browser, no account needed yet.
const WATCH_KEY = "od.watchlist";
const listeners = new Set<() => void>();
let cache: { raw: string | null; set: Set<string> } = { raw: null, set: new Set() };

function readWatchlist(): Set<string> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WATCH_KEY);
  } catch {}
  if (raw !== cache.raw) {
    let ids: string[] = [];
    try {
      ids = raw ? JSON.parse(raw) : [];
    } catch {}
    cache = { raw, set: new Set(ids) };
  }
  return cache.set;
}

const EMPTY = new Set<string>();

function useWatchlist() {
  const set = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    readWatchlist,
    () => EMPTY,
  );
  return {
    set,
    size: set.size,
    has: (id: string) => set.has(id),
    toggle: (id: string) => {
      const next = new Set(readWatchlist());
      if (!next.delete(id)) next.add(id);
      try {
        localStorage.setItem(WATCH_KEY, JSON.stringify([...next]));
      } catch {}
      listeners.forEach((l) => l());
    },
  };
}
