import { layoutText, textGlyphTransform } from '../math/textLayout';
import { PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, concatTransformationMatrix } from 'pdf-lib';
import type { ArtboardItem, StudioDocument, VectorNode } from '../types';
import { hexToRgb } from '../math/color';
import { anchorPointsToSvgPathD } from './svgIo';

export interface PdfExportOptions {
  artboardIds?: string[];
  useDocumentBleed: boolean;
  customBleed?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  trimMarks: boolean;
  registrationMarks: boolean;
  colorBars: boolean;
  pageInformation: boolean;
  markWeightPt: number;
  markOffsetPt: number;
}

export const DEFAULT_PDF_EXPORT_OPTIONS: PdfExportOptions = {
  useDocumentBleed: true,
  trimMarks: true,
  registrationMarks: true,
  colorBars: true,
  pageInformation: true,
  markWeightPt: 0.35,
  markOffsetPt: 6,
};

function hexToPdfRgb(hex: string) {
  const { r, g, b } = hexToRgb(hex || '#000000');
  return rgb(r / 255, g / 255, b / 255);
}

/**
 * Generates a print-ready multi-artboard vector PDF byte array using pdf-lib,
 * complete with Document Bleed, Trim/Crop Marks, Registration Marks, CMYK/Grayscale Color Bars,
 * and Page Information.
 */
export async function exportDocumentToPdfBytes(
  doc: StudioDocument,
  partialOptions?: Partial<PdfExportOptions>
): Promise<Uint8Array> {
  const opts: PdfExportOptions = {
    ...DEFAULT_PDF_EXPORT_OPTIONS,
    ...partialOptions,
  };

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(doc.name || 'Adore Illustratoze Artwork');
  pdfDoc.setCreator('Adore Illustratoze Studio (100% Adobe Illustrator CC Architecture)');
  pdfDoc.setProducer('Adore Illustratoze Vector PDF Engine (pdf-lib)');

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const selectedArtboards: ArtboardItem[] =
    opts.artboardIds && opts.artboardIds.length > 0
      ? doc.artboards.filter((a) => opts.artboardIds!.includes(a.id))
      : doc.artboards;

  const artboardsToExport: ArtboardItem[] =
    selectedArtboards.length > 0
      ? selectedArtboards
      : [
          {
            id: 'ab-1',
            name: 'Artboard 1',
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            orientation: 'landscape',
            showCenterMark: false,
            showCrossHairs: false,
            showVideoSafeAreas: false,
          },
        ];

  const bleed = opts.useDocumentBleed
    ? doc.bleed || { top: 0, bottom: 0, left: 0, right: 0 }
    : opts.customBleed || { top: 0, bottom: 0, left: 0, right: 0 };

  const hasPrinterMarks =
    opts.trimMarks || opts.registrationMarks || opts.colorBars || opts.pageInformation;
  const marksMargin = hasPrinterMarks ? 36 : 0;

  const nodesMap = doc.nodes || {};
  const orderedRootNodes: VectorNode[] = [];
  for (const layer of doc.layers || []) {
    if (!layer.visible) continue;
    for (const nid of layer.nodeIds || []) {
      const n = nodesMap[nid];
      if (n && n.visible && !n.parentId && !n.isGuide) {
        orderedRootNodes.push(n);
      }
    }
  }
  if (orderedRootNodes.length === 0) {
    for (const n of Object.values(nodesMap)) {
      if (n && n.visible && !n.parentId && !n.isGuide && !(doc.layers || []).some(layer => layer.nodeIds?.includes(n.id))) {
        orderedRootNodes.push(n);
      }
    }
  }

  for (let pageIdx = 0; pageIdx < artboardsToExport.length; pageIdx++) {
    const ab = artboardsToExport[pageIdx];
    const trimW = Math.max(10, ab.width);
    const trimH = Math.max(10, ab.height);

    const bleedLeft = Math.max(0, bleed.left || 0);
    const bleedRight = Math.max(0, bleed.right || 0);
    const bleedTop = Math.max(0, bleed.top || 0);
    const bleedBottom = Math.max(0, bleed.bottom || 0);

    const totalPageW = trimW + bleedLeft + bleedRight + marksMargin * 2;
    const totalPageH = trimH + bleedTop + bleedBottom + marksMargin * 2;

    const page = pdfDoc.addPage([totalPageW, totalPageH]);

    // Origin of the artboard's top-left corner in PDF coordinates (bottom-left origin)
    const trimLeftPdfX = marksMargin + bleedLeft;
    const trimRightPdfX = trimLeftPdfX + trimW;
    const trimBottomPdfY = marksMargin + bleedBottom;
    const trimTopPdfY = trimBottomPdfY + trimH;

    // White artboard background
    page.drawRectangle({
      x: trimLeftPdfX - bleedLeft,
      y: trimBottomPdfY - bleedBottom,
      width: trimW + bleedLeft + bleedRight,
      height: trimH + bleedTop + bleedBottom,
      color: ab.backgroundColor ? hexToPdfRgb(ab.backgroundColor) : rgb(1, 1, 1),
    });

    // Helper to map canvas (x, y) to PDF page (x, y)
    const toPdfX = (canvasX: number) => trimLeftPdfX + (canvasX - ab.x);
    const toPdfY = (canvasY: number) => trimTopPdfY - (canvasY - ab.y);

    const drawVectorNodeOnPage = (node: VectorNode) => {
      if (!node || !node.visible || node.isGuide) return;

      if (node.children && node.children.length > 0) {
        for (const cid of node.children) {
          const child = nodesMap[cid];
          if (child) drawVectorNodeOnPage(child);
        }
        if (node.type === 'group') return;
      }

      const primaryFill = (node.fills || []).find((f) => f.visible && f.type !== 'none');
      const primaryStroke = (node.strokes || []).find((s) => s.visible && s.weight > 0);

      const fillColor = primaryFill ? hexToPdfRgb(primaryFill.color || '#000000') : undefined;
      const fillOpacity = primaryFill ? (primaryFill.opacity ?? 1) * (node.opacity ?? 1) : 0;

      const borderColor = primaryStroke
        ? hexToPdfRgb(primaryStroke.color || '#000000')
        : undefined;
      const borderWidth = primaryStroke ? primaryStroke.weight : 0;
      const borderOpacity = primaryStroke
        ? (primaryStroke.opacity ?? 1) * (node.opacity ?? 1)
        : 0;

      if (node.type === 'text') {
        const layout = layoutText(node);
        const isBold = node.textStyle?.fontStyle?.toLowerCase().includes('bold');
        const font = isBold ? helveticaBold : helvetica;
        page.pushOperators(pushGraphicsState(), rectangle(toPdfX(node.x), toPdfY(node.y + node.height), Math.max(0, node.width), Math.max(0, node.height)), clip(), endPath());
        const glyph = textGlyphTransform(node);
        const ax = toPdfX(node.x), ay = toPdfY(node.y);
        page.pushOperators(concatTransformationMatrix(glyph.sx, 0, 0, glyph.sy,
          ax * (1 - glyph.sx) + (glyph.sx < 0 ? node.width : 0),
          ay * (1 - glyph.sy) - (glyph.sy < 0 ? node.height : 0)));
        if (primaryFill && fillOpacity > 0) layout.lines.forEach((line, lineIdx) => {
          const textWidth = font.widthOfTextAtSize(line, layout.fontSize);
          const x = layout.x - (layout.align === 'center' ? textWidth / 2 : layout.align === 'right' ? textWidth : 0);
          page.drawText(line, {
            x: toPdfX(x), y: toPdfY(layout.y + lineIdx * layout.leading),
            size: layout.fontSize, font, color: fillColor || rgb(0, 0, 0), opacity: fillOpacity,
          });
        });
        page.pushOperators(popGraphicsState());
        return;
      }

      if (node.type === 'ellipse' && (!node.points || node.points.length === 0)) {
        const rx = node.width / 2;
        const ry = node.height / 2;
        page.drawEllipse({
          x: toPdfX(node.x + rx),
          y: toPdfY(node.y + ry),
          xScale: rx,
          yScale: ry,
          color: fillColor,
          opacity: fillOpacity,
          borderColor,
          borderWidth,
          borderOpacity,
        });
        return;
      }

      if (node.type === 'rectangle' && (!node.points || node.points.length === 0)) {
        page.drawRectangle({
          x: toPdfX(node.x),
          y: toPdfY(node.y + node.height),
          width: node.width,
          height: node.height,
          color: fillColor,
          opacity: fillOpacity,
          borderColor,
          borderWidth,
          borderOpacity,
        });
        return;
      }

      if (node.points && node.points.length >= 2) {
        // Transform anchor points relative to artboard top-left so drawSvgPath places them accurately
        const localPoints = node.points.map((pt) => ({
          ...pt,
          x: pt.x - ab.x,
          y: pt.y - ab.y,
          handleIn: pt.handleIn
            ? { x: pt.handleIn.x - ab.x, y: pt.handleIn.y - ab.y }
            : undefined,
          handleOut: pt.handleOut
            ? { x: pt.handleOut.x - ab.x, y: pt.handleOut.y - ab.y }
            : undefined,
        }));
        const svgPathD = anchorPointsToSvgPathD(
          localPoints,
          node.closed !== false && node.type !== 'line'
        );
        if (svgPathD) {
          page.drawSvgPath(svgPathD, {
            x: trimLeftPdfX,
            y: trimTopPdfY,
            color: node.closed !== false && node.type !== 'line' ? fillColor : undefined,
            opacity: fillOpacity,
            borderColor,
            borderWidth,
            borderOpacity,
          });
        }
      }
    };

    for (const node of orderedRootNodes) {
      drawVectorNodeOnPage(node);
    }

    // Draw Printer Marks if enabled
    const markColor = rgb(0, 0, 0);
    const mw = Math.max(0.15, opts.markWeightPt || 0.35);
    const offset = Math.max(2, opts.markOffsetPt || 6) + Math.max(bleedLeft, bleedTop);
    const markLen = 18;

    if (opts.trimMarks) {
      // Top-Left corner trim marks
      page.drawLine({
        start: { x: trimLeftPdfX - offset - markLen, y: trimTopPdfY },
        end: { x: trimLeftPdfX - offset, y: trimTopPdfY },
        thickness: mw,
        color: markColor,
      });
      page.drawLine({
        start: { x: trimLeftPdfX, y: trimTopPdfY + offset },
        end: { x: trimLeftPdfX, y: trimTopPdfY + offset + markLen },
        thickness: mw,
        color: markColor,
      });

      // Top-Right corner trim marks
      page.drawLine({
        start: { x: trimRightPdfX + offset, y: trimTopPdfY },
        end: { x: trimRightPdfX + offset + markLen, y: trimTopPdfY },
        thickness: mw,
        color: markColor,
      });
      page.drawLine({
        start: { x: trimRightPdfX, y: trimTopPdfY + offset },
        end: { x: trimRightPdfX, y: trimTopPdfY + offset + markLen },
        thickness: mw,
        color: markColor,
      });

      // Bottom-Left corner trim marks
      page.drawLine({
        start: { x: trimLeftPdfX - offset - markLen, y: trimBottomPdfY },
        end: { x: trimLeftPdfX - offset, y: trimBottomPdfY },
        thickness: mw,
        color: markColor,
      });
      page.drawLine({
        start: { x: trimLeftPdfX, y: trimBottomPdfY - offset - markLen },
        end: { x: trimLeftPdfX, y: trimBottomPdfY - offset },
        thickness: mw,
        color: markColor,
      });

      // Bottom-Right corner trim marks
      page.drawLine({
        start: { x: trimRightPdfX + offset, y: trimBottomPdfY },
        end: { x: trimRightPdfX + offset + markLen, y: trimBottomPdfY },
        thickness: mw,
        color: markColor,
      });
      page.drawLine({
        start: { x: trimRightPdfX, y: trimBottomPdfY - offset - markLen },
        end: { x: trimRightPdfX, y: trimBottomPdfY - offset },
        thickness: mw,
        color: markColor,
      });
    }

    if (opts.registrationMarks) {
      const drawRegTarget = (cx: number, cy: number) => {
        const r = 4.5;
        page.drawEllipse({
          x: cx,
          y: cy,
          xScale: r,
          yScale: r,
          borderColor: markColor,
          borderWidth: mw,
        });
        page.drawEllipse({
          x: cx,
          y: cy,
          xScale: r * 0.45,
          yScale: r * 0.45,
          color: markColor,
        });
        page.drawLine({
          start: { x: cx - r * 1.6, y: cy },
          end: { x: cx + r * 1.6, y: cy },
          thickness: mw,
          color: markColor,
        });
        page.drawLine({
          start: { x: cx, y: cy - r * 1.6 },
          end: { x: cx, y: cy + r * 1.6 },
          thickness: mw,
          color: markColor,
        });
      };

      const midX = (trimLeftPdfX + trimRightPdfX) / 2;
      const midY = (trimBottomPdfY + trimTopPdfY) / 2;
      drawRegTarget(midX, trimTopPdfY + offset + 10);
      drawRegTarget(midX, trimBottomPdfY - offset - 10);
      drawRegTarget(trimLeftPdfX - offset - 10, midY);
      drawRegTarget(trimRightPdfX + offset + 10, midY);
    }

    if (opts.colorBars) {
      const barColors = [
        rgb(0, 0.68, 0.94), // Cyan
        rgb(0.93, 0, 0.55), // Magenta
        rgb(1, 0.95, 0), // Yellow
        rgb(0.1, 0.1, 0.1), // Black (Key)
        rgb(0.9, 0.15, 0.15), // Red (M+Y)
        rgb(0.1, 0.65, 0.3), // Green (C+Y)
        rgb(0.18, 0.2, 0.58), // Blue (C+M)
        rgb(0.85, 0.85, 0.85), // 15% Gray
        rgb(0.65, 0.65, 0.65), // 35% Gray
        rgb(0.45, 0.45, 0.45), // 55% Gray
        rgb(0.25, 0.25, 0.25), // 75% Gray
      ];
      const boxSize = 8;
      const startX = trimLeftPdfX + 12;
      const barY = trimTopPdfY + offset + 6;
      barColors.forEach((col, idx) => {
        page.drawRectangle({
          x: startX + idx * (boxSize + 1),
          y: barY,
          width: boxSize,
          height: boxSize,
          color: col,
          borderColor: rgb(0.2, 0.2, 0.2),
          borderWidth: 0.2,
        });
      });
    }

    if (opts.pageInformation) {
      const dateStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const infoText = `${doc.name || 'Untitled'}  |  ${ab.name || `Artboard ${pageIdx + 1}`}  |  Page ${pageIdx + 1} of ${artboardsToExport.length}  |  ${doc.colorMode || 'RGB'}  |  ${dateStr}`;
      page.drawText(infoText, {
        x: trimLeftPdfX + 4,
        y: Math.max(6, trimBottomPdfY - offset - 14),
        size: 6.5,
        font: helvetica,
        color: markColor,
      });
    }
  }

  return await pdfDoc.save();
}

export function triggerPdfDownload(pdfBytes: Uint8Array, fileName = 'artwork.pdf'): void {
  if (typeof document === 'undefined') return;
  const cleanName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
