import { blendIntermediateNodes } from '../math/blend';
import { generateNodeSvgPath, generateVariableWidthStrokePolygon } from '../math/bezier';
import { clipsTextToFrame, layoutText, pointTextPaintBounds, textGlyphTransform } from '../math/textLayout';
import { gaussianBlurRgba } from '../render/blur';
import {
  gradientBox,
  isContainerNode,
  linearGradientAxis,
  nodeEffectBounds,
  normalizedGradientStops,
  radialGradientEllipse,
  resolveClipMask,
  resolveEffects,
  resolvePaintColor,
  toRgbaString,
  type ResolvedEffects,
} from '../render/appearance';
import type {
  ArtboardItem,
  BoundingBox,
  ExportAssetItem,
  FillItem,
  SliceItem,
  StudioDocument,
  VectorNode,
} from '../types';

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

/** A drawing target plus the mapping from document units to its pixels: device = doc * scale + t. */
interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scale: number;
  tx: number;
  ty: number;
}

/** Largest offscreen layer (pixels) the exporter will allocate. */
const MAX_LAYER_PIXELS = 100_000_000;

let forceSoftwareBlur = false;
/** Test hook: bypass `ctx.filter` so the software blur path can be compared with the native one. */
export function setSoftwareBlurForTesting(enabled: boolean): void { forceSoftwareBlur = enabled; }

function makeSurface(width: number, height: number, scale: number, tx: number, ty: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Raster export failed: canvas is unavailable.');
  ctx.setTransform(scale, 0, 0, scale, tx, ty);
  return { canvas, ctx, width, height, scale, tx, ty };
}

const resetTransform = (s: Surface) => s.ctx.setTransform(s.scale, 0, 0, s.scale, s.tx, s.ty);

function rotateAbout(ctx: CanvasRenderingContext2D, node: VectorNode) {
  if (node.rotation && Math.abs(node.rotation) > 0.001) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((node.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
}

/** Shadow/glow/blur on an already-rendered layer. Order matches the viewport's SVG filter. */
function applyEffects(source: HTMLCanvasElement, fx: ResolvedEffects, scale: number): HTMLCanvasElement {
  let current = source;
  const next = (): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Raster export failed: canvas is unavailable.');
    return { canvas, ctx };
  };
  const shadow = (dx: number, dy: number, blur: number, color: string, opacity: number) => {
    const { canvas, ctx } = next();
    ctx.shadowColor = toRgbaString(color, opacity);
    // Canvas shadowBlur is twice the Gaussian standard deviation.
    ctx.shadowBlur = 2 * blur * scale;
    ctx.shadowOffsetX = dx * scale;
    ctx.shadowOffsetY = dy * scale;
    ctx.drawImage(current, 0, 0);
    current = canvas;
  };
  if (fx.dropShadow) shadow(fx.dropShadow.dx, fx.dropShadow.dy, fx.dropShadow.blur, fx.dropShadow.color, fx.dropShadow.opacity);
  if (fx.glow) shadow(0, 0, fx.glow.blur, fx.glow.color, fx.glow.opacity);
  if (fx.blur && fx.blur.radius > 0) {
    const sigma = fx.blur.radius * scale;
    const { canvas, ctx } = next();
    if (!forceSoftwareBlur && 'filter' in ctx) {
      ctx.filter = `blur(${sigma}px)`;
      ctx.drawImage(current, 0, 0);
      ctx.filter = 'none';
    } else {
      ctx.drawImage(current, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      gaussianBlurRgba(image.data, image.width, image.height, sigma);
      ctx.putImageData(image, 0, 0);
    }
    current = canvas;
  }
  return current;
}

/**
 * Draw into an isolated offscreen layer, then composite it with opacity, blend mode and effects.
 * This is what gives groups SVG's "compositing group" behaviour (overlapping children are not
 * double-faded) and lets effects apply to the whole object.
 */
function compositeGroup(
  parent: Surface,
  bounds: BoundingBox | null,
  style: { opacity: number; blend: string | null; fx: ResolvedEffects | null },
  draw: (layer: Surface) => void
) {
  if (!bounds) return;
  const pad = style.fx ? Math.ceil(style.fx.margin * parent.scale) : 0;
  const x0 = Math.max(Math.floor(bounds.x * parent.scale + parent.tx), -pad);
  const y0 = Math.max(Math.floor(bounds.y * parent.scale + parent.ty), -pad);
  const x1 = Math.min(Math.ceil((bounds.x + bounds.width) * parent.scale + parent.tx), parent.width + pad);
  const y1 = Math.min(Math.ceil((bounds.y + bounds.height) * parent.scale + parent.ty), parent.height + pad);
  const w = x1 - x0, h = y1 - y0;
  if (!(w > 0) || !(h > 0)) return;
  if (w * h > MAX_LAYER_PIXELS) throw new Error('Raster export failed: an effect or transparency layer is too large to render. Lower the export scale.');
  const layer = makeSurface(w, h, parent.scale, parent.tx - x0, parent.ty - y0);
  draw(layer);
  const out = style.fx ? applyEffects(layer.canvas, style.fx, parent.scale) : layer.canvas;
  const { ctx } = parent;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = (ctx.globalAlpha ?? 1) * style.opacity;
  if (style.blend) ctx.globalCompositeOperation = style.blend as GlobalCompositeOperation;
  ctx.drawImage(out, x0, y0);
  ctx.restore();
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

  const root = makeSurface(pixelW, pixelH, scale, -region.x * scale, -region.y * scale);

  const needsMatte = opts.format === 'jpg' || !opts.transparentBackground;
  if (needsMatte) {
    root.ctx.save();
    root.ctx.setTransform(1, 0, 0, 1, 0, 0);
    root.ctx.fillStyle = opts.matteColor || ab.backgroundColor || '#ffffff';
    root.ctx.fillRect(0, 0, pixelW, pixelH);
    root.ctx.restore();
  }

  const nodesMap = doc.nodes || {};
  const allowedSet = opts.onlyNodeIds ? new Set(opts.onlyNodeIds) : null;
  const isRoot = (n: VectorNode | undefined): n is VectorNode => !!n && n.visible && !n.parentId && !n.isGuide;

  // Layers are listed top-to-bottom; painting runs bottom-to-top, like the viewport.
  const layerRoots: { opacity: number; nodes: VectorNode[] }[] = [];
  for (const layer of [...(doc.layers || [])].reverse()) {
    if (!layer.visible) continue;
    const nodes = (layer.nodeIds || []).map((nid) => nodesMap[nid]).filter(isRoot);
    if (nodes.length) layerRoots.push({ opacity: layer.opacity ?? 1, nodes });
  }
  if (layerRoots.length === 0) {
    const loose = Object.values(nodesMap).filter(
      (n) => isRoot(n) && !(doc.layers || []).some((layer) => layer.nodeIds?.includes(n.id))
    );
    if (loose.length) layerRoots.push({ opacity: 1, nodes: loose });
  }

  const drawFillStack = (s: Surface, node: VectorNode, path: Path2D) => {
    const { ctx: c } = s;
    const rule = node.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
    for (const fill of (node.fills || []).filter((f) => f.visible && f.type !== 'none')) {
      if (fill.type === 'pattern') continue;
      c.save();
      c.globalAlpha *= fill.opacity ?? 1;
      if (fill.blendMode && fill.blendMode !== 'normal') c.globalCompositeOperation = fill.blendMode as GlobalCompositeOperation;
      fillWithPaint(c, path, node, fill, rule, doc);
      c.restore();
    }
  };

  const drawStrokeStack = (s: Surface, node: VectorNode, path: Path2D) => {
    const { ctx: c } = s;
    for (const stroke of (node.strokes || []).filter((st) => st.visible && st.weight > 0)) {
      c.save();
      c.globalAlpha *= stroke.opacity ?? 1;
      if (stroke.blendMode && stroke.blendMode !== 'normal') c.globalCompositeOperation = stroke.blendMode as GlobalCompositeOperation;
      const color = resolvePaintColor(doc, stroke.color, stroke.globalSwatchId, stroke.tint);
      const variable = Boolean(stroke.widthProfileId && stroke.widthProfileId !== 'uniform') || (node.points || []).some((p) => p.widthLeft !== undefined);
      if (variable && node.points?.length >= 2) {
        const d = generateVariableWidthStrokePolygon(node.points, node.closed, stroke.weight, stroke.widthProfileId);
        if (d) { c.fillStyle = color; c.fill(new Path2D(d)); }
      } else {
        c.strokeStyle = color;
        c.lineWidth = stroke.weight;
        c.lineCap = stroke.cap === 'projecting' ? 'square' : stroke.cap || 'round';
        c.lineJoin = stroke.join || 'round';
        c.miterLimit = stroke.miterLimit || 10;
        if (stroke.dashArray && stroke.dashArray.length > 0) c.setLineDash(stroke.dashArray);
        c.stroke(path);
      }
      c.restore();
    }
  };

  const drawText = (s: Surface, node: VectorNode) => {
    const { ctx: c } = s;
    c.save();
    rotateAbout(c, node);
    const layout = layoutText(node);
    if (clipsTextToFrame(node)) {
      c.beginPath(); c.rect(node.x, node.y, Math.max(0, node.width), Math.max(0, node.height)); c.clip();
    }
    const glyph = textGlyphTransform(node);
    c.transform(glyph.sx, 0, 0, glyph.sy, glyph.tx, glyph.ty);
    const ff = node.textStyle?.fontFamily ?? 'Inter, sans-serif';
    const isBold = node.textStyle?.fontStyle?.toLowerCase().includes('bold');
    const isItalic = node.textStyle?.fontStyle?.toLowerCase().includes('italic');
    c.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${layout.fontSize}px ${ff}`;
    c.textBaseline = 'alphabetic';
    c.textAlign = layout.align;
    if ('letterSpacing' in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${layout.letterSpacing}px`;
    const primaryFill = (node.fills || []).find((f) => f.visible && f.type !== 'none');
    const stroke = (node.strokes || []).find((item) => item.visible && item.weight > 0);
    layout.lines.forEach((line, idx) => {
      const y = layout.y + idx * layout.leading;
      if (primaryFill) {
        c.save();
        c.globalAlpha *= primaryFill.opacity ?? 1;
        c.fillStyle = paintStyle(c, node, primaryFill, doc) ?? 'rgba(0,0,0,0)';
        c.fillText(line, layout.x, y);
        c.restore();
      }
      if (stroke) {
        c.save();
        c.globalAlpha *= stroke.opacity ?? 1;
        c.strokeStyle = resolvePaintColor(doc, stroke.color || '#000000', stroke.globalSwatchId, stroke.tint);
        c.lineWidth = stroke.weight;
        c.strokeText(line, layout.x, y);
        c.restore();
      }
    });
    c.restore();
  };

  const drawVector = (s: Surface, node: VectorNode) => {
    if (typeof Path2D === 'undefined') return;
    const d = generateNodeSvgPath(node, nodesMap);
    if (!d) return;
    const { ctx: c } = s;
    c.save();
    rotateAbout(c, node);
    const path = new Path2D(d);
    drawFillStack(s, node, path);
    drawStrokeStack(s, node, path);
    c.restore();
  };

  const paintCount = (node: VectorNode) =>
    (node.fills || []).filter((f) => f.visible && f.type !== 'none').length +
    (node.strokes || []).filter((st) => st.visible && st.weight > 0).length;

  const drawChildren = (s: Surface, ids: VectorNode[], guard: Set<string>) => ids.forEach((child) => drawNode(s, child, guard));

  const drawContent = (s: Surface, node: VectorNode, guard: Set<string>) => {
    if (node.type === 'blend' && node.children?.length === 2) {
      const endpoints = node.children.map((id) => nodesMap[id]);
      if (endpoints.every(Boolean)) drawChildren(s, [endpoints[0], ...blendIntermediateNodes(node, nodesMap), endpoints[1]], guard);
      return;
    }
    if (isContainerNode(node)) {
      const kids = (node.children || []).map((id) => nodesMap[id]).filter(Boolean);
      const clip = resolveClipMask(node, nodesMap);
      if (clip && typeof Path2D !== 'undefined') {
        const d = generateNodeSvgPath(clip.mask, nodesMap);
        if (d) {
          s.ctx.save();
          rotateAbout(s.ctx, clip.mask);
          s.ctx.clip(new Path2D(d), clip.mask.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
          resetTransform(s);
          drawChildren(s, clip.content, guard);
          s.ctx.restore();
          return;
        }
      }
      drawChildren(s, kids, guard);
      return;
    }
    if (node.type === 'text') { drawText(s, node); return; }
    drawVector(s, node);
  };

  function drawNode(s: Surface, node: VectorNode, guard: Set<string>) {
    if (!node || !node.visible || node.isGuide || guard.has(node.id)) return;
    if (
      allowedSet &&
      !allowedSet.has(node.id) && !allowedSet.has(node.parentId || '') &&
      (!node.children || !node.children.some((c) => allowedSet.has(c)))
    ) {
      return;
    }
    const inner = new Set(guard).add(node.id);
    const fx = resolveEffects(node);
    const blend = node.blendMode && node.blendMode !== 'normal' ? node.blendMode : null;
    const opacity = Math.max(0, Math.min(1, node.opacity ?? 1));
    const container = isContainerNode(node);
    // A single paint can be faded directly; everything else needs an isolated group.
    const direct = !container && !fx && !blend && paintCount(node) <= 1;
    if (!fx && !blend && (opacity >= 1 || direct)) {
      s.ctx.save();
      if (opacity < 1) s.ctx.globalAlpha *= opacity;
      drawContent(s, node, inner);
      s.ctx.restore();
      return;
    }
    if (opacity <= 0 && !fx) return;
    // The viewport applies the SVG filter on the rotated element, so a shadow offset turns with the object.
    let appliedFx = fx;
    if (fx?.dropShadow && !container && node.rotation && Math.abs(node.rotation) > 0.001) {
      const a = (node.rotation * Math.PI) / 180, { dx, dy } = fx.dropShadow;
      appliedFx = { ...fx, dropShadow: { ...fx.dropShadow, dx: dx * Math.cos(a) - dy * Math.sin(a), dy: dx * Math.sin(a) + dy * Math.cos(a) } };
    }
    compositeGroup(s, nodeEffectBounds(node, nodesMap), { opacity, blend, fx: appliedFx }, (layer) => drawContent(layer, node, inner));
  }

  for (const { opacity, nodes } of layerRoots) {
    const draw = (s: Surface) => nodes.forEach((node) => drawNode(s, node, new Set()));
    if (opacity >= 1) { draw(root); continue; }
    const boxes = nodes.map((node) => nodeEffectBounds(node, nodesMap)).filter((b): b is BoundingBox => !!b);
    if (!boxes.length) continue;
    const x1 = Math.min(...boxes.map((b) => b.x)), y1 = Math.min(...boxes.map((b) => b.y));
    const x2 = Math.max(...boxes.map((b) => b.x + b.width)), y2 = Math.max(...boxes.map((b) => b.y + b.height));
    compositeGroup(root, { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }, { opacity: Math.max(0, opacity), blend: null, fx: null }, draw);
  }

  return root.canvas;
}

/** Fill style for a paint: a solid color, or a canvas gradient matching the viewport's SVG gradient. */
function paintStyle(ctx: CanvasRenderingContext2D, node: VectorNode, fill: FillItem, doc: StudioDocument): string | CanvasGradient | null {
  const g = fill.type === 'gradient' ? fill.gradient : undefined;
  if (!g) return resolvePaintColor(doc, fill.color || '#000000', fill.globalSwatchId, fill.tint);
  const stops = normalizedGradientStops(g);
  if (!stops.length) return null;
  const box = gradientBox(node);
  const gradient = g.type === 'radial'
    ? (() => { const e = radialGradientEllipse(box); return e ? ctx.createRadialGradient(e.cx, e.cy, 0, e.cx, e.cy, Math.max(e.rx, e.ry)) : null; })()
    : (() => { const a = linearGradientAxis(box, g.angle); return a ? ctx.createLinearGradient(a.x1, a.y1, a.x2, a.y2) : null; })();
  if (!gradient) return toRgbaString(stops[0].color, stops[0].opacity); // zero-area box: SVG would not paint the gradient either
  for (const stop of stops) gradient.addColorStop(stop.offset, toRgbaString(stop.color, stop.opacity));
  return gradient;
}

function fillWithPaint(ctx: CanvasRenderingContext2D, path: Path2D, node: VectorNode, fill: FillItem, rule: CanvasFillRule, doc: StudioDocument) {
  const g = fill.type === 'gradient' ? fill.gradient : undefined;
  if (g?.type === 'radial') {
    const box = gradientBox(node);
    const e = radialGradientEllipse(box);
    const stops = normalizedGradientStops(g);
    if (e && stops.length && Math.abs(e.rx - e.ry) > 1e-6) {
      // Canvas radial gradients are circular: draw the path in a space scaled so the ellipse becomes a unit circle.
      const unit = new Path2D();
      unit.addPath(path, { a: 1 / e.rx, b: 0, c: 0, d: 1 / e.ry, e: -e.cx / e.rx, f: -e.cy / e.ry });
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const stop of stops) gradient.addColorStop(stop.offset, toRgbaString(stop.color, stop.opacity));
      ctx.translate(e.cx, e.cy);
      ctx.scale(e.rx, e.ry);
      ctx.fillStyle = gradient;
      ctx.fill(unit, rule);
      return;
    }
  }
  ctx.fillStyle = paintStyle(ctx, node, fill, doc) ?? 'rgba(0,0,0,0)';
  ctx.fill(path, rule);
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
