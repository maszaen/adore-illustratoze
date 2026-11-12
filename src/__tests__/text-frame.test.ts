// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { fitPointTextFrame, layoutText, pointTextPaintBounds, textGlyphTransform, type TextMeasurer } from '../core/math/textLayout';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import { exportAssetToDataUrl, renderDocumentToCanvas } from '../core/io/rasterExport';
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

  it.each(['point', 'area'] as const)('renders and exports %s text with the correct frame clipping', async (mode) => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { StudioCanvas } = await import('../components/canvas/StudioCanvas');
    const { useStudioStore } = await import('../state/useStudioStore');
    const doc = createDefaultDocument({ includeSampleArtwork: false, width: 400, height: 200 });
    const node = textNode(); node.id = 'text-fixture'; node.layerId = doc.layers[0].id;
    // A legacy click-created frame is narrower than the text and may have ink
    // to the left of its origin (e.g. bold italic); it must not be cropped.
    node.width = 20; node.textContent = 'jolly wide legacy text';
    node.textStyle = { ...node.textStyle!, typeMode: mode, fontFamily: 'Georgia', fontStyle: 'Bold Italic', align: 'left', textCase: 'normal' };
    node.textScaleX = 1.5; node.textScaleY = 0.7;
    doc.nodes = { [node.id]: node }; doc.layers[0].nodeIds = [node.id];
    useStudioStore.setState({ documents: { [doc.id]: doc }, activeDocumentId: doc.id, document: doc, activeDocument: doc, selectedNodeIds: [], selectedIds: [] });
    const viewport = renderToStaticMarkup(createElement(StudioCanvas));
    const host = document.createElement('div'); host.innerHTML = viewport;
    const element = host.querySelector('[data-vector-node-id="text-fixture"]')!;
    expect(element.textContent).toContain(node.textContent);
    expect(!!element.querySelector('clipPath')).toBe(mode === 'area');
    expect(!!element.querySelector('[clip-path]')).toBe(mode === 'area');

    const svg = exportDocumentToSvgString(doc);
    expect(svg).toContain('matrix(');
    expect(svg).toContain(node.textContent);
    expect(svg.includes('clip-path="url(#text_clip_1)"')).toBe(mode === 'area');
    expect(svg.includes('<clipPath id="text_clip_1"')).toBe(mode === 'area');

    const calls: string[] = [];
    const ctx = new Proxy({ globalAlpha: 1 }, { get(target: any, prop: string) { return prop in target ? target[prop] : () => { calls.push(prop); }; }, set(target: any, prop: string, val) { target[prop] = val; return true; } });
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
    try { renderDocumentToCanvas(doc); } finally { spy.mockRestore(); }
    expect(calls).toContain('transform');
    expect(calls).toContain('fillText');
    expect(calls.includes('clip')).toBe(mode === 'area');
    if (mode === 'area') expect(calls.indexOf('clip')).toBeLessThan(calls.indexOf('fillText'));

    const pdf = await PDFDocument.load(await exportDocumentToPdfBytes(doc, { trimMarks: false, registrationMarks: false, colorBars: false, pageInformation: false }));
    const contents = pdf.getPages()[0].node.Contents() as PDFArray;
    const stream = pdf.context.lookup(contents.get(0)) as PDFRawStream;
    const ops = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    expect(/\bW\s+n\b/.test(ops)).toBe(mode === 'area');
    expect(ops).toMatch(/\bTj\b/);
  });

  it('includes overhanging glyph ink and legacy overflow in point text asset bounds', () => {
    const base = textNode();
    const node = { ...base, x: 100, y: 20, width: 20, height: 30,
      textStyle: { ...base.textStyle!, align: 'left' as const, textCase: 'normal' as const },
      textContent: 'jolly', strokes: [] };
    const measureText = vi.fn(() => ({ width: 90, actualBoundingBoxLeft: 8, actualBoundingBoxRight: 95, actualBoundingBoxAscent: 21, actualBoundingBoxDescent: 5 }));
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ measureText } as any);
    try {
      const bounds = pointTextPaintBounds(node);
      expect(bounds.x).toBe(92);
      expect(bounds.x + bounds.width).toBe(195);
      expect(bounds.y).toBeLessThan(node.y);
      expect(measureText).toHaveBeenCalledWith('jolly');
      const flipped = pointTextPaintBounds({ ...node, textScaleX: -1 });
      expect(flipped.x).toBeLessThan(node.x);
      expect(flipped.x + flipped.width).toBeGreaterThan(node.x + node.width);
    } finally { spy.mockRestore(); }
  });

  it('uses ink bounds for point text asset crops but retains area frame crops', () => {
    const doc = createDefaultDocument({ includeSampleArtwork: false, width: 400, height: 200 });
    const node = textNode(); node.id = 'asset-text'; node.layerId = doc.layers[0].id;
    node.width = 20; node.textContent = 'jolly';
    node.textStyle = { ...node.textStyle!, align: 'left', textCase: 'normal' };
    doc.nodes = { [node.id]: node }; doc.layers[0].nodeIds = [node.id];
    const asset = { id: 'asset', name: 'text', sourceNodeId: node.id, scales: ['1x' as const], formats: ['png' as const] };
    const ctx = new Proxy({ globalAlpha: 1, measureText: () => ({ width: 90, actualBoundingBoxLeft: 8, actualBoundingBoxRight: 95, actualBoundingBoxAscent: 21, actualBoundingBoxDescent: 5 }) },
      { get(target: any, prop: string) { return prop in target ? target[prop] : () => {}; }, set(target: any, prop: string, val) { target[prop] = val; return true; } });
    const contextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as any);
    const sizes: number[] = [];
    const urlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function(this: HTMLCanvasElement) { sizes.push(this.width); return 'data:image/png;base64,AA=='; });
    try {
      exportAssetToDataUrl(doc, asset);
      node.textStyle.typeMode = 'area';
      exportAssetToDataUrl(doc, asset);
      expect(sizes[0]).toBeGreaterThan(100);
      expect(sizes[1]).toBe(28);
    } finally { contextSpy.mockRestore(); urlSpy.mockRestore(); }
  });

  it('does not frame-clip text with missing legacy type mode', async () => {
    const { clipsTextToFrame } = await import('../core/math/textLayout');
    const node = textNode();
    delete (node.textStyle as Partial<typeof node.textStyle>)!.typeMode;
    expect(clipsTextToFrame(node)).toBe(false);
  });
});
