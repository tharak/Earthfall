# Earthfall Protocol

A geometry-first extraction-shooter prototype set in recognizable urban zones. Choose a weapon and cosmetic suit finish, deploy into real-data abstractions of Praça da Sé or Shibuya Crossing, fight a continuous stream of alien machines, collect unsecured salvage, and leave through any active extraction field to bank it.

The street network is dressed deterministically with abandoned vehicles, barricades, cargo, rubble, and lamps. Major props provide physical combat cover while deployment and landmark areas remain navigable.

This is an original-IP project. It does not include Gantz characters, terminology, designs, story text, or assets.

## Play locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev:pages
```

Open the local address printed by Vite.

## Controls

- WASD or arrow keys: move
- Mouse: aim
- Hold left mouse or Space: fire
- Hold right mouse and drag: rotate camera
- R: reload
- Hold E inside the green field: extract
- On narrow screens, use the on-screen direction and action controls

## Builds

```bash
npm run lint
npm run build
npm run build:pages
```

The static GitHub Pages artifact is written to `github-pages/`. Its paths are relative, so it works below a repository subpath.

## Real-world map data

The São Paulo and Tokyo missions use committed 1,024 × 1,024 m extracts centered on Catedral da Sé and Shibuya Scramble Crossing. Building footprints and roads come from OpenStreetMap contributors under ODbL 1.0; Google Maps content is not copied or redistributed. To refresh a dataset, export an Overpass JSON response with building, highway, and landmark ways for the bounds recorded in `WORKBENCH.md`, then run:

```bash
npm run generate:map -- praca-da-se path/to/overpass.json app/data/praca-da-se-map.json
npm run generate:map -- shibuya-crossing path/to/overpass.json app/data/shibuya-crossing-map.json
```

## Publish with GitHub Pages

The included `.github/workflows/deploy-pages.yml` builds and publishes the static artifact whenever `main` is updated. In the GitHub repository, open **Settings → Pages** and set the source to **GitHub Actions** once. Push the repository to `main`; the workflow handles later deployments.

You can also publish manually by running `npm run build:pages` and uploading the contents of `github-pages/` to any static host.

## Project documents

- `GDD.md` — full game design document and acceptance criteria
- `PROMPT.md` — ready-to-paste Gauntlet Loop prompt for an agentic terminal
- `WORKBENCH.md` — live progress and verification record for future agent runs

## Prototype architecture

- `app/page.tsx` — command view, loadout, HUD, mission flow, and debrief
- `app/game-engine.ts` — mission-loop orchestrator; input, camera, entities, environment, and street generation live in focused sibling modules
- `ARCHITECTURE.md` — module boundaries and a “where to make changes” guide
- `app/globals.css` — interface and responsive presentation
- `prototype/` — standalone Vite entry for static GitHub Pages export

The current enemies use simple state rules. The GDD defines the boundary for replacing them with trained policies later without coupling learned behavior to rendering or mission UI.

World geometry uses a physical scale of one Three.js unit per meter. The operative is exactly 1.80 m tall.
