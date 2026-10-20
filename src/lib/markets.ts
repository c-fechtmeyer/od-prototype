import "server-only";
import { cacheLife } from "next/cache";
import { sql } from "./db";

// Trailing windows and their YoY comps: p365 / p180 are the same spans one year
// earlier (p180 is days 365–545 ago, not the 180 days before c180).
export const WINDOWS = ["c365", "p365", "c180", "p180"] as const;
export type WindowKey = (typeof WINDOWS)[number];

export type WindowStats = {
  auctions: number; // every listing that ended in the window, canceled included
  volume: number; // sum of sale amounts, sold auctions only
  p25: number | null; // sale-amount percentiles, sold auctions only
  p50: number | null;
  p75: number | null;
  noReserveAuctions: number; // listings offered with no reserve, canceled included
  soldAuctions: number; // sold or sold after
  completedAuctions: number; // ran to the end: every listing except canceled ones
};

export type Market = {
  familyId: string; // stable "make_key/model_family_key", e.g. "porsche/911"
  rank: number;
  makeKey: string;
  familyKey: string;
  makeSlug: string; // URL segments for the family's page: /markets/{makeSlug}/{familySlug}
  familySlug: string;
  makeName: string;
  familyName: string;
  generations: string[];
  isNew: boolean; // first observed auction ended in the last 365 days
  windows: Record<WindowKey, WindowStats>;
};

export type SummaryStats = WindowStats & {
  activeMarkets: number; // model families with at least one auction in the window
};

export type MarketSummary = {
  windows: Record<WindowKey, SummaryStats>;
};

export type ArchiveStatus = {
  totalAuctions: number;
  latestAuctionEnd: number; // epoch ms
  fresh: boolean; // the latest auction ended within STALE_AFTER_DAYS
};

// Cars & Bids auctions end Monday to Friday, and the daily load picks up each day's
// results the next morning (UTC). So Friday's auctions stay the latest until Tuesday's
// load, about 3.7 days. The archive only counts as stale past that, at 4 days. A holiday
// Monday can still trip it briefly.
export const STALE_AFTER_DAYS = 4;

// Every window's stats are computed in one pass. The windows are anchored at now(),
// and the ranking is by listing count over the trailing 365 days.
export const WINDOWS_CTE = `
win (w, lo, hi) AS (
    VALUES ('c365', now() - interval '365 days', now()),
           ('p365', now() - interval '730 days', now() - interval '365 days'),
           ('c180', now() - interval '180 days', now()),
           ('p180', now() - interval '545 days', now() - interval '365 days')
)`;

export const WINDOW_STATS = `
    count(*)::int AS auctions,
    coalesce(sum(a.sale_amount) FILTER (WHERE a.is_sold), 0)::float8 AS volume,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY a.sale_amount) FILTER (WHERE a.is_sold) AS p25,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY a.sale_amount) FILTER (WHERE a.is_sold) AS p50,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY a.sale_amount) FILTER (WHERE a.is_sold) AS p75,
    count(*) FILTER (WHERE a.no_reserve)::int AS no_reserve_auctions,
    count(*) FILTER (WHERE a.is_sold)::int AS sold_auctions,
    count(*) FILTER (WHERE a.status <> 'canceled')::int AS completed_auctions`;

const MARKETS_SQL = `
WITH ${WINDOWS_CTE}, fam AS (
    SELECT a.*, m.model_family_key
    FROM carsandbids.auctions a
    JOIN carsandbids.models m USING (make_key, model_key)
    WHERE a.auction_end >= now() - interval '730 days'
), ranked AS (
    -- Every family with any auction history: by trailing-365-day listings, then all-time
    -- listings, so families with nothing recent still get a stable place at the end.
    -- LIMIT NULL (no limit) returns them all.
    SELECT a.make_key, m.model_family_key,
           row_number() OVER (
               ORDER BY count(*) FILTER (WHERE a.auction_end >= now() - interval '365 days') DESC,
                        count(*) DESC, a.make_key, m.model_family_key)::int AS rank,
           min(a.auction_end) >= now() - interval '365 days' AS is_new
    FROM carsandbids.auctions a
    JOIN carsandbids.models m USING (make_key, model_key)
    GROUP BY a.make_key, m.model_family_key
    ORDER BY rank
    LIMIT $1
), info AS (
    SELECT r.rank, r.make_key, r.model_family_key, r.is_new, mk.make_name, mk.make_slug,
           min(m.model_family_name) AS family_name,
           carsandbids.url_slug(min(m.model_family_name)) AS family_slug,
           coalesce(array_agg(m.model_generation ORDER BY m.model_generation)
                    FILTER (WHERE m.model_generation IS NOT NULL), '{}') AS generations
    FROM ranked r
    JOIN carsandbids.makes mk USING (make_key)
    JOIN carsandbids.models m USING (make_key, model_family_key)
    GROUP BY r.rank, r.make_key, r.model_family_key, r.is_new, mk.make_name, mk.make_slug
), stats AS (
    SELECT a.make_key, a.model_family_key, w.w, ${WINDOW_STATS}
    FROM fam a
    JOIN ranked USING (make_key, model_family_key)
    JOIN win w ON a.auction_end >= w.lo AND a.auction_end < w.hi
    GROUP BY a.make_key, a.model_family_key, w.w
)
SELECT i.rank, i.make_key, i.model_family_key, i.make_name, i.make_slug, i.family_name,
       i.family_slug, i.generations, i.is_new, s.w, s.auctions, s.volume, s.p25, s.p50, s.p75,
       s.no_reserve_auctions, s.sold_auctions, s.completed_auctions
FROM info i
LEFT JOIN stats s USING (make_key, model_family_key)
ORDER BY i.rank, s.w`;

const SUMMARY_SQL = `
WITH ${WINDOWS_CTE}
SELECT w.w, ${WINDOW_STATS},
       count(DISTINCT a.make_key || '/' || m.model_family_key)::int AS active_markets
FROM win w
LEFT JOIN carsandbids.auctions a ON a.auction_end >= w.lo AND a.auction_end < w.hi
LEFT JOIN carsandbids.models m ON m.make_key = a.make_key AND m.model_key = a.model_key
GROUP BY w.w`;

export type StatsRow = {
  w: WindowKey | null;
  auctions: number;
  volume: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  no_reserve_auctions: number;
  sold_auctions: number;
  completed_auctions: number;
};

const EMPTY_STATS: WindowStats = {
  auctions: 0,
  volume: 0,
  p25: null,
  p50: null,
  p75: null,
  noReserveAuctions: 0,
  soldAuctions: 0,
  completedAuctions: 0,
};

export function emptyWindows(): Record<WindowKey, WindowStats> {
  return { c365: { ...EMPTY_STATS }, p365: { ...EMPTY_STATS }, c180: { ...EMPTY_STATS }, p180: { ...EMPTY_STATS } };
}

export function toStats(r: StatsRow): WindowStats {
  return {
    auctions: r.auctions,
    volume: r.volume,
    p25: r.p25,
    p50: r.p50,
    p75: r.p75,
    noReserveAuctions: r.no_reserve_auctions,
    soldAuctions: r.sold_auctions,
    completedAuctions: r.completed_auctions,
  };
}

type MarketRow = StatsRow & {
  rank: number;
  make_key: string;
  model_family_key: string;
  make_name: string;
  make_slug: string;
  family_name: string;
  family_slug: string;
  generations: string[];
  is_new: boolean;
};

// The top `limit` model families (null: every family with any auction history),
// ranked by listings over the trailing 365 days.
export async function getMarkets(limit: number | null): Promise<Market[]> {
  "use cache";
  // The loader runs once a day; hourly keeps a fresh load visible soon after it lands.
  cacheLife("hours");

  const marketRows = (await sql.query(MARKETS_SQL, [limit])) as MarketRow[];

  const byRank = new Map<number, Market>();
  for (const r of marketRows) {
    let m = byRank.get(r.rank);
    if (!m) {
      m = {
        familyId: `${r.make_key}/${r.model_family_key}`,
        rank: r.rank,
        makeKey: r.make_key,
        familyKey: r.model_family_key,
        makeSlug: r.make_slug,
        familySlug: r.family_slug,
        makeName: r.make_name,
        familyName: r.family_name,
        generations: r.generations,
        isNew: r.is_new,
        windows: emptyWindows(),
      };
      byRank.set(r.rank, m);
    }
    if (r.w) m.windows[r.w] = toStats(r);
  }

  return [...byRank.values()].sort((a, b) => a.rank - b.rank);
}

// The same window stats for all of Cars & Bids, plus the active-market count.
export async function getMarketSummary(): Promise<MarketSummary> {
  "use cache";
  cacheLife("hours");

  const summaryRows = (await sql.query(SUMMARY_SQL)) as (StatsRow & { active_markets: number })[];
  const summary: MarketSummary = {
    windows: {
      c365: { ...EMPTY_STATS, activeMarkets: 0 },
      p365: { ...EMPTY_STATS, activeMarkets: 0 },
      c180: { ...EMPTY_STATS, activeMarkets: 0 },
      p180: { ...EMPTY_STATS, activeMarkets: 0 },
    },
  };
  for (const r of summaryRows) if (r.w) summary.windows[r.w] = { ...toStats(r), activeMarkets: r.active_markets };
  return summary;
}

export async function getArchiveStatus(): Promise<ArchiveStatus> {
  "use cache";
  cacheLife("hours");

  const [row] = (await sql.query(`
    SELECT count(*)::int AS total_auctions,
           (extract(epoch FROM max(auction_end)) * 1000)::float8 AS latest_auction_end,
           coalesce(max(auction_end) >= now() - interval '${STALE_AFTER_DAYS} days', false) AS fresh
    FROM carsandbids.auctions`)) as { total_auctions: number; latest_auction_end: number; fresh: boolean }[];

  return { totalAuctions: row.total_auctions, latestAuctionEnd: row.latest_auction_end, fresh: row.fresh };
}
