import type { Metadata } from "next";
import { MarketsList } from "@/components/markets-list";
import { ModelsTracked } from "@/components/models-tracked";
import { getMarkets } from "@/lib/markets";
import { logScale } from "@/lib/scale";

export const metadata: Metadata = {
  title: "Markets · OD",
};

export default async function MarketsPage() {
  const markets = await getMarkets(null);

  // Trim the extreme 2% at each end so the long tail of very cheap and very
  // expensive families doesn't squash every other bar.
  const scale = logScale(
    markets.flatMap((m) => Object.values(m.windows).flatMap((w) => [w.p25 ?? NaN, w.p75 ?? NaN])),
    { trim: 0.02 },
  );

  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-9 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Markets</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            All models with auction history, ranked by listings over the last 365 days.
          </p>
        </div>
        <ModelsTracked total={markets.length} added={markets.filter((m) => m.isNew).length} />
      </div>
      <MarketsList markets={markets} scale={scale} />
    </main>
  );
}
