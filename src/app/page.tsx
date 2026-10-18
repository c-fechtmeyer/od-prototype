import { MarketsTable } from "@/components/markets-table";
import { SiteHeader } from "@/components/site-header";
import { StatusBar } from "@/components/status-bar";
import { SummaryTiles } from "@/components/summary-tiles";
import { formatPct, ratio } from "@/lib/format";
import { getMarkets } from "@/lib/markets";
import { logScale } from "@/lib/scale";

export default async function MarketsPage() {
  const { markets, summary } = await getMarkets();

  const scale = logScale(
    markets.flatMap((m) => Object.values(m.windows).flatMap((w) => [w.p25 ?? NaN, w.p75 ?? NaN])),
  );
  const top25Share = ratio(
    markets.reduce((n, m) => n + m.windows.c365.auctions, 0),
    summary.windows.c365.auctions,
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pt-9 pb-6">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">Markets</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted">
              The 25 most-listed model families on Cars &amp; Bids over the last 365 days, which together
              account for {formatPct(top25Share, 0)} of all listings. Each row shows the last 365 and 180 days
              against the same span a year earlier.
            </p>
          </div>
        </div>

        <SummaryTiles summary={summary} />
        <MarketsTable markets={markets} scale={scale} />
      </main>
      <StatusBar totalAuctions={summary.totalAuctions} latestAuctionEnd={summary.latestAuctionEnd} />
    </>
  );
}
