# od-prototype

A prototype UI over the Cars & Bids auction archive in Neon (the `carsandbids`
schema, loaded daily by [auct-scrape-and-load](https://github.com/c-fechtmeyer/auct-scrape-and-load)).

The homepage, **Markets**, ranks the 10 most-listed model families over the last
365 days. Each row shows the last 365 and 180 days, each with a YoY comp against
the same span one year earlier. **See All Markets** links to `/markets`, which is a
placeholder for now. **About** (`/about`) holds the data source and archive status.

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
| Reserve Success | `sold` + `sold_after` divided by reserve auctions that weren't canceled. The YoY figure is in percentage points |
| Active Markets (summary tile) | Model families with at least one auction in the window |

All of the SQL lives in `src/lib/markets.ts`. Metric formatting, deltas, and sort
keys live in `src/lib/metrics.ts`.

## Customizing

- **Colors:** every color is a token in `src/app/globals.css` (`@theme`). Text
  tokens hold ≥ 4.5:1 contrast on every surface.
- **Metrics / columns:** add an entry to `METRICS` in `src/lib/metrics.ts`. Add
  any new column to the `WINDOW_STATS` SQL in `src/lib/markets.ts`.
- **Watchlist:** stored per browser in `localStorage` (`od.watchlist`) until
  accounts exist.
