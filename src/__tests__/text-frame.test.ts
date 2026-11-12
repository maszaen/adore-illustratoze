// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { fitPointTextFrame, layoutText, textGlyphTransform, type TextMeasurer } from '../core/math/textLayout';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import { renderDocumentToCanvas } from '../core/io/rasterExport';
import { exportDocumentToPdfBytes } from '../core/io/pdfExport';
import type { VectorNode } from '../core/types';

function textNode(): VectorNode {
  const doc = createDefaultDocument();
  const node = Object.values(doc.nodes).find(n => n.type === 'text')!;
  return { ...node, x: 10, y: 20, width: 100, height: 24, textContent: 'ABCDE', points: createRectangleAnchors(10, 20, 100, 24), textStyle: { ...node.textStyle!, fontSize: 20, leading: 24, tracking: 0, typeMode: 'point' } };
}
const measure: TextMeasurer = (text, size) => Array.from(text).length * size * 0.5;

describe('Text frame fitting', () => {
  it('measures point text instead of shrinking it to a fixed frame', () => {
    const node = textNode();
    expect(layoutText({ ...node, width: 5, height: 5 }, measure).fontSize).toBe(20);
    const fitted = fitPointTextFrame(node, measure);
    expect(fitted.width).toBe(52);
    expect(fitted.height).toBe(26);
    expect(fitPointTextFrame({ ...node, textContent: 'ABCDEFGHIJ' }, measure).width).toBe(102);
  });

  it('preserves independent point text scale and mirrored anchors during reflow', () => {
    const base = textNode();
    const node = { ...base, textStyle: { ...base.textStyle!, align: 'left' as const }, textScaleX: -2, textScaleY: 0.5 };
    const fitted = fitPointTextFrame(node, measure);
    expect(fitted.width).toBe(104);
    expect(fitted.height).toBe(13);
    expect(fitted.x + fitted.width).toBe(node.x + node.width);
    const matrix = textGlyphTransform(fitted);
    expect(matrix.sx).toBe(-2); expect(matrix.sy).toBe(0.5);
    expect(matrix.sx * fitted.x + matrix.tx).toBeCloseTo(fitted.x + fitted.width);
    const area = { ...node, textStyle: { ...node.textStyle!, typeMode: 'area' as const } };
    expect(textGlyphTransform(area)).toEqual({ sx: 1, sy: 1, tx: 0, ty: 0 });
  });

  it('leaves area text unwrapped by default and wraps only on request', () => {
    const node = textNode();
    node.width = 25; node.height = 24; node.textContent = 'ABCDEFGHIJ'; node.textStyle!.typeMode = 'area';
    const unwrapped = layoutText(node, measure);
    expect(unwrapped.lines).toEqual(['ABCDEFGHIJ']);
    expect(unwrapped.overflow).toBe(true);
    node.textStyle!.wrapInFrame = true;
    const wrapped = layoutText(node, measure);
    expect(wrapped.lines.join('')).toBe('ABCDEFGHIJ');
    expect(wrapped.lines.every(line => measure(line, wrapped.fontSize, node) <= node.width)).toBe(true);
    expect(wrapped.overflow).toBe(true);
  });

  it('exports text with a frame clip to SVG, canvas and PDF', async () => {
    const doc = createDefaultDocument({ includeSampleArtwork: false, width: 200, height: 200 });
    const node = textNode(); node.id = 'text-fixture'; node.layerId = doc.layers[0].id;
    doc.nodes = { [node.id]: node }; doc.layers[0].nodeIds = [node.id];
    node.textScaleX = 1.5; node.textScaleY = 0.7;
    const svg = exportDocumentToSvgString(doc);
    expect(svg).toContain('matrix(1.5 0 0 0.7');
    expect(svg).toMatch(/<clipPath id="text_clip_1"/);
    expect(svg).toContain('clip-path="url(#text_clip_1)"');
    const calls: string[] = [];
    const ctx = new Proxy({ globalAlpha: 1 }, { get(target: any, prop: string) { return prop in target ? target[prop] : () => { calls.push(prop); }; }, set(target: any, prop: string, val) { target[prop] = val; return true; } });
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
    try { renderDocumentToCanvas(doc); } finally { spy.mockRestore(); }
    expect(calls).toContain('transform');
    expect(calls).toContain('clip');
    expect(calls.indexOf('clip')).toBeLessThan(calls.indexOf('fillText'));
    const pdf = await PDFDocument.load(await exportDocumentToPdfBytes(doc, { trimMarks: false, registrationMarks: false, colorBars: false, pageInformation: false }));
    const contents = pdf.getPages()[0].node.Contents() as PDFArray;
    const stream = pdf.context.lookup(contents.get(0)) as PDFRawStream;
    const ops = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    expect(ops).toMatch(/\bW\s+n\b/);
    expect(ops).toMatch(/1\.5 0 0 0\.7 .* cm/);
  });
});
