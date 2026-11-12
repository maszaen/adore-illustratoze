import { build } from 'esbuild';
await build({ entryPoints: ['src/agent/design.ts'], outfile: 'dist/adore-agent-sdk.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node20' });
console.log('Built dist/adore-agent-sdk.mjs');
