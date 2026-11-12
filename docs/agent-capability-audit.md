# External agent authoring audit

The MCP bridge and file SDK share `applyOperations` and `inspectDesign`. The browser applies a validated batch only after pairing and per-edit approval, with one undo step and a revision check. Agent preview is SVG, not a canvas screenshot. A successful design does not prove every editor feature or network environment works.

## Feedback and current status

| Feedback | Result / remaining limitation |
| --- | --- |
| Gradient and opacity | Added linear/radial fills with stop opacity and node opacity, for create and update; text canvas rendering and rounded-corner SVG preview corrected. No freeform gradients, gradient strokes or arbitrary fill stacks. |
| Transform | Added absolute rotation and positive width/height resize of ungrouped vector leaves, scaling points/handles; x/y move remains available. No group/text resize, reflection, skew, general matrices or stroke/corner-radius scaling. Zero-width/height geometry cannot be resized. |
| Polygon, star, rounded rectangle | Added editable parametric creation. Radius and polygon parameters cannot yet be changed via update. |
| Groups and masks | Added `group`, `clip` (clipping mask: top-most member is the mask), `ungroup`; groups move as a whole; objects inside groups can be updated and deleted; deleting a group removes its contents. Groups cannot be resized or rotated as a whole. Objects inside blends, compound paths and other special containers stay read-only. |
| Effects, blend mode, stroke details (update) | Added `effects` (drop shadow, outer glow, Gaussian blur), `blendMode`, solid fill opacity and stroke dash/cap/join/opacity for create and update, and text `tracking`, `align`, `lineHeight` (also in measurement). Effects are omitted from PDF with a warning. Inner glow, feather and other live effects are not exposed. |
| Text | Point text with font family/style/size on creation; content and size updates. Added `adore_measure_text` (live bridge, real browser fonts after they load) and `measure` in the CLI/SDK (estimates): frame, baseline, line widths and painted ink box. In Chrome the ink box matched rendered glyphs within about 1.3 px for Arial, Georgia italic, bold and two-line text. Missing fonts are reported (`available: false`). No area text, alignment/spacing updates or text-on-path. |
| Inspect | Anchors, fill/stroke stacks, effects, text style, hierarchy, opacity, rotation and `bounds` (editable frame). Added `visualBounds` (stroke, rotation, drawn curve without handles, group children, clipping mask, text ink), `effectBounds` and per-line text widths/baselines; flagged as approximate when no canvas is available. In Chrome, visualBounds matched rendered pixels within about 1 px for rotated stroked rectangles, stars, curves, rotated text and clipping groups. Large replies can exceed the relay's 4 MiB limit. |
| Pathfinder, images, symbols, artboards/layer ordering | Not exposed. Editor capabilities do not automatically make these safe or complete through the API. |
| Visual feedback | Apply shows user an approximate SVG proposal before approval; agent can request SVG after applying. No screenshot or agent-side pre-approval preview tool. SVG may differ from canvas (fonts, effects, and other features). |
| Revision and selection | Revision hashes the document, while selection is separate. Automated regression confirms selection changes alone do not change revision; an actual document change invalidates it. The reported failure's cause is unconfirmed and needs reproduction. |

The engine now renders clipping masks, shadow/glow/blur, group opacity, gradients and layer order the same way in the canvas, SVG and PNG (see `docs/perbaikan-render-tahap-1.md`), so these can be exposed to agents next. PDF still lacks effects.

Next work: rich text and edit controls; group operations with hierarchy/lock validation; effects and clipping/boolean support; reliable visual feedback. Each must preserve atomicity, approval, undo, serialization and fidelity, and reject unsupported cases rather than silently degrade.
