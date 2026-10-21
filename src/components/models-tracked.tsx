import { InfoTip } from "@/components/info-tip";
import { formatCount } from "@/lib/format";

// Header KPI on the Markets tab and make pages: how many model families the data
// covers (of one make, when makeName is set), and how many of them first appeared
// in the last 365 days.
export function ModelsTracked({ total, added, makeName }: { total: number; added: number; makeName?: string }) {
  return (
    <div className="w-full rounded-xl border border-line bg-surface/80 px-4 py-3.5 sm:w-auto sm:min-w-[260px]">
      <div className="mb-1.5 text-xs font-medium text-muted">
        Models{" "}
        <span className="whitespace-nowrap">
          Tracked
          <InfoTip id="models-tracked-def" label="Models Tracked" className="ml-1.5 align-[-3px]">
            {makeName ? `${makeName} model families` : "Model families"} with at least one observed auction on Cars
            &amp; Bids.
            <span className="mt-1.5 block text-faint">
              New models are families whose first observed auction ended in the last 365 days.
            </span>
          </InfoTip>
        </span>
      </div>
      <div className="text-[22px] font-semibold tracking-tight sm:text-[26px]">{formatCount(total)}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {added > 0 ? (
          <>
            <span className="rounded bg-forest-900 px-1.5 py-0.5 font-medium text-forest-300 tabular-nums">
              +{formatCount(added)} new
            </span>
            in the last 365 days
          </>
        ) : (
          "No new models in the last 365 days"
        )}
      </div>
    </div>
  );
}
