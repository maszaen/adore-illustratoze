// @vitest-environment jsdom
// Agent operations added after the render fixes: effects, blend modes, stroke details, fill opacity,
// text tracking/alignment/line height, groups and clipping masks.
import { describe, expect, it } from 'vitest';
import { applyOperations, createFromSpec, inspectDesign, measureTexts, previewDesign, readDesign, writeDesign } from '../agent/design';
import { resolveClipMask, resolveEffects } from '../core/render/appearance';
import { useStudioStore } from '../state/useStudioStore';

const base = () => createFromSpec({ version: 1, document: { name: 'ops', width: 400, height: 300 }, operations: [
  { op: 'rectangle', id: 'bg', layer: 'artwork', x: 0, y: 0, width: 400, height: 300, fill: '#101020' },
  { op: 'rectangle', id: 'a', layer: 'artwork', x: 20, y: 20, width: 80, height: 60, fill: '#ff0000' },
  { op: 'ellipse', id: 'b', layer: 'artwork', x: 120, y: 40, width: 60, height: 60, fill: '#0000ff' },
  { op: 'text', id: 't', layer: 'artwork', x: 200, y: 200, text: 'Hello', fontSize: 30 },
] });

describe('styles', () => {
  it('creates and updates effects that every renderer and the Appearance panel understand', () => {
    const doc = applyOperations(base(), [
      { op: 'update', id: 'a', effects: [{ type: 'drop-shadow', x: 4, y: 8, blur: 10, color: '#112233', opacity: 0.4 }, { type: 'outer-glow', color: '#FF00FF' }] },
      { op: 'update', id: 'b', effects: [{ type: 'gaussian-blur', radius: 3 }] },
    ]);
    expect(doc.nodes.a.effects[0]).toMatchObject({ type: 'drop-shadow', enabled: true, params: { dx: 4, dy: 8, blur: 10, color: '#112233', opacity: 0.4 } });
    expect(resolveEffects(doc.nodes.a)).toMatchObject({ dropShadow: { dx: 4, dy: 8, blur: 10 }, glow: { color: '#FF00FF', blur: 12, opacity: 0.8 } });
    expect(resolveEffects(doc.nodes.b)!.blur!.radius).toBe(3);
    const svg = previewDesign(doc);
    expect(svg).toContain('<feDropShadow dx="4" dy="8"'); expect(svg).toContain('<feGaussianBlur stdDeviation="3"/>');
    expect(applyOperations(doc, [{ op: 'update', id: 'a', effects: [] }]).nodes.a.effects).toEqual([]);
  });

  it('rejects unknown, duplicate and out-of-range effects', () => {
    for (const effects of [[{ type: 'inner-glow' }], [{ type: 'gaussian-blur' }, { type: 'gaussian-blur' }], [{ type: 'drop-shadow', spread: 2 }], [{ type: 'outer-glow', opacity: 3 }], 'shadow'])
      expect(() => applyOperations(base(), [{ op: 'update', id: 'a', effects }])).toThrow();
  });

  it('sets blend mode, fill opacity and stroke details on create and update', () => {
    const doc = applyOperations(base(), [
      { op: 'star', id: 's', layer: 'artwork', x: 10, y: 150, width: 80, height: 80, fill: { type: 'solid', color: '#FFD166', opacity: 0.5 }, blendMode: 'screen',
        stroke: '#FFFFFF', strokeWidth: 3, strokeDash: [6, 3], strokeCap: 'butt', strokeJoin: 'bevel', strokeOpacity: 0.7 },
      { op: 'update', id: 'a', blendMode: 'multiply', stroke: '#00FF00', strokeWidth: 4 },
      { op: 'update', id: 'a', strokeDash: [2, 2] },
      { op: 'update', id: 'b', fill: { type: 'linear', stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#FFFFFF' }], opacity: 0.25 } },
    ]);
    expect(doc.nodes.s.fills[0]).toMatchObject({ type: 'solid', color: '#FFD166', opacity: 0.5 });
    expect(doc.nodes.s.blendMode).toBe('screen');
    expect(doc.nodes.s.strokes[0]).toMatchObject({ color: '#FFFFFF', weight: 3, dashArray: [6, 3], cap: 'butt', join: 'bevel', opacity: 0.7 });
    expect(doc.nodes.a.strokes).toHaveLength(1);
    expect(doc.nodes.a.strokes[0]).toMatchObject({ color: '#00FF00', weight: 4, dashArray: [2, 2] });
    expect(doc.nodes.b.fills[0].opacity).toBe(0.25);
    expect(applyOperations(doc, [{ op: 'update', id: 'a', stroke: null }]).nodes.a.strokes).toEqual([]);
    const svg = previewDesign(doc);
    expect(svg).toContain('mix-blend-mode:screen'); expect(svg).toContain('stroke-dasharray="6 3"'); expect(svg).toContain('fill-opacity="0.5"');
  });

  it('rejects stroke details without a stroke and invalid blend modes', () => {
    expect(() => applyOperations(base(), [{ op: 'update', id: 'b', strokeDash: [4, 4] }])).toThrow(/no stroke/);
    expect(() => applyOperations(base(), [{ op: 'rectangle', id: 'n', layer: 'artwork', x: 0, y: 0, width: 5, height: 5, strokeCap: 'round' }])).toThrow(/need a stroke color/);
    expect(() => applyOperations(base(), [{ op: 'update', id: 'a', blendMode: 'add' }])).toThrow(/blendMode/);
    expect(() => applyOperations(base(), [{ op: 'update', id: 'a', strokeDash: [0, 0], stroke: '#000000' }])).toThrow(/greater than 0/);
  });
});

describe('text', () => {
  it('places centered and right-aligned text with x as its center or right edge', () => {
    const doc = applyOperations(base(), [
      { op: 'text', id: 'c', layer: 'artwork', x: 200, y: 10, text: 'Center', fontSize: 40, align: 'center', tracking: 100 },
      { op: 'text', id: 'r', layer: 'artwork', x: 380, y: 60, text: 'Right', fontSize: 40, align: 'right', lineHeight: 60 },
    ]);
    const c = doc.nodes.c, r = doc.nodes.r;
    expect(c.x + c.width / 2).toBeCloseTo(200, 6);
    expect(r.x + r.width).toBeCloseTo(380, 6);
    expect(c.textStyle).toMatchObject({ align: 'center', tracking: 100 });
    expect(r.textStyle!.leading).toBe(60);
    const m = measureTexts([{ text: 'Center', fontSize: 40, align: 'center', tracking: 100 }]).items[0];
    expect(m.frame.width).toBeCloseTo(c.width, 6);
    expect(m.frame.x).toBeCloseTo(c.x - 200, 6);
  });

  it('updates tracking and font without moving the alignment anchor', () => {
    const doc = applyOperations(base(), [{ op: 'text', id: 'c', layer: 'artwork', x: 200, y: 10, text: 'Wide', fontSize: 40, align: 'center' }]);
    const next = applyOperations(doc, [{ op: 'update', id: 'c', tracking: 400, fontStyle: 'Bold', fontFamily: 'Georgia, serif' }]).nodes.c;
    expect(next.width).toBeGreaterThan(doc.nodes.c.width);
    expect(next.x + next.width / 2).toBeCloseTo(200, 6);
    expect(next.textStyle).toMatchObject({ tracking: 400, fontStyle: 'Bold', fontFamily: 'Georgia, serif' });
  });
});

describe('groups and clipping masks', () => {
  it('groups objects in stacking order, at the position of the top-most one, and moves them together', () => {
    const doc = applyOperations(base(), [{ op: 'group', id: 'g', name: 'Pair', children: ['b', 'a'], opacity: 0.5, effects: [{ type: 'drop-shadow' }] }]);
    expect(doc.nodes.g.children).toEqual(['a', 'b']);
    expect(doc.layers[0].nodeIds).toEqual(['bg', 'g', 't']);
    expect([doc.nodes.g.x, doc.nodes.g.y, doc.nodes.g.width, doc.nodes.g.height]).toEqual([20, 20, 160, 80]);
    const moved = applyOperations(doc, [{ op: 'update', id: 'g', x: 120, y: 100 }]);
    expect([moved.nodes.a.x, moved.nodes.a.y, moved.nodes.b.x, moved.nodes.b.y]).toEqual([120, 100, 220, 120]);
    expect(moved.nodes.a.points[0].x).toBe(120);
    expect([moved.nodes.g.x, moved.nodes.g.y]).toEqual([120, 100]);
    const inner = applyOperations(moved, [{ op: 'update', id: 'b', x: 300, rotation: 20, fill: '#00ff00' }]);
    expect(inner.nodes.g.width).toBeGreaterThan(160);
    const svg = previewDesign(doc); expect(svg).toMatch(/<g id="Pair" opacity="0.5" filter="url\(#fx_/);
  });

  it('makes a clipping mask from a shape and releases it like Illustrator', () => {
    const doc = applyOperations(base(), [{ op: 'clip', id: 'clip', mask: 'b', content: ['a', 'bg'] }]);
    const info = resolveClipMask(doc.nodes.clip, doc.nodes)!;
    expect(info.mask.id).toBe('b'); expect(info.content.map(n => n.id)).toEqual(['bg', 'a']);
    expect(doc.layers[0].nodeIds).toEqual(['clip', 't']);
    const summary = inspectDesign(doc).nodes.find(n => n.id === 'clip') as any;
    expect(summary.clipMask).toBe('b');
    expect(summary.visualBounds).toEqual({ x: 120, y: 40, width: 60, height: 60 });
    expect(previewDesign(doc)).toMatch(/<clipPath id="clip_/);
    const released = applyOperations(doc, [{ op: 'ungroup', id: 'clip' }]);
    expect(released.layers[0].nodeIds).toEqual(['bg', 'a', 'b', 't']);
    expect(released.nodes.b.fills).toEqual([]); expect(released.nodes.b.parentId).toBeUndefined();
    expect(released.nodes.clip).toBeUndefined();
  });

  it('rejects masks that cannot clip and objects already in a group', () => {
    expect(() => applyOperations(base(), [{ op: 'clip', id: 'c', mask: 't', content: ['a'] }])).toThrow(/path or shape/);
    expect(() => applyOperations(base(), [{ op: 'clip', id: 'c', mask: 'a', content: ['a'] }])).toThrow(/mask cannot also be in content/);
    expect(() => applyOperations(base(), [{ op: 'group', id: 'g', children: ['a'] }, { op: 'group', id: 'h', children: ['a', 'b'] }])).toThrow(/inside a group/);
    expect(() => applyOperations(base(), [{ op: 'group', id: 'g', children: ['a', 'missing'] }])).toThrow(/not found/);
    const doc = base(); doc.nodes.a.locked = true;
    expect(() => applyOperations(doc, [{ op: 'group', id: 'g', children: ['a', 'b'] }])).toThrow(/locked/);
  });

  it('deletes groups with their contents, protects the clip mask and cleans references', () => {
    const doc = applyOperations(base(), [{ op: 'group', id: 'g', children: ['a', 'b'] }, { op: 'clip', id: 'clip', mask: 'bg', content: ['g'] }]);
    doc.exportAssets.push({ id: 'ex', name: 'A', sourceNodeId: 'a', scales: ['1x'], formats: ['png'] });
    doc.savedSelections.push({ id: 'sel', name: 'S', nodeIds: ['a', 't'] });
    expect(() => applyOperations(doc, [{ op: 'delete', id: 'bg' }])).toThrow(/clipping mask/);
    expect(() => applyOperations(doc, [{ op: 'delete', id: 'g' }])).toThrow(/last clipped object/);
    const one = applyOperations(doc, [{ op: 'delete', id: 'a' }]);
    expect(one.nodes.g.children).toEqual(['b']);
    expect(one.exportAssets).toEqual([]); expect(one.savedSelections[0].nodeIds).toEqual(['t']);
    const lastInGroup = applyOperations(base(), [{ op: 'group', id: 'g', children: ['a'] }, { op: 'delete', id: 'a' }]);
    expect(lastInGroup.nodes.g).toBeUndefined(); expect(lastInGroup.layers[0].nodeIds).toEqual(['bg', 'b', 't']);
    const whole = applyOperations(doc, [{ op: 'delete', id: 'clip' }]);
    expect(Object.keys(whole.nodes)).toEqual(['t']);
  });

  it('roundtrips and opens grouped, clipped and styled artwork in the editor', () => {
    const doc = applyOperations(base(), [
      { op: 'clip', id: 'clip', mask: 'b', content: ['a'], effects: [{ type: 'outer-glow' }] },
      { op: 'group', id: 'g', children: ['clip', 't'], blendMode: 'screen' },
    ]);
    const loaded = readDesign(writeDesign(doc));
    expect(loaded.nodes.clip.parentId).toBe('g');
    useStudioStore.getState().openDocument(loaded);
    expect(useStudioStore.getState().getActiveDocument().nodes.g.children).toEqual(['clip', 't']);
  });

  it('keeps edits atomic when a later operation fails', () => {
    const doc = base(), snapshot = structuredClone(doc);
    expect(() => applyOperations(doc, [{ op: 'group', id: 'g', children: ['a', 'b'] }, { op: 'ungroup', id: 'a' }])).toThrow(/only groups/);
    expect(doc).toEqual(snapshot);
  });
});
