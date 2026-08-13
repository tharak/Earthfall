# Architecture

Earthfall keeps React mission flow separate from the Three.js simulation. `app/page.tsx` owns screens, loadout, HUD state, and persistence. `app/game-engine.ts` owns the live mission loop and coordinates focused simulation modules.

## Game module map

- `game-engine.ts` — mission lifecycle and orchestration. It advances combat state and connects the modules below; it should not contain mesh-building or DOM input details.
- `game-types.ts` — shared public contracts and internal entity shapes. UI code imports HUD and control types from here.
- `game-config.ts` — gameplay tuning, world scale, weapons, skins, and mission limits.
- `game-input.ts` — keyboard, aiming pointer, firing input, and input listener cleanup.
- `orbit-camera.ts` — RMB orbit state and camera positioning.
- `enemy-controller.ts` — enemy decision policy, isolated from rendering.
- `entity-factories.ts` — player, extraction point, and enemy Three.js object construction.
- `mission-environment.ts` — lighting, map assembly, authored cover, and alien relay composition.
- `street-obstacles.ts` — deterministic road-prop placement, instanced rendering, and prop collision boxes.
- `real-map.ts` — conversion of committed OSM-derived data into roads, buildings, landmarks, and map collision polygons.
- `map-content.ts` — typed map dataset registry.

## Where to make common changes

- Change weapon damage or mission duration in `game-config.ts`.
- Change controls in `game-input.ts`; change camera feel in `orbit-camera.ts`.
- Change an enemy's appearance in `entity-factories.ts`; change its behavior in `enemy-controller.ts` or the enemy update in `game-engine.ts`.
- Change street density or prop appearance in `street-obstacles.ts`.
- Add global scene lighting or fixed mission decorations in `mission-environment.ts`.
- Add a city by generating a map JSON file, registering it in `map-content.ts`, then adding its mission metadata in `page.tsx`.

Dependencies point toward types/config and scene-building helpers; helpers do not import `GameEngine`. Keep that direction when adding systems so orchestration remains replaceable and testable.
