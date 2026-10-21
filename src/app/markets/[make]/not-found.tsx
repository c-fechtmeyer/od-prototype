import Link from "next/link";

// Shown for an unknown make, and for an unknown family too: the family layout's
// notFound() is caught here, a segment up, not by a boundary beside it.
export default function MarketNotFound() {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Market not found</h1>
      <p className="mt-2 text-sm text-muted">We don&apos;t have any auctions for that make or model yet.</p>
      <Link
        href="/markets"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-forest-500 px-5 text-sm font-semibold text-canvas hover:bg-forest-400"
      >
        Browse all markets
      </Link>
    </main>
  );
}
