import clipping from 'polygon-clipping';
import type { Pair, Polygon, MultiPolygon } from 'polygon-clipping';
import type { AnchorPoint, BoundingBox, PathfinderOp, Point2D, VectorNode } from '../types';
import {
  computeAutoSmoothHandles,
  computeBoundingBoxFromAnchors,
  createEllipseAnchors,
  createLineAnchors,
  createPolygonAnchors,
  createRectangleAnchors,
  createStarAnchors,
  distance2D,
  generateNodeSvgPath,
  getVectorNodePathD,
  makeAnchorId,
  nodeToSvgPath,
  polygonToAnchors,
  samplePathToPolygon,
} from './bezier';

export { generateNodeSvgPath, nodeToSvgPath, getVectorNodePathD, polygonToAnchors };

/**
 * Extracts a dense closed 2D polygon from any VectorNode.
 */
export function nodeToPolygon(node: VectorNode, samplesPerCurve = 12): Point2D[] {
  let anchors: AnchorPoint[] = node.points && node.points.length > 0 ? node.points : [];
  if (anchors.length === 0) {
    switch (node.type) {
      case 'rectangle':
        anchors = createRectangleAnchors(
          node.x,
          node.y,
          node.width,
          node.height,
          node.cornerRadius ?? 0,
          node.cornerType ?? 'round'
        );
        break;
      case 'ellipse':
        anchors = createEllipseAnchors(node.x, node.y, node.width, node.height);
        break;
      case 'polygon':
        anchors = createPolygonAnchors(
          node.x,
          node.y,
          node.width,
          node.height,
          node.sides ?? 6,
          node.cornerRadius ?? 0
        );
        break;
      case 'star':
        anchors = createStarAnchors(
          node.x,
          node.y,
          node.width,
          node.height,
          node.sides ?? 5,
          node.innerRadius ?? 0.45,
          node.cornerRadius ?? 0
        );
        break;
      case 'line':
        anchors = createLineAnchors(node.x, node.y, node.x + node.width, node.y + node.height);
        break;
      default:
        anchors = createRectangleAnchors(node.x, node.y, node.width, node.height);
        break;
    }
  }
  const polygon = samplePathToPolygon(anchors, node.closed !== false, samplesPerCurve);
  if (!node.rotation) return polygon;
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  const angle = node.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return polygon.map(p => ({ x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos }));
}

/**
 * Signed area of a 2D polygon using the shoelace formula.
 */
export function polygonSignedArea(poly: Point2D[]): number {
  if (poly.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function ensureWinding(poly: Point2D[], clockwise = true): Point2D[] {
  if (poly.length < 3) return poly;
  const area = polygonSignedArea(poly);
  const isCW = area > 0;
  return isCW === clockwise ? [...poly] : [...poly].reverse();
}

/**
 * Ray-casting point-in-polygon check.
 */
export function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Computes exact intersection between two line segments [a1, a2] and [b1, b2].
 */
export function segmentIntersection(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D
): { point: Point2D; tA: number; tB: number } | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;

  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-9) return null;

  const tA = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  const tB = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom;

  if (tA >= -1e-6 && tA <= 1 + 1e-6 && tB >= -1e-6 && tB <= 1 + 1e-6) {
    return {
      point: {
        x: a1.x + dax * Math.max(0, Math.min(1, tA)),
        y: a1.y + day * Math.max(0, Math.min(1, tA)),
      },
      tA,
      tB,
    };
  }
  return null;
}

/**
 * Deduplicates consecutive nearly-identical vertices in a polygon.
 */
function cleanPolygon(poly: Point2D[], eps = 0.5): Point2D[] {
  if (poly.length < 2) return poly;
  const out: Point2D[] = [];
  for (const pt of poly) {
    if (out.length === 0 || distance2D(out[out.length - 1], pt) > eps) {
      out.push(pt);
    }
  }
  if (out.length > 2 && distance2D(out[0], out[out.length - 1]) <= eps) {
    out.pop();
  }
  return out;
}

/**
 * Subdivides two polygons at all mutual edge intersection points so every edge is either
 * strictly inside, strictly outside, or on the boundary of the other polygon.
 */
function subdividePolygonsAtIntersections(
  polyA: Point2D[],
  polyB: Point2D[]
): { subA: Point2D[]; subB: Point2D[]; intersections: Point2D[] } {
  const nA = polyA.length;
  const nB = polyB.length;
  const cutsA: { t: number; pt: Point2D }[][] = Array.from({ length: nA }, () => []);
  const cutsB: { t: number; pt: Point2D }[][] = Array.from({ length: nB }, () => []);
  const intersections: Point2D[] = [];

  for (let i = 0; i < nA; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % nA];
    for (let j = 0; j < nB; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % nB];
      const hit = segmentIntersection(a1, a2, b1, b2);
      if (hit) {
        cutsA[i].push({ t: hit.tA, pt: hit.point });
        cutsB[j].push({ t: hit.tB, pt: hit.point });
        intersections.push(hit.point);
      }
    }
  }

  const buildSub = (poly: Point2D[], cuts: { t: number; pt: Point2D }[][]): Point2D[] => {
    const res: Point2D[] = [];
    for (let i = 0; i < poly.length; i++) {
      res.push(poly[i]);
      const sorted = cuts[i].sort((x, y) => x.t - y.t);
      for (const c of sorted) {
        res.push(c.pt);
      }
    }
    return cleanPolygon(res, 0.25);
  };

  return {
    subA: buildSub(polyA, cutsA),
    subB: buildSub(polyB, cutsB),
    intersections,
  };
}

/**
 * Computes boolean polygon clipping between two closed polygons:
 * 'unite' | 'minus-front' | 'intersect' | 'exclude' | 'minus-back'
 */
export function booleanPairPolygons(
  rawA: Point2D[],
  rawB: Point2D[],
  mode: 'unite' | 'minus-front' | 'intersect' | 'exclude' | 'minus-back'
): Point2D[][] {
  const polyA = ensureWinding(cleanPolygon(rawA), true);
  const polyB = ensureWinding(cleanPolygon(rawB), true);
  if (polyA.length < 3) return [polyB];
  if (polyB.length < 3) return [polyA];

  if (mode === 'minus-back') {
    return booleanPairPolygons(polyB, polyA, 'minus-front');
  }

  const { subA, subB, intersections } = subdividePolygonsAtIntersections(polyA, polyB);

  // Check completely disjoint or completely contained cases
  if (intersections.length === 0) {
    const aInB = pointInPolygon(polyA[0], polyB);
    const bInA = pointInPolygon(polyB[0], polyA);

    switch (mode) {
      case 'unite':
        if (aInB) return [polyB];
        if (bInA) return [polyA];
        return [polyA, polyB];
      case 'intersect':
        if (aInB) return [polyA];
        if (bInA) return [polyB];
        return [];
      case 'minus-front':
        if (aInB) return [];
        if (bInA) return [polyA, [...polyB].reverse()];
        return [polyA];
      case 'exclude':
        if (aInB) return [polyB, [...polyA].reverse()];
        if (bInA) return [polyA, [...polyB].reverse()];
        return [polyA, polyB];
    }
  }

  // Filter boundary points according to boolean truth criteria
  if (mode === 'intersect') {
    const pts: Point2D[] = [];
    for (const p of subA) {
      if (pointInPolygon(p, polyB) || isNearAny(p, intersections, 1.5)) {
        pts.push(p);
      }
    }
    for (const p of subB) {
      if (pointInPolygon(p, polyA) || isNearAny(p, intersections, 1.5)) {
        pts.push(p);
      }
    }
    const ordered = orderPointsAroundCentroid(cleanPolygon(pts, 0.5));
    return ordered.length >= 3 ? [ordered] : [];
  }

  if (mode === 'unite') {
    const kept: Point2D[] = [];
    for (const p of subA) {
      if (!pointInPolygon(p, polyB) || isNearAny(p, intersections, 1.5)) {
        kept.push(p);
      }
    }
    for (const p of subB) {
      if (!pointInPolygon(p, polyA) || isNearAny(p, intersections, 1.5)) {
        kept.push(p);
      }
    }
    const ordered = orderBoundaryLoop(subA, subB, polyA, polyB, 'unite', intersections);
    return ordered.length >= 3 ? [ordered] : [orderPointsAroundCentroid(cleanPolygon(kept, 0.5))];
  }

  if (mode === 'minus-front') {
    const ordered = orderBoundaryLoop(subA, subB, polyA, polyB, 'minus-front', intersections);
    return ordered.length >= 3 ? [ordered] : [];
  }

  // 'exclude' returns both A\B and B\A (or both contours for even-odd compound path)
  const diffAB = booleanPairPolygons(polyA, polyB, 'minus-front');
  const diffBA = booleanPairPolygons(polyB, polyA, 'minus-front');
  return [...diffAB, ...diffBA];
}

function isNearAny(pt: Point2D, list: Point2D[], tol: number): boolean {
  for (const item of list) {
    if (distance2D(pt, item) <= tol) return true;
  }
  return false;
}

function orderPointsAroundCentroid(pts: Point2D[]): Point2D[] {
  if (pts.length < 3) return pts;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );
}

/**
 * Traces the boundary loop across subdivided polygons A and B for Unite and Minus-Front.
 */
function orderBoundaryLoop(
  subA: Point2D[],
  subB: Point2D[],
  polyA: Point2D[],
  polyB: Point2D[],
  mode: 'unite' | 'minus-front',
  intersections: Point2D[]
): Point2D[] {
  const bWalk = mode === 'minus-front' ? [...subB].reverse() : subB;

  // Start at a vertex of subA that is strictly outside polyB
  let startIdx = subA.findIndex((p) => !pointInPolygon(p, polyB) && !isNearAny(p, intersections, 1.0));
  if (startIdx === -1) startIdx = 0;

  const result: Point2D[] = [];
  let onA = true;
  let idx = startIdx;
  const maxSteps = (subA.length + bWalk.length) * 2 + 8;

  for (let step = 0; step < maxSteps; step++) {
    const currList = onA ? subA : bWalk;
    const pt = currList[idx % currList.length];

    if (result.length > 2 && distance2D(pt, result[0]) < 1.0 && step > 2) {
      break;
    }
    result.push(pt);

    const nextIdx = (idx + 1) % currList.length;
    const nextPt = currList[nextIdx];

    if (isNearAny(nextPt, intersections, 1.2)) {
      result.push(nextPt);
      // Switch to the other polygon at this intersection
      const otherList = onA ? bWalk : subA;
      let bestOtherIdx = 0;
      let bestDist = Infinity;
      for (let k = 0; k < otherList.length; k++) {
        const d = distance2D(otherList[k], nextPt);
        if (d < bestDist) {
          bestDist = d;
          bestOtherIdx = k;
        }
      }
      onA = !onA;
      idx = (bestOtherIdx + 1) % otherList.length;
    } else {
      idx = nextIdx;
    }
  }

  return cleanPolygon(result, 0.5);
}

/**
 * Converts a Point2D[] polygon into a complete VectorNode inheriting styles from templateNode.
 */
export function createNodeFromPolygon(
  poly: Point2D[],
  templateNode: VectorNode,
  nameSuffix: string,
  closed = true
): VectorNode {
  const anchors = polygonToAnchors(poly, closed);
  const bounds = computeBoundingBoxFromAnchors(anchors, closed);
  return {
    ...templateNode,
    id: makeAnchorId('node'),
    name: `${templateNode.name} (${nameSuffix})`,
    type: 'path',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    points: anchors,
    closed,
  };
}

/** Convert one closed vector object, including its inner contours, to clipping geometry. */
function nodeToClippingPolygon(node: VectorNode): Polygon {
  const contours: AnchorPoint[][] = [];
  for (const point of node.points || []) {
    if (!contours.length || point.moveTo) contours.push([]);
    contours[contours.length - 1].push(point);
  }
  const polys = contours.length > 1
    ? contours.map(points => nodeToPolygon({ ...node, points }, 14))
    : [nodeToPolygon(node, 14)];
  return polys.filter(poly => poly.length >= 3).map(poly => poly.map(p => [p.x, p.y] as Pair));
}

/** Preserve every island and every hole as real separate SVG subpaths. */
function clippingToNodes(geometry: MultiPolygon, template: VectorNode, suffix: string): VectorNode[] {
  return geometry.filter(poly => poly.length && poly[0].length >= 4).map(poly => {
    const anchors = poly.flatMap((ring, index) => {
      const coords = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
      const points = polygonToAnchors(coords, true);
      if (index && points.length) points[0].moveTo = true;
      return points;
    });
    const bounds = computeBoundingBoxFromAnchors(anchors, true);
    return { ...template, id: makeAnchorId('node'), name: `${template.name} (${suffix})`, type: 'path' as const,
      parentId: undefined, children: undefined, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      rotation: 0, points: anchors, closed: true, fillRule: 'evenodd' as const, cornerRadius: 0 };
  });
}

/** Boolean operations on filled closed shapes ordered back-to-front. Curves are sampled. */
export function performPathfinder(nodes: VectorNode[], op: PathfinderOp): VectorNode[] {
  if (!nodes || nodes.length < 2) return nodes;
  const shapes = nodes.map(nodeToClippingPolygon);
  if (shapes.some(shape => !shape.length || shape.some(ring => ring.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))))) {
    throw new Error('Pathfinder requires valid closed vector paths.');
  }
  const first = nodes[0], top = nodes[nodes.length - 1];
  switch (op) {
    case 'unite': return clippingToNodes(clipping.union(shapes[0], ...shapes.slice(1)), top, 'Unite');
    case 'minus-front': return clippingToNodes(clipping.difference(shapes[0], ...shapes.slice(1)), first, 'Minus Front');
    case 'minus-back': return clippingToNodes(clipping.difference(shapes[shapes.length - 1], ...shapes.slice(0, -1)), top, 'Minus Back');
    case 'intersect': return clippingToNodes(clipping.intersection(shapes[0], ...shapes.slice(1)), top, 'Intersect');
    case 'exclude': return clippingToNodes(clipping.xor(shapes[0], ...shapes.slice(1)), top, 'Exclude');
    case 'trim':
    case 'merge': {
      const visible = shapes.map((shape, i) => i === shapes.length - 1
        ? clipping.union(shape)
        : clipping.difference(shape, ...shapes.slice(i + 1)));
      if (op === 'trim') return visible.flatMap((geo, i) => clippingToNodes(geo, { ...nodes[i], strokes: [] }, 'Trim'));
      // Only merge simple opaque solid fills with identical appearance.
      const groups: { key: string; geometry: MultiPolygon; node: VectorNode }[] = [];
      visible.forEach((geo, i) => {
        const node = nodes[i];
        const key = JSON.stringify({ fills: node.fills.map(({ id, ...f }) => f), opacity: node.opacity, blendMode: node.blendMode });
        const existing = groups.find(group => group.key === key);
        if (existing) existing.geometry = clipping.union(existing.geometry, geo);
        else groups.push({ key, geometry: geo, node });
      });
      return groups.flatMap(group => clippingToNodes(group.geometry, { ...group.node, strokes: [] }, 'Merge'));
    }
    case 'divide': {
      let pieces: { geometry: MultiPolygon; node: VectorNode }[] = [];
      shapes.forEach((shape, i) => {
        let remainder = clipping.union(shape);
        const next: typeof pieces = [];
        for (const piece of pieces) {
          const overlap = clipping.intersection(piece.geometry, shape);
          const outside = clipping.difference(piece.geometry, shape);
          if (outside.length) next.push({ geometry: outside, node: piece.node });
          if (overlap.length) next.push({ geometry: overlap, node: nodes[i] });
          remainder = clipping.difference(remainder, piece.geometry);
        }
        if (remainder.length) next.push({ geometry: remainder, node: nodes[i] });
        pieces = next;
      });
      return pieces.flatMap(piece => clippingToNodes(piece.geometry, piece.node, 'Divide'));
    }
    case 'crop': return shapes.slice(0, -1).flatMap((shape, i) => clippingToNodes(clipping.intersection(shape, shapes[shapes.length - 1]), nodes[i], 'Crop'));
    case 'outline': return nodes.map(node => ({ ...node, id: makeAnchorId('node'), name: `${node.name} (Outline)`, fills: [],
      strokes: [{ id: makeAnchorId('st'), visible: true, color: node.fills[0]?.color || node.strokes[0]?.color || '#1473e6', weight: 1,
        cap: 'round' as const, join: 'round' as const, miterLimit: 4, align: 'center' as const, dashArray: [], opacity: 1, blendMode: 'normal' as const }] }));
  }
}

/**
 * Offsets a path inward or outward by `offset` points, supporting Miter, Round, and Bevel joins.
 */
export function offsetPathPoints(
  points: AnchorPoint[],
  closed: boolean,
  offset: number,
  joinType: 'miter' | 'round' | 'bevel' = 'miter',
  miterLimit = 4
): AnchorPoint[] {
  const poly = samplePathToPolygon(points, closed, 10);
  if (poly.length < 2) return points;

  const n = poly.length;
  const area = closed ? polygonSignedArea(poly) : 1;
  const sign = area >= 0 ? 1 : -1;
  const d = offset * sign;
  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const curr = poly[i];
    const next = poly[(i + 1) % n];

    const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };
    const l1 = Math.hypot(v1.x, v1.y) || 1;
    const l2 = Math.hypot(v2.x, v2.y) || 1;

    // Outward normals
    const n1 = { x: v1.y / l1, y: -v1.x / l1 };
    const n2 = { x: v2.y / l2, y: -v2.x / l2 };

    if (!closed && i === 0) {
      result.push({ x: curr.x + n2.x * d, y: curr.y + n2.y * d });
      continue;
    }
    if (!closed && i === n - 1) {
      result.push({ x: curr.x + n1.x * d, y: curr.y + n1.y * d });
      continue;
    }

    // Bisector normal
    const bx = n1.x + n2.x;
    const by = n1.y + n2.y;
    const bLen = Math.hypot(bx, by);
    if (bLen < 1e-4) {
      result.push({ x: curr.x + n1.x * d, y: curr.y + n1.y * d });
      continue;
    }
    const unitB = { x: bx / bLen, y: by / bLen };
    const dot = unitB.x * n1.x + unitB.y * n1.y;
    const miterScale = Math.min(miterLimit, 1 / Math.max(0.2, Math.abs(dot)));

    if (joinType === 'bevel' && miterScale > 1.35) {
      result.push({ x: curr.x + n1.x * d, y: curr.y + n1.y * d });
      result.push({ x: curr.x + n2.x * d, y: curr.y + n2.y * d });
    } else if (joinType === 'round' && miterScale > 1.25) {
      result.push({ x: curr.x + n1.x * d, y: curr.y + n1.y * d });
      result.push({ x: curr.x + unitB.x * d, y: curr.y + unitB.y * d });
      result.push({ x: curr.x + n2.x * d, y: curr.y + n2.y * d });
    } else {
      result.push({
        x: curr.x + unitB.x * d * miterScale,
        y: curr.y + unitB.y * d * miterScale,
      });
    }
  }

  return polygonToAnchors(result, closed);
}

/**
 * Creates a new offset VectorNode from an existing VectorNode.
 */
export function offsetVectorNode(
  node: VectorNode,
  offset: number,
  joinType: 'miter' | 'round' | 'bevel' = 'miter',
  miterLimit = 4
): VectorNode {
  const basePoly = nodeToPolygon(node, 10);
  const baseAnchors = polygonToAnchors(basePoly, node.closed);
  const offsetAnchors = offsetPathPoints(baseAnchors, node.closed, offset, joinType, miterLimit);
  const bounds = computeBoundingBoxFromAnchors(offsetAnchors, node.closed);

  return {
    ...node,
    id: makeAnchorId('offset'),
    name: `${node.name} (Offset ${offset}pt)`,
    type: 'path',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    points: offsetAnchors,
  };
}

/**
 * Ramer-Douglas-Peucker polyline simplification + auto-smooth Bezier fitting.
 */
export function simplifyPathPoints(
  points: AnchorPoint[],
  closed: boolean,
  curvePrecisionPercent = 75,
  angleThresholdDeg = 35
): AnchorPoint[] {
  if (points.length <= 3) return points;
  const epsilon = Math.max(0.5, ((100 - curvePrecisionPercent) / 100) * 18);

  const rdp = (pts: AnchorPoint[], tol: number): AnchorPoint[] => {
    if (pts.length <= 2) return pts;
    let maxDist = 0;
    let index = 0;
    const start = pts[0];
    const end = pts[pts.length - 1];

    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpendicularDistance(pts[i], start, end);
      if (d > maxDist) {
        index = i;
        maxDist = d;
      }
    }

    if (maxDist > tol) {
      const left = rdp(pts.slice(0, index + 1), tol);
      const right = rdp(pts.slice(index), tol);
      return [...left.slice(0, -1), ...right];
    }
    return [start, end];
  };

  const simplified = rdp(points, epsilon);
  const radThresh = (angleThresholdDeg * Math.PI) / 180;

  // Classify smooth vs corner points based on turning angle
  const classified: AnchorPoint[] = simplified.map((pt, i) => {
    const prev = simplified[(i - 1 + simplified.length) % simplified.length];
    const next = simplified[(i + 1) % simplified.length];
    const a1 = Math.atan2(pt.y - prev.y, pt.x - prev.x);
    const a2 = Math.atan2(next.y - pt.y, next.x - pt.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    return {
      ...pt,
      pointType: diff > radThresh ? ('corner' as const) : ('smooth' as const),
    };
  });

  return computeAutoSmoothHandles(classified, closed, 0.26);
}

function perpendicularDistance(pt: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return distance2D(pt, lineStart);
  return Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

/**
 * Converts a VectorNode's stroke into a closed filled outline VectorNode (Object > Path > Outline Stroke).
 */
export function outlineStrokeNode(node: VectorNode): VectorNode {
  const primaryStroke = node.strokes.find((s) => s.visible && s.weight > 0) ?? node.strokes[0];
  const halfW = Math.max(1, (primaryStroke?.weight ?? 2) / 2);
  const strokeColor = primaryStroke?.color && primaryStroke.color !== 'none'
    ? primaryStroke.color
    : '#000000';

  const basePoly = nodeToPolygon(node, 10);
  const baseAnchors = polygonToAnchors(basePoly, node.closed);

  let finalAnchors: AnchorPoint[];
  if (node.closed) {
    const outer = offsetPathPoints(baseAnchors, true, halfW, primaryStroke?.join ?? 'miter');
    const inner = offsetPathPoints(baseAnchors, true, -halfW, primaryStroke?.join ?? 'miter').reverse();
    finalAnchors = [...outer, ...inner];
  } else {
    const sideA = offsetPathPoints(baseAnchors, false, halfW, primaryStroke?.join ?? 'miter');
    const sideB = offsetPathPoints(baseAnchors, false, -halfW, primaryStroke?.join ?? 'miter').reverse();
    finalAnchors = [...sideA, ...sideB];
  }

  const bounds = computeBoundingBoxFromAnchors(finalAnchors, true);
  return {
    ...node,
    id: makeAnchorId('ostroke'),
    name: `${node.name} (Outlined Stroke)`,
    type: 'path',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    points: finalAnchors,
    closed: true,
    fillRule: 'evenodd',
    fills: [
      {
        id: makeAnchorId('fill'),
        visible: true,
        type: 'solid',
        color: strokeColor,
        opacity: primaryStroke?.opacity ?? 1,
        blendMode: primaryStroke?.blendMode ?? 'normal',
      },
    ],
    strokes: [],
  };
}

/**
 * Splits a VectorNode's bounding rectangle into a grid of rows x columns with horizontal & vertical gutters
 * (Object > Path > Split Into Grid...).
 */
export function splitIntoGridNodes(
  node: VectorNode,
  options: { rows: number; cols: number; gutterH: number; gutterV: number }
): VectorNode[] {
  const rows = Math.max(1, Math.min(50, Math.round(options.rows)));
  const cols = Math.max(1, Math.min(50, Math.round(options.cols)));
  const gutterH = Math.max(0, options.gutterH);
  const gutterV = Math.max(0, options.gutterV);

  const cellW = Math.max(4, (node.width - gutterH * (cols - 1)) / cols);
  const cellH = Math.max(4, (node.height - gutterV * (rows - 1)) / rows);

  const cells: VectorNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = node.x + c * (cellW + gutterH);
      const cy = node.y + r * (cellH + gutterV);
      const pts = createRectangleAnchors(
        cx,
        cy,
        cellW,
        cellH,
        node.cornerRadius ?? 0,
        node.cornerType ?? 'round'
      );
      cells.push({
        ...node,
        id: makeAnchorId(`grid-${r}-${c}`),
        name: `${node.name} [${r + 1},${c + 1}]`,
        type: 'rectangle',
        x: cx,
        y: cy,
        width: cellW,
        height: cellH,
        points: pts,
        closed: true,
      });
    }
  }
  return cells;
}

/**
 * Computes paintable planar faces from a set of VectorNodes for Live Paint Group & Shape Builder Tool.
 */
export function computeLivePaintFaces(
  nodes: VectorNode[]
): { id: string; points: Point2D[]; color: string }[] {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) {
    return [
      {
        id: makeAnchorId('lpface'),
        points: nodeToPolygon(nodes[0], 10),
        color: nodes[0].fills[0]?.color || '#ffffff',
      },
    ];
  }

  const divided = performPathfinder(nodes, 'divide');
  return divided.map((n, idx) => ({
    id: makeAnchorId(`lpface-${idx}`),
    points: nodeToPolygon(n, 8),
    color: n.fills[0]?.color || '#cccccc',
  }));
}
