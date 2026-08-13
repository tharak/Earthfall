# Earthfall Protocol workbench

## Current milestone

Prototype v0.1 — first vertical slice implemented and build-verified.

## Target flow

Loadout → city selection → mission deployment → destroy eight robots → collect salvage → extract → bank credits → debrief.

## Validation

- `npm run lint` — passed.
- `npm test` — passed, including production artifact validation.
- `npm run build:pages` — passed; static bundle uses relative asset paths.
- Command view, mission selection, loadout changes, and deployment confirmation — inspected in a browser.
- The QA browser disables WebGL; the no-WebGL recovery screen was verified. Complete the combat-loop playtest in a WebGL-capable local browser.
- Open the app, play a successful run, and verify credits persist after reload.
- Fail a run and verify unsecured salvage is not banked.

## Current biggest gap

Full successful and failed combat runs still need an independent local playtest in a WebGL-capable browser.

## Decision log

- Original-IP working title: Earthfall Protocol.
- First playable location: an abstracted Praça da Sé, São Paulo.
- Prototype perspective: elevated third person / isometric to validate the full extraction loop with simple geometry.
- Paid items remain direct-purchase cosmetic previews; no checkout or random rewards in v0.1.
