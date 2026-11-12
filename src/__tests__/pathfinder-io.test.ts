// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import type { VectorNode } from '../core/types';
import { createRectangleAnchors } from '../core/math/bezier';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { performPathfinder } from '../core/math/pathfinder';
import { exportDocumentToSvgString, parseSvgStringToVectorNodes } from '../core/io/svgIo';
import { exportDocumentToPdfBytes } from '../core/io/pdfExport';
import { generateDocumentThumbnailDataUrl } from '../core/io/db';

it('preserves Pathfinder hole contours in SVG roundtrip, thumbnail and PDF stream', async () => {
  const doc = createDefaultDocument({ width: 100, height: 100, includeSampleArtwork: false });
  const make = (id: string, x: number, y: number, size: number): VectorNode => ({
    id, name: id, type: 'rectangle', layerId: doc.layers[0].id, visible: true, locked: false,
    x, y, width: size, height: size, rotation: 0, points: createRectangleAnchors(x, y, size, size), closed: true,
    fills: [{ id: 'f', visible: true, type: 'solid', color: '#ff0000', opacity: 1, blendMode: 'normal' }],
    strokes: [], effects: [], opacity: 1, blendMode: 'normal',
  });
  const result = performPathfinder([make('outer', 0, 0, 100), make('inner', 25, 25, 50)], 'minus-front')[0];
  doc.nodes = { [result.id]: result }; doc.layers[0].nodeIds = [result.id];
  const svg = exportDocumentToSvgString(doc);
  const imported = parseSvgStringToVectorNodes(svg).nodes.find(n => n.type === 'path')!;
  expect(imported.fillRule).toBe('evenodd');
  expect(imported.points.filter(p => p.moveTo)).toHaveLength(1);
  const thumbnail = decodeURIComponent(generateDocumentThumbnailDataUrl(doc));
  expect(thumbnail).toContain('fill-rule="evenodd"');
  expect((thumbnail.match(/M /g) || []).length).toBe(2);
  const pdf = await PDFDocument.load(await exportDocumentToPdfBytes(doc, { trimMarks: false, registrationMarks: false, colorBars: false, pageInformation: false }));
  const contents = pdf.getPages()[0].node.Contents() as PDFArray;
  const stream = pdf.context.lookup(contents.get(0)) as PDFRawStream;
  const ops = new TextDecoder().decode(decodePDFRawStream(stream).decode());
  expect((ops.match(/\bm\b/g) || []).length).toBeGreaterThanOrEqual(2);
});
