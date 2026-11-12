import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ArtboardItem, StudioDocument } from '../types';
import { hexToRgb } from '../math/color';
import { renderNodesToPdfPage } from './pdfRender';

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
  /** Called (once per distinct message) for artwork the PDF cannot reproduce faithfully. */
  onWarning?: (message: string) => void;
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

  const seenWarnings = new Set<string>();
  const warn = (message: string) => {
    if (seenWarnings.has(message)) return;
    seenWarnings.add(message);
    opts.onWarning?.(message);
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

    renderNodesToPdfPage({
      pdfDoc, page, doc, artboard: ab,
      originX: trimLeftPdfX, originY: trimTopPdfY,
      fonts: { regular: helvetica, bold: helveticaBold },
      warn,
    });

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
