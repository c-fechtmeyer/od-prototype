import Link from "next/link";
import { MarketsTable } from "@/components/markets-table";
import { SummaryTiles } from "@/components/summary-tiles";
import { getMarkets } from "@/lib/markets";
import { logScale } from "@/lib/scale";

const TOP_N = 10;

export default async function HomePage() {
  const { markets, summary } = await getMarkets(TOP_N);

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
              with more auction sources to come.
            </p>
            <p>Click into markets below for detailed breakdowns of each model.</p>
          </div>
        </div>
      </div>

      <SummaryTiles summary={summary} />
      <MarketsTable markets={markets} scale={scale} />

      <div className="mt-8 flex justify-center">
        <Link
          href="/markets"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-forest-500 px-6 text-sm font-semibold text-canvas transition-colors hover:bg-forest-400"
        >
          See All Markets
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path
              d="M3 8h10m-4-4 4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </main>
  );
}
