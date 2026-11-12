import { describe, expect, it } from 'vitest';
import { getSelectionResize, resizeVectorNode, selectionNodeBounds, type ResizeHandle } from '../core/math/selectionResize';
import { createRectangleAnchors, createEllipseAnchors } from '../core/math/bezier';
import type { VectorNode } from '../core/types';

const box = { x: 10, y: 20, width: 100, height: 50 };
const node = (overrides: Partial<VectorNode> = {}): VectorNode => ({
  id: 'shape', name: 'shape', type: 'path', layerId: 'l', visible: true, locked: false,
  ...box, rotation: 0, points: createRectangleAnchors(10, 20, 100, 50), closed: true,
  fills: [], strokes: [], effects: [], opacity: 1, blendMode: 'normal', ...overrides,
});

describe('Selection resize gesture geometry', () => {
  it.each([
    ['e', { x: 50, y: 0 }, { x: 10, y: 45 }],
    ['w', { x: -50, y: 0 }, { x: 110, y: 45 }],
    ['s', { x: 0, y: 25 }, { x: 60, y: 20 }],
    ['n', { x: 0, y: -25 }, { x: 60, y: 70 }],
  ] as [ResizeHandle, { x: number; y: number }, { x: number; y: number }][])('Shift-%s scales from the opposite side midpoint', (handle, delta, anchor) => {
    const result = getSelectionResize(box, handle, delta, true);
    expect(result.anchor).toEqual(anchor);
    expect(result.scaleX).toBeCloseTo(1.5);
    expect(result.scaleY).toBeCloseTo(1.5);
  });

  it.each([
    ['se', { x: 60, y: 5 }, { x: 10, y: 20 }],
    ['nw', { x: -60, y: -5 }, { x: 110, y: 70 }],
    ['ne', { x: 60, y: -5 }, { x: 10, y: 70 }],
    ['sw', { x: -60, y: 5 }, { x: 110, y: 20 }],
  ] as [ResizeHandle, { x: number; y: number }, { x: number; y: number }][])('Shift-%s projects to nearest diagonal with opposite corner fixed', (handle, delta, anchor) => {
    const result = getSelectionResize(box, handle, delta, true);
    expect(result.anchor).toEqual(anchor);
    expect(result.scaleX).toBeCloseTo(1.5);
    expect(result.scaleY).toBeCloseTo(1.5);
  });

  it('mirrors a side when dragged across the opposing edge and keeps dimensions positive', () => {
    const input = node();
    const transform = getSelectionResize(box, 'e', { x: -150, y: 0 }, false);
    expect(transform.scaleX).toBeCloseTo(-0.5);
    const result = resizeVectorNode(input, transform);
    expect(result.x).toBeCloseTo(-40); expect(result.width).toBeCloseTo(50);
    expect(result.points[0].x).toBeCloseTo(10); expect(result.points[1].x).toBeCloseTo(-40);
    expect(result.height).toBeCloseTo(50);
  });

  it('supports proportional flip after crossing a side and mirrors curved handles', () => {
    const input = node({ type: 'ellipse', points: createEllipseAnchors(10, 20, 100, 50) });
    const t = getSelectionResize(box, 'e', { x: -200, y: 0 }, true);
    expect(t.scaleX).toBeCloseTo(-1); expect(t.scaleY).toBeCloseTo(1);
    const out = resizeVectorNode(input, t);
    expect(out.x).toBeCloseTo(-90); expect(out.width).toBeCloseTo(100);
    expect(out.points[0].handleOut!.x).toBeCloseTo(20 - input.points[0].handleOut!.x);
  });

  it('measures and scales rotated vector geometry about the visible opposite side', () => {
    const input = node({ rotation: 90 });
    const visual = selectionNodeBounds(input);
    expect(visual.x).toBeCloseTo(35); expect(visual.y).toBeCloseTo(-5);
    expect(visual.width).toBeCloseTo(50); expect(visual.height).toBeCloseTo(100);
    const out = resizeVectorNode(input, getSelectionResize(visual, 'e', { x: 25, y: 0 }, false));
    expect(out.rotation).toBe(0);
    expect(out.x).toBeCloseTo(35); expect(out.width).toBeCloseTo(75);
    expect(out.y).toBeCloseTo(-5); expect(out.height).toBeCloseTo(100);
  });

  it('retains independent Pathfinder contours through reflection', () => {
    const points = createRectangleAnchors(10, 20, 100, 50);
    const inner = createRectangleAnchors(20, 30, 20, 20); inner[0].moveTo = true;
    const out = resizeVectorNode(node({ points: [...points, ...inner] }), getSelectionResize(box, 'e', { x: -200, y: 0 }, false));
    expect(out.points.filter(p => p.moveTo)).toHaveLength(1);
  });
});
