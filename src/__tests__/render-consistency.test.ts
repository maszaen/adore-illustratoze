// @vitest-environment jsdom
// Regression tests for the shared render contract (layer order, gradients, effects, clipping masks).
// Pixel-level agreement between viewport/SVG/raster/PDF is verified separately in a real browser; these
// tests pin the data each renderer emits.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createFromSpec } from '../agent/design';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import { renderDocumentToCanvas } from '../core/io/rasterExport';
import { exportDocumentToPdfBytes } from '../core/io/pdfExport';
import { createEllipseAnchors, createRectangleAnchors } from '../core/math/bezier';
import { boxSizesForGaussian, gaussianBlurRgba } from '../core/render/blur';
import {
  linearGradientAxis,
  nodeEffectBounds,
  parseCssColor,
  radialGradientEllipse,
  resolveClipMask,
  resolveEffects,
  resolvePaintColor,
  toRgbaString,
} from '../core/render/appearance';
import { useStudioStore } from '../state/useStudioStore';
import type { StudioDocument, VectorNode } from '../core/types';

const noMarks = { trimMarks: false, registrationMarks: false, colorBars: false, pageInformation: false, useDocumentBleed: false };
const base = (ops: any[]) => createFromSpec({ version: 1, document: { name: 'render', width: 200, height: 120 }, operations: ops });
const add = (doc: StudioDocument, id: string, patch: Partial<VectorNode>): VectorNode => {
  const node = { id, name: id, type: 'rectangle', layerId: 'artwork', visible: true, locked: false, x: 0, y: 0, width: 50, height: 50, rotation: 0, points: [], closed: true, fills: [], strokes: [], effects: [], opacity: 1, blendMode: 'normal', ...patch } as VectorNode;
  if (!node.points.length) node.points = node.type === 'ellipse' ? createEllipseAnchors(node.x, node.y, node.width, node.height) : createRectangleAnchors(node.x, node.y, node.width, node.height);
  doc.nodes[id] = node;
  if (!node.parentId) doc.layers.find((l) => l.id === node.layerId)!.nodeIds.push(id);
  return node;
};
const solid = (id: string, color: string) => ({ id: `${id}-f`, visible: true, type: 'solid' as const, color, opacity: 1, blendMode: 'normal' as const });
const effect = (type: any, params: Record<string, unknown>) => ({ id: `fx-${type}`, type, name: type, enabled: true, params });

async function pdfStream(doc: StudioDocument, onWarning?: (m: string) => void) {
  const pdf = await PDFDocument.load(await exportDocumentToPdfBytes(doc, { ...noMarks, onWarning }));
  const contents = pdf.getPages()[0].node.Contents() as PDFArray;
  const decode = (i: number) => new TextDecoder().decode(decodePDFRawStream(pdf.context.lookup(contents.get(i)) as PDFRawStream).decode());
  return { pdf, text: Array.from({ length: contents.size() }, (_, i) => decode(i)).join('\n') };
}

/** Minimal recording canvas: enough of the 2D API for the exporter, capturing paint calls in order. */
function installRecordingCanvas() {
  const fills: string[] = [];
  const gradients: { kind: string; args: number[]; stops: [number, string][] }[] = [];
  const target: Record<string, any> = { globalAlpha: 1, fillStyle: '' };
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop === 'fill') return () => { fills.push(typeof t.fillStyle === 'string' ? t.fillStyle : '[gradient]'); };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return (...args: number[]) => {
          const entry = { kind: prop, args, stops: [] as [number, string][] };
          gradients.push(entry);
          return { addColorStop: (offset: number, color: string) => entry.stops.push([offset, color]) };
        };
      }
      return () => undefined;
    },
    set(t, prop: string, value) { t[prop] = value; return true; },
  });
  const original = document.createElement.bind(document);
  const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? ({ width: 0, height: 0, getContext: () => ctx } as any) : original(tag)) as any);
  vi.stubGlobal('Path2D', class { constructor(_d?: string) {} addPath() {} rect() {} });
  return { fills, gradients, restore: () => { spy.mockRestore(); vi.unstubAllGlobals(); } };
}

afterEach(() => vi.unstubAllGlobals());

describe('shared appearance helpers', () => {
  it('reproduces the SVG objectBoundingBox linear gradient axis, including skew on non-square boxes', () => {
    const box = { x: 10, y: 20, width: 100, height: 40 };
    const axis = linearGradientAxis(box, 0)!;
    expect([axis.x1, axis.y1, axis.x2, axis.y2].map((v) => Math.round(v * 1000) / 1000)).toEqual([10, 40, 110, 40]);
    const diagonal = linearGradientAxis(box, 45)!;
    // t is a linear function of position: t(center) = 0.5 and the gradient runs exactly one unit across the box diagonal in bbox space.
    const t = (x: number, y: number) => {
      const r = Math.PI / 4;
      return ((x - box.x) / box.width - (0.5 - Math.cos(r) * 0.5)) * Math.cos(r) + ((y - box.y) / box.height - (0.5 - Math.sin(r) * 0.5)) * Math.sin(r);
    };
    expect(t(diagonal.x1, diagonal.y1)).toBeCloseTo(0, 6);
    expect(t(diagonal.x2, diagonal.y2)).toBeCloseTo(1, 6);
    expect(linearGradientAxis({ x: 0, y: 0, width: 0, height: 10 }, 0)).toBeNull();
    expect(radialGradientEllipse(box)).toEqual({ cx: 60, cy: 40, rx: 50, ry: 20 });
  });

  it('parses colors and folds opacity into rgba()', () => {
    expect(parseCssColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(toRgbaString('#ff0000', 0)).toBe('rgba(255, 0, 0, 0)');
    expect(toRgbaString('#0000ff', 0.25)).toBe('rgba(0, 0, 255, 0.25)');
  });

  it('resolves global swatches and tints like the viewport', () => {
    const swatches = [{ id: 'sw', color: '#0000ff' }] as any;
    expect(resolvePaintColor({ swatches }, '#ff0000', 'sw', 100)).toBe('#0000ff');
    expect(resolvePaintColor({ swatches }, '#ff0000', 'sw', 50)).not.toBe('#0000ff');
  });

  it('accepts both dx/dy (UI, presets) and offsetX/offsetY (older files) for drop shadows', () => {
    const node = { effects: [effect('drop-shadow', { dx: 3, dy: 4, blur: 2 })] } as unknown as VectorNode;
    expect(resolveEffects(node)!.dropShadow).toMatchObject({ dx: 3, dy: 4, blur: 2 });
    const legacy = { effects: [effect('drop-shadow', { offsetX: -5, offsetY: 6 })] } as unknown as VectorNode;
    expect(resolveEffects(legacy)!.dropShadow).toMatchObject({ dx: -5, dy: 6 });
    expect(resolveEffects({ effects: [{ ...effect('drop-shadow', {}), enabled: false }] } as unknown as VectorNode)).toBeNull();
  });

  it('grows render bounds by stroke, rotation and effect margin', () => {
    const doc = base([{ op: 'rectangle', id: 'r', layer: 'artwork', x: 50, y: 50, width: 40, height: 20, fill: '#000000', stroke: '#ffffff', strokeWidth: 10 }]);
    const plain = nodeEffectBounds(doc.nodes.r, doc.nodes)!;
    expect(plain.x).toBeLessThan(45); expect(plain.width).toBeGreaterThan(50);
    doc.nodes.r.effects = [effect('gaussian-blur', { radius: 5 })];
    expect(nodeEffectBounds(doc.nodes.r, doc.nodes)!.width).toBeGreaterThan(plain.width + 20);
  });

  it('uses the top-most child as clip mask and refuses non-shapes', () => {
    const doc = base([]);
    add(doc, 'content', { parentId: 'clip' }); add(doc, 'mask', { parentId: 'clip', type: 'ellipse' });
    add(doc, 'clip', { type: 'clipping-group', children: ['content', 'mask'], points: [] });
    const info = resolveClipMask(doc.nodes.clip, doc.nodes)!;
    expect(info.mask.id).toBe('mask'); expect(info.content.map((n) => n.id)).toEqual(['content']);
    doc.nodes.mask.type = 'text';
    expect(resolveClipMask(doc.nodes.clip, doc.nodes)).toBeNull();
  });
});

describe('software Gaussian blur', () => {
  it('keeps total alpha and spreads a point', () => {
    const w = 21, h = 21, data = new Uint8ClampedArray(w * h * 4);
    const c = (10 * w + 10) * 4; data.set([255, 0, 0, 255], c);
    gaussianBlurRgba(data, w, h, 2);
    let alpha = 0; for (let i = 3; i < data.length; i += 4) alpha += data[i];
    expect(Math.abs(alpha - 255)).toBeLessThan(w * h * 0.5 + 10); // rounding only
    expect(data[c + 3]).toBeLessThan(255); expect(data[c + 3]).toBeGreaterThan(0);
    expect(data[c - 4 + 3]).toBeGreaterThan(0);
    expect(data[c - 4]).toBe(255); // premultiplied math must not darken the color
    expect(boxSizesForGaussian(3).every((n) => n % 2 === 1)).toBe(true);
  });
});

describe('raster export', () => {
  it('paints layers bottom-to-top like the viewport and SVG', () => {
    const doc = base([
      { op: 'rectangle', id: 'bottom', layer: 'artwork', x: 0, y: 0, width: 20, height: 20, fill: '#0000ff' },
      { op: 'layer', id: 'top', name: 'top' },
      { op: 'rectangle', id: 'top-box', layer: 'top', x: 0, y: 0, width: 20, height: 20, fill: '#ff0000' },
    ]);
    const rec = installRecordingCanvas();
    try {
      renderDocumentToCanvas(doc);
      expect(rec.fills).toEqual(['#0000ff', '#ff0000']);
      const svg = exportDocumentToSvgString(doc);
      expect(svg.indexOf('id="bottom"')).toBeLessThan(svg.indexOf('id="top-box"'));
    } finally { rec.restore(); }
  });

  it('keeps gradient stop opacity and maps the gradient to the shape box', () => {
    const doc = base([{ op: 'rectangle', id: 'g', layer: 'artwork', x: 10, y: 20, width: 100, height: 40, fill: { type: 'linear', stops: [{ offset: 0, color: '#ff0000', opacity: 0 }, { offset: 1, color: '#0000ff', opacity: 1 }] } }]);
    const rec = installRecordingCanvas();
    try {
      renderDocumentToCanvas(doc);
      expect(rec.gradients).toHaveLength(1);
      expect(rec.gradients[0].stops).toEqual([[0, 'rgba(255, 0, 0, 0)'], [1, 'rgba(0, 0, 255, 1)']]);
      expect(rec.gradients[0].args.map((v) => Math.round(v))).toEqual([10, 40, 110, 40]);
      expect(exportDocumentToSvgString(doc)).toContain('stop-opacity="0"');
    } finally { rec.restore(); }
  });

  it('draws only the clipped content inside the mask and never paints the mask itself', () => {
    const doc = base([]);
    add(doc, 'content', { parentId: 'clip', fills: [solid('content', '#ff8800')] });
    add(doc, 'mask', { parentId: 'clip', type: 'ellipse', fills: [solid('mask', '#00ff00')] });
    add(doc, 'clip', { type: 'clipping-group', children: ['content', 'mask'], points: [] });
    const rec = installRecordingCanvas();
    try { renderDocumentToCanvas(doc); expect(rec.fills).toEqual(['#ff8800']); } finally { rec.restore(); }
  });
});

describe('SVG export', () => {
  it('emits a clipPath for clipping groups and keeps the mask out of the artwork', () => {
    const doc = base([]);
    add(doc, 'content', { parentId: 'clip', fills: [solid('content', '#ff8800')] });
    add(doc, 'mask', { parentId: 'clip', type: 'ellipse', rotation: 20, fills: [solid('mask', '#00ff00')] });
    add(doc, 'clip', { type: 'clipping-group', children: ['content', 'mask'], points: [] });
    const svg = exportDocumentToSvgString(doc);
    expect(svg).toMatch(/<clipPath id="clip_[0-9a-f_]+"><path d="[^"]+" transform="rotate\(20/);
    expect(svg).toMatch(/<g clip-path="url\(#clip_/);
    expect(svg).not.toContain('#00ff00');
  });

  it('writes drop shadow, glow and blur as one filter with an explicit region', () => {
    const doc = base([{ op: 'rectangle', id: 'a', layer: 'artwork', x: 20, y: 20, width: 50, height: 50, fill: '#ff0000' }]);
    doc.nodes.a.effects = [effect('drop-shadow', { dx: 7, dy: 9, blur: 3, color: '#112233', opacity: 0.5 }), effect('gaussian-blur', { radius: 2 })];
    const svg = exportDocumentToSvgString(doc);
    expect(svg).toMatch(/<filter id="fx_[0-9a-f_]+" filterUnits="userSpaceOnUse"/);
    expect(svg).toContain('<feDropShadow dx="7" dy="9" stdDeviation="3" flood-color="#112233" flood-opacity="0.5"/>');
    expect(svg).toContain('<feGaussianBlur stdDeviation="2"/>');
    expect(svg).toMatch(/filter="url\(#fx_/);
  });

  it('exports every fill and stroke of the appearance stack, group opacity, blend mode and layer opacity', () => {
    const doc = base([{ op: 'rectangle', id: 'a', layer: 'artwork', x: 20, y: 20, width: 50, height: 50, fill: '#ff0000', stroke: '#000000', strokeWidth: 4 }]);
    doc.nodes.a.fills.push(solid('b', '#00ff00'));
    doc.nodes.a.strokes.push({ ...doc.nodes.a.strokes[0], id: 'second', color: '#ffff00' });
    doc.nodes.a.blendMode = 'multiply';
    doc.layers[0].opacity = 0.5;
    const svg = exportDocumentToSvgString(doc);
    expect(svg.match(/<path d=/g)).toHaveLength(4);
    expect(svg).toContain('mix-blend-mode:multiply');
    expect(svg).toMatch(/<g id="Artwork" opacity="0.5">/);
    expect(svg).toContain('fill="#ff0000"'); expect(svg).toContain('fill="#00ff00"'); expect(svg).toContain('stroke="#ffff00"');
  });

  it('applies swatch tints', () => {
    const doc = base([{ op: 'rectangle', id: 'a', layer: 'artwork', x: 0, y: 0, width: 10, height: 10, fill: '#ff0000' }]);
    doc.swatches.push({ id: 'sw', name: 'sw', type: 'solid', color: '#0000ff', isGlobal: true, isSpot: false, tint: 100 } as any);
    Object.assign(doc.nodes.a.fills[0], { globalSwatchId: 'sw', tint: 50 });
    const svg = exportDocumentToSvgString(doc);
    expect(svg).not.toContain('#ff0000'); expect(svg).not.toContain('fill="#0000ff"');
  });
});

describe('PDF export', () => {
  it('rotates shapes and survives characters outside the standard font, with a warning', async () => {
    const doc = base([
      { op: 'rectangle', id: 'rect', layer: 'artwork', x: 10, y: 20, width: 80, height: 20, fill: '#ff0000' },
      { op: 'text', id: 'label', layer: 'artwork', x: 10, y: 80, text: 'O', fontSize: 30 },
    ]);
    const flat = (await pdfStream(doc)).text;
    doc.nodes.rect.rotation = 90;
    expect((await pdfStream(doc)).text).not.toEqual(flat);
    doc.nodes.label.textContent = 'Hello 😀';
    const warnings: string[] = [];
    await expect(pdfStream(doc, (m) => warnings.push(m))).resolves.toBeDefined();
    expect(warnings.some((m) => m.includes('replaced with "?"'))).toBe(true);
  });

  it('paints layers bottom-to-top', async () => {
    const doc = base([
      { op: 'rectangle', id: 'bottom', layer: 'artwork', x: 0, y: 0, width: 20, height: 20, fill: '#0000ff' },
      { op: 'layer', id: 'top', name: 'top' },
      { op: 'rectangle', id: 'top-box', layer: 'top', x: 0, y: 0, width: 20, height: 20, fill: '#ff0000' },
    ]);
    const { text } = await pdfStream(doc);
    expect(text.indexOf('0 0 1 rg')).toBeGreaterThan(-1);
    expect(text.indexOf('0 0 1 rg')).toBeLessThan(text.indexOf('1 0 0 rg'));
  });

  it('writes real axial/radial shadings, with a soft mask only when a stop is transparent', async () => {
    const doc = base([
      { op: 'rectangle', id: 'a', layer: 'artwork', x: 0, y: 0, width: 100, height: 50, fill: { type: 'linear', angle: 0, stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }] } },
      { op: 'ellipse', id: 'b', layer: 'artwork', x: 0, y: 60, width: 100, height: 40, fill: { type: 'radial', stops: [{ offset: 0, color: '#ffffff', opacity: 0.2 }, { offset: 1, color: '#000000' }] } },
    ]);
    const { pdf, text } = await pdfStream(doc);
    expect(text).toContain('/Pattern cs');
    const dump = pdf.context.enumerateIndirectObjects().map(([, obj]) => String(obj)).join('\n');
    expect(dump).toMatch(/ShadingType 2/); expect(dump).toMatch(/ShadingType 3/);
    expect(dump).toMatch(/SMask/); expect((dump.match(/\/Subtype \/Form/g) || []).length).toBe(1);
  });

  it('clips to the mask and reports effects it cannot reproduce', async () => {
    const doc = base([]);
    add(doc, 'content', { parentId: 'clip', fills: [solid('content', '#ff8800')] });
    add(doc, 'mask', { parentId: 'clip', type: 'ellipse', fills: [solid('mask', '#00ff00')] });
    const clip = add(doc, 'clip', { type: 'clipping-group', children: ['content', 'mask'], points: [] });
    clip.effects = [effect('drop-shadow', {})];
    const warnings: string[] = [];
    const { text } = await pdfStream(doc, (m) => warnings.push(m));
    expect(text).toMatch(/W\s+n/);
    expect(text).not.toContain('0 1 0 rg');
    expect(warnings.some((m) => m.includes('shadow, glow and blur'))).toBe(true);
  });
});

describe('Make / Release Clipping Mask', () => {
  it('groups the selection under a clipping group whose top-most shape is the mask', () => {
    const store = useStudioStore.getState();
    const doc = createFromSpec({ version: 1, document: { name: 'm', width: 100, height: 100 }, operations: [
      { op: 'rectangle', id: 'art', layer: 'artwork', x: 0, y: 0, width: 80, height: 80, fill: '#ff0000' },
      { op: 'ellipse', id: 'shape', layer: 'artwork', x: 10, y: 10, width: 40, height: 40, fill: '#00ff00' },
    ] });
    store.openDocument(doc);
    useStudioStore.getState().selectNodes(['shape', 'art'], false); // selection order must not decide the mask
    useStudioStore.getState().makeClippingMask();
    const after = useStudioStore.getState().getActiveDocument();
    const group = Object.values(after.nodes).find((n) => n.type === 'clipping-group')!;
    expect(group.children).toEqual(['art', 'shape']);
    expect(after.nodes.art.parentId).toBe(group.id); expect(after.nodes.shape.parentId).toBe(group.id);
    expect(group.fills).toEqual([]);
    expect(after.layers[0].nodeIds.filter((id) => !after.nodes[id].parentId)).toEqual([group.id]);
    expect(Object.keys(after.nodes)).toHaveLength(3);

    useStudioStore.getState().selectNodes([group.id], false);
    useStudioStore.getState().releaseClippingMask();
    const released = useStudioStore.getState().getActiveDocument();
    expect(released.nodes.shape.parentId).toBeUndefined();
    expect(released.nodes.shape.fills).toEqual([]); // like Illustrator, a released mask has no paint
    expect(released.nodes.art.fills).toHaveLength(1);
  });
});
