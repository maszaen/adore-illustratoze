// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { saveProjectToDb, studioDb } from '../core/io/db';
import { readSessionManifest, restoreSession, stashUnsavedDocuments, writeSessionManifest } from '../core/io/session';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { useStudioStore } from '../state/useStudioStore';

const doc = (id: string, name: string) => createDefaultDocument({ id, name, includeSampleArtwork: false });
afterEach(async () => { sessionStorage.clear(); localStorage.clear(); await studioDb.projects.clear(); await studioDb.recovery.clear(); });

describe('refresh restores the session', () => {
  it('reopens the open documents, the active one and the view, preferring edits stashed at unload', async () => {
    const a = doc('doc-a', 'A'); a.updatedAt = 100;
    const b = doc('doc-b', 'B'); b.updatedAt = 100;
    await saveProjectToDb(a); await saveProjectToDb(b);
    writeSessionManifest({ version: 1, openIds: ['doc-a', 'doc-b', 'doc-missing'], activeId: 'doc-b', showHome: false, view: { zoom: 2, panX: -40, panY: 15 } });
    const unsavedB = structuredClone(b); unsavedB.updatedAt = 200; unsavedB.name = 'B (last second edit)';
    stashUnsavedDocuments([unsavedB]);

    const manifest = readSessionManifest()!;
    const session = await restoreSession(manifest);
    expect(session.documents.map((d) => d.name)).toEqual(['A', 'B (last second edit)']);
    useStudioStore.getState().restoreSession(session);
    const s = useStudioStore.getState();
    expect(Object.keys(s.documents)).toEqual(['doc-a', 'doc-b']);
    expect(s.activeDocumentId).toBe('doc-b');
    expect([s.zoom, s.panX, s.panY]).toEqual([2, -40, 15]);
    expect(s.statusMessage).toBe('');
    expect(s.history).toHaveLength(1);
    // The stash is consumed once.
    expect((await restoreSession(manifest)).documents.find((d) => d.id === 'doc-b')?.name).toBe('B');
  });

  it('ignores a corrupt manifest', () => {
    sessionStorage.setItem('adore.session.v1', '{not json');
    localStorage.setItem('adore.session.v1', JSON.stringify({ version: 1, openIds: 'x' }));
    expect(readSessionManifest()).toBeNull();
  });
});
