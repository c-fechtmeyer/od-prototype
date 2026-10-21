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

// Which auctions a page covers: a model family, optionally narrowed to one of its
// generations. Finer cuts (trim, ...) can be added here once the taxonomy supports
// them; every query below filters through scopeFilter().
export type MarketScope = { makeKey: string; familyKey: string; generation: string | null };

function scopeFilter(s: MarketScope): { where: string; params: string[] } {
  const where = ["a.make_key = $1", "m.model_family_key = $2"];
  const params = [s.makeKey, s.familyKey];
  if (s.generation != null) {
    params.push(s.generation);
    where.push(`m.model_generation = $${params.length}`);
  }
  return { where: where.join(" AND "), params };
}

// Same as carsandbids.url_slug() in SQL: 'G Series/930' -> 'g-series-930'.
export function urlSlug(s: string): string {
  return s
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type AuctionStatus = "sold" | "sold_after" | "reserve_not_met" | "canceled";

export type FamilyAuction = {
  id: string; // Cars & Bids auction id: carsandbids.com/auctions/{id}
  vin: string | null; // auctions.vin_key: the cleaned VIN, shared by every listing of one car
  ended: number; // epoch ms
  title: string | null;
  subTitle: string | null;
  generation: string | null;
  mileage: number | null;
  year: number | null; // model year
  status: AuctionStatus;
  noReserve: boolean;
  saleAmount: number | null; // published sale price; missing on some older sold auctions
  highBid: number | null;
  bids: number | null;
  exteriorColor: string | null; // C&B's free-text paint name
  bodyStyle: string | null; // from carsandbids.body_styles: Coupe, Convertible, ...
  transmission: string | null; // from carsandbids.transmissions: Automatic, Manual
  driveTrain: string | null; // from carsandbids.drive_trains: FWD, RWD, AWD
  yearWindow: 0 | 1 | null; // 0: ended in the last 365 days, 1: the 365 days before that
};

export type Generation = { label: string; slug: string; auctions: number };

// What the family header and its generation tabs need.
export type FamilyNav = {
  makeKey: string;
  makeName: string;
  makeSlug: string;
  familyKey: string;
  familyName: string;
  familySlug: string;
  auctions: number; // every auction in the family, generation or not
  generations: Generation[]; // oldest first, by median model year
};

export type FamilyPage = {
  scope: MarketScope;
  nav: FamilyNav;
  generation: Generation | null; // set on a generation sub-page
  windows: Record<WindowKey, WindowStats>;
  auctions: FamilyAuction[]; // newest first
};

const RESOLVE_SQL = `
SELECT mk.make_key, mk.make_name, mk.make_slug, m.model_family_key,
       min(m.model_family_name) AS family_name,
       carsandbids.url_slug(min(m.model_family_name)) AS family_slug
FROM carsandbids.makes mk
JOIN carsandbids.models m USING (make_key)
WHERE mk.make_slug = $1 AND m.model_family_key = carsandbids.match_key($2)
GROUP BY mk.make_key, mk.make_name, mk.make_slug, m.model_family_key`;

// Generations in chronological order: by the median model year of their listings.
const GENERATIONS_SQL = `
SELECT m.model_generation AS label, count(*)::int AS auctions
FROM carsandbids.models m
JOIN carsandbids.auctions a USING (make_key, model_key)
WHERE m.make_key = $1 AND m.model_family_key = $2 AND m.model_generation IS NOT NULL
GROUP BY m.model_generation
ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY a.year) NULLS LAST, m.model_generation`;

const FAMILY_COUNT_SQL = `
SELECT count(*)::int AS auctions
FROM carsandbids.auctions a
JOIN carsandbids.models m USING (make_key, model_key)
WHERE a.make_key = $1 AND m.model_family_key = $2`;

// Look up a family by its URL segments, or null if there's no such family. The
// family slug matches loosely ("3-series", "3series"), because match_key() strips
// the punctuation either way.
export async function getFamilyNav(makeSlug: string, familySlug: string): Promise<FamilyNav | null> {
  "use cache";
  cacheLife("hours");

  const [family] = (await sql.query(RESOLVE_SQL, [makeSlug, familySlug])) as {
    make_key: string;
    make_name: string;
    make_slug: string;
    model_family_key: string;
    family_name: string;
    family_slug: string;
  }[];
  if (!family) return null;

  const keys = [family.make_key, family.model_family_key];
  const [generations, [count]] = (await Promise.all([
    sql.query(GENERATIONS_SQL, keys),
    sql.query(FAMILY_COUNT_SQL, keys),
  ])) as [{ label: string; auctions: number }[], { auctions: number }[]];

  return {
    makeKey: family.make_key,
    makeName: family.make_name,
    makeSlug: family.make_slug,
    familyKey: family.model_family_key,
    familyName: family.family_name,
    familySlug: family.family_slug,
    auctions: count?.auctions ?? 0,
    generations: generations.map((g) => ({ label: g.label, slug: urlSlug(g.label), auctions: g.auctions })),
  };
}

// Everything a family page (or, with generationSlug, a generation sub-page) needs,
// or null if the family or generation doesn't exist.
export async function getFamilyPage(
  makeSlug: string,
  familySlug: string,
  generationSlug?: string,
): Promise<FamilyPage | null> {
  "use cache";
  cacheLife("hours");

  const nav = await getFamilyNav(makeSlug, familySlug);
  if (!nav) return null;
  const generation = generationSlug != null ? nav.generations.find((g) => g.slug === generationSlug) : null;
  if (generation === undefined) return null;

  const scope: MarketScope = { makeKey: nav.makeKey, familyKey: nav.familyKey, generation: generation?.label ?? null };
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
      `SELECT a.id, a.vin_key AS vin, (extract(epoch FROM a.auction_end) * 1000)::float8 AS ended, a.title, a.sub_title,
              a.model_generation AS generation, a.mileage, a.year, a.status, a.no_reserve, a.sale_amount,
              a.current_bid_amount, a.bids, a.exterior_color,
              bs.body_style_name AS body_style, tr.transmission_name AS transmission,
              dt.drive_train_name AS drive_train,
              CASE WHEN a.auction_end >= now() - interval '365 days' THEN 0
                   WHEN a.auction_end >= now() - interval '730 days' THEN 1 END AS year_window
       FROM (${scoped}) a
       LEFT JOIN carsandbids.body_styles bs ON bs.body_style_id = a.body_style
       LEFT JOIN carsandbids.transmissions tr ON tr.transmission_id = a.transmission
       LEFT JOIN carsandbids.drive_trains dt ON dt.drive_train_id = a.drive_train
       ORDER BY a.auction_end DESC`,
      params,
    ),
  ])) as [
    StatsRow[],
    {
      id: string;
      vin: string | null;
      ended: number;
      title: string | null;
      sub_title: string | null;
      generation: string | null;
      mileage: number | null;
      year: number | null;
      status: AuctionStatus;
      no_reserve: boolean;
      sale_amount: number | null;
      current_bid_amount: number | null;
      bids: number | null;
      exterior_color: string | null;
      body_style: string | null;
      transmission: string | null;
      drive_train: string | null;
      year_window: 0 | 1 | null;
    }[],
  ];

  const windows = emptyWindows();
  for (const r of statsRows) if (r.w) windows[r.w] = toStats(r);

  return {
    scope,
    nav,
    generation,
    windows,
    auctions: auctionRows.map((r) => ({
      id: r.id,
      vin: r.vin,
      ended: r.ended,
      title: r.title,
      subTitle: r.sub_title,
      generation: r.generation,
      mileage: r.mileage,
      year: r.year,
      status: r.status,
      noReserve: r.no_reserve,
      saleAmount: r.sale_amount,
      highBid: r.current_bid_amount,
      bids: r.bids,
      exteriorColor: r.exterior_color,
      bodyStyle: r.body_style,
      transmission: r.transmission,
      driveTrain: r.drive_train,
      yearWindow: r.year_window,
    })),
  };
}

// The pages prerendered at build time: the most-listed families and their
// generations. Every other page renders on its first visit and is cached from then on.
export async function getPrerenderedFamilySlugs(n: number) {
  const markets = await getMarkets(n);
  return markets.map((m) => ({ make: m.makeSlug, family: m.familySlug }));
}

export async function getPrerenderedGenerationSlugs(n: number) {
  const markets = await getMarkets(n);
  return markets.flatMap((m) =>
    m.generations.map((g) => ({ make: m.makeSlug, family: m.familySlug, generation: urlSlug(g) })),
  );
}
