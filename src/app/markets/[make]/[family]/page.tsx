import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuctionResults } from "@/components/auction-results";
import { AuctionScatter } from "@/components/auction-scatter";
import { FAMILY_TILES, KpiTiles } from "@/components/summary-tiles";
import { getFamilyPage, getPrerenderedFamilySlugs } from "@/lib/family";
import { formatCount } from "@/lib/format";

// The most-listed families are built ahead of time; any other family renders on
// its first visit (behind the skeleton below) and is cached from then on.
export async function generateStaticParams() {
  return getPrerenderedFamilySlugs(25);
}

export async function generateMetadata({ params }: PageProps<"/markets/[make]/[family]">): Promise<Metadata> {
  const { make, family } = await params;
  const data = await getFamilyPage(make, family);
  return { title: data ? `${data.familyName} · ${data.makeName} · OD` : "Model not found · OD" };
}

export default function FamilyRoute({ params }: PageProps<"/markets/[make]/[family]">) {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <Link href="/markets" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Markets
      </Link>
      {/* params is awaited inside the boundary, so unlisted families still get an instant shell. */}
      <Suspense fallback={<FamilySkeleton />}>
        <FamilyContent params={params} />
      </Suspense>
    </main>
  );
}

async function FamilyContent({ params }: { params: PageProps<"/markets/[make]/[family]">["params"] }) {
  const { make, family } = await params;
  const data = await getFamilyPage(make, family);
  if (!data) notFound();

  const oldest = data.auctions.at(-1);
  const since = oldest
    ? new Date(oldest.ended).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  return (
    <>
      <div className="pt-3 pb-6">
        <h1 className="flex flex-wrap items-baseline gap-x-3 text-[28px] font-semibold tracking-tight">
          {data.familyName}
          <span className="text-lg font-normal text-muted">{data.makeName}</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {formatCount(data.auctions.length)} auction{data.auctions.length === 1 ? "" : "s"} on Cars &amp; Bids
          {since && ` since ${since}`}
          {data.generations.length > 0 && (
            <span title={data.generations.join(", ")}>
              {" "}
              · {data.generations.length} generation{data.generations.length > 1 ? "s" : ""}
            </span>
          )}
        </p>
      </div>

      <KpiTiles label={`${data.makeName} ${data.familyName} auctions`} tiles={FAMILY_TILES} windows={data.windows} />

      <div className="mt-6">
        <AuctionScatter auctions={data.auctions} />
      </div>

      <div className="mt-10">
        <AuctionResults auctions={data.auctions} showGeneration={data.generations.length > 0} />
      </div>
    </>
  );
}

function FamilySkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading model" role="status">
      <div className="pt-3 pb-6">
        <div className="h-8 w-48 rounded-md bg-surface-3" />
        <div className="mt-3 h-4 w-72 rounded bg-surface-3" />
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
