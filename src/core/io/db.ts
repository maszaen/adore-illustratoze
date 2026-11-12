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

export async function saveProjectToDb(
  doc: StudioDocument,
  thumbnailDataUrl?: string
): Promise<StoredProjectRecord> {
  const now = Date.now();
  const primaryAb = doc.artboards?.[0];
  const existing = await studioDb.projects.get(doc.id).catch(() => undefined);

  const record: StoredProjectRecord = {
    id: doc.id,
    name: doc.name || 'Untitled-1',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    width: primaryAb?.width ?? 1920,
    height: primaryAb?.height ?? 1080,
    unit: doc.unit || 'px',
    colorMode: doc.colorMode || 'RGB',
    artboardCount: doc.artboards?.length || 1,
    thumbnailDataUrl: thumbnailDataUrl || generateDocumentThumbnailDataUrl(doc),
    thumbnailVersion: thumbnailDataUrl ? undefined : THUMBNAIL_VERSION,
    document: JSON.parse(JSON.stringify(doc)),
  };

  await studioDb.projects.put(record);
  return record;
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

export async function saveCrashRecoverySnapshot(doc: StudioDocument, dirty = true): Promise<void> {
  try {
    await studioDb.recovery.put({
      id: 'latest_session',
      document: JSON.parse(JSON.stringify(doc)),
      savedAt: Date.now(),
      dirty,
    });
  } catch {
    // Ignore storage quota or private mode issues
  }
}

export async function getCrashRecoverySnapshot(): Promise<CrashRecoveryRecord | undefined> {
  try {
    return await studioDb.recovery.get('latest_session');
  } catch {
    return undefined;
  }
}

export async function clearCrashRecoverySnapshot(): Promise<void> {
  try {
    await studioDb.recovery.delete('latest_session');
  } catch {
    // Ignore
  }
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
