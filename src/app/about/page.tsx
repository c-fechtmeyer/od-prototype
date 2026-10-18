import type { Metadata } from "next";
import type { ReactNode } from "react";
import { formatCount, formatDate } from "@/lib/format";
import { getArchiveStatus } from "@/lib/markets";

export const metadata: Metadata = {
  title: "About · OD",
};

export default async function AboutPage() {
  const status = await getArchiveStatus();

  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-9 pb-16 sm:px-6 lg:px-8">
      <h1 className="text-[28px] font-semibold tracking-tight">About</h1>

      <Section title="Source">
        <p className="text-sm text-muted">
          Auction results from{" "}
          <a
            href="https://carsandbids.com"
            target="_blank"
            rel="noreferrer"
            className="text-forest-300 underline decoration-forest-700 underline-offset-4 hover:decoration-forest-400"
          >
            Cars &amp; Bids
          </a>
          .
        </p>
      </Section>

      <Section title="Data">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-2.5 text-sm">
          <dt className="text-faint">Status</dt>
          <dd>
            {status.fresh ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-forest-900 px-2 py-0.5 text-xs font-medium text-forest-300">
                <span className="size-1.5 rounded-full bg-forest-400" aria-hidden="true" />
                Synced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-3 px-2 py-0.5 text-xs font-medium text-down">
                <span className="size-1.5 rounded-full bg-down" aria-hidden="true" />
                Stale: no auctions in the last 2 days
              </span>
            )}
          </dd>
          <dt className="text-faint">Data through</dt>
          <dd className="text-fg">{formatDate(status.latestAuctionEnd)}</dd>
          <dt className="text-faint">Auctions archived</dt>
          <dd className="text-fg tabular-nums">{formatCount(status.totalAuctions)}</dd>
          <dt className="text-faint">Refresh</dt>
          <dd className="text-fg">Loaded daily · page refreshes hourly</dd>
        </dl>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 max-w-2xl">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-faint uppercase">{title}</h2>
      {children}
    </section>
  );
}
