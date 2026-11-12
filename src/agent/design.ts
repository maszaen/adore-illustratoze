/** File-based, model-independent authoring interface for external agents. Coordinates are points. */
import type { StudioDocument, VectorNode, LayerItem, TextStyle, AnchorPoint } from '../core/types';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors, createEllipseAnchors } from '../core/math/bezier';
import { fitPointTextFrame } from '../core/math/textLayout';
import { packDocumentToAdlozeBytes, unpackAdlozeBytesToDocument } from '../core/io/adlozeIo';
import { exportDocumentToSvgString } from '../core/io/svgIo';

export type ShapeOperation = { op: 'rectangle' | 'ellipse'; id: string; layer: string; name?: string; x: number; y: number; width: number; height: number; fill?: string | null; stroke?: string | null; strokeWidth?: number };
export type PathOperation = { op: 'path'; id: string; layer: string; name?: string; points: { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } }[]; closed?: boolean; fill?: string | null; stroke?: string | null; strokeWidth?: number };
export type TextOperation = { op: 'text'; id: string; layer: string; name?: string; x: number; y: number; text: string; fontSize: number; fontFamily?: string; fontStyle?: 'Regular' | 'Bold' | 'Italic' | 'Bold Italic'; fill?: string };
export type DesignOperation = { op: 'layer'; id: string; name: string; color?: string } | ShapeOperation | PathOperation | TextOperation | { op: 'update'; id: string; name?: string; x?: number; y?: number; fill?: string | null; text?: string; fontSize?: number } | { op: 'delete'; id: string };
export type DesignSpec = { version: 1; document: { name: string; width: number; height: number; unit?: 'px' | 'pt'; colorMode?: 'RGB' | 'CMYK' }; operations: DesignOperation[] };
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const units = ['px','pt','pc','mm','cm','in'];
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function fail(message: string): never { throw new Error(message); }
function object(value: unknown, context: string): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${context} must be an object`); return value as Record<string, any>; }
function keys(o: Record<string, any>, allowed: string[], context: string) { for (const key of Object.keys(o)) if (!allowed.includes(key)) fail(`${context}: unknown field ${key}`); }
function id(value: unknown, label: string): string { if (typeof value !== 'string' || !ID.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) fail(`${label}: invalid ID`); return value; }
function string(value: unknown, label: string, max = 500): string { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label}: expected non-empty string (max ${max})`); return value; }
function num(value: unknown, label: string, min = -1000000, max = 1000000): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`${label}: expected number between ${min} and ${max}`); return value; }
function color(value: unknown, label: string): string | null { if (value === null) return null; if (typeof value !== 'string' || !COLOR.test(value)) fail(`${label}: use #RRGGBB or null`); return value; }
function nextLayer(idValue: string, name: string, layerColor: string): LayerItem { return { id: idValue, name, color: layerColor, visible: true, locked: false, outlineMode: false, templateMode: false, expanded: true, nodeIds: [], effects: [], opacity: 1, blendMode: 'normal' }; }
function fill(idValue: string, c: string | null): VectorNode['fills'] { return c ? [{ id: `${idValue}-fill`, visible: true, type: 'solid', color: c, opacity: 1, blendMode: 'normal' }] : []; }
function stroke(idValue: string, c: string | null, weight: number): VectorNode['strokes'] { return c ? [{ id: `${idValue}-stroke`, visible: true, color: c, weight, cap: 'round', join: 'round', miterLimit: 4, align: 'center', dashArray: [], opacity: 1, blendMode: 'normal' }] : []; }
function textStyle(size: number, family: string, style: TextStyle['fontStyle']): TextStyle { return { fontFamily: family, fontStyle: style, fontSize: size, leading: size * 1.2, kerning: 0, tracking: 0, horizontalScale: 100, verticalScale: 100, baselineShift: 0, characterRotation: 0, textCase: 'normal', underline: false, strikethrough: false, align: 'left', indentLeft: 0, indentRight: 0, indentFirstLine: 0, spaceBefore: 0, spaceAfter: 0, hyphenation: false, typeMode: 'point', vertical: false }; }

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
    if (o.op === 'update' || o.op === 'delete') {
      keys(o, o.op === 'delete' ? ['op','id'] : ['op','id','name','x','y','fill','text','fontSize'],ctx);
      const nodeId = id(o.id, `${ctx}.id`); if (!own(doc.nodes,nodeId)) fail(`${ctx}: node not found`); const node = doc.nodes[nodeId];
      const layer = doc.layers.find(l => l.id === node.layerId); if (!layer || layer.locked || node.locked) fail(`${ctx}: node or layer locked`);
      let parentId = node.parentId;
      while (parentId) { const parent = doc.nodes[parentId]; if (parent?.locked) fail(`${ctx}: ancestor is locked`); parentId = parent?.parentId; }
      if (o.op === 'delete') { if (node.parentId || node.children?.length) fail(`${ctx}: deleting grouped objects is not supported`); layer.nodeIds = layer.nodeIds.filter(v => v !== nodeId); delete doc.nodes[nodeId]; continue; }
      if ((o.x !== undefined || o.y !== undefined) && (node.parentId || node.children?.length || !['rectangle','ellipse','path','line','text'].includes(node.type))) fail(`${ctx}: moving this node type is not supported`);
      const x = o.x === undefined ? node.x : num(o.x,`${ctx}.x`), y = o.y === undefined ? node.y : num(o.y,`${ctx}.y`), dx = x-node.x, dy = y-node.y;
      node.x = x; node.y = y; node.points = node.points.map(p => ({ ...p, x:p.x+dx, y:p.y+dy, handleIn:p.handleIn && {x:p.handleIn.x+dx,y:p.handleIn.y+dy}, handleOut:p.handleOut && {x:p.handleOut.x+dx,y:p.handleOut.y+dy} }));
      if (o.name !== undefined) node.name = string(o.name,`${ctx}.name`,200);
      if (o.fill !== undefined) { if (!['rectangle','ellipse','path','line','text'].includes(node.type)) fail(`${ctx}: fill update for this node type is not supported`); node.fills = fill(node.id,color(o.fill,`${ctx}.fill`)); }
      if (o.text !== undefined || o.fontSize !== undefined) { if (node.type !== 'text' || !node.textStyle) fail(`${ctx}: not a text node`); if (o.text !== undefined) node.textContent = string(o.text,`${ctx}.text`,5000); if (o.fontSize !== undefined) { node.textStyle.fontSize = num(o.fontSize,`${ctx}.fontSize`,1,10000); node.textStyle.leading = node.textStyle.fontSize * 1.2; } doc.nodes[nodeId] = fitPointTextFrame(node); }
      continue;
    }
    if (!['rectangle','ellipse','path','text'].includes(o.op)) fail(`${ctx}: unsupported operation ${String(o.op)}`);
    keys(o, o.op === 'path' ? ['op','id','layer','name','points','closed','fill','stroke','strokeWidth'] : o.op === 'text' ? ['op','id','layer','name','x','y','text','fontSize','fontFamily','fontStyle','fill'] : ['op','id','layer','name','x','y','width','height','fill','stroke','strokeWidth'],ctx);
    const nodeId = id(o.id,`${ctx}.id`), layerId = id(o.layer,`${ctx}.layer`);
    if (own(doc.nodes,nodeId)) fail(`${ctx}: node already exists`); const layer = doc.layers.find(l => l.id === layerId); if (!layer || layer.locked) fail(`${ctx}: layer missing or locked`);
    const name = o.name === undefined ? nodeId : string(o.name,`${ctx}.name`,200); let x=0,y=0,w=0,h=0; let points: AnchorPoint[];
    if (o.op === 'path') {
      if (!Array.isArray(o.points) || o.points.length < 2 || o.points.length > 1000) fail(`${ctx}: path requires 2–1000 points`);
      points = o.points.map((p: unknown, i: number) => { const v=object(p,`${ctx}.points[${i}]`); keys(v,['x','y','handleIn','handleOut'],ctx); const handle = (v: unknown) => { const h=object(v,ctx); keys(h,['x','y'],ctx); return {x:num(h.x,ctx),y:num(h.y,ctx)}; }; return { id:`${nodeId}-p${i}`, x:num(v.x,ctx), y:num(v.y,ctx), pointType:'corner' as const, ...(v.handleIn ? {handleIn:handle(v.handleIn)} : {}), ...(v.handleOut ? {handleOut:handle(v.handleOut)} : {}) }; });
      const coords = points.flatMap(p => [p, ...(p.handleIn ? [p.handleIn] : []), ...(p.handleOut ? [p.handleOut] : [])]); x=Math.min(...coords.map(p=>p.x)); y=Math.min(...coords.map(p=>p.y)); w=Math.max(...coords.map(p=>p.x))-x; h=Math.max(...coords.map(p=>p.y))-y;
      if (o.closed !== undefined && typeof o.closed !== 'boolean') fail(`${ctx}.closed must be boolean`);
    } else { x=num(o.x,`${ctx}.x`); y=num(o.y,`${ctx}.y`); w=o.op === 'text' ? 1 : num(o.width,`${ctx}.width`,0.001,100000); h=o.op === 'text' ? 1 : num(o.height,`${ctx}.height`,0.001,100000); points = o.op === 'ellipse' ? createEllipseAnchors(x,y,w,h) : createRectangleAnchors(x,y,w,h); }
    const fillColor = o.fill === undefined ? (o.op === 'path' && o.closed === false ? null : '#000000') : color(o.fill,`${ctx}.fill`);
    const strokeColor = o.stroke === undefined ? null : color(o.stroke,`${ctx}.stroke`); const strokeWidth = o.strokeWidth === undefined ? 1 : num(o.strokeWidth,`${ctx}.strokeWidth`,0,10000);
    let node: VectorNode = { id:nodeId, name, type:o.op, layerId, visible:true, locked:false, x,y,width:w,height:h, rotation:0, points, closed:o.op === 'path' ? o.closed !== false : true, fills:fill(nodeId,fillColor), strokes:stroke(nodeId,strokeColor,strokeWidth), effects:[], opacity:1, blendMode:'normal' };
    if (o.op === 'text') { const size=num(o.fontSize,`${ctx}.fontSize`,1,10000); const family=o.fontFamily === undefined ? 'Arial, sans-serif' : string(o.fontFamily,`${ctx}.fontFamily`,200); const style=o.fontStyle ?? 'Regular'; if (!['Regular','Bold','Italic','Bold Italic'].includes(style)) fail(`${ctx}.fontStyle invalid`); node.textContent=string(o.text,`${ctx}.text`,5000); node.textStyle=textStyle(size,family,style); node=fitPointTextFrame(node); }
    doc.nodes[nodeId]=node; layer.nodeIds.push(nodeId);
  }
  doc.updatedAt = Date.now(); validateDocument(doc); return doc;
}
export function createFromSpec(input: unknown): StudioDocument { const spec=object(input,'spec'); keys(spec,['version','document','operations'],'spec'); if (spec.version !== 1) fail('spec.version must be 1'); return applyOperations(createDesign(spec.document),spec.operations); }
export function readDesign(bytes: Uint8Array): StudioDocument { const doc=unpackAdlozeBytesToDocument(bytes).document; validateDocument(doc); return doc; }
export function writeDesign(doc: StudioDocument): Uint8Array { validateDocument(doc); return packDocumentToAdlozeBytes(doc); }
export function previewDesign(doc: StudioDocument, artboardId?: string): string { validateDocument(doc); if (artboardId && !doc.artboards.some(a => a.id === artboardId)) fail('artboard not found'); return exportDocumentToSvgString(doc, { artboardId, responsive: true }); }
export function inspectDesign(doc: StudioDocument) { validateDocument(doc); return { id: doc.id, name: doc.name, unit: doc.unit, colorMode: doc.colorMode, artboards: doc.artboards, layers: doc.layers.map(l => ({ id:l.id,name:l.name,visible:l.visible,locked:l.locked,nodeIds:l.nodeIds })), nodes: Object.values(doc.nodes).map(n => ({ id:n.id,name:n.name,type:n.type,layerId:n.layerId,parentId:n.parentId,locked:n.locked,visible:n.visible,x:n.x,y:n.y,width:n.width,height:n.height,rotation:n.rotation,text:n.textContent,fill:n.fills[0]?.color })) }; }
