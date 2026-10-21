import "server-only";
import { cacheLife } from "next/cache";
import { sql } from "./db";
import { type MarketScope, scopeFilter } from "./family";
import {
  type Market,
  type StatsRow,
  type SummaryStats,
  WINDOW_STATS,
  WINDOWS_CTE,
  type WindowKey,
  emptySummaryWindows,
  getMarkets,
  toStats,
} from "./markets";

export type MakePage = {
  makeKey: string;
  makeName: string;
  makeSlug: string;
  // Every auction of the make, the Home tiles' stats; activeMarkets counts its families.
  windows: Record<WindowKey, SummaryStats>;
  markets: Market[]; // the make's families, in overall rank order
  totalMarkets: number; // every family on the Markets tab, which the ranks are out of
};

// Everything a make's page needs, or null if there's no such make or it has no auctions.
export async function getMakePage(makeSlug: string): Promise<MakePage | null> {
  "use cache";
  cacheLife("hours");

  const [make] = (await sql.query(
    "SELECT make_key, make_name, make_slug FROM carsandbids.makes WHERE make_slug = $1",
    [makeSlug],
  )) as { make_key: string; make_name: string; make_slug: string }[];
  if (!make) return null;

  const scope: MarketScope = { makeKey: make.make_key, familyKey: null, generation: null };
  const { where, params } = scopeFilter(scope);

  // The family list comes from the Markets tab's own (cached) query, so ranks and
  // figures match it exactly.
  const [statsRows, allMarkets] = (await Promise.all([
    sql.query(
      `WITH ${WINDOWS_CTE}, a AS (
         SELECT a.*, m.model_family_key FROM carsandbids.auctions a
         JOIN carsandbids.models m USING (make_key, model_key) WHERE ${where})
       SELECT w.w, ${WINDOW_STATS}, count(DISTINCT a.model_family_key)::int AS active_markets
       FROM win w JOIN a ON a.auction_end >= w.lo AND a.auction_end < w.hi
       GROUP BY w.w`,
      params,
    ),
    getMarkets(null),
  ])) as [(StatsRow & { active_markets: number })[], Market[]];

  const markets = allMarkets.filter((m) => m.makeKey === make.make_key);
  if (!markets.length) return null;

  const windows = emptySummaryWindows();
  for (const r of statsRows) if (r.w) windows[r.w] = { ...toStats(r), activeMarkets: r.active_markets };

  return {
    makeKey: make.make_key,
    makeName: make.make_name,
    makeSlug: make.make_slug,
    windows,
    markets,
    totalMarkets: allMarkets.length,
  };
}

// The make pages prerendered at build time: the makes of the most-listed families.
export async function getPrerenderedMakeSlugs(n: number) {
  const markets = await getMarkets(n);
  return [...new Set(markets.map((m) => m.makeSlug))].map((make) => ({ make }));
}
