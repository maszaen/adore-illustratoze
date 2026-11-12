// @vitest-environment jsdom
// Regression tests for safe trace workflow; image loading is mocked.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ControlBar } from '../components/workspace/ControlBar';
import { StudioModals } from '../components/modals/StudioModals';
import { ArtboardsAssetHistoryInfoPanel } from '../components/panels/ArtboardsAssetHistoryInfoPanel';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { validateDocument } from '../agent/design';
import * as traceApi from '../core/io/imageTrace';
import { useStudioStore } from '../state/useStudioStore';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;

function setup() {
  const doc=createDefaultDocument({id:'trace-workflow',includeSampleArtwork:false});
  const layer=doc.layers[0];
  doc.nodes.image={id:'image',name:'image',type:'image',layerId:layer.id,visible:true,locked:false,x:10,y:10,width:30,height:30,rotation:0,points:[],closed:true,fills:[],strokes:[],effects:[],opacity:1,blendMode:'normal',imageUrl:'data:image/png;base64,AA'};
  layer.nodeIds=['image'];
  const data=new Uint8ClampedArray(20*20*4); for(let i=0;i<data.length;i+=4) data[i+3]=255;
  const result=traceApi.traceImageDataToVectorNodes({width:20,height:20,data},{x:10,y:10,width:30,height:30},layer.id,{noise:1});
  useStudioStore.getState().openDocument(doc);useStudioStore.getState().selectNodes(['image']);
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  act(()=>root.render(<ArtboardsAssetHistoryInfoPanel initialTab="image-trace" showTabs={false}/>));
  return {doc,result,host,root};
}
const click=async(host:HTMLElement,name:string)=>{await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()===name)!.click();await Promise.resolve();});};
const cleanup=(host:HTMLElement,root:ReturnType<typeof createRoot>)=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();};

it('panel Trace adds a valid copy after the source and supports undo/redo',async()=>{
  const {result,host,root}=setup(); vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockResolvedValue(result);
  try {
    await click(host,'Trace'); const doc=useStudioStore.getState().getActiveDocument();
    expect(doc.nodes.image).toBeDefined(); expect(doc.layers[0].nodeIds).toEqual(['image',result.groupNode.id]);
    expect(()=>validateDocument(doc)).not.toThrow();
    act(()=>useStudioStore.getState().undo()); expect(useStudioStore.getState().getActiveDocument().layers[0].nodeIds).toEqual(['image']);
    act(()=>useStudioStore.getState().redo()); expect(useStudioStore.getState().getActiveDocument().layers[0].nodeIds).toEqual(['image',result.groupNode.id]);
  } finally {cleanup(host,root);}
});

it('panel Expand rejects a locked source image',async()=>{
  const {result,host,root}=setup(); act(()=>useStudioStore.getState().updateDocument(d=>{d.nodes.image.locked=true;},'Lock image'));
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockResolvedValue(result);
  try {await click(host,'Expand Vector'); expect(useStudioStore.getState().getActiveDocument().nodes.image).toBeDefined(); expect(host.querySelector('[role=alert]')?.textContent).toMatch(/locked/);}
  finally {cleanup(host,root);}
});

it('late trace completion is rejected after switching documents',async()=>{
  const {result,host,root}=setup(); let finish!:(value:traceApi.ImageTraceResult)=>void;
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  try {
    act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Trace')!.click());
    const next=createDefaultDocument({id:'second-doc',includeSampleArtwork:false});
    act(()=>useStudioStore.getState().openDocument(next));
    await act(async()=>{finish(result);await Promise.resolve();});
    expect(useStudioStore.getState().getActiveDocument().id).toBe('second-doc');
    expect(useStudioStore.getState().getActiveDocument().nodes[result.groupNode.id]).toBeUndefined(); expect(host.querySelector('[role=alert]')?.textContent).toMatch(/changed/);
  } finally {cleanup(host,root);}
});


it('modal Trace & Expand replaces the source in place and is undoable',async()=>{
  const {result,host,root}=setup();
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockResolvedValue(result);
  try {
    act(()=>{useStudioStore.getState().setActiveModal('image-trace'); root.render(<StudioModals/>);});
    await click(host,'Trace & Expand');
    const doc=useStudioStore.getState().getActiveDocument();
    expect(doc.nodes.image).toBeUndefined(); expect(doc.layers[0].nodeIds).toEqual([result.groupNode.id]);
    expect(()=>validateDocument(doc)).not.toThrow();
    act(()=>useStudioStore.getState().undo()); expect(useStudioStore.getState().getActiveDocument().nodes.image).toBeDefined();
  } finally {cleanup(host,root);}
});

it('panel Expand replaces grouped image in its parent without dangling references',async()=>{
  const {result,host,root}=setup();
  act(()=>useStudioStore.getState().updateDocument(d=>{
    const image=d.nodes.image;
    d.nodes.wrapper={...image,id:'wrapper',name:'wrapper',type:'group',imageUrl:undefined,children:['image']};
    image.parentId='wrapper'; d.layers[0].nodeIds=['wrapper'];
  },'Group fixture'));
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockResolvedValue(result);
  try {
    await click(host,'Expand Vector'); const doc=useStudioStore.getState().getActiveDocument();
    expect(doc.nodes.wrapper.children).toEqual([result.groupNode.id]); expect(doc.nodes.image).toBeUndefined();
    expect(doc.nodes[result.groupNode.id].parentId).toBe('wrapper'); expect(()=>validateDocument(doc)).not.toThrow();
    act(()=>useStudioStore.getState().undo()); expect(useStudioStore.getState().getActiveDocument().nodes.wrapper.children).toEqual(['image']);
  } finally {cleanup(host,root);}
});

it('control bar Expand is disabled for an untraced image',()=>{
  const {host,root}=setup();
  try {
    act(()=>root.render(<ControlBar/>));
    const button=[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Expand')!;
    expect(button.disabled).toBe(true); act(()=>button.click());
    expect(useStudioStore.getState().getActiveDocument().nodes.image.type).toBe('image');
  } finally {cleanup(host,root);}
});

it('rejects results if the source changes while tracing',async()=>{
  const {result,host,root}=setup();let finish!:(value:traceApi.ImageTraceResult)=>void;
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  try {
    act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Expand Vector')!.click());
    act(()=>useStudioStore.getState().updateDocument(d=>{d.nodes.image.x=99;},'Move image'));
    await act(async()=>{finish(result);await Promise.resolve();});
    const current=useStudioStore.getState().getActiveDocument();
    expect(current.nodes.image.x).toBe(99);expect(current.nodes[result.groupNode.id]).toBeUndefined();
    expect(host.querySelector('[role=alert]')?.textContent).toMatch(/changed/);
  } finally {cleanup(host,root);}
});

it('does not commit a modal trace after cancel',async()=>{
  const {result,host,root}=setup();let finish!:(value:traceApi.ImageTraceResult)=>void;
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  try {
    act(()=>{useStudioStore.getState().setActiveModal('image-trace');root.render(<StudioModals/>);});
    act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Trace & Expand')!.click());
    act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Cancel')!.click());
    await act(async()=>{finish(result);await Promise.resolve();});
    const doc=useStudioStore.getState().getActiveDocument();expect(doc.nodes.image).toBeDefined();expect(doc.nodes[result.groupNode.id]).toBeUndefined();
  } finally {cleanup(host,root);}
});

it('rejects locked ancestors and never calls the trace helper',async()=>{
  const {host,root}=setup();
  act(()=>useStudioStore.getState().updateDocument(d=>{const image=d.nodes.image;d.nodes.wrapper={...image,id:'wrapper',type:'group',locked:true,children:['image'],imageUrl:undefined};image.parentId='wrapper';d.layers[0].nodeIds=['wrapper'];},'Group fixture'));
  const helper=vi.spyOn(traceApi,'traceImageNodeToVectorNodes');
  try {await click(host,'Trace');expect(helper).not.toHaveBeenCalled();expect(host.querySelector('[role=alert]')?.textContent).toMatch(/locked/);}
  finally {cleanup(host,root);}
});

it('keeps two rapid trace commands as separate undo steps',async()=>{
  const {result,host,root}=setup();
  const helper=vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockResolvedValueOnce(result).mockImplementation(async()=>{
    const next=structuredClone(result); const old=next.groupNode.id;next.groupNode.id='another-group';next.groupNode.children=next.groupNode.children!.map(id=>'new-'+id);
    next.pathNodes.forEach(path=>{path.id='new-'+path.id;path.parentId='another-group';});expect(old).not.toBe(next.groupNode.id);return next;
  });
  try {
    await click(host,'Trace');act(()=>useStudioStore.getState().selectNodes(['image']));await click(host,'Trace');
    expect(helper).toHaveBeenCalledTimes(2);expect(useStudioStore.getState().getActiveDocument().nodes['another-group']).toBeDefined();
    act(()=>useStudioStore.getState().undo());let doc=useStudioStore.getState().getActiveDocument();expect(doc.nodes['another-group']).toBeUndefined();expect(doc.nodes[result.groupNode.id]).toBeDefined();
    act(()=>useStudioStore.getState().undo());doc=useStudioStore.getState().getActiveDocument();expect(doc.nodes[result.groupNode.id]).toBeUndefined();expect(doc.nodes.image).toBeDefined();
  } finally {cleanup(host,root);}
});

it('retargets saved selections and assets when replacing and restores them on undo',async()=>{
  const {result,host,root}=setup();
  act(()=>useStudioStore.getState().updateDocument(d=>{
    d.exportAssets.push({id:'asset',name:'asset',sourceNodeId:'image',scales:['1x'],formats:['png']});
    d.savedSelections.push({id:'saved',name:'saved',nodeIds:['image']});
  },'Setup references'));
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockResolvedValue(result);
  try {
    await click(host,'Expand Vector'); let doc=useStudioStore.getState().getActiveDocument();
    expect(doc.exportAssets.at(-1)?.sourceNodeId).toBe(result.groupNode.id);
    expect(doc.savedSelections.at(-1)?.nodeIds).toEqual([result.groupNode.id]);
    act(()=>useStudioStore.getState().undo());doc=useStudioStore.getState().getActiveDocument();
    expect(doc.exportAssets.at(-1)?.sourceNodeId).toBe('image');expect(doc.savedSelections.at(-1)?.nodeIds).toEqual(['image']);
  } finally {cleanup(host,root);}
});

it('rejects invalid trace IDs without changing the source or history',async()=>{
  const {result,host,root}=setup();result.groupNode.id='image';
  vi.spyOn(traceApi,'traceImageNodeToVectorNodes').mockResolvedValue(result);
  try {const before=useStudioStore.getState().historyIndex;await click(host,'Expand Vector');
    expect(useStudioStore.getState().getActiveDocument().nodes.image.type).toBe('image');
    expect(useStudioStore.getState().historyIndex).toBe(before);expect(host.querySelector('[role=alert]')?.textContent).toMatch(/conflicting IDs/);
  } finally {cleanup(host,root);}
});

it('traces through the real helper with a mocked bitmap and roundtrips the result',async()=>{
  const {host,root}=setup();
  const {exportDocumentToSvgString}=await import('../core/io/svgIo');
  const {packDocumentToAdlozeBytes,unpackAdlozeBytesToDocument}=await import('../core/io/adlozeIo');
  vi.stubGlobal('Image',class {width=20;height=20;crossOrigin='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(_v:string){queueMicrotask(()=>this.onload?.());}});
  const context={drawImage(){},getImageData(_x:number,_y:number,w:number,h:number){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data[i+3]=255;return {data};}};
  const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as any);
  try {
    await click(host,'Trace');const doc=useStudioStore.getState().getActiveDocument();
    expect(doc.layers[0].nodeIds).toHaveLength(2);expect(()=>validateDocument(doc)).not.toThrow();
    expect(exportDocumentToSvgString(doc)).toContain('<path');
    const restored=unpackAdlozeBytesToDocument(packDocumentToAdlozeBytes(doc)).document;
    expect(restored.layers[0].nodeIds).toEqual(doc.layers[0].nodeIds);expect(()=>validateDocument(restored)).not.toThrow();
  } finally {spy.mockRestore();vi.unstubAllGlobals();cleanup(host,root);}
});
