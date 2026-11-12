import { blendIntermediateNodes } from '../math/blend';
import { clipsTextToFrame, layoutText, pointTextPaintBounds, textGlyphTransform } from '../math/textLayout';
import type {
  ArtboardItem,
  ExportAssetItem,
  SliceItem,
  StudioDocument,
  VectorNode,
} from '../types';
import { anchorPointsToSvgPathD } from './svgIo';

export type RasterFormat = 'png' | 'jpg' | 'webp';
export type RasterScalePreset = '1x' | '2x' | '3x' | '72ppi' | '150ppi' | '300ppi';

export interface RasterExportOptions {
  format: RasterFormat;
  scale: number;
  ppi?: 72 | 150 | 300;
  quality: number; // 0.1 to 1.0
  transparentBackground: boolean;
  matteColor: string;
  artboardId?: string;
  cropBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  onlyNodeIds?: string[];
}

export const DEFAULT_RASTER_EXPORT_OPTIONS: RasterExportOptions = {
  format: 'png',
  scale: 1,
  ppi: 72,
  quality: 0.92,
  transparentBackground: true,
  matteColor: '#ffffff',
};

export function resolveScaleMultiplier(preset: RasterScalePreset | number): number {
  if (typeof preset === 'number') return Math.max(0.1, preset);
  switch (preset) {
    case '1x':
    case '72ppi':
      return 1;
    case '2x':
      return 2;
    case '3x':
      return 3;
    case '150ppi':
      return 150 / 72;
    case '300ppi':
      return 300 / 72;
    default:
      return 1;
  }
}

export function getMimeTypeForFormat(format: RasterFormat): string {
  switch (format) {
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'png':
    default:
      return 'image/png';
  }
}

/**
 * Renders an artboard, custom slice region, or specific asset node(s) onto a high-DPI HTML5 Canvas.
 */
export function renderDocumentToCanvas(
  doc: StudioDocument,
  partialOptions?: Partial<RasterExportOptions>
): HTMLCanvasElement {
  const opts: RasterExportOptions = {
    ...DEFAULT_RASTER_EXPORT_OPTIONS,
    ...partialOptions,
  };

  const scale = opts.ppi && opts.scale === 1 ? opts.ppi / 72 : Math.max(0.1, opts.scale || 1);

  const ab: ArtboardItem =
    doc.artboards.find((a) => a.id === (opts.artboardId || doc.activeArtboardId)) ||
    doc.artboards[0] || {
      id: 'ab-1',
      name: 'Artboard 1',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      orientation: 'landscape',
      showCenterMark: false,
      showCrossHairs: false,
      showVideoSafeAreas: false,
    };

  const region = opts.cropBounds ?? {
    x: ab.x,
    y: ab.y,
    width: Math.max(1, ab.width),
    height: Math.max(1, ab.height),
  };

  const pixelW = Math.max(1, Math.round(region.width * scale));
  const pixelH = Math.max(1, Math.round(region.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = pixelW;
  canvas.height = pixelH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Raster export failed: canvas is unavailable.');

  ctx.save();
  ctx.scale(scale, scale);

  const needsMatte = opts.format === 'jpg' || !opts.transparentBackground;
  if (needsMatte) {
    ctx.fillStyle = opts.matteColor || ab.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, region.width, region.height);
  }

  ctx.translate(-region.x, -region.y);

  const nodesMap = doc.nodes || {};
  const allowedSet = opts.onlyNodeIds ? new Set(opts.onlyNodeIds) : null;

  const orderedRootNodes: VectorNode[] = [];
  for (const layer of doc.layers || []) {
    if (!layer.visible) continue;
    for (const nid of layer.nodeIds || []) {
      const n = nodesMap[nid];
      if (n && n.visible && !n.parentId && !n.isGuide) {
        orderedRootNodes.push(n);
      }
    }
  }
  if (orderedRootNodes.length === 0) {
    for (const n of Object.values(nodesMap)) {
      if (n && n.visible && !n.parentId && !n.isGuide && !(doc.layers || []).some(layer => layer.nodeIds?.includes(n.id))) {
        orderedRootNodes.push(n);
      }
    }
  }

  const drawNode = (node: VectorNode) => {
    if (!node || !node.visible || node.isGuide) return;
    if (
      allowedSet &&
      !allowedSet.has(node.id) && !allowedSet.has(node.parentId || '') &&
      (!node.children || !node.children.some((c) => allowedSet.has(c)))
    ) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha ?? 1) * (node.opacity ?? 1);
    if (node.blendMode && node.blendMode !== 'normal') {
      ctx.globalCompositeOperation = node.blendMode as GlobalCompositeOperation;
    }

    if (node.rotation && Math.abs(node.rotation) > 0.001) {
      const cx = node.x + node.width / 2;
      const cy = node.y + node.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((node.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (node.type === 'blend' && node.children?.length === 2) {
      const endpoints = node.children.map(id => nodesMap[id]);
      if (endpoints.every(Boolean)) {
        [endpoints[0], ...blendIntermediateNodes(node, nodesMap), endpoints[1]].forEach(drawNode);
      }
      ctx.restore();
      return;
    }

    if (node.children && node.children.length > 0) {
      for (const cid of node.children) {
        const child = nodesMap[cid];
        if (child) drawNode(child);
      }
      if (node.type === 'group') {
        ctx.restore();
        return;
      }
    }

    // Apply live drop-shadow effect if present
    const shadowFx = (node.effects || []).find(
      (fx) => fx.enabled && fx.type === 'drop-shadow'
    );
    if (shadowFx) {
      ctx.shadowColor = shadowFx.params?.color || 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Number(shadowFx.params?.blur ?? 8);
      ctx.shadowOffsetX = Number(shadowFx.params?.offsetX ?? 4);
      ctx.shadowOffsetY = Number(shadowFx.params?.offsetY ?? 4);
    }

    if (node.type === 'text') {
      const layout = layoutText(node);
      if (clipsTextToFrame(node)) {
        ctx.beginPath(); ctx.rect(node.x, node.y, Math.max(0, node.width), Math.max(0, node.height)); ctx.clip();
      }
      const glyph = textGlyphTransform(node);
      ctx.transform(glyph.sx, 0, 0, glyph.sy, glyph.tx, glyph.ty);
      const ff = node.textStyle?.fontFamily ?? 'Inter, sans-serif';
      const isBold = node.textStyle?.fontStyle?.toLowerCase().includes('bold');
      const isItalic = node.textStyle?.fontStyle?.toLowerCase().includes('italic');
      ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${layout.fontSize}px ${ff}`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = layout.align;
      if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${layout.letterSpacing}px`;
      const primaryFill = (node.fills || []).find((f) => f.visible && f.type !== 'none');
      const stroke = (node.strokes || []).find((item) => item.visible && item.weight > 0);
      layout.lines.forEach((line, idx) => {
        const y = layout.y + idx * layout.leading;
        if (primaryFill) { ctx.save(); ctx.globalAlpha *= primaryFill.opacity ?? 1; ctx.fillStyle = primaryFill.color || '#000000'; ctx.fillText(line, layout.x, y); ctx.restore(); }
        if (stroke) { ctx.save(); ctx.globalAlpha *= stroke.opacity ?? 1; ctx.strokeStyle = stroke.color || '#000000'; ctx.lineWidth = stroke.weight; ctx.strokeText(line, layout.x, y); ctx.restore(); }
      });
      ctx.restore();
      return;
    }

    // Construct Path2D for geometric or Bezier path nodes
    let path2d: Path2D | null = null;
    if (node.points && node.points.length >= 2 && typeof Path2D !== 'undefined') {
      const d = anchorPointsToSvgPathD(
        node.points,
        node.closed !== false && node.type !== 'line'
      );
      path2d = new Path2D(d);
    } else if (typeof Path2D !== 'undefined') {
      path2d = new Path2D();
      if (node.type === 'ellipse') {
        path2d.ellipse(
          node.x + node.width / 2,
          node.y + node.height / 2,
          Math.max(0.5, node.width / 2),
          Math.max(0.5, node.height / 2),
          0,
          0,
          Math.PI * 2
        );
      } else {
        path2d.rect(node.x, node.y, node.width, node.height);
      }
    }

    // Render all visible Fills in Appearance stack order (bottom to top or top to bottom)
    const visibleFills = (node.fills || []).filter((f) => f.visible && f.type !== 'none');
    for (const fill of visibleFills) {
      if (node.type === 'line') continue;
      ctx.save();
      ctx.globalAlpha *= fill.opacity ?? 1;

      if (fill.type === 'gradient' && fill.gradient) {
        const g = fill.gradient;
        let canvasGrad: CanvasGradient;
        if (g.type === 'radial') {
          const cx = node.x + node.width / 2;
          const cy = node.y + node.height / 2;
          const r = Math.max(node.width, node.height) / 2;
          canvasGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, Math.max(2, r));
        } else {
          const rad = ((g.angle || 0) * Math.PI) / 180;
          const cx = node.x + node.width / 2;
          const cy = node.y + node.height / 2;
          const half = Math.hypot(node.width, node.height) / 2;
          canvasGrad = ctx.createLinearGradient(
            cx - Math.cos(rad) * half,
            cy - Math.sin(rad) * half,
            cx + Math.cos(rad) * half,
            cy + Math.sin(rad) * half
          );
        }
        for (const stop of g.stops || []) {
          canvasGrad.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.color);
        }
        ctx.fillStyle = canvasGrad;
      } else {
        ctx.fillStyle = fill.color || '#000000';
      }

      if (path2d) {
        ctx.fill(path2d, node.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
      } else {
        ctx.fillRect(node.x, node.y, node.width, node.height);
      }
      ctx.restore();
    }

    // Render all visible Strokes in Appearance stack order
    const visibleStrokes = (node.strokes || []).filter((s) => s.visible && s.weight > 0);
    for (const stroke of visibleStrokes) {
      ctx.save();
      ctx.globalAlpha *= stroke.opacity ?? 1;
      ctx.strokeStyle = stroke.color || '#000000';
      ctx.lineWidth = stroke.weight;
      ctx.lineCap = stroke.cap === 'projecting' ? 'square' : stroke.cap || 'butt';
      ctx.lineJoin = stroke.join || 'miter';
      if (stroke.dashArray && stroke.dashArray.length > 0) {
        ctx.setLineDash(stroke.dashArray);
      }
      if (path2d) {
        ctx.stroke(path2d);
      } else {
        ctx.strokeRect(node.x, node.y, node.width, node.height);
      }
      ctx.restore();
    }

    ctx.restore();
  };

  for (const node of orderedRootNodes) {
    drawNode(node);
  }

  ctx.restore();
  return canvas;
}

export function exportDocumentToDataUrl(
  doc: StudioDocument,
  partialOptions?: Partial<RasterExportOptions>
): string {
  const opts: RasterExportOptions = {
    ...DEFAULT_RASTER_EXPORT_OPTIONS,
    ...partialOptions,
  };
  const canvas = renderDocumentToCanvas(doc, opts);
  const mime = getMimeTypeForFormat(opts.format);
  const dataUrl = canvas.toDataURL(mime, opts.quality);
  if (!dataUrl.startsWith(`data:${mime};base64,`) || dataUrl.length <= `data:${mime};base64,`.length) {
    throw new Error(`Raster export failed: ${mime} encoding is unavailable or returned no data.`);
  }
  return dataUrl;
}

export async function exportDocumentToBlob(
  doc: StudioDocument,
  partialOptions?: Partial<RasterExportOptions>
): Promise<Blob> {
  const opts: RasterExportOptions = {
    ...DEFAULT_RASTER_EXPORT_OPTIONS,
    ...partialOptions,
  };
  const canvas = renderDocumentToCanvas(doc, opts);
  const mime = getMimeTypeForFormat(opts.format);

  return new Promise<Blob>((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') { reject(new Error('Raster export failed: Blob encoding is unavailable.')); return; }
    canvas.toBlob((blob) => {
      if (!blob || blob.size === 0 || blob.type !== mime) reject(new Error(`Raster export failed: ${mime} encoding returned no data or an unsupported format.`));
      else resolve(blob);
    }, mime, opts.quality);
  });
}

export function exportSliceToDataUrl(
  doc: StudioDocument,
  slice: SliceItem,
  partialOptions?: Partial<RasterExportOptions>
): string {
  return exportDocumentToDataUrl(doc, {
    ...partialOptions,
    cropBounds: {
      x: slice.x,
      y: slice.y,
      width: Math.max(1, slice.width),
      height: Math.max(1, slice.height),
    },
  });
}

export function exportAssetToDataUrl(
  doc: StudioDocument,
  asset: ExportAssetItem,
  scalePreset: '1x' | '2x' | '3x' = '1x',
  format: RasterFormat = 'png'
): string {
  const targetNode = doc.nodes?.[asset.sourceNodeId];
  const bounds = targetNode?.type === 'text' && !clipsTextToFrame(targetNode)
    ? pointTextPaintBounds(targetNode)
    : targetNode;
  const cropBounds = bounds
    ? {
        x: bounds.x - 4,
        y: bounds.y - 4,
        width: Math.max(8, bounds.width + 8),
        height: Math.max(8, bounds.height + 8),
      }
    : undefined;

  return exportDocumentToDataUrl(doc, {
    format,
    scale: resolveScaleMultiplier(scalePreset),
    transparentBackground: format !== 'jpg',
    onlyNodeIds: targetNode ? [targetNode.id, ...(targetNode.children || [])] : undefined,
    cropBounds,
  });
}

export function triggerDataUrlDownload(dataUrl: string, fileName: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
