import type { AnchorPoint, Point2D, VectorNode } from '../types';
import { computeBoundingBoxFromAnchors, createEllipseAnchors, createLineAnchors, createPolygonAnchors, createRectangleAnchors, createStarAnchors } from './bezier';

export function rotatePointAround(point: Point2D, pivot: Point2D, radians: number): Point2D {
  const c = Math.cos(radians), s = Math.sin(radians);
  return { x: pivot.x + (point.x - pivot.x) * c - (point.y - pivot.y) * s,
    y: pivot.y + (point.x - pivot.x) * s + (point.y - pivot.y) * c };
}

/** Rotate actual vector geometry, including handles, once about the selected pivot.
 * Text/images keep their intrinsic geometry and rotate around the moved centre. */
export function rotateNodeAround(node: VectorNode, pivot: Point2D, degrees: number): VectorNode {
  if (Math.abs(degrees) < 1e-10) return node;
  // Container geometry is not rendered directly; descendants are transformed separately.
  if (node.children?.length && ['group', 'clipping-group', 'blend', 'compound-path', 'compound-shape'].includes(node.type)) return node;
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
  const angle = degrees * Math.PI / 180;
  const vector = ['rectangle', 'ellipse', 'polygon', 'star', 'path', 'line', 'compound-path'].includes(node.type);
  if (vector) {
    let points = node.points;
    if (!points?.length) {
      switch (node.type) {
        case 'rectangle': points = createRectangleAnchors(node.x, node.y, node.width, node.height, node.cornerRadius, node.cornerType); break;
        case 'ellipse': points = createEllipseAnchors(node.x, node.y, node.width, node.height); break;
        case 'polygon': points = createPolygonAnchors(node.x, node.y, node.width, node.height, node.sides ?? 6, node.cornerRadius); break;
        case 'star': points = createStarAnchors(node.x, node.y, node.width, node.height, node.sides ?? 5, node.innerRadius ?? 0.45, node.cornerRadius); break;
        case 'line': points = createLineAnchors(node.x, node.y, node.x + node.width, node.y + node.height); break;
      }
    }
    if (points?.length) {
      const oldAngle = (node.rotation || 0) * Math.PI / 180;
      const transform = (p: Point2D) => rotatePointAround(rotatePointAround(p, center, oldAngle), pivot, angle);
      const rotated: AnchorPoint[] = points.map(pt => ({ ...pt, ...transform(pt),
        handleIn: pt.handleIn && transform(pt.handleIn), handleOut: pt.handleOut && transform(pt.handleOut) }));
      return { ...node, ...computeBoundingBoxFromAnchors(rotated, node.closed), points: rotated, rotation: 0 };
    }
  }
  const movedCenter = rotatePointAround(center, pivot, angle);
  const dx = movedCenter.x - center.x, dy = movedCenter.y - center.y;
  const translate = (p: Point2D) => ({ x: p.x + dx, y: p.y + dy });
  return { ...node, x: node.x + dx, y: node.y + dy, rotation: (node.rotation || 0) + degrees,
    points: (node.points || []).map(pt => ({ ...pt, ...translate(pt),
      handleIn: pt.handleIn && translate(pt.handleIn), handleOut: pt.handleOut && translate(pt.handleOut) })) };
}
