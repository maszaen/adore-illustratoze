import type { VectorNode } from '../types';
import { hexToRgb, rgbToHex } from './color';
import { nodeToPolygon } from './pathfinder';
import type { Point2D } from '../types';

/** Supported single-contour vectors; different shapes are resampled along their outlines. */
export function canBlend(a: VectorNode, b: VectorNode): boolean {
  const supported = ['path', 'rectangle', 'ellipse', 'line', 'polygon', 'star'];
  return supported.includes(a.type) && supported.includes(b.type) && !a.parentId && !b.parentId &&
    a.layerId === b.layerId && !a.locked && !b.locked && a.visible && b.visible &&
    a.closed === b.closed && !a.points.some((p, i) => i > 0 && p.moveTo) && !b.points.some((p, i) => i > 0 && p.moveTo) &&
    a.fills.length <= 1 && b.fills.length <= 1 && a.strokes.length <= 1 && b.strokes.length <= 1 &&
    a.fills.every(f => f.type === 'solid' || f.type === 'none') && b.fills.every(f => f.type === 'solid' || f.type === 'none') &&
    !a.effects.length && !b.effects.length && !a.children?.length && !b.children?.length;
}

function resample(points: Point2D[], closed: boolean, count: number): Point2D[] {
  if (points.length < 2) return [];
  const ends = closed ? [...points, points[0]] : points;
  const lengths = [0];
  for (let i = 1; i < ends.length; i++) lengths.push(lengths[i-1] + Math.hypot(ends[i].x-ends[i-1].x, ends[i].y-ends[i-1].y));
  const total = lengths[lengths.length-1];
  if (!total) return Array.from({length: count}, () => ({...points[0]}));
  return Array.from({length: count}, (_, i) => {
    const target = total * i / (closed ? count : count-1);
    let j = 1; while (j < lengths.length-1 && lengths[j] < target) j++;
    const t = (target-lengths[j-1]) / (lengths[j]-lengths[j-1] || 1);
    return {x: ends[j-1].x + (ends[j].x-ends[j-1].x)*t, y: ends[j-1].y + (ends[j].y-ends[j-1].y)*t};
  });
}

export function blendIntermediateNodes(node: VectorNode, nodes: Record<string, VectorNode>): VectorNode[] {
  const a = nodes[node.children?.[0] || ''];
  const b = nodes[node.children?.[1] || ''];
  if (!a || !b) return [];
  // Endpoints are parented after creation; compatibility was checked on creation.
  if (!canBlend({ ...a, parentId: undefined }, { ...b, parentId: undefined })) return [];
  const sameTopology = a.type === b.type && !a.rotation && !b.rotation && a.points.length > 0 && a.points.length === b.points.length && a.points.every((p, i) => !!p.moveTo === !!b.points[i].moveTo);
  const sampledA = sameTopology ? [] : resample(nodeToPolygon(a, 24), a.closed, 96);
  const sampledB = sameTopology ? [] : resample(nodeToPolygon(b, 24), b.closed, 96);
  if (!sameTopology && (!sampledA.length || !sampledB.length)) return [];
  const spec = node.blendSpec;
  const distance = Math.hypot((a.x + a.width / 2) - (b.x + b.width / 2), (a.y + a.height / 2) - (b.y + b.height / 2));
  const raw = spec?.mode === 'smooth' ? 32 : spec?.mode === 'distance' ? Math.max(0, Math.ceil(distance / Math.max(1, spec.steps)) - 1) : (spec?.steps ?? 6);
  const count = Math.max(0, Math.min(250, Number.isFinite(raw) ? Math.round(raw) : 6));
  const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
  const color = (x: string, y: string, t: number) => {
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(x) || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(y)) return t < 0.5 ? x : y;
    const c = hexToRgb(x), d = hexToRgb(y);
    return rgbToHex({ r: lerp(c.r, d.r, t), g: lerp(c.g, d.g, t), b: lerp(c.b, d.b, t) });
  };
  const fillA = a.fills.find(f => f.visible && f.type === 'solid');
  const fillB = b.fills.find(f => f.visible && f.type === 'solid');
  const strokeA = a.strokes.find(f => f.visible);
  const strokeB = b.strokes.find(f => f.visible);
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / (count + 1);
    const point = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
    return {
      ...a, id: `${node.id}-step-${i}`, parentId: node.id, name: '<Blend Step>', type: sameTopology ? a.type : 'path', rotation: 0,
      x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t),
      opacity: lerp(a.opacity, b.opacity, t), cornerRadius: lerp(a.cornerRadius || 0, b.cornerRadius || 0, t),
      points: sameTopology ? a.points.map((p, j) => {
        const q = b.points[j];
        return { ...p, ...point(p, q), id: `${node.id}-step-${i}-point-${j}`,
          handleIn: p.handleIn || q.handleIn ? point(p.handleIn || p, q.handleIn || q) : undefined,
          handleOut: p.handleOut || q.handleOut ? point(p.handleOut || p, q.handleOut || q) : undefined,
          cornerRadius: lerp(p.cornerRadius || 0, q.cornerRadius || 0, t) };
      }) : sampledA.map((p, j) => ({ ...point(p, sampledB[j]), id: `${node.id}-step-${i}-point-${j}`, pointType: 'corner' as const })),
      fills: fillA || fillB ? [{ ...(fillA || fillB)!, color: color((fillA || fillB)!.color, (fillB || fillA)!.color, t), opacity: lerp(fillA?.opacity ?? 0, fillB?.opacity ?? 0, t), visible: true }] : [],
      strokes: strokeA || strokeB ? [{ ...(strokeA || strokeB)!, color: color((strokeA || strokeB)!.color, (strokeB || strokeA)!.color, t), weight: lerp(strokeA?.weight ?? 0, strokeB?.weight ?? 0, t), opacity: lerp(strokeA?.opacity ?? 0, strokeB?.opacity ?? 0, t), visible: true }] : [],
    };
  });
}
