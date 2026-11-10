import Dexie, { type Table } from 'dexie';
import type { StudioDocument, ColorMode, VectorNode } from '../types';
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

/**
 * Generates an SVG data URL thumbnail preview for a StudioDocument so the Home Dashboard
 * can display crisp miniature previews of projects.
 */
export function generateDocumentThumbnailDataUrl(doc: StudioDocument): string {
  try {
    const ab = doc.artboards?.[0] ?? {
      id: 'ab-1',
      name: 'Artboard 1',
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    };
    const w = Math.max(1, ab.width || 800);
    const h = Math.max(1, ab.height || 600);
    const shapes: string[] = [];

    const nodesMap: Record<string, VectorNode> = doc.nodes || {};
    const orderedNodes: VectorNode[] = [];

    for (const layer of doc.layers || []) {
      if (layer.visible === false) continue;
      for (const nid of layer.nodeIds || []) {
        const n = nodesMap[nid];
        if (n && n.visible !== false) orderedNodes.push(n);
      }
    }
    if (orderedNodes.length === 0) {
      for (const n of Object.values(nodesMap)) {
        if (n && n.visible !== false && !n.parentId) orderedNodes.push(n);
      }
    }

    for (const node of orderedNodes) {
      if (node.isGuide) continue;
      const fillItem = node.fills?.find((f) => f.visible !== false && f.type !== 'none');
      const strokeItem = node.strokes?.find((s) => s.visible !== false);
      const fill = fillItem?.color || (node.type === 'line' ? 'none' : '#1473e6');
      const stroke = strokeItem?.color || 'none';
      const sw = strokeItem?.weight ?? 1;
      const opacity = node.opacity ?? 1;

      if (node.type === 'ellipse') {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        shapes.push(
          `<ellipse cx="${cx}" cy="${cy}" rx="${Math.max(1, node.width / 2)}" ry="${Math.max(1, node.height / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" />`
        );
      } else if (node.type === 'text' && node.textContent) {
        const fs = node.textStyle?.fontSize || 24;
        const safeText = node.textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        shapes.push(
          `<text x="${node.x}" y="${node.y + fs}" font-family="${node.textStyle?.fontFamily || 'Inter, sans-serif'}" font-size="${fs}" fill="${fill}" opacity="${opacity}">${safeText}</text>`
        );
      } else if (node.points && node.points.length > 1) {
        const d = buildMiniPathD(node.points, Boolean(node.closed));
        shapes.push(
          `<path d="${d}" fill="${node.closed ? fill : 'none'}" stroke="${stroke !== 'none' ? stroke : fill}" stroke-width="${sw}" opacity="${opacity}" />`
        );
      } else {
        const rx = node.cornerRadius ?? 0;
        shapes.push(
          `<rect x="${node.x}" y="${node.y}" width="${Math.max(1, node.width)}" height="${Math.max(1, node.height)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}" />`
        );
      }
    }

    const bg = ab.backgroundColor || '#ffffff';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ab.x} ${ab.y} ${w} ${h}" width="320" height="220">
      <rect x="${ab.x}" y="${ab.y}" width="${w}" height="${h}" fill="${bg}" />
      ${shapes.join('\n')}
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    return '';
  }
}

function buildMiniPathD(
  points: Array<{
    x: number;
    y: number;
    handleIn?: { x: number; y: number };
    handleOut?: { x: number; y: number };
  }>,
  closed: boolean
): string {
  if (!points.length) return '';
  const parts: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const c1 = prev.handleOut ?? prev;
    const c2 = curr.handleIn ?? curr;
    if (prev.handleOut || curr.handleIn) {
      parts.push(
        `C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
      );
    } else {
      parts.push(`L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`);
    }
  }
  if (closed && points.length > 1) {
    const prev = points[points.length - 1];
    const curr = points[0];
    if (prev.handleOut || curr.handleIn) {
      const c1 = prev.handleOut ?? prev;
      const c2 = curr.handleIn ?? curr;
      parts.push(
        `C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
      );
    }
    parts.push('Z');
  }
  return parts.join(' ');
}

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
    document: JSON.parse(JSON.stringify(doc)),
  };

  await studioDb.projects.put(record);
  return record;
}

export async function listProjectsFromDb(): Promise<StoredProjectRecord[]> {
  try {
    return await studioDb.projects.orderBy('updatedAt').reverse().toArray();
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
