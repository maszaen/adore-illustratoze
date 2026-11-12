#!/usr/bin/env node
// Stdio MCP + localhost-only relay. No file or shell tools are exposed.
import { createServer } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const origin = process.env.ADORE_ALLOWED_ORIGIN;
try {
  const u = new URL(origin || '');
  if (!['http:', 'https:'].includes(u.protocol) || u.origin !== origin || u.username || u.password) throw Error();
} catch { console.error('Set ADORE_ALLOWED_ORIGIN to the exact Adore browser origin (e.g. http://localhost:5173).'); process.exit(1); }
const token = randomBytes(32).toString('hex');
let pending = null;
const authorized = req => {
  const provided = req.headers.authorization || '';
  const expected = `Bearer ${token}`;
  return Buffer.byteLength(provided) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
};
const relay = createServer(async (req, res) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin !== origin) { res.writeHead(403); res.end(); return; }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'authorization, content-type', 'Access-Control-Max-Age':'600' }); res.end(); return; }
  if (!authorized(req)) { res.writeHead(401); res.end(); return; }
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/status') { res.end(JSON.stringify({ok:true})); return; }
  if (req.method === 'GET' && req.url === '/pending') { res.end(JSON.stringify({id:pending?.request.id ?? null, expiresAt:pending?.expiresAt ?? null})); return; }
  if (req.method === 'GET' && req.url === '/next') {
    if (pending && !pending.delivered) { pending.delivered = true; res.end(JSON.stringify({request:pending.request})); }
    else res.end(JSON.stringify({request:null}));
    return;
  }
  if (req.method === 'POST' && req.url === '/reply') {
    try {
      let size = 0; const parts = [];
      for await (const chunk of req) { size += chunk.length; if (size > 4 * 1024 * 1024) throw Error('reply too large'); parts.push(chunk); }
      const body = JSON.parse(Buffer.concat(parts).toString('utf8'));
      if (!pending || !pending.delivered || body.id !== pending.request.id || typeof body.ok !== 'boolean') { res.writeHead(409); res.end(JSON.stringify({error:'Request expired'})); return; }
      const current = pending; pending = null; clearTimeout(current.timer);
      if (body.ok) current.resolve(body.result); else current.reject(Error(String(body.error || 'Request rejected')));
      res.end(JSON.stringify({ok:true}));
    } catch { res.writeHead(400); res.end(JSON.stringify({error:'Invalid reply'})); }
    return;
  }
  res.writeHead(404); res.end('{}');
});
relay.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => { relay.once('listening', resolve); relay.once('error', reject); });
const endpoint = `http://127.0.0.1:${relay.address().port}`;
const requestBrowser = (type, args = {}) => new Promise((resolve, reject) => {
  if (pending) { reject(Error('Another request is pending; wait for it to finish.')); return; }
  const request = { id: randomUUID(), type, ...args };
  const expiresAt = Date.now() + 120000;
  const timer = setTimeout(() => { if (pending?.request.id === request.id) { pending = null; reject(Error('Timed out. Connect Adore and approve the request if needed.')); } }, 120000);
  pending = { request, resolve, reject, timer, expiresAt, delivered:false };
});
const mcp = new McpServer({ name:'adore-illustratoze', version:'0.1.0' });
const reply = (f) => async (...args) => { try { const result = await f(...args); return { content:[{ type:'text', text: JSON.stringify(result) }] }; } catch (e) { return { isError:true, content:[{type:'text',text:e instanceof Error ? e.message : String(e)}] }; } };
mcp.registerTool('adore_connection_info', { description:'Get the local pairing URL and secret. Give both only to the user to enter in Adore; never share publicly.', inputSchema:{} }, reply(async () => ({ url:endpoint, token, allowedOrigin:origin, instructions:'Open a document in Adore, click Agent in the status bar, and enter the URL and token. Reads are shared while connected; edits require approval.' })));
mcp.registerTool('adore_inspect', { description:'Read the connected active document summary, selected IDs and revision. The user must explicitly connect first.', inputSchema:{} }, reply(async () => requestBrowser('inspect')));
mcp.registerTool('adore_preview', { description:'Get a single-artboard SVG preview of the active document. This is not an exact canvas screenshot.', inputSchema:{ artboardId:z.string().optional() } }, reply(async ({artboardId}) => requestBrowser('preview',{artboardId})));
mcp.registerTool('adore_apply', { description:'Propose a validated batch of Adore operations for the inspected document and revision. User approval is required in Adore; stale revisions are rejected.', inputSchema:{ documentId:z.string(), revision:z.string(), operations:z.array(z.record(z.string(),z.unknown())).min(1).max(1000) } }, reply(async args => requestBrowser('apply',args)));
await mcp.connect(new StdioServerTransport());
process.stdin.on('end', () => { if (pending) { clearTimeout(pending.timer); pending.reject(Error('MCP disconnected')); pending=null; } relay.close(); });
