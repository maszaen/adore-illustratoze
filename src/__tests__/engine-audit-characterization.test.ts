// @vitest-environment jsdom
// Characterization of observed defects, NOT desired behavior. Update these assertions when fixed.
import { describe, expect, it, vi } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createFromSpec } from '../agent/design';
import { parseSvgPathDToAnchorPoints, parseSvgStringToVectorNodes, exportDocumentToSvgString } from '../core/io/svgIo';
import { exportDocumentToDataUrl, renderDocumentToCanvas } from '../core/io/rasterExport';
import { exportDocumentToPdfBytes } from '../core/io/pdfExport';
import { convertTextNodeToOutlineNodes } from '../core/io/opentypeHelper';
import { offsetVectorNode } from '../core/math/pathfinder';

const fixture = () => createFromSpec({version:1,document:{name:'audit',width:200,height:200},operations:[
  {op:'rectangle',id:'rect',layer:'artwork',x:10,y:20,width:80,height:20,fill:'#ff0000'},
  {op:'text',id:'label',layer:'artwork',x:10,y:80,text:'O',fontSize:30},
]});
const noMarks={trimMarks:false,registrationMarks:false,colorBars:false,pageInformation:false};
async function pdfStream(doc: ReturnType<typeof fixture>) {
  const pdf=await PDFDocument.load(await exportDocumentToPdfBytes(doc,noMarks));
  const contents=pdf.getPages()[0].node.Contents() as PDFArray;
  return new TextDecoder().decode(decodePDFRawStream(pdf.context.lookup(contents.get(0)) as PDFRawStream).decode());
}
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
  it('PDF ignores rectangle rotation and fails on emoji', async () => {
    const doc=fixture(), rotated=structuredClone(doc); rotated.nodes.rect.rotation=90;
    expect(await pdfStream(doc)).toEqual(await pdfStream(rotated));
    doc.nodes.label.textContent='Hello 😀';
    await expect(exportDocumentToPdfBytes(doc,noMarks)).rejects.toThrow(/WinAnsi/);
  });
  it('text outlines drop inner contours for O', () => {
    const result=convertTextNodeToOutlineNodes(fixture().nodes.label);
    expect(result.childNodes[0].type).toBe('compound-path');
    expect(result.childNodes[0].points.some(p=>p.moveTo)).toBe(false);
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
  it('raster paints layers in reverse of the SVG stacking order', () => {
    const doc=createFromSpec({version:1,document:{name:'layers',width:100,height:100},operations:[
      {op:'rectangle',id:'bottom',layer:'artwork',x:0,y:0,width:20,height:20,fill:'#0000ff'},
      {op:'layer',id:'top',name:'top'},
      {op:'rectangle',id:'top-box',layer:'top',x:0,y:0,width:20,height:20,fill:'#ff0000'},
    ]});
    const colors:string[]=[];
    const context={fillStyle:'',save(){},restore(){},scale(){},translate(){},fill(){colors.push(this.fillStyle);},globalAlpha:1};
    const create=vi.spyOn(document,'createElement').mockReturnValue({width:0,height:0,getContext:()=>context} as any);
    vi.stubGlobal('Path2D',class { constructor(_d:string){} });
    try {
      renderDocumentToCanvas(doc); expect(colors).toEqual(['#ff0000','#0000ff']);
      const svg=exportDocumentToSvgString(doc); expect(svg.indexOf('id="bottom"')).toBeLessThan(svg.indexOf('id="top-box"'));
    } finally {create.mockRestore();vi.unstubAllGlobals();}
  });
  it('raster does not call drawImage for an image node', () => {
    const doc=fixture(); doc.layers[0].nodeIds=['rect']; delete doc.nodes.label; doc.nodes.rect.type='image'; doc.nodes.rect.imageUrl='data:image/png;base64,AAAA';
    const drawImage=vi.fn(); const context={save(){},restore(){},scale(){},translate(){},fill(){},drawImage,globalAlpha:1};
    const create=vi.spyOn(document,'createElement').mockReturnValue({width:0,height:0,getContext:()=>context} as any);
    vi.stubGlobal('Path2D',class { constructor(_d:string){} });
    try {renderDocumentToCanvas(doc); expect(drawImage).not.toHaveBeenCalled(); expect(exportDocumentToSvgString(doc)).toContain('<image');}
    finally {create.mockRestore();vi.unstubAllGlobals();}
  });
  it('raster ignores gradient-stop opacity; SVG writes the opacity', () => {
    const doc=createFromSpec({version:1,document:{name:'gradient',width:100,height:100},operations:[{op:'rectangle',id:'g',layer:'artwork',x:0,y:0,width:50,height:50,fill:{type:'linear',stops:[{offset:0,color:'#ff0000',opacity:0},{offset:1,color:'#0000ff',opacity:1}]}}]});
    const addColorStop=vi.fn();
    const context={save(){},restore(){},scale(){},translate(){},fill(){},fillRect(){},globalAlpha:1,createLinearGradient(){return {addColorStop};}};
    const canvas={width:0,height:0,getContext:()=>context};
    const create=vi.spyOn(document,'createElement').mockReturnValue(canvas as any);
    const path=vi.stubGlobal('Path2D',class { constructor(_d:string){} });
    try { renderDocumentToCanvas(doc); expect(addColorStop).toHaveBeenCalledWith(0,'#ff0000'); expect(exportDocumentToSvgString(doc)).toContain('stop-opacity="0"'); }
    finally {create.mockRestore();path.unstubAllGlobals();}
  });
});
