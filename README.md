# od-prototype

A prototype UI over the Cars & Bids auction archive in Neon (the `carsandbids`
schema, loaded daily by [auct-scrape-and-load](https://github.com/c-fechtmeyer/auct-scrape-and-load)).

The homepage, **Home** ("OverDrive Market Intelligence"), ranks the 10 most-listed model families over the last
365 days. Each row shows the last 365 and 180 days, each with a YoY comp against
the same span one year earlier. **See All Markets** links to the **Markets** tab
(`/markets`): every model family with any auction history, one compact row each,
with a 365D / 180D toggle (it changes the figures shown, not the ranking) and
25 / 50 / 100 rows per page. Any value or YoY
comparison that can't be computed reads "Insufficient Data". **About** (`/about`)
holds the data source and archive status.

Each family has a **model page** at `/markets/{make}/{family}` (e.g.
`/markets/porsche/911`), opened by clicking a row on Home or Markets. It shows the
family's KPI tiles (with Sell Through Rate), an **Auction Results** scatter (one dot
per auction over time; solid = sold, light ring = reserve not met; canceled auctions
aren't plotted), and a paginated **Latest Results** table linking to each listing on
Cars & Bids. Families with generations get a tab row under the title, with **All**
plus one tab per generation, oldest first by median model year. Each tab opens a
generation sub-page at `/markets/{make}/{family}/{generation}` (e.g.
`/markets/porsche/911/996`) with the same tiles, scatter and table scoped to that
generation. Under the scatter, **Price Distribution** stacks last year's sales as
dots (one per sale) in log-price bins, with density curves for the last 365 days and
the year before. **Price by Color** compares each exterior color family's median sale
price with the overall median (last 365 days, colors with at least 5 sales). Color
families come from keyword matching on C&B's paint names (`src/lib/colors.ts`). The
25 most-listed families and their generations are prerendered; the
rest render on first visit and are cached. Every page is scoped by `MarketScope` in
`src/lib/family.ts` (family + optional generation), so finer cuts (trim, ...) can
be added there later.

## Stack

- **Next.js 16** (App Router, Cache Components) + **Tailwind CSS v4**
- **@neondatabase/serverless** (HTTP driver) for read-only queries
- Deploys to **Vercel** as is

## Run locally

Requires Node 20.9+ (`.nvmrc` pins 22).

```bash
cp .env.example .env.local   # then set DATABASE_URL
npm install
npm run dev                  # http://localhost:3000
```

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Add `DATABASE_URL` under Project → Settings → Environment Variables. You can also
   connect it through Vercel's Neon integration. It's needed at build time too,
   because the page is prerendered.
3. Deploy. The page is static and revalidates hourly (`cacheLife("hours")` in
   `src/lib/markets.ts`).

## Metric definitions

Every window is anchored at `now()`. **c365** and **c180** are the trailing 365 and
180 days. Their comps, **p365** and **p180**, are the same spans one year earlier
(p180 is days 365–545 ago).

| Metric | Definition |
|---|---|
| Ranking | Listings per model family (make + `model_family_name`) over the trailing 365 days |
| Auctions | Every listing that ended in the window, canceled included |
| Dollar Volume | Sum of `sale_amount` for sold auctions (`sold` + `sold_after`) |
| Sale Prices | Interquartile range (P25–P75) of `sale_amount` for sold auctions, reserve and no-reserve. The YoY figure is the change in the median |
| No Reserve % | No-reserve auctions divided by total auctions (canceled included). The YoY figure is in percentage points |
| Active Markets (summary tile) | Model families with at least one auction in the window |
| Sell Through Rate (model page) | Sold auctions (`sold` + `sold_after`) divided by auctions that ran to the end (canceled excluded). The YoY figure is in percentage points |
| Scatter price (model page) | Sale price for sold auctions; the high bid for reserve-not-met auctions and for older sold auctions with no published sale price |
| Models Tracked (Markets tab) | Model families with at least one observed auction, all time. "New" counts families whose first auction ended in the last 365 days |

All of the SQL lives in `src/lib/markets.ts`. Metric formatting, deltas, and sort
keys live in `src/lib/metrics.ts`.

## Customizing

- **Colors:** every color is a token in `src/app/globals.css` (`@theme`). Text
  tokens hold ≥ 4.5:1 contrast on every surface.
- **Metrics / columns:** add an entry to `METRICS` in `src/lib/metrics.ts`. Add
  any new column to the `WINDOW_STATS` SQL in `src/lib/markets.ts`.
