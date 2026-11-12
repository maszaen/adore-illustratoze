import type { AnchorPoint, BoundingBox, Point2D, VectorNode } from '../types';
import { computeBoundingBoxFromAnchors, createEllipseAnchors, createLineAnchors, createPolygonAnchors, createRectangleAnchors, createStarAnchors } from './bezier';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export interface ResizeTransform { anchor: Point2D; scaleX: number; scaleY: number }

/** Signed scale about the opposite corner or the opposite side's midpoint. */
export function getSelectionResize(bounds: BoundingBox, handle: ResizeHandle, delta: Point2D, proportional: boolean): ResizeTransform {
  const w = Math.max(0.0001, bounds.width), h = Math.max(0.0001, bounds.height);
  const horizontal = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const vertical = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const anchor = {
    x: horizontal > 0 ? bounds.x : horizontal < 0 ? bounds.x + w : bounds.x + w / 2,
    y: vertical > 0 ? bounds.y : vertical < 0 ? bounds.y + h : bounds.y + h / 2,
  };
  const signedX = horizontal ? 1 + delta.x / (horizontal * w) : 1;
  const signedY = vertical ? 1 + delta.y / (vertical * h) : 1;
  if (!proportional) return { anchor, scaleX: signedX, scaleY: signedY };
  if (!vertical) return { anchor, scaleX: signedX, scaleY: Math.abs(signedX) };
  if (!horizontal) return { anchor, scaleX: Math.abs(signedY), scaleY: signedY };
  // Project mouse onto the nearest aspect-ratio diagonal in the current quadrant.
  const magnitude = (Math.abs(signedX) * w * w + Math.abs(signedY) * h * h) / (w * w + h * h);
  return { anchor, scaleX: Math.sign(signedX || 1) * magnitude, scaleY: Math.sign(signedY || 1) * magnitude };
}

export const canReflectVector = (node: VectorNode) =>
  ['rectangle', 'ellipse', 'polygon', 'star', 'path', 'line'].includes(node.type);

function anchorsForNode(node: VectorNode): AnchorPoint[] {
  if (node.points?.length) return node.points;
  switch (node.type) {
    case 'rectangle': return createRectangleAnchors(node.x, node.y, node.width, node.height, node.cornerRadius, node.cornerType);
    case 'ellipse': return createEllipseAnchors(node.x, node.y, node.width, node.height);
    case 'polygon': return createPolygonAnchors(node.x, node.y, node.width, node.height, node.sides ?? 6, node.cornerRadius);
    case 'star': return createStarAnchors(node.x, node.y, node.width, node.height, node.sides ?? 5, node.innerRadius ?? 0.45, node.cornerRadius);
    case 'line': return createLineAnchors(node.x, node.y, node.x + node.width, node.y + node.height);
    default: return [];
  }
}

function rotatePoint(point: Point2D, node: VectorNode): Point2D {
  if (!node.rotation) return { x: point.x, y: point.y };
  const radians = node.rotation * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
  return { x: cx + (point.x - cx) * c - (point.y - cy) * s, y: cy + (point.x - cx) * s + (point.y - cy) * c };
}

function rotateAnchor(point: AnchorPoint, node: VectorNode): AnchorPoint {
  return { ...point, ...rotatePoint(point, node),
    handleIn: point.handleIn && rotatePoint(point.handleIn, node),
    handleOut: point.handleOut && rotatePoint(point.handleOut, node) };
}

export function selectionNodeBounds(node: VectorNode): BoundingBox {
  if (!node.rotation || !canReflectVector(node)) return { x: node.x, y: node.y, width: node.width, height: node.height };
  const points = anchorsForNode(node).map(point => rotateAnchor(point, node));
  return points.length ? computeBoundingBoxFromAnchors(points, node.closed) : { x: node.x, y: node.y, width: node.width, height: node.height };
}

/** Apply affine resize to vector points/handles, preserving mirrored contour orientation. */
export function resizeVectorNode(node: VectorNode, transform: ResizeTransform): VectorNode {
  const { anchor, scaleX, scaleY } = transform;
  const mapPoint = (point: Point2D): Point2D => ({ x: anchor.x + (point.x - anchor.x) * scaleX, y: anchor.y + (point.y - anchor.y) * scaleY });
  const points = anchorsForNode(node).map(anchorPoint => {
    const point = rotateAnchor(anchorPoint, node);
    return { ...point, ...mapPoint(point), handleIn: point.handleIn && mapPoint(point.handleIn), handleOut: point.handleOut && mapPoint(point.handleOut) };
  });
  if (!points.length) return node;
  const box = computeBoundingBoxFromAnchors(points, node.closed);
  return { ...node, ...box, points, rotation: 0 };
}
