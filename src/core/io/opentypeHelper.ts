import opentype from 'opentype.js';
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

const loadedFontsByFamily = new Map<string, LoadedCustomFont>();

export function getLoadedCustomFonts(): LoadedCustomFont[] {
  return Array.from(loadedFontsByFamily.values());
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

  loadedFontsByFamily.set(rawFamily.toLowerCase(), record);
  return record;
}

/**
 * Converts a live Text VectorNode into a <Group> VectorNode and its child Bezier character
 * <Compound Path> VectorNodes (Adobe Illustrator Type > Create Outlines / Shift+Ctrl+O).
 */
export function convertTextNodeToOutlineNodes(textNode: VectorNode): OutlinedTextResult {
  const content = (textNode.textContent ?? 'Text').toString();
  const style = textNode.textStyle;
  const fontSize = Math.max(4, style?.fontSize ?? 36);
  const trackingEm = (style?.tracking ?? 0) / 1000;
  const leadingPx = style?.leading && style.leading > 0 ? style.leading : fontSize * 1.2;
  const familyKey = (style?.fontFamily ?? '').toLowerCase().trim();
  const customFont = loadedFontsByFamily.get(familyKey);

  const lines = content.split(/\r?\n/);
  const childNodes: VectorNode[] = [];
  const baseX = textNode.x ?? 0;
  const baseY = textNode.y ?? 0;
  const groupId = `${textNode.id}-outlines`;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  lines.forEach((line, lineIdx) => {
    let cursorX = baseX;
    const baselineY = baseY + fontSize * 0.82 + lineIdx * leadingPx;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === ' ' || ch === '\t') {
        cursorX += fontSize * (ch === '\t' ? 1.1 : 0.32) + fontSize * trackingEm;
        continue;
      }

      let subpaths: AnchorPoint[][] = [];
      let charAdvance = fontSize * 0.58;

      if (customFont) {
        const otPath = customFont.font.getPath(ch, cursorX, baselineY, fontSize);
        subpaths = opentypeCommandsToContours(otPath.commands);
        const advanceUnits =
          customFont.font.charToGlyph(ch).advanceWidth || customFont.font.unitsPerEm * 0.6;
        charAdvance = (advanceUnits / customFont.font.unitsPerEm) * fontSize;
      } else {
        const fallback = buildGeometricGlyphContours(ch, cursorX, baselineY - fontSize * 0.75, fontSize);
        subpaths = fallback.contours;
        charAdvance = fallback.advance;
      }

      const flatPoints = subpaths.flat();
      if (flatPoints.length > 0) {
        let cMinX = Infinity,
          cMinY = Infinity,
          cMaxX = -Infinity,
          cMaxY = -Infinity;
        for (const pt of flatPoints) {
          if (pt.x < cMinX) cMinX = pt.x;
          if (pt.y < cMinY) cMinY = pt.y;
          if (pt.x > cMaxX) cMaxX = pt.x;
          if (pt.y > cMaxY) cMaxY = pt.y;
        }
        if (cMinX < minX) minX = cMinX;
        if (cMinY < minY) minY = cMinY;
        if (cMaxX > maxX) maxX = cMaxX;
        if (cMaxY > maxY) maxY = cMaxY;

        const charNode: VectorNode = {
          id: `${textNode.id}-char-${lineIdx}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          name: `<Compound Path> "${ch}"`,
          type: subpaths.length > 1 ? 'compound-path' : 'path',
          layerId: textNode.layerId,
          parentId: groupId,
          visible: true,
          locked: false,
          x: Number.isFinite(cMinX) ? cMinX : cursorX,
          y: Number.isFinite(cMinY) ? cMinY : baselineY - fontSize,
          width: Number.isFinite(cMaxX - cMinX) ? Math.max(2, cMaxX - cMinX) : charAdvance,
          height: Number.isFinite(cMaxY - cMinY) ? Math.max(2, cMaxY - cMinY) : fontSize,
          rotation: 0,
          points: subpaths[0],
          closed: true,
          fills: JSON.parse(JSON.stringify(textNode.fills || [])),
          strokes: JSON.parse(JSON.stringify(textNode.strokes || [])),
          effects: JSON.parse(JSON.stringify(textNode.effects || [])),
          opacity: textNode.opacity ?? 1,
          blendMode: textNode.blendMode ?? 'normal',
          fillRule: 'evenodd',
        };
        childNodes.push(charNode);
      }

      cursorX += charAdvance + fontSize * trackingEm;
    }
  });

  if (!Number.isFinite(minX)) {
    minX = baseX;
    minY = baseY;
    maxX = baseX + Math.max(40, textNode.width || 120);
    maxY = baseY + Math.max(20, textNode.height || fontSize);
  }

  const groupNode: VectorNode = {
    id: groupId,
    name: `<Group> (${content.slice(0, 18)} Outlines)`,
    type: 'group',
    layerId: textNode.layerId,
    parentId: textNode.parentId,
    visible: textNode.visible ?? true,
    locked: false,
    x: minX,
    y: minY,
    width: Math.max(4, maxX - minX),
    height: Math.max(4, maxY - minY),
    rotation: textNode.rotation ?? 0,
    points: childNodes.flatMap((c) => c.points),
    closed: true,
    fills: JSON.parse(JSON.stringify(textNode.fills || [])),
    strokes: JSON.parse(JSON.stringify(textNode.strokes || [])),
    effects: JSON.parse(JSON.stringify(textNode.effects || [])),
    opacity: textNode.opacity ?? 1,
    blendMode: textNode.blendMode ?? 'normal',
    children: childNodes.map((c) => c.id),
  };

  return { groupNode, childNodes };
}

/**
 * Convenience single-node wrapper returning the outlined group node (or single compound path).
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
  return contours;
}

/**
 * Offline fallback vector glyph generator producing true cubic Bezier AnchorPoint contours
 * (with smooth handles and inner compound counters for characters like O, A, B, D, P, Q, R, e, o, 0, 8).
 */
function buildGeometricGlyphContours(
  ch: string,
  x: number,
  topY: number,
  fontSize: number
): { contours: AnchorPoint[][]; advance: number } {
  const isLower = ch >= 'a' && ch <= 'z';
  const capH = fontSize * 0.75;
  const xH = fontSize * 0.54;
  const h = isLower ? xH : capH;
  const y0 = isLower ? topY + (capH - xH) : topY;
  const w = fontSize * (isLower ? 0.48 : 0.58);
  const strokeT = Math.max(1.5, fontSize * 0.11);

  const corner = (px: number, py: number): AnchorPoint => makeAnchor(px, py, 'corner');

  const makeEllipseContour = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    reverse = false
  ): AnchorPoint[] => {
    const k = 0.5522847498;
    const ox = rx * k;
    const oy = ry * k;
    const pts: AnchorPoint[] = [
      makeAnchor(cx, cy - ry, 'smooth', { x: cx - ox, y: cy - ry }, { x: cx + ox, y: cy - ry }),
      makeAnchor(cx + rx, cy, 'smooth', { x: cx + rx, y: cy - oy }, { x: cx + rx, y: cy + oy }),
      makeAnchor(cx, cy + ry, 'smooth', { x: cx + ox, y: cy + ry }, { x: cx - ox, y: cy + ry }),
      makeAnchor(cx - rx, cy, 'smooth', { x: cx - rx, y: cy + oy }, { x: cx - rx, y: cy - oy }),
    ];
    if (reverse) {
      return pts
        .slice()
        .reverse()
        .map((p) => ({
          ...p,
          handleIn: p.handleOut,
          handleOut: p.handleIn,
        }));
    }
    return pts;
  };

  const upper = ch.toUpperCase();

  if (upper === 'O' || ch === '0') {
    const cx = x + w / 2;
    const cy = y0 + h / 2;
    return {
      contours: [
        makeEllipseContour(cx, cy, w / 2, h / 2, false),
        makeEllipseContour(cx, cy, Math.max(2, w / 2 - strokeT), Math.max(2, h / 2 - strokeT), true),
      ],
      advance: w + fontSize * 0.08,
    };
  }

  if (upper === 'A') {
    const outer: AnchorPoint[] = [
      corner(x + w * 0.5, y0),
      corner(x + w, y0 + h),
      corner(x + w - strokeT, y0 + h),
      corner(x + w * 0.72, y0 + h * 0.68),
      corner(x + w * 0.28, y0 + h * 0.68),
      corner(x + strokeT, y0 + h),
      corner(x, y0 + h),
    ];
    const inner: AnchorPoint[] = [
      corner(x + w * 0.5, y0 + strokeT * 1.4),
      corner(x + w * 0.34, y0 + h * 0.55),
      corner(x + w * 0.66, y0 + h * 0.55),
    ];
    return { contours: [outer, inner], advance: w + fontSize * 0.08 };
  }

  if (upper === 'I' || ch === '1' || ch === 'l') {
    const iw = strokeT * 1.3;
    return {
      contours: [
        [corner(x, y0), corner(x + iw, y0), corner(x + iw, y0 + h), corner(x, y0 + h)],
      ],
      advance: iw + fontSize * 0.1,
    };
  }

  if (upper === 'L') {
    return {
      contours: [
        [
          corner(x, y0),
          corner(x + strokeT, y0),
          corner(x + strokeT, y0 + h - strokeT),
          corner(x + w * 0.85, y0 + h - strokeT),
          corner(x + w * 0.85, y0 + h),
          corner(x, y0 + h),
        ],
      ],
      advance: w * 0.92,
    };
  }

  if (upper === 'T') {
    const mid = x + w / 2;
    return {
      contours: [
        [
          corner(x, y0),
          corner(x + w, y0),
          corner(x + w, y0 + strokeT),
          corner(mid + strokeT / 2, y0 + strokeT),
          corner(mid + strokeT / 2, y0 + h),
          corner(mid - strokeT / 2, y0 + h),
          corner(mid - strokeT / 2, y0 + strokeT),
          corner(x, y0 + strokeT),
        ],
      ],
      advance: w + fontSize * 0.06,
    };
  }

  if (upper === 'H') {
    const midY = y0 + h / 2;
    return {
      contours: [
        [
          corner(x, y0),
          corner(x + strokeT, y0),
          corner(x + strokeT, midY - strokeT / 2),
          corner(x + w - strokeT, midY - strokeT / 2),
          corner(x + w - strokeT, y0),
          corner(x + w, y0),
          corner(x + w, y0 + h),
          corner(x + w - strokeT, y0 + h),
          corner(x + w - strokeT, midY + strokeT / 2),
          corner(x + strokeT, midY + strokeT / 2),
          corner(x + strokeT, y0 + h),
          corner(x, y0 + h),
        ],
      ],
      advance: w + fontSize * 0.08,
    };
  }

  if (upper === 'E' || upper === 'F') {
    const midY = y0 + h * 0.48;
    const pts: AnchorPoint[] = [
      corner(x, y0),
      corner(x + w * 0.9, y0),
      corner(x + w * 0.9, y0 + strokeT),
      corner(x + strokeT, y0 + strokeT),
      corner(x + strokeT, midY - strokeT / 2),
      corner(x + w * 0.78, midY - strokeT / 2),
      corner(x + w * 0.78, midY + strokeT / 2),
      corner(x + strokeT, midY + strokeT / 2),
    ];
    if (upper === 'E') {
      pts.push(
        corner(x + strokeT, y0 + h - strokeT),
        corner(x + w * 0.92, y0 + h - strokeT),
        corner(x + w * 0.92, y0 + h),
        corner(x, y0 + h)
      );
    } else {
      pts.push(corner(x + strokeT, y0 + h), corner(x, y0 + h));
    }
    return { contours: [pts], advance: w };
  }

  if (upper === 'C') {
    const cx = x + w * 0.52;
    const cy = y0 + h / 2;
    const rx = w * 0.48;
    const ry = h / 2;
    return {
      contours: [
        [
          makeAnchor(x + w * 0.92, y0 + h * 0.25, 'smooth', undefined, { x: cx + rx * 0.4, y: y0 }),
          makeAnchor(cx, y0, 'smooth', { x: cx + rx * 0.5, y: y0 }, { x: x, y: y0 }),
          makeAnchor(x, cy, 'smooth', { x: x, y: y0 + ry * 0.3 }, { x: x, y: y0 + h - ry * 0.3 }),
          makeAnchor(cx, y0 + h, 'smooth', { x: x, y: y0 + h }, { x: cx + rx * 0.5, y: y0 + h }),
          makeAnchor(x + w * 0.92, y0 + h * 0.75, 'corner', { x: cx + rx * 0.4, y: y0 + h }),
          corner(x + w * 0.76, y0 + h * 0.72),
          makeAnchor(
            cx,
            y0 + h - strokeT,
            'smooth',
            { x: cx + rx * 0.3, y: y0 + h - strokeT },
            { x: x + strokeT, y: y0 + h - strokeT }
          ),
          makeAnchor(
            x + strokeT,
            cy,
            'smooth',
            { x: x + strokeT, y: cy + ry * 0.5 },
            { x: x + strokeT, y: cy - ry * 0.5 }
          ),
          makeAnchor(
            cx,
            y0 + strokeT,
            'smooth',
            { x: x + strokeT, y: y0 + strokeT },
            { x: cx + rx * 0.3, y: y0 + strokeT }
          ),
          corner(x + w * 0.76, y0 + h * 0.28),
        ],
      ],
      advance: w + fontSize * 0.06,
    };
  }

  const r = Math.min(w, h) * 0.22;
  const outer: AnchorPoint[] = [
    makeAnchor(x + r, y0, 'smooth', { x: x + r * 0.4, y: y0 }),
    makeAnchor(x + w - r, y0, 'smooth', undefined, { x: x + w - r * 0.4, y: y0 }),
    makeAnchor(x + w, y0 + r, 'smooth', { x: x + w, y: y0 + r * 0.4 }),
    makeAnchor(x + w, y0 + h - r, 'smooth', undefined, { x: x + w, y: y0 + h - r * 0.4 }),
    makeAnchor(x + w - r, y0 + h, 'smooth', { x: x + w - r * 0.4, y: y0 + h }),
    makeAnchor(x + r, y0 + h, 'smooth', undefined, { x: x + r * 0.4, y: y0 + h }),
    makeAnchor(x, y0 + h - r, 'smooth', { x: x, y: y0 + h - r * 0.4 }),
    makeAnchor(x, y0 + r, 'smooth', undefined, { x: x, y: y0 + r * 0.4 }),
  ];
  const inner = [
    corner(x + strokeT, y0 + strokeT),
    corner(x + strokeT, y0 + h - strokeT),
    corner(x + w - strokeT, y0 + h - strokeT),
    corner(x + w - strokeT, y0 + strokeT),
  ];

  return {
    contours: [outer, inner],
    advance: w + fontSize * 0.08,
  };
}
