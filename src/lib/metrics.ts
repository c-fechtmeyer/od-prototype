import { formatCount, formatMoney, formatPct, formatRange, pctChange, ratio } from "./format";
import type { WindowStats } from "./markets";

export type MetricKey = "auctions" | "volume" | "price" | "success";

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

export const successRate = (s: WindowStats) => ratio(s.reserveSold, s.reserveAuctions);

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
  success: {
    key: "success",
    label: "Reserve Success",
    help: "Share of reserve auctions that sold, including sold-after deals. Canceled auctions are excluded. YoY is in percentage points.",
    format: (s) => formatPct(successRate(s)),
    sortValue: (s) => successRate(s),
    delta: (c, p) => {
      const cr = successRate(c);
      const pr = successRate(p);
      return cr == null || pr == null ? null : cr - pr;
    },
    deltaKind: "pp",
  },
};
