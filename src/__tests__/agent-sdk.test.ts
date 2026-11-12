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
