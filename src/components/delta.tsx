import { INSUFFICIENT } from "@/lib/format";

// A YoY change: arrow + signed magnitude. Color reinforces the arrow, never replaces it.
export function Delta({
  value,
  kind = "pct",
  className = "",
}: {
  value: number | null;
  kind?: "pct" | "pp";
  className?: string;
}) {
  if (value == null) {
    return (
      <span className={`whitespace-nowrap text-faint ${className}`}>{INSUFFICIENT}</span>
    );
  }
  const pct = Math.abs(value * 100);
  const text = `${pct >= 1000 ? pct.toFixed(0) : pct.toFixed(1)}${kind === "pp" ? "pp" : "%"}`;
  if (pct < 0.05) {
    return <span className={`text-faint ${className}`}>{`0.0${kind === "pp" ? "pp" : "%"}`}</span>;
  }
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${up ? "text-up" : "text-down"} ${className}`}
      aria-label={`${up ? "up" : "down"} ${text} year over year`}
    >
      <svg viewBox="0 0 8 8" className="size-[7px] shrink-0" aria-hidden="true">
        <path d={up ? "M4 1 7.5 7h-7z" : "M4 7 .5 1h7z"} fill="currentColor" />
      </svg>
      {text}
    </span>
  );
}
