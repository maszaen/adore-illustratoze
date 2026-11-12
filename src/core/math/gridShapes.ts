import type { AnchorPoint } from '../types';
import { createEllipseAnchors, createLineAnchors, makeAnchorId } from './bezier';

/** Open subpaths keep grid lines independent instead of filling/closing the grid. */
export function createGridAnchors(kind: 'rect-grid' | 'polar-grid', x: number, y: number, width: number, height: number): AnchorPoint[] {
  const points: AnchorPoint[] = [];
  const add = (contour: AnchorPoint[]) => { if (contour.length) points.push(...contour.map((p, i) => ({ ...p, moveTo: points.length > 0 && i === 0 }))); };
  if (kind === 'rect-grid') {
    for (let i = 0; i <= 5; i++) {
      add(createLineAnchors(x + width * i / 5, y, x + width * i / 5, y + height));
      add(createLineAnchors(x, y + height * i / 5, x + width, y + height * i / 5));
    }
  } else {
    const cx = x + width / 2, cy = y + height / 2;
    for (let i = 1; i <= 5; i++) {
      const w = width * i / 5, h = height * i / 5;
      const ellipse = createEllipseAnchors(cx - w / 2, cy - h / 2, w, h);
      add([...ellipse, { ...ellipse[0], id: makeAnchorId('grid-close'), moveTo: false }]);
    }
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      add(createLineAnchors(cx, cy, cx + Math.cos(angle) * width / 2, cy + Math.sin(angle) * height / 2));
    }
  }
  return points;
}
