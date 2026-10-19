"use client";

import { type KeyboardEvent, useId, useMemo, useState } from "react";
import type { FamilyAuction } from "@/lib/family";
import { formatCount } from "@/lib/format";

// Filters for the auction results scatter. Everything starts selected; a filter
// records what the viewer has removed, so "nothing removed" means "show all".

export const MILES_MAX = 200_000; // the slider's top stop means "200k and up"
const MILES_STEP = 5_000;

type TagKey = "bodyStyle" | "color" | "transmission";
export type Option = { key: string; label: string; count: number };
export type FilterOptions = Record<TagKey | "driveTrain", Option[]> & {
  years: [number, number] | null; // earliest and latest model year on the chart
};
export type Filters = {
  removed: Record<TagKey | "driveTrain", Set<string>>;
  miles: [number, number];
  years: [number, number] | null; // null: every year on the chart
};

export const EMPTY_FILTERS: Filters = {
  removed: { bodyStyle: new Set(), color: new Set(), transmission: new Set(), driveTrain: new Set() },
  miles: [0, MILES_MAX],
  years: null,
};

const NONE = "__none";
// Paint names differ only in case or spacing ("Black", "black "), so they're keyed
// case-folded and labelled with their most common spelling.
const colorKey = (raw: string | null) => raw?.trim().toLowerCase() || NONE;
const keyOf: Record<TagKey | "driveTrain", (a: FamilyAuction) => string> = {
  bodyStyle: (a) => a.bodyStyle ?? NONE,
  color: (a) => colorKey(a.exteriorColor),
  transmission: (a) => a.transmission ?? NONE,
  driveTrain: (a) => a.driveTrain ?? NONE,
};

// Options for each filter, built from the auctions on the chart, most common first.
export function buildOptions(auctions: FamilyAuction[]): FilterOptions {
  const build = (dim: TagKey | "driveTrain", label: (a: FamilyAuction) => string | null) => {
    const counts = new Map<string, { count: number; spellings: Map<string, number> }>();
    for (const a of auctions) {
      const key = keyOf[dim](a);
      const entry = counts.get(key) ?? { count: 0, spellings: new Map() };
      entry.count++;
      const name = label(a)?.trim() || "Not listed";
      entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
      counts.set(key, entry);
    }
    return [...counts.entries()]
      .map(([key, { count, spellings }]) => ({
        key,
        count,
        label: [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };
  const years = auctions.map((a) => a.year).filter((y) => y != null);
  return {
    bodyStyle: build("bodyStyle", (a) => a.bodyStyle),
    color: build("color", (a) => a.exteriorColor),
    transmission: build("transmission", (a) => a.transmission),
    driveTrain: build("driveTrain", (a) => a.driveTrain),
    years: years.length ? [Math.min(...years), Math.max(...years)] : null,
  };
}

export function matches(a: FamilyAuction, f: Filters): boolean {
  for (const dim of ["bodyStyle", "color", "transmission", "driveTrain"] as const) {
    if (f.removed[dim].has(keyOf[dim](a))) return false;
  }
  if (f.years && (a.year == null || a.year < f.years[0] || a.year > f.years[1])) return false;
  const [lo, hi] = f.miles;
  if (lo === 0 && hi === MILES_MAX) return true; // full range: mileage unknown is fine too
  if (a.mileage == null) return false;
  return a.mileage >= lo && (hi === MILES_MAX || a.mileage <= hi);
}

export const isFiltered = (f: Filters) =>
  Object.values(f.removed).some((s) => s.size > 0) ||
  f.years != null ||
  f.miles[0] !== 0 ||
  f.miles[1] !== MILES_MAX;

export function ScatterFilters({
  options,
  filters,
  onChange,
  shown,
  total,
}: {
  options: FilterOptions;
  filters: Filters;
  onChange: (f: Filters) => void;
  shown: number;
  total: number;
}) {
  const [openOnPhone, setOpenOnPhone] = useState(false);
  const setRemoved = (dim: TagKey | "driveTrain", removed: Set<string>) =>
    onChange({ ...filters, removed: { ...filters.removed, [dim]: removed } });

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface-2/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:mb-3">
        {/* On phones the controls fold away behind this button; from md up they're always shown. */}
        <button
          type="button"
          onClick={() => setOpenOnPhone((o) => !o)}
          aria-expanded={openOnPhone}
          className="inline-flex items-center gap-1 font-medium text-muted md:pointer-events-none"
        >
          Filters
          <svg
            viewBox="0 0 16 16"
            className={`size-3.5 transition-transform md:hidden ${openOnPhone ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="flex items-center gap-3 text-faint">
          <span className="tabular-nums">
            Showing {formatCount(shown)} of {formatCount(total)} auctions
          </span>
          {isFiltered(filters) && (
            <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="font-medium text-forest-300 hover:text-forest-200">
              Reset all
            </button>
          )}
        </span>
      </div>

      <div className={`${openOnPhone ? "mt-3 grid" : "hidden"} gap-x-6 gap-y-4 md:grid md:grid-cols-2 lg:grid-cols-5`}>
        <TagFilter
          label="Body Style"
          options={options.bodyStyle}
          removed={filters.removed.bodyStyle}
          onChange={(s) => setRemoved("bodyStyle", s)}
        />
        <TagFilter
          label="Transmission"
          options={options.transmission}
          removed={filters.removed.transmission}
          onChange={(s) => setRemoved("transmission", s)}
        />
        <ToggleFilter
          label="Drivetrain"
          options={options.driveTrain}
          removed={filters.removed.driveTrain}
          onChange={(s) => setRemoved("driveTrain", s)}
        />
        <YearFilter
          bounds={options.years}
          value={filters.years}
          onChange={(years) => onChange({ ...filters, years })}
        />
        <MileageFilter value={filters.miles} onChange={(miles) => onChange({ ...filters, miles })} />
        <div className="md:col-span-2 lg:col-span-5">
          <TagFilter
            label="Color"
            options={options.color}
            removed={filters.removed.color}
            onChange={(s) => setRemoved("color", s)}
            collapseAt={14}
          />
        </div>
      </div>
    </div>
  );
}

function GroupHeader({
  label,
  selected,
  total,
  onAll,
  onNone,
}: {
  label: string;
  selected: number;
  total: number;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
      <span className="font-medium text-muted">
        {label}{" "}
        <span className="font-normal text-faint tabular-nums">
          {selected === total ? "All" : `${selected} of ${total}`}
        </span>
      </span>
      <span className="flex gap-2 text-faint">
        <button type="button" onClick={onAll} disabled={selected === total} className="hover:text-fg disabled:opacity-40">
          All
        </button>
        <button type="button" onClick={onNone} disabled={selected === 0} className="hover:text-fg disabled:opacity-40">
          None
        </button>
      </span>
    </div>
  );
}

// Selected values as removable chips, plus a box that suggests removed values to add back.
function TagFilter({
  label,
  options,
  removed,
  onChange,
  collapseAt = 8,
}: {
  label: string;
  options: Option[];
  removed: Set<string>;
  onChange: (removed: Set<string>) => void;
  collapseAt?: number;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const selected = options.filter((o) => !removed.has(o.key));
  const visible = expanded ? selected : selected.slice(0, collapseAt);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => removed.has(o.key) && o.label.toLowerCase().includes(q));
  }, [options, removed, query]);

  const remove = (key: string) => onChange(new Set([...removed, key]));
  const add = (key: string) => {
    const next = new Set(removed);
    next.delete(key);
    onChange(next);
    setQuery("");
    setHighlight(0);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && suggestions[highlight]) {
      e.preventDefault();
      add(suggestions[highlight].key);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div>
      <GroupHeader
        label={label}
        selected={selected.length}
        total={options.length}
        onAll={() => onChange(new Set())}
        onNone={() => onChange(new Set(options.map((o) => o.key)))}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {visible.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => remove(o.key)}
            aria-label={`Remove ${o.label}`}
            className="group inline-flex items-center gap-1 rounded-md border border-line-strong/70 bg-surface-3 px-2 py-0.5 text-xs text-fg transition-colors hover:border-down/60"
          >
            {o.label}
            <span className="text-[10px] text-faint tabular-nums">{formatCount(o.count)}</span>
            <span aria-hidden="true" className="text-faint group-hover:text-down">
              ×
            </span>
          </button>
        ))}
        {selected.length > collapseAt && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-md px-1.5 py-0.5 text-xs text-forest-300 hover:text-forest-200"
          >
            {expanded ? "Show less" : `+${formatCount(selected.length - collapseAt)} more`}
          </button>
        )}
        {selected.length === 0 && <span className="text-xs text-faint">None selected</span>}

        {/* Add-back box: suggests only the values that have been removed, so it only appears once
            something has been. */}
        {removed.size > 0 && (
          <div className="relative">
            <input
              role="combobox"
              aria-expanded={open && suggestions.length > 0}
              aria-controls={`${id}-list`}
              aria-label={`Add ${label.toLowerCase()} back`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setHighlight(0);
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
              placeholder={`+ Add (${removed.size})`}
              className="h-6 w-28 rounded-md border border-dashed border-line-strong bg-transparent px-2 text-xs text-fg outline-none placeholder:text-faint focus:border-forest-500"
            />
            {open && suggestions.length > 0 && (
              <ul
                id={`${id}-list`}
                role="listbox"
                className="absolute top-full left-0 z-20 mt-1 max-h-56 w-56 overflow-auto rounded-lg border border-line-strong/70 bg-surface-3/95 py-1 text-xs shadow-lg shadow-black/30 backdrop-blur-md"
              >
                {suggestions.map((o, i) => (
                  <li key={o.key} role="option" aria-selected={i === highlight}>
                    <button
                      type="button"
                      // mousedown, so the pick lands before the input's blur closes the list
                      onMouseDown={(e) => {
                        e.preventDefault();
                        add(o.key);
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left ${
                        i === highlight ? "bg-forest-900 text-fg" : "text-muted"
                      }`}
                    >
                      {o.label}
                      <span className="text-[10px] text-faint tabular-nums">{formatCount(o.count)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// A few fixed values (FWD / RWD / AWD) as on/off toggles.
function ToggleFilter({
  label,
  options,
  removed,
  onChange,
}: {
  label: string;
  options: Option[];
  removed: Set<string>;
  onChange: (removed: Set<string>) => void;
}) {
  const toggle = (key: string) => {
    const next = new Set(removed);
    if (!next.delete(key)) next.add(key);
    onChange(next);
  };
  return (
    <div>
      <GroupHeader
        label={label}
        selected={options.length - removed.size}
        total={options.length}
        onAll={() => onChange(new Set())}
        onNone={() => onChange(new Set(options.map((o) => o.key)))}
      />
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = !removed.has(o.key);
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(o.key)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors ${
                on
                  ? "border-forest-600 bg-forest-900 text-forest-200"
                  : "border-line-strong/70 bg-transparent text-faint line-through decoration-faint/60"
              }`}
            >
              {o.label}
              <span className="text-[10px] text-faint tabular-nums no-underline">{formatCount(o.count)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const milesLabel = (v: number) => (v >= MILES_MAX ? "200k+" : v === 0 ? "0" : `${Math.round(v / 1000)}k`);

function MileageFilter({ value, onChange }: { value: [number, number]; onChange: (v: [number, number]) => void }) {
  return (
    <RangeSlider
      label="Mileage"
      min={0}
      max={MILES_MAX}
      step={MILES_STEP}
      minGap={MILES_STEP}
      value={value}
      onChange={onChange}
      summary={([lo, hi]) => `${milesLabel(lo)} – ${milesLabel(hi)} mi`}
      valueText={(v, end) => (end === "max" && v >= MILES_MAX ? "200,000 miles or more" : `${milesLabel(v)} miles`)}
      scale={["0", "100k", "200k+"]}
    />
  );
}

// Model years, bounded by the earliest and latest on the chart. A full range is
// stored as null, so the filter reads as off.
function YearFilter({
  bounds,
  value,
  onChange,
}: {
  bounds: [number, number] | null;
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
}) {
  if (!bounds) return null;
  const [min, max] = bounds;
  if (min === max) {
    return (
      <div className="text-[11px]">
        <span className="font-medium text-muted">Year</span> <span className="text-faint tabular-nums">{min} only</span>
      </div>
    );
  }
  return (
    <RangeSlider
      label="Year"
      min={min}
      max={max}
      step={1}
      minGap={0}
      value={value ?? bounds}
      onChange={([lo, hi]) => onChange(lo === min && hi === max ? null : [lo, hi])}
      summary={([lo, hi]) => (lo === hi ? String(lo) : `${lo} – ${hi}`)}
      valueText={(v) => String(v)}
      scale={[String(min), String(Math.round((min + max) / 2)), String(max)]}
    />
  );
}

// Two stacked range inputs on one track: a dual-thumb slider.
function RangeSlider({
  label,
  min,
  max,
  step,
  minGap,
  value,
  onChange,
  summary,
  valueText,
  scale,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  minGap: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  summary: (v: [number, number]) => string;
  valueText: (v: number, end: "min" | "max") => string;
  scale: [string, string, string];
}) {
  const [lo, hi] = value;
  const full = lo === min && hi === max;
  const pct = (v: number) => `${(((v - min) / (max - min)) * 100).toFixed(2)}%`;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-muted">
          {label} <span className="font-normal text-faint tabular-nums">{full ? "All" : summary(value)}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange([min, max])}
          disabled={full}
          className="text-faint hover:text-fg disabled:opacity-40"
        >
          All
        </button>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-3" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-forest-500"
          style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`Minimum ${label.toLowerCase()}`}
          aria-valuetext={valueText(lo, "min")}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi - minGap), hi])}
          className="range-thumb absolute inset-0 h-6 w-full"
          // When the thumbs meet near the top end, keep the min thumb on top so it can still move.
          style={{ zIndex: lo > (min + max) / 2 ? 2 : 1 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`Maximum ${label.toLowerCase()}`}
          aria-valuetext={valueText(hi, "max")}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo + minGap)])}
          className="range-thumb absolute inset-0 h-6 w-full"
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-faint tabular-nums">
        {scale.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}
