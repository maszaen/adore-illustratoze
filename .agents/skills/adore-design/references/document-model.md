# Document model notes

The source of truth is `src/core/types/index.ts` and the application renderer. The SDK exposes a smaller, validated subset rather than asking an agent to generate the full internal `StudioDocument` JSON. Coordinates are absolute points: x grows rightward, y downward; new px and pt documents use one point per unit. For documents in mm, cm, in or pc loaded from Adore, the SDK still takes geometry in points, not the displayed unit. `inspect` exposes artboard bounds in points.

Layers are listed top-to-bottom. Nodes within each layer are painted in array order; later items are on top. Shapes, Bézier paths and point text created by the SDK remain editable. IDs are stable for edits within the same document. Save a revision as a new `.adloze`; importing it is not a live update and does not synchronize back to a currently open document.

Do not assume full support for gradients, live effects, linked images, symbols, multiple artboard creation, grouped edits, exact font measurement, print color separation, or undo across files. Read `design-api.md` for the supported subset.
