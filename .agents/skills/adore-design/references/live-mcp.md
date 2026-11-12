# Live Adore MCP bridge (experimental)

This optional mode connects a local MCP-capable agent to an active document open in a browser on the **same computer**. The browser app still needs no installation; the local agent host needs Node 20+, this repository, and `npm ci`. A remote sandbox agent and your own browser do not share `localhost` and cannot use this bridge directly. Network policy or browser Local Network Access protections may block the connection.

## Setup

Configure your agent's MCP client to start `node` with the absolute path to `scripts/adore-mcp.mjs`, and set `ADORE_ALLOWED_ORIGIN` to the **exact** browser origin (scheme, hostname, port; no trailing slash or path). For example, for a local `npm run dev` opened at `http://localhost:5173`:

```json
{
  "mcpServers": {
    "adore": {
      "command": "node",
      "args": ["/absolute/path/to/adore-illustratoze/scripts/adore-mcp.mjs"],
      "env": { "ADORE_ALLOWED_ORIGIN": "http://localhost:5173" }
    }
  }
}
```

Use the configuration location and restart procedure specific to the agent harness. The origin identifies the site open in the browser; it is not the agent or bridge URL. For example, if Adore is hosted at `https://app.myapp.com/editor`, set `ADORE_ALLOWED_ORIGIN` to `https://app.myapp.com`. The agent and MCP process still run on the browser user’s computer, not on the hosting server. The MCP process binds only to `127.0.0.1` on an ephemeral port; it writes protocol messages to stdout and never stores the token.

1. Agent calls `adore_connection_info`. Pass the resulting local URL and secret token **privately to the user**, never to external services or public logs. The token authorizes the connection; treat it like a password.
2. User opens a document in Adore, clicks **Agent** in the bottom status bar, pastes URL/token and connects. Connecting grants this agent read access to the active document summary, selection and SVG preview while connected.
3. Call `adore_inspect`. It returns a document summary and revision hash. Selection is provided separately; the hash tracks document data, not selection.
   Each node has `bounds`, `visualBounds` and, with effects, `effectBounds`; text nodes have `textLines`. See **Inspect output** in `design-api.md`. Through the bridge, text sizes use the browser's real fonts and `measurement.fonts` reports fonts the browser does not have.
4. Before placing text, call `adore_measure_text` with `{ "items": [{ "text", "fontSize", "fontFamily"?, "fontStyle"? }] }` to get the frame, baseline and painted ink box from the browser's real fonts (see **Measuring text** in `design-api.md`). It reads no document data and needs no approval, but the user must be connected.
5. Optionally call `adore_preview` for an SVG of the active or specified artboard. This is not a screenshot and can contain artwork, text and embedded image data; only use with user consent. Fidelity has the same limitations as SVG export.
6. Propose `adore_apply` using the returned `documentId`, `revision`, and an `operations` array from `design-api.md`. The user sees the operation list and an approximate preview, and must accept. Changes form one undo step. If the document changes, switches, or the request expires, inspect again and submit a new proposal. Rejected changes do not apply.
7. The user can disconnect with the button, close the editor tab, or terminate the MCP process. Pairing is memory-only. The local service allows only the configured origin plus the secret, and supports one in-flight request with a 120-second timeout. Do not configure an origin you don't trust.

Tool result examples:

```json
{"documentId":"doc-...","revision":"sha256-from-adore_inspect","operations":[{"op":"update","id":"title","text":"New headline"}]}
```

Use the `document.id` and `revision` returned by `adore_inspect`, and real IDs returned in `document.nodes`. Never invent an ID for an edit. `adore_connection_info`, `adore_inspect`, `adore_measure_text`, `adore_preview`, and `adore_apply` are the only exposed MCP tools. No shell, filesystem, arbitrary JS or unapproved writes are exposed through this bridge. This is an experimental opt-in integration, not an authenticated multi-user relay or a security boundary against a compromised local machine.
