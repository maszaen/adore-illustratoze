import type { StudioDocument, VectorNode, LayerItem, AnchorPoint, BlendMode, BoundingBox, FillItem, LiveEffectItem, StrokeItem } from '../core/types';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors, createEllipseAnchors, createPolygonAnchors, createStarAnchors } from '../core/math/bezier';
import { selectionNodeBounds } from '../core/math/selectionResize';
import { fitPointTextFrame, textMeasurementSource } from '../core/math/textLayout';
import { isClipShape } from '../core/render/appearance';
import { packDocumentToAdlozeBytes, unpackAdlozeBytesToDocument } from '../core/io/adlozeIo';
import { exportDocumentToSvgString } from '../core/io/svgIo';
import { inspectLayout, measureText, validateMeasureItems } from './measure';
import { createPointTextNode, parseTextStyleFields, type FontStyleName, type PointTextOptions, type TextAlign } from './text';

type GradientStopInput = { offset: number; color: string; opacity?: number };
export type AgentFill = string | null | { type: 'solid'; color: string; opacity?: number } | { type: 'linear' | 'radial'; angle?: number; stops: GradientStopInput[]; opacity?: number };
export type AgentEffect =
  | { type: 'drop-shadow'; x?: number; y?: number; blur?: number; color?: string; opacity?: number }
  | { type: 'outer-glow'; blur?: number; color?: string; opacity?: number }
  | { type: 'gaussian-blur'; radius?: number };
type StyleFields = { opacity?: number; blendMode?: BlendMode; effects?: AgentEffect[] };
type StrokeFields = { stroke?: string | null; strokeWidth?: number; strokeOpacity?: number; strokeDash?: number[]; strokeCap?: 'butt' | 'round' | 'projecting'; strokeJoin?: 'miter' | 'round' | 'bevel' };
type TextFields = { fontSize?: number; fontFamily?: string; fontStyle?: FontStyleName; tracking?: number; align?: TextAlign; lineHeight?: number };
export type ShapeOperation = { op: 'rectangle' | 'ellipse' | 'polygon' | 'star'; id: string; layer: string; name?: string; x: number; y: number; width: number; height: number; fill?: AgentFill; rotation?: number; cornerRadius?: number; sides?: number; innerRadius?: number } & StyleFields & StrokeFields;
export type PathOperation = { op: 'path'; id: string; layer: string; name?: string; points: { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } }[]; closed?: boolean; fill?: AgentFill; rotation?: number } & StyleFields & StrokeFields;
export type TextOperation = { op: 'text'; id: string; layer: string; name?: string; x: number; y: number; text: string; fontSize: number; fill?: AgentFill; rotation?: number } & StyleFields & StrokeFields & TextFields;
export type GroupOperation = { op: 'group'; id: string; name?: string; children: string[] } & StyleFields;
export type ClipOperation = { op: 'clip'; id: string; name?: string; mask: string; content: string[] } & StyleFields;
export type UpdateOperation = { op: 'update'; id: string; name?: string; x?: number; y?: number; width?: number; height?: number; rotation?: number; fill?: AgentFill; text?: string } & StyleFields & StrokeFields & TextFields;
export type DesignOperation = { op: 'layer'; id: string; name: string; color?: string } | ShapeOperation | PathOperation | TextOperation | GroupOperation | ClipOperation | UpdateOperation | { op: 'ungroup'; id: string } | { op: 'delete'; id: string };
export type DesignSpec = { version: 1; document: { name: string; width: number; height: number; unit?: 'px' | 'pt'; colorMode?: 'RGB' | 'CMYK' }; operations: DesignOperation[] };
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const units = ['px','pt','pc','mm','cm','in'];
const BLEND_MODES: BlendMode[] = ['normal','darken','multiply','color-burn','lighten','screen','color-dodge','overlay','soft-light','hard-light','difference','exclusion','hue','saturation','color','luminosity'];
const VECTOR_TYPES = ['rectangle','ellipse','polygon','star','path','line'];
const CONTAINER_TYPES = ['group','clipping-group'];
const STYLE_KEYS = ['opacity','blendMode','effects'];
const STROKE_KEYS = ['stroke','strokeWidth','strokeOpacity','strokeDash','strokeCap','strokeJoin'];
const TEXT_KEYS = ['fontSize','fontFamily','fontStyle','tracking','align','lineHeight'];
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function fail(message: string): never { throw new Error(message); }
function object(value: unknown, context: string): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${context} must be an object`); return value as Record<string, any>; }
function keys(o: Record<string, any>, allowed: string[], context: string) { for (const key of Object.keys(o)) if (!allowed.includes(key)) fail(`${context}: unknown field ${key}`); }
function id(value: unknown, label: string): string { if (typeof value !== 'string' || !ID.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) fail(`${label}: invalid ID`); return value; }
function string(value: unknown, label: string, max = 500): string { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label}: expected non-empty string (max ${max})`); return value; }
function num(value: unknown, label: string, min = -1000000, max = 1000000): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${label}: expected number between ${min} and ${max}`); return value; }
function color(value: unknown, label: string): string | null { if (value === null) return null; if (typeof value !== 'string' || !COLOR.test(value)) fail(`${label}: use #RRGGBB or null`); return value; }
function solidColor(value: unknown, label: string): string { return color(value, label) ?? fail(`${label}: color cannot be null`); }
function idList(value: unknown, label: string, max = 1000): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) fail(`${label} must be an array of 1–${max} IDs`);
  const ids = value.map((v, i) => id(v, `${label}[${i}]`));
  if (new Set(ids).size !== ids.length) fail(`${label}: duplicate ID`);
  return ids;
}
function nextLayer(idValue: string, name: string, layerColor: string): LayerItem { return { id: idValue, name, color: layerColor, visible: true, locked: false, outlineMode: false, templateMode: false, expanded: true, nodeIds: [], effects: [], opacity: 1, blendMode: 'normal' }; }

function fill(idValue: string, value: unknown, label: string): FillItem[] {
  if (value === null || typeof value === 'string') {
    const c = color(value, label);
    return c ? [{ id: `${idValue}-fill`, visible: true, type: 'solid', color: c, opacity: 1, blendMode: 'normal' }] : [];
  }
  const g = object(value, label);
  if (g.type === 'solid') {
    keys(g, ['type','color','opacity'], label);
    return [{ id: `${idValue}-fill`, visible: true, type: 'solid', color: solidColor(g.color, `${label}.color`), opacity: g.opacity === undefined ? 1 : num(g.opacity, `${label}.opacity`, 0, 1), blendMode: 'normal' }];
  }
  keys(g, ['type','angle','stops','opacity'], label);
  if (!['linear','radial'].includes(g.type)) fail(`${label}.type must be solid, linear or radial`);
  if (!Array.isArray(g.stops) || g.stops.length < 2 || g.stops.length > 32) fail(`${label}.stops must contain 2–32 stops`);
  let previous = -1;
  const stops = g.stops.map((raw: unknown, i: number) => {
    const stop = object(raw, `${label}.stops[${i}]`); keys(stop, ['offset','color','opacity'], label);
    const offset = num(stop.offset, `${label}.stops[${i}].offset`, 0, 1);
    if (offset < previous) fail(`${label}.stops must be ordered by offset`); previous = offset;
    return { id: `${idValue}-stop-${i}`, offset, color: color(stop.color, label) || fail(`${label}: stop color cannot be null`), opacity: stop.opacity === undefined ? 1 : num(stop.opacity, label, 0, 1) };
  });
  return [{ id:`${idValue}-fill`, visible:true, type:'gradient', color:stops[0].color, opacity: g.opacity === undefined ? 1 : num(g.opacity, `${label}.opacity`, 0, 1), blendMode:'normal', gradient:{ id:`${idValue}-gradient`, name:'Agent gradient', type:g.type, angle:g.angle === undefined ? 0 : num(g.angle,`${label}.angle`, -3600, 3600), aspectRatio:1, stops } }];
}

interface StrokeInput { color?: string | null; width?: number; opacity?: number; dash?: number[]; cap?: StrokeItem['cap']; join?: StrokeItem['join'] }
function strokeInput(o: Record<string, any>, ctx: string): StrokeInput {
  const s: StrokeInput = {};
  if (o.stroke !== undefined) s.color = color(o.stroke, `${ctx}.stroke`);
  if (o.strokeWidth !== undefined) s.width = num(o.strokeWidth, `${ctx}.strokeWidth`, 0, 10000);
  if (o.strokeOpacity !== undefined) s.opacity = num(o.strokeOpacity, `${ctx}.strokeOpacity`, 0, 1);
  if (o.strokeDash !== undefined) {
    if (!Array.isArray(o.strokeDash) || o.strokeDash.length > 16) fail(`${ctx}.strokeDash must be an array of at most 16 lengths ([] for a solid line)`);
    s.dash = o.strokeDash.map((v: unknown, i: number) => num(v, `${ctx}.strokeDash[${i}]`, 0, 10000));
    if (s.dash.length && s.dash.every(v => v === 0)) fail(`${ctx}.strokeDash: at least one length must be greater than 0`);
  }
  if (o.strokeCap !== undefined) { if (!['butt','round','projecting'].includes(o.strokeCap)) fail(`${ctx}.strokeCap must be butt, round or projecting`); s.cap = o.strokeCap; }
  if (o.strokeJoin !== undefined) { if (!['miter','round','bevel'].includes(o.strokeJoin)) fail(`${ctx}.strokeJoin must be miter, round or bevel`); s.join = o.strokeJoin; }
  return s;
}
const hasStrokeDetails = (s: StrokeInput) => s.opacity !== undefined || s.dash !== undefined || s.cap !== undefined || s.join !== undefined;
function newStroke(idValue: string, s: StrokeInput, color: string, base?: StrokeItem): StrokeItem {
  return {
    id: base?.id ?? `${idValue}-stroke`, visible: true, color, weight: s.width ?? base?.weight ?? 1,
    cap: s.cap ?? base?.cap ?? 'round', join: s.join ?? base?.join ?? 'round', miterLimit: base?.miterLimit ?? 4, align: 'center',
    dashArray: s.dash ?? base?.dashArray ?? [], opacity: s.opacity ?? base?.opacity ?? 1, blendMode: base?.blendMode ?? 'normal',
  };
}
function createStrokes(idValue: string, s: StrokeInput, ctx: string): StrokeItem[] {
  if (!s.color) { if (hasStrokeDetails(s)) fail(`${ctx}: strokeOpacity, strokeDash, strokeCap and strokeJoin need a stroke color`); return []; }
  return [newStroke(idValue, s, s.color)];
}
function updateStrokes(node: VectorNode, s: StrokeInput, ctx: string) {
  if (s.color === null) { if (s.width !== undefined || hasStrokeDetails(s)) fail(`${ctx}: stroke is null, so other stroke fields cannot be set`); node.strokes = []; return; }
  const current = node.strokes.find(item => item.visible);
  if (s.color) { node.strokes = [newStroke(node.id, s, s.color, current)]; return; }
  if (!current) fail(`${ctx}: the object has no stroke; set stroke to a color first`);
  Object.assign(current, newStroke(node.id, s, current.color, current));
}

function effects(idValue: string, value: unknown, label: string): LiveEffectItem[] {
  if (!Array.isArray(value) || value.length > 3) fail(`${label} must be an array of at most 3 effects ([] removes all)`);
  const seen = new Set<string>();
  return value.map((raw, i) => {
    const c = `${label}[${i}]`; const e = object(raw, c);
    if (seen.has(e.type)) fail(`${c}: only one ${e.type} per object`); seen.add(e.type);
    const item = (type: LiveEffectItem['type'], name: string, params: Record<string, unknown>): LiveEffectItem => ({ id: `${idValue}-fx-${type}`, type, name, enabled: true, params });
    if (e.type === 'drop-shadow') {
      keys(e, ['type','x','y','blur','color','opacity'], c);
      return item('drop-shadow', 'Drop Shadow', { dx: e.x === undefined ? 6 : num(e.x, `${c}.x`, -10000, 10000), dy: e.y === undefined ? 6 : num(e.y, `${c}.y`, -10000, 10000), blur: e.blur === undefined ? 6 : num(e.blur, `${c}.blur`, 0, 1000), color: e.color === undefined ? '#000000' : solidColor(e.color, `${c}.color`), opacity: e.opacity === undefined ? 0.5 : num(e.opacity, `${c}.opacity`, 0, 1) });
    }
    if (e.type === 'outer-glow') {
      keys(e, ['type','blur','color','opacity'], c);
      return item('outer-glow', 'Outer Glow', { blur: e.blur === undefined ? 12 : num(e.blur, `${c}.blur`, 0, 1000), color: e.color === undefined ? '#FFFFFF' : solidColor(e.color, `${c}.color`), opacity: e.opacity === undefined ? 0.8 : num(e.opacity, `${c}.opacity`, 0, 1) });
    }
    if (e.type === 'gaussian-blur') {
      keys(e, ['type','radius'], c);
      return item('gaussian-blur', 'Gaussian Blur', { radius: e.radius === undefined ? 6 : num(e.radius, `${c}.radius`, 0, 1000) });
    }
    return fail(`${c}.type must be drop-shadow, outer-glow or gaussian-blur`);
  });
}

function applyStyle(node: VectorNode, o: Record<string, any>, ctx: string) {
  if (o.opacity !== undefined) node.opacity = num(o.opacity, `${ctx}.opacity`, 0, 1);
  if (o.blendMode !== undefined) { if (!BLEND_MODES.includes(o.blendMode)) fail(`${ctx}.blendMode must be one of ${BLEND_MODES.join(', ')}`); node.blendMode = o.blendMode; }
  if (o.effects !== undefined) node.effects = effects(node.id, o.effects, `${ctx}.effects`);
}

/** Layer and ancestor checks. Only plain groups and clipping groups may contain agent-editable objects. */
function editableLayer(doc: StudioDocument, node: VectorNode, ctx: string): LayerItem {
  const layer = doc.layers.find(l => l.id === node.layerId); if (!layer || layer.locked || node.locked) fail(`${ctx}: node or layer locked`);
  let parentId = node.parentId;
  while (parentId) {
    const parent = doc.nodes[parentId];
    if (!parent) fail(`${ctx}: invalid parent`);
    if (parent.locked) fail(`${ctx}: ancestor is locked`);
    if (!CONTAINER_TYPES.includes(parent.type)) fail(`${ctx}: objects inside a ${parent.type} cannot be edited by agents`);
    parentId = parent.parentId;
  }
  return layer;
}

function union(boxes: BoundingBox[]): BoundingBox | null {
  if (!boxes.length) return null;
  const x1 = Math.min(...boxes.map(b => b.x)), y1 = Math.min(...boxes.map(b => b.y));
  const x2 = Math.max(...boxes.map(b => b.x + b.width)), y2 = Math.max(...boxes.map(b => b.y + b.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
const frameOf = (node: VectorNode): BoundingBox => CONTAINER_TYPES.includes(node.type) ? { x: node.x, y: node.y, width: node.width, height: node.height } : selectionNodeBounds(node);
/** Recompute group frames from `startId` up to the layer: groups use their children, clipping groups their mask. */
function refreshFrames(doc: StudioDocument, startId: string | undefined) {
  let current = startId;
  while (current) {
    const node = doc.nodes[current];
    if (!node || !CONTAINER_TYPES.includes(node.type)) return;
    const kids = (node.children || []).map(c => doc.nodes[c]).filter(Boolean);
    const box = node.type === 'clipping-group' && kids.length ? frameOf(kids[kids.length - 1]) : union(kids.map(frameOf));
    if (box) { node.x = box.x; node.y = box.y; node.width = Math.max(1, box.width); node.height = Math.max(1, box.height); }
    current = node.parentId;
  }
}

const TRANSLATABLE = [...VECTOR_TYPES, 'text', 'image'];
function canTranslate(doc: StudioDocument, node: VectorNode): boolean {
  if (CONTAINER_TYPES.includes(node.type)) return (node.children || []).every(c => doc.nodes[c] && canTranslate(doc, doc.nodes[c]));
  return TRANSLATABLE.includes(node.type) && !node.children?.length;
}
function translate(doc: StudioDocument, node: VectorNode, dx: number, dy: number) {
  const shift = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
  node.x += dx; node.y += dy;
  node.points = node.points.map(p => ({ ...p, ...shift(p), handleIn: p.handleIn && shift(p.handleIn), handleOut: p.handleOut && shift(p.handleOut) }));
  for (const child of node.children || []) if (doc.nodes[child]) translate(doc, doc.nodes[child], dx, dy);
}

function subtreeIds(doc: StudioDocument, nodeId: string, out: string[] = []): string[] {
  out.push(nodeId);
  for (const child of doc.nodes[nodeId]?.children || []) subtreeIds(doc, child, out);
  return out;
}
/** Removed objects must not linger in export assets or saved selections. */
function dropReferences(doc: StudioDocument, removed: Set<string>) {
  doc.exportAssets = doc.exportAssets.filter(a => !removed.has(a.sourceNodeId));
  doc.savedSelections = doc.savedSelections.map(s => ({ ...s, nodeIds: s.nodeIds.filter(n => !removed.has(n)) })).filter(s => s.nodeIds.length > 0);
}

/** Creates an empty document. Coordinates and dimensions are points (px = pt in Adore). */
export function createDesign(input: unknown): StudioDocument {
  const spec = object(input, 'document'); keys(spec, ['name','width','height','unit','colorMode'], 'document');
  const name = string(spec.name, 'document.name', 200), width = num(spec.width, 'document.width', 1, 100000), height = num(spec.height, 'document.height', 1, 100000);
  if (spec.unit !== undefined && !['px','pt'].includes(spec.unit)) fail('document.unit: new documents support px or pt');
  if (spec.colorMode !== undefined && !['RGB','CMYK'].includes(spec.colorMode)) fail('document.colorMode must be RGB or CMYK');
  const doc = createDefaultDocument({ id: `doc-${globalThis.crypto.randomUUID()}`, name: name.endsWith('.adloze') ? name : `${name}.adloze`, width, height, unit: spec.unit ?? 'px', colorMode: spec.colorMode ?? 'RGB', includeSampleArtwork: false });
  doc.layers = [nextLayer('artwork', 'Artwork', '#4f9eff')]; doc.activeLayerId = 'artwork';
  return doc;
}

/** Reject structural problems without claiming complete validation of every editor feature. */
export function validateDocument(input: unknown): asserts input is StudioDocument {
  const d = object(input, 'document');
  string(d.id, 'document.id', 200); string(d.name, 'document.name', 500);
  if (!units.includes(d.unit)) fail('document.unit is invalid');
  if (!['RGB','CMYK'].includes(d.colorMode)) fail('document.colorMode is invalid');
  if (!Array.isArray(d.artboards) || !d.artboards.length || d.artboards.length > 100) fail('document must have 1–100 artboards');
  if (!Array.isArray(d.layers) || !d.layers.length || d.layers.length > 1000) fail('document must have 1–1000 layers');
  const nodes = object(d.nodes, 'document.nodes'); if (Object.keys(nodes).length > 10000) fail('document has too many nodes');
  const artboardIds = new Set<string>();
  for (const board of d.artboards) { object(board,'artboard'); string(board.id,'artboard.id',200); if (artboardIds.has(board.id)) fail(`duplicate artboard ${board.id}`); artboardIds.add(board.id); num(board.x,'artboard.x'); num(board.y,'artboard.y'); num(board.width,'artboard.width',0.001); num(board.height,'artboard.height',0.001); }
  if (!artboardIds.has(d.activeArtboardId)) fail('active artboard not found');
  const layers = new Map<string, any>();
  for (const layer of d.layers) { object(layer,'layer'); string(layer.id,'layer.id',200); if (layers.has(layer.id)) fail(`duplicate layer ${layer.id}`); if (!Array.isArray(layer.nodeIds)) fail(`layer ${layer.id}: nodeIds must be an array`); layers.set(layer.id, layer); }
  if (!layers.has(d.activeLayerId)) fail('active layer not found');
  const references = new Map<string, number>();
  for (const layer of d.layers) for (const nodeId of layer.nodeIds) { const n = nodes[nodeId]; if (!n || n.layerId !== layer.id) fail(`layer ${layer.id}: invalid node ${nodeId}`); references.set(nodeId, (references.get(nodeId) || 0) + 1); }
  for (const [nodeId, value] of Object.entries(nodes)) {
    const n = object(value, `node ${nodeId}`); if (n.id !== nodeId || !layers.has(n.layerId)) fail(`node ${nodeId}: invalid ID or layer`);
    for (const k of ['x','y','width','height','rotation']) num(n[k], `node ${nodeId}.${k}`, k === 'width' || k === 'height' ? 0 : -1000000);
    if (!Array.isArray(n.points) || !Array.isArray(n.fills) || !Array.isArray(n.strokes) || !Array.isArray(n.effects)) fail(`node ${nodeId}: missing geometry or styles`);
    if (!n.parentId && references.get(nodeId) !== 1) fail(`node ${nodeId}: root must occur exactly once in its layer`);
    if (n.parentId && (!nodes[n.parentId] || !Array.isArray(nodes[n.parentId].children) || !nodes[n.parentId].children.includes(nodeId))) fail(`node ${nodeId}: invalid parent`);
    if (n.children && (!Array.isArray(n.children) || n.children.some((child: string) => !nodes[child] || nodes[child].parentId !== nodeId))) fail(`node ${nodeId}: invalid children`);
    let p = n.parentId; const seen = new Set([nodeId]); while (p) { if (seen.has(p)) fail(`node ${nodeId}: parent cycle`); seen.add(p); p = nodes[p]?.parentId; }
  }
  for (const key of ['guides','slices','swatches','brushes','symbols','graphicStyles','patterns','exportAssets','savedSelections']) if (!Array.isArray(d[key])) fail(`document.${key} must be an array`);
}

function applyUpdate(doc: StudioDocument, o: Record<string, any>, ctx: string) {
  keys(o, ['op','id','name','x','y','width','height','rotation','fill','text',...STYLE_KEYS,...STROKE_KEYS,...TEXT_KEYS], ctx);
  const nodeId = id(o.id, `${ctx}.id`); if (!own(doc.nodes,nodeId)) fail(`${ctx}: node not found`);
  let node = doc.nodes[nodeId];
  editableLayer(doc, node, ctx);
  const isVector = VECTOR_TYPES.includes(node.type) && !node.children?.length;
  const isText = node.type === 'text';
  const isContainer = CONTAINER_TYPES.includes(node.type);
  if (o.x !== undefined || o.y !== undefined) {
    if (!canTranslate(doc, node)) fail(`${ctx}: moving this node type is not supported`);
    if (isContainer) refreshFrames(doc, node.id); // editor-made groups may carry a stale frame
    const x = o.x === undefined ? node.x : num(o.x,`${ctx}.x`), y = o.y === undefined ? node.y : num(o.y,`${ctx}.y`);
    translate(doc, node, x - node.x, y - node.y);
  }
  if (o.width !== undefined || o.height !== undefined) {
    if (!isVector || node.width <= 0 || node.height <= 0) fail(`${ctx}: resizing this node is not supported`);
    const width = o.width === undefined ? node.width : num(o.width,`${ctx}.width`,0.001,100000);
    const height = o.height === undefined ? node.height : num(o.height,`${ctx}.height`,0.001,100000);
    const sx=width/node.width, sy=height/node.height;
    const scale = (p: {x:number;y:number}) => ({x:node.x+(p.x-node.x)*sx,y:node.y+(p.y-node.y)*sy});
    node.points = node.points.map(p => ({...p,...scale(p),handleIn:p.handleIn && scale(p.handleIn),handleOut:p.handleOut && scale(p.handleOut)}));
    node.width=width; node.height=height;
  }
  if (o.rotation !== undefined) {
    if (!isVector && !isText) fail(`${ctx}: rotating this node is not supported`);
    node.rotation = num(o.rotation,`${ctx}.rotation`,-3600,3600);
  }
  if (o.opacity !== undefined || o.blendMode !== undefined || o.effects !== undefined) {
    if (!isVector && !isText && !isContainer && node.type !== 'image') fail(`${ctx}: opacity, blend mode and effects are not supported on this node type`);
    applyStyle(node, o, ctx);
  }
  if (o.name !== undefined) node.name = string(o.name,`${ctx}.name`,200);
  if (o.fill !== undefined) { if (!isVector && !isText) fail(`${ctx}: fill update for this node type is not supported`); node.fills = fill(node.id,o.fill,`${ctx}.fill`); }
  if (STROKE_KEYS.some(k => o[k] !== undefined)) { if (!isVector && !isText) fail(`${ctx}: stroke update for this node type is not supported`); updateStrokes(node, strokeInput(o, ctx), ctx); }
  if (o.text !== undefined || TEXT_KEYS.some(k => o[k] !== undefined)) {
    if (!isText || !node.textStyle) fail(`${ctx}: not a text node`);
    const t = parseTextStyleFields(o, ctx);
    if (o.text !== undefined) node.textContent = string(o.text,`${ctx}.text`,5000);
    const style = node.textStyle;
    if (t.fontSize !== undefined) { style.fontSize = t.fontSize; style.leading = t.fontSize * 1.2; }
    if (t.lineHeight !== undefined) style.leading = t.lineHeight;
    if (t.fontFamily !== undefined) style.fontFamily = t.fontFamily;
    if (t.fontStyle !== undefined) style.fontStyle = t.fontStyle;
    if (t.tracking !== undefined) style.tracking = t.tracking;
    if (t.align !== undefined) style.align = t.align;
    node = doc.nodes[nodeId] = fitPointTextFrame(node); // keeps the alignment anchor fixed
  }
  refreshFrames(doc, node.parentId);
}

function applyGroup(doc: StudioDocument, o: Record<string, any>, ctx: string) {
  const clip = o.op === 'clip';
  keys(o, clip ? ['op','id','name','mask','content',...STYLE_KEYS] : ['op','id','name','children',...STYLE_KEYS], ctx);
  const groupId = id(o.id, `${ctx}.id`); if (own(doc.nodes, groupId)) fail(`${ctx}: node already exists`);
  const content = idList(clip ? o.content : o.children, clip ? `${ctx}.content` : `${ctx}.children`);
  const maskId = clip ? id(o.mask, `${ctx}.mask`) : null;
  if (maskId && content.includes(maskId)) fail(`${ctx}: the mask cannot also be in content`);
  const memberIds = maskId ? [...content, maskId] : content;
  const members = memberIds.map(m => own(doc.nodes, m) ? doc.nodes[m] : fail(`${ctx}: node ${m} not found`));
  const layer = doc.layers.find(l => l.id === members[0].layerId);
  if (!layer || layer.locked) fail(`${ctx}: layer missing or locked`);
  for (const m of members) {
    if (m.layerId !== layer.id) fail(`${ctx}: all objects must be on the same layer`);
    if (m.parentId) fail(`${ctx}: ${m.id} is inside a group; ungroup it first`);
    if (m.locked) fail(`${ctx}: ${m.id} is locked`);
  }
  if (maskId && !isClipShape(doc.nodes[maskId])) fail(`${ctx}.mask must be a path or shape (rectangle, ellipse, polygon, star, path)`);
  const stack = (ids: string[]) => [...ids].sort((a, b) => layer.nodeIds.indexOf(a) - layer.nodeIds.indexOf(b));
  const children = maskId ? [...stack(content), maskId] : stack(content);
  const top = Math.max(...memberIds.map(m => layer.nodeIds.indexOf(m)));
  layer.nodeIds.splice(top + 1, 0, groupId);
  layer.nodeIds = layer.nodeIds.filter(n => !memberIds.includes(n));
  const group: VectorNode = {
    id: groupId, name: o.name === undefined ? groupId : string(o.name, `${ctx}.name`, 200), type: clip ? 'clipping-group' : 'group', layerId: layer.id,
    visible: true, locked: false, x: 0, y: 0, width: 1, height: 1, rotation: 0, points: [], closed: true, children,
    fills: [], strokes: [], effects: [], opacity: 1, blendMode: 'normal',
  };
  for (const m of members) m.parentId = groupId;
  doc.nodes[groupId] = group;
  applyStyle(group, o, ctx);
  refreshFrames(doc, groupId);
}

function applyUngroup(doc: StudioDocument, o: Record<string, any>, ctx: string) {
  keys(o, ['op','id'], ctx);
  const nodeId = id(o.id, `${ctx}.id`); if (!own(doc.nodes, nodeId)) fail(`${ctx}: node not found`);
  const node = doc.nodes[nodeId];
  if (!CONTAINER_TYPES.includes(node.type)) fail(`${ctx}: only groups and clipping groups can be ungrouped`);
  const layer = editableLayer(doc, node, ctx);
  const kids = [...(node.children || [])];
  if (node.type === 'clipping-group' && kids.length) {
    // Like Illustrator's Release Clipping Mask: the mask path keeps its shape but has no paint.
    const mask = doc.nodes[kids[kids.length - 1]];
    if (mask) { mask.fills = []; mask.strokes = []; }
  }
  for (const k of kids) if (doc.nodes[k]) doc.nodes[k].parentId = node.parentId;
  const parent = node.parentId ? doc.nodes[node.parentId] : undefined;
  if (parent) parent.children = (parent.children || []).flatMap(c => c === nodeId ? kids : [c]);
  else layer.nodeIds = layer.nodeIds.flatMap(n => n === nodeId ? kids : [n]);
  delete doc.nodes[nodeId];
  dropReferences(doc, new Set([nodeId]));
  refreshFrames(doc, node.parentId);
}

function applyDelete(doc: StudioDocument, o: Record<string, any>, ctx: string) {
  keys(o, ['op','id'], ctx);
  const nodeId = id(o.id, `${ctx}.id`); if (!own(doc.nodes,nodeId)) fail(`${ctx}: node not found`);
  const node = doc.nodes[nodeId];
  const layer = editableLayer(doc, node, ctx);
  if (node.children?.length && !CONTAINER_TYPES.includes(node.type)) fail(`${ctx}: deleting a ${node.type} is not supported`);
  const parent = node.parentId ? doc.nodes[node.parentId] : undefined;
  if (parent?.type === 'clipping-group') {
    const siblings = parent.children || [];
    if (siblings[siblings.length - 1] === nodeId) fail(`${ctx}: this is the clipping mask; ungroup or delete the clipping group instead`);
    if (siblings.length <= 2) fail(`${ctx}: this is the last clipped object; delete the clipping group instead`);
  }
  const removed = new Set(subtreeIds(doc, nodeId));
  for (const r of removed) delete doc.nodes[r];
  // Remove from the parent; empty plain groups are removed too.
  let childId = nodeId, holder = parent;
  while (holder) {
    holder.children = (holder.children || []).filter(c => c !== childId);
    if (holder.children.length || holder.type !== 'group') break;
    removed.add(holder.id); delete doc.nodes[holder.id];
    childId = holder.id; holder = holder.parentId ? doc.nodes[holder.parentId] : undefined;
  }
  if (!holder) layer.nodeIds = layer.nodeIds.filter(v => v !== childId);
  dropReferences(doc, removed);
  refreshFrames(doc, holder?.id);
}

/** Atomically apply validated, constrained operations to a cloned document. */
export function applyOperations(source: StudioDocument, input: unknown): StudioDocument {
  validateDocument(source);
  if (!Array.isArray(input) || input.length > 1000) fail('operations must be an array of at most 1000 entries');
  const doc = structuredClone(source);
  for (const [index, raw] of input.entries()) {
    const o = object(raw, `operation ${index}`); const ctx = `operation ${index}`;
    if (o.op === 'layer') {
      keys(o,['op','id','name','color'],ctx); const layerId = id(o.id, `${ctx}.id`);
      if (doc.layers.some(l => l.id === layerId)) fail(`${ctx}: layer already exists`);
      doc.layers.unshift(nextLayer(layerId, string(o.name, `${ctx}.name`,200), o.color === undefined ? '#4f9eff' : color(o.color, `${ctx}.color`) || fail('layer color cannot be null'))); continue;
    }
    if (o.op === 'update') { applyUpdate(doc, o, ctx); continue; }
    if (o.op === 'delete') { applyDelete(doc, o, ctx); continue; }
    if (o.op === 'group' || o.op === 'clip') { applyGroup(doc, o, ctx); continue; }
    if (o.op === 'ungroup') { applyUngroup(doc, o, ctx); continue; }
    if (!['rectangle','ellipse','polygon','star','path','text'].includes(o.op)) fail(`${ctx}: unsupported operation ${String(o.op)}`);
    const common = ['op','id','layer','name','fill','rotation',...STYLE_KEYS,...STROKE_KEYS];
    keys(o, o.op === 'path' ? [...common,'points','closed'] : o.op === 'text' ? [...common,'x','y','text',...TEXT_KEYS] : [...common,'x','y','width','height', ...(o.op === 'rectangle' || o.op === 'polygon' || o.op === 'star' ? ['cornerRadius'] : []), ...(o.op === 'polygon' || o.op === 'star' ? ['sides'] : []), ...(o.op === 'star' ? ['innerRadius'] : [])],ctx);
    const nodeId = id(o.id,`${ctx}.id`), layerId = id(o.layer,`${ctx}.layer`);
    if (own(doc.nodes,nodeId)) fail(`${ctx}: node already exists`); const layer = doc.layers.find(l => l.id === layerId); if (!layer || layer.locked) fail(`${ctx}: layer missing or locked`);
    const sides = o.sides === undefined ? (o.op === 'polygon' ? 6 : 5) : num(o.sides,`${ctx}.sides`,3,100);
    if (!Number.isInteger(sides)) fail(`${ctx}.sides must be an integer`);
    const cornerRadius = o.cornerRadius === undefined ? 0 : num(o.cornerRadius,`${ctx}.cornerRadius`,0,100000);
    const innerRadius = o.innerRadius === undefined ? 0.45 : num(o.innerRadius,`${ctx}.innerRadius`,0.08,0.95);
    const name = o.name === undefined ? nodeId : string(o.name,`${ctx}.name`,200); let x=0,y=0,w=0,h=0; let points: AnchorPoint[];
    if (o.op === 'path') {
      if (!Array.isArray(o.points) || o.points.length < 2 || o.points.length > 1000) fail(`${ctx}: path requires 2–1000 points`);
      points = o.points.map((p: unknown, i: number) => { const v=object(p,`${ctx}.points[${i}]`); keys(v,['x','y','handleIn','handleOut'],ctx); const handle = (v: unknown) => { const h=object(v,ctx); keys(h,['x','y'],ctx); return {x:num(h.x,ctx),y:num(h.y,ctx)}; }; return { id:`${nodeId}-p${i}`, x:num(v.x,ctx), y:num(v.y,ctx), pointType:'corner' as const, ...(v.handleIn ? {handleIn:handle(v.handleIn)} : {}), ...(v.handleOut ? {handleOut:handle(v.handleOut)} : {}) }; });
      const coords = points.flatMap(p => [p, ...(p.handleIn ? [p.handleIn] : []), ...(p.handleOut ? [p.handleOut] : [])]); x=Math.min(...coords.map(p=>p.x)); y=Math.min(...coords.map(p=>p.y)); w=Math.max(...coords.map(p=>p.x))-x; h=Math.max(...coords.map(p=>p.y))-y;
      if (o.closed !== undefined && typeof o.closed !== 'boolean') fail(`${ctx}.closed must be boolean`);
    } else { x=num(o.x,`${ctx}.x`); y=num(o.y,`${ctx}.y`); w=o.op === 'text' ? 1 : num(o.width,`${ctx}.width`,0.001,100000); h=o.op === 'text' ? 1 : num(o.height,`${ctx}.height`,0.001,100000); points = o.op === 'ellipse' ? createEllipseAnchors(x,y,w,h) : o.op === 'polygon' ? createPolygonAnchors(x,y,w,h,sides,cornerRadius) : o.op === 'star' ? createStarAnchors(x,y,w,h,sides,innerRadius,cornerRadius) : createRectangleAnchors(x,y,w,h,cornerRadius); }
    const fillValue = o.fill === undefined ? (o.op === 'path' && o.closed === false ? null : '#000000') : o.fill;
    const strokeValues = strokeInput(o, ctx);
    let node: VectorNode = { id:nodeId, name, type:o.op, layerId, visible:true, locked:false, x,y,width:w,height:h, rotation:o.rotation === undefined ? 0 : num(o.rotation,`${ctx}.rotation`,-3600,3600), points, closed:o.op === 'path' ? o.closed !== false : true, ...(o.op === 'rectangle' || o.op === 'polygon' || o.op === 'star' ? {cornerRadius} : {}), ...(o.op === 'polygon' || o.op === 'star' ? {sides} : {}), ...(o.op === 'star' ? {innerRadius} : {}), fills:fill(nodeId,fillValue,`${ctx}.fill`), strokes:createStrokes(nodeId,strokeValues,ctx), effects:[], opacity:1, blendMode:'normal' };
    applyStyle(node, o, ctx);
    if (o.op === 'text') {
      const t = parseTextStyleFields(o, ctx);
      if (t.fontSize === undefined) fail(`${ctx}.fontSize: expected number between 1 and 10000`);
      node = createPointTextNode(node, x, y, string(o.text,`${ctx}.text`,5000), t as PointTextOptions);
    }
    doc.nodes[nodeId]=node; layer.nodeIds.push(nodeId);
  }
  doc.updatedAt = Date.now(); validateDocument(doc); return doc;
}
export function createFromSpec(input: unknown): StudioDocument { const spec=object(input,'spec'); keys(spec,['version','document','operations'],'spec'); if (spec.version !== 1) fail('spec.version must be 1'); return applyOperations(createDesign(spec.document),spec.operations); }
export function readDesign(bytes: Uint8Array): StudioDocument { const doc=unpackAdlozeBytesToDocument(bytes).document; validateDocument(doc); return doc; }
export function writeDesign(doc: StudioDocument): Uint8Array { validateDocument(doc); return packDocumentToAdlozeBytes(doc); }
export function previewDesign(doc: StudioDocument, artboardId?: string): string { validateDocument(doc); if (artboardId && !doc.artboards.some(a => a.id === artboardId)) fail('artboard not found'); return exportDocumentToSvgString(doc, { artboardId, responsive: true }); }
/**
 * Document summary for agents. `bounds` is the editable frame (rotation applied for vectors).
 * `visualBounds` is what the object visibly covers (stroke, rotation, group children, clip mask, text ink);
 * `effectBounds` adds shadow/glow/blur reach. Text sizes use real fonts only when `measurement.text` is `canvas`.
 */
export function inspectDesign(doc: StudioDocument) {
  validateDocument(doc);
  const source = textMeasurementSource();
  return {
    id: doc.id, name: doc.name, unit: doc.unit, colorMode: doc.colorMode,
    measurement: {
      text: source,
      note: source === 'canvas'
        ? 'Text widths and ink use browser font metrics; a font that is not installed is measured with the browser fallback font.'
        : 'No browser canvas here: text widths and ink are estimates (about 0.56 × font size per character). Use the live bridge (adore_measure_text) for exact sizes.',
    },
    artboards: structuredClone(doc.artboards),
    layers: doc.layers.map(l => ({ id:l.id,name:l.name,visible:l.visible,locked:l.locked,nodeIds:[...l.nodeIds] })),
    nodes: Object.values(doc.nodes).map(n => structuredClone({ id:n.id,name:n.name,type:n.type,layerId:n.layerId,parentId:n.parentId,children:n.children,clipMask:n.type === 'clipping-group' ? n.children?.[n.children.length - 1] : undefined,locked:n.locked,visible:n.visible,x:n.x,y:n.y,width:n.width,height:n.height,rotation:n.rotation, bounds:selectionNodeBounds(n), ...inspectLayout(n, doc.nodes), text:n.textContent, textStyle:n.textStyle, fill:n.fills[0]?.color, fills:n.fills, strokes:n.strokes, effects:n.effects?.length ? n.effects : undefined, opacity:n.opacity, blendMode:n.blendMode, points:n.points, closed:n.closed, cornerRadius:n.cornerRadius, sides:n.sides, innerRadius:n.innerRadius })),
  };
}

/** Measure point text as the `text` operation would create it. See `measure.ts` for field meanings. */
export function measureTexts(items: unknown) {
  return { items: validateMeasureItems(items).map(measureText), source: textMeasurementSource() };
}
