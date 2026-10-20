# Roadmap: future refinements

Ideas Rudi has parked for later. Sage is a personal, non-commercial proof of concept. Each idea has a short technical note to start from. Items 1–4 shipped 2026-10-21 (see AGENTS.md); item 5 is still parked.

## 1. Open the spot in Google Maps / Street View

- The Directions link already exists (`web/src/lib/format.ts`, `https://www.google.com/maps/dir/?api=1&destination=lat,lng`).
- Add a "Street View" action using the free Maps URLs deep link (no key, no billing): `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=<lat>,<lng>`. It opens the nearest panorama.
  - Caveat: the camera won't necessarily face the spot. A `heading` param exists, but we don't know where the panorama is, so we can't compute it reliably.
- Could also add "Open in Google Maps" (`/maps/search/?api=1&query=lat,lng`) next to Share.

## 2. Green marker instead of orange (plus the browser icon)

- Markers: `web/src/map/useSpotMarkers.ts` and their CSS. Favicon, apple touch icon and theme colour: `web/public/` and `manifest.webmanifest`.
- Check first: the orange may currently mean "your spot" or "selected". If it does, keep some other way to tell them apart (e.g. a ring or a darker green) when everything turns green.

## 3. Optional "heads-up" tags on a spot

Examples: dog, behind fence, security cameras, ask first, private garden, nature strip, public park.

- Data: a `tags` list per spot, either a JSON column or a `spot_tags` table (new migration). The allowed tags live in `shared/` like the danger constants.
- Form: optional toggle chips. Details: small icons/badges.
- Open question: should tags feed the danger rating? Options are to keep them separate, or let them suggest a danger level the user can override (e.g. dog + cameras suggests a higher rating). Lean towards "suggest, don't force".

## 4. Address / place search to move the map

- The search bar currently only finds herbs. Add place results (street addresses, suburbs) that centre the map.
- Reservoir: the Vicmap addresses are already shipped (`web/public/data/vicmap/reservoir-addresses.json`), so address search there can be fully client-side and free.
- Elsewhere: Nominatim or Photon (OpenStreetMap, free, no key). They have usage policies: a low request rate, a proper User-Agent, and debouncing. That's fine for a personal POC. Proxy through the Worker if needed.
- UX: one box with mixed results (Herbs / Places sections), Google-Maps style.

## 5. Smarter herb search and herb categories

- Problem: names are free text (a real spot is called "Baby Rosemarru"), so search misses misspellings.
- Add a curated herb list in `shared/`: common name, aliases, botanical name, category (culinary, tea, medicinal, edible flower, fruit/nut…).
- On a spot, an optional "herb type" picked from that list (with autocomplete), alongside the free-text name.
- Search: fuzzy matching (edit distance, small hand-written function, no new dependency unless it earns its place) against names, aliases and herb types, with "Did you mean rosemary?" suggestions and category filter chips.
- Could backfill existing spots by fuzzy-matching their names to herb types.
