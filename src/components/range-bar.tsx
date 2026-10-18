import { formatMoney } from "@/lib/format";
import { type LogScale, scalePos } from "@/lib/scale";

type Quartiles = { p25: number | null; p50: number | null; p75: number | null };

export const RANGE_BAR_WIDTH = 150;

// Rounded so the server-rendered style matches what the browser reports at hydration.
const pct = (t: number) => `${(t * 100).toFixed(2)}%`;

// P25–P75 sale band on the shared log scale: the current window on top (with a
// median tick), the same window a year earlier underneath as a gray comp.
export function RangeBar({
  scale,
  current,
  prior,
  label,
}: {
  scale: LogScale;
  current: Quartiles;
  prior: Quartiles;
  label: string;
}) {
  const band = (q: Quartiles) =>
    q.p25 != null && q.p75 != null
      ? { left: pct(scalePos(scale, q.p25)), width: pct(scalePos(scale, q.p75) - scalePos(scale, q.p25)) }
      : null;
  const cur = band(current);
  const pri = band(prior);
  const describe = (q: Quartiles) =>
    q.p25 == null ? "no sales" : `${formatMoney(q.p25)}–${formatMoney(q.p75)}, median ${formatMoney(q.p50)}`;
  const title = `${label}: ${describe(current)}\nYear earlier: ${describe(prior)}`;

  return (
    <div className="relative h-[14px] shrink-0" style={{ width: RANGE_BAR_WIDTH }} title={title} aria-label={title} role="img">
      {scale.ticks.map((t) => (
        <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(scalePos(scale, t)) }} />
      ))}
      {cur && (
        <span
          className="absolute top-[1px] h-[6px] min-w-[3px] rounded-[2px] bg-chart-current"
          style={cur}
        />
      )}
      {cur && current.p50 != null && (
        <span
          className="absolute top-0 h-[8px] w-[2px] -translate-x-1/2 rounded-full bg-fg"
          style={{ left: pct(scalePos(scale, current.p50)) }}
        />
      )}
      {pri && (
        <span
          className="absolute top-[10px] h-[3px] min-w-[3px] rounded-[2px] bg-chart-prior"
          style={pri}
        />
      )}
    </div>
  );
}

export function RangeAxis({ scale }: { scale: LogScale }) {
  return (
    <div className="relative h-3 shrink-0" style={{ width: RANGE_BAR_WIDTH }} aria-hidden="true">
      {scale.ticks.map((t) => (
        <span
          key={t}
          className="absolute -translate-x-1/2 text-[10px] leading-3 font-normal text-faint tabular-nums"
          style={{ left: pct(scalePos(scale, t)) }}
        >
          {formatMoney(t)}
        </span>
      ))}
    </div>
  );
}
