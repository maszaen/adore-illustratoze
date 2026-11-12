import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('agent CLI', () => {
  it('creates, inspects, previews, revises and refuses overwrite or partial invalid output', () => {
    const dir=mkdtempSync(join(tmpdir(),'adore-agent-test-'));
    const run=(...args)=>spawnSync(process.execPath,['scripts/adore-agent.mjs',...args],{encoding:'utf8'});
    try {
      const source=join(dir,'source.adloze'), revision=join(dir,'revision.adloze'), preview=join(dir,'preview.svg');
      expect(run('create','.agents/skills/adore-design/examples/social-post.json',source).status).toBe(0);
      expect(run('create','.agents/skills/adore-design/examples/social-post.json',source).status).not.toBe(0);
      const before=JSON.parse(run('inspect',source).stdout);
      expect(before.nodes.find(n=>n.id==='headline').text).toBe('Kopi\nPagi.');
      expect(run('preview',source,preview).status).toBe(0);
      expect(readFileSync(preview,'utf8')).toContain('Kopi');
      expect(run('apply',source,'.agents/skills/adore-design/examples/revise.json',revision).status).toBe(0);
      const after=JSON.parse(run('inspect',revision).stdout);
      expect(after.id).not.toBe(before.id); expect(after.nodes.find(n=>n.id==='headline').text).toBe('Kopi\nSenja.');
      const invalid=join(dir,'invalid.json'); writeFileSync(invalid,JSON.stringify([{op:'delete',id:'not-found'}]));
      const out=join(dir,'bad.adloze'); expect(run('apply',source,invalid,out).status).not.toBe(0);
      expect(() => readFileSync(out)).toThrow();
      expect(run('validate',revision).status).toBe(0);
    } finally { rmSync(dir,{recursive:true,force:true}); }
  }, 30000);
});
