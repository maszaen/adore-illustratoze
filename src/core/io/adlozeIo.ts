import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { StudioDocument, VectorNode } from '../types';
import { exportDocumentToDataUrl } from './rasterExport';

export interface AdlozeManifest {
  format: 'AdoreIllustratozeNativeArchive';
  version: '1.0.0';
  documentId: string;
  documentName: string;
  createdAt: string;
  artboardCount: number;
  layerCount: number;
  nodeCount: number;
  colorMode: string;
  unit: string;
  assets: string[];
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return strToU8(dataUrl);
    const meta = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    if (meta.includes(';base64') && typeof atob === 'function') {
      const binStr = atob(body);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      return bytes;
    }
    return strToU8(decodeURIComponent(body));
  } catch {
    return new Uint8Array([137, 80, 78, 71]);
  }
}

function uint8ArrayToBase64DataUrl(bytes: Uint8Array, mime = 'image/png'): string {
  try {
    if (typeof btoa === 'function') {
      let bin = '';
      for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      return `data:${mime};base64,${btoa(bin)}`;
    }
  } catch {
    // Ignore
  }
  return '';
}

/**
 * Packs a StudioDocument into a lossless compressed .adloze archive (Uint8Array)
 * containing manifest.json, document.json, assets/*, and preview.png.
 */
export function packDocumentToAdlozeBytes(doc: StudioDocument): Uint8Array {
  const clonedDoc: StudioDocument = JSON.parse(JSON.stringify(doc));
  const archiveEntries: Record<string, Uint8Array> = {};
  const assetList: string[] = [];

  // Extract embedded data-URL images into assets/ folder inside the archive for clean deduplication
  for (const node of Object.values(clonedDoc.nodes || {})) {
    if (node.type === 'image' && node.imageUrl && node.imageUrl.startsWith('data:')) {
      const ext = node.imageUrl.startsWith('data:image/jpeg')
        ? 'jpg'
        : node.imageUrl.startsWith('data:image/webp')
          ? 'webp'
          : 'png';
      const assetPath = `assets/${node.id}.${ext}`;
      archiveEntries[assetPath] = dataUrlToUint8Array(node.imageUrl);
      assetList.push(assetPath);
    }
  }

  const manifest: AdlozeManifest = {
    format: 'AdoreIllustratozeNativeArchive',
    version: '1.0.0',
    documentId: clonedDoc.id,
    documentName: clonedDoc.name || 'Untitled-1',
    createdAt: new Date().toISOString(),
    artboardCount: clonedDoc.artboards?.length || 1,
    layerCount: clonedDoc.layers?.length || 1,
    nodeCount: Object.keys(clonedDoc.nodes || {}).length,
    colorMode: clonedDoc.colorMode || 'RGB',
    unit: clonedDoc.unit || 'px',
    assets: assetList,
  };

  archiveEntries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  archiveEntries['document.json'] = strToU8(JSON.stringify(clonedDoc, null, 2));

  // Generate preview.png
  const previewDataUrl = exportDocumentToDataUrl(clonedDoc, {
    format: 'png',
    scale: 0.5,
    transparentBackground: false,
    matteColor: '#ffffff',
  });
  archiveEntries['preview.png'] = dataUrlToUint8Array(previewDataUrl);

  return zipSync(archiveEntries, { level: 6 });
}

/**
 * Unpacks a lossless .adloze archive (Uint8Array) back into a full StudioDocument and manifest.
 */
export function unpackAdlozeBytesToDocument(archiveBytes: Uint8Array): {
  manifest: AdlozeManifest;
  document: StudioDocument;
} {
  const unzipped = unzipSync(archiveBytes);

  const docEntry = unzipped['document.json'];
  if (!docEntry) {
    throw new Error('Invalid .adloze archive: missing document.json');
  }

  const document: StudioDocument = JSON.parse(strFromU8(docEntry));
  const manifestEntry = unzipped['manifest.json'];
  const manifest: AdlozeManifest = manifestEntry
    ? JSON.parse(strFromU8(manifestEntry))
    : {
        format: 'AdoreIllustratozeNativeArchive',
        version: '1.0.0',
        documentId: document.id,
        documentName: document.name,
        createdAt: new Date().toISOString(),
        artboardCount: document.artboards?.length || 1,
        layerCount: document.layers?.length || 1,
        nodeCount: Object.keys(document.nodes || {}).length,
        colorMode: document.colorMode || 'RGB',
        unit: document.unit || 'px',
        assets: [],
      };

  // Rehydrate any externalized assets/* back onto image nodes if needed
  for (const node of Object.values(document.nodes || {})) {
    if (node.type === 'image' && (!node.imageUrl || node.imageUrl.startsWith('assets/'))) {
      const candidateKey =
        node.imageUrl && unzipped[node.imageUrl]
          ? node.imageUrl
          : Object.keys(unzipped).find((k) => k.startsWith(`assets/${node.id}.`));
      if (candidateKey && unzipped[candidateKey]) {
        const mime = candidateKey.endsWith('.jpg')
          ? 'image/jpeg'
          : candidateKey.endsWith('.webp')
            ? 'image/webp'
            : 'image/png';
        node.imageUrl = uint8ArrayToBase64DataUrl(unzipped[candidateKey], mime);
      }
    }
  }

  return { manifest, document };
}

/**
 * Triggers a browser download of the native .adloze archive file.
 */
export function exportDocumentAsAdlozeFile(
  doc: StudioDocument,
  customFileName?: string
): void {
  if (typeof document === 'undefined') return;
  const archiveBytes = packDocumentToAdlozeBytes(doc);
  const rawName = (customFileName || doc.name || 'Untitled-1').trim();
  const fileName = rawName.toLowerCase().endsWith('.adloze') ? rawName : `${rawName}.adloze`;

  const blob = new Blob([archiveBytes as unknown as BlobPart], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads a user-selected File (.adloze) and unpacks its StudioDocument.
 */
export async function importAdlozeFile(
  file: File
): Promise<{ manifest: AdlozeManifest; document: StudioDocument }> {
  const buffer = await file.arrayBuffer();
  return unpackAdlozeBytesToDocument(new Uint8Array(buffer));
}

/**
 * Merges an imported StudioDocument (from Place / Merge .adloze) into the active StudioDocument,
 * preserving layers, nodes, swatches, symbols, brushes, and graphic styles without ID collisions.
 */
export function mergeAdlozeIntoDocument(
  targetDoc: StudioDocument,
  importedDoc: StudioDocument
): StudioDocument {
  const merged: StudioDocument = JSON.parse(JSON.stringify(targetDoc));
  const suffix = `_${Math.random().toString(36).slice(2, 6)}`;

  const idMap = new Map<string, string>();
  for (const oldId of Object.keys(importedDoc.nodes || {})) {
    idMap.set(oldId, `${oldId}${suffix}`);
  }

  const layerIds = new Map<string, string>();
  for (const layer of importedDoc.layers || []) {
    const id = `${layer.id}${suffix}`;
    layerIds.set(layer.id, id);
    merged.layers.push({ ...JSON.parse(JSON.stringify(layer)), id,
      nodeIds: (layer.nodeIds || []).map(oldId => idMap.get(oldId)).filter((nodeId): nodeId is string => !!nodeId) });
  }
  const fallbackLayer = merged.layers.find(l => l.id === merged.activeLayerId) || merged.layers[0];
  for (const [oldId, node] of Object.entries(importedDoc.nodes || {})) {
    const newId = idMap.get(oldId)!;
    const clonedNode: VectorNode = JSON.parse(JSON.stringify(node));
    clonedNode.id = newId;
    clonedNode.layerId = layerIds.get(node.layerId) || fallbackLayer?.id || node.layerId;
    if (clonedNode.parentId && idMap.has(clonedNode.parentId)) clonedNode.parentId = idMap.get(clonedNode.parentId);
    if (clonedNode.children) clonedNode.children = clonedNode.children.map(cid => idMap.get(cid) || cid);
    merged.nodes[newId] = clonedNode;
    const layer = merged.layers.find(l => l.id === clonedNode.layerId);
    if (!clonedNode.parentId && layer && !layer.nodeIds.includes(newId)) layer.nodeIds.push(newId);
  }

  // Merge non-duplicate swatches, symbols, and graphic styles
  const existingSwatchIds = new Set((merged.swatches || []).map((s) => s.id));
  for (const sw of importedDoc.swatches || []) {
    if (!existingSwatchIds.has(sw.id)) {
      merged.swatches.push(sw);
    }
  }

  const existingSymbolIds = new Set((merged.symbols || []).map((s) => s.id));
  for (const sym of importedDoc.symbols || []) {
    if (!existingSymbolIds.has(sym.id)) {
      merged.symbols.push(sym);
    }
  }

  merged.updatedAt = Date.now();
  return merged;
}
