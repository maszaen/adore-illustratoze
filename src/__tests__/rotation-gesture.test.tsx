// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioCanvas } from '../components/canvas/StudioCanvas';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createEllipseAnchors, createRectangleAnchors } from '../core/math/bezier';
import { useStudioStore } from '../state/useStudioStore';
import type { VectorNode } from '../core/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const pointer = (element: Element, type: string, x: number, y: number, shiftKey = false) =>
  element.dispatchEvent(new MouseEvent(type, { bubbles:true, clientX:x, clientY:y, button:0, shiftKey }));

describe('rotation gestures', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (SVGElement.prototype as any).setPointerCapture; });
  function setup(type: 'rectangle' | 'path', tool: 'select' | 'rotate') {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    (SVGElement.prototype as any).setPointerCapture = () => {};
    const doc = createDefaultDocument({ id: `rotation-${type}-${tool}`, width:500, height:400, includeSampleArtwork:false });
    const node: VectorNode = { id:'test-shape', name:'shape', type, layerId:doc.layers[0].id, x:100, y:100, width:100, height:50, rotation:0,
      points:type === 'path' ? createEllipseAnchors(100,100,100,50) : createRectangleAnchors(100,100,100,50), closed:true,
      visible:true, locked:false, fills:[], strokes:[{ id:'s', visible:true, color:'#000', weight:2, opacity:1, blendMode:'normal',cap:'round',join:'round',miterLimit:10,align:'center',dashArray:[] }], effects:[], opacity:1, blendMode:'normal' };
    doc.nodes = { [node.id]:node }; doc.layers[0].nodeIds=[node.id];
    useStudioStore.getState().openDocument(doc);
    useStudioStore.setState({ activeTool:tool, selectedNodeIds:[node.id], selectedIds:[node.id], selectedAnchorIds:[], zoom:1, panX:0, panY:0, snapToGrid:false, showSmartGuides:false, showEdges:true, showBoundingBox:true });
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    act(() => root.render(<StudioCanvas />));
    const svg=host.querySelector('.ai-canvas-container > svg')!;
    const state=() => useStudioStore.getState().getActiveDocument().nodes[node.id];
    return {host,root,svg,node,state};
  }
  it.each(['rectangle','path'] as const)('rotates %s through the upper handle and undoes cleanly', type => {
    const {host,root,svg,node,state}=setup(type,'select');
    const original=structuredClone(node); const handle=host.querySelector('[data-rotate-handle]')!;
    act(() => { pointer(handle,'pointerdown',150,82); });
    act(() => { pointer(svg,'pointermove',193,125); });
    act(() => { pointer(svg,'pointerup',193,125); });
    const rotated=state();
    expect(rotated.rotation).toBe(0);
    expect(rotated.width).toBeCloseTo(50,1); expect(rotated.height).toBeCloseTo(100,1);
    expect(rotated.points[0].x).toBeCloseTo(175,1); expect(rotated.points[0].y).toBeCloseTo(type === 'path' ? 125 : 75,1);
    if(type === 'path') {
      expect(rotated.points[0].handleOut!.x).toBeCloseTo(175,1);
      expect(rotated.points[0].handleOut!.y).toBeGreaterThan(125);
    }
    act(() => useStudioStore.getState().undo());
    expect(state()).toEqual(original);
    act(() => root.unmount()); host.remove();
  });
  it('Rotate Tool rotates a stroke-only rectangle without distorting it', () => {
    const {host,root,svg,state}=setup('rectangle','rotate');
    act(() => { pointer(svg,'pointerdown',200,125); });
    act(() => { pointer(svg,'pointermove',150,175); });
    act(() => { pointer(svg,'pointerup',150,175); });
    expect(state().width).toBeCloseTo(50,1); expect(state().height).toBeCloseTo(100,1);
    expect(state().points[0].x).toBeCloseTo(175,1); expect(state().points[0].y).toBeCloseTo(75,1);
    expect(state().fills).toHaveLength(0); expect(state().strokes[0].weight).toBe(2);
    act(() => root.unmount()); host.remove();
  });
  it('Rotate Tool preserves curved handles and Escape restores the original', () => {
    const {host,root,svg,node,state}=setup('path','rotate');const original=structuredClone(node);
    act(() => { pointer(svg,'pointerdown',200,125); });
    act(() => { pointer(svg,'pointermove',150,175); });
    expect(state().points[0].x).toBeCloseTo(175,1);
    expect(state().points[0].handleOut!.x).toBeCloseTo(175,1);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    act(() => { pointer(svg,'pointerup',150,175); });
    expect(state()).toEqual(original);
    act(() => root.unmount()); host.remove();
  });
  it('retains the selection centre as pivot for successive Rotate Tool drags', () => {
    const {host,root,svg,state}=setup('rectangle','rotate');
    act(() => { pointer(svg,'pointerdown',200,125); });
    act(() => { pointer(svg,'pointermove',150,175); });
    act(() => { pointer(svg,'pointerup',150,175); });
    act(() => { pointer(svg,'pointerdown',200,125); });
    act(() => { pointer(svg,'pointermove',150,175); });
    act(() => { pointer(svg,'pointerup',150,175); });
    expect(state().points[0].x).toBeCloseTo(200,1);
    expect(state().points[0].y).toBeCloseTo(150,1);
    expect(state().x).toBeCloseTo(100,1); expect(state().y).toBeCloseTo(100,1);
    act(() => root.unmount()); host.remove();
  });
  it('cancels a handle rotation on pointer cancel without an undo entry', () => {
    const {host,root,svg,node,state}=setup('path','select'); const original=structuredClone(node);
    const before=useStudioStore.getState().historyIndex;
    act(() => { pointer(host.querySelector('[data-rotate-handle]')!,'pointerdown',150,82); });
    act(() => { pointer(svg,'pointermove',193,125); });
    act(() => { pointer(svg,'pointercancel',193,125); });
    expect(state()).toEqual(original); expect(useStudioStore.getState().historyIndex).toBe(before);
    act(() => root.unmount()); host.remove();
  });
  it('does not create a history entry for clicking the rotation handle', () => {
    const {host,root,svg,state,node}=setup('rectangle','select');
    const before=useStudioStore.getState().historyIndex;
    act(() => { pointer(host.querySelector('[data-rotate-handle]')!,'pointerdown',150,82); });
    act(() => { pointer(svg,'pointerup',150,82); });
    expect(state()).toEqual(node); expect(useStudioStore.getState().historyIndex).toBe(before);
    act(() => root.unmount()); host.remove();
  });

});
