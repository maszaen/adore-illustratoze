import type { AnchorPoint, LayerItem, StudioDocument, VectorNode } from '../types';
import { createEllipseAnchors, createRectangleAnchors } from '../math/bezier';

/** Build starter artwork with ordinary, independently editable vector nodes. */
export function populateStarterArtwork(doc: StudioDocument, kind: 'brand' | 'poster' | 'packaging' | 'icons'): StudioDocument {
  doc.nodes = {};
  doc.layers = [];
  let sequence = 0;
  const layer = (name: string, color: string): LayerItem => {
    const item: LayerItem = { id: `template-layer-${doc.layers.length}`, name, color, visible: true, locked: false, outlineMode: false, templateMode: false, expanded: true, nodeIds: [], effects: [], opacity: 1, blendMode: 'normal' };
    // Layers are listed top-to-bottom in the editor.
    doc.layers.unshift(item);
    return item;
  };
  const add = (l: LayerItem, name: string, type: VectorNode['type'], x: number, y: number, width: number, height: number, points: AnchorPoint[], fill?: string, stroke?: string, weight = 2, dashed = false): VectorNode => {
    const id = `template-node-${++sequence}`;
    const node: VectorNode = { id, name, type, layerId: l.id, visible: true, locked: false, x, y, width, height, rotation: 0, points, closed: type !== 'line', fills: fill ? [{ id: `${id}-fill`, visible: true, type: 'solid', color: fill, opacity: 1, blendMode: 'normal' }] : [], strokes: stroke ? [{ id: `${id}-stroke`, visible: true, color: stroke, weight, cap: 'round', join: 'round', miterLimit: 4, align: 'center', dashArray: dashed ? [weight * 4, weight * 3] : [], opacity: 1, blendMode: 'normal' }] : [], effects: [], opacity: 1, blendMode: 'normal' };
    doc.nodes[id] = node; l.nodeIds.push(id); return node;
  };
  const rect = (l: LayerItem, name: string, x: number, y: number, w: number, h: number, color: string) => add(l, name, 'rectangle', x, y, w, h, createRectangleAnchors(x, y, w, h), color);
  const ellipse = (l: LayerItem, name: string, x: number, y: number, w: number, h: number, fill?: string, stroke?: string, weight = 2) => add(l, name, 'ellipse', x, y, w, h, createEllipseAnchors(x, y, w, h), fill, stroke, weight);
  const path = (l: LayerItem, name: string, coords: [number, number][], fill?: string, stroke?: string, weight = 2, closed = true, dashed = false) => {
    const xs = coords.map(p => p[0]), ys = coords.map(p => p[1]);
    return add(l, name, closed ? 'path' : 'line', Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), coords.map(([x,y], i) => ({ id: `anchor-${sequence + 1}-${i}`, x, y, pointType: 'corner' })), fill, stroke, weight, dashed);
  };
  const text = (l: LayerItem, name: string, content: string, x: number, y: number, w: number, size: number, color: string, bold = false) => {
    const h = size * 1.4;
    const node = add(l, name, 'text', x, y, w, h, createRectangleAnchors(x, y, w, h), color);
    node.textContent = content;
    node.textStyle = { fontFamily: 'Arial, sans-serif', fontStyle: bold ? 'Bold' : 'Regular', fontSize: size, leading: size * 1.25, kerning: 0, tracking: 0, horizontalScale: 100, verticalScale: 100, baselineShift: 0, characterRotation: 0, textCase: 'normal', underline: false, strikethrough: false, align: 'left', indentLeft: 0, indentRight: 0, indentFirstLine: 0, spaceBefore: 0, spaceAfter: 0, hyphenation: false, typeMode: 'point', vertical: false };
  };
  const ab = doc.artboards[0], W = ab.width, H = ab.height;
  if (kind === 'brand') {
    const bg = layer('Background', '#a78bfa'); rect(bg, 'Warm paper', 0, 0, W, H, '#f5f1e8');
    const shapes = layer('Brand mark', '#f59e0b');
    ellipse(shapes, 'Emblem disc', 120, 145, 320, 320, '#203d36');
    ellipse(shapes, 'Sun', 224, 224, 112, 112, '#e9b65d');
    path(shapes, 'Hills', [[155,365],[215,300],[277,365],[330,310],[407,388],[155,388]], '#f5f1e8');
    const labels = layer('Typography & palette', '#4f9eff');
    text(labels, 'Wordmark', 'SOLSTICE', 520, 205, 580, 82, '#203d36', true);
    text(labels, 'Descriptor', 'OUTDOOR GOODS  /  BRAND SYSTEM', 525, 325, 570, 20, '#597067');
    text(labels, 'Palette label', 'CORE PALETTE', 525, 485, 260, 15, '#597067', true);
    ['#203d36','#e9b65d','#d98365','#d7dfd2'].forEach((c,i) => rect(labels, `Palette ${i+1}`, 525+i*78, 520, 62, 62, c));
    text(labels, 'Footer', 'IDENTITY STUDY     •     01 / 04', 120, 696, 700, 16, '#597067');
  } else if (kind === 'poster') {
    const bg = layer('Background', '#819cf5'); rect(bg, 'Midnight background', 0, 0, W, H, '#101b38');
    const art = layer('Isometric forms', '#e879f9');
    ellipse(art, 'Sun', 500, 180, 310, 310, '#ffcb70');
    path(art, 'Cube top', [[250,590],[490,452],[730,590],[490,728]], '#8fe2d8');
    path(art, 'Cube left', [[250,590],[490,728],[490,955],[250,817]], '#4c86b8');
    path(art, 'Cube right', [[490,728],[730,590],[730,817],[490,955]], '#db769e');
    path(art, 'Small block top', [[620,420],[720,362],[820,420],[720,478]], '#f6b7a8');
    path(art, 'Small block left', [[620,420],[720,478],[720,570],[620,512]], '#d76b83');
    path(art, 'Small block right', [[720,478],[820,420],[820,512],[720,570]], '#965b93');
    const words = layer('Typography', '#ffb86c');
    text(words, 'Heading', 'FORM / SPACE', 95, 75, 800, 64, '#f7f3e8', true);
    text(words, 'Subtitle', 'A STUDY IN COLOUR AND DIMENSION', 100, 165, 800, 18, '#aabbd4');
    text(words, 'Footer', 'VECTOR STUDIES     •     VOL. 01', 100, 1080, 700, 20, '#aabbd4');
  } else if (kind === 'packaging') {
    const bg = layer('Paper', '#9ca3af'); rect(bg, 'Paper', 0, 0, W, H, '#faf8f2');
    const print = layer('Artwork', '#86bda7');
    const x = W * .20, y = H * .32, panel = W * .15, tall = H * .38;
    rect(print, 'Front panel color', x + panel, y, panel, tall, '#dce9df');
    text(print, 'Front label', 'GROVE', x + panel + 16, y + tall*.28, panel-22, 21, '#294c3e', true);
    text(print, 'Product label', 'BOTANICAL', x + panel + 16, y + tall*.48, panel-22, 10, '#527366');
    ellipse(print, 'Emblem', x + panel + 35, y + tall*.62, 45, 45, '#7eaa8e');
    const lines = layer('Dieline & fold guides', '#e45898');
    // The sample is an editable guide, not a manufacturing-certified dieline.
    const cut = '#d12a77', fold = '#3b82b9';
    path(lines, 'Cut outline', [[x,y],[x+panel,y],[x+panel,y-58],[x+panel*2,y-58],[x+panel*2,y],[x+panel*4,y],[x+panel*4,y+tall],[x+panel*2,y+tall],[x+panel*2,y+tall+58],[x+panel,y+tall+58],[x+panel,y+tall],[x,y+tall]], undefined, cut, 2);
    [1,2,3].forEach(i => path(lines, `Fold ${i}`, [[x+panel*i,y],[x+panel*i,y+tall]], undefined, fold, 1.5, false, true));
    path(lines, 'Top fold', [[x+panel,y],[x+panel*2,y]], undefined, fold, 1.5, false, true);
    path(lines, 'Bottom fold', [[x+panel,y+tall],[x+panel*2,y+tall]], undefined, fold, 1.5, false, true);
    text(lines, 'Guide title', 'PACKAGING / BOX STUDY', W*.08, H*.09, W*.8, 24, '#294c3e', true);
    text(lines, 'Guide legend', 'PINK: CUT   •   BLUE: FOLD   •   VERIFY BEFORE PRINT', W*.08, H*.17, W*.85, 11, '#64766e');
  } else {
    const art = layer('Icons', '#4f9eff');
    const ink = '#254766', accent = '#59b9a3';
    doc.artboards.forEach((board, i) => {
      const x = board.x, y = board.y;
      board.name = ['Home', 'Search', 'Star', 'Profile'][i];
      rect(art, `${board.name} tile`, x+56, y+56, 400, 400, '#e9f4f1');
      if (i === 0) {
        path(art, 'Roof', [[x+130,y+248],[x+256,y+140],[x+382,y+248]], undefined, ink, 24, false);
        path(art, 'House', [[x+164,y+240],[x+164,y+352],[x+348,y+352],[x+348,y+240]], undefined, ink, 24, false);
        rect(art, 'Door', x+231, y+280, 50, 72, accent);
      } else if (i === 1) {
        ellipse(art, 'Search lens', x+145, y+140, 175, 175, undefined, ink, 24);
        path(art, 'Search handle', [[x+300,y+300],[x+374,y+374]], undefined, ink, 24, false);
      } else if (i === 2) {
        const pts: [number,number][] = Array.from({length:10}, (_,n) => { const r=n%2 ? 64 : 135, a=-Math.PI/2+n*Math.PI/5; return [x+256+Math.cos(a)*r,y+250+Math.sin(a)*r]; });
        path(art, 'Star', pts, accent, ink, 12);
      } else {
        ellipse(art, 'Head', x+209, y+137, 94, 94, accent, ink, 12);
        ellipse(art, 'Profile body', x+155, y+260, 202, 112, undefined, ink, 20);
      }
    });
  }
  doc.activeLayerId = doc.layers[0].id;
  return doc;
}
