import { describe, expect, it } from 'vitest';
import { applyOperations, createFromSpec, inspectDesign, previewDesign, readDesign, validateDocument, writeDesign } from '../agent/design';
import { useStudioStore } from '../state/useStudioStore';
import { createDefaultDocument } from '../core/presets/defaultPresets';

const make = () => createFromSpec({ version: 1, document: { name: 'Demo', width: 500, height: 400 }, operations: [
  { op:'rectangle', id:'bg', layer:'artwork', x:0, y:0, width:500, height:400, fill:'#ff0000' },
  { op:'layer', id:'copy', name:'Copy' },
  { op:'text', id:'title', layer:'copy', x:10, y:20, text:'Hello', fontSize:40, fill:'#000000' },
  { op:'path', id:'curve', layer:'copy', points:[{x:10,y:100,handleOut:{x:20,y:50}},{x:100,y:100,handleIn:{x:90,y:50}}], closed:false, stroke:'#123456', strokeWidth:2 },
] });

describe('external agent SDK', () => {
  it('roundtrips editable nodes and opens the result in the editor', () => {
    const original=make(), bytes=writeDesign(original), doc=readDesign(bytes);
    expect(doc.nodes.title.type).toBe('text'); expect(doc.nodes.title.textContent).toBe('Hello');
    expect(doc.layers[0].name).toBe('Copy'); expect(doc.nodes.curve.points[0].handleOut).toEqual({x:20,y:50});
    expect(previewDesign(doc)).toContain('<text'); expect(inspectDesign(doc).nodes.some(n=>n.id==='title')).toBe(true);
    useStudioStore.getState().openDocument(doc); expect(useStudioStore.getState().getActiveDocument().nodes.title.textContent).toBe('Hello');
  });
  it('applies revisions atomically and preserves unrelated data and identity', () => {
    const doc=make(), snapshot=structuredClone(doc);
    expect(() => applyOperations(doc,[{op:'update',id:'title',text:'Changed'},{op:'delete',id:'missing'}])).toThrow('not found');
    expect(doc).toEqual(snapshot);
    const next=applyOperations(doc,[{op:'update',id:'title',text:'Changed',fontSize:50,x:30},{op:'update',id:'curve',x:20,y:60}]);
    expect(next.nodes.title.textContent).toBe('Changed'); expect(next.nodes.title.textStyle?.fontSize).toBe(50);
    expect(next.nodes.curve.points[0].handleOut).toEqual({x:30,y:60});
    expect(next.nodes.bg).toEqual(doc.nodes.bg); expect(next.id).toBe(doc.id); expect(doc).toEqual(snapshot);
  });
  it('rejects invalid specs, duplicate IDs, unsupported fields and locked nodes', () => {
    expect(() => createFromSpec({ version: 1, document:{name:'Bad',width:100,height:100}, operations:[{op:'rectangle',id:'x',layer:'artwork',x:0,y:0,width:-1,height:10}] })).toThrow();
    expect(() => applyOperations(make(),[{op:'update',id:'title',foo:'bar'}])).toThrow('unknown field');
    expect(() => applyOperations(make(),[{op:'layer',id:'artwork',name:'dup'}])).toThrow('already exists');
    expect(() => applyOperations(make(),[{op:'text',id:'__proto__',layer:'copy',x:0,y:0,text:'x',fontSize:10}])).toThrow('invalid ID');
    const doc=make(); doc.layers[0].locked=true;
    expect(() => applyOperations(doc,[{op:'update',id:'title',text:'test'}])).toThrow('locked');
  });
  it('validates missing references and supports normal blank editor documents', () => {
    validateDocument(createDefaultDocument({ includeSampleArtwork:false }));
    const doc=make(); doc.layers[0].nodeIds.push('missing'); expect(()=>validateDocument(doc)).toThrow('invalid node');
  });
});

describe('agent authoring improvements', () => {
  const gradient = {type:'linear',angle:45,stops:[{offset:0,color:'#112233',opacity:0.25},{offset:1,color:'#abcdef'}]};
  it('creates editable gradients, opacity and parametric shapes, and roundtrips their previews', () => {
    const doc=applyOperations(make(),[
      {op:'rectangle',id:'round',layer:'artwork',x:10,y:20,width:100,height:60,cornerRadius:12,fill:gradient,opacity:0.6,rotation:30},
      {op:'polygon',id:'poly',layer:'artwork',x:0,y:0,width:80,height:80,sides:6,fill:{...gradient,type:'radial'}},
      {op:'star',id:'star',layer:'artwork',x:0,y:0,width:100,height:80,sides:5,innerRadius:0.4,cornerRadius:3},
    ]);
    const loaded=readDesign(writeDesign(doc));
    expect(loaded.nodes.round.fills[0].gradient?.stops[0].opacity).toBe(0.25);
    expect(loaded.nodes.round.points[0].cornerRadius).toBe(12);
    expect(loaded.nodes.poly.points).toHaveLength(6); expect(loaded.nodes.star.points).toHaveLength(10);
    const svg=previewDesign(loaded); expect(svg).toContain('<linearGradient'); expect(svg).toContain('<radialGradient'); expect(svg).toContain('stop-opacity="0.25"'); expect(svg).toContain('rotate(30'); expect(svg).toContain('opacity="0.6"');
    const roundedPath=svg.match(/<path id="round"[^>]*>/)?.[0]; expect(roundedPath).toMatch(/[QC]/);
    const summary=inspectDesign(loaded).nodes.find(n=>n.id==='round')!;
    expect(summary.fills[0].gradient?.type).toBe('linear'); expect(summary.bounds.width).toBeGreaterThan(0);
    summary.fills[0].gradient!.stops[0].color='#ffffff'; expect(loaded.nodes.round.fills[0].gradient!.stops[0].color).toBe('#112233');
  });
  it('moves, resizes and rotates editable vectors without losing handles or styles', () => {
    const doc=make();
    const changed=applyOperations(doc,[{op:'update',id:'curve',x:20,y:60,width:180,height:100,rotation:45,opacity:0.4,fill:gradient}]);
    const n=changed.nodes.curve;
    expect(n.points[0].x).toBe(20); expect(n.points[0].y).toBe(160); expect(n.points[0].handleOut).toEqual({x:40,y:60});
    expect(n.width).toBe(180); expect(n.height).toBe(100); expect(n.rotation).toBe(45); expect(n.opacity).toBe(0.4);
    expect(n.strokes[0].color).toBe('#123456'); expect(doc.nodes.curve.rotation).toBe(0);
    expect(inspectDesign(changed).nodes.find(n=>n.id==='curve')?.points[0].handleOut).toEqual({x:40,y:60});
  });
  it('rejects invalid styles and unsupported resizes atomically', () => {
    const doc=make(), before=structuredClone(doc);
    for (const op of [
      {op:'update',id:'bg',opacity:2},
      {op:'update',id:'title',width:10},
      {op:'update',id:'bg',fill:{...gradient,stops:[{offset:0.9,color:'#000000'},{offset:0.2,color:'#ffffff'}]}},
      {op:'update',id:'bg',fill:{...gradient,type:'freeform'}},
      {op:'star',id:'bad',layer:'artwork',x:0,y:0,width:10,height:10,sides:3.5},
    ]) expect(()=>applyOperations(doc,[{op:'update',id:'bg',x:20},op])).toThrow();
    expect(doc).toEqual(before);
  });
  it('uses distinct SVG gradient IDs even when object IDs differ only by punctuation', () => {
    const doc=applyOperations(make(),[
      {op:'rectangle',id:'a-b',layer:'artwork',x:0,y:0,width:10,height:10,fill:gradient},
      {op:'rectangle',id:'ab',layer:'artwork',x:20,y:0,width:10,height:10,fill:{...gradient,type:'radial'}},
    ]);
    const svg=previewDesign(doc); const ids=[...svg.matchAll(/<(?:linear|radial)Gradient id="([^"]+)"/g)].map(m=>m[1]);
    expect(new Set(ids).size).toBe(ids.length); expect(ids).toHaveLength(2);
  });
});
