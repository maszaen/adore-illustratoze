import { describe, expect, it, vi, afterEach } from 'vitest';
import { createDefaultDocument, STARTER_TEMPLATES } from '../core/presets/defaultPresets';
import { documentThumbnailBounds, generateDocumentThumbnailDataUrl, listProjectsFromDb, studioDb } from '../core/io/db';
import { createRectangleAnchors } from '../core/math/bezier';

afterEach(() => vi.restoreAllMocks());

describe('project workspace previews', () => {
  it('includes all artboards and visible off-artboard objects, but not hidden layers or groups', () => {
    const doc = createDefaultDocument({ width: 100, height: 100, artboardCount: 2, includeSampleArtwork: false });
    const base = STARTER_TEMPLATES[0].buildDocument().nodes['template-node-1'];
    const outside = { ...base, id: 'outside', name: 'outside', layerId: doc.layers[0].id, x: -50, y: -30, width: 20, height: 10, points: createRectangleAnchors(-50, -30, 20, 10), strokes: [] };
    const hidden = { ...outside, id: 'hidden', name: 'hidden', x: 5000, points: createRectangleAnchors(5000, 0, 20, 10), layerId: doc.layers[1].id };
    doc.nodes = { outside, hidden }; doc.layers[0].nodeIds = ['outside']; doc.layers[1].nodeIds = ['hidden']; doc.layers[1].visible = false;
    const bounds = documentThumbnailBounds(doc);
    expect(bounds.x).toBeLessThan(-50); expect(bounds.y).toBeLessThan(-30);
    expect(bounds.x + bounds.width).toBeGreaterThan(doc.artboards[1].x + doc.artboards[1].width);
    expect(bounds.x + bounds.width).toBeLessThan(1000);
    const svg = decodeURIComponent(generateDocumentThumbnailDataUrl(doc));
    expect(svg).toContain(`x="${doc.artboards[1].x}"`);
    expect(svg).toContain('id="outside"'); expect(svg).not.toContain('id="hidden"');
    expect(svg).toContain('viewBox=');
  });
  it('includes nested artwork and its stroke and excludes hidden parent subtrees', () => {
    const doc = createDefaultDocument({ width: 100, height: 100, includeSampleArtwork: false });
    const original = STARTER_TEMPLATES[0].buildDocument().nodes['template-node-2'];
    const child = { ...original, id: 'child', parentId: 'group', layerId: doc.layers[0].id, x: 400, y: 200, width: 100, height: 100, rotation: 45, points: createRectangleAnchors(400, 200, 100, 100), strokes: [{ id: 's', visible: true, color: '#000000', weight: 20, cap: 'round' as const, join: 'round' as const, miterLimit: 4, align: 'center' as const, dashArray: [], opacity: 1, blendMode: 'normal' as const }] };
    const group = { ...child, id: 'group', name: 'group', type: 'group' as const, parentId: undefined, children: ['child'], x: 0, y: 0, width: 1, height: 1 };
    doc.nodes = { child, group }; doc.layers[0].nodeIds = ['group'];
    const visible = documentThumbnailBounds(doc);
    expect(visible.x + visible.width).toBeGreaterThan(520);
    group.visible = false;
    const hidden = documentThumbnailBounds(doc);
    expect(hidden.x + hidden.width).toBeLessThan(120);
  });
  it('refreshes legacy thumbnails on listing without writing over newer project saves', async () => {
    const doc = createDefaultDocument({ artboardCount: 2, includeSampleArtwork: false });
    const legacy = { id: doc.id, name: doc.name, document: doc, thumbnailDataUrl: 'old', updatedAt: 1 };
    const toArray = vi.fn().mockResolvedValue([legacy]);
    vi.spyOn(studioDb.projects, 'orderBy').mockReturnValue({ reverse: () => ({ toArray }) } as any);
    const put = vi.spyOn(studioDb.projects, 'put');
    const [record] = await listProjectsFromDb();
    expect(record.thumbnailVersion).toBe(2); expect(record.thumbnailDataUrl).toContain('data:image/svg+xml');
    expect(put).not.toHaveBeenCalled(); expect(legacy.thumbnailDataUrl).toBe('old');
  });
});
