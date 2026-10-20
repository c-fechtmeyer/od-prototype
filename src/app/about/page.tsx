import type { Metadata } from "next";
import type { ReactNode } from "react";
import { formatCount, formatDate } from "@/lib/format";
import { STALE_AFTER_DAYS, getArchiveStatus } from "@/lib/markets";

export const metadata: Metadata = {
  title: "About · OD",
};

const link = "text-forest-300 underline decoration-forest-700 underline-offset-4 hover:decoration-forest-400";

export default async function AboutPage() {
  const status = await getArchiveStatus();

  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-9 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-[28px] font-semibold tracking-tight">About</h1>

        <div className="mt-8 space-y-10">
          <Section title="What is OverDrive" side="left">
            <p>
              A prototype web app giving pricing intelligence for the enthusiast car market. It pulls from an archive of
              publicly available scraped car auction data and synthesizes results into an explorable and (hopefully)
              easy to digest format.
            </p>
            <p>
              It is meant to be a demonstration of applied data strategy, AI fluency, as well as expertise in data
              product development.
            </p>
            <p>All code for this project was written by AI 🤖</p>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-line bg-surface-2/60 p-4 text-sm sm:grid-cols-4">
              <Stat label="Source">
                <a href="https://carsandbids.com" target="_blank" rel="noreferrer" className={link}>
                  Cars &amp; Bids
                </a>
              </Stat>
              <Stat label="Auctions archived">
                <span className="tabular-nums">{formatCount(status.totalAuctions)}</span>
              </Stat>
              <Stat label="Latest auctions through">{formatDate(status.latestAuctionEnd)}</Stat>
              {/* Stale only once the latest auction is older than a normal Mon–Fri weekend gap. */}
              <Stat label="Status">
                {status.fresh ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-forest-900 px-2 py-0.5 text-xs font-medium text-forest-300">
                    <span className="size-1.5 rounded-full bg-forest-400" aria-hidden="true" />
                    Synced
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-3 px-2 py-0.5 text-xs font-medium text-down">
                    <span className="size-1.5 rounded-full bg-down" aria-hidden="true" />
                    Stale
                  </span>
                )}
              </Stat>
              <p className="col-span-2 text-xs text-faint sm:col-span-4">
                Loaded daily · page refreshes hourly
                {!status.fresh && ` · no auctions have ended in the last ${STALE_AFTER_DAYS} days`}
              </p>
            </dl>
          </Section>

          <Section title="Creator" side="right">
            <p>
              Christian Fechtmeyer -{" "}
              <a href="https://www.linkedin.com/in/christianfechtmeyer/" target="_blank" rel="noreferrer" className={link}>
                LinkedIn
              </a>
              ,{" "}
              <a href="https://github.com/c-fechtmeyer/od-prototype" target="_blank" rel="noreferrer" className={link}>
                GitHub
              </a>
            </p>
            <p>
              I love cars, I love data and more importantly I love <em>insightful</em> data. I couldn’t find any tools
              that allowed me to easily explore pricing and trend data for enthusiast cars, so I built one.
            </p>
            <p>It’s an early stage prototype, but one I plan to continue developing.</p>
          </Section>

          <Section title="Opportunities & Challenges" side="left">
            <p>
              The growth of online car auction websites has exploded the visibility and availability of enthusiast cars
              (and data surrounding them) to a much wider audience.
            </p>
            <p className="font-semibold text-fg">Opportunities that propel projects like OverDrive:</p>
            <Bullets
              items={[
                "The growth of a creator-driven economy around cars and car media. See Doug DeMuro, car YouTuber and founder of Cars & Bids, the platform that inspired this project.",
                "Growing availability of publicly available data with rich detail, especially for mid-market, $25K-$250K enthusiast cars.",
                "AI-empowered data handling enabling much more sophisticated methods for parsing and analyzing large structured, semi- and unstructured data.",
              ]}
            />
            <p className="font-semibold text-fg">Challenges that need a thoughtful approach:</p>
            <Bullets
              items={[
                <>
                  Fragmented and low volume data is <em>the</em> issue endemic to the automotive space and for some
                  makes/models/trims there is simply no way around it.
                </>,
                "Online auctions are growing but are still a small proportion and lopsided towards the lower end versus high end live auctions.",
                "Vehicle taxonomy is the single biggest rock which limits analytical capability. Auction listings are rich sources, a strong taxonomy backbone gives a foundation to build on.",
              ]}
            />
          </Section>

          <Section title="Next Steps" side="right">
            <p>Next steps for this project fall into the following buckets:</p>
            <Bullets
              items={[
                <Term key="volume" term="Data volume">
                  Ingesting more auction results by incorporating more sources
                </Term>,
                <Term key="parsing" term="More sophisticated parsing">
                  Auction results contain a trove of data that could support taxonomy build out and more sophisticated
                  analyses.
                </Term>,
                <Term key="live" term="Live auctions">
                  Bring in links to actual live auctions so a user can act on market intelligence.
                </Term>,
                <Term key="app" term="App functionality">
                  Create user functionality for following markets, making watchlists, future state email notifications,
                  price predictions, future classic spotting, the sky is the limit.
                </Term>,
              ]}
            />
          </Section>
        </div>

        <p className="mt-14 border-t border-line pt-4 text-xs text-faint italic">
          About page written entirely by human hands 👋
        </p>
      </div>
    </main>
  );
}

// A heading and its text box. Sections alternate sides: each one shifts slightly toward
// its side, and the heading moves with its box. Headings and text stay left-aligned.
function Section({ title, side, children }: { title: string; side: "left" | "right"; children: ReactNode }) {
  const right = side === "right";
  return (
    <section className={`md:w-[88%] ${right ? "md:ml-auto" : ""}`}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface/80 px-5 py-4 text-left text-sm leading-relaxed text-muted sm:px-6 sm:py-5">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-forest-400" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// "Term - description", with the term emphasized.
function Term({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <span className="font-medium text-fg">{term}</span> - {children}
    </>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
