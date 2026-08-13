# Earthfall Protocol workbench

## Current milestone

Prototype v0.1 — first vertical slice implemented and build-verified.

## Target flow

Loadout → city selection → mission deployment → destroy eight robots → collect salvage → extract → bank credits → debrief.

## Validation

- `npm run lint` — passed (2026-08-13).
- `npm test` — passed (2026-08-13), including the production build, Sites artifact validation, and rendered HTML test.
- `npm run build:pages` — passed (2026-08-13); static bundle uses relative asset paths.
- Command view, mission selection, loadout changes, and deployment confirmation — inspected in a browser.
- A local Vite server starts successfully; the available Playwright browser could not start because its Chrome binary is not installed. Complete the combat-loop playtest in a WebGL-capable local browser.
- Open the app, play a successful run, and verify credits persist after reload.
- Fail a run and verify unsecured salvage is not banked.

## Current biggest gap

Full successful and failed combat runs still need an independent local playtest in a WebGL-capable browser. The production build also now has a checked-in empty `.openai/hosting.json` fallback so the default build does not depend on unavailable site bindings.

## Decision log

- Original-IP working title: Earthfall Protocol.
- First playable location: an abstracted Praça da Sé, São Paulo.
- Prototype perspective: elevated third person / isometric to validate the full extraction loop with simple geometry.
- Paid items remain direct-purchase cosmetic previews; no checkout or random rewards in v0.1.
