import { blendIntermediateNodes } from '../math/blend';
import { anchorsToSvgPath, generateNodeSvgPath, generateVariableWidthStrokePolygon } from '../math/bezier';
import { clipsTextToFrame, layoutText, textGlyphTransform } from '../math/textLayout';
import {
  effectFilterMarkup,
  isContainerNode,
  nodeEffectBounds,
  normalizedGradientStops,
  resolveClipMask,
  resolveEffects,
  resolvePaintColor,
} from '../render/appearance';
import type {
  AnchorPoint,
  ArtboardItem,
  FillItem,
  StrokeItem,
  StudioDocument,
  VectorNode,
} from '../types';
import { TextOutlineError, convertTextNodeToOutlineNodes } from './opentypeHelper';

export type SvgStylingMode = 'inline' | 'internal-css' | 'presentation';
export type SvgFontMode = 'svg' | 'outline';
export type SvgObjectIdMode = 'layer-names' | 'minimal' | 'unique';

export interface SvgExportOptions {
  styling: SvgStylingMode;
  fontMode: SvgFontMode;
  decimalPlaces: number; // 1 to 7
  objectIds: SvgObjectIdMode;
  minify: boolean;
  responsive: boolean;
  artboardId?: string;
  onlyNodeIds?: string[];
  includeBackground?: boolean;
  /** Workspace preview: render all artboards and use the supplied scene bounds. */
  workspaceViewBox?: { x: number; y: number; width: number; height: number };
  /** Called for artwork that cannot be represented faithfully, instead of silently degrading it. */
  onWarning?: (message: string) => void;
}

export const DEFAULT_SVG_EXPORT_OPTIONS: SvgExportOptions = {
  styling: 'presentation',
  fontMode: 'svg',
  decimalPlaces: 2,
  objectIds: 'layer-names',
  minify: false,
  responsive: false,
  includeBackground: false,
};

/**
 * Generates precision SVG markup from a StudioDocument (either for a specific artboard,
 * a subset of nodes, or the active artboard).
 */
export function exportDocumentToSvgString(
  doc: StudioDocument,
  partialOptions?: Partial<SvgExportOptions>
): string {
  const opts: SvgExportOptions = {
    ...DEFAULT_SVG_EXPORT_OPTIONS,
    ...partialOptions,
  };
  const dec = Math.max(1, Math.min(7, Math.round(opts.decimalPlaces)));
  const fmt = (n: number): string => {
    if (!Number.isFinite(n)) return '0';
    const factor = Math.pow(10, dec);
    return `${Math.round(n * factor) / factor}`;
  };

  const ab: ArtboardItem =
    doc.artboards.find((a) => a.id === (opts.artboardId || doc.activeArtboardId)) ||
    doc.artboards[0] || {
      id: 'ab-1',
      name: 'Artboard 1',
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      orientation: 'landscape',
      showCenterMark: false,
      showCrossHairs: false,
      showVideoSafeAreas: false,
    };

  const defsList: string[] = [];
  const cssRules: string[] = [];
  let minimalIdCounter = 1;
  let classCounter = 1;
  let textClipCounter = 0;

  const formatObjectId = (rawName: string, fallbackId: string): string => {
    if (opts.objectIds === 'minimal') {
      return `a${(minimalIdCounter++).toString(36)}`;
    }
    if (opts.objectIds === 'unique') {
      return `${rawName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'obj'}_${fallbackId.slice(-5)}`;
    }
    return rawName.replace(/[^a-zA-Z0-9_-]/g, '_') || fallbackId;
  };

  // Determine which nodes to render
  const nodesMap = doc.nodes || {};
  const allowedIds = opts.onlyNodeIds ? new Set(opts.onlyNodeIds) : null;

  const hex = (s: string) => Array.from(s, (c) => c.codePointAt(0)!.toString(16)).join('_');
  const gradientIds = new Set<string>();
  const filterIds = new Set<string>();
  const warn = (message: string) => opts.onWarning?.(message);
  const colorOf = (item: { color: string; globalSwatchId?: string; tint?: number }) =>
    resolvePaintColor(doc, item.color || '#000000', item.globalSwatchId, item.tint);

  /** Serialize presentation properties according to the chosen styling mode. */
  const buildStyle = (props: Array<[string, string]>): string => {
    if (props.length === 0) return '';
    if (opts.styling === 'inline') return ` style="${props.map(([k, v]) => `${k}:${v}`).join(';')}"`;
    if (opts.styling === 'internal-css') {
      const clsName = `cls-${classCounter++}`;
      cssRules.push(`.${clsName} { ${props.map(([k, v]) => `${k}: ${v};`).join(' ')} }`);
      return ` class="${clsName}"`;
    }
    // mix-blend-mode is a CSS property, not an SVG presentation attribute.
    const attrs = props.filter(([k]) => k !== 'mix-blend-mode').map(([k, v]) => `${k}="${v}"`).join(' ');
    const blend = props.find(([k]) => k === 'mix-blend-mode');
    return `${attrs ? ` ${attrs}` : ''}${blend ? ` style="mix-blend-mode:${blend[1]}"` : ''}`;
  };

  const fillPaint = (node: VectorNode, fill: FillItem): string => {
    if (fill.type === 'gradient' && fill.gradient) {
      const gradId = `grad_${hex(node.id)}_${hex(fill.id)}`;
      if (!gradientIds.has(gradId)) {
        gradientIds.add(gradId);
        defsList.push(buildGradientSvgDef(gradId, fill.gradient, fmt));
      }
      return `url(#${gradId})`;
    }
    if (fill.type === 'pattern') warn(`"${node.name}": pattern fills are exported as their base color.`);
    return colorOf(fill);
  };

  const fillProps = (node: VectorNode, fill: FillItem): Array<[string, string]> => {
    const props: Array<[string, string]> = [['fill', fillPaint(node, fill)]];
    if ((fill.opacity ?? 1) < 1) props.push(['fill-opacity', fmt(fill.opacity)]);
    if (node.fillRule === 'evenodd') props.push(['fill-rule', 'evenodd']);
    if (fill.blendMode && fill.blendMode !== 'normal') props.push(['mix-blend-mode', fill.blendMode]);
    return props;
  };

  const strokeProps = (stroke: StrokeItem): Array<[string, string]> => {
    const props: Array<[string, string]> = [['stroke', colorOf(stroke)], ['stroke-width', fmt(stroke.weight)]];
    if (stroke.cap && stroke.cap !== 'butt') props.push(['stroke-linecap', stroke.cap === 'projecting' ? 'square' : stroke.cap]);
    if (stroke.join && stroke.join !== 'miter') props.push(['stroke-linejoin', stroke.join]);
    if (stroke.join === 'miter' && (stroke.miterLimit || 10) !== 4) props.push(['stroke-miterlimit', fmt(stroke.miterLimit || 10)]);
    if (stroke.dashArray && stroke.dashArray.length > 0) props.push(['stroke-dasharray', stroke.dashArray.map(fmt).join(' ')]);
    if ((stroke.opacity ?? 1) < 1) props.push(['stroke-opacity', fmt(stroke.opacity)]);
    if (stroke.blendMode && stroke.blendMode !== 'normal') props.push(['mix-blend-mode', stroke.blendMode]);
    return props;
  };

  /** Properties that apply to the whole object: opacity, blend mode and live-effect filter. */
  const groupProps = (node: VectorNode): Array<[string, string]> => {
    const props: Array<[string, string]> = [];
    if ((node.opacity ?? 1) < 1) props.push(['opacity', fmt(node.opacity)]);
    if (node.blendMode && node.blendMode !== 'normal') props.push(['mix-blend-mode', node.blendMode]);
    const fx = resolveEffects(node);
    const bounds = fx ? nodeEffectBounds(node, nodesMap) : null;
    if (fx && bounds) {
      const filterId = `fx_${hex(node.id)}`;
      if (!filterIds.has(filterId)) {
        filterIds.add(filterId);
        defsList.push(effectFilterMarkup(filterId, fx, bounds, fmt));
      }
      props.push(['filter', `url(#${filterId})`]);
    }
    return props;
  };

  const rotateAttr = (node: VectorNode): string =>
    node.rotation && Math.abs(node.rotation) > 0.001
      ? ` transform="rotate(${fmt(node.rotation)} ${fmt(node.x + node.width / 2)} ${fmt(node.y + node.height / 2)})"`
      : '';

  /** Path data: plain anchor lists keep the user's decimal setting; anything live goes through the shared generator. */
  const pathDataFor = (node: VectorNode): string => {
    const closed = node.closed !== false && node.type !== 'line';
    const isCompound = (node.type === 'compound-path' || node.type === 'compound-shape') && !!node.children?.length;
    const plain =
      node.points?.length >= 2 &&
      !node.envelopeSpec &&
      !isCompound &&
      !(node.effects || []).some((fx) => fx.enabled) &&
      !node.points.some((p) => (p.cornerRadius ?? node.cornerRadius ?? 0) > 0);
    return plain ? anchorPointsToSvgPathD(node.points, closed, fmt) : generateNodeSvgPath(node, nodesMap);
  };

  const renderNodeElement = (node: VectorNode, indent: string): string => {
    if (!node || !node.visible || node.isGuide) return '';
    if (allowedIds && !allowedIds.has(node.id) && !allowedIds.has(node.parentId || '') && (!node.children || !node.children.some((c) => allowedIds.has(c)))) {
      return '';
    }

    // Group, clipping group and blend: containers have no geometry of their own.
    if (isContainerNode(node) && node.children && node.children.length > 0) {
      const gid = formatObjectId(node.name || 'Group', node.id);
      const attrs = buildStyle(groupProps(node));
      if (node.type === 'blend' && node.children.length === 2) {
        const endpoints = node.children.map((id) => nodesMap[id]);
        if (endpoints.every(Boolean)) {
          const parts = [endpoints[0], ...blendIntermediateNodes(node, nodesMap), endpoints[1]];
          return `${indent}<g${attrs}>\n${parts.map((child) => renderNodeElement(child, `${indent}  `)).join('\n')}\n${indent}</g>`;
        }
      }
      const clip = resolveClipMask(node, nodesMap);
      const kids = (clip ? clip.content : node.children.map((cid) => nodesMap[cid]).filter(Boolean));
      const render = (pad: string) => kids.map((child) => renderNodeElement(child, pad)).filter(Boolean).join('\n');
      if (clip) {
        const clipId = `clip_${hex(node.id)}`;
        defsList.push(`<clipPath id="${clipId}"><path d="${pathDataFor(clip.mask)}"${rotateAttr(clip.mask)}${clip.mask.fillRule === 'evenodd' ? ' clip-rule="evenodd"' : ''}/></clipPath>`);
        return `${indent}<g id="${gid}"${attrs}>\n${indent}  <g clip-path="url(#${clipId})">\n${render(`${indent}    `)}\n${indent}  </g>\n${indent}</g>`;
      }
      if (node.type === 'clipping-group') warn(`"${node.name}": clipping group has no usable mask shape, children are exported unclipped.`);
      return `${indent}<g id="${gid}"${attrs}>\n${render(`${indent}  `)}\n${indent}</g>`;
    }

    // If fontMode === 'outline' and node is text, convert to outline group on the fly.
    // When no matching font file is available the live <text> is kept (and reported), never a look-alike.
    if (node.type === 'text' && opts.fontMode === 'outline') {
      try {
        const outlined = convertTextNodeToOutlineNodes(node);
        const childStrings = outlined.childNodes
          .map((chNode) => renderNodeElement(chNode, `${indent}  `))
          .filter(Boolean);
        const gid = formatObjectId(node.name || 'Text_Outlines', node.id);
        const attrs = buildStyle(groupProps(outlined.groupNode));
        return `${indent}<g id="${gid}"${attrs}>\n${childStrings.join('\n')}\n${indent}</g>`;
      } catch (error) {
        if (!(error instanceof TextOutlineError)) throw error;
        warn(`"${node.name}": exported as live text because it could not be outlined. ${error.message}`);
      }
    }

    const elemId = formatObjectId(node.name || node.type, node.id);
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const transformAttr = rotateAttr(node);
    const wholeObject = groupProps(node);

    const visibleFills = (node.fills || []).filter((f) => f.visible && f.type !== 'none');
    const visibleStrokes = (node.strokes || []).filter((s) => s.visible && s.weight > 0);

    if (node.type === 'image' && node.imageUrl) {
      return `${indent}<image id="${elemId}" x="${fmt(node.x)}" y="${fmt(node.y)}" width="${fmt(node.width)}" height="${fmt(node.height)}" href="${escapeXml(node.imageUrl)}" preserveAspectRatio="none"${transformAttr}${buildStyle(wholeObject)}/>`;
    }

    if (node.type === 'text') {
      const layout = layoutText(node);
      const glyph = textGlyphTransform(node);
      const clipId = clipsTextToFrame(node) ? `text_clip_${++textClipCounter}` : null;
      if (clipId) defsList.push(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${fmt(node.x)}" y="${fmt(node.y)}" width="${fmt(Math.max(0, node.width))}" height="${fmt(Math.max(0, node.height))}"/></clipPath>`);
      const ff = node.textStyle?.fontFamily ?? 'Inter, sans-serif';
      const fw = node.textStyle?.fontStyle?.toLowerCase().includes('bold') ? 'bold' : 'normal';
      const italic = node.textStyle?.fontStyle?.toLowerCase().includes('italic') ? ' font-style="italic"' : '';
      const anchor = layout.align === 'center' ? 'middle' : layout.align === 'right' ? 'end' : 'start';
      const decoration = [node.textStyle?.underline && 'underline', node.textStyle?.strikethrough && 'line-through'].filter(Boolean).join(' ');
      const spans = layout.lines.map((line, i) => `<tspan x="${fmt(layout.x)}" y="${fmt(layout.y + i * layout.leading)}">${escapeXml(line)}</tspan>`).join('');
      const textFill = visibleFills[0];
      const textStroke = visibleStrokes[0];
      const textProps: Array<[string, string]> = textFill ? fillProps(node, textFill).filter(([k]) => k !== 'mix-blend-mode') : [['fill', 'none']];
      if (textStroke) textProps.push(...strokeProps(textStroke).filter(([k]) => k !== 'mix-blend-mode'));
      const textEl = `<text id="${elemId}" transform="matrix(${fmt(glyph.sx)} 0 0 ${fmt(glyph.sy)} ${fmt(glyph.tx)} ${fmt(glyph.ty)})" font-family="${escapeXml(ff)}" font-size="${fmt(layout.fontSize)}" font-weight="${fw}"${italic} text-anchor="${anchor}" letter-spacing="${fmt(layout.letterSpacing)}"${decoration ? ` text-decoration="${decoration}"` : ''}${node.textStyle?.vertical ? ' writing-mode="vertical-rl"' : ''} xml:space="preserve"${buildStyle(textProps)}>${spans}</text>`;
      const inner = clipId ? `<g clip-path="url(#${clipId})">${textEl}</g>` : textEl;
      return `${indent}<g${transformAttr}${buildStyle(wholeObject)}>${inner}</g>`;
    }

    const hasPerPaintBlend = [...visibleFills, ...visibleStrokes].some((p) => p.blendMode && p.blendMode !== 'normal');
    const isVariableWidth = (stroke: StrokeItem) =>
      Boolean(stroke.widthProfileId && stroke.widthProfileId !== 'uniform') || (node.points || []).some((p) => p.widthLeft !== undefined);
    const hasVariableStroke = node.points?.length >= 2 && visibleStrokes.some(isVariableWidth);
    const hasGeometryFx = (node.effects || []).some((fx) => fx.enabled);

    if (visibleFills.length > 1 || visibleStrokes.length > 1 || hasPerPaintBlend || hasVariableStroke) {
      const d = pathDataFor(node);
      const parts: string[] = [];
      for (const fill of visibleFills) parts.push(`${indent}  <path d="${d}"${buildStyle(fillProps(node, fill))}/>`);
      for (const stroke of visibleStrokes) {
        if (isVariableWidth(stroke) && node.points?.length >= 2) {
          const vw = generateVariableWidthStrokePolygon(node.points, node.closed, stroke.weight, stroke.widthProfileId);
          const props: Array<[string, string]> = [['fill', colorOf(stroke)]];
          if ((stroke.opacity ?? 1) < 1) props.push(['fill-opacity', fmt(stroke.opacity)]);
          if (stroke.blendMode && stroke.blendMode !== 'normal') props.push(['mix-blend-mode', stroke.blendMode]);
          if (vw) parts.push(`${indent}  <path d="${vw}"${buildStyle(props)}/>`);
        } else {
          parts.push(`${indent}  <path d="${d}"${buildStyle([['fill', 'none'], ...strokeProps(stroke)])}/>`);
        }
      }
      return `${indent}<g id="${elemId}"${transformAttr}${buildStyle(wholeObject)}>\n${parts.join('\n')}\n${indent}</g>`;
    }

    // One fill and at most one stroke: a single element with the object's own opacity/filter.
    const primaryFill: FillItem | undefined = visibleFills[0];
    const primaryStroke: StrokeItem | undefined = visibleStrokes[0];
    const styleProps: Array<[string, string]> = primaryFill ? fillProps(node, primaryFill) : [['fill', 'none']];
    if (primaryStroke) styleProps.push(...strokeProps(primaryStroke));
    styleProps.push(...wholeObject);
    const styleAttributeStr = buildStyle(styleProps);

    if (node.type === 'rectangle' && (!node.points || node.points.length === 0) && !hasGeometryFx) {
      const rxAttr =
        node.cornerRadius && node.cornerRadius > 0 ? ` rx="${fmt(node.cornerRadius)}"` : '';
      return `${indent}<rect id="${elemId}" x="${fmt(node.x)}" y="${fmt(node.y)}" width="${fmt(node.width)}" height="${fmt(node.height)}"${rxAttr}${transformAttr}${styleAttributeStr}/>`;
    }

    if (node.type === 'ellipse' && (!node.points || node.points.length === 0) && !hasGeometryFx) {
      const rx = node.width / 2;
      const ry = node.height / 2;
      return `${indent}<ellipse id="${elemId}" cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}"${transformAttr}${styleAttributeStr}/>`;
    }

    return `${indent}<path id="${elemId}" d="${pathDataFor(node)}"${transformAttr}${styleAttributeStr}/>`;
  };

  const layerBlocks: string[] = [];
  // The layer list is top-to-bottom; SVG elements are painted bottom-to-top.
  for (const layer of [...(doc.layers || [])].reverse()) {
    if (!layer.visible) continue;
    const layerChildren: string[] = [];
    for (const nid of layer.nodeIds || []) {
      const n = nodesMap[nid];
      if (!n || n.parentId) continue;
      const rendered = renderNodeElement(n, '    ');
      if (rendered) layerChildren.push(rendered);
    }
    if (layerChildren.length > 0) {
      const lid = formatObjectId(layer.name || 'Layer', layer.id);
      const layerOpacity = (layer.opacity ?? 1) < 1 ? ` opacity="${fmt(Math.max(0, layer.opacity))}"` : '';
      layerBlocks.push(`  <g id="${lid}"${layerOpacity}>\n${layerChildren.join('\n')}\n  </g>`);
    }
  }

  // Also include any root nodes not referenced in layer.nodeIds
  if (layerBlocks.length === 0) {
    const loose = Object.values(nodesMap)
      .filter((n) => !n.parentId && n.visible && !(doc.layers || []).some(layer => layer.nodeIds?.includes(n.id)))
      .map((n) => renderNodeElement(n, '  '))
      .filter(Boolean);
    if (loose.length > 0) {
      layerBlocks.push(loose.join('\n'));
    }
  }

  if (cssRules.length > 0) {
    defsList.unshift(`<style type="text/css">\n      ${cssRules.join('\n      ')}\n    </style>`);
  }

  const defsSection =
    defsList.length > 0 ? `  <defs>\n    ${defsList.join('\n    ')}\n  </defs>\n` : '';
  const view = opts.workspaceViewBox || ab;
  const bgRect = opts.workspaceViewBox
    ? (doc.artboards || []).map(board => `  <rect x="${fmt(board.x)}" y="${fmt(board.y)}" width="${fmt(board.width)}" height="${fmt(board.height)}" fill="${escapeXml(board.backgroundColor || '#ffffff')}"/>`).join('\n')
    : opts.includeBackground || ab.backgroundColor
      ? `  <rect x="${fmt(ab.x)}" y="${fmt(ab.y)}" width="${fmt(ab.width)}" height="${fmt(ab.height)}" fill="${escapeXml(ab.backgroundColor || '#ffffff')}"/>\n`
      : '';
  const whAttrs = opts.responsive
    ? ''
    : ` width="${fmt(view.width)}" height="${fmt(view.height)}"`;

  const rawSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(view.x)} ${fmt(view.y)} ${fmt(view.width)} ${fmt(view.height)}"${whAttrs}>
${defsSection}${bgRect}${layerBlocks.join('\n')}
</svg>`;

  if (opts.minify) {
    return rawSvg
      .replace(/\r?\n\s*/g, '')
      .replace(/>\s+</g, '><')
      .trim();
  }
  return rawSvg;
}

export function anchorPointsToSvgPathD(
  points: AnchorPoint[],
  closed: boolean,
  fmt: (n: number) => string = (n) => `${Math.round(n * 100) / 100}`
): string {
  if (!points || points.length === 0) return '';
  if (points.slice(1).some(point => point.moveTo)) {
    const contours: AnchorPoint[][] = [];
    for (const point of points) {
      if (!contours.length || point.moveTo) contours.push([]);
      contours[contours.length - 1].push(point);
    }
    return contours.map(contour => anchorPointsToSvgPathD(contour.map(point => ({ ...point, moveTo: false })), closed, fmt)).join(' ');
  }
  const parts: string[] = [`M ${fmt(points[0].x)} ${fmt(points[0].y)}`];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev.handleOut || curr.handleIn) {
      const c1 = prev.handleOut ?? { x: prev.x, y: prev.y };
      const c2 = curr.handleIn ?? { x: curr.x, y: curr.y };
      parts.push(
        `C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(curr.x)} ${fmt(curr.y)}`
      );
    } else {
      parts.push(`L ${fmt(curr.x)} ${fmt(curr.y)}`);
    }
  }

  if (closed && points.length > 1) {
    const prev = points[points.length - 1];
    const first = points[0];
    if (prev.handleOut || first.handleIn) {
      const c1 = prev.handleOut ?? { x: prev.x, y: prev.y };
      const c2 = first.handleIn ?? { x: first.x, y: first.y };
      parts.push(
        `C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(first.x)} ${fmt(first.y)}`
      );
    }
    parts.push('Z');
  }

  return parts.join(' ');
}

function buildGradientSvgDef(
  id: string,
  grad: NonNullable<FillItem['gradient']>,
  fmt: (n: number) => string
): string {
  const stopsMarkup = normalizedGradientStops(grad)
    .map(
      (s) =>
        `<stop offset="${fmt(s.offset * 100)}%" stop-color="${s.color}" stop-opacity="${fmt(s.opacity ?? 1)}"/>`
    )
    .join('');
  if (grad.type === 'radial') {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stopsMarkup}</radialGradient>`;
  }
  const rad = ((grad.angle || 0) * Math.PI) / 180;
  const x1 = 50 - Math.cos(rad) * 50;
  const y1 = 50 - Math.sin(rad) * 50;
  const x2 = 50 + Math.cos(rad) * 50;
  const y2 = 50 + Math.sin(rad) * 50;
  return `<linearGradient id="${id}" x1="${fmt(x1)}%" y1="${fmt(y1)}%" x2="${fmt(x2)}%" y2="${fmt(y2)}%">${stopsMarkup}</linearGradient>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function triggerSvgDownload(svgContent: string, fileName = 'artwork.svg'): void {
  if (typeof document === 'undefined') return;
  const cleanName = fileName.toLowerCase().endsWith('.svg') ? fileName : `${fileName}.svg`;
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * SVG IMPORTER / PARSER
 * Parses external .svg markup (<path>, <rect>, <circle>, <ellipse>, <polygon>, <polyline>,
 * <line>, <text>, <g>) into editable VectorNode objects with AnchorPoint[] curves and Fills/Strokes.
 */
export interface ParsedSvgImportResult {
  nodes: VectorNode[];
  viewBox: { x: number; y: number; width: number; height: number };
}

export function parseSvgStringToVectorNodes(
  svgText: string,
  targetLayerId = 'layer-1'
): ParsedSvgImportResult {
  const nodes: VectorNode[] = [];
  let viewBox = { x: 0, y: 0, width: 800, height: 600 };

  const vbMatch = svgText.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
  if (vbMatch) {
    viewBox = {
      x: parseFloat(vbMatch[1]) || 0,
      y: parseFloat(vbMatch[2]) || 0,
      width: parseFloat(vbMatch[3]) || 800,
      height: parseFloat(vbMatch[4]) || 600,
    };
  } else {
    const wMatch = svgText.match(/\bwidth=["']([0-9.]+)/i);
    const hMatch = svgText.match(/\bheight=["']([0-9.]+)/i);
    if (wMatch && hMatch) {
      viewBox.width = parseFloat(wMatch[1]) || 800;
      viewBox.height = parseFloat(hMatch[1]) || 600;
    }
  }

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const svgRoot = xmlDoc.querySelector('svg');
      if (svgRoot) {
        const walkChildren = (parentEl: Element, parentGroupId?: string): string[] => {
          const createdIds: string[] = [];
          for (const el of Array.from(parentEl.children)) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc' || tag === 'metadata') {
              continue;
            }
            if (tag === 'g') {
              const gid = `svg-group-${nodes.length + 1}-${Math.random().toString(36).slice(2, 6)}`;
              const childIds = walkChildren(el, gid);
              if (childIds.length > 0) {
                const childObjs = nodes.filter((n) => childIds.includes(n.id));
                const bounds = computeMultiNodeBounds(childObjs);
                const groupNode: VectorNode = {
                  id: gid,
                  name: el.getAttribute('id') || '<Group>',
                  type: 'group',
                  layerId: targetLayerId,
                  parentId: parentGroupId,
                  visible: true,
                  locked: false,
                  x: bounds.x,
                  y: bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                  rotation: 0,
                  points: childObjs[0]?.points || [],
                  closed: true,
                  fills: [],
                  strokes: [],
                  effects: [],
                  opacity: Number(el.getAttribute('opacity') ?? '1'),
                  blendMode: 'normal',
                  children: childIds,
                };
                nodes.push(groupNode);
                createdIds.push(gid);
              }
              continue;
            }

            const converted = elementToVectorNode(el, targetLayerId, parentGroupId, nodes.length + 1);
            if (converted) {
              nodes.push(converted);
              createdIds.push(converted.id);
            }
          }
          return createdIds;
        };

        walkChildren(svgRoot, undefined);
      }
    } catch (error) {
      throw new Error(`SVG import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (nodes.length === 0) {
    // Regex-based fallback for environments without DOMParser
    const pathRegex = /<path\b([^>]*?)\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = pathRegex.exec(svgText)) !== null) {
      const attrs = match[1];
      const dMatch = attrs.match(/\bd=["']([^"']+)["']/i);
      if (dMatch) {
        const pts = parseSvgPathDToAnchorPoints(dMatch[1]);
        if (pts.points.length > 0) {
          const bbox = computeAnchorBounds(pts.points);
          const fillMatch = attrs.match(/\bfill=["']([^"']+)["']/i);
          const strokeMatch = attrs.match(/\bstroke=["']([^"']+)["']/i);
          const swMatch = attrs.match(/\bstroke-width=["']([^"']+)["']/i);
          nodes.push(
            createImportedVectorNode({
              name: '<Path>',
              type: 'path',
              layerId: targetLayerId,
              points: pts.points,
              closed: pts.closed,
              bbox,
              fillColor: fillMatch ? fillMatch[1] : '#1473e6',
              strokeColor: strokeMatch ? strokeMatch[1] : 'none',
              strokeWidth: swMatch ? parseFloat(swMatch[1]) || 1 : 1,
            })
          );
        }
      }
    }
  }

  return { nodes, viewBox };
}

function elementToVectorNode(
  el: Element,
  layerId: string,
  parentId: string | undefined,
  index: number
): VectorNode | null {
  const tag = el.tagName.toLowerCase();
  const rawId = el.getAttribute('id');
  const styleAttr = el.getAttribute('style') || '';
  const getStyleOrAttr = (prop: string, fallback = ''): string => {
    const direct = el.getAttribute(prop);
    if (direct !== null && direct !== '') return direct;
    const regex = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
    const m = styleAttr.match(regex);
    return m ? m[1].trim() : fallback;
  };

  const fillColor = getStyleOrAttr('fill', tag === 'line' || tag === 'polyline' ? 'none' : '#000000');
  const strokeColor = getStyleOrAttr('stroke', 'none');
  const strokeWidth = parseFloat(getStyleOrAttr('stroke-width', '1')) || 1;
  const opacity = Number(getStyleOrAttr('opacity', '1'));

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') || '0') || 0;
    const y = parseFloat(el.getAttribute('y') || '0') || 0;
    const w = Math.max(1, parseFloat(el.getAttribute('width') || '100') || 100);
    const h = Math.max(1, parseFloat(el.getAttribute('height') || '100') || 100);
    const rx = parseFloat(el.getAttribute('rx') || '0') || 0;
    const points: AnchorPoint[] = [
      { id: `pt-${index}-1`, x, y, pointType: 'corner' },
      { id: `pt-${index}-2`, x: x + w, y, pointType: 'corner' },
      { id: `pt-${index}-3`, x: x + w, y: y + h, pointType: 'corner' },
      { id: `pt-${index}-4`, x, y: y + h, pointType: 'corner' },
    ];
    return createImportedVectorNode({
      name: rawId || '<Rectangle>',
      type: 'rectangle',
      layerId,
      parentId,
      points,
      closed: true,
      bbox: { x, y, width: w, height: h },
      cornerRadius: rx,
      fillColor,
      strokeColor,
      strokeWidth,
      opacity,
    });
  }

  if (tag === 'circle' || tag === 'ellipse') {
    const cx = Number(el.getAttribute('cx') ?? '0');
    const cy = Number(el.getAttribute('cy') ?? '0');
    const rx =
      tag === 'circle'
        ? parseFloat(el.getAttribute('r') || '50') || 50
        : parseFloat(el.getAttribute('rx') || '50') || 50;
    const ry =
      tag === 'circle'
        ? rx
        : parseFloat(el.getAttribute('ry') || '50') || 50;
    const k = 0.5522847498;
    const ox = rx * k;
    const oy = ry * k;
    const points: AnchorPoint[] = [
      {
        id: `pt-${index}-1`,
        x: cx,
        y: cy - ry,
        pointType: 'smooth',
        handleIn: { x: cx - ox, y: cy - ry },
        handleOut: { x: cx + ox, y: cy - ry },
      },
      {
        id: `pt-${index}-2`,
        x: cx + rx,
        y: cy,
        pointType: 'smooth',
        handleIn: { x: cx + rx, y: cy - oy },
        handleOut: { x: cx + rx, y: cy + oy },
      },
      {
        id: `pt-${index}-3`,
        x: cx,
        y: cy + ry,
        pointType: 'smooth',
        handleIn: { x: cx + ox, y: cy + ry },
        handleOut: { x: cx - ox, y: cy + ry },
      },
      {
        id: `pt-${index}-4`,
        x: cx - rx,
        y: cy,
        pointType: 'smooth',
        handleIn: { x: cx - rx, y: cy + oy },
        handleOut: { x: cx - rx, y: cy - oy },
      },
    ];
    return createImportedVectorNode({
      name: rawId || '<Ellipse>',
      type: 'ellipse',
      layerId,
      parentId,
      points,
      closed: true,
      bbox: { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 },
      fillColor,
      strokeColor,
      strokeWidth,
      opacity,
    });
  }

  if (tag === 'line') {
    const x1 = parseFloat(el.getAttribute('x1') || '0') || 0;
    const y1 = parseFloat(el.getAttribute('y1') || '0') || 0;
    const x2 = parseFloat(el.getAttribute('x2') || '100') || 100;
    const y2 = parseFloat(el.getAttribute('y2') || '100') || 100;
    const points: AnchorPoint[] = [
      { id: `pt-${index}-1`, x: x1, y: y1, pointType: 'corner' },
      { id: `pt-${index}-2`, x: x2, y: y2, pointType: 'corner' },
    ];
    return createImportedVectorNode({
      name: rawId || '<Line>',
      type: 'line',
      layerId,
      parentId,
      points,
      closed: false,
      bbox: computeAnchorBounds(points),
      fillColor: 'none',
      strokeColor: strokeColor !== 'none' ? strokeColor : '#000000',
      strokeWidth,
      opacity,
    });
  }

  if (tag === 'polygon' || tag === 'polyline') {
    const rawPts = (el.getAttribute('points') || '').trim();
    const nums = rawPts
      .split(/[\s,]+/)
      .map((s) => parseFloat(s))
      .filter((n) => Number.isFinite(n));
    const points: AnchorPoint[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      points.push({
        id: `pt-${index}-${i / 2}`,
        x: nums[i],
        y: nums[i + 1],
        pointType: 'corner',
      });
    }
    if (points.length < 2) return null;
    return createImportedVectorNode({
      name: rawId || (tag === 'polygon' ? '<Polygon>' : '<Path>'),
      type: tag === 'polygon' ? 'polygon' : 'path',
      layerId,
      parentId,
      points,
      closed: tag === 'polygon',
      bbox: computeAnchorBounds(points),
      fillColor,
      strokeColor,
      strokeWidth,
      opacity,
    });
  }

  if (tag === 'text') {
    const x = parseFloat(el.getAttribute('x') || '0') || 0;
    const y = parseFloat(el.getAttribute('y') || '24') || 24;
    const fs = parseFloat(getStyleOrAttr('font-size', '24')) || 24;
    const ff = getStyleOrAttr('font-family', 'Inter');
    const txt = (el.textContent || 'Text').trim();
    const node = createImportedVectorNode({
      name: rawId || `<Type> "${txt.slice(0, 14)}"`,
      type: 'text',
      layerId,
      parentId,
      points: [],
      closed: false,
      bbox: { x, y: y - fs * 0.85, width: Math.max(40, txt.length * fs * 0.58), height: fs * 1.2 },
      fillColor,
      strokeColor,
      strokeWidth,
      opacity,
    });
    node.textContent = txt;
    node.textStyle = {
      fontFamily: ff.replace(/['"]/g, ''),
      fontStyle: 'Regular',
      fontSize: fs,
      leading: Math.round(fs * 1.2),
      kerning: 0,
      tracking: 0,
      horizontalScale: 100,
      verticalScale: 100,
      baselineShift: 0,
      characterRotation: 0,
      textCase: 'normal',
      underline: false,
      strikethrough: false,
      align: 'left',
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 0,
      spaceBefore: 0,
      spaceAfter: 0,
      hyphenation: false,
      typeMode: 'point',
      vertical: false,
    };
    return node;
  }

  if (tag === 'path') {
    const d = el.getAttribute('d') || '';
    const parsed = parseSvgPathDToAnchorPoints(d);
    if (parsed.points.length === 0) return null;
    const node = createImportedVectorNode({
      name: rawId || '<Path>',
      type: 'path',
      layerId,
      parentId,
      points: parsed.points,
      closed: parsed.closed,
      bbox: computeAnchorBounds(parsed.points),
      fillColor,
      strokeColor,
      strokeWidth,
      opacity,
    });
    if (getStyleOrAttr('fill-rule') === 'evenodd') node.fillRule = 'evenodd';
    return node;
  }

  return null;
}

/**
 * Full SVG Path `d` attribute tokenizer and Bezier converter supporting absolute and relative
 * M/m, L/l, H/h, V/v, C/c, S/s, Q/q, T/t, A/a, Z/z commands.
 */
export function parseSvgPathDToAnchorPoints(d: string): {
  points: AnchorPoint[];
  closed: boolean;
} {
  const points: AnchorPoint[] = [];
  let closed = false;
  if (!d || !d.trim()) return { points, closed };

  if (d.length > 5_000_000) throw new Error('SVG path is too large');
  const tokenPattern = /[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;
  const tokens: string[] = []; let previousEnd = 0;
  for (const match of d.matchAll(tokenPattern)) {
    if (!/^[\s,]*$/.test(d.slice(previousEnd, match.index))) throw new Error('Invalid SVG path syntax');
    tokens.push(match[0]); previousEnd = match.index! + match[0].length;
    if (tokens.length > 1_000_000) throw new Error('SVG path has too many tokens');
  }
  if (!/^[\s,]*$/.test(d.slice(previousEnd)) || !tokens.length) throw new Error('Invalid SVG path syntax');
  if (tokens[0] !== 'M' && tokens[0] !== 'm') throw new Error('SVG path must start with move');

  let i = 0;
  let cmd = 'M';
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastControlX = 0;
  let lastControlY = 0;

  const isCmdToken = (t: string | undefined): boolean => Boolean(t && /^[a-df-zA-DF-Z]$/.test(t));
  const nextNum = (): number => {
    const token = tokens[i];
    if (token === undefined || isCmdToken(token)) throw new Error('SVG path has missing coordinates');
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error('SVG path coordinate must be finite');
    i++; return value;
  };

  while (i < tokens.length) {
    if (isCmdToken(tokens[i])) {
      cmd = tokens[i++];
    }

    switch (cmd) {
      case 'M':
      case 'm': {
        const rx = nextNum();
        const ry = nextNum();
        cx = cmd === 'm' ? cx + rx : rx;
        cy = cmd === 'm' ? cy + ry : ry;
        startX = cx;
        startY = cy;
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          moveTo: points.length > 0,
          x: cx,
          y: cy,
          pointType: 'corner',
        });
        cmd = cmd === 'm' ? 'l' : 'L';
        lastControlX = cx;
        lastControlY = cy;
        break;
      }
      case 'L':
      case 'l': {
        const rx = nextNum();
        const ry = nextNum();
        cx = cmd === 'l' ? cx + rx : rx;
        cy = cmd === 'l' ? cy + ry : ry;
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x: cx,
          y: cy,
          pointType: 'corner',
        });
        lastControlX = cx;
        lastControlY = cy;
        break;
      }
      case 'H':
      case 'h': {
        const rx = nextNum();
        cx = cmd === 'h' ? cx + rx : rx;
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x: cx,
          y: cy,
          pointType: 'corner',
        });
        lastControlX = cx;
        lastControlY = cy;
        break;
      }
      case 'V':
      case 'v': {
        const ry = nextNum();
        cy = cmd === 'v' ? cy + ry : ry;
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x: cx,
          y: cy,
          pointType: 'corner',
        });
        lastControlX = cx;
        lastControlY = cy;
        break;
      }
      case 'C':
      case 'c': {
        const x1 = (cmd === 'c' ? cx : 0) + nextNum();
        const y1 = (cmd === 'c' ? cy : 0) + nextNum();
        const x2 = (cmd === 'c' ? cx : 0) + nextNum();
        const y2 = (cmd === 'c' ? cy : 0) + nextNum();
        const x = (cmd === 'c' ? cx : 0) + nextNum();
        const y = (cmd === 'c' ? cy : 0) + nextNum();

        const prev = points[points.length - 1];
        if (prev) {
          prev.handleOut = { x: x1, y: y1 };
        }
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x,
          y,
          pointType: 'smooth',
          handleIn: { x: x2, y: y2 },
        });
        cx = x;
        cy = y;
        lastControlX = x2;
        lastControlY = y2;
        break;
      }
      case 'S':
      case 's': {
        const x1 = 2 * cx - lastControlX;
        const y1 = 2 * cy - lastControlY;
        const x2 = (cmd === 's' ? cx : 0) + nextNum();
        const y2 = (cmd === 's' ? cy : 0) + nextNum();
        const x = (cmd === 's' ? cx : 0) + nextNum();
        const y = (cmd === 's' ? cy : 0) + nextNum();

        const prev = points[points.length - 1];
        if (prev) {
          prev.handleOut = { x: x1, y: y1 };
        }
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x,
          y,
          pointType: 'smooth',
          handleIn: { x: x2, y: y2 },
        });
        cx = x;
        cy = y;
        lastControlX = x2;
        lastControlY = y2;
        break;
      }
      case 'Q':
      case 'q': {
        const qx = (cmd === 'q' ? cx : 0) + nextNum();
        const qy = (cmd === 'q' ? cy : 0) + nextNum();
        const x = (cmd === 'q' ? cx : 0) + nextNum();
        const y = (cmd === 'q' ? cy : 0) + nextNum();

        const c1x = cx + (2 / 3) * (qx - cx);
        const c1y = cy + (2 / 3) * (qy - cy);
        const c2x = x + (2 / 3) * (qx - x);
        const c2y = y + (2 / 3) * (qy - y);

        const prev = points[points.length - 1];
        if (prev) {
          prev.handleOut = { x: c1x, y: c1y };
        }
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x,
          y,
          pointType: 'smooth',
          handleIn: { x: c2x, y: c2y },
        });
        cx = x;
        cy = y;
        lastControlX = qx;
        lastControlY = qy;
        break;
      }
      case 'T':
      case 't': {
        const qx = 2 * cx - lastControlX;
        const qy = 2 * cy - lastControlY;
        const x = (cmd === 't' ? cx : 0) + nextNum();
        const y = (cmd === 't' ? cy : 0) + nextNum();

        const c1x = cx + (2 / 3) * (qx - cx);
        const c1y = cy + (2 / 3) * (qy - cy);
        const c2x = x + (2 / 3) * (qx - x);
        const c2y = y + (2 / 3) * (qy - y);

        const prev = points[points.length - 1];
        if (prev) {
          prev.handleOut = { x: c1x, y: c1y };
        }
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x,
          y,
          pointType: 'smooth',
          handleIn: { x: c2x, y: c2y },
        });
        cx = x;
        cy = y;
        lastControlX = qx;
        lastControlY = qy;
        break;
      }
      case 'A':
      case 'a': {
        // Consume 7 arc args: rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y
        const rx = nextNum();
        const ry = nextNum();
        nextNum();
        nextNum();
        nextNum();
        const x = (cmd === 'a' ? cx : 0) + nextNum();
        const y = (cmd === 'a' ? cy : 0) + nextNum();
        const prev = points[points.length - 1];
        if (prev) {
          prev.handleOut = { x: cx + (x - cx) * 0.35, y: cy - Math.min(rx, ry) * 0.25 };
        }
        points.push({
          id: `pt-${points.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
          x,
          y,
          pointType: 'smooth',
          handleIn: { x: x - (x - cx) * 0.35, y: y - Math.min(rx, ry) * 0.25 },
        });
        cx = x;
        cy = y;
        lastControlX = x;
        lastControlY = y;
        break;
      }
      case 'Z':
      case 'z': {
        closed = true;
        cx = startX;
        cy = startY;
        cmd = '';
        break;
      }
      default: {
        throw new Error('Invalid or unsupported SVG path command');
      }
    }
  }

  // Deduplicate closing point if identical to first point
  if (closed && points.length > 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 0.01) {
      if (last.handleIn && !first.handleIn) {
        first.handleIn = last.handleIn;
      }
      points.pop();
    }
  }

  return { points, closed };
}

function computeAnchorBounds(points: AnchorPoint[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!points.length) return { x: 0, y: 0, width: 100, height: 100 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function computeMultiNodeBounds(nodes: VectorNode[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (!nodes.length) return { x: 0, y: 0, width: 100, height: 100 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function createImportedVectorNode(params: {
  name: string;
  type: VectorNode['type'];
  layerId: string;
  parentId?: string;
  points: AnchorPoint[];
  closed: boolean;
  bbox: { x: number; y: number; width: number; height: number };
  cornerRadius?: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity?: number;
}): VectorNode {
  const fills: FillItem[] =
    params.fillColor && params.fillColor !== 'none'
      ? [
          {
            id: `fill-${Math.random().toString(36).slice(2, 7)}`,
            visible: true,
            type: 'solid',
            color: params.fillColor,
            opacity: 1,
            blendMode: 'normal',
          },
        ]
      : [];
  const strokes: StrokeItem[] =
    params.strokeColor && params.strokeColor !== 'none' && params.strokeWidth > 0
      ? [
          {
            id: `stroke-${Math.random().toString(36).slice(2, 7)}`,
            visible: true,
            color: params.strokeColor,
            weight: params.strokeWidth,
            cap: 'butt',
            join: 'miter',
            miterLimit: 4,
            align: 'center',
            dashArray: [],
            opacity: 1,
            blendMode: 'normal',
          },
        ]
      : [];

  return {
    id: `svg-node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: params.name,
    type: params.type,
    layerId: params.layerId,
    parentId: params.parentId,
    visible: true,
    locked: false,
    x: params.bbox.x,
    y: params.bbox.y,
    width: params.bbox.width,
    height: params.bbox.height,
    rotation: 0,
    points: params.points,
    closed: params.closed,
    cornerRadius: params.cornerRadius,
    fills,
    strokes,
    effects: [],
    opacity: params.opacity ?? 1,
    blendMode: 'normal',
  };
}
