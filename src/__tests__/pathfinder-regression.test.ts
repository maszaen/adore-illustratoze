import { describe, expect, it } from 'vitest';
import type { VectorNode } from '../core/types';
import { createRectangleAnchors, generateNodeSvgPath } from '../core/math/bezier';
import { performPathfinder, polygonSignedArea } from '../core/math/pathfinder';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { useStudioStore } from '../state/useStudioStore';

const rect = (id: string, x: number, y: number, width: number, height: number): VectorNode => ({
  id, name: id, type: 'rectangle', layerId: 'layer-artwork', visible: true, locked: false,
  x, y, width, height, rotation: 0, points: createRectangleAnchors(x, y, width, height), closed: true,
  fills: [{ id: `fill-${id}`, visible: true, type: 'solid', color: '#ff0000', opacity: 1, blendMode: 'normal' }],
  strokes: [], effects: [], opacity: 1, blendMode: 'normal',
});
function area(nodes: VectorNode[]) {
  return nodes.reduce((total, node) => {
    const rings: typeof node.points[] = [];
    for (const p of node.points) { if (!rings.length || p.moveTo) rings.push([]); rings[rings.length - 1].push(p); }
    return total + rings.reduce((sum, ring, index) => sum + Math.abs(polygonSignedArea(ring)) * (index ? -1 : 1), 0);
  }, 0);
}

describe('Pathfinder geometry and safety', () => {
  it('preserves disconnected islands and considers all objects', () => {
    const a = rect('a', 0, 0, 100, 100), b = rect('b', 200, 0, 100, 100), c = rect('c', 300, 0, 50, 100);
    const united = performPathfinder([a, b, c], 'unite');
    expect(united).toHaveLength(2);
    expect(area(united)).toBeCloseTo(25000);
    expect(united.some(n => n.x === 200 && n.width === 150)).toBe(true);
  });

  it('keeps a real hole across rendering, SVG export and repeated boolean operations', () => {
    const a = rect('a', 0, 0, 100, 100), b = rect('b', 25, 25, 50, 50);
    const ring = performPathfinder([a, b], 'minus-front');
    expect(area(ring)).toBeCloseTo(7500);
    expect(ring[0].fillRule).toBe('evenodd');
    expect(ring[0].points.filter(p => p.moveTo)).toHaveLength(1);
    expect((generateNodeSvgPath(ring[0]).match(/M /g) || []).length).toBe(2);
    const doc = createDefaultDocument({ includeSampleArtwork: false });
    doc.nodes[ring[0].id] = ring[0]; doc.layers[0].nodeIds = [ring[0].id];
    const svg = exportDocumentToSvgString(doc);
    expect(svg).toContain('fill-rule="evenodd"');
    expect((svg.match(/M /g) || []).length).toBe(2);
    const cropped = performPathfinder([ring[0], rect('c', 0, 0, 50, 100)], 'intersect');
    expect(area(cropped)).toBeCloseTo(3750);
  });

  it('splits three objects without losing their disjoint portions', () => {
    const pieces = performPathfinder([rect('a', 0, 0, 100, 100), rect('b', 25, 25, 50, 50), rect('c', 300, 0, 40, 40)], 'divide');
    expect(area(pieces)).toBeCloseTo(11600);
    expect(pieces.some(p => p.x === 300 && p.width === 40)).toBe(true);
    expect(pieces.some(p => p.points.some(pt => pt.moveTo))).toBe(true);
  });

  it('trims and excludes every selected object', () => {
    const nodes = [rect('a', 0, 0, 100, 100), rect('b', 50, 0, 100, 100), rect('c', 125, 0, 100, 100)];
    expect(area(performPathfinder(nodes, 'trim'))).toBeCloseTo(22500);
    expect(area(performPathfinder(nodes, 'exclude'))).toBeCloseTo(15000);
  });

  it('removes old references across layers, sorts by stacking order, and supports undo', () => {
    const doc = createDefaultDocument({ id: 'pathfinder-multilayer', includeSampleArtwork: false });
    const back = rect('back', 0, 0, 100, 100), front = rect('front', 50, 0, 100, 100);
    back.layerId = doc.layers[1].id; front.layerId = doc.layers[0].id;
    doc.layers[1].nodeIds = [back.id]; doc.layers[0].nodeIds = [front.id];
    doc.layers[1].visible = true; doc.layers[1].locked = false;
    doc.nodes = { back, front };
    useStudioStore.getState().openDocument(doc);
    useStudioStore.getState().selectNodes(['front', 'back']);
    useStudioStore.getState().runPathfinder('minus-front');
    let state = useStudioStore.getState();
    expect(area(state.selectedNodeIds.map(id => state.document.nodes[id]))).toBeCloseTo(5000);
    expect(state.document.layers.every(layer => !layer.nodeIds.includes('back') && !layer.nodeIds.includes('front'))).toBe(true);
    state.undo(); state = useStudioStore.getState();
    expect(state.document.nodes.back).toBeDefined(); expect(state.document.nodes.front).toBeDefined();
  });

  it('keeps unsupported image or live compound inputs unchanged', () => {
    const doc = createDefaultDocument({ id: 'pathfinder-safe', includeSampleArtwork: false });
    const a = rect('a', 0, 0, 100, 100), b = { ...rect('b', 20, 20, 30, 30), type: 'image' as const };
    doc.nodes = { a, b }; doc.layers[0].nodeIds = ['a', 'b'];
    useStudioStore.getState().openDocument(doc); useStudioStore.getState().selectNodes(['a', 'b']);
    useStudioStore.getState().runPathfinder('unite');
    expect(Object.keys(useStudioStore.getState().document.nodes).sort()).toEqual(['a', 'b']);
    expect(useStudioStore.getState().statusMessage).toContain('closed vector');
    useStudioStore.getState().runPathfinder('unite', true);
    expect(Object.keys(useStudioStore.getState().document.nodes).sort()).toEqual(['a', 'b']);
  });
});
