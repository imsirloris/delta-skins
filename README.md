# Delta Skin Generator

A browser app that builds skins (`.deltaskin`) for the [Delta emulator](https://faq.deltaemulator.com) with the exact measurements of a specific iPhone. It is made mainly for the **8BitDo FlipPad** controller.

It follows the [Delta skin spec](https://noah978.gitbook.io/delta-docs/skins) and its [filter examples](https://noah978.gitbook.io/delta-docs/skins/filter-examples). iPhone resolutions come from [iosref.com](https://iosref.com/res).

## Built for the 8BitDo FlipPad

The 8BitDo FlipPad clips onto the iPhone and covers the bottom part of the screen in portrait. It has its own physical buttons, so a normal skin's on-screen buttons end up under the controller.

**FlipPad layout** builds a portrait skin for that setup:

- Only the game screen and Delta's own buttons are on the skin. The game buttons are on the controller.
- Delta's buttons are spaced-out text labels (**MENU**, **SAVE**, **LOAD**, **FFW**) right above the covered area, in the style of the `ekwipt_graphite` GBA skin.
- The covered area starts at 550pt on the iPhone 17 Pro. The editor shows it hatched. On other iPhones the layout is scaled by screen width.
- The game screen is centered between the top safe area and the buttons. On the Nintendo DS, both screens fill the space above the buttons.
- Landscape uses the standard layout, because the FlipPad is only used in portrait.
- Changing iPhone or console keeps the FlipPad layout.

The app UI and the default skin colors use the FlipPad black matte palette: a matte black background, `#252525` buttons and light gray (`#c0c1c4`) labels.

## Features

- iPhone presets from the iPhone SE (1st gen) to the iPhone 17 Pro Max, plus custom sizes.
- Game Boy (Color), Game Boy Advance, NES, Super NES, Nintendo 64, Nintendo DS and Sega Genesis.
- Three layouts: standard (every button on screen), FlipPad, or imported from an existing `.deltaskin`.
- Canvas editor with smart guides, a grid, multi-selection, align and distribute tools, and undo/redo.
- `extendedEdges`, CoreImage screen filters and thumbsticks.
- Generated artwork with editable colors, or your own background image for each orientation.
- PDF (`resizable`) or PNG (`small`/`medium`/`large`) assets.
- Autosave, project files, and reset buttons for colors, layout or everything.

## Getting started

Open the app at <https://imsirloris.github.io/delta-skins/>. It runs entirely in your browser: nothing is uploaded, and projects autosave to your browser's storage.

To run it locally you need [Node.js](https://nodejs.org) 20 or later:

```sh
git clone https://github.com/imsirloris/delta-skins.git
cd delta-skins
npm install
npm run dev
```

Then open the address Vite prints (by default <http://localhost:5173/delta-skins/>).

The app needs a recent Chrome, Edge, Firefox or Safari. Opening `index.html` directly from disk does not work, because the source is TypeScript that Vite compiles.

## Quick start: a FlipPad skin

1. Under **iPhone**, pick your model.
2. Under **Console**, pick the system and click **FlipPad layout**.
3. Adjust the layout on the canvas if you want (see [Editor guide](#editor-guide)).
4. Under **Art**, pick the colors, or upload your own image for each orientation.
5. Click **Export .deltaskin**.
6. Send the file to your iPhone with AirDrop or the Files app, and open it in Delta to import it.

Turn on **debug** (under **Skin**) to make Delta draw the touch areas in red, so you can check the mapping on the device.

## Editor guide

Drag an element to move it, and drag the handle in its corner to resize it. Screens keep the aspect ratio of their `inputFrame` while resizing.

| Action | Input |
| --- | --- |
| Move the selection 1pt | Arrow keys |
| Move the selection 10pt (or one grid step with **Snap to grid**) | Shift + arrow keys |
| Resize without keeping the aspect ratio (or keep it, for rectangular buttons) | Hold Shift while resizing |
| Move without snapping to guides | Hold Alt while dragging |
| Add or remove an element from the selection | Shift/Ctrl/Cmd + click, on the canvas or in the element list |
| Select several elements | Drag on an empty area |
| Select every button | Ctrl/Cmd + A |
| Clear the selection | Esc |
| Delete the selected buttons | Delete or Backspace |
| Undo | Ctrl/Cmd + Z |
| Redo | Ctrl/Cmd + Shift + Z, or Ctrl/Cmd + Y |

- **Guides**: while you drag, elements snap to the edges and centers of other elements and to the center of the skin. Pink lines show the alignment.
- **Grid**: shows a grid (8pt by default). With **Snap to grid**, positions round to the grid when no guide matches.
- **Several elements selected**: the inspector can align them (left, center, right, top, middle, bottom), distribute them horizontally or vertically (3 or more), and match their width or height.
- **Undo/Redo** covers positions, alignment, iPhone and console changes, inspector edits and resets. Uploaded background images are not part of the history.
- The right panel edits inputs, labels, shapes, frames, `extendedEdges` and the CoreImage filters of each screen.

## Importing an existing skin

**Import .deltaskin** uses an existing skin as the base:

- Its screens, buttons and filters are converted to the points of the selected iPhone.
- Its artwork (a PNG, or the image inside a PDF) becomes the background.
- Changing the iPhone converts the skin again.
- The artwork already has the buttons drawn on it, so moving an element in the editor does not move the drawing.
- Orientations that the skin doesn't have get the standard layout.
- Skins with vector PDF artwork are not supported.

## Resetting

Each reset asks for confirmation and can be undone.

| Button | Location | What it resets |
| --- | --- | --- |
| **Reset colors** | Art section | Art colors and landscape opacity go back to the black matte defaults. |
| **Reset layout** | Console section | Every element goes back to its default position for the current layout (standard, FlipPad or imported), and the iPhone's safe areas go back to the preset values. Colors and images are kept. |
| **Reset everything** | Top bar | iPhone, console, layout, colors, skin settings and view options (guides, grid, overlays) all go back to their defaults. |

**Reset everything** also removes uploaded and imported images. Undo brings back the project but not those images, and view options stay at their defaults.

## How the measurements work

- `mappingSize` is the device's logical resolution in points. For example, the iPhone 17 Pro is 402×874 in portrait and 874×402 in landscape. All frames use this coordinate system, so the mapping is 1:1 on the selected iPhone. Delta scales the skin on other devices.
- Images are rendered at the physical resolution (points × scale, for example 1206×2622 px).
  - **PDF**: a `resizable` asset, with the page size in points.
  - **PNG**: the same file is used as `small`, `medium` and `large`.
- iPhones with a notch or Dynamic Island use the `edgeToEdge` representation, and iPhones with a home button use `standard`. Delta only shows a skin on devices of the same family.
- The screen areas are transparent in the exported image.
- The safe areas (notch and home indicator) are approximate and only used by the automatic layouts. You can edit them in the sidebar.

## Projects and autosave

The project autosaves to your browser's `localStorage`. Large background images may not fit there, and the app warns you when that happens. Use **Save project** to download a JSON file with everything, images included, and **Open project** to load it again.

## Development

The app is TypeScript bundled with [Vite](https://vite.dev). Bootstrap 5.3, JSZip and jsPDF come from npm.

```sh
npm run dev                                   # dev server with hot reload
npm run typecheck                             # strict type check of the app, tests and scripts
npm test                                      # Vitest: every iPhone × console × layout, snapping, state, undo/redo
npm run build                                 # type check, then build the static site into dist/
npm run preview                               # serve dist/ as GitHub Pages would
npm run validate -- my-skin.deltaskin         # validates info.json and the assets in a .deltaskin
```

The pure modules (layouts, `info.json`, state, snapping) have no DOM, so the tests and the validator run them in Node.

### Deployment

`.github/workflows/deploy.yml` runs the type check, the tests and the build on every push and pull request. Pushes to `main` publish `dist/` to GitHub Pages, which needs **Settings > Pages > Source** set to **GitHub Actions**. The site is served from `/delta-skins/`, set as `base` in `vite.config.ts`; change it there if the site moves (to `/` for a custom domain).

### Project structure

| File | Role |
| --- | --- |
| `src/types.ts` | Data model: project state, presets, editor context and Delta's `info.json` |
| `src/devices.ts` | iPhone presets (points, scale, pixels, safe areas) |
| `src/consoles.ts` | `gameTypeIdentifier`, `inputFrame` and valid buttons of each console |
| `src/filters.ts` | CoreImage filter presets |
| `src/layout.ts` | Standard and FlipPad layouts, in points |
| `src/skinjson.ts` | Builds `info.json` (also used by the tests and the validator) |
| `src/render.ts` | Draws the skin artwork on a canvas |
| `src/export.ts` | Renders PDF/PNG assets and packs the `.deltaskin` |
| `src/importer.ts` | Imports a `.deltaskin` (converts measurements, extracts PNG/PDF artwork) |
| `src/snap.ts` | Smart guides, grid, align and distribute |
| `src/refs.ts` | Selection references shared by the editor and the inspector |
| `src/editor-overlays.ts` | Editor-only drawings (grid, safe area, FlipPad cover, selection, guides) |
| `src/editor.ts` | Canvas interaction (selection, drag, resize, keyboard) |
| `src/app/state.ts` | Project defaults, migrations of older saves, pure state helpers |
| `src/app/storage.ts` | `localStorage` persistence and the debounced autosave |
| `src/app/history.ts` | Undo/redo stacks |
| `src/app/images.ts` | Reading and decoding background images |
| `src/app/dom.ts` | DOM helpers shared by the views (element builder, fields, toast) |
| `src/app/project.ts` | Project use cases: layouts, iPhone/console changes, import, open, resets |
| `src/app/views/*.ts` | Sidebar, stage, inspector and top bar views |
| `src/app/main.ts` | Composition root that wires everything together |
| `tests/*.test.ts` | Vitest suites |
| `scripts/validate.ts` | `.deltaskin` / `info.json` validator (CLI and tests) |
