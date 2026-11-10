import type { AnchorPoint, BoundingBox, LiveEffectItem, Point2D, VectorNode } from '../types';

const KAPPA = 0.5522847498307936; // 4 * (sqrt(2) - 1) / 3

let idCounter = 1;
export function makeAnchorId(prefix = 'pt'): string {
  return `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

export function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerp2D(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Evaluates a cubic Bezier curve at parameter t in [0, 1].
 */
export function evaluateCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t * t2;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/**
 * Evaluates first derivative (tangent vector) of cubic Bezier at t in [0, 1].
 */
export function cubicBezierTangent(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const mt = 1 - t;
  const a = 3 * mt * mt;
  const b = 6 * mt * t;
  const c = 3 * t * t;
  const dx = a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x);
  const dy = a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Evaluates unit normal vector perpendicular to the cubic Bezier at t in [0, 1].
 */
export function cubicBezierNormal(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const tan = cubicBezierTangent(p0, p1, p2, p3, t);
  return { x: -tan.y, y: tan.x };
}

/**
 * Subdivides a cubic Bezier curve at parameter t using De Casteljau's algorithm.
 */
export function splitCubicBezier(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): {
  left: [Point2D, Point2D, Point2D, Point2D];
  right: [Point2D, Point2D, Point2D, Point2D];
} {
  const p01 = lerp2D(p0, p1, t);
  const p12 = lerp2D(p1, p2, t);
  const p23 = lerp2D(p2, p3, t);
  const p012 = lerp2D(p01, p12, t);
  const p123 = lerp2D(p12, p23, t);
  const p0123 = lerp2D(p012, p123, t);
  return {
    left: [p0, p01, p012, p0123],
    right: [p0123, p123, p23, p3],
  };
}

/**
 * Creates AnchorPoint[] for a rectangle.
 */
export function createRectangleAnchors(
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius = 0,
  cornerType: 'round' | 'inverted' | 'chamfer' = 'round'
): AnchorPoint[] {
  return [
    { id: makeAnchorId('rect'), x, y, pointType: 'corner', cornerRadius, cornerType },
    { id: makeAnchorId('rect'), x: x + width, y, pointType: 'corner', cornerRadius, cornerType },
    { id: makeAnchorId('rect'), x: x + width, y: y + height, pointType: 'corner', cornerRadius, cornerType },
    { id: makeAnchorId('rect'), x, y: y + height, pointType: 'corner', cornerRadius, cornerType },
  ];
}

/**
 * Creates 4 smooth cubic Bezier AnchorPoint[] for an ellipse.
 */
export function createEllipseAnchors(
  x: number,
  y: number,
  width: number,
  height: number
): AnchorPoint[] {
  const rx = width / 2;
  const ry = height / 2;
  const cx = x + rx;
  const cy = y + ry;
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;

  return [
    {
      id: makeAnchorId('el'),
      x: cx,
      y,
      handleIn: { x: cx - ox, y },
      handleOut: { x: cx + ox, y },
      pointType: 'smooth',
    },
    {
      id: makeAnchorId('el'),
      x: x + width,
      y: cy,
      handleIn: { x: x + width, y: cy - oy },
      handleOut: { x: x + width, y: cy + oy },
      pointType: 'smooth',
    },
    {
      id: makeAnchorId('el'),
      x: cx,
      y: y + height,
      handleIn: { x: cx + ox, y: y + height },
      handleOut: { x: cx - ox, y: y + height },
      pointType: 'smooth',
    },
    {
      id: makeAnchorId('el'),
      x,
      y: cy,
      handleIn: { x, y: cy + oy },
      handleOut: { x, y: cy - oy },
      pointType: 'smooth',
    },
  ];
}

/**
 * Creates AnchorPoint[] for a regular polygon inside bounding box.
 */
export function createPolygonAnchors(
  x: number,
  y: number,
  width: number,
  height: number,
  sides = 6,
  cornerRadius = 0
): AnchorPoint[] {
  const count = Math.max(3, Math.round(sides));
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const pts: AnchorPoint[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
    pts.push({
      id: makeAnchorId('poly'),
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
      pointType: 'corner',
      cornerRadius,
      cornerType: 'round',
    });
  }
  return pts;
}

/**
 * Creates AnchorPoint[] for a star shape inside bounding box.
 */
export function createStarAnchors(
  x: number,
  y: number,
  width: number,
  height: number,
  points = 5,
  innerRatio = 0.45,
  cornerRadius = 0
): AnchorPoint[] {
  const count = Math.max(3, Math.round(points));
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const ratio = Math.max(0.08, Math.min(0.95, innerRatio));
  const pts: AnchorPoint[] = [];

  for (let i = 0; i < count * 2; i++) {
    const isOuter = i % 2 === 0;
    const rFactor = isOuter ? 1 : ratio;
    const angle = (i * Math.PI) / count - Math.PI / 2;
    pts.push({
      id: makeAnchorId('star'),
      x: cx + rx * rFactor * Math.cos(angle),
      y: cy + ry * rFactor * Math.sin(angle),
      pointType: 'corner',
      cornerRadius: isOuter ? cornerRadius : 0,
      cornerType: 'round',
    });
  }
  return pts;
}

/**
 * Creates AnchorPoint[] for a line segment.
 */
export function createLineAnchors(x1: number, y1: number, x2: number, y2: number): AnchorPoint[] {
  return [
    { id: makeAnchorId('ln'), x: x1, y: y1, pointType: 'corner' },
    { id: makeAnchorId('ln'), x: x2, y: y2, pointType: 'corner' },
  ];
}

/**
 * Creates AnchorPoint[] for an Archimedean/Logarithmic spiral.
 */
export function createSpiralAnchors(
  cx: number,
  cy: number,
  radius: number,
  segments = 12,
  decay = 0.82
): AnchorPoint[] {
  const pts: AnchorPoint[] = [];
  let r = Math.max(4, radius);
  for (let i = 0; i <= segments; i++) {
    const angle = (i * Math.PI) / 2;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    const tangentLen = r * 0.55;
    const tx = -Math.sin(angle) * tangentLen;
    const ty = Math.cos(angle) * tangentLen;
    pts.push({
      id: makeAnchorId('sp'),
      x: px,
      y: py,
      handleIn: { x: px - tx * 0.9, y: py - ty * 0.9 },
      handleOut: { x: px + tx * 0.9, y: py + ty * 0.9 },
      pointType: 'smooth',
    });
    r *= Math.pow(decay, 0.25);
  }
  return pts;
}

/**
 * Creates AnchorPoint[] for a circular/elliptical arc.
 */
export function createArcAnchors(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  slope = 0.5
): AnchorPoint[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const k = KAPPA * (0.5 + slope * 0.5);
  return [
    {
      id: makeAnchorId('arc'),
      x: x1,
      y: y1,
      handleOut: { x: x1 + dx * k, y: y1 },
      pointType: 'smooth',
    },
    {
      id: makeAnchorId('arc'),
      x: x2,
      y: y2,
      handleIn: { x: x2, y: y2 - dy * k },
      pointType: 'smooth',
    },
  ];
}

/**
 * Computes Catmull-Rom / Hobby auto-smooth Bezier handles for Curvature Tool & Smooth Tool.
 */
export function computeAutoSmoothHandles(
  points: AnchorPoint[],
  closed: boolean,
  tension = 0.3
): AnchorPoint[] {
  if (points.length < 2) return points;
  const n = points.length;
  return points.map((pt, i) => {
    if (pt.pointType === 'corner') {
      return { ...pt, handleIn: undefined, handleOut: undefined };
    }
    const prevIdx = i === 0 ? (closed ? n - 1 : 0) : i - 1;
    const nextIdx = i === n - 1 ? (closed ? 0 : n - 1) : i + 1;
    const prev = points[prevIdx];
    const next = points[nextIdx];

    const tx = (next.x - prev.x) * tension;
    const ty = (next.y - prev.y) * tension;

    return {
      ...pt,
      handleIn: !closed && i === 0 ? undefined : { x: pt.x - tx, y: pt.y - ty },
      handleOut: !closed && i === n - 1 ? undefined : { x: pt.x + tx, y: pt.y + ty },
    };
  });
}

/**
 * Smooths a sequence of anchor points (Smooth Tool / Pencil fidelity).
 */
export function smoothAnchorPoints(
  points: AnchorPoint[],
  closed: boolean,
  fidelity = 0.5
): AnchorPoint[] {
  if (points.length < 3) return points;
  const n = points.length;
  const smoothed = points.map((pt, i) => {
    if (!closed && (i === 0 || i === n - 1)) return { ...pt };
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const avgX = (prev.x + pt.x * 2 + next.x) / 4;
    const avgY = (prev.y + pt.y * 2 + next.y) / 4;
    return {
      ...pt,
      x: pt.x + (avgX - pt.x) * fidelity,
      y: pt.y + (avgY - pt.y) * fidelity,
      pointType: 'smooth' as const,
    };
  });
  return computeAutoSmoothHandles(smoothed, closed, 0.28);
}

/**
 * Finds the nearest point on a Bezier path to a target coordinate.
 */
export function nearestPointOnPath(
  points: AnchorPoint[],
  closed: boolean,
  target: Point2D,
  samplesPerSegment = 24
): { segmentIndex: number; t: number; point: Point2D; distance: number } | null {
  if (points.length < 2) return null;
  const segCount = closed ? points.length : points.length - 1;
  let best = {
    segmentIndex: 0,
    t: 0,
    point: { x: points[0].x, y: points[0].y },
    distance: Infinity,
  };

  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const p0 = { x: a.x, y: a.y };
    const p1 = a.handleOut ?? p0;
    const p2 = b.handleIn ?? { x: b.x, y: b.y };
    const p3 = { x: b.x, y: b.y };

    for (let s = 0; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const pt = evaluateCubicBezier(p0, p1, p2, p3, t);
      const d = distance2D(pt, target);
      if (d < best.distance) {
        best = { segmentIndex: i, t, point: pt, distance: d };
      }
    }
  }
  return best;
}

/**
 * Inserts a new AnchorPoint along segment `segmentIndex` at parameter `t` using De Casteljau split.
 */
export function insertAnchorOnPath(
  points: AnchorPoint[],
  closed: boolean,
  segmentIndex: number,
  t: number
): AnchorPoint[] {
  if (points.length < 2) return points;
  const clampedT = Math.max(0.05, Math.min(0.95, t));
  const nextIndex = (segmentIndex + 1) % points.length;
  const a = points[segmentIndex];
  const b = points[nextIndex];
  const p0 = { x: a.x, y: a.y };
  const p1 = a.handleOut ?? p0;
  const p2 = b.handleIn ?? { x: b.x, y: b.y };
  const p3 = { x: b.x, y: b.y };

  const { left, right } = splitCubicBezier(p0, p1, p2, p3, clampedT);
  const newAnchor: AnchorPoint = {
    id: makeAnchorId('add'),
    x: left[3].x,
    y: left[3].y,
    handleIn: left[2],
    handleOut: right[1],
    pointType: 'smooth',
  };

  const result = points.map((p) => ({ ...p }));
  result[segmentIndex] = { ...a, handleOut: left[1] };
  result[nextIndex] = { ...b, handleIn: right[2] };
  result.splice(segmentIndex + 1, 0, newAnchor);
  return result;
}

/**
 * Splits a path at a specific anchor index (used by Scissors Tool `C`).
 */
export function splitPathAtAnchor(
  points: AnchorPoint[],
  closed: boolean,
  anchorIndex: number
): { pathA: AnchorPoint[]; pathB?: AnchorPoint[] } {
  if (points.length < 2 || anchorIndex < 0 || anchorIndex >= points.length) {
    return { pathA: points };
  }
  if (closed) {
    // Opening a closed path at anchorIndex produces a single open path starting & ending at anchorIndex
    const rotated: AnchorPoint[] = [];
    for (let i = 0; i <= points.length; i++) {
      const src = points[(anchorIndex + i) % points.length];
      rotated.push({
        ...src,
        id: i === points.length ? makeAnchorId('cut') : src.id,
      });
    }
    return { pathA: rotated };
  } else {
    if (anchorIndex === 0 || anchorIndex === points.length - 1) {
      return { pathA: points };
    }
    const pathA = points.slice(0, anchorIndex + 1).map((p) => ({ ...p }));
    const pathB = points.slice(anchorIndex).map((p, idx) => ({
      ...p,
      id: idx === 0 ? makeAnchorId('cut') : p.id,
    }));
    return { pathA, pathB };
  }
}

/**
 * Computes tight bounding box of AnchorPoint array (including Bezier handles sampling).
 */
export function computeBoundingBoxFromAnchors(
  points: AnchorPoint[],
  closed = true
): BoundingBox {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (p: Point2D) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };

  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, width: 1, height: 1 };
  }

  const segCount = closed ? points.length : points.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const hasHandles = Boolean(a.handleOut || b.handleIn);
    if (!hasHandles) {
      include(a);
      include(b);
    } else {
      const p0 = { x: a.x, y: a.y };
      const p1 = a.handleOut ?? p0;
      const p2 = b.handleIn ?? { x: b.x, y: b.y };
      const p3 = { x: b.x, y: b.y };
      for (let s = 0; s <= 12; s++) {
        include(evaluateCubicBezier(p0, p1, p2, p3, s / 12));
      }
    }
  }

  return {
    x: Number.isFinite(minX) ? minX : 0,
    y: Number.isFinite(minY) ? minY : 0,
    width: Math.max(1, Number.isFinite(maxX - minX) ? maxX - minX : 1),
    height: Math.max(1, Number.isFinite(maxY - minY) ? maxY - minY : 1),
  };
}

/**
 * Samples a Bezier path into a dense polygon of Point2D vertices (for Pathfinder boolean geometry).
 */
export function samplePathToPolygon(
  points: AnchorPoint[],
  closed: boolean,
  samplesPerCurve = 12
): Point2D[] {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return [{ x: points[0].x, y: points[0].y }];

  const poly: Point2D[] = [];
  const segCount = closed ? points.length : points.length - 1;

  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const hasCurve =
      (a.handleOut && (a.handleOut.x !== a.x || a.handleOut.y !== a.y)) ||
      (b.handleIn && (b.handleIn.x !== b.x || b.handleIn.y !== b.y));

    if (!hasCurve) {
      poly.push({ x: a.x, y: a.y });
    } else {
      const p0 = { x: a.x, y: a.y };
      const p1 = a.handleOut ?? p0;
      const p2 = b.handleIn ?? { x: b.x, y: b.y };
      const p3 = { x: b.x, y: b.y };
      for (let s = 0; s < samplesPerCurve; s++) {
        poly.push(evaluateCubicBezier(p0, p1, p2, p3, s / samplesPerCurve));
      }
    }
  }

  if (!closed && points.length > 1) {
    const last = points[points.length - 1];
    poly.push({ x: last.x, y: last.y });
  }

  return poly;
}

/**
 * Converts a Point2D polygon back into AnchorPoint[].
 */
export function polygonToAnchors(poly: Point2D[], closed = true): AnchorPoint[] {
  return poly.map((p) => ({
    id: makeAnchorId('bp'),
    x: Math.round(p.x * 100) / 100,
    y: Math.round(p.y * 100) / 100,
    pointType: 'corner' as const,
  }));
}

/**
 * Builds an SVG `d` string from AnchorPoint[], supporting Live Corners (`round`, `inverted`, `chamfer`).
 */
export function anchorsToSvgPath(
  points: AnchorPoint[],
  closed: boolean,
  defaultCornerRadius = 0,
  defaultCornerType: 'round' | 'inverted' | 'chamfer' = 'round'
): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${fmt(p.x)} ${fmt(p.y)}`;
  }

  const n = points.length;
  const hasAnyLiveCorner = points.some(
    (p) =>
      p.pointType === 'corner' &&
      !p.handleIn &&
      !p.handleOut &&
      ((p.cornerRadius ?? defaultCornerRadius) > 0)
  );

  if (!hasAnyLiveCorner) {
    const cmds: string[] = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];
    const segCount = closed ? n : n - 1;
    for (let i = 0; i < segCount; i++) {
      const curr = points[i];
      const next = points[(i + 1) % n];
      const hasOut = curr.handleOut && (curr.handleOut.x !== curr.x || curr.handleOut.y !== curr.y);
      const hasIn = next.handleIn && (next.handleIn.x !== next.x || next.handleIn.y !== next.y);
      if (hasOut || hasIn) {
        const c1 = curr.handleOut ?? { x: curr.x, y: curr.y };
        const c2 = next.handleIn ?? { x: next.x, y: next.y };
        cmds.push(
          `C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(next.x)} ${fmt(next.y)}`
        );
      } else {
        cmds.push(`L ${fmt(next.x)} ${fmt(next.y)}`);
      }
    }
    if (closed) cmds.push('Z');
    return cmds.join(' ');
  }

  // Live corner widget rendering for corner vertices
  const cmds: string[] = [];
  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const isEndpoint = !closed && (i === 0 || i === n - 1);
    const rReq = curr.cornerRadius ?? defaultCornerRadius;
    const cType = curr.cornerType ?? defaultCornerType;

    if (
      !isEndpoint &&
      rReq > 0 &&
      curr.pointType === 'corner' &&
      !curr.handleIn &&
      !curr.handleOut
    ) {
      const vPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
      const vNext = { x: next.x - curr.x, y: next.y - curr.y };
      const lenPrev = Math.hypot(vPrev.x, vPrev.y);
      const lenNext = Math.hypot(vNext.x, vNext.y);
      const maxR = Math.min(lenPrev, lenNext) * 0.48;
      const r = Math.min(rReq, maxR);

      if (r > 0.25 && lenPrev > 0.5 && lenNext > 0.5) {
        const pStart = {
          x: curr.x + (vPrev.x / lenPrev) * r,
          y: curr.y + (vPrev.y / lenPrev) * r,
        };
        const pEnd = {
          x: curr.x + (vNext.x / lenNext) * r,
          y: curr.y + (vNext.y / lenNext) * r,
        };

        cmds.push(`${i === 0 ? 'M' : 'L'} ${fmt(pStart.x)} ${fmt(pStart.y)}`);
        if (cType === 'chamfer') {
          cmds.push(`L ${fmt(pEnd.x)} ${fmt(pEnd.y)}`);
        } else if (cType === 'inverted') {
          const mid = {
            x: curr.x + ((vPrev.x / lenPrev + vNext.x / lenNext) * r) * 0.85,
            y: curr.y + ((vPrev.y / lenPrev + vNext.y / lenNext) * r) * 0.85,
          };
          cmds.push(`Q ${fmt(mid.x)} ${fmt(mid.y)}, ${fmt(pEnd.x)} ${fmt(pEnd.y)}`);
        } else {
          cmds.push(`Q ${fmt(curr.x)} ${fmt(curr.y)}, ${fmt(pEnd.x)} ${fmt(pEnd.y)}`);
        }
        continue;
      }
    }

    if (i === 0) {
      cmds.push(`M ${fmt(curr.x)} ${fmt(curr.y)}`);
    } else {
      const prevPt = points[i - 1];
      const hasOut =
        prevPt.handleOut && (prevPt.handleOut.x !== prevPt.x || prevPt.handleOut.y !== prevPt.y);
      const hasIn = curr.handleIn && (curr.handleIn.x !== curr.x || curr.handleIn.y !== curr.y);
      if (hasOut || hasIn) {
        const c1 = prevPt.handleOut ?? { x: prevPt.x, y: prevPt.y };
        const c2 = curr.handleIn ?? { x: curr.x, y: curr.y };
        cmds.push(
          `C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(curr.x)} ${fmt(curr.y)}`
        );
      } else {
        cmds.push(`L ${fmt(curr.x)} ${fmt(curr.y)}`);
      }
    }
  }

  if (closed) cmds.push('Z');
  return cmds.join(' ');
}

/**
 * Applies Live Vector Geometry Effects (Zig Zag, Roughen, Pucker & Bloat, Twist, Tweak, Round Corners, Warp)
 * non-destructively to anchor points before SVG path serialization.
 */
export function applyLiveGeometryEffects(
  basePoints: AnchorPoint[],
  closed: boolean,
  effects: LiveEffectItem[],
  bounds: BoundingBox
): { points: AnchorPoint[]; closed: boolean; extraCornerRadius: number } {
  let pts: AnchorPoint[] = basePoints.map((p) => ({
    ...p,
    handleIn: p.handleIn ? { ...p.handleIn } : undefined,
    handleOut: p.handleOut ? { ...p.handleOut } : undefined,
  }));
  let extraCornerRadius = 0;

  if (!effects || effects.length === 0 || pts.length < 2) {
    return { points: pts, closed, extraCornerRadius };
  }

  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;

  for (const fx of effects) {
    if (!fx.enabled) continue;
    const p = fx.params || {};

    switch (fx.type) {
      case 'round-corners': {
        extraCornerRadius = Math.max(extraCornerRadius, Number(p.radius ?? 12));
        break;
      }
      case 'pucker-bloat': {
        const amount = Number(p.amount ?? 25) / 100; // -1 to +1
        const nextPts: AnchorPoint[] = [];
        const segCount = closed ? pts.length : pts.length - 1;
        for (let i = 0; i < segCount; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const pullAnchorX = a.x + (cx - a.x) * (-amount * 0.55);
          const pullAnchorY = a.y + (cy - a.y) * (-amount * 0.55);
          const ctrlX = midX + (cx - midX) * (amount * 0.85);
          const ctrlY = midY + (cy - midY) * (amount * 0.85);
          nextPts.push({
            ...a,
            x: pullAnchorX,
            y: pullAnchorY,
            handleOut: { x: ctrlX, y: ctrlY },
            handleIn: { x: ctrlX, y: ctrlY },
            pointType: 'smooth',
          });
        }
        if (nextPts.length >= 2) pts = nextPts;
        break;
      }
      case 'zig-zag': {
        const size = Number(p.size ?? 8);
        const ridges = Math.max(1, Math.min(24, Number(p.ridgesPerSegment ?? 4)));
        const smooth = p.points === 'smooth';
        const zigPts: AnchorPoint[] = [];
        const segCount = closed ? pts.length : pts.length - 1;

        for (let i = 0; i < segCount; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const steps = ridges * 2;
          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            const bx = a.x + dx * t;
            const by = a.y + dy * t;
            const sign = s % 2 === 0 ? 1 : -1;
            zigPts.push({
              id: `${a.id}-zz-${s}`,
              x: bx + nx * size * sign * 0.5,
              y: by + ny * size * sign * 0.5,
              pointType: smooth ? 'smooth' : 'corner',
            });
          }
        }
        pts = smooth ? computeAutoSmoothHandles(zigPts, closed, 0.25) : zigPts;
        break;
      }
      case 'roughen': {
        const size = Number(p.size ?? 5);
        const detail = Math.max(1, Math.min(16, Number(p.detail ?? 4)));
        const roughPts: AnchorPoint[] = [];
        const segCount = closed ? pts.length : pts.length - 1;

        for (let i = 0; i < segCount; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          for (let s = 0; s < detail; s++) {
            const t = s / detail;
            const seed = (i * 31 + s * 17) % 97;
            const jx = Math.sin(seed * 1.7) * size;
            const jy = Math.cos(seed * 2.3) * size;
            roughPts.push({
              id: `${a.id}-rg-${s}`,
              x: a.x + (b.x - a.x) * t + jx,
              y: a.y + (b.y - a.y) * t + jy,
              pointType: p.points === 'smooth' ? 'smooth' : 'corner',
            });
          }
        }
        pts = p.points === 'smooth' ? computeAutoSmoothHandles(roughPts, closed, 0.22) : roughPts;
        break;
      }
      case 'twist': {
        const angleDeg = Number(p.angle ?? 45);
        const maxR = Math.hypot(bounds.width, bounds.height) / 2 || 1;
        pts = pts.map((pt) => {
          const dist = Math.hypot(pt.x - cx, pt.y - cy);
          const falloff = Math.max(0, 1 - dist / maxR);
          const rad = ((angleDeg * falloff) * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rot = (p0: Point2D) => ({
            x: cx + (p0.x - cx) * cos - (p0.y - cy) * sin,
            y: cy + (p0.x - cx) * sin + (p0.y - cy) * cos,
          });
          const np = rot(pt);
          return {
            ...pt,
            x: np.x,
            y: np.y,
            handleIn: pt.handleIn ? rot(pt.handleIn) : undefined,
            handleOut: pt.handleOut ? rot(pt.handleOut) : undefined,
          };
        });
        break;
      }
      case 'tweak': {
        const hAmt = Number(p.horizontal ?? 8);
        const vAmt = Number(p.vertical ?? 8);
        pts = pts.map((pt, idx) => ({
          ...pt,
          x: pt.x + Math.sin(idx * 2.1) * hAmt,
          y: pt.y + Math.cos(idx * 1.7) * vAmt,
        }));
        break;
      }
      case 'warp': {
        pts = applyEnvelopeDistortToPoints(pts, bounds, {
          mode: 'warp',
          warpStyle: String(p.style ?? 'arc'),
          bend: Number(p.bend ?? 35),
          hDistort: Number(p.hDistort ?? 0),
          vDistort: Number(p.vDistort ?? 0),
        });
        break;
      }
      default:
        break;
    }
  }

  return { points: pts, closed, extraCornerRadius };
}

/**
 * Applies Envelope Distort (15 Illustrator Warp styles + Mesh/Bend) to AnchorPoint[].
 */
export function applyEnvelopeDistortToPoints(
  points: AnchorPoint[],
  bounds: BoundingBox,
  spec: NonNullable<VectorNode['envelopeSpec']>
): AnchorPoint[] {
  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const bend = (spec.bend ?? 40) / 100; // -1 to 1
  const hDist = (spec.hDistort ?? 0) / 100;
  const vDist = (spec.vDistort ?? 0) / 100;
  const style = (spec.warpStyle ?? 'arc').toLowerCase();

  const warpPoint = (pt: Point2D): Point2D => {
    // Normalized coordinates u, v in [-1, 1]
    const u = ((pt.x - bounds.x) / w) * 2 - 1;
    const v = ((pt.y - bounds.y) / h) * 2 - 1;
    let dx = 0;
    let dy = 0;

    switch (style) {
      case 'arc':
      case 'arch':
        dy = -(1 - u * u) * bend * h * 0.45;
        break;
      case 'arc-lower':
        dy = v > 0 ? (1 - u * u) * bend * h * 0.45 : 0;
        break;
      case 'arc-upper':
        dy = v < 0 ? -(1 - u * u) * bend * h * 0.45 : 0;
        break;
      case 'bulge':
      case 'inflate':
        dx = u * (1 - v * v) * bend * w * 0.28;
        dy = v * (1 - u * u) * bend * h * 0.28;
        break;
      case 'squeeze':
        dx = -u * (1 - v * v) * bend * w * 0.28;
        dy = v * (1 - u * u) * bend * h * 0.22;
        break;
      case 'flag':
      case 'wave':
        dy = Math.sin(u * Math.PI) * bend * h * 0.35;
        break;
      case 'fish':
        dy = v * Math.sin(u * Math.PI) * bend * h * 0.35;
        break;
      case 'rise':
        dy = -u * bend * h * 0.35;
        break;
      case 'fisheye': {
        const r2 = u * u + v * v;
        const factor = (1 - Math.min(1, r2)) * bend * 0.45;
        dx = u * factor * w;
        dy = v * factor * h;
        break;
      }
      case 'twist': {
        const r = Math.hypot(u, v);
        const angle = (1 - Math.min(1, r)) * bend * Math.PI;
        const nu = u * Math.cos(angle) - v * Math.sin(angle);
        const nv = u * Math.sin(angle) + v * Math.cos(angle);
        dx = (nu - u) * (w / 2);
        dy = (nv - v) * (h / 2);
        break;
      }
      default:
        dy = -(1 - u * u) * bend * h * 0.35;
        break;
    }

    // Apply horizontal & vertical perspective distortion
    dx += v * u * hDist * (w * 0.25);
    dy += u * v * vDist * (h * 0.25);

    return { x: pt.x + dx, y: pt.y + dy };
  };

  return points.map((p) => {
    const wp = warpPoint(p);
    return {
      ...p,
      x: wp.x,
      y: wp.y,
      handleIn: p.handleIn ? warpPoint(p.handleIn) : undefined,
      handleOut: p.handleOut ? warpPoint(p.handleOut) : undefined,
    };
  });
}

/**
 * Applies Liquify / Reshape Brush tools (Warp, Twirl, Pucker, Bloat, Scallop, Crystallize, Wrinkle)
 * to anchor points inside brush radius.
 */
export function applyLiquifyBrushToAnchors(
  points: AnchorPoint[],
  center: Point2D,
  radius: number,
  mode: 'warp' | 'twirl' | 'pucker' | 'bloat' | 'scallop' | 'crystallize' | 'wrinkle',
  delta: Point2D = { x: 0, y: 0 },
  intensity = 0.35
): AnchorPoint[] {
  const r = Math.max(8, radius);
  return points.map((pt, idx) => {
    const dist = distance2D(pt, center);
    if (dist >= r) return pt;
    const falloff = Math.pow(1 - dist / r, 1.5) * intensity;

    let nx = pt.x;
    let ny = pt.y;
    const dx = pt.x - center.x;
    const dy = pt.y - center.y;

    switch (mode) {
      case 'warp':
        nx += delta.x * falloff * 1.6;
        ny += delta.y * falloff * 1.6;
        break;
      case 'twirl': {
        const angle = falloff * 0.85;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        nx = center.x + dx * cos - dy * sin;
        ny = center.y + dx * sin + dy * cos;
        break;
      }
      case 'pucker':
        nx -= dx * falloff * 0.65;
        ny -= dy * falloff * 0.65;
        break;
      case 'bloat':
        nx += dx * falloff * 0.65;
        ny += dy * falloff * 0.65;
        break;
      case 'scallop': {
        const ang = Math.atan2(dy, dx);
        const wave = Math.sin(ang * 8) * r * 0.15 * falloff;
        nx += Math.cos(ang) * wave;
        ny += Math.sin(ang) * wave;
        break;
      }
      case 'crystallize': {
        const ang = Math.atan2(dy, dx);
        const spike = (idx % 2 === 0 ? 1 : -1) * r * 0.18 * falloff;
        nx += Math.cos(ang) * spike;
        ny += Math.sin(ang) * spike;
        break;
      }
      case 'wrinkle': {
        nx += Math.sin(pt.y * 0.25 + idx) * r * 0.14 * falloff;
        ny += Math.cos(pt.x * 0.25 + idx) * r * 0.14 * falloff;
        break;
      }
    }

    const shiftX = nx - pt.x;
    const shiftY = ny - pt.y;
    return {
      ...pt,
      x: nx,
      y: ny,
      handleIn: pt.handleIn ? { x: pt.handleIn.x + shiftX, y: pt.handleIn.y + shiftY } : undefined,
      handleOut: pt.handleOut
        ? { x: pt.handleOut.x + shiftX, y: pt.handleOut.y + shiftY }
        : undefined,
    };
  });
}

/**
 * Generates a closed variable-width outline SVG path string for strokes with Width Tool points
 * or Variable Width Profile presets.
 */
export function generateVariableWidthStrokePolygon(
  points: AnchorPoint[],
  closed: boolean,
  baseWeight: number,
  profileId?: string
): string {
  if (!points || points.length < 2) return '';
  const samples = samplePathToPolygon(points, closed, 10);
  if (samples.length < 2) return '';

  const leftSide: Point2D[] = [];
  const rightSide: Point2D[] = [];
  const n = samples.length;

  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;

    // Profile multiplier
    let mult = 1;
    if (profileId === 'width-profile-1') {
      mult = Math.sin(t * Math.PI); // Taper both ends
    } else if (profileId === 'width-profile-2') {
      mult = 0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI * 2));
    } else if (profileId === 'width-profile-3') {
      mult = 1 - t * 0.85; // Taper end
    } else if (profileId === 'width-profile-4') {
      mult = 0.15 + t * 0.85; // Taper start
    }

    // Interpolate per-anchor widthLeft / widthRight if present
    const anchorIdx = Math.min(points.length - 1, Math.floor(t * (points.length - 1)));
    const anchorPt = points[anchorIdx];
    const wLeft = (anchorPt?.widthLeft ?? baseWeight / 2) * mult;
    const wRight = (anchorPt?.widthRight ?? baseWeight / 2) * mult;

    leftSide.push({
      x: samples[i].x + nx * wLeft,
      y: samples[i].y + ny * wLeft,
    });
    rightSide.push({
      x: samples[i].x - nx * wRight,
      y: samples[i].y - ny * wRight,
    });
  }

  const all = [...leftSide, ...rightSide.reverse()];
  return (
    all.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${fmt(p.x)} ${fmt(p.y)}`).join(' ') + ' Z'
  );
}

/**
 * Generates the SVG path `d` attribute for any VectorNode, handling parametric shapes,
 * Bezier anchor points, compound paths, envelope distortions, and live geometry effects.
 */
export function generateNodeSvgPath(
  node: VectorNode,
  allNodes?: Record<string, VectorNode>
): string {
  if (!node) return '';

  // Compound path or compound shape combines child paths
  if (
    (node.type === 'compound-path' || node.type === 'compound-shape') &&
    node.children &&
    node.children.length > 0 &&
    allNodes
  ) {
    const childDs = node.children
      .map((cid) => allNodes[cid])
      .filter(Boolean)
      .map((child) => generateNodeSvgPath(child, allNodes))
      .filter(Boolean);
    if (childDs.length > 0) return childDs.join(' ');
  }

  // Convert-to-Shape Live Effect override
  const convertFx = node.effects?.find((e) => e.enabled && e.type === 'convert-to-shape');
  let baseAnchors: AnchorPoint[] = node.points && node.points.length > 0 ? node.points : [];
  let closed = node.closed;

  if (convertFx) {
    const pad = Number(convertFx.params?.extraWidth ?? 16);
    const shape = String(convertFx.params?.shape ?? 'rounded-rectangle');
    const bx = node.x - pad / 2;
    const by = node.y - pad / 2;
    const bw = node.width + pad;
    const bh = node.height + pad;
    if (shape === 'ellipse') {
      baseAnchors = createEllipseAnchors(bx, by, bw, bh);
    } else {
      baseAnchors = createRectangleAnchors(
        bx,
        by,
        bw,
        bh,
        shape === 'rounded-rectangle' ? Number(convertFx.params?.cornerRadius ?? 10) : 0
      );
    }
    closed = true;
  } else if (baseAnchors.length === 0) {
    switch (node.type) {
      case 'rectangle':
        baseAnchors = createRectangleAnchors(
          node.x,
          node.y,
          node.width,
          node.height,
          node.cornerRadius ?? 0,
          node.cornerType ?? 'round'
        );
        closed = true;
        break;
      case 'ellipse':
        baseAnchors = createEllipseAnchors(node.x, node.y, node.width, node.height);
        closed = true;
        break;
      case 'polygon':
        baseAnchors = createPolygonAnchors(
          node.x,
          node.y,
          node.width,
          node.height,
          node.sides ?? 6,
          node.cornerRadius ?? 0
        );
        closed = true;
        break;
      case 'star':
        baseAnchors = createStarAnchors(
          node.x,
          node.y,
          node.width,
          node.height,
          node.sides ?? 5,
          node.innerRadius ?? 0.45,
          node.cornerRadius ?? 0
        );
        closed = true;
        break;
      case 'line':
        baseAnchors = createLineAnchors(
          node.x,
          node.y,
          node.x + node.width,
          node.y + node.height
        );
        closed = false;
        break;
      default:
        baseAnchors = createRectangleAnchors(node.x, node.y, node.width, node.height);
        closed = true;
        break;
    }
  }

  const bounds: BoundingBox = {
    x: node.x,
    y: node.y,
    width: Math.max(1, node.width),
    height: Math.max(1, node.height),
  };

  let workingPoints = baseAnchors;
  if (node.envelopeSpec) {
    workingPoints = applyEnvelopeDistortToPoints(workingPoints, bounds, node.envelopeSpec);
  }

  const { points: finalPoints, extraCornerRadius } = applyLiveGeometryEffects(
    workingPoints,
    closed,
    node.effects || [],
    bounds
  );

  return anchorsToSvgPath(
    finalPoints,
    closed,
    (node.cornerRadius ?? 0) + extraCornerRadius,
    node.cornerType ?? 'round'
  );
}

// Convenient aliases for other modules
export const nodeToSvgPath = generateNodeSvgPath;
export const getVectorNodePathD = generateNodeSvgPath;

function fmt(n: number): number {
  return Math.round(n * 100) / 100;
}
