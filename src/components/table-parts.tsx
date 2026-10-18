// Pieces shared by the Home table and the Markets list, so the two stay consistent.
import { type ReactNode, useEffect, useRef } from "react";
import { RangeAxis } from "@/components/range-bar";
import { INSUFFICIENT } from "@/lib/format";
import type { Metric, MetricKey } from "@/lib/metrics";
import type { LogScale } from "@/lib/scale";

export type Sort = { key: "rank" | MetricKey; dir: "asc" | "desc" };

export const DEFAULT_SORT: Sort = { key: "rank", dir: "asc" };

// Click cycle for a header: metrics go desc → asc → back to rank; rank flips asc/desc.
export function nextSort(s: Sort, key: Sort["key"]): Sort {
  if (s.key !== key) return { key, dir: key === "rank" ? "asc" : "desc" };
  if (key === "rank") return { key, dir: s.dir === "asc" ? "desc" : "asc" };
  return s.dir === "desc" ? { key, dir: "asc" } : DEFAULT_SORT;
}

// Rank order, or the metric's value in the given window; rows without a value sink.
export function sortRows<T>(rows: T[], sort: Sort, metricValue: (row: T) => number | null): T[] {
  if (sort.key === "rank") return sort.dir === "asc" ? rows : [...rows].reverse();
  return [...rows].sort((a, b) => {
    const av = metricValue(a);
    const bv = metricValue(b);
    if (av == null) return 1;
    if (bv == null) return -1;
    return sort.dir === "asc" ? av - bv : bv - av;
  });
}

export function matchesQuery(m: { makeName: string; familyName: string; generations: string[] }, query: string) {
  const q = query.trim().toLowerCase();
  return !q || [m.makeName, m.familyName, ...m.generations].join(" ").toLowerCase().includes(q);
}

// "/" focuses the box from anywhere on the page; Escape clears it.
export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
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
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        placeholder="Search make, model, generation…"
        className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint"
      />
      <kbd className="rounded border border-line-strong px-1.5 font-mono text-[11px] text-faint">/</kbd>
    </label>
  );
}

export function SortChip({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs text-muted hover:text-fg"
    >
      Sorted by {label}
      <span aria-hidden="true">×</span>
      <span className="sr-only">Reset sort</span>
    </button>
  );
}

// A row of mutually exclusive options (window, page size, ...).
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format = String,
  describedBy,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  describedBy?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      className="flex h-8 rounded-lg border border-line bg-surface p-0.5 text-xs"
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          onClick={() => onChange(o)}
          className={`rounded-md px-2.5 font-medium tabular-nums transition-colors ${
            o === value ? "bg-forest-800 text-forest-200" : "text-muted hover:text-fg"
          }`}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}

export function MetricHeader({
  metric,
  sort,
  onSort,
  className = "pr-4",
  children,
}: {
  metric: Metric;
  sort: Sort;
  onSort: (key: MetricKey) => void;
  className?: string;
  children?: ReactNode;
}) {
  const active = sort.key === metric.key;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`border-b border-line py-3 align-bottom font-medium ${className}`}
    >
      <SortButton active={active} dir={sort.dir} onClick={() => onSort(metric.key)} title={metric.help}>
        {metric.label}
      </SortButton>
      {children}
    </th>
  );
}

export function SortButton({
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
  children: ReactNode;
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

// Now / Yr Ago legend and price axis, offset to sit over the range bars.
export function PriceLegend({ scale }: { scale: LogScale }) {
  return (
    <div className="mt-2 ml-[104px] space-y-1.5">
      <div className="flex items-center gap-3 text-[10px] font-normal text-faint">
        <span className="inline-flex items-center gap-1">
          <Swatch className="h-[6px] bg-chart-current" /> Now
        </span>
        <span className="inline-flex items-center gap-1">
          <Swatch className="h-[3px] bg-chart-prior" /> Yr Ago
        </span>
      </div>
      <RangeAxis scale={scale} />
    </div>
  );
}

function Swatch({ className }: { className: string }) {
  return <span className={`inline-block w-2.5 rounded-[1px] align-middle ${className}`} aria-hidden="true" />;
}

// A metric value that can't be computed reads as quiet text rather than a number.
export function MetricValue({ text, width }: { text: string; width: number }) {
  if (text === INSUFFICIENT) {
    return <span className="text-xs whitespace-nowrap text-faint">{text}</span>;
  }
  return (
    <span className="font-medium text-fg tabular-nums" style={{ width }}>
      {text}
    </span>
  );
}

// Stand-in for a family photo until images are wired up: the make's initials.
export function Monogram({ make, size = "md" }: { make: string; size?: "sm" | "md" }) {
  const words = make.split(/[\s-]+/).filter(Boolean);
  const text =
    words.length > 1 ? words.map((w) => w[0]).join("") : make.length <= 4 && make === make.toUpperCase() ? make : make[0];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-forest-700 to-forest-900 font-semibold tracking-tight text-forest-200 ring-1 ring-forest-700/70 ${
        size === "sm" ? "size-7 text-[9px]" : "size-10 text-[12px]"
      }`}
      aria-hidden="true"
    >
      {text}
    </span>
  );
}
