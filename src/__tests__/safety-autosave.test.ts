import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutosaveCoordinator } from '../core/io/autosave';
import { clearCrashRecoverySnapshot, getCrashRecoverySnapshot, saveCrashRecoverySnapshot, saveProjectToDb, studioDb } from '../core/io/db';
import { createDefaultDocument } from '../core/presets/defaultPresets';

const doc=(id:string,name:string)=>createDefaultDocument({id,name,includeSampleArtwork:false});
afterEach(async()=>{vi.useRealTimers();await studioDb.projects.clear();await studioDb.recovery.clear();});

describe('autosave safety',()=>{
  it('keeps independent pending snapshots when changing documents and orders same-document writes',async()=>{
    vi.useFakeTimers();
    const saved:string[]=[]; let release!:()=>void;
    const first=new Promise<void>(resolve=>{release=resolve;});
    const persist=vi.fn(async d=>{saved.push(`start:${d.name}`);if(d.name==='A1') await first;saved.push(`end:${d.name}`);});
    const coordinator=createAutosaveCoordinator(persist,()=>{},100);
    coordinator.schedule(doc('a','A1')); vi.advanceTimersByTime(100); await Promise.resolve();
    coordinator.schedule(doc('a','A2')); coordinator.schedule(doc('b','B1')); vi.advanceTimersByTime(100);
    await Promise.resolve(); await Promise.resolve();
    expect(saved).toContain('end:B1');expect(saved).not.toContain('start:A2');
    release(); await vi.waitFor(()=>expect(saved).toContain('end:A2'));
    expect(saved.indexOf('end:A1')).toBeLessThan(saved.indexOf('start:A2'));
  });
  it('protects previous recovery records and clears only the chosen record',async()=>{
    const old=doc('old','Prior work');
    await studioDb.recovery.put({id:'latest_session',document:old,savedAt:1,dirty:true});
    await saveCrashRecoverySnapshot(doc('new','Current work'),true);
    expect((await studioDb.recovery.toArray()).length).toBe(2);
    expect((await getCrashRecoverySnapshot())?.document.name).toBe('Prior work');
    await studioDb.recovery.put({id:'another-session',document:doc('other','Other'),savedAt:2,dirty:true});
    await clearCrashRecoverySnapshot('latest_session');
    expect((await getCrashRecoverySnapshot())?.document.name).toBe('Other');
    expect((await studioDb.recovery.toArray()).length).toBe(2);
  });
  it('captures and persists project writes in invocation order',async()=>{
    const first=doc('ordered','First'); const second=doc('ordered','Second');
    const a=saveProjectToDb(first);const b=saveProjectToDb(second);first.name='mutated after call';
    await Promise.all([a,b]);expect((await studioDb.projects.get('ordered'))?.document.name).toBe('Second');
  });
  it('surfaces storage errors from coordinator and can save again',async()=>{
    vi.useFakeTimers(); const onError=vi.fn(); const persist=vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined);
    const coordinator=createAutosaveCoordinator(persist,onError,10);
    coordinator.schedule(doc('a','A'));await vi.advanceTimersByTimeAsync(10);
    expect(onError).toHaveBeenCalledOnce();
    coordinator.schedule(doc('a','B'));await vi.advanceTimersByTimeAsync(10);
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
