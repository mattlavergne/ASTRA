# ASTRA

A small universe you can play with. Launch stars, bend gravity, and connect your own constellations.

## Play

- Four distinct presets: Orbital, Binary stars, Vortex, and Supernova.
- Hold to attract or repel particles. Drag back and release to launch a cluster.
- Place and connect stars with the constellation tool. Undo removes the last star.
- Adjust gravity, time speed, and particle count while the universe runs.
- Pause, reset, enter full screen, or turn on quiet musical feedback.
- Mouse, touch, and keyboard controls. Reduced-motion preferences start the simulation paused.

## Run locally

Serve `dist/` using any static HTTP server. For example, from the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. Use an HTTP server because browsers restrict JavaScript module loading from `file://` URLs.

There is no install or build step. No application framework, API key, or backend is required. Optional Google Fonts have local system-font fallbacks.

## Keyboard

| Key | Action |
| --- | --- |
| 1 / 2 / 3 / 4 | Attract / Repel / Launch / Connect |
| Tab | Move between controls and the universe |
| Arrow keys | Move your aim when the universe is focused |
| Shift + arrows | Move your aim farther |
| Enter | Toggle a gravity tool, launch a cluster, or place a star |
| Space | Pause or resume when a form control is not focused |
| R | Reset the current universe |
| H | Open the instructions |
| Escape | Release a gravity tool or close the instructions |

## Project

- `dist/index.html`: semantic interface and accessible controls.
- `dist/styles.css`: responsive visual design.
- `dist/physics.js`: deterministic, bounded particle model.
- `dist/app.js`: rendering, interaction, audio, and keyboard behavior.
- `tests/physics.test.js`: numerical stability and behavior checks.
- `scripts/check-assets.js`: static entrypoint and local-reference checks.
- `.openai/hosting.json`: the connected Sites project.

The physics model uses softened inverse-square attraction, integration substeps, and particle recycling. It is designed for play, not astronomical predictions. There is no telemetry or saved personal data.

## Checks

With Node.js 22 or newer:

```sh
npm run check
npm test
```

These check source syntax, local asset references, UI control references, numerical stability in all four presets, force direction, launch limits, resize handling, and zero-time behavior. They are not browser or visual tests.

## GitHub Pages

The repository is ready for branch-based GitHub Pages hosting. In the repository's Settings, open Pages and select deployment from `main` and `/ (root)`. The root entrypoint opens the application in `dist/`. No GitHub Actions workflow is needed.

The current hosted preview is managed separately by the connected Sites project. Enabling GitHub Pages makes a separate public copy of this static application.
