import { describe, it, expect, vi } from 'vitest';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { blendIntermediateNodes } from '../core/math/blend';
import { useStudioStore } from '../state/useStudioStore';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import type { VectorNode } from '../core/types';

function setup() {
  const doc = createDefaultDocument({ id: `blend-${Math.random()}`, includeSampleArtwork: false });
  const make = (id: string, x: number, color: string): VectorNode => ({ id, name:id, type:'rectangle', layerId:doc.layers[0].id, x, y:20, width:40, height:40, rotation:0, points:createRectangleAnchors(x,20,40,40), closed:true, visible:true, locked:false, fills:[{id:'f', type:'solid',color,visible:true,opacity:1,blendMode:'normal'}],strokes:[],effects:[],opacity:1,blendMode:'normal' });
  doc.nodes = { a:make('a', 0, '#ff0000'), b:make('b', 100, '#0000ff') };
  doc.layers[0].nodeIds = ['a','b'];
  useStudioStore.getState().openDocument(doc);
  useStudioStore.getState().selectNodes(['a','b'],false);
  return () => useStudioStore.getState().getActiveDocument();
}

describe('blend', () => {
  it('creates a live blend with interpolated paths and colors, exports, releases and undoes', () => {
    const doc = setup();
    useStudioStore.getState().makeBlend('steps', 1);
    const id = useStudioStore.getState().selectedNodeIds[0];
    expect(doc().nodes[id].type).toBe('blend');
    expect(doc().nodes.a.parentId).toBe(id);
    const steps = blendIntermediateNodes(doc().nodes[id], doc().nodes);
    expect(steps).toHaveLength(1);
    expect(steps[0].points[0].x).toBe(50);
    expect(steps[0].fills[0].color).toBe('#800080');
    expect(exportDocumentToSvgString(doc())).toContain('#800080');
    useStudioStore.getState().releaseBlend();
    expect(doc().nodes[id]).toBeUndefined();
    expect(doc().nodes.a.parentId).toBeUndefined();
    useStudioStore.getState().undo();
    expect(doc().nodes[id].type).toBe('blend');
    useStudioStore.getState().undo();
    expect(doc().nodes[id]).toBeUndefined();
    expect(doc().nodes.b.parentId).toBeUndefined();
  });
  it('morphs different shapes and colors and recalculates after editing an endpoint', () => {
    const doc = setup();
    useStudioStore.getState().updateDocument(d => { d.nodes.b.type = 'star'; d.nodes.b.points = []; d.nodes.b.sides = 5; }, 'shape');
    useStudioStore.getState().makeBlend('steps', 1);
    const id = useStudioStore.getState().selectedNodeIds[0];
    const step = () => blendIntermediateNodes(doc().nodes[id], doc().nodes)[0];
    expect(step().type).toBe('path'); expect(step().points).toHaveLength(96);
    expect(step().fills[0].color).toBe('#800080');
    const oldX = step().points[0].x;
    useStudioStore.getState().updateDocument(d => { d.nodes.b.x += 100; d.nodes.b.fills[0].color = '#00ff00'; }, 'edit endpoint');
    expect(step().points[0].x).toBeCloseTo(oldX + 50);
    expect(step().fills[0].color).toBe('#808000');
    expect(doc().nodes[id].width).toBe(240);
  });
  it('deletes the blend subtree and restores it with undo', () => {
    const doc = setup();
    useStudioStore.getState().makeBlend();
    const id = useStudioStore.getState().selectedNodeIds[0];
    useStudioStore.getState().deleteSelectedNodes();
    expect(doc().nodes.a).toBeUndefined(); expect(doc().nodes.b).toBeUndefined();
    expect(doc().nodes[id]).toBeUndefined();
    useStudioStore.getState().undo();
    expect(doc().nodes.a.parentId).toBe(id); expect(doc().nodes[id]).toBeDefined();
  });
  it('calculates spacing and refuses incompatible objects without changing the document', () => {
    const doc = setup();
    useStudioStore.getState().makeBlend('distance', 25);
    const blend = doc().nodes[useStudioStore.getState().selectedNodeIds[0]];
    expect(blendIntermediateNodes(blend,doc().nodes)).toHaveLength(3);
    useStudioStore.getState().releaseBlend();
    useStudioStore.getState().updateDocument(d => { d.nodes.b.closed = false; }, 'change');
    const before = JSON.stringify(doc()); const index = useStudioStore.getState().historyIndex;
    vi.stubGlobal('window', { alert: vi.fn() });
    useStudioStore.getState().makeBlend();
    expect(JSON.stringify(doc())).toBe(before);
    expect(useStudioStore.getState().historyIndex).toBe(index);
    vi.unstubAllGlobals();
  });
});
