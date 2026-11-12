import {
  LineCapStyle,
  LineJoinStyle,
  PDFDocument,
  PDFFont,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFPage,
  appendBezierCurve,
  clip,
  clipEvenOdd,
  closePath,
  concatTransformationMatrix,
  endPath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setDashPattern,
  setFillingRgbColor,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
} from 'pdf-lib';
import { blendIntermediateNodes } from '../math/blend';
import { generateNodeSvgPath, generateVariableWidthStrokePolygon } from '../math/bezier';
import { clipsTextToFrame, layoutText, textGlyphTransform } from '../math/textLayout';
import { hexToRgb } from '../math/color';
import {
  gradientBox,
  isContainerNode,
  linearGradientAxis,
  normalizedGradientStops,
  parseCssColor,
  radialGradientEllipse,
  resolveClipMask,
  resolveEffects,
  resolvePaintColor,
} from '../render/appearance';
import type { ArtboardItem, FillItem, StudioDocument, VectorNode } from '../types';

/** Affine matrix in PDF/SVG order: x' = a*x + c*y + e, y' = b*x + d*y + f. */
export interface Matrix { a: number; b: number; c: number; d: number; e: number; f: number }

/** Apply `inner` first, then `outer`. */
export const compose = (outer: Matrix, inner: Matrix): Matrix => ({
  a: outer.a * inner.a + outer.c * inner.b,
  b: outer.b * inner.a + outer.d * inner.b,
  c: outer.a * inner.c + outer.c * inner.d,
  d: outer.b * inner.c + outer.d * inner.d,
  e: outer.a * inner.e + outer.c * inner.f + outer.e,
  f: outer.b * inner.e + outer.d * inner.f + outer.f,
});

/** Rotation by `degrees` (clockwise on a y-down canvas, like SVG rotate()) about a point. */
export function rotationAbout(degrees: number, cx: number, cy: number): Matrix {
  const r = (degrees * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  return { a: cos, b: sin, c: -sin, d: cos, e: cx - cx * cos + cy * sin, f: cy - cx * sin - cy * cos };
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const cm = (m: Matrix) => concatTransformationMatrix(m.a, m.b, m.c, m.d, m.e, m.f);
const matrixArray = (m: Matrix) => [m.a, m.b, m.c, m.d, m.e, m.f];

/** Converts the absolute M/L/C/Q/Z path data produced by the path generators into PDF path operators. */
export function svgPathToPdfOps(d: string): PDFOperator[] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const ops: PDFOperator[] = [];
  let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;
  const num = () => {
    const value = parseFloat(tokens[i++]);
    if (!Number.isFinite(value)) throw new Error('PDF export failed: invalid number in path data.');
    return value;
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === 'Z') { ops.push(closePath()); cx = sx; cy = sy; continue; }
    }
    if (cmd === 'M') { cx = sx = num(); cy = sy = num(); ops.push(moveTo(cx, cy)); cmd = 'L'; }
    else if (cmd === 'L') { cx = num(); cy = num(); ops.push(lineTo(cx, cy)); }
    else if (cmd === 'C') {
      const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
      ops.push(appendBezierCurve(x1, y1, x2, y2, x, y)); cx = x; cy = y;
    } else if (cmd === 'Q') {
      const qx = num(), qy = num(), x = num(), y = num();
      ops.push(appendBezierCurve(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y));
      cx = x; cy = y;
    } else throw new Error(`PDF export failed: unsupported path command "${cmd}".`);
  }
  return ops;
}

const op = (name: string, args: Array<number | PDFName> = []) =>
  PDFOperator.of(name as never, args.map((a) => (typeof a === 'number' ? PDFNumber.of(a) : a)));
const fillEvenOdd = () => op('f*');

const BLEND_NAMES: Record<string, string> = {};
const blendName = (mode: string | undefined): string | null => {
  if (!mode || mode === 'normal') return null;
  return (BLEND_NAMES[mode] ??= mode.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(''));
};

export interface PdfRenderEnv {
  pdfDoc: PDFDocument;
  page: PDFPage;
  doc: StudioDocument;
  artboard: ArtboardItem;
  /** PDF-space position of the artboard's top-left corner. */
  originX: number;
  originY: number;
  fonts: { regular: PDFFont; bold: PDFFont };
  warn: (message: string) => void;
}

/** Paints every visible layer of the document onto one PDF page (document units = PDF points). */
export function renderNodesToPdfPage(env: PdfRenderEnv): void {
  const { pdfDoc, page, doc, artboard: ab } = env;
  const nodes = doc.nodes || {};
  // document -> page: x + (originX - ab.x), originY + ab.y - y
  const toPage: Matrix = { a: 1, b: 0, c: 0, d: -1, e: env.originX - ab.x, f: env.originY + ab.y };
  const context = pdfDoc.context;
  const gsCache = new Map<string, PDFName>();
  let patternCounter = 0;

  const resources = page.node.Resources();
  if (!resources) throw new Error('PDF export failed: page resources are unavailable.');
  const patternDict = context.obj({});
  resources.set(PDFName.of('Pattern'), patternDict);

  const graphicsState = (entries: Record<string, unknown>): PDFName => {
    const key = JSON.stringify(entries, (_k, v) => (v && typeof v === 'object' && 'tag' in v ? String(v) : v));
    const cached = gsCache.get(key);
    if (cached) return cached;
    const name = page.node.newExtGState('GS', context.obj({ Type: 'ExtGState', ...entries }));
    gsCache.set(key, name);
    return name;
  };

  const colorComponents = (value: string): [number, number, number] => {
    const parsed = parseCssColor(value) ?? hexToRgb(value || '#000000');
    return [parsed.r / 255, parsed.g / 255, parsed.b / 255];
  };

  /** Stitched color (or alpha) function for a stop list. */
  const stopFunction = (stops: { offset: number; color: string; opacity: number }[], alpha: boolean) => {
    const list = stops.map((s) => ({ ...s }));
    if (list[0].offset > 0) list.unshift({ ...list[0], offset: 0 });
    if (list[list.length - 1].offset < 1) list.push({ ...list[list.length - 1], offset: 1 });
    const value = (s: (typeof list)[number]) => (alpha ? [s.opacity] : colorComponents(s.color));
    const functions = [], bounds: number[] = [], encode: number[] = [];
    for (let i = 0; i < list.length - 1; i++) {
      functions.push({ FunctionType: 2, Domain: [0, 1], C0: value(list[i]), C1: value(list[i + 1]), N: 1 });
      encode.push(0, 1);
      if (i > 0) bounds.push(Math.max(list[i].offset, (bounds[bounds.length - 1] ?? 0) + 1e-6));
    }
    if (functions.length === 1) return functions[0];
    return { FunctionType: 3, Domain: [0, 1], Functions: functions, Bounds: bounds, Encode: encode };
  };

  interface Shader { coords: number[]; radial: boolean; local: Matrix }
  const shaderFor = (node: VectorNode, fillItem: FillItem): Shader | null => {
    const g = fillItem.gradient;
    if (!g) return null;
    const box = gradientBox(node);
    if (g.type === 'radial') {
      const e = radialGradientEllipse(box);
      return e ? { coords: [0, 0, 0, 0, 0, 1], radial: true, local: { a: e.rx, b: 0, c: 0, d: e.ry, e: e.cx, f: e.cy } } : null;
    }
    const axis = linearGradientAxis(box, g.angle);
    return axis ? { coords: [axis.x1, axis.y1, axis.x2, axis.y2], radial: false, local: IDENTITY } : null;
  };

  /** Registers a gradient pattern (and optional alpha soft mask). Returns operator args to paint with it. */
  const gradientPaint = (node: VectorNode, fillItem: FillItem, nodeMatrix: Matrix) => {
    const shader = shaderFor(node, fillItem);
    const stops = fillItem.gradient ? normalizedGradientStops(fillItem.gradient) : [];
    if (!shader || stops.length === 0) return null;
    const shading = (alpha: boolean) => ({
      ShadingType: shader.radial ? 3 : 2,
      ColorSpace: alpha ? 'DeviceGray' : 'DeviceRGB',
      Coords: shader.coords,
      Function: stopFunction(stops, alpha),
      Extend: [true, true],
    });
    const patternName = `P${++patternCounter}`;
    patternDict.set(
      PDFName.of(patternName),
      context.register(context.obj({ Type: 'Pattern', PatternType: 2, Shading: shading(false), Matrix: matrixArray(compose(nodeMatrix, shader.local)) }))
    );
    let softMask: unknown = null;
    if (stops.some((s) => s.opacity < 1)) {
      const form = context.stream('/Sh0 sh', {
        Type: 'XObject', Subtype: 'Form', FormType: 1,
        BBox: [-100000, -100000, 100000, 100000],
        Matrix: matrixArray(shader.local),
        Group: { S: 'Transparency', CS: 'DeviceGray' },
        Resources: { Shading: { Sh0: shading(true) } },
      });
      softMask = { Type: 'Mask', S: 'Luminosity', G: context.register(form) };
    }
    return { patternName, softMask };
  };

  const clipPathOps = (mask: VectorNode): PDFOperator[] => {
    const d = generateNodeSvgPath(mask, nodes);
    if (!d) return [];
    const ops = svgPathToPdfOps(d);
    return [...ops, mask.fillRule === 'evenodd' ? clipEvenOdd() : clip(), endPath()];
  };

  const nodeMatrix = (node: VectorNode): Matrix =>
    node.rotation && Math.abs(node.rotation) > 0.001
      ? compose(toPage, rotationAbout(node.rotation, node.x + node.width / 2, node.y + node.height / 2))
      : toPage;

  const push = (...operators: PDFOperator[]) => page.pushOperators(...operators);

  const drawVector = (node: VectorNode, alpha: number, inheritedBlend: string | null) => {
    const d = generateNodeSvgPath(node, nodes);
    if (!d) return;
    const pathOps = svgPathToPdfOps(d);
    const matrix = nodeMatrix(node);
    const nodeBlend = blendName(node.blendMode) ?? inheritedBlend;

    for (const paint of (node.fills || []).filter((f) => f.visible && f.type !== 'none')) {
      if (paint.type === 'pattern') { env.warn(`"${node.name}": pattern fills are not exported to PDF.`); continue; }
      const entries: Record<string, unknown> = { ca: Math.max(0, Math.min(1, alpha * (paint.opacity ?? 1))) };
      const blend = blendName(paint.blendMode) ?? nodeBlend;
      if (blend) entries.BM = blend;
      const operators: PDFOperator[] = [pushGraphicsState(), cm(matrix)];
      if (paint.type === 'gradient' && paint.gradient) {
        const gp = gradientPaint(node, paint, matrix);
        if (gp) {
          if (gp.softMask) entries.SMask = gp.softMask;
          operators.push(setGraphicsState(graphicsState(entries)), op('cs', [PDFName.of('Pattern')]), op('scn', [PDFName.of(gp.patternName)]));
        } else {
          const first = normalizedGradientStops(paint.gradient)[0];
          const [r, g, b] = colorComponents(first?.color ?? '#000000');
          entries.ca = Math.max(0, Math.min(1, (entries.ca as number) * (first?.opacity ?? 1)));
          operators.push(setGraphicsState(graphicsState(entries)), setFillingRgbColor(r, g, b));
        }
      } else {
        const [r, g, b] = colorComponents(resolvePaintColor(doc, paint.color, paint.globalSwatchId, paint.tint));
        operators.push(setGraphicsState(graphicsState(entries)), setFillingRgbColor(r, g, b));
      }
      operators.push(...pathOps, node.fillRule === 'evenodd' ? fillEvenOdd() : fill(), popGraphicsState());
      push(...operators);
    }

    for (const line of (node.strokes || []).filter((s) => s.visible && s.weight > 0)) {
      const entries: Record<string, unknown> = { CA: Math.max(0, Math.min(1, alpha * (line.opacity ?? 1))), ca: Math.max(0, Math.min(1, alpha * (line.opacity ?? 1))) };
      const blend = blendName(line.blendMode) ?? nodeBlend;
      if (blend) entries.BM = blend;
      const [r, g, b] = colorComponents(resolvePaintColor(doc, line.color, line.globalSwatchId, line.tint));
      const variable = Boolean(line.widthProfileId && line.widthProfileId !== 'uniform') || (node.points || []).some((p) => p.widthLeft !== undefined);
      if (variable && node.points?.length >= 2) {
        const outline = generateVariableWidthStrokePolygon(node.points, node.closed, line.weight, line.widthProfileId);
        if (outline) push(pushGraphicsState(), cm(matrix), setGraphicsState(graphicsState(entries)), setFillingRgbColor(r, g, b), ...svgPathToPdfOps(outline), fill(), popGraphicsState());
        continue;
      }
      const operators: PDFOperator[] = [
        pushGraphicsState(), cm(matrix), setGraphicsState(graphicsState(entries)),
        setStrokingRgbColor(r, g, b), setLineWidth(line.weight),
        setLineCap(line.cap === 'round' ? LineCapStyle.Round : line.cap === 'projecting' ? LineCapStyle.Projecting : LineCapStyle.Butt),
        setLineJoin(line.join === 'round' ? LineJoinStyle.Round : line.join === 'bevel' ? LineJoinStyle.Bevel : LineJoinStyle.Miter),
        op('M', [line.miterLimit || 10]),
      ];
      if (line.dashArray?.length) operators.push(setDashPattern(line.dashArray, 0));
      operators.push(...pathOps, stroke(), popGraphicsState());
      push(...operators);
    }
  };

  const drawText = (node: VectorNode, alpha: number) => {
    const layout = layoutText(node);
    const font = node.textStyle?.fontStyle?.toLowerCase().includes('bold') ? env.fonts.bold : env.fonts.regular;
    const primaryFill = (node.fills || []).find((f) => f.visible && f.type !== 'none');
    const textStroke = (node.strokes || []).find((s) => s.visible && s.weight > 0);
    const family = node.textStyle?.fontFamily?.split(',')[0]?.replace(/["']/g, '').trim();
    if (family && !/^(helvetica|arial)$/i.test(family)) env.warn(`Text set in "${family}" is exported with Helvetica; the PDF embeds only standard fonts.`);
    if (textStroke) env.warn(`"${node.name}": text strokes are not exported to PDF.`);
    if (primaryFill?.type === 'gradient') env.warn(`"${node.name}": gradient text is exported with its first stop color.`);
    if (!primaryFill) return;
    const first = primaryFill.type === 'gradient' && primaryFill.gradient ? normalizedGradientStops(primaryFill.gradient)[0] : null;
    const color = first ? first.color : resolvePaintColor(doc, primaryFill.color || '#000000', primaryFill.globalSwatchId, primaryFill.tint);
    const [r, g, b] = colorComponents(color);
    const opacity = Math.max(0, Math.min(1, alpha * (primaryFill.opacity ?? 1) * (first?.opacity ?? 1)));
    if (opacity <= 0) return;

    const supported = new Set(font.getCharacterSet());
    let replaced = false;
    const safe = (line: string) => Array.from(line).map((ch) => (supported.has(ch.codePointAt(0)!) ? ch : (replaced = true, '?'))).join('');

    const centre = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    const pageRotation = node.rotation && Math.abs(node.rotation) > 0.001
      ? compose(toPage, compose(rotationAbout(node.rotation, centre.x, centre.y), inverse(toPage)))
      : null;
    push(pushGraphicsState());
    if (pageRotation) push(cm(pageRotation));
    if (clipsTextToFrame(node)) {
      const x0 = node.x - ab.x + env.originX, y0 = env.originY - (node.y - ab.y) - node.height;
      push(op('re', [x0, y0, Math.max(0, node.width), Math.max(0, node.height)]), clip(), endPath());
    }
    const glyph = textGlyphTransform(node);
    const ax = env.originX + (node.x - ab.x), ay = env.originY - (node.y - ab.y);
    push(concatTransformationMatrix(glyph.sx, 0, 0, glyph.sy,
      ax * (1 - glyph.sx) + (glyph.sx < 0 ? node.width : 0),
      ay * (1 - glyph.sy) - (glyph.sy < 0 ? node.height : 0)));
    layout.lines.forEach((line, lineIdx) => {
      const text = safe(line);
      const textWidth = font.widthOfTextAtSize(text, layout.fontSize);
      const x = layout.x - (layout.align === 'center' ? textWidth / 2 : layout.align === 'right' ? textWidth : 0);
      page.drawText(text, {
        x: env.originX + (x - ab.x), y: env.originY - (layout.y + lineIdx * layout.leading - ab.y),
        size: layout.fontSize, font, color: rgb(r, g, b), opacity,
      });
    });
    push(popGraphicsState());
    if (replaced) env.warn(`"${node.name}": characters outside the PDF standard font were replaced with "?".`);
  };

  const drawNode = (node: VectorNode, alpha: number, blend: string | null, guard: Set<string>) => {
    if (!node || !node.visible || node.isGuide || guard.has(node.id)) return;
    const inner = new Set(guard).add(node.id);
    if (resolveEffects(node)) env.warn(`"${node.name}": shadow, glow and blur effects are not exported to PDF.`);
    const nextAlpha = alpha * Math.max(0, Math.min(1, node.opacity ?? 1));
    const nextBlend = blendName(node.blendMode) ?? blend;

    if (isContainerNode(node)) {
      if ((node.opacity ?? 1) < 1 && (node.children?.length ?? 0) > 1) env.warn(`"${node.name}": group opacity is applied to each object separately, so overlaps may look different in PDF.`);
      if (blendName(node.blendMode)) env.warn(`"${node.name}": group blend mode is applied to each object separately in PDF.`);
      if (node.type === 'blend' && node.children?.length === 2) {
        const endpoints = node.children.map((id) => nodes[id]);
        if (endpoints.every(Boolean)) [endpoints[0], ...blendIntermediateNodes(node, nodes), endpoints[1]].forEach((child) => drawNode(child, nextAlpha, nextBlend, inner));
        return;
      }
      const clipInfo = resolveClipMask(node, nodes);
      if (clipInfo) {
        push(pushGraphicsState(), cm(nodeMatrix(clipInfo.mask)), ...clipPathOps(clipInfo.mask), cm(inverse(nodeMatrix(clipInfo.mask))));
        clipInfo.content.forEach((child) => drawNode(child, nextAlpha, nextBlend, inner));
        push(popGraphicsState());
        return;
      }
      (node.children || []).forEach((id) => drawNode(nodes[id], nextAlpha, nextBlend, inner));
      return;
    }
    if (node.type === 'image') { env.warn(`"${node.name}": images are not exported to PDF yet.`); return; }
    if (node.type === 'text') { drawText(node, nextAlpha); return; }
    drawVector(node, nextAlpha, nextBlend);
  };

  const isRoot = (n: VectorNode | undefined): n is VectorNode => !!n && n.visible && !n.parentId && !n.isGuide;
  let any = false;
  // Layers are listed top-to-bottom; paint bottom-to-top like the viewport.
  for (const layer of [...(doc.layers || [])].reverse()) {
    if (!layer.visible) continue;
    if ((layer.opacity ?? 1) < 1) env.warn(`Layer "${layer.name}": layer opacity is applied to each object separately in PDF.`);
    for (const id of layer.nodeIds || []) {
      const node = nodes[id];
      if (isRoot(node)) { any = true; drawNode(node, Math.max(0, layer.opacity ?? 1), null, new Set()); }
    }
  }
  if (!any) {
    for (const node of Object.values(nodes)) {
      if (isRoot(node) && !(doc.layers || []).some((layer) => layer.nodeIds?.includes(node.id))) drawNode(node, 1, null, new Set());
    }
  }
}

function inverse(m: Matrix): Matrix {
  const det = m.a * m.d - m.b * m.c;
  if (!det) return IDENTITY;
  return {
    a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det,
  };
}
