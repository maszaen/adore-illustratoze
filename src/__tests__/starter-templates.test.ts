import { describe, expect, it } from 'vitest';
import { STARTER_TEMPLATES } from '../core/presets/defaultPresets';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import { packDocumentToAdlozeBytes, unpackAdlozeBytesToDocument } from '../core/io/adlozeIo';

describe('starter templates', () => {
  it('creates distinct editable documents with valid layers, artboards and serializable artwork', () => {
    expect(STARTER_TEMPLATES).toHaveLength(4);
    const signatures = new Set<string>();
    for (const tpl of STARTER_TEMPLATES) {
      const doc = tpl.buildDocument();
      expect(Object.keys(doc.nodes).length).toBeGreaterThanOrEqual(5);
      expect(doc.layers.length).toBeGreaterThanOrEqual(1);
      expect(doc.layers.some(layer => layer.id === doc.activeLayerId)).toBe(true);
      for (const layer of doc.layers) for (const id of layer.nodeIds) {
        expect(doc.nodes[id]).toBeDefined(); expect(doc.nodes[id].layerId).toBe(layer.id);
      }
      const svg = exportDocumentToSvgString(doc);
      expect(svg).toContain('<path');
      expect(unpackAdlozeBytesToDocument(packDocumentToAdlozeBytes(doc)).document.nodes).toEqual(doc.nodes);
      signatures.add(Object.values(doc.nodes).map(node => node.name).join(','));
    }
    expect(signatures.size).toBe(4);
  });
  it('paints template background behind artwork in SVG, matching the editor', () => {
    const doc = STARTER_TEMPLATES[0].buildDocument();
    const svg = exportDocumentToSvgString(doc);
    expect(svg.indexOf('Warm_paper')).toBeLessThan(svg.indexOf('Emblem_disc'));
    expect(svg.indexOf('Emblem_disc')).toBeLessThan(svg.indexOf('Wordmark'));
  });
  it('puts a separate editable icon on each artboard and supplies packaging cut/fold guides', () => {
    const icons = STARTER_TEMPLATES[3].buildDocument();
    expect(icons.artboards).toHaveLength(4);
    for (const ab of icons.artboards) {
      expect(Object.values(icons.nodes).some(n => n.name === `${ab.name} tile` && n.x >= ab.x && n.y >= ab.y)).toBe(true);
      expect(exportDocumentToSvgString(icons, { artboardId: ab.id })).toContain(`viewBox="${ab.x} ${ab.y} ${ab.width} ${ab.height}"`);
    }
    const box = STARTER_TEMPLATES[2].buildDocument();
    expect(box.colorMode).toBe('CMYK'); expect(box.bleed.top).toBeCloseTo(3 * 72 / 25.4);
    expect(Object.values(box.nodes).some(n => n.name === 'Cut outline')).toBe(true);
    expect(Object.values(box.nodes).some(n => n.name === 'Fold 1' && n.strokes[0].dashArray.length > 0)).toBe(true);
  });
});
