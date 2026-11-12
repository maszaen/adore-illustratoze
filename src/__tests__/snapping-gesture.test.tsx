// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioCanvas } from '../components/canvas/StudioCanvas';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { useStudioStore } from '../state/useStudioStore';
import type { VectorNode } from '../core/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const pointer=(element:Element,type:string,x:number,y:number,shiftKey=false) =>
  element.dispatchEvent(new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,shiftKey}));

describe('snapping drag gestures', () => {
  afterEach(() => { vi.restoreAllMocks();vi.unstubAllGlobals();delete (SVGElement.prototype as any).setPointerCapture; });
  function setup(tool:'select'|'direct-select'='select', smart=true, grid=false) {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    (SVGElement.prototype as any).setPointerCapture=()=>{};
    const doc=createDefaultDocument({id:`snap-${tool}-${smart}-${grid}`,width:800,height:700,includeSampleArtwork:false});
    const make=(id:string,x:number,y:number):VectorNode=>({id,name:id,type:'rectangle',layerId:doc.layers[0].id,x,y,width:40,height:40,rotation:0,points:createRectangleAnchors(x,y,40,40),closed:true,visible:true,locked:false,
      fills:[{id:'f',visible:true,type:'solid',color:'#000',opacity:1,blendMode:'normal'}],strokes:[],effects:[],opacity:1,blendMode:'normal'});
    const moving=make('moving',100,120),target=make('target',300,310);
    doc.nodes={moving,target};doc.layers[0].nodeIds=['moving','target'];
    useStudioStore.getState().openDocument(doc);
    useStudioStore.setState({activeTool:tool,selectedNodeIds:['moving'],selectedIds:['moving'],selectedAnchorIds:[],zoom:1,panX:0,panY:0,snapToGrid:grid,showSmartGuides:smart,showGuides:true,showEdges:true,showBoundingBox:true});
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);act(()=>root.render(<StudioCanvas/>));
    const svg=host.querySelector('.ai-canvas-container > svg')!;
    const state=()=>useStudioStore.getState().getActiveDocument().nodes.moving;
    return {host,root,svg,state,moving};
  }
  const cleanup=({root,host}:ReturnType<typeof setup>)=>{act(()=>root.unmount());host.remove()};
  it.each([[105,125],[134,153]])('snaps the same edge regardless of grab point (%s, %s)',(x,y)=>{
    const app=setup();const {host,svg,state}=app;
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',x,y)});
    act(()=>{pointer(svg,'pointermove',x+159,y)});
    expect(state().x).toBe(260);
    const guide=host.querySelector('[data-smart-guides] line')!;
    expect(guide.getAttribute('x1')).toBe('300');
    act(()=>{pointer(svg,'pointerup',x+159,y)});
    act(()=>useStudioStore.getState().undo());expect(state().x).toBe(100);
    cleanup(app);
  });
  it('does not snap or make history when just clicking',()=>{
    const app=setup();const {host,svg,state}=app;const before=useStudioStore.getState().historyIndex;
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',105,125)});
    act(()=>{pointer(svg,'pointermove',105,125)});
    act(()=>{pointer(svg,'pointerup',105,125)});
    expect(state().x).toBe(100);expect(useStudioStore.getState().historyIndex).toBe(before);cleanup(app);
  });
  it('keeps the locked axis fixed while snapping with Shift',()=>{
    const app=setup();const {host,svg,state}=app;
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',105,125)});
    act(()=>{pointer(svg,'pointermove',264,130,true)});
    expect(state().x).toBe(260);expect(state().y).toBe(120);
    act(()=>{pointer(svg,'pointerup',264,130,true)});cleanup(app);
  });
  it('honours disabled snapping instead of changing the requested delta',()=>{
    const app=setup('select',false,false);const {host,svg,state}=app;
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',105,125)});
    act(()=>{pointer(svg,'pointermove',264,125)});
    expect(state().x).toBe(259);expect(host.querySelector('[data-smart-guides]')).toBeNull();
    act(()=>{pointer(svg,'pointerup',264,125)});cleanup(app);
  });
  it('snaps object geometry to the visible grid, not the grab location',()=>{
    const app=setup('select',false,true);const {host,svg,state}=app;
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',105,125)});
    act(()=>{pointer(svg,'pointermove',118,125)});
    expect(state().x).toBe(120);
    act(()=>{pointer(svg,'pointerup',118,125)});cleanup(app);
  });
  it('snaps a multi-selection as one box and keeps relative positions',()=>{
    const app=setup();const {host,svg,state}=app;
    act(()=>useStudioStore.getState().updateDocument(doc=>{
      const extra=structuredClone(doc.nodes.moving); extra.id='second'; extra.name='second';
      extra.x+=50; extra.points=extra.points.map(pt=>({...pt,id:`second-${pt.id}`,x:pt.x+50}));
      doc.nodes.second=extra; doc.layers[0].nodeIds.push(extra.id);
    },'Add second'));
    act(()=>useStudioStore.getState().selectNodes(['moving','second'],false));
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',105,125)});
    act(()=>{pointer(svg,'pointermove',214,125)});
    expect(state().x).toBe(210);
    expect(useStudioStore.getState().getActiveDocument().nodes.second.x).toBe(260);
    act(()=>{pointer(svg,'pointerup',214,125)});cleanup(app);
  });
  it('restores the move when pointer capture is cancelled',()=>{
    const app=setup();const {host,svg,state}=app;
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',105,125)});
    act(()=>{pointer(svg,'pointermove',264,125)});
    act(()=>{pointer(svg,'pointercancel',264,125)});
    expect(state().x).toBe(100);expect(host.querySelector('[data-smart-guides]')).toBeNull();
    expect(useStudioStore.getState().isTransactionActive).toBe(false);cleanup(app);
  });
  it('snaps the actual anchor, not the offset point where it was grabbed',()=>{
    const app=setup('direct-select');const {host,svg,state,moving}=app;
    const id=moving.points[0].id;const anchor=host.querySelector(`[data-anchor-id="${id}"]`)!;
    act(()=>{pointer(anchor,'pointerdown',103,123)});
    act(()=>{pointer(svg,'pointermove',300,123)});
    expect(state().points[0].x).toBe(300);
    act(()=>{pointer(svg,'pointerup',300,123)});cleanup(app);
  });
  it('restores moved geometry on Escape',()=>{
    const app=setup();const {host,svg,state}=app;
    act(()=>{pointer(host.querySelector('[data-vector-node-id="moving"]')!,'pointerdown',105,125)});
    act(()=>{pointer(svg,'pointermove',264,125)});expect(state().x).toBe(260);
    act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(state().x).toBe(100);expect(useStudioStore.getState().isTransactionActive).toBe(false);cleanup(app);
  });
});
