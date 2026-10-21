import { MarketsTable } from "@/components/markets-table";
import { SummaryTiles } from "@/components/summary-tiles";
import { getMarkets, getMarketSummary } from "@/lib/markets";
import { logScale } from "@/lib/scale";

const TOP_N = 10;

export default async function HomePage() {
  // The Markets tab's full (cached) list: the tiles count all of it, the table shows its top.
  const [allMarkets, summary] = await Promise.all([getMarkets(null), getMarketSummary()]);
  const markets = allMarkets.slice(0, TOP_N);

  const scale = logScale(
    markets.flatMap((m) => Object.values(m.windows).flatMap((w) => [w.p25 ?? NaN, w.p75 ?? NaN])),
  );

  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pt-9 pb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">OverDrive Market Intelligence</h1>
          <div className="mt-1.5 max-w-2xl space-y-2 text-sm text-muted">
            <p>
              Tracking pricing and volume movement across enthusiast car auction results. Currently sourced from{" "}
              <a
                href="https://carsandbids.com/"
                target="_blank"
                rel="noreferrer"
                className="text-forest-300 underline decoration-forest-700 underline-offset-4 hover:decoration-forest-400"
              >
                Cars &amp; Bids
              </a>{" "}
              with more sources to come.
            </p>
            <p>Click into markets below for detailed breakdowns of each model.</p>
          </div>
        </div>
      </div>

      <SummaryTiles
        summary={summary}
        tracked={allMarkets.length}
        added={allMarkets.filter((m) => m.isNew).length}
      />
      <MarketsTable markets={markets} scale={scale} />

    </main>
  );
}
