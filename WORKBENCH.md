# Earthfall Protocol workbench

## Current milestone

Prototype v0.1 — real-world Praça da Sé and Shibuya Crossing maps implemented and build-verified.

## Target flow

Loadout → city selection → mission deployment → fight and collect salvage for as long as desired → use any active extraction point → bank credits → debrief.

## Validation

- Compact salvage HUD inspected in Pixel 7 emulation (2026-08-14): the standalone unsecured panel is absent and the bottom action reads `EXTRACT 0`, using the live carried-salvage value.
- Camera-relative movement inspected in Firefox/WebGL (2026-08-14): after orbiting the camera approximately 90 degrees, holding W moved the player along the rotated camera-forward axis on the tactical map instead of the fixed world Z axis.
- Split aiming controls inspected in desktop and Pixel 7 touch emulation (2026-08-14): desktop pointer movement drives ground-plane aim; the floating stick drives movement and pawn heading on touch; firing continues along pawn facing; no automatic enemy targeting or browser console errors occurred.
- `app/` code-quality refactor (2026-08-14): shared map/mission contracts now originate in `game-types.ts`; gameplay and search tuning moved to `game-config.ts`; transient Three.js effects moved out of the mission orchestrator into `entity-factories.ts`; and `page.tsx` was decomposed into focused mission, command, loadout, deployment, and debrief render sections without moving React flow ownership.
- Strict TypeScript checking now covers Three.js through `@types/three`; the game client passes `tsc --noEmit`. Cloudflare ambient types remain a separate worker/database follow-up.
- Firefox/WebGL refactor regression inspected at 1280 × 720 (2026-08-14): command view, loadout modal, carbine/suit selection, deployment confirmation, and live Praça da Sé mission all rendered correctly with no application console errors.
- Refactor validation (2026-08-14): `npm run lint`, `npm test`, and `npm run build:pages` all pass; all three automated tests remain green and the static Pages bundle is refreshed.
- `npm run lint` — passed (2026-08-13).
- `npm test` — passed (2026-08-13), including the production build, Sites artifact validation, and rendered HTML test.
- `npm run build:pages` — passed (2026-08-13); static bundle uses relative asset paths.
- `tests/map-data.test.mjs` verifies the 1,024 m extent, source/license metadata, landmark footprint, and minimum building/road coverage.
- Chromium/WebGL render inspected at 1280 × 720 (2026-08-13): real downtown footprints render in a batched scene, Catedral da Sé is centered and marked by twin spires/ring, HUD remains readable, and no application runtime errors occurred.
- Daylight/minimap pass inspected in Chromium/WebGL at 1280 × 720 (2026-08-13): clear sky and warm sun expose street geometry; the 400 m tactical map shows real roads/buildings, player heading, enemy types, salvage, landmark, and extraction without overlapping the HUD.
- Shibuya Crossing selection, Zone 02 briefing, deployment, live combat scene, scramble markings, Tokyo skyline, and Tokyo-specific minimap inspected in Chromium/WebGL at 1280 × 720 (2026-08-13); no application runtime errors occurred.
- Deterministic street dressing inspected in both missions at 1280 × 720 (2026-08-13): abandoned vehicles, barricades, crates, rubble, and lamps populate the road geometry; large props provide collision cover while spawn, extraction, and landmark centers remain clear.
- RMB camera orbit inspected in Chromium at 1280 × 720 (2026-08-13): horizontal and vertical drag rotate/elevate the camera, release returns the mouse to aiming, and no automatic building-avoidance movement remains.
- Maintainability refactor inspected in Chromium (2026-08-13): the engine orchestrator fell from 1,063 to 572 lines; input, orbit camera, configuration, shared types, enemy policy, entity factories, mission environment, and street props now have focused modules. Movement, firing, orbit, mission failure/debrief, and zero browser errors were verified.
- Continuous-combat pass inspected in Chromium (2026-08-13): enemies steer around local obstacles and converge on the player; four active extraction points render on the minimap from deployment. Each kill schedules a same-kind replacement after 650 ms, and extraction no longer requires objective completion.
- Command view, mission selection, loadout changes, and deployment confirmation — inspected in a browser.
- A local Vite server and Playwright Chromium/WebGL session start successfully; command, deployment, and live mission rendering were inspected.
- Open the app, play a successful run, and verify credits persist after reload.
- Fail a run and verify unsecured salvage is not banked.

## Current biggest gap

Full successful and failed combat runs still need an independent local playtest. The new real-world geometry renders correctly in WebGL; combat tuning and navigation through the denser street layout are the next focus.

## Decision log

- WASD, arrow-key, and touch-stick movement are camera-relative; orbiting the camera rotates both movement input and touch-stick aim by the same yaw so controls remain visually aligned.
- Aim input is device-specific: desktop uses the mouse ground position, touch uses the floating movement-stick vector, and hybrid devices follow the most recently used aim device. Shots always use pawn facing; enemy auto-aim remains disabled.
- The 2026-08-14 full-repository quality pass completed `app/` first and stopped at the documented scope boundary; `worker/`, `db/`, `scripts/`, `prototype/`, and `tests/` remain for a focused follow-up rather than receiving a superficial mixed-concern refactor.
- Game-client dependencies continue to point toward shared types/config and focused helpers. No helper imports `GameEngine`; the orchestrator no longer constructs meshes.
- Original-IP working title: Earthfall Protocol.
- First playable location: an abstracted Praça da Sé, São Paulo.
- Real map extent: 1,024 × 1,024 m centered on Catedral da Sé at `-23.5512688, -46.6343705`; extract bounds are south `-23.5558682`, west `-46.6393878`, north `-23.5466694`, east `-46.6293532`.
- Google Maps is a landmark reference only. Google map geometry is not copied because its terms prohibit tracing/building a derivative map dataset. Committed building and road data comes from OpenStreetMap contributors under ODbL 1.0 and is visibly attributed in the game.
- The committed São Paulo extract contains 1,858 buildings and 670 road ways. `npm run generate:map -- praca-da-se <overpass.json> app/data/praca-da-se-map.json` reproduces the game dataset.
- Shibuya map extent: 1,024 × 1,024 m centered on Shibuya Scramble Crossing at `35.6594951, 139.7004982`; extract bounds are south `35.6548957`, west `139.6948374`, north `35.6640945`, east `139.7061590`.
- The committed Shibuya extract contains 1,828 buildings, 1,487 road ways, and the crossing's 64-point source area. It uses the same ODbL attribution and generator pipeline as São Paulo.
- Physical scale is one world unit per meter. The player capsule is 1.80 m tall (`0.48 m` radius plus a `0.84 m` straight section); authored mission placements are expanded to preserve the intended 400 m combat footprint.
- Rendering repair: road faces use upward winding and OSM building heights are tactically compressed while footprints remain meter-accurate.
- Camera orbit is player-controlled: hold the right mouse button and drag horizontally. Automatic building-avoidance steering is disabled.
- Street dressing is generated deterministically from eligible OSM road segments, capped at 280 instanced props per mission with spacing and safe-zone rules.
- Prototype perspective: elevated third person / isometric to validate the full extraction loop with simple geometry.
- Paid items remain direct-purchase cosmetic previews; no checkout or random rewards in v0.1.
