# Adore for external coding agents — file-based MVP

Adore exposes an experimental, local file workflow for coding agents. It does not include a model. The default workflow operates on local `.adloze` files. An experimental optional MCP bridge connects a local agent to an open browser document after explicit user pairing and per-edit approval.

## Quick start

Requirements: Node 20+ and this repository. From the repository root:

```sh
npm ci
npm run agent -- --help
npm run agent -- create .agents/skills/adore-design/examples/social-post.json social.adloze
npm run agent -- validate social.adloze
npm run agent -- preview social.adloze social.svg
npm run agent -- inspect social.adloze
```

Open `social.adloze` using **Open file** in Adore. Its shapes and text are editable. The preview is an SVG approximation, not an editor screenshot. A revision is written to a new file and given a new document ID so importing it does not overwrite the original Adore project:

```sh
npm run agent -- apply social.adloze .agents/skills/adore-design/examples/revise.json social-revised.adloze
```

No output is overwritten unless `--force` is provided. The SDK's `applyOperations` keeps the document ID; applications using the SDK directly must assign a new ID if they want to import the revision as a separate project.

## Give this workflow to an agent

Point your coding agent to `.agents/skills/adore-design/SKILL.md`, or install/copy that directory into the skill location supported by your agent. Discovery conventions differ between agents; copying the repository alone does not guarantee every harness loads the skill automatically. `references/design-api.md` is the exact operation contract, with examples in `examples/`. Use only trusted input files; validation isn't a security sandbox.

The TypeScript SDK is `src/agent/design.ts`. `npm run agent:build` bundles a Node ESM SDK at `dist/adore-agent-sdk.mjs`. The browser's `npm run build` clears `dist`, so rebuild the SDK after a browser build. The CLI bundles in memory on each invocation and doesn't depend on that output. The SDK is repository-local and not published to a package registry yet.

## Experimental live editor connection

A local MCP-capable agent can inspect and propose edits to an open document. Setup, pairing, privacy, security and same-computer requirements are documented in [.agents/skills/adore-design/references/live-mcp.md](../.agents/skills/adore-design/references/live-mcp.md). An agent in a remote sandbox cannot reach your browser's localhost through this bridge. Reads are shared once paired, edits require approval, revisions reject stale operations, and each approved batch is one undo step.

## Scope and limits

Supported creation: empty single-artboard px/pt document, layers, rectangles, ellipses, polygons, stars, Bézier paths and point text, with solid or linear/radial gradient fills and opacity. Supported edits include position, vector resize, rotation, opacity, fill and basic text for supported leaves; delete ungrouped nodes. See the [capability audit](agent-capability-audit.md) and design API reference for exact restrictions. No model, automatic visual judgement, remote bridge, collaboration, multi-artboard creation, comprehensive editor operation coverage, or exact-fidelity rendering. Existing documents can be inspected and preserved only when they pass structural validation. Preview output can differ from the editor for fonts and complex features. Keep a backup and check output in Adore before relying on it.
