import type { StudioDocument } from '../../core/types';

/**
 * Browser-only font helpers for the live bridge. Canvas measurements are only meaningful after the
 * font has loaded; and a family that is not installed silently falls back to another font.
 */

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong']);

export interface FontRequest { family: string; style?: string }
export interface FontStatus { family: string; style: string; available: boolean | 'unknown' }

const primaryFamily = (stack: string) => stack.split(',')[0].replace(/["']/g, '').trim();
const cssStyle = (style = 'Regular') => `${style.toLowerCase().includes('italic') ? 'italic ' : ''}${style.toLowerCase().includes('bold') ? 'bold ' : ''}`;

/** Families and styles used by text in the document plus any extra requests. */
export function fontRequestsFor(doc: StudioDocument | null, extra: FontRequest[] = []): FontRequest[] {
  const seen = new Map<string, FontRequest>();
  const add = (family: string | undefined, style: string | undefined) => {
    if (!family) return;
    const key = `${family}|${style ?? 'Regular'}`;
    if (!seen.has(key)) seen.set(key, { family, style: style ?? 'Regular' });
  };
  for (const node of Object.values(doc?.nodes ?? {})) if (node.type === 'text') add(node.textStyle?.fontFamily, node.textStyle?.fontStyle);
  for (const item of extra) add(item.family, item.style);
  return [...seen.values()].slice(0, 50);
}

/** Text font requests found in an operations array (create text ops). */
export function fontRequestsInOperations(operations: unknown): FontRequest[] {
  if (!Array.isArray(operations)) return [];
  return operations
    .filter((op): op is Record<string, unknown> => !!op && typeof op === 'object' && (op as any).op === 'text')
    .map(op => ({ family: typeof op.fontFamily === 'string' ? op.fontFamily : 'Arial, sans-serif', style: typeof op.fontStyle === 'string' ? op.fontStyle : 'Regular' }));
}

/** Wait (bounded) for web fonts so canvas metrics use the real font instead of a fallback. */
export async function waitForFonts(requests: FontRequest[], timeoutMs = 3000): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const loads = requests.map(r => document.fonts.load(`${cssStyle(r.style)}32px ${r.family}`, 'AaBbGgQq09').catch(() => []));
  await Promise.race([Promise.all(loads), new Promise(resolve => setTimeout(resolve, timeoutMs))]);
}

let probe: CanvasRenderingContext2D | null | undefined;
/**
 * A family is treated as missing when text set in it measures exactly like two different generic
 * fallbacks. Generic families are always available. `unknown` when there is no canvas.
 */
export function fontStatus(request: FontRequest): FontStatus {
  const family = primaryFamily(request.family);
  const style = request.style ?? 'Regular';
  if (!family || GENERIC.has(family.toLowerCase())) return { family, style, available: true };
  if (probe === undefined) {
    probe = null;
    try { probe = document.createElement('canvas').getContext('2d'); } catch { /* no canvas */ }
  }
  if (!probe) return { family, style, available: 'unknown' };
  const sample = 'mmmmmmmmmwwwwwlli1|WQ@#';
  const width = (font: string) => { probe!.font = font; return probe!.measureText(sample).width; };
  const prefix = `${cssStyle(style)}72px`;
  const quoted = `"${family.replace(/"/g, '')}"`;
  const missing = ['monospace', 'serif'].every(fallback => width(`${prefix} ${quoted}, ${fallback}`) === width(`${prefix} ${fallback}`));
  return { family, style, available: !missing };
}
