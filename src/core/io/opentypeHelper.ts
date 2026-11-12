import opentype from 'opentype.js';
import { layoutText, textGlyphTransform } from '../math/textLayout';
import type { AnchorPoint, VectorNode } from '../types';

export interface LoadedCustomFont {
  id: string;
  familyName: string;
  styleName: string;
  fileName: string;
  font: opentype.Font;
  loadedAt: number;
}

export interface OutlinedTextResult {
  groupNode: VectorNode;
  childNodes: VectorNode[];
}

/** Why a text object could not be turned into outlines. Callers keep the live text in every case. */
export class TextOutlineError extends Error {
  constructor(public readonly reason: 'font-unavailable' | 'unsupported' | 'empty', message: string) {
    super(message);
    this.name = 'TextOutlineError';
  }
}

const loadedFontsByFamily = new Map<string, LoadedCustomFont>();

/** First family of a CSS font stack, unquoted and lower-cased: `"Inter", sans-serif` -> `inter`. */
export function normalizeFontFamily(family: string | undefined): string {
  return (family ?? '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
}

export function getLoadedCustomFonts(): LoadedCustomFont[] {
  return Array.from(loadedFontsByFamily.values());
}

/** The font file loaded for this text's family, if the user provided one. */
export function findOutlineFont(textNode: VectorNode): LoadedCustomFont | undefined {
  return loadedFontsByFamily.get(normalizeFontFamily(textNode.textStyle?.fontFamily));
}

/**
 * Loads a local TTF/OTF/WOFF font file into both opentype.js (for exact Bezier Create Outlines)
 * and the browser's CSS FontFace registry (for live canvas rendering).
 */
export async function loadCustomFontFile(file: File): Promise<LoadedCustomFont> {
  const buffer = await file.arrayBuffer();
  const font = opentype.parse(buffer);
  const rawFamily =
    font.names.fontFamily?.en ||
    Object.values(font.names.fontFamily || {})[0] ||
    file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
  const styleName =
    font.names.fontSubfamily?.en ||
    Object.values(font.names.fontSubfamily || {})[0] ||
    'Regular';

  if (typeof window !== 'undefined' && 'FontFace' in window) {
    try {
      const fontFace = new FontFace(rawFamily, buffer);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);
    } catch {
      // Fallback: opentype outlines will still work even if CSS FontFace fails
    }
  }

  const record: LoadedCustomFont = {
    id: `font-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    familyName: rawFamily,
    styleName,
    fileName: file.name,
    font,
    loadedAt: Date.now(),
  };

  loadedFontsByFamily.set(normalizeFontFamily(rawFamily), record);
  return record;
}

/** Test/runtime hook for registering an already-parsed font. */
export function registerOutlineFont(familyName: string, font: opentype.Font, styleName = 'Regular'): LoadedCustomFont {
  const record: LoadedCustomFont = { id: `font-${familyName}`, familyName, styleName, fileName: `${familyName}.ttf`, font, loadedAt: Date.now() };
  loadedFontsByFamily.set(normalizeFontFamily(familyName), record);
  return record;
}

export function unregisterOutlineFont(familyName: string): void {
  loadedFontsByFamily.delete(normalizeFontFamily(familyName));
}

/**
 * Converts a live Text VectorNode into a <Group> of Bezier glyph <Compound Path>s
 * (Adobe Illustrator Type > Create Outlines / Shift+Ctrl+O).
 *
 * Outlines come only from a real font file the user loaded (family must match). With no such font this
 * throws instead of drawing look-alike letters, so artwork is never silently replaced. Line breaks,
 * alignment, tracking, kerning, leading and the glyph transform follow the same layout as live text;
 * the node rotation is baked into the geometry.
 */
export function convertTextNodeToOutlineNodes(textNode: VectorNode, idSuffix = 'outlines'): OutlinedTextResult {
  const style = textNode.textStyle;
  const content = textNode.textContent ?? '';
  if (!content.trim()) throw new TextOutlineError('empty', 'This text object is empty, so there is nothing to outline.');
  if (style?.vertical || style?.typeMode === 'path' || (style?.touchTransforms?.length ?? 0) > 0 ||
      (style?.textCase && !['normal', 'uppercase'].includes(style.textCase))) {
    throw new TextOutlineError('unsupported', 'Outlining vertical text, type on a path, touch-type edits and small-caps/superscript/subscript is not supported yet.');
  }
  const loaded = findOutlineFont(textNode);
  if (!loaded) {
    const family = style?.fontFamily?.split(',')[0]?.replace(/["']/g, '').trim() || 'this font';
    throw new TextOutlineError('font-unavailable', `The font "${family}" is not loaded as a font file, so exact outlines are not possible. Upload it in the Typography panel (Upload font), then try again.`);
  }
  const font = loaded.font;
  const tracking = style?.tracking ?? 0;
  const measure = (text: string, size: number) => font.getAdvanceWidth(text, size, { kerning: true });
  const layout = layoutText(textNode, measure);
  const glyphTransform = textGlyphTransform(textNode);
  const centre = { x: textNode.x + textNode.width / 2, y: textNode.y + textNode.height / 2 };
  const angle = ((textNode.rotation || 0) * Math.PI) / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const place = (p: { x: number; y: number }) => {
    const x = glyphTransform.sx * p.x + glyphTransform.tx, y = glyphTransform.sy * p.y + glyphTransform.ty;
    if (!angle) return { x, y };
    return { x: centre.x + (x - centre.x) * cos - (y - centre.y) * sin, y: centre.y + (x - centre.x) * sin + (y - centre.y) * cos };
  };

  const groupId = `${textNode.id}-${idSuffix}`;
  const childNodes: VectorNode[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  layout.lines.forEach((line, lineIdx) => {
    if (!line) return;
    const lineWidth = font.getAdvanceWidth(line, layout.fontSize, { kerning: true, tracking });
    const startX = layout.x - (layout.align === 'center' ? lineWidth / 2 : layout.align === 'right' ? lineWidth : 0);
    const baseline = layout.y + lineIdx * layout.leading;
    let glyphIdx = 0;
    font.forEachGlyph(line, startX, baseline, layout.fontSize, { kerning: true, tracking }, (glyph, gx, gy, gSize) => {
      const index = glyphIdx++;
      const contours = opentypeCommandsToContours(glyph.getPath(gx, gy, gSize).commands).filter((c) => c.length > 1);
      if (!contours.length) return; // spaces and other empty glyphs
      const points: AnchorPoint[] = contours.flatMap((contour) =>
        contour.map((pt, i) => ({
          ...pt,
          ...place(pt),
          handleIn: pt.handleIn && place(pt.handleIn),
          handleOut: pt.handleOut && place(pt.handleOut),
          ...(i === 0 && contour !== contours[0] ? { moveTo: true } : {}),
        }))
      );
      let cMinX = Infinity, cMinY = Infinity, cMaxX = -Infinity, cMaxY = -Infinity;
      for (const pt of points) {
        for (const q of [pt, pt.handleIn, pt.handleOut]) {
          if (!q) continue;
          cMinX = Math.min(cMinX, q.x); cMinY = Math.min(cMinY, q.y); cMaxX = Math.max(cMaxX, q.x); cMaxY = Math.max(cMaxY, q.y);
        }
      }
      minX = Math.min(minX, cMinX); minY = Math.min(minY, cMinY); maxX = Math.max(maxX, cMaxX); maxY = Math.max(maxY, cMaxY);
      childNodes.push({
        id: `${groupId}-glyph-${lineIdx}-${index}`,
        name: `<Compound Path> "${glyph.unicode ? String.fromCodePoint(glyph.unicode) : glyph.name ?? ''}"`,
        type: contours.length > 1 ? 'compound-path' : 'path',
        layerId: textNode.layerId,
        parentId: groupId,
        visible: true,
        locked: false,
        x: cMinX, y: cMinY, width: Math.max(0.01, cMaxX - cMinX), height: Math.max(0.01, cMaxY - cMinY),
        rotation: 0,
        points,
        closed: true,
        // Fonts wind counters opposite to their outer contour, so the font's own nonzero rule keeps overlaps solid.
        fillRule: 'nonzero',
        fills: JSON.parse(JSON.stringify(textNode.fills || [])),
        strokes: JSON.parse(JSON.stringify(textNode.strokes || [])),
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      });
    });
  });

  if (!childNodes.length || !Number.isFinite(minX)) {
    throw new TextOutlineError('empty', 'The font has no outlines for this text.');
  }

  const groupNode: VectorNode = {
    id: groupId,
    name: `<Group> (${content.slice(0, 18)} Outlines)`,
    type: 'group',
    layerId: textNode.layerId,
    parentId: textNode.parentId,
    visible: textNode.visible ?? true,
    locked: false,
    x: minX, y: minY, width: Math.max(0.01, maxX - minX), height: Math.max(0.01, maxY - minY),
    rotation: 0,
    points: [],
    closed: true,
    fills: [],
    strokes: [],
    // Appearance of the live text moves to the group so it is applied once, not once per glyph.
    effects: JSON.parse(JSON.stringify(textNode.effects || [])),
    opacity: textNode.opacity ?? 1,
    blendMode: textNode.blendMode ?? 'normal',
    children: childNodes.map((c) => c.id),
  };

  return { groupNode, childNodes };
}

/**
 * Convenience single-node wrapper returning the outlined group node.
 */
export function convertTextNodeToOutlines(textNode: VectorNode): VectorNode {
  return convertTextNodeToOutlineNodes(textNode).groupNode;
}

function makeAnchor(
  x: number,
  y: number,
  pointType: 'corner' | 'smooth' = 'corner',
  handleIn?: { x: number; y: number },
  handleOut?: { x: number; y: number }
): AnchorPoint {
  return {
    id: `pt-${Math.random().toString(36).slice(2, 9)}`,
    x,
    y,
    pointType,
    handleIn,
    handleOut,
  };
}

function opentypeCommandsToContours(commands: opentype.PathCommand[]): AnchorPoint[][] {
  const contours: AnchorPoint[][] = [];
  let current: AnchorPoint[] = [];

  for (const cmd of commands) {
    if (cmd.type === 'M') {
      if (current.length > 0) contours.push(current);
      current = [makeAnchor(cmd.x, cmd.y, 'corner')];
    } else if (cmd.type === 'L') {
      current.push(makeAnchor(cmd.x, cmd.y, 'corner'));
    } else if (cmd.type === 'C') {
      const prev = current[current.length - 1];
      if (prev) {
        prev.handleOut = { x: cmd.x1, y: cmd.y1 };
      }
      current.push(makeAnchor(cmd.x, cmd.y, 'smooth', { x: cmd.x2, y: cmd.y2 }));
    } else if (cmd.type === 'Q') {
      const prev = current[current.length - 1];
      if (prev) {
        const c1x = prev.x + (2 / 3) * (cmd.x1 - prev.x);
        const c1y = prev.y + (2 / 3) * (cmd.y1 - prev.y);
        const c2x = cmd.x + (2 / 3) * (cmd.x1 - cmd.x);
        const c2y = cmd.y + (2 / 3) * (cmd.y1 - cmd.y);
        prev.handleOut = { x: c1x, y: c1y };
        current.push(makeAnchor(cmd.x, cmd.y, 'smooth', { x: c2x, y: c2y }));
      }
    } else if (cmd.type === 'Z') {
      if (current.length > 0) {
        contours.push(current);
        current = [];
      }
    }
  }
  if (current.length > 0) contours.push(current);
  return contours.map(closeContour);
}

/** Fonts repeat the first point before `Z`; keep the closing curve's handle on the first anchor instead of duplicating it. */
function closeContour(contour: AnchorPoint[]): AnchorPoint[] {
  if (contour.length > 2) {
    const first = contour[0], last = contour[contour.length - 1];
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
      if (last.handleIn) first.handleIn = last.handleIn;
      return contour.slice(0, -1);
    }
  }
  return contour;
}
