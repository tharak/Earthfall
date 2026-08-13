# Earthfall Protocol

A geometry-first extraction-shooter prototype set in a recognizable urban zone. Choose a weapon and cosmetic suit finish, deploy into an abstracted Praça da Sé, destroy alien machines, collect unsecured salvage, and reach extraction to bank it.

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

## Publish with GitHub Pages

The included `.github/workflows/deploy-pages.yml` builds and publishes the static artifact whenever `main` is updated. In the GitHub repository, open **Settings → Pages** and set the source to **GitHub Actions** once. Push the repository to `main`; the workflow handles later deployments.

You can also publish manually by running `npm run build:pages` and uploading the contents of `github-pages/` to any static host.

## Project documents

- `GDD.md` — full game design document and acceptance criteria
- `PROMPT.md` — ready-to-paste Gauntlet Loop prompt for an agentic terminal
- `WORKBENCH.md` — live progress and verification record for future agent runs

## Prototype architecture

- `app/page.tsx` — command view, loadout, HUD, mission flow, and debrief
- `app/game-engine.ts` — Three.js scene and deterministic prototype simulation
- `app/globals.css` — interface and responsive presentation
- `prototype/` — standalone Vite entry for static GitHub Pages export

The current enemies use simple state rules. The GDD defines the boundary for replacing them with trained policies later without coupling learned behavior to rendering or mission UI.

