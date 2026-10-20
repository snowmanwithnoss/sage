# Sage

Sage (working title) is a web app for people to spot herbs in gardens (public or not) and record them so others in the neighbourhood can visit these herbs.

## Structure

See [README.md](./README.md) for setup/dev/deploy commands.

- `src/` — Cloudflare Worker (Hono). `auth.ts`: per-request `createAuth(env)` (Better Auth, email+password, D1 via native binding, rate limit stored in D1). `api.ts`: Better Auth mounted at `/api/auth/*`; `GET /api/spots` public (adds `is_mine`, never exposes `user_id`); `POST` requires session; `PATCH`/`DELETE /api/spots/:id` scoped `WHERE id = ? AND user_id = ?` (404 if not owner). Prepared statements + explicit validation. Deployed at https://sage.quiet-flower-951f.workers.dev
- `web/` — Vite + React SPA: full-screen MapLibre map (free OSM tiles), click-to-add form (also used for edit), marker popups with Edit/Delete on own spots, account button + sign-in/up `<dialog>` (`better-auth/react` client)
- `shared/` — `Spot` type + danger/length constants imported by both `src/` and `web/` (included in both tsconfigs)
- `migrations/` — D1 migrations (`wrangler d1 migrations apply sage --local|--remote`); database "sage", binding `DB`. `0002` is Better Auth's generated schema — regenerate + add a new migration when upgrading Better Auth or adding plugins
- Config: `BETTER_AUTH_URL` var in `wrangler.jsonc`, `BETTER_AUTH_SECRET` wrangler secret (`.dev.vars` locally, see `.dev.vars.example`); `nodejs_compat` flag needed by Better Auth
- Single root `package.json`; `npm run build` typechecks (strict) both tsconfigs then builds SPA to `dist/client/`
- Wrangler in this sandbox needs: `XDG_CONFIG_HOME=/tmp/wr XDG_DATA_HOME=/tmp/wr-data XDG_CACHE_HOME=/tmp/wr-cache` (OAuth token lives in /tmp/wr)
- Auth design decisions: [docs/auth-plan.md](./docs/auth-plan.md)

## Known tech debt / next up

- Deploying auth: run `wrangler d1 migrations apply sage --remote` and `wrangler deploy` back-to-back — once 0003 runs, the old worker's INSERTs fail (no `user_id`). Set `BETTER_AUTH_SECRET` first: without it (or under 32 chars) every `/api/auth/*` and `/api/spots` request returns 500
- No rate limit on `POST/PATCH/DELETE /api/spots` (Better Auth's limiter only covers `/api/auth/*`) — add a per-user limit before wider sharing
- No password reset (forgotten password = lost account) and no email verification (anyone can register any address) — needs an email service
- No account deletion UI (DB cascades spots on user delete)
- `GET /api/spots` has no LIMIT/pagination
- Every `/api/spots` request does a D1 session lookup — enable Better Auth `session.cookieCache` if it shows up in latency
- ~990 KB JS bundle (MapLibre) — code-split when first-load perf matters
- Danger picker uses `role=radiogroup` without arrow-key nav — swap to visually-hidden native radios if we care
- Delete uses `window.confirm` — fine for now, replace with an in-app dialog if styling matters

## Your role

You (the agent) will take the role of product owner and tech lead. Assume the user is proficient with tech but not a programmer. Don't implement code yourself, manage subagents to implement and review, you should manage git operations. Suggest pausing for architecture clean up and paying down tech debt when approprite.

## Tech

TypeScript everything by default, avoid unnessary dependencies. Use boring well known tech. Cloudflare hosting.

## Self updating docs

This file (AGENTS.md) should be proactively updated when appropriate summarizing the structure of the project and important principles, but not unnecessary detail that should be files in ./docs/ with links from here.
