import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { MarketsList } from "@/components/markets-list";
import { ModelsTracked } from "@/components/models-tracked";
import { KpiTiles, MAKE_TILES } from "@/components/summary-tiles";
import { getMakePage, getPrerenderedMakeSlugs } from "@/lib/make";
import { logScale } from "@/lib/scale";

// The makes of the most-listed families are built ahead of time; any other make
// renders on its first visit (behind the skeleton below) and is cached from then on.
export async function generateStaticParams() {
  return getPrerenderedMakeSlugs(25);
}

export async function generateMetadata({ params }: PageProps<"/markets/[make]">): Promise<Metadata> {
  const { make } = await params;
  const data = await getMakePage(make);
  return { title: data ? `${data.makeName} · OD` : "Make not found · OD" };
}

export default function MakeRoute({ params }: PageProps<"/markets/[make]">) {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <BackLink href="/markets">Markets</BackLink>
      <Suspense fallback={<MakeSkeleton />}>
        <MakeContent params={params} />
      </Suspense>
    </main>
  );
}

async function MakeContent({ params }: { params: PageProps<"/markets/[make]">["params"] }) {
  const { make } = await params;
  const data = await getMakePage(make);
  if (!data) notFound();
  const { makeName, markets } = data;

  // Same axis rule as the Markets tab, over this make's families only.
  const scale = logScale(
    markets.flatMap((m) => Object.values(m.windows).flatMap((w) => [w.p25 ?? NaN, w.p75 ?? NaN])),
    { trim: 0.02 },
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-3 pb-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">{makeName}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            All {makeName} models with auction history, ranked by listings over the last 365 days. Ranks are overall,
            among every model on the Markets tab.
          </p>
        </div>
        <ModelsTracked total={markets.length} added={markets.filter((m) => m.isNew).length} makeName={makeName} />
      </div>

      <KpiTiles label={`${makeName} auctions`} tiles={MAKE_TILES} windows={data.windows} />

      <h2 className="mt-8 mb-4 text-lg font-semibold tracking-tight">Models</h2>
      <MarketsList markets={markets} scale={scale} make={{ name: makeName, totalMarkets: data.totalMarkets }} />
    </>
  );
}

function MakeSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading" role="status">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-3 pb-6">
        <div className="h-8 w-48 rounded-md bg-surface-3" />
        <div className="h-[106px] w-full rounded-xl border border-line bg-surface/80 sm:w-[260px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[106px] rounded-xl border border-line bg-surface/80" />
        ))}
      </div>
      <div className="mt-[72px] h-[420px] rounded-2xl border border-line bg-surface/80" />
    </div>
  );
}
