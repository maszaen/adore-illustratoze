// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { layoutText } from '../core/math/textLayout';
import { nodeToPolygon } from '../core/math/pathfinder';
import { exportDocumentToSvgString, parseSvgStringToVectorNodes } from '../core/io/svgIo';
import { traceImageDataToVectorNodes } from '../core/io/imageTrace';
import { generateDocumentThumbnailDataUrl } from '../core/io/db';
import { mergeAdlozeIntoDocument } from '../core/io/adlozeIo';
import { useStudioStore } from '../state/useStudioStore';

describe('Audit regression', () => {
  it('keeps undo history for each document', () => {
    const a = createDefaultDocument({ id: 'audit-A' });
    const b = createDefaultDocument({ id: 'audit-B' });
    useStudioStore.getState().openDocument(a);
    useStudioStore.getState().updateDocument(d => { d.name = 'A edited'; }, 'Edit A');
    useStudioStore.getState().openDocument(b);
    useStudioStore.getState().updateDocument(d => { d.name = 'B edited'; }, 'Edit B');
    useStudioStore.getState().switchDocument(a.id);
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().activeDocumentId).toBe(a.id);
    expect(useStudioStore.getState().document.name).toBe(a.name);
    useStudioStore.getState().switchDocument(b.id);
    expect(useStudioStore.getState().document.name).toBe('B edited');
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().document.name).toBe(b.name);
  });

  it('keeps selection when closing a different tab', () => {
    const a = createDefaultDocument({ id: 'selection-A' });
    const b = createDefaultDocument({ id: 'selection-B' });
    useStudioStore.getState().openDocument(a);
    useStudioStore.getState().openDocument(b);
    useStudioStore.getState().switchDocument(a.id);
    const id = Object.keys(a.nodes)[0];
    useStudioStore.getState().selectNodes([id]);
    useStudioStore.getState().closeDocument(b.id);
    expect(useStudioStore.getState().selectedNodeIds).toEqual([id]);
  });

  it('duplicates and copies group descendants with independent IDs', () => {
    const source = createDefaultDocument({ id: 'group-source' });
    useStudioStore.getState().openDocument(source);
    useStudioStore.getState().selectNodes(source.layers[0].nodeIds.slice(0, 2));
    useStudioStore.getState().groupSelection();
    const original = useStudioStore.getState().selectedNodeIds[0];
    useStudioStore.getState().duplicateSelectedNodes();
    let state = useStudioStore.getState();
    const copy = state.document.nodes[state.selectedNodeIds[0]];
    expect(copy.children).not.toEqual(state.document.nodes[original].children);
    for (const id of copy.children!) expect(state.document.nodes[id].parentId).toBe(copy.id);
    state.copySelection();
    state.openDocument(createDefaultDocument({ id: 'group-target', includeSampleArtwork: false }));
    useStudioStore.getState().pasteClipboard();
    state = useStudioStore.getState();
    const pasted = state.document.nodes[state.selectedNodeIds[0]];
    for (const id of pasted.children!) expect(state.document.nodes[id].parentId).toBe(pasted.id);
    state.ungroupSelection();
    state = useStudioStore.getState();
    for (const id of pasted.children!) expect(state.document.layers[0].nodeIds).toContain(id);
  });

  it('pastes relative to the source artboard', () => {
    const doc = createDefaultDocument({ id: 'all-ab', width: 100, height: 100, artboardCount: 2 });
    const id = doc.layers[0].nodeIds[0];
    doc.nodes[id].x = doc.artboards[1].x + 20;
    doc.activeArtboardId = doc.artboards[1].id;
    useStudioStore.getState().openDocument(doc);
    useStudioStore.getState().selectNodes([id]);
    useStudioStore.getState().copySelection();
    useStudioStore.getState().pasteClipboard('all-artboards');
    const state = useStudioStore.getState();
    expect(state.selectedNodeIds.map(id => state.document.nodes[id].x)).toEqual([20, doc.artboards[1].x + 20]);
  });

  it('applies rotation when sampling Pathfinder input', () => {
    const doc = createDefaultDocument();
    const node = doc.nodes[doc.layers[0].nodeIds[0]];
    expect(nodeToPolygon({ ...node, rotation: 90 })).not.toEqual(nodeToPolygon({ ...node, rotation: 0 }));
  });

  it('preserves hidden layers in merge and hides them in SVG and thumbnail', () => {
    const source = createDefaultDocument();
    source.layers.forEach(l => { l.visible = false; });
    const target = createDefaultDocument({ includeSampleArtwork: false });
    const merged = mergeAdlozeIntoDocument(target, source);
    expect(merged.layers.slice(target.layers.length).every(l => !l.visible)).toBe(true);
    expect(exportDocumentToSvgString(source)).not.toContain('<path');
    expect(decodeURIComponent(generateDocumentThumbnailDataUrl(source))).not.toContain('<path');
  });

  it('exports placed images as SVG image elements', () => {
    const doc = createDefaultDocument();
    const node = doc.nodes[doc.layers[0].nodeIds[0]];
    node.type = 'image'; node.imageUrl = 'data:image/png;base64,AAAA';
    expect(exportDocumentToSvgString(doc)).toContain('href="data:image/png;base64,AAAA"');
  });

  it('uses the same text layout for SVG and handles empty text', () => {
    const doc = createDefaultDocument();
    const node = doc.nodes[doc.layers[0].nodeIds[0]];
    node.type = 'text'; node.textContent = 'first\nsecond';
    const layout = layoutText(node);
    expect(layout.lines).toEqual(['first', 'second']);
    const svg = exportDocumentToSvgString(doc);
    expect(svg).toContain('first</tspan><tspan');
    node.textContent = '';
    expect(layoutText(node).lines).toEqual(['']);
  });

  it('does not fabricate a traced shape for a transparent image', () => {
    expect(() => traceImageDataToVectorNodes({ width: 10, height: 10, data: new Uint8ClampedArray(400) }, { x: 0, y: 0, width: 100, height: 100 }, 'layer', {})).toThrow(/no visible paths/i);
  });

  it('imports zero opacity and zero circle coordinates', () => {
    const result = parseSvgStringToVectorNodes('<svg xmlns="http://www.w3.org/2000/svg"><circle id="c" cx="0" cy="0" r="10" opacity="0"/></svg>');
    const circle = result.nodes.find(n => n.name === 'c')!;
    expect(circle.opacity).toBe(0);
    expect([circle.x, circle.y]).toEqual([-10, -10]);
  });
});
