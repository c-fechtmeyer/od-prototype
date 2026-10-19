import Link from "next/link";

export default function FamilyNotFound() {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Model not found</h1>
      <p className="mt-2 text-sm text-muted">We don&apos;t have any auctions for that model yet.</p>
      <Link
        href="/markets"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-forest-500 px-5 text-sm font-semibold text-canvas hover:bg-forest-400"
      >
        Browse all markets
      </Link>
    </main>
  );
}
