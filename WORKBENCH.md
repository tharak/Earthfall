# Earthfall Protocol workbench

## Current milestone

Prototype v0.1 — real-world Praça da Sé map pass implemented and build-verified.

## Target flow

Loadout → city selection → mission deployment → destroy eight robots → collect salvage → extract → bank credits → debrief.

## Validation

- `npm run lint` — passed (2026-08-13).
- `npm test` — passed (2026-08-13), including the production build, Sites artifact validation, and rendered HTML test.
- `npm run build:pages` — passed (2026-08-13); static bundle uses relative asset paths.
- `tests/map-data.test.mjs` verifies the 1,024 m extent, source/license metadata, landmark footprint, and minimum building/road coverage.
- Chromium/WebGL render inspected at 1280 × 720 (2026-08-13): real downtown footprints render in a batched scene, Catedral da Sé is centered and marked by twin spires/ring, HUD remains readable, and no application runtime errors occurred.
- Command view, mission selection, loadout changes, and deployment confirmation — inspected in a browser.
- A local Vite server and Playwright Chromium/WebGL session start successfully; command, deployment, and live mission rendering were inspected.
- Open the app, play a successful run, and verify credits persist after reload.
- Fail a run and verify unsecured salvage is not banked.

## Current biggest gap

Full successful and failed combat runs still need an independent local playtest. The new real-world geometry renders correctly in WebGL; combat tuning and navigation through the denser street layout are the next focus.

## Decision log

- Original-IP working title: Earthfall Protocol.
- First playable location: an abstracted Praça da Sé, São Paulo.
- Real map extent: 1,024 × 1,024 m centered on Catedral da Sé at `-23.5512688, -46.6343705`; extract bounds are south `-23.5558682`, west `-46.6393878`, north `-23.5466694`, east `-46.6293532`.
- Google Maps is a landmark reference only. Google map geometry is not copied because its terms prohibit tracing/building a derivative map dataset. Committed building and road data comes from OpenStreetMap contributors under ODbL 1.0 and is visibly attributed in the game.
- The committed extract contains 1,858 buildings and 670 road ways. `npm run generate:map -- <overpass.json> app/data/praca-da-se-map.json` reproduces the game dataset.
- Prototype perspective: elevated third person / isometric to validate the full extraction loop with simple geometry.
- Paid items remain direct-purchase cosmetic previews; no checkout or random rewards in v0.1.
