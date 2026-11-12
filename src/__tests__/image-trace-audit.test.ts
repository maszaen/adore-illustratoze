// Characterization tests: these document current behavior, not the desired specification.
import { describe, expect, it } from 'vitest';
import { traceImageDataToVectorNodes } from '../core/io/imageTrace';

const image = (w:number,h:number,pixel:(x:number,y:number)=>[number,number,number,number]) => {
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) data.set(pixel(x,y),(y*w+x)*4);
  return {width:w,height:h,data};
};
const bounds={x:0,y:0,width:20,height:20};
const black:[number,number,number,number]=[0,0,0,255], clear:[number,number,number,number]=[0,0,0,0];
const geometry=(result:ReturnType<typeof traceImageDataToVectorNodes>)=>result.pathNodes.map(n=>({points:n.points.map(({x,y,handleIn,handleOut,pointType})=>({x,y,handleIn,handleOut,pointType})),fills:n.fills.map(f=>({color:f.color,opacity:f.opacity})),strokes:n.strokes.map(s=>({color:s.color,weight:s.weight}))}));
const trace=(img:ReturnType<typeof image>, options:Parameters<typeof traceImageDataToVectorNodes>[3]={})=>traceImageDataToVectorNodes(img,bounds,'artwork',{noise:1,...options});

describe('Image Trace audit — characterization, not correct behavior',()=>{
  it('ignores method setting for the same image and settings',()=>{
    const bitmap=image(20,20,(x,y)=>x>2&&x<17&&y>2&&y<17?black:clear);
    expect(geometry(trace(bitmap,{method:'abutting'}))).toEqual(geometry(trace(bitmap,{method:'overlapping'})));
  });
  it('outputs one solid exterior for a black ring with a transparent hole',()=>{
    const bitmap=image(20,20,(x,y)=>x>=2&&x<18&&y>=2&&y<18&&!(x>=6&&x<14&&y>=6&&y<14)?black:clear);
    const result=trace(bitmap);
    expect(result.pathCount).toBe(1);
    expect(result.pathNodes[0].fills[0].color).toBe('#141414');
    expect(result.pathNodes[0].points.some(p=>p.moveTo)).toBe(false);
  });
  it('uses the same opaque fill for half-transparent and opaque pixels',()=>{
    const bitmap=(alpha:number)=>image(20,20,(x,y)=>x>=2&&x<18&&y>=2&&y<18?[255,0,0,alpha]:clear);
    const a=trace(bitmap(128),{mode:'color'}), b=trace(bitmap(255),{mode:'color'});
    expect(geometry(a)).toEqual(geometry(b)); expect(a.pathNodes[0].opacity).toBe(1); expect(a.pathNodes[0].fills[0].opacity).toBe(1);
  });
  it('permits invisible paths when both fills and strokes are disabled',()=>{
    const bitmap=image(20,20,(x,y)=>x>=2&&x<18&&y>=2&&y<18?black:clear);
    const result=trace(bitmap,{fills:false,strokes:false});
    expect(result.pathCount).toBeGreaterThan(0); expect(result.pathNodes[0].fills).toHaveLength(0); expect(result.pathNodes[0].strokes).toHaveLength(0);
  });
});

it('thin 1-pixel line becomes a zero-area closed filled path',()=>{
  const bitmap=image(20,20,(x,y)=>y===10&&x>=2&&x<18?black:clear);
  const result=trace(bitmap,{paths:100});
  expect(result.pathCount).toBe(1);
  const n=result.pathNodes[0];
  expect(n.closed).toBe(true); expect(n.strokes).toHaveLength(0);
  expect(n.points.every(p=>p.y===10 && (!p.handleIn || p.handleIn.y===10) && (!p.handleOut || p.handleOut.y===10))).toBe(true);
});
