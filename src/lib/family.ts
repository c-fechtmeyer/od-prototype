import "server-only";
import { cacheLife } from "next/cache";
import { sql } from "./db";
import {
  type StatsRow,
  WINDOW_STATS,
  WINDOWS_CTE,
  type WindowKey,
  type WindowStats,
  emptyWindows,
  getMarkets,
  toStats,
} from "./markets";

// Which auctions a page covers. Today that's one model family. Finer cuts
// (generation, trim, ...) can be added here once the taxonomy supports them, and
// every query below filters through scopeFilter().
export type MarketScope = { makeKey: string; familyKey: string };

function scopeFilter(s: MarketScope): { where: string; params: string[] } {
  return { where: "a.make_key = $1 AND m.model_family_key = $2", params: [s.makeKey, s.familyKey] };
}

export type AuctionStatus = "sold" | "sold_after" | "reserve_not_met" | "canceled";

export type FamilyAuction = {
  id: string; // Cars & Bids auction id: carsandbids.com/auctions/{id}
  ended: number; // epoch ms
  title: string | null;
  subTitle: string | null;
  generation: string | null;
  mileage: number | null;
  status: AuctionStatus;
  noReserve: boolean;
  saleAmount: number | null; // published sale price; missing on some older sold auctions
  highBid: number | null;
  bids: number | null;
};

export type FamilyPage = {
  scope: MarketScope;
  makeName: string;
  makeSlug: string;
  familyName: string;
  familySlug: string;
  generations: string[];
  windows: Record<WindowKey, WindowStats>;
  auctions: FamilyAuction[]; // newest first
};

const RESOLVE_SQL = `
SELECT mk.make_key, mk.make_name, mk.make_slug, m.model_family_key,
       min(m.model_family_name) AS family_name,
       carsandbids.url_slug(min(m.model_family_name)) AS family_slug,
       coalesce(array_agg(m.model_generation ORDER BY m.model_generation)
                FILTER (WHERE m.model_generation IS NOT NULL), '{}') AS generations
FROM carsandbids.makes mk
JOIN carsandbids.models m USING (make_key)
WHERE mk.make_slug = $1 AND m.model_family_key = carsandbids.match_key($2)
GROUP BY mk.make_key, mk.make_name, mk.make_slug, m.model_family_key`;

// Look up a family by its URL segments and load everything its page needs, or
// null if no such family exists. The family slug matches loosely ("3-series",
// "3series"), because match_key() strips the punctuation either way.
export async function getFamilyPage(makeSlug: string, familySlug: string): Promise<FamilyPage | null> {
  "use cache";
  cacheLife("hours");

  const [family] = (await sql.query(RESOLVE_SQL, [makeSlug, familySlug])) as {
    make_key: string;
    make_name: string;
    make_slug: string;
    model_family_key: string;
    family_name: string;
    family_slug: string;
    generations: string[];
  }[];
  if (!family) return null;

  const scope: MarketScope = { makeKey: family.make_key, familyKey: family.model_family_key };
  const { where, params } = scopeFilter(scope);
  const scoped = `SELECT a.*, m.model_generation FROM carsandbids.auctions a
    JOIN carsandbids.models m USING (make_key, model_key) WHERE ${where}`;

  const [statsRows, auctionRows] = (await Promise.all([
    sql.query(
      `WITH ${WINDOWS_CTE}, a AS (${scoped})
       SELECT w.w, ${WINDOW_STATS}
       FROM win w JOIN a ON a.auction_end >= w.lo AND a.auction_end < w.hi
       GROUP BY w.w`,
      params,
    ),
    sql.query(
      `SELECT a.id, (extract(epoch FROM a.auction_end) * 1000)::float8 AS ended, a.title, a.sub_title,
              a.model_generation AS generation, a.mileage, a.status, a.no_reserve, a.sale_amount,
              a.current_bid_amount, a.bids
       FROM (${scoped}) a
       ORDER BY a.auction_end DESC`,
      params,
    ),
  ])) as [
    StatsRow[],
    {
      id: string;
      ended: number;
      title: string | null;
      sub_title: string | null;
      generation: string | null;
      mileage: number | null;
      status: AuctionStatus;
      no_reserve: boolean;
      sale_amount: number | null;
      current_bid_amount: number | null;
      bids: number | null;
    }[],
  ];

  const windows = emptyWindows();
  for (const r of statsRows) if (r.w) windows[r.w] = toStats(r);

  return {
    scope,
    makeName: family.make_name,
    makeSlug: family.make_slug,
    familyName: family.family_name,
    familySlug: family.family_slug,
    generations: family.generations,
    windows,
    auctions: auctionRows.map((r) => ({
      id: r.id,
      ended: r.ended,
      title: r.title,
      subTitle: r.sub_title,
      generation: r.generation,
      mileage: r.mileage,
      status: r.status,
      noReserve: r.no_reserve,
      saleAmount: r.sale_amount,
      highBid: r.current_bid_amount,
      bids: r.bids,
    })),
  };
}

// The families prerendered at build time; every other family page renders on its
// first visit and is cached from then on.
export async function getPrerenderedFamilySlugs(n: number) {
  const markets = await getMarkets(n);
  return markets.map((m) => ({ make: m.makeSlug, family: m.familySlug }));
}
