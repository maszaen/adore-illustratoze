---
name: adore-design
description: Create, inspect, validate, preview and revise editable Adore Illustratoze documents through the file-based SDK and CLI. Use when a user asks to create or edit an .adloze design.
---

# Adore design — external agent workflow

Use the repository's file-based SDK and CLI by default. An optional experimental local MCP bridge can access the active browser document after explicit user pairing; see `references/live-mcp.md`. This skill does not include a model or permission to modify a user's project without approval. Run commands from the repository root on Node 20+ after `npm ci`. The editor itself remains a browser app; the local CLI is for agents.

## Workflow
1. Understand size, audience, copy, palette and format; ask about missing essentials, otherwise make reasonable choices and say what you assumed.
2. Create a version-1 JSON specification (see `references/design-api.md` and `examples/social-post.json`). Use meaningful stable IDs and named layers. Coordinates are **points**; px and pt are both 1 point here. New documents currently support px or pt.
3. Run `npm run agent -- create path/spec.json path/design.adloze`. The CLI refuses to overwrite by default. Do not use `--force` unless the user explicitly permits replacing that file.
4. Run `npm run agent -- validate path/design.adloze` and `npm run agent -- preview path/design.adloze path/preview.svg`. Open the SVG using a viewer if available. The SVG is an approximation, not a pixel-identical editor screenshot; installed fonts and unsupported effects can differ. If you cannot visually inspect it, be explicit.
5. Tell the user to open the `.adloze` in Adore; all SDK-created shapes, paths and text are editable. Keep the original spec when practical.
6. To revise an existing local `.adloze`, inspect it first, write a JSON array of operations using existing IDs, then run `npm run agent -- apply original.adloze changes.json revised.adloze`. Keep the original; don't overwrite it without approval. The CLI gives the revision a new document ID, so importing it does not replace the original project in Adore. Revalidate and preview. See `examples/revise.json`.

## Design craft
Use a clear type hierarchy, adequate contrast, alignment, and intentional whitespace. Prefer a limited palette and readable typography; don't cram content into a frame. Name layers and objects by function. Text is point text, with size measured approximately outside a browser; verify layout in the actual editor. Don't claim print readiness or font fidelity without checking.

## Safety and limits
- `inspect`/`validate` perform structural checks, not a complete security audit. Open only trusted `.adloze` archives and SVG previews. These tools are not a sandbox; archive decompression and embedded images may consume resources.
- Apply operations are atomic in memory: an invalid operation produces no output. They affect only the supplied file, not an open browser document; opening a revised file is a separate manual action.
- Create rectangle (including rounded corners), ellipse, polygon, star, path, point text and layers with solid or linear/radial gradient fills and opacity. Update supported leaf nodes including position, vector width/height, rotation, opacity, fill and basic text; delete ungrouped nodes. `update.fill` replaces the entire fill stack. Inspect reports geometry, anchors and styles; bounds are approximate, not rendered ink. Editing groups, effects, images and artboards is not provided.
- Geometry is in absolute document coordinates. Path handles are absolute coordinates, not offsets. Layer order is top-to-bottom, while within a layer new nodes are painted in insertion order (later nodes above earlier ones).
- Node and layer IDs must match `[A-Za-z0-9][A-Za-z0-9_-]{0,79}` and be unique within their respective namespace. The base layer is `artwork`.
- No history is embedded by the CLI. Keep the original file as your rollback. The file workflow does not live-sync. The optional MCP bridge operates on an open document only after user pairing and approval; see `references/live-mcp.md`.
- See `references/design-api.md` for exact supported operations and examples. Do not invent fields; unknown fields are rejected.
