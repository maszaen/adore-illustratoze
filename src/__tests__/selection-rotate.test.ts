import { describe, expect, it } from 'vitest';
import { computeBoundingBoxFromAnchors, createEllipseAnchors, createRectangleAnchors } from '../core/math/bezier';
import { rotateNodeAround, rotatePointAround } from '../core/math/selectionRotate';
import type { VectorNode } from '../core/types';

const base = (overrides: Partial<VectorNode> = {}): VectorNode => ({
  id:'shape', name:'shape', type:'path', layerId:'l', visible:true, locked:false,
  x:10, y:20, width:100, height:50, rotation:0, points:createRectangleAnchors(10,20,100,50), closed:true,
  fills:[], strokes:[{ id:'s', visible:true, color:'#000', weight:2, opacity:1, blendMode:'normal', cap:'round', join:'round', miterLimit:10, align:'center', dashArray:[] }], effects:[], opacity:1, blendMode:'normal', ...overrides,
});
const closePoint = (actual: {x:number; y:number}, expected: {x:number; y:number}) => {
  expect(actual.x).toBeCloseTo(expected.x, 6); expect(actual.y).toBeCloseTo(expected.y, 6);
};

describe('rotation geometry', () => {
  it('rotates stroke-only rectangle once and updates its bounds', () => {
    const node = base({ type:'rectangle' });
    const result = rotateNodeAround(node, {x:60,y:45}, 90);
    expect(result.rotation).toBe(0); expect(result.x).toBeCloseTo(35); expect(result.y).toBeCloseTo(-5);
    expect(result.width).toBeCloseTo(50); expect(result.height).toBeCloseTo(100);
    closePoint(result.points[0], {x:85,y:-5});
    expect(result.fills).toEqual([]); expect(result.strokes).toEqual(node.strokes);
  });
  it('rotates cubic handles along with anchors without changing their relative lengths', () => {
    const points = createEllipseAnchors(10,20,100,50);
    const node = base({ type:'path', points }); const pivot = {x:250,y:80};
    const result = rotateNodeAround(node, pivot, 63);
    points.forEach((p, i) => {
      closePoint(result.points[i], rotatePointAround(p, pivot, 63*Math.PI/180));
      if (p.handleOut) closePoint(result.points[i].handleOut!, rotatePointAround(p.handleOut, pivot, 63*Math.PI/180));
      if (p.handleIn) closePoint(result.points[i].handleIn!, rotatePointAround(p.handleIn, pivot, 63*Math.PI/180));
    });
  });
  it('composes an existing rotation once before the new rotation', () => {
    const node = base({rotation: 30}); const pivot = {x:60,y:45};
    const result = rotateNodeAround(node,pivot,60);
    closePoint(result.points[0], rotatePointAround(node.points[0],pivot,Math.PI/2));
    expect(result.rotation).toBe(0);
  });
  it('keeps text dimensions and moves its centre about a custom pivot', () => {
    const node = base({type:'text', rotation:30}); const pivot = {x:0,y:0};
    const result = rotateNodeAround(node,pivot,90);
    closePoint({x:result.x+result.width/2,y:result.y+result.height/2}, {x:-45,y:60});
    expect(result.width).toBe(100); expect(result.height).toBe(50); expect(result.rotation).toBe(120);
  });
  it('rotates multiple objects around a shared pivot without changing their separation', () => {
    const a = base({ id:'a', x:0, y:0, width:20, height:10, points:createRectangleAnchors(0,0,20,10) });
    const b = base({ id:'b', x:100, y:0, width:20, height:10, points:createRectangleAnchors(100,0,20,10) });
    const pivot = {x:60,y:5};
    const ar = rotateNodeAround(a,pivot,90), br = rotateNodeAround(b,pivot,90);
    const center = (n: VectorNode) => ({x:n.x+n.width/2,y:n.y+n.height/2});
    closePoint(center(ar), {x:60,y:-45}); closePoint(center(br), {x:60,y:55});
  });
  it('does not join separate open contours when measuring rotated geometry', () => {
    const points: VectorNode['points'] = [
      { id:'a', x:0, y:0, pointType:'corner' },
      { id:'b', x:10, y:0, pointType:'smooth', handleOut:{x:1000,y:500} },
      { id:'c', x:20, y:0, pointType:'corner', moveTo:true },
      { id:'d', x:30, y:0, pointType:'corner' },
    ];
    const bounds = computeBoundingBoxFromAnchors(points, false);
    expect(bounds.x).toBe(0); expect(bounds.width).toBe(30); expect(bounds.height).toBe(1);
    const out = rotateNodeAround(base({ points, closed:false, x:0, y:0, width:30, height:1 }), {x:0,y:0},90);
    expect(out.points[2].moveTo).toBe(true);
    expect(out.width).toBeCloseTo(1); expect(out.height).toBeCloseTo(30);
  });
  it('does not alter geometry for zero angle', () => {
    const node = base({rotation: 30}); expect(rotateNodeAround(node,{x:0,y:0},0)).toBe(node);
  });
});
