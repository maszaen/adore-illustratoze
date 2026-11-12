# External agent authoring audit

The MCP bridge and file SDK share `applyOperations` and `inspectDesign`. The browser applies a validated batch only after pairing and per-edit approval, with one undo step and a revision check. Agent preview is SVG, not a canvas screenshot. A successful design does not prove every editor feature or network environment works.

## Feedback and current status

| Feedback | Result / remaining limitation |
| --- | --- |
| Gradient and opacity | Added linear/radial fills with stop opacity and node opacity, for create and update; text canvas rendering and rounded-corner SVG preview corrected. No freeform gradients, gradient strokes or arbitrary fill stacks. |
| Transform | Added absolute rotation and positive width/height resize of ungrouped vector leaves, scaling points/handles; x/y move remains available. No group/text resize, reflection, skew, general matrices or stroke/corner-radius scaling. Zero-width/height geometry cannot be resized. |
| Polygon, star, rounded rectangle | Added editable parametric creation. Radius and polygon parameters cannot yet be changed via update. |
| Groups and masks | Not exposed; grouped geometry cannot be moved/resized/deleted by agent. Existing content is preserved. |
| Text | Point text with font family/style/size on creation; content and size updates. No area text, alignment/spacing updates, text-on-path, or exact font measurement API. Inspect returns stored frame and style; text dimensions are approximate and are not ink bounds. |
| Inspect | Added anchors, fill/stroke stacks, text style, hierarchy, opacity, rotation and geometric bounds. Not every complex node property is returned; bounds exclude stroke/effects, rotated text is not expanded, and groups may have stale bounds. Large replies can exceed the relay's 4 MiB limit. |
| Effects, blend mode, stroke details | Existing values are not agent-editable, except basic solid stroke at creation. No shadow/blur or blend-mode operations yet. |
| Pathfinder, images, symbols, artboards/layer ordering | Not exposed. Editor capabilities do not automatically make these safe or complete through the API. |
| Visual feedback | Apply shows user an approximate SVG proposal before approval; agent can request SVG after applying. No screenshot or agent-side pre-approval preview tool. SVG may differ from canvas (fonts, effects, and other features). |
| Revision and selection | Revision hashes the document, while selection is separate. Automated regression confirms selection changes alone do not change revision; an actual document change invalidates it. The reported failure's cause is unconfirmed and needs reproduction. |

Next work: accurate browser-side rendered bounds and measurement with font readiness; rich text and edit controls; group operations with hierarchy/lock validation; effects and clipping/boolean support; reliable visual feedback. Each must preserve atomicity, approval, undo, serialization and fidelity, and reject unsupported cases rather than silently degrade.
