import { formatCount, formatDate } from "@/lib/format";

export function StatusBar({ totalAuctions, latestAuctionEnd }: { totalAuctions: number; latestAuctionEnd: number }) {
  return (
    <footer className="sticky bottom-0 z-10 border-t border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-10 w-full max-w-[1480px] items-center gap-4 overflow-hidden px-4 text-xs whitespace-nowrap text-muted sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-forest-900 px-2 py-1 font-medium text-forest-300">
          <span className="size-1.5 rounded-full bg-forest-400" aria-hidden="true" />
          Synced
        </span>
        <span>Data through {formatDate(latestAuctionEnd)}</span>
        <span className="hidden sm:inline">{formatCount(totalAuctions)} auctions archived</span>
        <span className="ml-auto hidden md:inline">Loaded daily · page refreshes hourly</span>
      </div>
    </footer>
  );
}
