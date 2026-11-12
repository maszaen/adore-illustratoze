import type { VectorNode } from '../types';
import { createRectangleAnchors } from './bezier';

export type TextMeasurer = (text: string, fontSize: number, node: VectorNode) => number;

let context: CanvasRenderingContext2D | null | undefined;
/** Measure with the actual browser font; deterministic approximation is used in headless tests. */
export const measureTextWidth: TextMeasurer = (text, size, node) => {
  if (context === undefined) {
    context = null;
    if (typeof document !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined') {
      try { context = document.createElement('canvas').getContext('2d'); } catch { /* no canvas */ }
    }
  }
  if (context) {
    const style = node.textStyle;
    const italic = style?.fontStyle?.toLowerCase().includes('italic') ? 'italic ' : '';
    const bold = style?.fontStyle?.toLowerCase().includes('bold') ? 'bold ' : '';
    context.font = `${italic}${bold}${size}px ${style?.fontFamily || 'Inter, sans-serif'}`;
    return context.measureText(text).width;
  }
  return Array.from(text).length * size * 0.56;
};

function widthOf(text: string, size: number, node: VectorNode, measure: TextMeasurer): number {
  const spacing = (node.textStyle?.tracking ?? 0) * size / 1000;
  return Math.max(0, measure(text, size, node) + Array.from(text).length * spacing);
}

function wrapLine(text: string, maxWidth: number, size: number, node: VectorNode, measure: TextMeasurer): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  let line = '';
  for (const token of text.match(/\s+|\S+/gu) || []) {
    if (widthOf(line + token, size, node, measure) <= maxWidth) { line += token; continue; }
    if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
    if (!token.trim()) continue;
    // Break words wider than the frame, without dropping their characters.
    for (const char of Array.from(token)) {
      if (line && widthOf(line + char, size, node, measure) > maxWidth) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

/** Glyph transforms are independent of the editable font size and survive reflow. */
export function textGlyphTransform(node: VectorNode) {
  const point = node.textStyle?.typeMode === 'point';
  const sx = point ? (node.textScaleX ?? 1) : 1;
  const sy = point ? (node.textScaleY ?? 1) : 1;
  return { sx, sy, tx: node.x * (1 - sx) + (sx < 0 ? node.width : 0), ty: node.y * (1 - sy) + (sy < 0 ? node.height : 0) };
}

/** Shared layout: point text keeps its font; area text wraps only on request. */
export function layoutText(node: VectorNode, measure: TextMeasurer = measureTextWidth) {
  const style = node.textStyle;
  const fontSize = Math.max(0.01, style?.fontSize ?? 24);
  const leading = Math.max(0.01, style?.leading || fontSize * 1.2);
  const text = style?.textCase === 'uppercase' ? (node.textContent ?? '').toUpperCase() : (node.textContent ?? '');
  const paragraphs = text.split(/\r?\n/);
  const area = style?.typeMode === 'area';
  const { sx } = textGlyphTransform(node);
  const width = Math.max(0.01, node.width / Math.max(0.000001, Math.abs(sx))), height = Math.max(0.01, node.height);
  const lines = area && style?.wrapInFrame ? paragraphs.flatMap(line => wrapLine(line, width, fontSize, node, measure)) : paragraphs;
  const align: 'left' | 'center' | 'right' = style?.align === 'center' ? 'center' : style?.align === 'right' ? 'right' : 'left';
  return {
    lines, fontSize, leading, align,
    x: node.x + (align === 'center' ? width / 2 : align === 'right' ? width : 0),
    y: node.y + fontSize * 0.96,
    letterSpacing: (style?.tracking ?? 0) * fontSize / 1000,
    overflow: area && (fontSize * 1.2 + Math.max(0, lines.length - 1) * leading > height || lines.some(line => widthOf(line, fontSize, node, measure) > width)),
  };
}

/** Size a point-text box to its contents while keeping its alignment anchor fixed. */
export function fitPointTextFrame(node: VectorNode, measure: TextMeasurer = measureTextWidth): VectorNode {
  if (node.type !== 'text' || node.textStyle?.typeMode !== 'point') return node;
  const style = node.textStyle;
  const size = Math.max(0.01, style.fontSize || 24);
  const leading = Math.max(0.01, style.leading || size * 1.2);
  const text = style.textCase === 'uppercase' ? (node.textContent ?? '').toUpperCase() : (node.textContent ?? '');
  const lines = text.split(/\r?\n/);
  const width = Math.max(0.01, Math.ceil((Math.max(...lines.map(line => widthOf(line, size, node, measure)), 0) + 2) * Math.abs(node.textScaleX ?? 1) * 100) / 100);
  const height = Math.max(0.01, Math.ceil((size * 1.2 + (lines.length - 1) * leading + 2) * Math.abs(node.textScaleY ?? 1) * 100) / 100);
  const reversed = (node.textScaleX ?? 1) < 0;
  const x = style.align === 'center' ? node.x + (node.width - width) / 2 : (style.align === 'right') !== reversed ? node.x + node.width - width : node.x;
  const y = (node.textScaleY ?? 1) < 0 ? node.y + node.height - height : node.y;
  return { ...node, x, y, width, height, points: createRectangleAnchors(x, y, width, height) };
}
