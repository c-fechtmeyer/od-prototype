import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About · OD",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-9 pb-16 sm:px-6 lg:px-8">
      <h1 className="text-[28px] font-semibold tracking-tight">About</h1>

      <section className="mt-8 max-w-2xl">
        <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Source</h2>
        <p className="mt-2 text-sm text-muted">
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
      </section>
    </main>
  );
}
