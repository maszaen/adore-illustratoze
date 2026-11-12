# File contract and SDK

## CLI

From repository root, with Node 20+ and dependencies installed:

```sh
npm run agent -- create .agents/skills/adore-design/examples/social-post.json /tmp/social.adloze
npm run agent -- inspect /tmp/social.adloze
npm run agent -- validate /tmp/social.adloze
npm run agent -- preview /tmp/social.adloze /tmp/social.svg
npm run agent -- apply /tmp/social.adloze .agents/skills/adore-design/examples/revise.json /tmp/social-revised.adloze
npm run agent -- preview /tmp/social-revised.adloze /tmp/social-revised.svg
```

`npm run agent -- measure ITEMS.json` measures point text before you create it (see **Measuring text** below). Outside a browser the CLI has no font metrics, so its numbers are estimates.

`preview INPUT OUTPUT [--artboard ID]` selects the active or requested artboard. This is a single-artboard SVG export, not a screenshot. Files must not already exist unless `--force` is passed. `apply` can write a new file or, only with `--force`, replace the source; prefer a new file. The CLI assigns revisions a new document ID so importing them does not replace the original project; node IDs stay stable. The lower-level `applyOperations` SDK function preserves the source document ID, so SDK clients creating a separate project must assign a new one themselves. JSON inputs are limited to 5 MiB and compressed .adloze files to 32 MiB. These limits do not cap decompressed archive size: use trusted files only.

## Spec

```json
{
  "version": 1,
  "document": { "name": "Example", "width": 1080, "height": 1080, "unit": "px", "colorMode": "RGB" },
  "operations": [
    { "op": "layer", "id": "headline-layer", "name": "Headline", "color": "#4F9EFF" },
    { "op": "rectangle", "id": "panel", "layer": "artwork", "x": 40, "y": 40, "width": 800, "height": 400, "fill": "#F4EBDC" },
    { "op": "text", "id": "title", "layer": "headline-layer", "x": 80, "y": 100, "text": "Hello", "fontSize": 72, "fontStyle": "Bold", "fill": "#34251F" }
  ]
}
```

Required document fields: `name`, `width`, `height`. Optional `unit` (`px` or `pt`, default `px`), `colorMode` (`RGB` or `CMYK`, default `RGB`). Dimensions are positive, maximum 100000 points. Every spec includes `version: 1` and an operations array (max 1000). An initially empty layer `artwork` exists. Created layers appear above previous layers. Nodes are appended to their layer, above earlier nodes.

### Operations

All shapes, paths and text accept optional `opacity` (0–1) and `rotation` (degrees around the node's frame center). For create and update, `fill` accepts a solid `#RRGGBB`, `null` for none, or a gradient:

```json
{"type":"linear","angle":45,"stops":[{"offset":0,"color":"#112233","opacity":1},{"offset":1,"color":"#aabbcc","opacity":0.2}]}
```

Gradient type is `linear` or `radial`; angle defaults to 0 (radial is centered and ignores angle). Stops must be sorted by offset, with 2–32 stops; offset and optional opacity are 0–1. Fill changes replace the entire existing fill stack. Gradients, including text gradients, are editable in the editor. SVG preview is approximate.

Fill can also be `{"type":"solid","color":"#RRGGBB","opacity":0.5}`; gradient fills accept the same whole-fill `opacity` (multiplied with stop opacity).

#### Shared style fields

- `blendMode`: `normal`, `darken`, `multiply`, `color-burn`, `lighten`, `screen`, `color-dodge`, `overlay`, `soft-light`, `hard-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`.
- `effects`: array of at most 3, one per type; `[]` removes all. Defaults in brackets.
  - `{"type":"drop-shadow","x":[6],"y":[6],"blur":[6],"color":["#000000"],"opacity":[0.5]}`: x/y offset in points; the offset turns with the object's rotation.
  - `{"type":"outer-glow","blur":[12],"color":["#FFFFFF"],"opacity":[0.8]}`
  - `{"type":"gaussian-blur","radius":[6]}`
  - Blur and glow are Gaussian standard deviations in points. Effects render in the canvas, SVG and PNG; the PDF export omits them and warns.
- Stroke (shapes, paths, text): `stroke` (`#RRGGBB` or null), `strokeWidth` (default 1), `strokeOpacity`, `strokeDash` (dash/gap lengths, `[]` for solid), `strokeCap` (`butt`, `round`, `projecting`; default `round`), `strokeJoin` (`miter`, `round`, `bevel`; default `round`). Strokes are centered on the path. The detail fields need a stroke color.

#### Operations

- `layer`: required `id`, `name`; optional `color` (hex). New layers appear on top.
- `rectangle`, `ellipse`, `polygon`, `star`: required `id`, `layer`, `x`, `y`, `width`, `height`; optional `name`, `fill`, stroke fields, `opacity`, `blendMode`, `effects`, `rotation`. Rectangle, polygon and star additionally accept `cornerRadius`; polygon/star accept integer `sides` (3–100; default 6/5), star accepts `innerRadius` (ratio 0.08–0.95, default 0.45).
- `path`: required `id`, `layer`, `points` (2–1000 items `{x,y,handleIn?,handleOut?}`). Handles are absolute `{x,y}`. Optional `name`, `closed` (default true), `fill`, stroke fields, `opacity`, `blendMode`, `effects`, `rotation`.
- `text`: required `id`, `layer`, `x`, `y`, `text`, `fontSize`; optional `name`, `fontFamily`, `fontStyle` (`Regular`, `Bold`, `Italic`, `Bold Italic`), `tracking` (letter spacing in thousandths of an em, like Illustrator: 100 = 0.1 em; −1000 to 10000), `align` (`left`, `center`, `right`: `x` is the left edge, center or right edge), `lineHeight` (points between baselines; default 1.2 × size), `fill`, stroke fields, `opacity`, `blendMode`, `effects`, `rotation`. `y` is the top of the text frame. Text is point text, not an area frame; `\n` starts a new line.
- `group`: required `id`, `children` (IDs of top-level objects on one unlocked layer); optional `name`, `opacity`, `blendMode`, `effects`. Children keep their stacking order; the group takes the stack position of the top-most child. Group opacity fades the group as a whole, so overlapping children do not show through each other.
- `clip`: clipping mask. Required `id`, `mask` (a rectangle, ellipse, polygon, star or path), `content` (IDs of objects to clip); optional `name`, `opacity`, `blendMode`, `effects`. All members must be top-level objects on one unlocked layer. Only the parts of the content inside the mask shape show; the mask's own fill and stroke are not drawn. Inspect reports the mask as `clipMask`.
- `ungroup`: required `id` of a group or clipping group. Children return to its place in the stack. Group opacity, blend mode and effects are discarded. Releasing a clipping group leaves the mask as an unpainted path (no fill or stroke), as in Illustrator.
- `update`: required existing `id`; optional `name`, `x`, `y`, `width`, `height`, `rotation`, `opacity`, `blendMode`, `effects`, `fill`, stroke fields, and for text `text`, `fontSize`, `fontFamily`, `fontStyle`, `tracking`, `align`, `lineHeight`. Objects inside groups and clipping groups can be updated; group frames are recomputed afterwards. `x`/`y` on a group or clipping group moves it with all its contents (relative to its frame, recomputed from the children first). Width/height resize rectangle, ellipse, polygon, star, path or line with nonzero original width and height, scaling anchors and handles relative to the unrotated top-left; rotation is retained around the new frame center. This is not a general affine transform; stroke width and corner radii are not scaled. Groups cannot be resized or rotated; rotate or resize their children instead. `fontSize` without `lineHeight` resets the line height to 1.2 × size. Text edits keep the alignment anchor (left edge, center or right edge) where it was. Setting `stroke` to a color replaces the stroke stack with one stroke and keeps unspecified details; other stroke fields alone edit the existing stroke; `stroke: null` removes it.
- `delete`: required `id`. Deletes an object, or a group or clipping group with everything in it. A group left empty is removed too. A clipping mask, or the last object clipped by it, cannot be deleted on its own; delete or ungroup the clipping group instead. Export assets and saved selections that pointed at deleted objects are cleaned up.

Objects inside other containers (blends, compound paths, live paint groups and similar) cannot be edited by agents. Locked objects, ancestors and layers cannot be edited.

Colors are six-digit `#RRGGBB`; shape/path fill and stroke can be `null` for none. Fill defaults black, except open paths default to no fill. Stroke defaults none; `strokeWidth` defaults 1. Unknown fields are rejected. Locked layers/nodes/ancestors cannot be edited. Existing unsupported document elements remain untouched unless explicitly affected. The full batch is applied to a clone, so errors do not partially mutate the input.

### Inspect output

`inspect` includes node anchors, fills, strokes, effects, text style and hierarchy, plus three boxes in document coordinates:

- `bounds`: the editable frame (rotation applied for vector shapes). Group frames can be stale, so do not use them for layout.
- `visualBounds`: what the object visibly covers. It includes half the stroke width, rotation, the drawn curve (not its control handles), group children, the clipping mask's limit for clipping groups, and the painted glyphs for text. Use this for spacing and alignment. Miter spikes on sharp corners can reach slightly further.
- `effectBounds` (only with shadow/glow/blur): a generous estimate of how far effects reach.

Text nodes also list `textLines` with each line's `width` and absolute `baseline`. `measurement.text` is `canvas` when real browser font metrics were used (live bridge) and `approximate` otherwise (CLI/SDK in Node; about 0.56 × font size per character). Text boxes marked `visualBoundsApproximate: true` are estimates. Through the live bridge, `measurement.fonts` lists each font family used and whether the browser has it (`available: false` means a fallback font is drawn). Inspect is not a screenshot or a full validation of complex objects. Large documents may exceed bridge reply limits.

### Measuring text

Input: an array of 1–100 items `{ "text", "fontSize", "fontFamily"?, "fontStyle"?, "tracking"?, "align"?, "lineHeight"? }` (same meaning and defaults as the `text` operation; `\n` makes extra lines). Each result describes text placed by a `text` operation at `x = 0, y = 0`:

- `frame`: the box the new text object will have, relative to x/y (with `align: center` its `x` is negative).
- `baseline`: y of the first baseline; `lineHeight` and `lines[].baseline` for the rest.
- `ink`: the painted glyph box relative to the x/y you pass. To center text on `cx`, use `x = cx - (ink.x + ink.width / 2)`; to put the cap tops at `top`, use `y = top - ink.y`.
- `source`: `canvas` or `approximate`.

```json
[{ "text": "Summer Sale", "fontSize": 72, "fontFamily": "Arial", "fontStyle": "Bold" }]
```

Checked in Chrome against rendered pixels: `ink` was within about 1.3 px of the drawn glyphs for Arial, Georgia italic, bold and two-line text. Results depend on the fonts installed on the browser user's computer.

## TypeScript SDK

Source entry point: `src/agent/design.ts`. For a standalone Node ESM module, run `npm run agent:build` and import `dist/adore-agent-sdk.mjs`. This is currently a repository-local, experimental SDK, not a published package. Public functions:

- `createDesign(documentSettings)` → empty `StudioDocument`
- `createFromSpec(spec)` → document
- `applyOperations(document, operations)` → new document; original unchanged
- `validateDocument(document)` → throws on structural errors
- `inspectDesign(document)` → JSON-compatible summary and stable node IDs
- `readDesign(Uint8Array)` / `writeDesign(document)` → native archive round trip
- `previewDesign(document, artboardId?)` → SVG string
- `measureTexts(items)` → text frame, baseline and ink sizes (estimates outside a browser)

The SDK does not read or write files; CLI handles filesystem IO. Preview is SVG, not an exact screenshot and can differ for unsupported canvas effects, complex objects, and font availability. `.adloze` packing in a headless Node environment uses the existing fallback 1×1 `preview.png`; Adore generates its own Recent Projects preview after import. Structural validation is intentionally partial and does not certify arbitrary document features or untrusted archives.
