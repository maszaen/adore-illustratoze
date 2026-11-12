import type { BoundingBox, Point2D, StudioDocument, VectorNode } from '../types';
import { canReflectVector, selectionNodeBounds } from './selectionResize';
import { rotatePointAround } from './selectionRotate';

export interface SnapTarget { value: number; from: number; to: number; label: string }
export interface SnapTargets { x: SnapTarget[]; y: SnapTarget[] }
export interface SnapGuide {
  x?: number; y?: number; labelX?: string; labelY?: string;
  lineX?: { x: number; y1: number; y2: number };
  lineY?: { y: number; x1: number; x2: number };
}

/**
 * Artboards snap only to other artboards (as in Illustrator); artwork snaps to artwork and artboards.
 * `excludeArtboardIds` removes the artboard being dragged from its own targets.
 */
export function collectArtboardSnapTargets(doc: StudioDocument, excludeArtboardIds: readonly string[] = []): SnapTargets {
  const excluded = new Set(excludeArtboardIds), targets: SnapTargets = { x: [], y: [] };
  for (const ab of doc.artboards) {
    if (excluded.has(ab.id)) continue;
    for (const value of [ab.x, ab.x + ab.width / 2, ab.x + ab.width]) targets.x.push({ value, from: ab.y, to: ab.y + ab.height, label: 'artboard' });
    for (const value of [ab.y, ab.y + ab.height / 2, ab.y + ab.height]) targets.y.push({ value, from: ab.x, to: ab.x + ab.width, label: 'artboard' });
  }
  return targets;
}

/** Snap a single point (a dragged corner or the start of a new shape) to the nearest target on each axis. */
export function snapPoint(point: Point2D, targets: SnapTargets, options: { zoom: number; smart: boolean; grid: boolean; gridOrigin: Point2D }): { point: Point2D; guide: SnapGuide | null } {
  const result = snapMove({ x: point.x, y: point.y, width: 0, height: 0 }, { x: 0, y: 0 }, targets, options);
  return { point: { x: point.x + result.delta.x, y: point.y + result.delta.y }, guide: result.guide };
}

/** Visual axis-aligned bounds for rotated text/images as well as vectors. */
function snapVisualBounds(node: VectorNode): BoundingBox {
  if (!node.rotation || canReflectVector(node)) return selectionNodeBounds(node);
  const { x, y, width, height } = node;
  const pivot = { x: x + width / 2, y: y + height / 2 };
  const angle = node.rotation * Math.PI / 180;
  const corners = [{x,y}, {x:x+width,y}, {x:x+width,y:y+height}, {x,y:y+height}].map(p => rotatePointAround(p, pivot, angle));
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
  return { x:minX, y:minY, width:maxX-minX, height:maxY-minY };
}

/** Aggregate the actual moving leaves, not stale group frames. */
export function movingSelectionBounds(nodes: Record<string, VectorNode>): BoundingBox | null {
  const boxes = Object.values(nodes)
    .filter(n => n.visible && !n.locked && !((n.type === 'group' || n.type === 'clipping-group' || n.type === 'blend') && n.children?.length))
    .map(snapVisualBounds);
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  const right = Math.max(...boxes.map(b => b.x + b.width)), bottom = Math.max(...boxes.map(b => b.y + b.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** Candidates represent visible document geometry, never the dragged subtree. */
export function collectSnapTargets(doc: StudioDocument, excludeIds: readonly string[], showGuides: boolean): SnapTargets {
  const excluded = new Set(excludeIds), targets: SnapTargets = { x: [], y: [] };
  const addBox = (box: BoundingBox, label: string) => {
    for (const value of [box.x, box.x + box.width / 2, box.x + box.width])
      targets.x.push({ value, from: box.y, to: box.y + box.height, label });
    for (const value of [box.y, box.y + box.height / 2, box.y + box.height])
      targets.y.push({ value, from: box.x, to: box.x + box.width, label });
  };
  for (const ab of doc.artboards) addBox(ab, 'artboard');
  const visible = (node: VectorNode) => {
    if (!node.visible || excluded.has(node.id) || doc.layers.find(l => l.id === node.layerId)?.visible === false) return false;
    const seen = new Set<string>();
    let parentId = node.parentId;
    while (parentId) {
      if (seen.has(parentId) || excluded.has(parentId)) return false;
      seen.add(parentId);
      const parent = doc.nodes[parentId];
      if (!parent || !parent.visible) return false;
      parentId = parent.parentId;
    }
    return true;
  };
  for (const node of Object.values(doc.nodes)) {
    if (!visible(node) || node.isGuide || ((node.type === 'group' || node.type === 'clipping-group' || node.type === 'blend') && node.children?.length)) continue;
    addBox(snapVisualBounds(node), 'bounds');
    const angle = (node.rotation || 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
    for (const pt of node.points || []) {
      const x = cx + (pt.x - cx) * c - (pt.y - cy) * s;
      const y = cy + (pt.x - cx) * s + (pt.y - cy) * c;
      targets.x.push({ value:x, from:y, to:y, label:'anchor' });
      targets.y.push({ value:y, from:x, to:x, label:'anchor' });
    }
  }
  if (showGuides) for (const guide of doc.guides || []) {
    const target = { value: guide.position, from: 0, to: 0, label: 'guide' };
    (guide.orientation === 'vertical' ? targets.x : targets.y).push(target);
  }
  return targets;
}

type AxisMatch = { correction: number; target: SnapTarget };
function nearest(sources: number[], targets: SnapTarget[], threshold: number): AxisMatch | undefined {
  let best: AxisMatch | undefined;
  for (const source of sources) for (const target of targets) {
    const correction = target.value - source;
    if (Math.abs(correction) <= threshold && (!best || Math.abs(correction) < Math.abs(best.correction) - 1e-9)) best = { correction, target };
  }
  return best;
}
function nearestGrid(sources: number[], origin: number, step: number): number {
  let best = Infinity;
  for (const source of sources) {
    const correction = origin + Math.round((source - origin) / step) * step - source;
    if (Math.abs(correction) < Math.abs(best)) best = correction;
  }
  return best;
}

/** Snap translated left/centre/right and top/centre/bottom independently. */
export function snapMove(bounds: BoundingBox, delta: Point2D, targets: SnapTargets, options: {
  zoom: number; smart: boolean; grid: boolean; gridOrigin: Point2D; axis?: 'x' | 'y' | 'both';
}): { delta: Point2D; guide: SnapGuide | null } {
  const zoom = Math.max(0.0001, options.zoom), threshold = 6 / zoom;
  const axis = options.axis || 'both';
  const xs = [bounds.x + delta.x, bounds.x + bounds.width / 2 + delta.x, bounds.x + bounds.width + delta.x];
  const ys = [bounds.y + delta.y, bounds.y + bounds.height / 2 + delta.y, bounds.y + bounds.height + delta.y];
  const mx = options.smart && axis !== 'y' ? nearest(xs, targets.x, threshold) : undefined;
  const my = options.smart && axis !== 'x' ? nearest(ys, targets.y, threshold) : undefined;
  const dx = delta.x + (mx?.correction ?? (options.grid && axis !== 'y' ? nearestGrid(xs, options.gridOrigin.x, 20) : 0));
  const dy = delta.y + (my?.correction ?? (options.grid && axis !== 'x' ? nearestGrid(ys, options.gridOrigin.y, 20) : 0));
  const margin = 12 / zoom;
  const guide: SnapGuide = {};
  if (mx) {
    const target = mx.target, top = bounds.y + dy, bottom = top + bounds.height;
    guide.x = target.value; guide.labelX = target.label;
    guide.lineX = { x:target.value, y1:Math.min(top, target.label === 'guide' ? top : target.from) - margin, y2:Math.max(bottom, target.label === 'guide' ? bottom : target.to) + margin };
  }
  if (my) {
    const target = my.target, left = bounds.x + dx, right = left + bounds.width;
    guide.y = target.value; guide.labelY = target.label;
    guide.lineY = { y:target.value, x1:Math.min(left, target.label === 'guide' ? left : target.from) - margin, x2:Math.max(right, target.label === 'guide' ? right : target.to) + margin };
  }
  return { delta: { x:dx, y:dy }, guide: mx || my ? guide : null };
}
