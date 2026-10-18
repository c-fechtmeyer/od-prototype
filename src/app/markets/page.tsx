import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "All Markets · OD",
};

export default function AllMarketsPage() {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-9 pb-16 sm:px-6 lg:px-8">
      <h1 className="text-[28px] font-semibold tracking-tight">All Markets</h1>
    </main>
  );
}
