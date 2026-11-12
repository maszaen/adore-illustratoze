import { describe, expect, it } from 'vitest';
import { collectSnapTargets, movingSelectionBounds, snapMove } from '../core/math/snapping';
import { createRectangleAnchors } from '../core/math/bezier';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import type { VectorNode } from '../core/types';

const node = (id: string, x: number, y: number, w=40, h=40): VectorNode => ({ id, name:id, type:'rectangle', layerId:'layer', x,y,width:w,height:h,rotation:0,points:createRectangleAnchors(x,y,w,h), closed:true, visible:true,locked:false,fills:[],strokes:[],effects:[],opacity:1,blendMode:'normal' });
const opt = { zoom:1, smart:true, grid:false, gridOrigin:{x:0,y:0} };
const target = (value:number) => ({value,from:200,to:250,label:'bounds'});

describe('geometry-based snapping', () => {
  it('snaps moving edge and center independently to target geometry', () => {
    const box={x:100,y:100,width:40,height:40};
    const edge=snapMove(box,{x:159,y:0},{x:[target(300)],y:[]},opt);
    expect(edge.delta.x).toBe(160); expect(edge.guide?.lineX?.x).toBe(300);
    const center=snapMove(box,{x:177,y:0},{x:[target(300)],y:[]},opt);
    expect(center.delta.x).toBe(180); expect(center.guide?.lineX?.x).toBe(300);
    expect(center.guide?.lineX?.y1).toBeLessThan(100); expect(center.guide?.lineX?.y2).toBeGreaterThan(250);
  });
  it('selects the closest candidate, not the first in document order', () => {
    const result=snapMove({x:100,y:100,width:40,height:40},{x:159,y:0},{x:[target(304),target(300)],y:[]},opt);
    expect(result.delta.x).toBe(160); expect(result.guide?.x).toBe(300);
  });
  it('uses screen-pixel tolerance at different zoom levels', () => {
    const b={x:100,y:100,width:40,height:40}, targets={x:[target(300)],y:[]};
    expect(snapMove(b,{x:155,y:0},targets,opt).delta.x).toBe(160);
    expect(snapMove(b,{x:155,y:0},targets,{...opt,zoom:2}).delta.x).toBe(155);
    expect(snapMove(b,{x:152,y:0},targets,{...opt,zoom:0.5}).delta.x).toBe(160);
  });
  it('keeps Shift axis locked and uses grid origin and visible 20-unit spacing', () => {
    const b={x:103,y:112,width:40,height:40};
    const result=snapMove(b,{x:14,y:0},{x:[],y:[target(115)]},{...opt,smart:false,grid:true,gridOrigin:{x:7,y:3},axis:'x'});
    expect(result.delta).toEqual({x:24,y:0});
    const smart=snapMove(b,{x:0,y:4},{x:[target(105)],y:[target(120)]},{...opt,axis:'y'});
    expect(smart.delta.x).toBe(0); expect(smart.delta.y).toBe(8);
    expect(smart.guide?.lineX).toBeUndefined();
  });
  it('respects disabled snap settings', () => {
    const b={x:103,y:109,width:40,height:40};
    expect(snapMove(b,{x:2.3,y:7.7},{x:[target(105)],y:[target(120)]},{...opt,smart:false}).delta).toEqual({x:2.3,y:7.7});
  });
  it('excludes selected and hidden objects, but allows locked targets and visible guides', () => {
    const doc=createDefaultDocument({includeSampleArtwork:false});const layer=doc.layers[0];
    const a={...node('a',100,100),layerId:layer.id}, b={...node('b',300,100),layerId:layer.id,locked:true};
    const hidden={...node('hidden',500,100),layerId:layer.id,visible:false};
    doc.nodes={a,b,hidden};doc.guides=[{id:'g',orientation:'vertical',position:701,locked:true}];
    const targets=collectSnapTargets(doc,['a'],true);
    expect(targets.x.some(t=>t.value===100)).toBe(false);
    expect(targets.x.some(t=>t.value===300)).toBe(true);
    expect(targets.x.some(t=>t.value===500)).toBe(false);
    expect(targets.x.some(t=>t.value===701 && t.label==='guide')).toBe(true);
    expect(collectSnapTargets(doc,['a'],false).x.some(t=>t.value===701)).toBe(false);
  });
  it('uses visual bounds for rotated objects', () => {
    const shape={...node('rotated',0,0,100,50),rotation:90};
    const text={...shape,type:'text' as const};
    for (const n of [shape,text]) {
      const b=movingSelectionBounds({[n.id]:n})!;
      expect(b.x).toBeCloseTo(25); expect(b.y).toBeCloseTo(-25);
      expect(b.width).toBeCloseTo(50); expect(b.height).toBeCloseTo(100);
    }
  });
  it('uses the combined visible geometry of moving group descendants', () => {
    const a=node('a',10,20), b=node('b',100,30,20,20), hidden={...node('hidden',1000,1000),visible:false};
    const parent={...node('group',0,0,1,1),type:'group' as const,children:['a','b','hidden']};
    expect(movingSelectionBounds({parent,a,b,hidden})).toEqual({x:10,y:20,width:110,height:40});
  });
});
