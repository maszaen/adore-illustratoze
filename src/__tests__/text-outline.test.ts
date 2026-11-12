// @vitest-environment jsdom
import opentype from 'opentype.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createFromSpec } from '../agent/design';
import { TextOutlineError, convertTextNodeToOutlineNodes, registerOutlineFont } from '../core/io/opentypeHelper';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import { layoutText } from '../core/math/textLayout';
import { useStudioStore } from '../state/useStudioStore';

/** A tiny in-memory font: "O" has a counter (inner contour), "I" is a bar, space is empty. */
function buildFont() {
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: new opentype.Path() });
  const square = (path: opentype.Path, x0: number, y0: number, x1: number, y1: number, clockwise: boolean) => {
    const pts = clockwise ? [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] : [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];
    path.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y]) => path.lineTo(x, y)); path.close();
  };
  const o = new opentype.Path(); square(o, 50, 0, 550, 700, true); square(o, 150, 100, 450, 600, false);
  const i = new opentype.Path(); square(i, 50, 0, 150, 700, true);
  const font = new opentype.Font({
    familyName: 'TestFont', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200,
    glyphs: [notdef,
      new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 300, path: new opentype.Path() }),
      new opentype.Glyph({ name: 'O', unicode: 79, advanceWidth: 600, path: o }),
      new opentype.Glyph({ name: 'I', unicode: 73, advanceWidth: 200, path: i })],
  });
  // Fonts parsed from files always have a kerning table; a hand-built one needs it spelled out.
  (font as any).kerningPairs = {};
  return font;
}

const textDoc = (text: string, extra: Record<string, unknown> = {}) => {
  const doc = createFromSpec({ version: 1, document: { name: 'o', width: 400, height: 200 }, operations: [
    { op: 'rectangle', id: 'bg', layer: 'artwork', x: 0, y: 0, width: 10, height: 10, fill: '#cccccc' },
    { op: 'text', id: 'label', layer: 'artwork', x: 40, y: 50, text, fontSize: 100, fontFamily: 'TestFont, sans-serif', fill: '#ff0000' },
  ] });
  Object.assign(doc.nodes.label, extra);
  return doc;
};

beforeAll(() => { registerOutlineFont('TestFont', buildFont()); });

describe('Create Outlines', () => {
  it('keeps counters as separate contours of one compound path (the "O" has a hole)', () => {
    const { childNodes } = convertTextNodeToOutlineNodes(textDoc('O').nodes.label);
    expect(childNodes).toHaveLength(1);
    const o = childNodes[0];
    expect(o.type).toBe('compound-path');
    expect(o.points.filter((p) => p.moveTo)).toHaveLength(1);
    expect(o.points).toHaveLength(8);
    expect(o.fillRule).toBe('nonzero');
  });

  it('places glyphs on the same baseline and advance as live text and skips spaces', () => {
    const doc = textDoc('I I');
    const node = doc.nodes.label;
    const { childNodes, groupNode } = convertTextNodeToOutlineNodes(node);
    expect(childNodes).toHaveLength(2);
    const layout = layoutText(node);
    const bar = childNodes[0];
    // Glyph 'I' spans y from baseline-70 (cap height 700/1000*100) to the baseline.
    expect(bar.y + bar.height).toBeCloseTo(layout.y, 4);
    expect(bar.x).toBeCloseTo(node.x + 5, 4); // left side bearing 50/1000*100
    // Second 'I' sits after I (200) + space (300): 50 units further than the first at 100px.
    expect(childNodes[1].x - bar.x).toBeCloseTo(50, 4);
    expect(groupNode.type).toBe('group');
    expect(groupNode.children).toEqual(childNodes.map((c) => c.id));
  });

  it('moves opacity and effects to the group instead of repeating them on every glyph, and bakes rotation in', () => {
    const doc = textDoc('II', { opacity: 0.5, rotation: 90 });
    const { childNodes, groupNode } = convertTextNodeToOutlineNodes(doc.nodes.label);
    expect(groupNode.opacity).toBe(0.5);
    expect(groupNode.rotation).toBe(0);
    expect(childNodes.every((c) => c.opacity === 1 && c.rotation === 0)).toBe(true);
    expect(childNodes[0].height).toBeLessThan(childNodes[0].width * 2); // a rotated tall bar is now wide
    expect(childNodes[0].width).toBeGreaterThan(50);
  });

  it('refuses instead of drawing look-alike letters when the font is not loaded', () => {
    const doc = textDoc('O', { textStyle: { ...textDoc('O').nodes.label.textStyle, fontFamily: 'Inter, sans-serif' } });
    expect(() => convertTextNodeToOutlineNodes(doc.nodes.label)).toThrow(TextOutlineError);
    expect(() => convertTextNodeToOutlineNodes(doc.nodes.label)).toThrow(/Upload it in the Typography panel/);
  });

  it('refuses text features it cannot reproduce', () => {
    const doc = textDoc('O');
    doc.nodes.label.textStyle!.vertical = true;
    expect(() => convertTextNodeToOutlineNodes(doc.nodes.label)).toThrow(/not supported/);
  });
});

describe('Create Outlines command', () => {
  it('replaces the text in place with a group of paths and is undoable', () => {
    useStudioStore.getState().openDocument(textDoc('OI'));
    useStudioStore.getState().selectNodes(['label'], false);
    useStudioStore.getState().createOutlinesFromSelection();
    const doc = useStudioStore.getState().getActiveDocument();
    expect(doc.nodes.label).toBeUndefined();
    const group = Object.values(doc.nodes).find((n) => n.type === 'group')!;
    expect(group.children).toHaveLength(2);
    expect(doc.layers[0].nodeIds).toEqual(['bg', group.id]);
    expect(Object.values(doc.nodes).some((n) => n.type === 'text')).toBe(false);
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().getActiveDocument().nodes.label?.type).toBe('text');
  });

  it('leaves the text untouched and says why when the font is missing', () => {
    const alert = vi.fn(); (window as any).alert = alert;
    const doc = textDoc('O'); doc.nodes.label.textStyle!.fontFamily = 'Missing Sans';
    useStudioStore.getState().openDocument(doc);
    useStudioStore.getState().selectNodes(['label'], false);
    useStudioStore.getState().createOutlinesFromSelection();
    const after = useStudioStore.getState().getActiveDocument();
    expect(after.nodes.label.type).toBe('text');
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('Missing Sans'));
  });
});

describe('SVG export in outline mode', () => {
  it('writes glyph paths with their counters when the font is available', () => {
    const svg = exportDocumentToSvgString(textDoc('O'), { fontMode: 'outline' });
    expect(svg).not.toContain('<text');
    const compound = svg.match(/<path id="[^"]*"[^>]* d="([^"]+)"/g)!.find((p) => (p.match(/M /g) || []).length === 2);
    expect(compound).toBeDefined();
  });

  it('keeps live text and reports it when the font is missing', () => {
    const doc = textDoc('O'); doc.nodes.label.textStyle!.fontFamily = 'Missing Sans';
    const warnings: string[] = [];
    const svg = exportDocumentToSvgString(doc, { fontMode: 'outline', onWarning: (m) => warnings.push(m) });
    expect(svg).toContain('<text');
    expect(warnings.some((m) => m.includes('Missing Sans'))).toBe(true);
  });
});
