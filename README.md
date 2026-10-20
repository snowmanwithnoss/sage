# Sage 🌿

Find and share herb spots in your neighbourhood. Spot a rosemary hedge or a
communal mint patch? Drop a pin so neighbours can visit.

## Stack

- **Cloudflare Workers** — Hono API + static asset hosting
- **Cloudflare D1** — SQLite storage
- **Vite + React** — single-page app
- **MapLibre GL JS** — map with free OpenStreetMap raster tiles (no API keys)

## Prerequisites

- Node 20+
- A Cloudflare account (for `wrangler` auth: `npx wrangler login`, or use an
  existing token)

## Setup

```sh
npm install
```

## Development

Two terminals:

```sh
# Terminal 1 — API + built assets on http://localhost:8787
npm run dev:api

# Terminal 2 — Vite dev server with HMR on http://localhost:5173 (proxies /api)
npm run dev:web
```

Open http://localhost:5173. Click the map to add a spot.

## Type checking & build

```sh
npm run build   # typechecks server + web, then builds SPA to dist/client
```

## Deploy

```sh
# 1. Create the D1 database (once) and copy the database_id from the output
npx wrangler d1 create sage

# 2. Paste the id into wrangler.jsonc (d1_databases[].database_id)

# 3. Apply the schema (locally and/or remotely — the --remote copy is what
#    production uses)
npx wrangler d1 execute sage --local --file=schema.sql
npx wrangler d1 execute sage --remote --file=schema.sql

# 4. Build and deploy
npm run build
npx wrangler deploy
```

## Project layout

```
src/          Worker: Hono app (/api/*) + entry
web/          Vite + React SPA (MapLibre map)
schema.sql    D1 schema (spots table)
wrangler.jsonc  Worker config: assets, /api/* routing, D1 binding DB
```
