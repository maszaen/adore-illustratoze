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

- `layer`: required `id`, `name`; optional `color` (hex). New layers appear on top.
- `rectangle`, `ellipse`, `polygon`, `star`: required `id`, `layer`, `x`, `y`, `width`, `height`; optional `name`, `fill`, `stroke`, `strokeWidth`, `opacity`, `rotation`. Rectangle, polygon and star additionally accept `cornerRadius`; polygon/star accept integer `sides` (3–100; default 6/5), star accepts `innerRadius` (ratio 0.08–0.95, default 0.45).
- `path`: required `id`, `layer`, `points` (2–1000 items `{x,y,handleIn?,handleOut?}`). Handles are absolute `{x,y}`. Optional `name`, `closed` (default true), `fill`, `stroke`, `strokeWidth`, `opacity`, `rotation`.
- `text`: required `id`, `layer`, `x`, `y`, `text`, `fontSize`; optional `name`, `fontFamily`, `fontStyle` (`Regular`, `Bold`, `Italic`, `Bold Italic`), `fill`, `opacity`, `rotation`. Text is point text, not an area frame.
- `update`: required existing `id`; optional `name`, `x`, `y`, `width`, `height`, `rotation`, `opacity`, `fill`, `text`, `fontSize`. Width/height resize ungrouped rectangle, ellipse, polygon, star, path or line with nonzero original width and height, scaling anchors and handles relative to the unrotated top-left; rotation is retained around the new frame center. This is not a general affine transform; stroke width and corner radii are not scaled. Rotation and position support those vector types plus text; grouped nodes and text resizing are not supported. Text fields require text nodes. Fill is supported on the listed leaf types.
- `delete`: required `id`; only ungrouped leaf nodes, not locked objects/layers. Deleting a group is unsupported.

Colors are six-digit `#RRGGBB`; shape/path fill and stroke can be `null` for none. Fill defaults black, except open paths default to no fill. Stroke defaults none; `strokeWidth` defaults 1. Unknown fields are rejected. Locked layers/nodes/ancestors cannot be edited. Existing unsupported document elements remain untouched unless explicitly affected. The full batch is applied to a clone, so errors do not partially mutate the input.

`inspect` includes node anchors, fills, strokes, text style, hierarchy and `bounds` in document coordinates. Bounds are editor geometry, not rendered ink or effect bounds; text frames may rely on approximate font metrics, rotated text bounds are not expanded, and group bounds may be stale. Inspect is not a screenshot or a full validation of complex objects. Large documents may exceed bridge reply limits.

## TypeScript SDK

Source entry point: `src/agent/design.ts`. For a standalone Node ESM module, run `npm run agent:build` and import `dist/adore-agent-sdk.mjs`. This is currently a repository-local, experimental SDK, not a published package. Public functions:

- `createDesign(documentSettings)` → empty `StudioDocument`
- `createFromSpec(spec)` → document
- `applyOperations(document, operations)` → new document; original unchanged
- `validateDocument(document)` → throws on structural errors
- `inspectDesign(document)` → JSON-compatible summary and stable node IDs
- `readDesign(Uint8Array)` / `writeDesign(document)` → native archive round trip
- `previewDesign(document, artboardId?)` → SVG string

The SDK does not read or write files; CLI handles filesystem IO. Preview is SVG, not an exact screenshot and can differ for unsupported canvas effects, complex objects, and font availability. `.adloze` packing in a headless Node environment uses the existing fallback 1×1 `preview.png`; Adore generates its own Recent Projects preview after import. Structural validation is intentionally partial and does not certify arbitrary document features or untrusted archives.
