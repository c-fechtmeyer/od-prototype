// Pure helpers for individual auction results, shared by the scatter chart and the
// results table.
import type { AuctionStatus, FamilyAuction } from "./family";

export const isSold = (a: Pick<FamilyAuction, "status">) => a.status === "sold" || a.status === "sold_after";

export const STATUS_LABEL: Record<AuctionStatus, string> = {
  sold: "Sold",
  sold_after: "Sold After",
  reserve_not_met: "Reserve Not Met",
  canceled: "Canceled",
};

// The price a result is plotted and listed at: the sale price for sold auctions,
// otherwise the high bid. Some older sold auctions never published a sale price, so
// they fall back to the high bid too, flagged by `isHighBid`.
export function resultPrice(a: FamilyAuction): { price: number | null; isHighBid: boolean } {
  if (isSold(a) && a.saleAmount != null) return { price: a.saleAmount, isHighBid: false };
  return { price: a.highBid, isHighBid: true };
}

export const auctionUrl = (id: string) => `https://carsandbids.com/auctions/${encodeURIComponent(id)}`;
