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

There is nothing to build or install. The app is plain HTML, CSS and JavaScript, and the libraries it uses (Bootstrap 5.3, JSZip, jsPDF) are in `vendor/`.

**Option 1: open the file.** Double-click `index.html`, or open it from your browser's File menu. It works over `file://`.

**Option 2: serve the folder.** Use this if your browser restricts `file://` pages:

```sh
git clone https://github.com/imsirloris/delta-skins.git
cd delta-skins
python3 -m http.server 8000   # or: npx serve .
```

Then open <http://localhost:8000>.

Requirements:

- A recent Chrome, Edge, Firefox or Safari.
- Node.js 18 or later, only if you want to run the scripts in [Development](#development).

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

The Node scripts load the same modules as the browser (the pure ones are UMD), so you can check layouts and exports without a browser:

```sh
node scripts/smoke.js                          # builds and validates every iPhone × console × layout
node scripts/snap-test.js                      # guides, grid, align and distribute
node scripts/state-test.js                     # project defaults, migrations and resets
node scripts/history-test.js                   # undo/redo stacks
node scripts/validate.js my-skin.deltaskin     # validates info.json and the assets in a .deltaskin
```

There is no bundler or ES modules: each file is a script that registers a `Delta*` global, so the app keeps working over `file://`. `index.html` loads them in dependency order.

### Project structure

| File | Role |
| --- | --- |
| `js/devices.js` | iPhone presets (points, scale, pixels, safe areas) |
| `js/consoles.js` | `gameTypeIdentifier`, `inputFrame` and valid buttons of each console |
| `js/filters.js` | CoreImage filter presets |
| `js/layout.js` | Standard and FlipPad layouts, in points |
| `js/skinjson.js` | Builds `info.json` (also used by the Node scripts) |
| `js/render.js` | Draws the skin artwork on a canvas |
| `js/export.js` | Renders PDF/PNG assets and packs the `.deltaskin` |
| `js/importer.js` | Imports a `.deltaskin` (converts measurements, extracts PNG/PDF artwork) |
| `js/snap.js` | Smart guides, grid, align and distribute |
| `js/refs.js` | Selection references shared by the editor and the inspector |
| `js/editor-overlays.js` | Editor-only drawings (grid, safe area, FlipPad cover, selection, guides) |
| `js/editor.js` | Canvas interaction (selection, drag, resize, keyboard) |
| `js/app/state.js` | Project defaults, migrations of older saves, pure state helpers |
| `js/app/storage.js` | `localStorage` persistence and the debounced autosave |
| `js/app/history.js` | Undo/redo stacks |
| `js/app/images.js` | Reading and decoding background images |
| `js/app/dom.js` | DOM helpers shared by the views (element builder, fields, toast) |
| `js/app/project.js` | Project use cases: layouts, iPhone/console changes, import, open, resets |
| `js/app/views/*.js` | Sidebar, stage, inspector and top bar views |
| `js/app/main.js` | Composition root that wires everything together |
