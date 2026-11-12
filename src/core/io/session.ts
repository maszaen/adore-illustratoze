import type { StudioDocument } from '../types';
import { getProjectFromDb } from './db';

/**
 * What the user had open, so a browser refresh reopens it instead of the sample project.
 * The tab copy (sessionStorage) wins on reload; the shared copy (localStorage) lets a new tab
 * pick up the last session.
 */
export interface SessionManifest {
  version: 1;
  openIds: string[];
  activeId: string;
  showHome: boolean;
  view: { zoom: number; panX: number; panY: number };
}

const MANIFEST_KEY = 'adore.session.v1';
/** Edits still inside the autosave debounce when the page went away; written synchronously. */
const UNSAVED_KEY = 'adore.session.unsaved.v1';
const MAX_UNSAVED_CHARS = 4_000_000;

function storages(): Storage[] {
  const list: Storage[] = [];
  try { if (globalThis.sessionStorage) list.push(globalThis.sessionStorage); } catch { /* blocked */ }
  try { if (globalThis.localStorage) list.push(globalThis.localStorage); } catch { /* blocked */ }
  return list;
}

function isManifest(value: any): value is SessionManifest {
  return value && value.version === 1 && Array.isArray(value.openIds) && typeof value.activeId === 'string'
    && value.view && [value.view.zoom, value.view.panX, value.view.panY].every(Number.isFinite);
}

export function readSessionManifest(): SessionManifest | null {
  for (const storage of storages()) {
    try {
      const parsed = JSON.parse(storage.getItem(MANIFEST_KEY) || 'null');
      if (isManifest(parsed)) return parsed;
    } catch { /* ignore a corrupt entry and try the next storage */ }
  }
  return null;
}

export function writeSessionManifest(manifest: SessionManifest): void {
  const text = JSON.stringify(manifest);
  for (const storage of storages()) {
    try { storage.setItem(MANIFEST_KEY, text); } catch { /* storage full or blocked */ }
  }
}

export function stashUnsavedDocuments(docs: StudioDocument[]): void {
  try {
    if (!docs.length) { globalThis.sessionStorage?.removeItem(UNSAVED_KEY); return; }
    const text = JSON.stringify(docs);
    if (text.length > MAX_UNSAVED_CHARS) return; // Large embedded images: rely on the IndexedDB flush.
    globalThis.sessionStorage?.setItem(UNSAVED_KEY, text);
  } catch { /* quota or blocked storage */ }
}

function takeUnsavedDocuments(): Map<string, StudioDocument> {
  const map = new Map<string, StudioDocument>();
  try {
    const parsed = JSON.parse(globalThis.sessionStorage?.getItem(UNSAVED_KEY) || '[]');
    globalThis.sessionStorage?.removeItem(UNSAVED_KEY);
    if (Array.isArray(parsed)) for (const doc of parsed) if (doc && typeof doc.id === 'string' && doc.nodes) map.set(doc.id, doc);
  } catch { /* ignore */ }
  return map;
}

export interface RestoredSession {
  documents: StudioDocument[];
  activeId: string;
  showHome: boolean;
  view: SessionManifest['view'];
}

/**
 * Load the manifest's documents from the project store (or the newer unsaved stash). `fallback` holds
 * documents the app already has in memory, e.g. the untouched start document, which is never autosaved.
 */
export async function restoreSession(manifest: SessionManifest, fallback: Record<string, StudioDocument> = {}): Promise<RestoredSession> {
  const unsaved = takeUnsavedDocuments();
  const documents: StudioDocument[] = [];
  for (const id of manifest.openIds) {
    const stored = (await getProjectFromDb(id))?.document;
    const stashed = unsaved.get(id);
    const doc = (stashed && (!stored || (stashed.updatedAt ?? 0) >= (stored.updatedAt ?? 0)) ? stashed : stored) ?? fallback[id];
    if (doc) documents.push(doc);
  }
  const activeId = documents.some((d) => d.id === manifest.activeId) ? manifest.activeId : documents[0]?.id ?? '';
  return { documents, activeId, showHome: manifest.showHome, view: manifest.view };
}
