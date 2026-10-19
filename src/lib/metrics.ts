import { formatCount, formatMoney, formatPct, formatRange, pctChange, ratio } from "./format";
import type { WindowStats } from "./markets";

export type MetricKey = "auctions" | "volume" | "price" | "noReserve" | "sellThrough";

export type Metric = {
  key: MetricKey;
  label: string;
  help: string;
  format: (s: WindowStats) => string;
  sortValue: (s: WindowStats) => number | null;
  // YoY change vs the same window a year earlier: relative, or in points for rates.
  delta: (cur: WindowStats, prior: WindowStats) => number | null;
  deltaKind: "pct" | "pp";
};

export const noReserveShare = (s: WindowStats) => ratio(s.noReserveAuctions, s.auctions);
export const sellThroughRate = (s: WindowStats) => ratio(s.soldAuctions, s.completedAuctions);

// Change in a rate, in percentage points; null when either side can't be computed.
const pointChange = (rate: (s: WindowStats) => number | null) => (c: WindowStats, p: WindowStats) => {
  const cr = rate(c);
  const pr = rate(p);
  return cr == null || pr == null ? null : cr - pr;
};

export const METRICS: Record<MetricKey, Metric> = {
  auctions: {
    key: "auctions",
    label: "Auctions",
    help: "Listings that ended in the window, canceled included.",
    format: (s) => formatCount(s.auctions),
    sortValue: (s) => s.auctions,
    delta: (c, p) => pctChange(c.auctions, p.auctions),
    deltaKind: "pct",
  },
  volume: {
    key: "volume",
    label: "Dollar Volume",
    help: "Total sale amount of sold auctions.",
    format: (s) => formatMoney(s.volume),
    sortValue: (s) => s.volume,
    delta: (c, p) => pctChange(c.volume, p.volume),
    deltaKind: "pct",
  },
  price: {
    key: "price",
    label: "Sale Prices",
    help: "Middle 50% of sale prices for sold auctions (reserve and no-reserve). YoY is the change in the median.",
    format: (s) => formatRange(s.p25, s.p75),
    sortValue: (s) => s.p50,
    delta: (c, p) => pctChange(c.p50, p.p50),
    deltaKind: "pct",
  },
  noReserve: {
    key: "noReserve",
    label: "No Reserve %",
    help: "Share of auctions offered with no reserve: no-reserve auctions ÷ total auctions (canceled included). YoY is in percentage points.",
    format: (s) => formatPct(noReserveShare(s)),
    sortValue: (s) => noReserveShare(s),
    delta: pointChange(noReserveShare),
    deltaKind: "pp",
  },
  sellThrough: {
    key: "sellThrough",
    label: "Sell Through Rate",
    help: "Share of auctions that sold (including sold-after deals), out of all auctions that ran to the end; canceled auctions are excluded. YoY is in percentage points.",
    format: (s) => formatPct(sellThroughRate(s)),
    sortValue: (s) => sellThroughRate(s),
    delta: pointChange(sellThroughRate),
    deltaKind: "pp",
  },
};
