# Sage 🌿

Find and share herb spots in your neighbourhood. Spot a rosemary hedge or a
communal mint patch? Drop a pin so neighbours can visit.

## Stack

- **Cloudflare Workers** — Hono API + static asset hosting
- **Cloudflare D1** — SQLite storage
- **Vite + React** — single-page app
- **Better Auth** — email + password accounts, sessions in D1
- **MapLibre GL JS** — map with free OpenStreetMap raster tiles (no API keys)

## Prerequisites

- Node 20+
- A Cloudflare account (for `wrangler` auth: `npx wrangler login`, or use an
  existing token)

## Setup

```sh
npm install

# Local secrets for `wrangler dev` (gitignored). Put a long random string in
# BETTER_AUTH_SECRET, e.g. from `openssl rand -base64 32`.
cp .dev.vars.example .dev.vars

# Create the local D1 database tables
npx wrangler d1 migrations apply sage --local
```

## Development

Two terminals:

```sh
# Terminal 1 — API + built assets on http://localhost:8787
npm run dev:api

# Terminal 2 — Vite dev server with HMR on http://localhost:5173 (proxies /api)
npm run dev:web
```

Open http://localhost:5173. Anyone can browse; sign in (or create an account)
to add spots, and edit/delete your own from their popups.

Schema changes go in a new numbered file in `migrations/`
(`npx wrangler d1 migrations create sage <name>`), then
`npx wrangler d1 migrations apply sage --local`.

## Type checking & build

```sh
npm run build   # typechecks server + web, then builds SPA to dist/client
```

## Deploy

```sh
# 1. Create the D1 database (once) and copy the database_id from the output
npx wrangler d1 create sage

# 2. Paste the id into wrangler.jsonc (d1_databases[].database_id) and set
#    vars.BETTER_AUTH_URL to the public URL of the app

# 3. Set the auth secret (once; a long random string)
npx wrangler secret put BETTER_AUTH_SECRET

# 4. Apply pending migrations to the production database.
#    Check what's pending first:  npx wrangler d1 migrations list sage --remote
#    (Note: 0003 drops and recreates the spots table, deleting existing spots.)
npx wrangler d1 migrations apply sage --remote

# 5. Build and deploy
npm run build
npx wrangler deploy
```

## Project layout

```
src/          Worker: Hono app (/api/*), Better Auth setup, entry
web/          Vite + React SPA (MapLibre map, sign-in dialog)
shared/       Types/constants used by both src/ and web/
migrations/   D1 migrations (spots + Better Auth tables)
wrangler.jsonc  Worker config: assets, /api/* routing, D1 binding DB, vars
```
