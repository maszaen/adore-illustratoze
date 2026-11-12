// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { StudioCanvas } from '../components/canvas/StudioCanvas';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { useStudioStore } from '../state/useStudioStore';
import type { VectorNode } from '../core/types';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('blend tool gesture', () => {
  it('creates and displays steps after clicking two objects', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const doc = createDefaultDocument({id:'blend-gesture',includeSampleArtwork:false});
    const make = (id:string,x:number):VectorNode => ({id,name:id,type:'rectangle',layerId:doc.layers[0].id,x,y:50,width:40,height:40,rotation:0,points:createRectangleAnchors(x,50,40,40),closed:true,visible:true,locked:false,fills:[{id:'f',type:'solid',visible:true,color:'#ff0000',opacity:1,blendMode:'normal'}],strokes:[],effects:[],opacity:1,blendMode:'normal'});
    doc.nodes={a:make('a',50),b:make('b',200)}; doc.layers[0].nodeIds=['a','b'];
    useStudioStore.getState().openDocument(doc);
    useStudioStore.setState({activeTool:'blend',selectedNodeIds:[],selectedIds:[],zoom:1,panX:0,panY:0});
    const host=document.createElement('div');document.body.appendChild(host); const root=createRoot(host);
    act(()=>root.render(<StudioCanvas/>));
    const click=(id:string) => act(()=>host.querySelector(`[data-vector-node-id="${id}"]`)!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:50,clientY:50})));
    click('a'); click('b');
    const id=useStudioStore.getState().selectedNodeIds[0];
    expect(useStudioStore.getState().getActiveDocument().nodes[id].type).toBe('blend');
    expect(host.querySelectorAll(`[data-vector-node-id^="${id}-step-"]`)).toHaveLength(6);
    act(()=>root.unmount());host.remove();vi.unstubAllGlobals();
  });
  it('moves an endpoint with Direct Selection and updates the blend, with undo', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    (SVGElement.prototype as any).setPointerCapture = () => {};
    const doc = createDefaultDocument({id:'blend-edit',includeSampleArtwork:false});
    const make=(id:string,x:number):VectorNode=>({id,name:id,type:'rectangle',layerId:doc.layers[0].id,x,y:50,width:40,height:40,rotation:0,points:createRectangleAnchors(x,50,40,40),closed:true,visible:true,locked:false,fills:[{id:'f',type:'solid',visible:true,color:'#ff0000',opacity:1,blendMode:'normal'}],strokes:[],effects:[],opacity:1,blendMode:'normal'});
    doc.nodes={a:make('a',50),b:make('b',200)};doc.layers[0].nodeIds=['a','b'];
    useStudioStore.getState().openDocument(doc);useStudioStore.getState().selectNodes(['a','b'],false);useStudioStore.getState().makeBlend('steps',1);
    const id=useStudioStore.getState().selectedNodeIds[0];
    useStudioStore.setState({activeTool:'direct-select',zoom:1,panX:0,panY:0,showSmartGuides:false,snapToGrid:false});
    const host=document.createElement('div');document.body.appendChild(host); const root=createRoot(host);act(()=>root.render(<StudioCanvas/>));
    const svg=host.querySelector('.ai-canvas-container > svg')!;
    const before=host.querySelector(`[data-vector-node-id="${id}-step-0"] path`)?.getAttribute('d');
    const pointer=(el:Element,type:string,x:number)=>el.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:55}));
    act(()=>{pointer(host.querySelector('[data-vector-node-id="b"]')!,'pointerdown',205)});
    act(()=>{pointer(svg,'pointermove',255)}); act(()=>{pointer(svg,'pointerup',255)});
    expect(useStudioStore.getState().getActiveDocument().nodes.b.x).toBe(250);
    expect(host.querySelector(`[data-vector-node-id="${id}-step-0"] path`)?.getAttribute('d')).not.toBe(before);
    act(()=>useStudioStore.getState().undo());
    expect(useStudioStore.getState().getActiveDocument().nodes.b.x).toBe(200);
    act(()=>root.unmount());host.remove();delete (SVGElement.prototype as any).setPointerCapture;vi.unstubAllGlobals();
  });
  it('shows hover and selected bounding boxes in the layer color', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const doc=createDefaultDocument({id:'hover-layer',includeSampleArtwork:false});doc.layers[0].color='#ee1177';
    const n:VectorNode={id:'hover-shape',name:'shape',type:'rectangle',layerId:doc.layers[0].id,x:100,y:100,width:40,height:40,rotation:0,points:createRectangleAnchors(100,100,40,40),closed:true,visible:true,locked:false,fills:[{id:'f',type:'solid',visible:true,color:'#000000',opacity:1,blendMode:'normal'}],strokes:[],effects:[],opacity:1,blendMode:'normal'};
    doc.nodes={[n.id]:n};doc.layers[0].nodeIds=[n.id];useStudioStore.getState().openDocument(doc);
    useStudioStore.setState({activeTool:'select',selectedNodeIds:[],selectedIds:[],showEdges:true,showBoundingBox:true,zoom:1,panX:0,panY:0});
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);act(()=>root.render(<StudioCanvas/>));
    act(()=>{host.querySelector('[data-vector-node-id="hover-shape"]')!.dispatchEvent(new MouseEvent('pointerover',{bubbles:true}))});
    expect(host.querySelector('[data-hover-bounds]')?.getAttribute('stroke')).toBe('#ee1177');
    act(()=>useStudioStore.getState().selectNodes([n.id],false));
    expect(host.querySelector('[data-hover-bounds]')).toBeNull();
    expect(host.querySelector('[data-selection-bounds]')?.getAttribute('stroke')).toBe('#ee1177');
    act(()=>root.unmount());host.remove();vi.unstubAllGlobals();
  });

  it('sprays along a dragged path as one undoable action and cancels cleanly', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    (SVGElement.prototype as any).setPointerCapture=()=>{};
    const doc=createDefaultDocument({id:'symbol-spray',includeSampleArtwork:false});
    useStudioStore.getState().openDocument(doc);
    useStudioStore.setState({activeTool:'symbol-sprayer',activeSymbolId:doc.symbols[0].id,zoom:1,panX:0,panY:0});
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);act(()=>root.render(<StudioCanvas/>));
    const svg=host.querySelector('.ai-canvas-container > svg')!;
    const pointer=(type:string,x:number)=>svg.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:50}));
    act(()=>{pointer('pointerdown',50)});act(()=>{pointer('pointermove',150)});act(()=>{pointer('pointerup',150)});
    expect(Object.values(useStudioStore.getState().getActiveDocument().nodes).filter(n=>n.type==='symbol-instance')).toHaveLength(4);
    act(()=>useStudioStore.getState().undo());expect(Object.keys(useStudioStore.getState().getActiveDocument().nodes)).toHaveLength(0);
    act(()=>{pointer('pointerdown',50)});act(()=>{pointer('pointermove',150)});act(()=>{pointer('pointercancel',150)});act(()=>{pointer('pointerup',150)});
    expect(Object.keys(useStudioStore.getState().getActiveDocument().nodes)).toHaveLength(0);
    act(()=>root.unmount());host.remove();delete (SVGElement.prototype as any).setPointerCapture;vi.unstubAllGlobals();
  });

});
