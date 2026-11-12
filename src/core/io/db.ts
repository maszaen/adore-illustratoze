import Dexie, { type Table } from 'dexie';
import type { StudioDocument, ColorMode, VectorNode, BoundingBox } from '../types';
import { exportDocumentToSvgString } from './svgIo';
import { canReflectVector, selectionNodeBounds } from '../math/selectionResize';
import { pointTextPaintBounds } from '../math/textLayout';
import type { UnitType } from '../math/units';

export interface StoredProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  unit: UnitType;
  colorMode: ColorMode;
  artboardCount: number;
  thumbnailDataUrl?: string;
  thumbnailVersion?: number;
  document: StudioDocument;
}

export interface CustomDocumentPreset {
  id: string;
  name: string;
  category: 'saved' | 'mobile' | 'web' | 'print' | 'film' | 'art';
  width: number;
  height: number;
  unit: UnitType;
  orientation: 'portrait' | 'landscape';
  artboards: number;
  bleedTop: number;
  bleedBottom: number;
  bleedLeft: number;
  bleedRight: number;
  colorMode: ColorMode;
  rasterPpi: 72 | 150 | 300;
  createdAt: number;
}

export interface CrashRecoveryRecord {
  id: string;
  document: StudioDocument;
  savedAt: number;
  dirty: boolean;
}

class AdoreIllustratozeDB extends Dexie {
  projects!: Table<StoredProjectRecord, string>;
  presets!: Table<CustomDocumentPreset, string>;
  recovery!: Table<CrashRecoveryRecord, string>;

  constructor() {
    super('AdoreIllustratozeStudioDB');
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt, colorMode',
      presets: 'id, name, category, createdAt',
      recovery: 'id, savedAt',
    });
  }
}

export const studioDb = new AdoreIllustratozeDB();

/** Visible artwork and all artboards contribute to the workspace preview bounds. */
export function documentThumbnailBounds(doc: StudioDocument): BoundingBox {
  const boxes: BoundingBox[] = [];
  const add = (box: BoundingBox, margin = 0) => {
    if (![box.x, box.y, box.width, box.height, margin].every(Number.isFinite)) return;
    boxes.push({ x: box.x - margin, y: box.y - margin, width: Math.max(0, box.width) + margin * 2, height: Math.max(0, box.height) + margin * 2 });
  };
  for (const board of doc.artboards || []) add(board);
  const nodes = doc.nodes || {};
  const seen = new Set<string>();
  const walk = (node: VectorNode | undefined) => {
    if (!node || seen.has(node.id) || !node.visible || node.isGuide) return;
    seen.add(node.id);
    if (node.children?.length && ['group', 'clipping-group', 'compound-shape', 'live-paint-group', 'blend'].includes(node.type)) {
      // Traverse the actual children instead of trusting a potentially stale group frame.
      node.children.forEach(id => walk(nodes[id]));
      return;
    }
    let box: BoundingBox;
    if (node.type === 'text' && node.textStyle?.typeMode === 'point') box = pointTextPaintBounds(node);
    else if (node.rotation && !canReflectVector(node)) {
      const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
      const radians = node.rotation * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
      const points = [[node.x,node.y], [node.x+node.width,node.y], [node.x,node.y+node.height], [node.x+node.width,node.y+node.height]].map(([x,y]) => ({ x: cx+(x-cx)*c-(y-cy)*s, y: cy+(x-cx)*s+(y-cy)*c }));
      const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
      box = { x, y, width: Math.max(...points.map(p => p.x))-x, height: Math.max(...points.map(p => p.y))-y };
    } else box = selectionNodeBounds(node);
    const stroke = Math.max(0, ...(node.strokes || []).filter(item => item.visible).map(item => item.weight || 0)) / 2;
    add(box, stroke);
  };
  for (const layer of doc.layers || []) {
    if (!layer.visible) continue;
    for (const id of layer.nodeIds || []) {
      const node = nodes[id];
      if (node && !node.parentId) walk(node);
    }
  }
  if (!boxes.length) return { x: 0, y: 0, width: 800, height: 600 };
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  const right = Math.max(...boxes.map(b => b.x + b.width)), bottom = Math.max(...boxes.map(b => b.y + b.height));
  const width = Math.max(1, right - x), height = Math.max(1, bottom - y);
  const padding = Math.max(width, height) * 0.03;
  return { x: x - padding, y: y - padding, width: width + 2 * padding, height: height + 2 * padding };
}

/** A small SVG workspace snapshot, rendered from the same scene data as export. */
export function generateDocumentThumbnailDataUrl(doc: StudioDocument): string {
  try {
    const svg = exportDocumentToSvgString(doc, { workspaceViewBox: documentThumbnailBounds(doc), responsive: true });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    return '';
  }
}

const THUMBNAIL_VERSION = 2;

// Serialize same-document writes in this page and capture the snapshot before any await.
const projectWrites = new Map<string, Promise<unknown>>();
export function saveProjectToDb(doc: StudioDocument, thumbnailDataUrl?: string): Promise<StoredProjectRecord> {
  const snapshot: StudioDocument = JSON.parse(JSON.stringify(doc));
  const previous = projectWrites.get(snapshot.id) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    const now = Date.now();
    const primaryAb = snapshot.artboards?.[0];
    const existing = await studioDb.projects.get(snapshot.id);
    const record: StoredProjectRecord = {
      id: snapshot.id, name: snapshot.name || 'Untitled-1', createdAt: existing?.createdAt ?? now,
      updatedAt: now, width: primaryAb?.width ?? 1920, height: primaryAb?.height ?? 1080,
      unit: snapshot.unit || 'px', colorMode: snapshot.colorMode || 'RGB',
      artboardCount: snapshot.artboards?.length || 1,
      thumbnailDataUrl: thumbnailDataUrl || generateDocumentThumbnailDataUrl(snapshot),
      thumbnailVersion: thumbnailDataUrl ? undefined : THUMBNAIL_VERSION, document: snapshot,
    };
    await studioDb.projects.put(record);
    return record;
  });
  projectWrites.set(snapshot.id, write);
  void write.finally(() => { if (projectWrites.get(snapshot.id) === write) projectWrites.delete(snapshot.id); }).catch(() => {});
  return write;
}

export async function listProjectsFromDb(): Promise<StoredProjectRecord[]> {
  try {
    const projects = await studioDb.projects.orderBy('updatedAt').reverse().toArray();
    // Upgrade legacy one-artboard previews in memory without overwriting newer saves.
    return projects.map(project => project.thumbnailVersion === THUMBNAIL_VERSION ? project : {
      ...project, thumbnailDataUrl: generateDocumentThumbnailDataUrl(project.document), thumbnailVersion: THUMBNAIL_VERSION,
    });
  } catch {
    return [];
  }
}

export async function getProjectFromDb(id: string): Promise<StoredProjectRecord | undefined> {
  try {
    return await studioDb.projects.get(id);
  } catch {
    return undefined;
  }
}

export async function deleteProjectFromDb(id: string): Promise<void> {
  await studioDb.projects.delete(id);
}

export async function renameProjectInDb(id: string, newName: string): Promise<void> {
  const existing = await studioDb.projects.get(id);
  if (!existing) return;
  existing.name = newName.trim() || existing.name;
  existing.updatedAt = Date.now();
  existing.document.name = existing.name;
  existing.document.updatedAt = existing.updatedAt;
  await studioDb.projects.put(existing);
}

export async function duplicateProjectInDb(id: string): Promise<StoredProjectRecord | undefined> {
  const existing = await studioDb.projects.get(id);
  if (!existing) return undefined;
  const now = Date.now();
  const newId = `proj-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const clonedDoc: StudioDocument = JSON.parse(JSON.stringify(existing.document));
  clonedDoc.id = newId;
  clonedDoc.name = `${existing.name} Copy`;
  clonedDoc.updatedAt = now;

  const copyRecord: StoredProjectRecord = {
    ...existing,
    id: newId,
    name: clonedDoc.name,
    createdAt: now,
    updatedAt: now,
    document: clonedDoc,
  };
  await studioDb.projects.put(copyRecord);
  return copyRecord;
}

// A fresh page session writes only its own records, so an unresolved earlier
// recovery snapshot cannot be overwritten by startup or another open tab.
/** One id per browser tab. Kept in sessionStorage so a page reload is the same session, not a "crash". */
function tabRecoverySession(): string {
  const key = 'adore.recoverySession.v1';
  const fresh = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const existing = globalThis.sessionStorage?.getItem(key);
    if (existing) return existing;
    const id = fresh();
    globalThis.sessionStorage?.setItem(key, id);
    return id;
  } catch {
    return fresh();
  }
}
const recoverySession = tabRecoverySession();
const recoveryPrefix = `session:${recoverySession}:`;
const recoveryWrites = new Map<string, Promise<void>>();
export function saveCrashRecoverySnapshot(doc: StudioDocument, dirty = true): Promise<void> {
  const snapshot: StudioDocument = JSON.parse(JSON.stringify(doc));
  const key = recoveryPrefix + snapshot.id;
  const previous = recoveryWrites.get(key) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(() => studioDb.recovery.put({ id:key, document:snapshot, savedAt:Date.now(), dirty }).then(() => {}));
  recoveryWrites.set(key, write);
  void write.finally(() => { if (recoveryWrites.get(key) === write) recoveryWrites.delete(key); }).catch(() => {});
  return write;
}

/** True when the saved project already holds this snapshot's edits (autosave writes both together). */
async function isCoveredByProject(record: CrashRecoveryRecord): Promise<boolean> {
  const project = await studioDb.projects.get(record.document.id);
  if (!project) return false;
  return (project.document.updatedAt ?? 0) >= (record.document.updatedAt ?? 0);
}

/**
 * Work that exists only in a recovery snapshot: another tab's (or a crashed session's) edits that never
 * reached the project store. A normal refresh or close has nothing to recover, so this returns undefined.
 */
export async function getCrashRecoverySnapshot(): Promise<CrashRecoveryRecord | undefined> {
  const records = await studioDb.recovery.orderBy('savedAt').reverse().toArray();
  for (const record of records) {
    if (!record.dirty || record.id.startsWith(recoveryPrefix)) continue;
    if (!(await isCoveredByProject(record))) return record;
  }
  return undefined;
}

/** Drop other sessions' snapshots whose edits are already saved in the project store. */
export async function pruneRecoverySnapshots(): Promise<void> {
  const records = await studioDb.recovery.toArray();
  for (const record of records) {
    if (record.id.startsWith(recoveryPrefix)) continue;
    if (!record.dirty || (await isCoveredByProject(record))) await studioDb.recovery.delete(record.id);
  }
}

/** Delete only the snapshot the user actually chose; never clear another session's newer record. */
export async function clearCrashRecoverySnapshot(id?: string): Promise<void> {
  const key = id ?? (await getCrashRecoverySnapshot())?.id;
  if (key) await studioDb.recovery.delete(key);
}

export async function saveCustomPresetToDb(preset: CustomDocumentPreset): Promise<void> {
  await studioDb.presets.put(preset);
}

export async function listCustomPresetsFromDb(): Promise<CustomDocumentPreset[]> {
  try {
    return await studioDb.presets.orderBy('createdAt').reverse().toArray();
  } catch {
    return [];
  }
}

export async function deleteCustomPresetFromDb(id: string): Promise<void> {
  await studioDb.presets.delete(id);
}
