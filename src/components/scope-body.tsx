import { AuctionResults } from "@/components/auction-results";
import { AuctionScatter } from "@/components/auction-scatter";
import { PriceByColor } from "@/components/price-by-color";
import { PriceDistribution } from "@/components/price-distribution";
import { SameVinSales } from "@/components/same-vin-sales";
import { KpiTiles, familyTiles } from "@/components/summary-tiles";
import type { FamilyPage } from "@/lib/family";
import { formatCount } from "@/lib/format";

// The body of a family page or generation sub-page: a summary line, KPI tiles,
// the auction results scatter, the price charts, same-VIN sales and the latest
// results table, all for one scope.
export function ScopeBody({ data }: { data: FamilyPage }) {
  const { nav, generation, auctions } = data;
  const oldest = auctions.at(-1);
  const since = oldest
    ? new Date(oldest.ended).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;
  const scopeName = `${nav.makeName} ${nav.familyName}${generation ? ` ${generation.label}` : ""}`;

  return (
    <>
      <p className="pt-5 pb-5 text-sm text-muted">
        {generation && <span className="font-semibold text-fg">{generation.label} · </span>}
        {formatCount(auctions.length)} auction{auctions.length === 1 ? "" : "s"} on Cars &amp; Bids
        {since && ` since ${since}`}
      </p>

      <KpiTiles label={`${scopeName} auctions`} tiles={familyTiles(data.allWindows)} windows={data.windows} />

      <div className="mt-6">
        <AuctionScatter auctions={auctions} asOf={data.asOf} allAuctions={data.allWindows.c365} />
      </div>

      {/* Last year's price picture: the distribution against the year before, and by color. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PriceDistribution auctions={auctions} />
        </div>
        <div className="lg:col-span-2">
          <PriceByColor auctions={auctions} />
        </div>
      </div>

      <div className="mt-6">
        <SameVinSales auctions={auctions} />
      </div>

      <div className="mt-10">
        {/* Within a generation every row has the same generation, so the column goes. */}
        <AuctionResults auctions={auctions} showGeneration={!generation && nav.generations.length > 0} />
      </div>
    </>
  );
}

export function ScopeSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading" role="status">
      <div className="py-5">
        <div className="h-4 w-72 rounded bg-surface-3" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[106px] rounded-xl border border-line bg-surface/80" />
        ))}
      </div>
      <div className="mt-6 h-[480px] rounded-2xl border border-line bg-surface/80" />
    </div>
  );
}
