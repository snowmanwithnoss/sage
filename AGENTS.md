# Sage

Sage (working title) is a web app for people to spot herbs in gardens (public or not) and record them so others in the neighbourhood can visit these herbs.

## Structure

See [README.md](./README.md) for setup/dev/deploy commands.

- `src/` — Cloudflare Worker (Hono). `auth.ts`: per-request `createAuth(env)` (Better Auth, email+password, D1 via native binding, rate limit stored in D1). `api.ts`: Better Auth mounted at `/api/auth/*`; `GET /api/spots` public (adds `is_mine`, never exposes `user_id`; spots carry optional `tags` — JSON array column validated against `SPOT_TAGS`, canonical order; PATCH without `tags` keeps them); `POST` requires session; `PATCH`/`DELETE /api/spots/:id` scoped `WHERE id = ? AND user_id = ?` (404 if not owner). Prepared statements + explicit validation. Photos: `POST /api/spots/:id/photos` (owner-only, multipart `full` + `thumb` + `width`/`height`; JPEG/WebP only, magic bytes checked, full ≤ 1.5 MB, thumb ≤ 150 KB, max 3 per spot enforced atomically in the INSERT), `DELETE /api/spots/:id/photos/:photoId` (owner-only), public `GET /api/photos/:id/full|thumb` (immutable 1-year cache, ETag). Bytes in KV namespace `PHOTOS` (`photo/<id>/full|thumb`, contentType in metadata); index in D1 `spot_photos`. `GET /api/spots` adds `photos` via one grouped query; deleting a spot deletes its KV keys. Deployed as Worker `herbs` at https://herbs.aroundme.workers.dev (account subdomain `aroundme`; D1 db "sage")
- `web/` — Vite + React SPA, mobile-first ("Google Maps phone app" feel, installable via `public/manifest.webmanifest`, safe-area aware, light/dark via CSS tokens + `prefers-color-scheme`)
  - `src/App.tsx` — orchestration only (state, data, wiring)
  - `src/map/` — `mapStyle.ts`: hand-built "Sage" vector style (light + dark palettes at top; OpenFreeMap tiles, OpenMapTiles schema; green space is the hero; flat (no 3D/tilt), zooms to z20 for hand-placed pins; street-level detail: building outlines, house numbers (z16.5+), POIs with sprite icons tiered by tile `rank` (landmarks z15, more z16, rest z17), bus/tram stops, footpaths/cycleways, driveways, laneway names, thin tram lines). `basemap.ts`: the single place the style + initial view (Reservoir, z15) are chosen. `useMap`, `useSpotMarkers` (DOM guitar-pick markers + draft pin), `useMapGestures` (tap, long-press-to-add), `useUserLocation` (blue dot)
  - `src/components/` — `SearchBar` (herb search + place search: "Herbs" / "Places" sections; picking a place flies there and shows a temporary dot marker via `map/usePlaceMarker.ts`, cleared on any other selection, clearing the search, or starting to add a herb), `AccountButton`, `BottomSheet` (pointer-event draggable sheet; left card on ≥768px), `SpotDetails` (Directions / Street View / Share / Edit / Delete chips), `SpotForm`, `TagPicker` (heads-up toggle chips + read-only `TagList`), `TagIcon`, `DangerPicker`, `MapControls` (locate, compass, "+ Add herb" FAB), `PlacementOverlay` (centre-pin placement mode), `Snackbar`, `AuthDialog`, `PhotoPicker` (form tiles + "Add photo"), `PhotoViewer` (full-screen `<dialog>`, scroll-snap swipe, arrows/Escape), `icons`
  - `src/lib/` — `hooks.ts` (media queries, colour scheme), `format.ts` (danger labels, distance, Google Maps directions/Street View URLs), `places.ts` + `usePlaceSearch.ts` (place search: Reservoir addresses matched client-side from the Vicmap address JSON, lazy-loaded on first search focus, street-type abbreviations tolerated; elsewhere Photon — photon.komoot.io, OSM, no key, Victoria bbox, biased to map centre/user position, bus stops/platforms excluded — debounced 350 ms, min 3 chars, aborted + cached; Vicmap results first, Photon deduped after), `images.ts` (EXIF-orientation decode → canvas resize 1600/400 px → WebP, JPEG fallback; re-encoding strips EXIF/GPS on purpose), `usePhotoUploads.ts` (form photo state, uploads after the spot saves, per-photo progress/retry; patches local state instead of refetching)
  - All herb markers are the same green (no "mine" colour); selected = larger + deeper green (`--marker-selected`); draft pin = translucent with a ground dot
  - Heads-up tags suggest a danger rating only until the user picks one in the form ("Suggested from heads-up tags"); a manual pick always wins
  - Adding a spot: FAB → move map under centre pin → confirm, or long-press. Plain map taps never add. `?spot=<id>` deep-links select a spot
  - Vicmap overlay (Reservoir only): `sageMapStyle(theme, { vicmap })` adds lot lines (below buildings, from z15.5) and official street numbers, which replace OSM `housenumber` inside the Reservoir outline via a `within` filter. `useMap` turns `vicmap` on once (one-way) the first time the view is z≥14 and overlaps the Reservoir bbox (`vicmapInView` in `basemap.ts`); later `setStyle` diffs keep the GeoJSON sources, so theme swaps don't refetch. `reservoirArea.ts` is generated
- `scripts/vicmap/fetch-reservoir.ts` — `npm run data:vicmap` (`-- --fresh` to re-download). Fetches Vicmap Property/Address/Admin for Reservoir from the open WFS (opendata.maps.vic.gov.au, CC BY 4.0, no account) → `web/public/data/vicmap/reservoir-{parcels,addresses}.json` + `web/src/map/reservoirArea.ts`. Raw pages cached in `.cache/vicmap/`. Runs on Node 24 type stripping (erasable TS only), typechecked via `tsconfig.scripts.json`. Unit addresses collapse to the base number, deduped per number+street within 60 m; addresses kept inside the outline, lots within 200 m of it
- `shared/` — `Spot` type + danger/length constants + heads-up tags (`SPOT_TAGS`, labels, `suggestDanger`) imported by both `src/` and `web/` (included in both tsconfigs)
- `migrations/` — D1 migrations (`wrangler d1 migrations apply sage --local|--remote`); database "sage", binding `DB`. `0004` adds `spot_photos`. `0002` is Better Auth's generated schema — regenerate + add a new migration when upgrading Better Auth or adding plugins
- Config: `BETTER_AUTH_URL` var in `wrangler.jsonc`, `BETTER_AUTH_SECRET` wrangler secret (`.dev.vars` locally, see `.dev.vars.example`); `nodejs_compat` flag needed by Better Auth
- Single root `package.json`; `npm run build` typechecks (strict) both tsconfigs then builds SPA to `dist/client/`
- Auth design decisions: [docs/auth-plan.md](./docs/auth-plan.md)
- Parked future ideas (Street View link, green markers, spot tags, address search, fuzzy herb search/categories): [docs/roadmap.md](./docs/roadmap.md)

## Known tech debt / next up

- Deploying auth: run `wrangler d1 migrations apply sage --remote` and `wrangler deploy` back-to-back — once 0003 runs, the old worker's INSERTs fail (no `user_id`). Set `BETTER_AUTH_SECRET` first: without it (or under 32 chars) every `/api/auth/*` and `/api/spots` request returns 500
- No rate limit on `POST/PATCH/DELETE /api/spots` (Better Auth's limiter only covers `/api/auth/*`) — add a per-user limit before wider sharing
- No password reset (forgotten password = lost account) and no email verification (anyone can register any address) — needs an email service
- No account deletion UI (DB cascades spots on user delete)
- `GET /api/spots` has no LIMIT/pagination
- Every `/api/spots` request does a D1 session lookup — enable Better Auth `session.cookieCache` if it shows up in latency
- ~1 MB JS bundle (MapLibre) — code-split when first-load perf matters
- Basemap depends on OpenFreeMap (free, no key, no SLA) at runtime for tiles, glyphs and sprites — if it goes down the map is blank. Fallback: self-host a Protomaps/PMTiles extract of Victoria on R2. Any future CSP must allow `tiles.openfreemap.org`. Only Noto Sans Regular/Bold/Italic exist on its glyph server
- Sprite icons are pre-coloured, so they don't adapt to dark mode (white badges, read fine)
- POI icons use the OpenFreeMap sprite's `_11` icons at 1x (a bit soft on retina). `SPRITE_ICONS` in `mapStyle.ts` must match the sprite — MapLibre v4 `coalesce` can't fall back past a missing image
- OSM building footprints are patchy in Reservoir (many lots have house numbers but no building) — Vicmap Property parcels would fill this (planned step 3)
- Bus-bay stop labels crowd the Reservoir station forecourt at z18 — show stop names from z19
- iOS Safari: keyboard can cover the form sheet (needs `visualViewport` handling; Android is covered by `interactive-widget=resizes-content`)
- Bottom sheet: when expanded with scrollable body, drag-to-dismiss only works from the handle/header (no scroll→drag hand-off)
- Editing a spot can't move its pin
- One snackbar at a time, no queue; mobile action chips row scrolls sideways
- Danger picker uses `role=radiogroup` without arrow-key nav — swap to visually-hidden native radios if we care
- Delete uses `window.confirm` — fine for now, replace with an in-app dialog if styling matters

- Vicmap lots/numbers are a Reservoir-only POC, snapshot 2026-10-20 (`VICMAP_SNAPSHOT`). Refresh with `npm run data:vicmap -- --fresh` and commit. Lot lines stop ~200 m past the suburb boundary. Keep the CC BY attribution ("Contains Vicmap Property and Vicmap Address data © State of Victoria (Department of Transport and Planning)") if the data moves
- Vicmap data ships as static GeoJSON (~1.8 MB gzipped) parsed client-side — won't scale past a suburb or two. Scaling path: tippecanoe → PMTiles for Victoria on R2, served through the Worker; then drop per-suburb JSON and the `within` swap. Default start view is in Reservoir, so first visits download it
- Large complex sites (villages, deep unit blocks) can repeat their base number; if the Vicmap JSON fails to load, Reservoir has no house numbers (OSM ones are hidden)
- Satellite toggle parked: Vicmap Basemaps aerial (`AERIAL_WM_256`, max z20, CORS ok, excellent) needs a paid DTP subscription — not CC BY. No free keyless open imagery covers Reservoir. Free-with-account options: ArcGIS Location Platform free tier (2M tiles/mo, pay-as-you-go off by default — verify imagery is included), or ask vicmap@transport.vic.gov.au about a community licence. Rudi doesn't want to pay yet

- Photos live in Workers KV (free: 1 GB, 1,000 writes/day **including deletes**, 100k reads/day) — each photo is 2 writes to add and 2 to delete, so ~250 photo adds/deletes a day across all users. If photos take off, move to R2: swap the `PHOTOS` get/put/delete calls in `src/api.ts` for an R2 binding and copy keys
- KV is eventually consistent (~60 s): a new/deleted photo may briefly 404 or linger elsewhere (uploader sees local blobs for the session)
- No photo moderation / "report" button; photo URLs are public (random ids). Uploads not rate limited beyond 3 per spot — one user could burn the daily KV write quota. Photos can't be reordered. Not yet tested with real HEIC files or on real phones

- Migrations 0004 (photos) and 0005 (tags) must be applied --remote before deploying a worker that uses them
- Street View opens the nearest panorama but can't aim at the spot (no `heading` — panorama position unknown)

- Place search outside Reservoir depends on Photon (komoot's free public instance, fair use, no SLA, throttled if heavy) — if it's down only Reservoir addresses are found. Any future CSP must allow `photon.komoot.io` (connect-src). Keep the "© OpenStreetMap contributors, via Photon" credit. Fallbacks: self-host Photon or proxy+cache through the Worker. OSM naming gaps: Reservoir station is just "Reservoir", so "reservoir station" doesn't find it

## Conventions

Role, default stack (TypeScript + Cloudflare), tooling (mise, project-level installs), git identity and sandbox quirks are global defaults in `~/.claude/CLAUDE.md` — only project-specific facts and deviations belong here. Keep this file current: structure and principles here, detail in `./docs/` linked from here.
