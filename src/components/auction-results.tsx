"use client";

import { useState } from "react";
import { Pagination, paginate } from "@/components/table-parts";
import { STATUS_LABEL, auctionUrl, isSold, resultPrice } from "@/lib/auction";
import type { AuctionStatus, FamilyAuction } from "@/lib/family";
import { formatCount, formatDate, formatDollars } from "@/lib/format";

const STATUS_STYLE: Record<AuctionStatus, string> = {
  sold: "bg-forest-900 text-forest-300",
  sold_after: "bg-forest-900 text-forest-300",
  reserve_not_met: "bg-surface-3 text-muted",
  canceled: "bg-surface-3 text-faint",
};

const PAGE_SIZE = 10;

// Every individual auction, newest first, ten to a page.
export function AuctionResults({ auctions, showGeneration }: { auctions: FamilyAuction[]; showGeneration: boolean }) {
  const [page, setPage] = useState(0);
  const { pageCount, current, first, visible } = paginate(auctions, page, PAGE_SIZE);

  return (
    <section aria-labelledby="latest-results-title">
      <div className="mb-4">
        <h2 id="latest-results-title" className="text-base font-semibold">
          Latest Results
        </h2>
        <p className="mt-1 text-xs text-muted">Every auction, newest first. Listings open on Cars &amp; Bids.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/80">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[13px] text-muted">
              <th scope="col" className="w-28 border-b border-line py-3 pl-5 font-medium">
                Ended
              </th>
              <th scope="col" className="border-b border-line py-3 pr-4 font-medium">
                Listing
              </th>
              {showGeneration && (
                <th scope="col" className="border-b border-line py-3 pr-4 font-medium">
                  Generation
                </th>
              )}
              <th scope="col" className="border-b border-line py-3 pr-4 text-right font-medium">
                Mileage
              </th>
              <th scope="col" className="border-b border-line py-3 pr-4 font-medium">
                Result
              </th>
              <th scope="col" className="border-b border-line py-3 pr-4 text-right font-medium">
                Price
              </th>
              <th scope="col" className="border-b border-line py-3 pr-5 text-right font-medium">
                Bids
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a, i) => {
              const cell = `border-b border-line/60 py-2.5 align-middle ${i % 2 === 1 ? "bg-surface-2" : "bg-surface"}`;
              const { price, isHighBid } = resultPrice(a);
              return (
                <tr key={a.id}>
                  <td className={`${cell} pl-5 text-[13px] whitespace-nowrap text-muted tabular-nums`}>
                    {formatDate(a.ended)}
                  </td>
                  <td className={`${cell} max-w-[420px] pr-4`}>
                    <a
                      href={auctionUrl(a.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-fg decoration-forest-700 underline-offset-4 hover:underline"
                    >
                      {a.title ?? "Untitled listing"}
                    </a>
                    {a.subTitle && <div className="truncate text-xs text-faint">{a.subTitle}</div>}
                  </td>
                  {showGeneration && (
                    <td className={`${cell} pr-4 whitespace-nowrap text-muted`}>{a.generation ?? "—"}</td>
                  )}
                  <td className={`${cell} pr-4 text-right whitespace-nowrap text-muted tabular-nums`}>
                    {a.mileage != null ? `${formatCount(a.mileage)} mi` : "—"}
                  </td>
                  <td className={`${cell} pr-4 whitespace-nowrap`}>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                    {a.noReserve && <span className="ml-1.5 text-[11px] text-faint">No reserve</span>}
                  </td>
                  <td className={`${cell} pr-4 text-right whitespace-nowrap tabular-nums`}>
                    {price == null ? (
                      <span className="text-faint">—</span>
                    ) : isSold(a) && !isHighBid ? (
                      <span className="font-medium text-fg">{formatDollars(price)}</span>
                    ) : (
                      <span className="text-muted" title={isSold(a) ? "Final sale price not published" : undefined}>
                        <span className="text-[11px] text-faint">{isSold(a) ? "High bid " : "Bid to "}</span>
                        {formatDollars(price)}
                      </span>
                    )}
                  </td>
                  <td className={`${cell} pr-5 text-right text-muted tabular-nums`}>{a.bids ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {auctions.length === 0 && <p className="px-6 py-14 text-center text-sm text-muted">No auctions yet.</p>}
      </div>

      <Pagination
        noun="auctions"
        total={auctions.length}
        first={first}
        shown={visible.length}
        current={current}
        pageCount={pageCount}
        onPage={setPage}
      />
    </section>
  );
}
