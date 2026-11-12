import type { AnchorPoint, BoundingBox, VectorNode } from '../core/types';
import { canReflectVector, selectionNodeBounds } from '../core/math/selectionResize';
import { layoutText, measureLineInk, measureTextWidth, textGlyphTransform, textMeasurementSource } from '../core/math/textLayout';
import { computeBoundingBoxFromAnchors } from '../core/math/bezier';
import { isContainerNode, nodeEffectBounds, resolveClipMask, resolveEffects } from '../core/render/appearance';
import { createPointTextNode, parseTextStyleFields, type PointTextOptions } from './text';

/**
 * Layout measurements for agents. Values come from the same text layout the editor uses. In a browser
 * (live bridge) widths and ink use real canvas font metrics; in Node (CLI/SDK) they are estimates and
 * are reported with `source: 'approximate'`.
 */

export interface MeasureTextInput extends PointTextOptions { text: string }

const round = (n: number) => Math.round(n * 100) / 100;
const roundBox = (b: BoundingBox): BoundingBox => ({ x: round(b.x), y: round(b.y), width: round(b.width), height: round(b.height) });
function fail(message: string): never { throw new Error(message); }

/** A point-text node exactly as the `text` operation would create it at x = 0, y = 0. */
function probeTextNode(input: MeasureTextInput): VectorNode {
  const base = { id: 'measure', name: 'measure', layerId: 'measure', visible: true, locked: false, rotation: 0, fills: [], strokes: [], effects: [], opacity: 1, blendMode: 'normal' as const };
  return createPointTextNode(base, 0, 0, input.text, input);
}

const MEASURE_KEYS = ['text', 'fontSize', 'fontFamily', 'fontStyle', 'tracking', 'align', 'lineHeight'];
export function validateMeasureItems(input: unknown): MeasureTextInput[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 100) fail('items must be an array of 1–100 entries');
  return input.map((raw, i) => {
    const ctx = `items[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${ctx} must be an object`);
    const o = raw as Record<string, unknown>;
    for (const key of Object.keys(o)) if (!MEASURE_KEYS.includes(key)) fail(`${ctx}: unknown field ${key}`);
    if (typeof o.text !== 'string' || !o.text.trim() || o.text.length > 5000) fail(`${ctx}.text: expected non-empty string (max 5000)`);
    const style = parseTextStyleFields(o, ctx);
    if (style.fontSize === undefined) fail(`${ctx}.fontSize: expected number between 1 and 10000`);
    return { ...style, fontSize: style.fontSize, text: o.text };
  });
}

/**
 * Size of point text created by the `text` operation at x = 0, y = 0 (so values are offsets from the x/y you pass).
 * - `frame`: the text object's box. With `align: center` its x is negative, because x is the center.
 * - `baseline`: y of the first baseline; `lines[].baseline` for every line.
 * - `ink`: painted glyph box. Center text on `cx` with x = cx - (ink.x + ink.width / 2).
 */
export function measureText(input: MeasureTextInput) {
  const node = probeTextNode(input);
  const layout = layoutText(node);
  const ink = textInkBounds(node);
  return {
    text: input.text, fontSize: input.fontSize, fontFamily: node.textStyle!.fontFamily, fontStyle: node.textStyle!.fontStyle,
    tracking: node.textStyle!.tracking, align: node.textStyle!.align,
    frame: roundBox({ x: node.x, y: node.y, width: node.width, height: node.height }),
    baseline: round(layout.y), lineHeight: round(layout.leading), lines: ink.lines, ink: roundBox(ink.box),
    source: ink.exact ? 'canvas' as const : 'approximate' as const,
  };
}

function union(boxes: BoundingBox[]): BoundingBox | null {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map(b => b.x)), y1 = Math.min(...boxes.map(b => b.y));
  const x2 = Math.max(...boxes.map(b => b.x + b.width)), y2 = Math.max(...boxes.map(b => b.y + b.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
function intersect(a: BoundingBox, b: BoundingBox): BoundingBox | null {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.width, b.x + b.width), y2 = Math.min(a.y + a.height, b.y + b.height);
  return x2 >= x1 && y2 >= y1 ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
}
function rotatedBox(box: BoundingBox, node: VectorNode): BoundingBox {
  if (!node.rotation || Math.abs(node.rotation) < 1e-9) return box;
  const r = node.rotation * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  const pts = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
    .map(([x, y]) => ({ x: cx + (x - cx) * c - (y - cy) * s, y: cy + (x - cx) * s + (y - cy) * c }));
  return union(pts.map(p => ({ x: p.x, y: p.y, width: 0, height: 0 })))!;
}

function rotateAnchor(p: AnchorPoint, node: VectorNode): AnchorPoint {
  if (!node.rotation || Math.abs(node.rotation) < 1e-9) return p;
  const r = node.rotation * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  const rot = (q: { x: number; y: number }) => ({ x: cx + (q.x - cx) * c - (q.y - cy) * s, y: cy + (q.x - cx) * s + (q.y - cy) * c });
  return { ...p, ...rot(p), handleIn: p.handleIn && rot(p.handleIn), handleOut: p.handleOut && rot(p.handleOut) };
}

/** Painted glyph box of a text node in document coordinates (glyph transform and rotation applied). */
export function textInkBounds(node: VectorNode): { box: BoundingBox; exact: boolean; lines: { text: string; width: number; baseline: number }[] } {
  const layout = layoutText(node);
  const glyph = textGlyphTransform(node);
  let exact = textMeasurementSource() === 'canvas';
  const boxes: BoundingBox[] = [];
  const lines = layout.lines.map((text, index) => {
    const baseline = layout.y + index * layout.leading;
    const advance = measureTextWidth(text, layout.fontSize, node) + Math.max(0, Array.from(text).length) * layout.letterSpacing;
    if (text) {
      const ink = measureLineInk(text, layout.fontSize, node);
      exact &&= ink.exact;
      const start = layout.x - (layout.align === 'center' ? advance / 2 : layout.align === 'right' ? advance : 0);
      const xs = [start + ink.left, start + ink.right].map(x => glyph.sx * x + glyph.tx);
      const ys = [baseline - ink.ascent, baseline + ink.descent].map(y => glyph.sy * y + glyph.ty);
      boxes.push({ x: Math.min(...xs), y: Math.min(...ys), width: Math.abs(xs[1] - xs[0]), height: Math.abs(ys[1] - ys[0]) });
    }
    return { text, width: round(advance * Math.abs(glyph.sx)), baseline: round(glyph.sy * baseline + glyph.ty) };
  });
  const raw = union(boxes) ?? { x: node.x, y: node.y, width: 0, height: 0 };
  const stroke = Math.max(0, ...(node.strokes || []).filter(s => s.visible && s.weight > 0).map(s => s.weight / 2));
  const padded = { x: raw.x - stroke, y: raw.y - stroke, width: raw.width + 2 * stroke, height: raw.height + 2 * stroke };
  return { box: rotatedBox(padded, node), exact, lines };
}

export interface VisualBounds { box: BoundingBox; exact: boolean }

/**
 * What the object visibly covers: rotated geometry plus half the stroke width (strokes are centered),
 * groups from their visible children, clipping groups limited to their mask, text from glyph ink.
 * Effects are excluded (see `effectBounds`). Miter spikes on sharp corners can extend slightly further.
 */
export function nodeVisualBounds(node: VectorNode, nodes: Record<string, VectorNode>, seen = new Set<string>()): VisualBounds | null {
  if (!node || !node.visible || node.isGuide || seen.has(node.id)) return null;
  seen.add(node.id);
  if (isContainerNode(node) && node.children?.length) {
    const clip = resolveClipMask(node, nodes);
    const kids = (clip ? clip.content : node.children.map(id => nodes[id])).filter(Boolean);
    const parts = kids.map(child => nodeVisualBounds(child, nodes, seen)).filter((b): b is VisualBounds => !!b);
    let box = union(parts.map(p => p.box));
    if (clip && box) {
      const maskShape = { ...clip.mask, strokes: [] };
      const maskBox = nodeVisualBounds(maskShape, nodes, new Set());
      box = maskBox ? intersect(box, maskBox.box) : box;
    }
    return box ? { box, exact: parts.every(p => p.exact) } : null;
  }
  if (node.type === 'text') {
    const ink = textInkBounds(node);
    return { box: ink.box, exact: ink.exact };
  }
  // Tight curve extent (control handles excluded), with the node rotation applied to the anchors.
  const geometry = node.points?.length >= 2
    ? computeBoundingBoxFromAnchors(node.points.map(p => rotateAnchor(p, node)), node.closed !== false && node.type !== 'line')
    : canReflectVector(node)
      ? selectionNodeBounds(node)
      : rotatedBox({ x: node.x, y: node.y, width: node.width, height: node.height }, node);
  const stroke = Math.max(0, ...(node.strokes || []).filter(s => s.visible && s.weight > 0).map(s => s.weight / 2));
  return {
    box: { x: geometry.x - stroke, y: geometry.y - stroke, width: geometry.width + 2 * stroke, height: geometry.height + 2 * stroke },
    exact: true,
  };
}

/** Per-node layout facts for `inspect`, rounded to 0.01. */
export function inspectLayout(node: VectorNode, nodes: Record<string, VectorNode>) {
  const visual = nodeVisualBounds(node, nodes);
  const out: Record<string, unknown> = {};
  if (visual) { out.visualBounds = roundBox(visual.box); if (!visual.exact) out.visualBoundsApproximate = true; }
  if (resolveEffects(node)) { const fx = nodeEffectBounds(node, nodes); if (fx) out.effectBounds = roundBox(fx); }
  if (node.type === 'text') {
    const ink = textInkBounds(node);
    out.textLines = ink.lines;
  }
  return out;
}
