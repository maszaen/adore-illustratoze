// Agent layout measurements. Runs in Node (no canvas), so text values are the documented estimates;
// browser accuracy against real rendered pixels is checked separately in Chrome.
import { describe, expect, it } from 'vitest';
import { applyOperations, createFromSpec, inspectDesign, measureTexts } from '../agent/design';
import { createEllipseAnchors, createRectangleAnchors } from '../core/math/bezier';
import type { StudioDocument, VectorNode } from '../core/types';

const doc = (ops: any[]) => createFromSpec({ version: 1, document: { name: 'm', width: 400, height: 300 }, operations: ops });
const node = (d: StudioDocument, id: string) => inspectDesign(d).nodes.find(n => n.id === id) as any;
const add = (d: StudioDocument, id: string, patch: Partial<VectorNode>) => {
  const n = { id, name: id, type: 'rectangle', layerId: 'artwork', visible: true, locked: false, x: 0, y: 0, width: 10, height: 10, rotation: 0, points: [], closed: true, fills: [{ id: `${id}-f`, visible: true, type: 'solid', color: '#ff0000', opacity: 1, blendMode: 'normal' }], strokes: [], effects: [], opacity: 1, blendMode: 'normal', ...patch } as VectorNode;
  if (!n.points.length && n.type !== 'group' && n.type !== 'clipping-group') n.points = n.type === 'ellipse' ? createEllipseAnchors(n.x, n.y, n.width, n.height) : createRectangleAnchors(n.x, n.y, n.width, n.height);
  d.nodes[id] = n; if (!n.parentId) d.layers[0].nodeIds.push(id);
};

describe('measureTexts', () => {
  it('reports the frame a text operation will create, the baseline and the ink box', () => {
    const { items, source } = measureTexts([{ text: 'Hello', fontSize: 40, fontFamily: 'Arial', fontStyle: 'Bold' }, { text: 'a\nbb', fontSize: 20 }]);
    expect(source).toBe('approximate');
    const created = node(doc([{ op: 'text', id: 't', layer: 'artwork', x: 0, y: 0, text: 'Hello', fontSize: 40, fontFamily: 'Arial', fontStyle: 'Bold' }]), 't');
    expect(items[0].frame).toEqual({ x: 0, y: 0, width: created.width, height: created.height });
    expect(items[0].baseline).toBeCloseTo(40 * 0.96, 2);
    expect(items[0].ink.y).toBeLessThan(items[0].baseline);
    expect(items[0].ink.width).toBeGreaterThan(0);
    expect(items[0].source).toBe('approximate');
    expect(items[1].lines.map(l => l.text)).toEqual(['a', 'bb']);
    expect(items[1].lines[1].baseline - items[1].lines[0].baseline).toBeCloseTo(24, 5);
  });

  it('rejects unknown fields and invalid sizes instead of guessing', () => {
    expect(() => measureTexts([])).toThrow(/1–100/);
    expect(() => measureTexts([{ text: 'x', fontSize: 0 }])).toThrow(/fontSize/);
    expect(() => measureTexts([{ text: 'x', fontSize: 10, color: '#000000' }])).toThrow(/unknown field color/);
    expect(() => measureTexts([{ text: 'x', fontSize: 10, align: 'justify' }])).toThrow(/align/);
    expect(() => measureTexts([{ text: 'x', fontSize: 10, fontStyle: 'Heavy' }])).toThrow(/fontStyle/);
  });
});

describe('inspect visualBounds', () => {
  it('includes stroke and rotation for shapes and flags text estimates', () => {
    const d = doc([
      { op: 'rectangle', id: 'r', layer: 'artwork', x: 100, y: 100, width: 100, height: 40, fill: '#ff0000', stroke: '#000000', strokeWidth: 10, rotation: 90 },
      { op: 'text', id: 't', layer: 'artwork', x: 10, y: 10, text: 'Hi', fontSize: 30 },
    ]);
    const r = node(d, 'r');
    expect(r.visualBounds).toEqual({ x: 125, y: 65, width: 50, height: 110 });
    const t = node(d, 't');
    expect(t.visualBoundsApproximate).toBe(true);
    expect(t.textLines).toHaveLength(1);
    expect(inspectDesign(d).measurement.text).toBe('approximate');
  });

  it('computes groups from their children (not a stale frame) and limits clipping groups to the mask', () => {
    const d = doc([]);
    add(d, 'a', { x: 10, y: 10, width: 20, height: 20, parentId: 'g' });
    add(d, 'b', { x: 100, y: 50, width: 20, height: 30, parentId: 'g' });
    add(d, 'g', { type: 'group', x: 0, y: 0, width: 1, height: 1, children: ['a', 'b'], fills: [] });
    add(d, 'big', { x: 0, y: 150, width: 400, height: 150, parentId: 'clip' });
    add(d, 'mask', { type: 'ellipse', x: 50, y: 200, width: 60, height: 40, parentId: 'clip' });
    add(d, 'clip', { type: 'clipping-group', x: 0, y: 0, width: 1, height: 1, children: ['big', 'mask'], fills: [] });
    expect(node(d, 'g').visualBounds).toEqual({ x: 10, y: 10, width: 110, height: 70 });
    expect(node(d, 'g').bounds).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(node(d, 'clip').visualBounds).toEqual({ x: 50, y: 200, width: 60, height: 40 });
  });

  it('reports effect reach separately and keeps visualBounds for the object itself', () => {
    const d = doc([{ op: 'rectangle', id: 'r', layer: 'artwork', x: 50, y: 50, width: 40, height: 40, fill: '#ff0000' }]);
    d.nodes.r.effects = [{ id: 'fx', type: 'drop-shadow', name: 'Drop Shadow', enabled: true, params: { dx: 10, dy: 10, blur: 4 } }];
    const r = node(applyOperations(d, []), 'r');
    expect(r.visualBounds).toEqual({ x: 50, y: 50, width: 40, height: 40 });
    expect(r.effectBounds.width).toBeGreaterThan(60);
    expect(r.effects).toHaveLength(1);
  });

  it('excludes curve control handles that lie outside the drawn curve', () => {
    const d = doc([{ op: 'path', id: 'p', layer: 'artwork', closed: false, stroke: '#000000', strokeWidth: 2, points: [{ x: 0, y: 100, handleOut: { x: 50, y: 0 } }, { x: 100, y: 100, handleIn: { x: 50, y: 0 } }] }]);
    const p = node(d, 'p');
    expect(p.bounds.y).toBe(0);
    expect(p.visualBounds.y).toBeGreaterThan(20); // the curve peaks at y = 25
    expect(p.visualBounds.y).toBeLessThan(26);
  });
});
