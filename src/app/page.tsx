import Link from "next/link";
import { MarketsTable } from "@/components/markets-table";
import { SummaryTiles } from "@/components/summary-tiles";
import { formatPct, ratio } from "@/lib/format";
import { getMarkets } from "@/lib/markets";
import { logScale } from "@/lib/scale";

const TOP_N = 10;

export default async function MarketsPage() {
  const { markets, summary } = await getMarkets(TOP_N);

  const scale = logScale(
    markets.flatMap((m) => Object.values(m.windows).flatMap((w) => [w.p25 ?? NaN, w.p75 ?? NaN])),
  );
  const topShare = ratio(
    markets.reduce((n, m) => n + m.windows.c365.auctions, 0),
    summary.windows.c365.auctions,
  );

  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pt-9 pb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Markets</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            The {TOP_N} most-listed model families on Cars &amp; Bids over the last 365 days, which together
            account for {formatPct(topShare, 0)} of all listings. Each row shows the last 365 and 180 days
            against the same span a year earlier.
          </p>
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
