// @vitest-environment jsdom
// Characterization of observed defects, NOT desired behavior. Update these assertions when fixed.
// Fixed since the audit (moved to render-consistency.test.ts): raster/PDF layer order, gradient stop opacity,
// PDF rotation and Unicode text, clipping masks. Text outlines moved to text-outline.test.ts.
import { describe, expect, it, vi } from 'vitest';
import { createFromSpec } from '../agent/design';
import { parseSvgPathDToAnchorPoints, parseSvgStringToVectorNodes, exportDocumentToSvgString } from '../core/io/svgIo';
import { exportDocumentToDataUrl, renderDocumentToCanvas } from '../core/io/rasterExport';
import { offsetVectorNode } from '../core/math/pathfinder';

const fixture = () => createFromSpec({version:1,document:{name:'audit',width:200,height:200},operations:[
  {op:'rectangle',id:'rect',layer:'artwork',x:10,y:20,width:80,height:20,fill:'#ff0000'},
  {op:'text',id:'label',layer:'artwork',x:10,y:80,text:'O',fontSize:30},
]});
describe('engine audit characterization — replace with desired behavior when fixed', () => {
  it('SVG import ignores group transform and inherited fill', () => {
    const svg='<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(40,20)" fill="#ff0000"><rect id="box" x="1" y="2" width="10" height="10"/></g></svg>';
    const n=parseSvgStringToVectorNodes(svg).nodes.find(n=>n.name==='box')!;
    expect([n.x,n.y,n.fills[0].color]).toEqual([1,2,'#000000']);
  });
  it('different SVG arc sweep flags produce identical geometry', () => {
    const a=parseSvgPathDToAnchorPoints('M 0 0 A 50 50 0 0 0 100 0');
    const b=parseSvgPathDToAnchorPoints('M 0 0 A 50 50 0 0 1 100 0');
    const geometry=(v:typeof a)=>v.points.map(({x,y,handleIn,handleOut})=>({x,y,handleIn,handleOut}));
    expect(geometry(a)).toEqual(geometry(b));
  });
  it('offsetting rotated vectors leaves the rotation on already-rotated geometry', () => {
    const doc=fixture(); doc.nodes.rect.rotation=90;
    const result=offsetVectorNode(doc.nodes.rect,5);
    expect(result.rotation).toBe(90);
    expect(result.height).toBeGreaterThan(result.width);
  });
  it('raster export reports a canvas failure instead of returning a fake JPEG', () => {
    const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>{throw new Error('canvas failed');});
    try { expect(() => exportDocumentToDataUrl(fixture(),{format:'jpg'})).toThrow('canvas failed'); }
    finally { spy.mockRestore(); }
  });
  it('raster does not call drawImage for an image node', () => {
    const doc=fixture(); doc.layers[0].nodeIds=['rect']; delete doc.nodes.label; doc.nodes.rect.type='image'; doc.nodes.rect.imageUrl='data:image/png;base64,AAAA';
    const drawImage=vi.fn();
    const context=new Proxy({globalAlpha:1,drawImage} as Record<string,any>,{get:(t,p:string)=>p in t?t[p]:()=>undefined,set:(t,p:string,v)=>{t[p]=v;return true;}});
    const create=vi.spyOn(document,'createElement').mockReturnValue({width:0,height:0,getContext:()=>context} as any);
    vi.stubGlobal('Path2D',class { constructor(_d:string){} });
    try {renderDocumentToCanvas(doc); expect(drawImage).not.toHaveBeenCalled(); expect(exportDocumentToSvgString(doc)).toContain('<image');}
    finally {create.mockRestore();vi.unstubAllGlobals();}
  });
});
