# Sage

Sage (working title) is a web app for people to spot herbs in gardens (public or not) and record them so others in the neighbourhood can visit these herbs.

## Structure

See [README.md](./README.md) for setup/dev/deploy commands.

- `src/` — Cloudflare Worker (Hono). `auth.ts`: per-request `createAuth(env)` (Better Auth, email+password, D1 via native binding, rate limit stored in D1). `api.ts`: Better Auth mounted at `/api/auth/*`; `GET /api/spots` public (adds `is_mine`, never exposes `user_id`); `POST` requires session; `PATCH`/`DELETE /api/spots/:id` scoped `WHERE id = ? AND user_id = ?` (404 if not owner). Prepared statements + explicit validation. Deployed as Worker `herbs` at https://herbs.aroundme.workers.dev (account subdomain `aroundme`; D1 db "sage")
- `web/` — Vite + React SPA, mobile-first ("Google Maps phone app" feel, installable via `public/manifest.webmanifest`, safe-area aware, light/dark via CSS tokens + `prefers-color-scheme`)
  - `src/App.tsx` — orchestration only (state, data, wiring)
  - `src/map/` — `mapStyle.ts`: hand-built "Sage" vector style (light + dark palettes at top; OpenFreeMap tiles, OpenMapTiles schema; green space is the hero, tram lines/most POIs hidden on purpose, 3D buildings from z15). `basemap.ts`: the single place the style + initial view (inner Melbourne) are chosen. `useMap`, `useSpotMarkers` (DOM guitar-pick markers + draft pin), `useMapGestures` (tap, long-press-to-add), `useUserLocation` (blue dot)
  - `src/components/` — `SearchBar` (client-side herb search), `AccountButton`, `BottomSheet` (pointer-event draggable sheet; left card on ≥768px), `SpotDetails`, `SpotForm`, `DangerPicker`, `MapControls` (locate, compass, "+ Add herb" FAB), `PlacementOverlay` (centre-pin placement mode), `Snackbar`, `AuthDialog`, `icons`
  - `src/lib/` — `hooks.ts` (media queries, colour scheme), `format.ts` (danger labels, distance, URLs)
  - Adding a spot: FAB → move map under centre pin → confirm, or long-press. Plain map taps never add. `?spot=<id>` deep-links select a spot
- `shared/` — `Spot` type + danger/length constants imported by both `src/` and `web/` (included in both tsconfigs)
- `migrations/` — D1 migrations (`wrangler d1 migrations apply sage --local|--remote`); database "sage", binding `DB`. `0002` is Better Auth's generated schema — regenerate + add a new migration when upgrading Better Auth or adding plugins
- Config: `BETTER_AUTH_URL` var in `wrangler.jsonc`, `BETTER_AUTH_SECRET` wrangler secret (`.dev.vars` locally, see `.dev.vars.example`); `nodejs_compat` flag needed by Better Auth
- Single root `package.json`; `npm run build` typechecks (strict) both tsconfigs then builds SPA to `dist/client/`
- Auth design decisions: [docs/auth-plan.md](./docs/auth-plan.md)

## Known tech debt / next up

- Deploying auth: run `wrangler d1 migrations apply sage --remote` and `wrangler deploy` back-to-back — once 0003 runs, the old worker's INSERTs fail (no `user_id`). Set `BETTER_AUTH_SECRET` first: without it (or under 32 chars) every `/api/auth/*` and `/api/spots` request returns 500
- No rate limit on `POST/PATCH/DELETE /api/spots` (Better Auth's limiter only covers `/api/auth/*`) — add a per-user limit before wider sharing
- No password reset (forgotten password = lost account) and no email verification (anyone can register any address) — needs an email service
- No account deletion UI (DB cascades spots on user delete)
- `GET /api/spots` has no LIMIT/pagination
- Every `/api/spots` request does a D1 session lookup — enable Better Auth `session.cookieCache` if it shows up in latency
- ~1 MB JS bundle (MapLibre) — code-split when first-load perf matters
- Basemap depends on OpenFreeMap (free, no key, no SLA) at runtime for tiles, glyphs and sprites — if it goes down the map is blank. Fallback: self-host a Protomaps/PMTiles extract of Victoria on R2. Any future CSP must allow `tiles.openfreemap.org`. Only Noto Sans Regular/Bold/Italic exist on its glyph server
- Sprite icons (train, garden tulip) are pre-coloured, so they don't adapt to dark mode
- iOS Safari: keyboard can cover the form sheet (needs `visualViewport` handling; Android is covered by `interactive-widget=resizes-content`)
- Bottom sheet: when expanded with scrollable body, drag-to-dismiss only works from the handle/header (no scroll→drag hand-off)
- Editing a spot can't move its pin
- One snackbar at a time, no queue; mobile action chips row scrolls sideways
- Danger picker uses `role=radiogroup` without arrow-key nav — swap to visually-hidden native radios if we care
- Delete uses `window.confirm` — fine for now, replace with an in-app dialog if styling matters

## Conventions

Role, default stack (TypeScript + Cloudflare), tooling (mise, project-level installs), git identity and sandbox quirks are global defaults in `~/.claude/CLAUDE.md` — only project-specific facts and deviations belong here. Keep this file current: structure and principles here, detail in `./docs/` linked from here.
