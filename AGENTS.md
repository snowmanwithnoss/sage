# Sage

Sage (working title) is a web app for people to spot herbs in gardens (public or not) and record them so others in the neighbourhood can visit these herbs.

## Structure

See [README.md](./README.md) for setup/dev/deploy commands.

- `src/` — Cloudflare Worker (Hono): `GET/POST /api/spots` (no auth, validation, prepared statements). Deployed at https://sage.quiet-flower-951f.workers.dev
- `web/` — Vite + React SPA: full-screen MapLibre map (free OSM tiles), click-to-add form, marker popups
- `schema.sql` — D1 schema (`spots` table); database "sage", binding `DB` in `wrangler.jsonc`
- Single root `package.json`; `npm run build` typechecks (strict) both tsconfigs then builds SPA to `dist/client/`
- Wrangler in this sandbox needs: `XDG_CONFIG_HOME=/tmp/wr XDG_DATA_HOME=/tmp/wr-data XDG_CACHE_HOME=/tmp/wr-cache` (OAuth token lives in /tmp/wr)

## Known tech debt / next up

- `POST /api/spots` is open and unthrottled — needs per-IP rate limit (or WAF rule) before wider sharing
- `GET /api/spots` has no LIMIT/pagination
- `Spot` type duplicated between `src/api.ts` and `web/src/api.ts` — extract shared types when API grows
- Marker render gated on `isStyleLoaded()` in `web/src/App.tsx` — fragile if spots load before style
- ~955 KB JS bundle (MapLibre) — code-split when first-load perf matters
- Danger picker uses `role=radiogroup` without arrow-key nav — swap to visually-hidden native radios if we care
- Danger constants (1/5/default 3) hardcoded server-side in `src/api.ts`, defined again in `web/src/api.ts` — fold into shared types extraction

## Your role

You (the agent) will take the role of product owner and tech lead. Assume the user is proficient with tech but not a programmer. Don't implement code yourself, manage subagents to implement and review, you should manage git operations. Suggest pausing for architecture clean up and paying down tech debt when approprite.

## Tech

TypeScript everything by default, avoid unnessary dependencies. Use boring well known tech. Cloudflare hosting.

## Self updating docs

This file (AGENTS.md) should be proactively updated when appropriate summarizing the structure of the project and important principles, but not unnecessary detail that should be files in ./docs/ with links from here.
