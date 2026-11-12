// @vitest-environment jsdom
// Characterization of current image sampling and transforms.
import { expect, it, vi } from 'vitest';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { traceImageNodeToVectorNodes } from '../core/io/imageTrace';

it('always samples landscape at 96 px wide, enlarges tiny bounds and drops rotation',async()=>{
  const doc=createDefaultDocument(); const node={...doc.nodes[doc.layers[0].nodeIds[0]],type:'image' as const,imageUrl:'data:image/png;base64,AA',x:5,y:6,width:8,height:10,rotation:90};
  vi.stubGlobal('Image',class { width=4000; height=2000; crossOrigin=''; onload:()=>void=()=>{}; onerror=()=>{}; set src(_v:string){queueMicrotask(()=>this.onload());} });
  const drawImage=vi.fn();
  const getImageData=vi.fn((_x:number,_y:number,w:number,h:number)=>{const data=new Uint8ClampedArray(w*h*4); for(let i=0;i<data.length;i+=4)data[i+3]=255;return {data};});
  const create=vi.spyOn(document,'createElement').mockReturnValue({width:0,height:0,getContext:()=>({drawImage,getImageData})} as any);
  try {
    const result=await traceImageNodeToVectorNodes(node,{noise:1});
    expect(getImageData).toHaveBeenCalledWith(0,0,96,48);
    expect([result.groupNode.x,result.groupNode.y,result.groupNode.width,result.groupNode.height,result.groupNode.rotation]).toEqual([5,6,20,20,0]);
  } finally {create.mockRestore();vi.unstubAllGlobals();}
});

it('can cancel a pending image load without producing vector output',async()=>{
  const doc=createDefaultDocument(); const node={...doc.nodes[doc.layers[0].nodeIds[0]],type:'image' as const,imageUrl:'data:image/png;base64,AA'};
  vi.stubGlobal('Image',class { width=1;height=1;crossOrigin='';onload=null;onerror=null;set src(_value:string){} });
  try {const controller=new AbortController(); const promise=traceImageNodeToVectorNodes(node,{},controller.signal);controller.abort();await expect(promise).rejects.toThrow(/cancelled/);}
  finally {vi.unstubAllGlobals();}
});
