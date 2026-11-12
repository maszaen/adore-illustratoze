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

- `layer`: required `id`, `name`; optional `color` (hex).
- `rectangle`, `ellipse`: required `id`, `layer`, `x`, `y`, `width`, `height`; optional `name`, `fill`, `stroke`, `strokeWidth`.
- `path`: required `id`, `layer`, `points` (2–1000 items `{x,y,handleIn?,handleOut?}`). Handles are absolute `{x,y}`. Optional `name`, `closed` (default true), `fill`, `stroke`, `strokeWidth`.
- `text`: required `id`, `layer`, `x`, `y`, `text`, `fontSize`; optional `name`, `fontFamily`, `fontStyle` (`Regular`, `Bold`, `Italic`, `Bold Italic`), `fill`. Text is point text, not an area frame.
- `update`: required `id` of existing node; optional `name`, `x`, `y`, `fill`, `text`, `fontSize`. Position moves geometry and handles together; only basic leaf shapes, paths and text can be moved. Text fields require text nodes. Changing fill replaces its entire fill stack; not supported for complex objects. No resize/rotate.
- `delete`: required `id`; only ungrouped leaf nodes, not locked objects/layers. Deleting a group is unsupported.

Colors are six-digit `#RRGGBB`; shape/path fill and stroke can be `null` for none. Fill defaults black, except open paths default to no fill. Stroke defaults none; use `stroke` to make open paths visible. `strokeWidth` defaults 1. Unknown fields are rejected. Editing preserves unsupported document elements unless explicitly affected by an operation. The full batch is applied to a clone, so errors do not partially mutate the input.

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
