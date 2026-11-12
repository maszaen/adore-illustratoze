import type { TextStyle, VectorNode } from '../core/types';
import { createRectangleAnchors } from '../core/math/bezier';
import { fitPointTextFrame } from '../core/math/textLayout';

/** Point-text rules shared by the `text` operation and text measurement, so both always agree. */

export const FONT_STYLES = ['Regular', 'Bold', 'Italic', 'Bold Italic'] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type FontStyleName = (typeof FONT_STYLES)[number];
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export interface PointTextOptions {
  fontSize: number;
  fontFamily?: string;
  fontStyle?: FontStyleName;
  /** Letter spacing in thousandths of an em, like Illustrator's tracking (100 = 0.1 em). */
  tracking?: number;
  /** `x` is the left edge, the center, or the right edge of the text. */
  align?: TextAlign;
  /** Distance between baselines in points; default 1.2 × font size. */
  lineHeight?: number;
}

function fail(message: string): never { throw new Error(message); }
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates the optional text style fields present on `o` (fields that are absent stay undefined). */
export function parseTextStyleFields(o: Record<string, unknown>, ctx: string): Partial<PointTextOptions> {
  const out: Partial<PointTextOptions> = {};
  if (o.fontSize !== undefined) { if (!isNum(o.fontSize) || o.fontSize < 1 || o.fontSize > 10000) fail(`${ctx}.fontSize: expected number between 1 and 10000`); out.fontSize = o.fontSize; }
  if (o.fontFamily !== undefined) { if (typeof o.fontFamily !== 'string' || !o.fontFamily.trim() || o.fontFamily.length > 200) fail(`${ctx}.fontFamily: expected non-empty string (max 200)`); out.fontFamily = o.fontFamily; }
  if (o.fontStyle !== undefined) { if (!FONT_STYLES.includes(o.fontStyle as FontStyleName)) fail(`${ctx}.fontStyle must be one of ${FONT_STYLES.join(', ')}`); out.fontStyle = o.fontStyle as FontStyleName; }
  if (o.tracking !== undefined) { if (!isNum(o.tracking) || o.tracking < -1000 || o.tracking > 10000) fail(`${ctx}.tracking: expected number between -1000 and 10000 (thousandths of an em)`); out.tracking = o.tracking; }
  if (o.align !== undefined) { if (!TEXT_ALIGNS.includes(o.align as TextAlign)) fail(`${ctx}.align must be one of ${TEXT_ALIGNS.join(', ')}`); out.align = o.align as TextAlign; }
  if (o.lineHeight !== undefined) { if (!isNum(o.lineHeight) || o.lineHeight <= 0 || o.lineHeight > 100000) fail(`${ctx}.lineHeight: expected number greater than 0 and at most 100000`); out.lineHeight = o.lineHeight; }
  return out;
}

export function agentTextStyle(o: PointTextOptions): TextStyle {
  const size = o.fontSize;
  return {
    fontFamily: o.fontFamily ?? 'Arial, sans-serif', fontStyle: o.fontStyle ?? 'Regular', fontSize: size, leading: o.lineHeight ?? size * 1.2,
    kerning: 0, tracking: o.tracking ?? 0, horizontalScale: 100, verticalScale: 100, baselineShift: 0, characterRotation: 0, textCase: 'normal',
    underline: false, strikethrough: false, align: o.align ?? 'left', indentLeft: 0, indentRight: 0, indentFirstLine: 0, spaceBefore: 0, spaceAfter: 0,
    hyphenation: false, typeMode: 'point', vertical: false,
  };
}

/**
 * Point text placed so `x` is its left edge, center or right edge (by `align`) and `y` is the top of its frame.
 * The frame is sized to the content with the editor's text measurement.
 */
export function createPointTextNode(base: Omit<VectorNode, 'type' | 'x' | 'y' | 'width' | 'height' | 'points' | 'closed' | 'textContent' | 'textStyle'>, x: number, y: number, text: string, options: PointTextOptions): VectorNode {
  const draft: VectorNode = { ...base, type: 'text', x, y, width: 1, height: 1, points: createRectangleAnchors(x, y, 1, 1), closed: true, textContent: text, textStyle: agentTextStyle(options) };
  const fitted = fitPointTextFrame(draft);
  const align = options.align ?? 'left';
  const left = align === 'center' ? x - fitted.width / 2 : align === 'right' ? x - fitted.width : x;
  return { ...fitted, x: left, points: createRectangleAnchors(left, fitted.y, fitted.width, fitted.height) };
}
