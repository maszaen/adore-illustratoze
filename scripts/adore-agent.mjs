#!/usr/bin/env node
// Bundle the TypeScript SDK in memory; no generated files or arbitrary user code execution.
import { build } from 'esbuild';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const help = `Adore file-based agent tools (Node 20+; run npm ci first)

  node scripts/adore-agent.mjs create SPEC.json OUTPUT.adloze [--force]
  node scripts/adore-agent.mjs inspect INPUT.adloze
  node scripts/adore-agent.mjs validate INPUT.adloze
  node scripts/adore-agent.mjs apply INPUT.adloze OPERATIONS.json OUTPUT.adloze [--force]
  node scripts/adore-agent.mjs preview INPUT.adloze OUTPUT.svg [--artboard ID] [--force]

create consumes a version 1 spec; apply consumes a JSON array of operations.
Existing output is never overwritten without --force. No live editor connection is provided.
See .agents/skills/adore-design/SKILL.md for the full contract and examples.`;
const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) { console.log(help); process.exit(0); }
try {
  const command = argv.shift(); const positional = []; let force = false, artboard;
  while (argv.length) {
    const arg = argv.shift();
    if (arg === '--force') force = true;
    else if (arg === '--artboard') { if (!argv.length || argv[0].startsWith('--')) throw Error('--artboard needs an ID'); artboard = argv.shift(); }
    else if (arg.startsWith('--')) throw Error(`Unknown flag ${arg}`);
    else positional.push(arg);
  }
  const counts = { create:2, inspect:1, validate:1, apply:3, preview:2 };
  if (!(command in counts) || positional.length !== counts[command] || (artboard && command !== 'preview') || (force && !['create','apply','preview'].includes(command))) throw Error(`Invalid arguments.\n\n${help}`);
  const result = await build({ entryPoints: [fileURLToPath(new URL('../src/agent/design.ts', import.meta.url))], bundle: true, platform: 'node', format: 'esm', target: 'node20', write: false, logLevel: 'silent' });
  const sdk = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
  const read = async (path, limit) => { if ((await stat(path)).size > limit) throw Error(`${path}: file exceeds ${limit} byte limit`); return readFile(path); };
  const readJson = async path => JSON.parse((await read(path, 5 * 1024 * 1024)).toString('utf8'));
  const readDoc = async path => sdk.readDesign(await read(path, 32 * 1024 * 1024));
  const save = async (path, data) => writeFile(path, data, { flag: force ? 'w' : 'wx' });
  if (command === 'create') { const doc = sdk.createFromSpec(await readJson(positional[0])); await save(positional[1], sdk.writeDesign(doc)); console.log(`Created ${positional[1]}`); }
  else if (command === 'apply') { const doc = sdk.applyOperations(await readDoc(positional[0]), await readJson(positional[1])); doc.id = `doc-${randomUUID()}`; await save(positional[2], sdk.writeDesign(doc)); console.log(`Created ${positional[2]}`); }
  else if (command === 'inspect') console.log(JSON.stringify(sdk.inspectDesign(await readDoc(positional[0])), null, 2));
  else if (command === 'validate') { const doc = await readDoc(positional[0]); console.log(`Valid document structure: ${doc.name}`); }
  else if (command === 'preview') { const svg = sdk.previewDesign(await readDoc(positional[0]), artboard); await save(positional[1], svg); console.log(`Created ${positional[1]}`); }
} catch (error) { console.error(`Adore: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
