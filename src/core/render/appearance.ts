import type { BoundingBox, FillItem, StudioDocument, VectorNode } from '../types';
import { applyColorTint } from '../math/color';
import { computeBoundingBoxFromAnchors } from '../math/bezier';

/**
 * Rendering rules shared by the viewport, SVG, raster and PDF back ends.
 * Everything here is pure (no DOM) so each renderer can follow the same contract.
 * The viewport (StudioCanvas) is the reference: other renderers must match it.
 */

/** Node types that only group their children (they have no geometry of their own). */
export const CONTAINER_TYPES: ReadonlySet<string> = new Set(['group', 'clipping-group', 'blend']);
export const isContainerNode = (node: VectorNode): boolean => CONTAINER_TYPES.has(node.type);

/** Node types whose outline may act as a clipping mask. */
const CLIP_SHAPE_TYPES: ReadonlySet<string> = new Set(['path', 'rectangle', 'ellipse', 'polygon', 'star', 'compound-path', 'compound-shape']);
export const isClipShape = (node: VectorNode | undefined): node is VectorNode => !!node && CLIP_SHAPE_TYPES.has(node.type);

/**
 * Clipping group contract: the last (top-most) child is the mask, every other child is clipped by it.
 * Returns null when the group is not a usable clipping group; renderers then draw the children unclipped.
 */
export function resolveClipMask(node: VectorNode, nodes: Record<string, VectorNode>): { mask: VectorNode; content: VectorNode[] } | null {
  if (node.type !== 'clipping-group') return null;
  const kids = (node.children || []).map(id => nodes[id]).filter((child): child is VectorNode => !!child);
  if (kids.length < 2) return null;
  const mask = kids[kids.length - 1];
  if (!isClipShape(mask)) return null;
  return { mask, content: kids.slice(0, -1) };
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export interface Rgba { r: number; g: number; b: number; a: number }

/** Parses #rgb, #rrggbb, #rrggbbaa, rgb()/rgba() and `transparent`. Returns null for anything else. */
export function parseCssColor(input: string | undefined | null): Rgba | null {
  if (!input) return null;
  const value = String(input).trim().toLowerCase();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let match = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value);
  if (match) {
    let hex = match[1];
    if (hex.length <= 4) hex = hex.split('').map(c => c + c).join('');
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
  }
  match = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(value);
  if (match) {
    const alpha = match[4] === undefined ? 1 : match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4]);
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    return { r: clamp(+match[1]), g: clamp(+match[2]), b: clamp(+match[3]), a: Math.max(0, Math.min(1, alpha)) };
  }
  return null;
}

/** `rgba()` string for canvas gradient stops; opacity multiplies any alpha already in the color. */
export function toRgbaString(color: string, opacity = 1): string {
  const parsed = parseCssColor(color) ?? { r: 0, g: 0, b: 0, a: 1 };
  const alpha = Math.round(Math.max(0, Math.min(1, parsed.a * opacity)) * 1000) / 1000;
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

/** Global swatch + tint resolution, identical to the viewport. */
export function resolvePaintColor(doc: Pick<StudioDocument, 'swatches'>, color: string, globalSwatchId?: string, tint?: number): string {
  if (!color || color === 'none') return 'none';
  let base = color;
  if (globalSwatchId) {
    const swatch = (doc.swatches || []).find(item => item.id === globalSwatchId);
    if (swatch?.color) base = swatch.color;
  }
  return tint !== undefined && tint < 100 ? applyColorTint(base, tint) : base;
}

// ---------------------------------------------------------------------------
// Gradients (SVG objectBoundingBox semantics)
// ---------------------------------------------------------------------------

type GradientLike = NonNullable<FillItem['gradient']>;

/**
 * The box a gradient is mapped to. The browser uses the tight geometry box of the element
 * (objectBoundingBox), which differs from the stored node frame for stars, curves, etc.
 */
export function gradientBox(node: VectorNode): BoundingBox {
  if (node.type !== 'text' && node.points?.length >= 2 && !(node.effects || []).some(fx => fx.enabled)) {
    return computeBoundingBoxFromAnchors(node.points, node.closed !== false);
  }
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

/** Stops sorted by offset (stable) with offsets clamped to 0..1. */
export function normalizedGradientStops(gradient: GradientLike) {
  return (gradient.stops || [])
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => a.stop.offset - b.stop.offset || a.index - b.index)
    .map(({ stop }) => ({ offset: Math.max(0, Math.min(1, stop.offset)), color: stop.color, opacity: stop.opacity ?? 1 }));
}

/**
 * Linear gradient axis in user space that reproduces the viewport's
 * `x1=50%-cos*50% ... x2=50%+cos*50%` objectBoundingBox gradient exactly, including
 * the skew SVG applies to non-square boxes. Null when the box has no area.
 */
export function linearGradientAxis(box: BoundingBox, angleDegrees: number) {
  if (!(box.width > 0) || !(box.height > 0)) return null;
  const radians = (angleDegrees || 0) * Math.PI / 180;
  const gx = Math.cos(radians) / box.width, gy = Math.sin(radians) / box.height;
  const g2 = gx * gx + gy * gy;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  return { x1: cx - 0.5 * gx / g2, y1: cy - 0.5 * gy / g2, x2: cx + 0.5 * gx / g2, y2: cy + 0.5 * gy / g2 };
}

/** Radial gradient: SVG `cx=cy=r=50%` of the bounding box, i.e. an ellipse for non-square boxes. */
export function radialGradientEllipse(box: BoundingBox) {
  if (!(box.width > 0) || !(box.height > 0)) return null;
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2, rx: box.width / 2, ry: box.height / 2 };
}

// ---------------------------------------------------------------------------
// Live effects
// ---------------------------------------------------------------------------

const num = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export interface ResolvedEffects {
  dropShadow?: { dx: number; dy: number; blur: number; color: string; opacity: number };
  glow?: { blur: number; color: string; opacity: number };
  blur?: { radius: number };
  /** Distance the effects can paint beyond the object, in document units. */
  margin: number;
}

/**
 * Raster-style effects supported by every renderer. Parameter aliases are normalized here:
 * the UI and presets write `dx`/`dy`, older documents wrote `offsetX`/`offsetY`.
 * Application order is fixed (shadow, glow, blur) like the viewport's SVG filter.
 */
export function resolveEffects(node: VectorNode): ResolvedEffects | null {
  const enabled = (node.effects || []).filter(fx => fx.enabled);
  if (!enabled.length) return null;
  const shadow = enabled.find(fx => fx.type === 'drop-shadow');
  const glow = enabled.find(fx => fx.type === 'outer-glow' || fx.type === 'inner-glow');
  const blur = enabled.find(fx => fx.type === 'gaussian-blur' || fx.type === 'feather' || fx.type === 'radial-blur');
  if (!shadow && !glow && !blur) return null;
  const result: ResolvedEffects = { margin: 0 };
  if (shadow) {
    const p = shadow.params || {};
    result.dropShadow = {
      dx: num(p.offsetX ?? p.dx, 6), dy: num(p.offsetY ?? p.dy, 6),
      blur: Math.max(0, num(p.blur, 6)), color: String(p.color ?? '#000000'),
      opacity: Math.max(0, Math.min(1, num(p.opacity, 0.55))),
    };
    result.margin += Math.max(Math.abs(result.dropShadow.dx), Math.abs(result.dropShadow.dy)) + 3 * result.dropShadow.blur;
  }
  if (glow) {
    const p = glow.params || {};
    result.glow = { blur: Math.max(0, num(p.blur, 10)), color: String(p.color ?? '#38bdf8'), opacity: Math.max(0, Math.min(1, num(p.opacity, 0.85))) };
    result.margin += 3 * result.glow.blur;
  }
  if (blur) {
    result.blur = { radius: Math.max(0, num(blur.params?.radius, 6)) };
    result.margin += 3 * result.blur.radius;
  }
  return result;
}

/** `<filter>` markup shared by the SVG exporter. The region is explicit so large blurs are never clipped. */
export function effectFilterMarkup(id: string, fx: ResolvedEffects, region: BoundingBox, fmt: (n: number) => string): string {
  const parts: string[] = [];
  if (fx.dropShadow) {
    const s = fx.dropShadow;
    parts.push(`<feDropShadow dx="${fmt(s.dx)}" dy="${fmt(s.dy)}" stdDeviation="${fmt(s.blur)}" flood-color="${escapeAttr(s.color)}" flood-opacity="${fmt(s.opacity)}"/>`);
  }
  if (fx.glow) {
    const g = fx.glow;
    parts.push(`<feDropShadow dx="0" dy="0" stdDeviation="${fmt(g.blur)}" flood-color="${escapeAttr(g.color)}" flood-opacity="${fmt(g.opacity)}"/>`);
  }
  if (fx.blur) parts.push(`<feGaussianBlur stdDeviation="${fmt(fx.blur.radius)}"/>`);
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="${fmt(region.x)}" y="${fmt(region.y)}" width="${fmt(region.width)}" height="${fmt(region.height)}" color-interpolation-filters="sRGB">${parts.join('')}</filter>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Render bounds (conservative; used to size offscreen layers and filter regions)
// ---------------------------------------------------------------------------

function unionBounds(boxes: BoundingBox[]): BoundingBox | null {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map(b => b.x)), y1 = Math.min(...boxes.map(b => b.y));
  const x2 = Math.max(...boxes.map(b => b.x + b.width)), y2 = Math.max(...boxes.map(b => b.y + b.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Conservative paint bounds in document units (strokes, rotation and own effects included).
 * Over-estimating is safe; under-estimating would clip artwork in an offscreen layer.
 */
export function nodeRenderBounds(node: VectorNode, nodes: Record<string, VectorNode>, seen = new Set<string>()): BoundingBox | null {
  if (!node || !node.visible || node.isGuide || seen.has(node.id)) return null;
  seen.add(node.id);
  let box: BoundingBox | null;
  if (isContainerNode(node) && node.children?.length) {
    box = unionBounds(node.children.map(id => nodes[id]).filter(Boolean).map(child => nodeRenderBounds(child, nodes, new Set(seen))).filter((b): b is BoundingBox => !!b));
    // Children that are not in the node map (e.g. glyphs generated on the fly) fall back to the stored group frame.
    if (!box) box = { x: node.x, y: node.y, width: node.width, height: node.height };
    if (node.type === 'blend') box = { x: box.x - 1, y: box.y - 1, width: box.width + 2, height: box.height + 2 };
  } else {
    let x1 = node.x, y1 = node.y, x2 = node.x + node.width, y2 = node.y + node.height;
    for (const p of node.points || []) {
      for (const q of [p, p.handleIn, p.handleOut]) {
        if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) continue;
        x1 = Math.min(x1, q.x); y1 = Math.min(y1, q.y); x2 = Math.max(x2, q.x); y2 = Math.max(y2, q.y);
      }
    }
    const strokeReach = Math.max(0, ...(node.strokes || []).filter(s => s.visible).map(s => s.weight * Math.max(1, Math.min(10, s.miterLimit || 4)) / 2));
    let pad = strokeReach;
    if (node.type === 'text') pad += (node.textStyle?.fontSize ?? 24) * 1.5;
    if (node.rotation && Math.abs(node.rotation) > 0.001) {
      const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
      const reach = Math.hypot(Math.max(Math.abs(x1 - cx), Math.abs(x2 - cx)), Math.max(Math.abs(y1 - cy), Math.abs(y2 - cy)));
      x1 = cx - reach; x2 = cx + reach; y1 = cy - reach; y2 = cy + reach;
    }
    box = { x: x1 - pad, y: y1 - pad, width: x2 - x1 + 2 * pad, height: y2 - y1 + 2 * pad };
  }
  return box;
}

/** Render bounds grown by the node's own effect margin. */
export function nodeEffectBounds(node: VectorNode, nodes: Record<string, VectorNode>): BoundingBox | null {
  const box = nodeRenderBounds(node, nodes);
  const fx = resolveEffects(node);
  if (!box || !fx) return box;
  const m = fx.margin + 1;
  return { x: box.x - m, y: box.y - m, width: box.width + 2 * m, height: box.height + 2 * m };
}
