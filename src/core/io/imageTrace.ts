import type { AnchorPoint, VectorNode } from '../types';
import { rgbToHex } from '../math/color';

export type ImageTracePresetId =
  | 'high-fidelity-photo'
  | 'low-fidelity-photo'
  | '3-colors'
  | '6-colors'
  | '16-colors'
  | 'shades-of-gray'
  | 'bw-logo'
  | 'sketched-art'
  | 'silhouettes'
  | 'line-art'
  | 'technical-drawing';

export interface ImageTraceOptions {
  preset: ImageTracePresetId;
  mode: 'color' | 'grayscale' | 'bw';
  threshold: number; // 1 - 255
  colors: number; // 2 - 64
  paths: number; // 1 - 100 (higher = tighter fit)
  corners: number; // 0 - 100 (higher = more sharp corners)
  noise: number; // 1 - 100 (minimum region area in pixels)
  method: 'abutting' | 'overlapping';
  fills: boolean;
  strokes: boolean;
  maxStrokeWeight: number;
  ignoreWhite: boolean;
}

export const IMAGE_TRACE_PRESETS: Record<
  ImageTracePresetId,
  { label: string; options: ImageTraceOptions }
> = {
  'high-fidelity-photo': {
    label: 'High Fidelity Photo',
    options: {
      preset: 'high-fidelity-photo',
      mode: 'color',
      threshold: 128,
      colors: 32,
      paths: 85,
      corners: 75,
      noise: 4,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: false,
    },
  },
  'low-fidelity-photo': {
    label: 'Low Fidelity Photo',
    options: {
      preset: 'low-fidelity-photo',
      mode: 'color',
      threshold: 128,
      colors: 12,
      paths: 55,
      corners: 50,
      noise: 12,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: false,
    },
  },
  '3-colors': {
    label: '3 Colors',
    options: {
      preset: '3-colors',
      mode: 'color',
      threshold: 128,
      colors: 3,
      paths: 65,
      corners: 60,
      noise: 15,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: false,
    },
  },
  '6-colors': {
    label: '6 Colors',
    options: {
      preset: '6-colors',
      mode: 'color',
      threshold: 128,
      colors: 6,
      paths: 70,
      corners: 65,
      noise: 10,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: false,
    },
  },
  '16-colors': {
    label: '16 Colors',
    options: {
      preset: '16-colors',
      mode: 'color',
      threshold: 128,
      colors: 16,
      paths: 75,
      corners: 70,
      noise: 8,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: false,
    },
  },
  'shades-of-gray': {
    label: 'Shades of Gray',
    options: {
      preset: 'shades-of-gray',
      mode: 'grayscale',
      threshold: 128,
      colors: 8,
      paths: 70,
      corners: 60,
      noise: 10,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: false,
    },
  },
  'bw-logo': {
    label: 'Black and White Logo',
    options: {
      preset: 'bw-logo',
      mode: 'bw',
      threshold: 128,
      colors: 2,
      paths: 75,
      corners: 75,
      noise: 12,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: true,
    },
  },
  'sketched-art': {
    label: 'Sketched Art',
    options: {
      preset: 'sketched-art',
      mode: 'bw',
      threshold: 142,
      colors: 2,
      paths: 85,
      corners: 80,
      noise: 5,
      method: 'abutting',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: true,
    },
  },
  silhouettes: {
    label: 'Silhouettes',
    options: {
      preset: 'silhouettes',
      mode: 'bw',
      threshold: 185,
      colors: 2,
      paths: 60,
      corners: 55,
      noise: 16,
      method: 'overlapping',
      fills: true,
      strokes: false,
      maxStrokeWeight: 4,
      ignoreWhite: true,
    },
  },
  'line-art': {
    label: 'Line Art',
    options: {
      preset: 'line-art',
      mode: 'bw',
      threshold: 125,
      colors: 2,
      paths: 82,
      corners: 70,
      noise: 6,
      method: 'abutting',
      fills: false,
      strokes: true,
      maxStrokeWeight: 2,
      ignoreWhite: true,
    },
  },
  'technical-drawing': {
    label: 'Technical Drawing',
    options: {
      preset: 'technical-drawing',
      mode: 'bw',
      threshold: 135,
      colors: 2,
      paths: 92,
      corners: 95,
      noise: 4,
      method: 'abutting',
      fills: false,
      strokes: true,
      maxStrokeWeight: 1.5,
      ignoreWhite: true,
    },
  },
};

export function getImageTracePresetOptions(preset: ImageTracePresetId): ImageTraceOptions {
  return { ...(IMAGE_TRACE_PRESETS[preset]?.options ?? IMAGE_TRACE_PRESETS['bw-logo'].options) };
}

export interface ImageTraceResult {
  groupNode: VectorNode;
  pathNodes: VectorNode[];
  anchorCount: number;
  pathCount: number;
  colorCount: number;
}

/**
 * Pure bitmap-to-vector tracing pipeline over raw RGBA ImageData.
 * Performs color quantization, connected-component region extraction, Moore-Neighbor boundary tracing,
 * Ramer-Douglas-Peucker simplification, and adaptive Bezier smooth handle fitting.
 */
export function traceImageDataToVectorNodes(
  imageData: { width: number; height: number; data: Uint8ClampedArray },
  bounds: { x: number; y: number; width: number; height: number },
  layerId: string,
  partialOptions?: Partial<ImageTraceOptions>
): ImageTraceResult {
  const basePreset = partialOptions?.preset ?? 'bw-logo';
  const opts: ImageTraceOptions = {
    ...getImageTracePresetOptions(basePreset),
    ...partialOptions,
  };

  const w = Math.max(2, imageData.width);
  const h = Math.max(2, imageData.height);
  const pixels = imageData.data;

  // 1. Quantize every pixel into a palette index (-1 = transparent/ignored white)
  const { palette, indexMap } = quantizePixels(pixels, w, h, opts);

  // 2. Extract connected components & boundary contours
  const visited = new Uint8Array(w * h);
  const pathNodes: VectorNode[] = [];
  const groupId = `trace-group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const scaleX = bounds.width / w;
  const scaleY = bounds.height / h;
  const minArea = Math.max(1, Math.round(opts.noise * 0.45));
  const rdpEpsilon = Math.max(0.45, ((101 - opts.paths) / 100) * 3.2);
  const cornerCosThreshold = Math.cos(((100 - opts.corners) / 100) * (Math.PI * 0.65));

  let totalAnchors = 0;
  const usedColors = new Set<string>();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const colorIdx = indexMap[idx];
      if (colorIdx < 0 || visited[idx]) continue;

      // Flood-fill connected component to measure area and bounding box
      const queue: number[] = [idx];
      visited[idx] = 1;
      let area = 0;
      let minPx = x,
        maxPx = x,
        minPy = y,
        maxPy = y;

      while (queue.length > 0) {
        const curr = queue.pop()!;
        area++;
        const cx = curr % w;
        const cy = (curr - cx) / w;
        if (cx < minPx) minPx = cx;
        if (cx > maxPx) maxPx = cx;
        if (cy < minPy) minPy = cy;
        if (cy > maxPy) maxPy = cy;

        const neighbors = [
          cy > 0 ? curr - w : -1,
          cy < h - 1 ? curr + w : -1,
          cx > 0 ? curr - 1 : -1,
          cx < w - 1 ? curr + 1 : -1,
        ];
        for (const nIdx of neighbors) {
          if (nIdx >= 0 && !visited[nIdx] && indexMap[nIdx] === colorIdx) {
            visited[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }

      if (area < minArea) continue;

      // Trace outer boundary contour starting at (x, y)
      const rawContour = traceMooreContour(indexMap, w, h, x, y, colorIdx);
      if (rawContour.length < 3) continue;

      const simplified = simplifyRDP(rawContour, rdpEpsilon);
      if (simplified.length < 3) continue;

      const worldPts = simplified.map((p) => ({
        x: bounds.x + p.x * scaleX,
        y: bounds.y + p.y * scaleY,
      }));

      const anchors = fitSmoothBezierAnchors(worldPts, cornerCosThreshold);
      totalAnchors += anchors.length;

      const hexColor = palette[colorIdx] || '#1a1a1a';
      usedColors.add(hexColor);

      const nodeX = bounds.x + minPx * scaleX;
      const nodeY = bounds.y + minPy * scaleY;
      const nodeW = Math.max(1, (maxPx - minPx + 1) * scaleX);
      const nodeH = Math.max(1, (maxPy - minPy + 1) * scaleY);

      const pathNode: VectorNode = {
        id: `trace-path-${pathNodes.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
        name: `<Path> (${hexColor})`,
        type: 'path',
        layerId,
        parentId: groupId,
        visible: true,
        locked: false,
        x: nodeX,
        y: nodeY,
        width: nodeW,
        height: nodeH,
        rotation: 0,
        points: anchors,
        closed: true,
        fills: opts.fills
          ? [
              {
                id: `fill-${Math.random().toString(36).slice(2, 7)}`,
                visible: true,
                type: 'solid',
                color: hexColor,
                opacity: 1,
                blendMode: 'normal',
              },
            ]
          : [],
        strokes: opts.strokes
          ? [
              {
                id: `stroke-${Math.random().toString(36).slice(2, 7)}`,
                visible: true,
                color: hexColor,
                weight: opts.maxStrokeWeight || 1.5,
                cap: 'round',
                join: 'round',
                miterLimit: 4,
                align: 'center',
                dashArray: [],
                opacity: 1,
                blendMode: 'normal',
              },
            ]
          : [],
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      };

      pathNodes.push(pathNode);
    }
  }

  if (pathNodes.length === 0) {
    throw new Error('Image Trace found no visible paths. The original image was not changed.');
  }

  const groupNode: VectorNode = {
    id: groupId,
    name: `<Group> (Image Trace - ${IMAGE_TRACE_PRESETS[opts.preset]?.label || opts.preset})`,
    type: 'group',
    layerId,
    visible: true,
    locked: false,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    points: pathNodes[0].points,
    closed: true,
    fills: [],
    strokes: [],
    effects: [],
    opacity: 1,
    blendMode: 'normal',
    children: pathNodes.map((p) => p.id),
  };

  return {
    groupNode,
    pathNodes,
    anchorCount: totalAnchors,
    pathCount: pathNodes.length,
    colorCount: usedColors.size,
  };
}

/**
 * High-level async helper that loads an Image VectorNode's bitmap (or synthesizes a sample bitmap
 * when offline/data-less) and traces it into editable VectorNode paths.
 */
export async function traceImageNodeToVectorNodes(
  imageNode: VectorNode,
  partialOptions?: Partial<ImageTraceOptions>
): Promise<ImageTraceResult> {
  const sampleW = 96;
  const sampleH = 96;
  const bounds = {
    x: imageNode.x,
    y: imageNode.y,
    width: Math.max(20, imageNode.width || 240),
    height: Math.max(20, imageNode.height || 240),
  };

  let imgData: { width: number; height: number; data: Uint8ClampedArray } | null = null;

  if (typeof document !== 'undefined' && imageNode.imageUrl) {
    try {
      const img = await loadHtmlImage(imageNode.imageUrl);
      const ratio = img.width && img.height ? img.width / img.height : 1;
      const w = ratio >= 1 ? sampleW : Math.max(16, Math.round(sampleH * ratio));
      const h = ratio >= 1 ? Math.max(16, Math.round(sampleW / ratio)) : sampleH;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        const extracted = ctx.getImageData(0, 0, w, h);
        imgData = { width: w, height: h, data: extracted.data };
      }
    } catch {
      imgData = null;
    }
  }

  if (!imgData) {
    throw new Error('Image Trace could not load the selected image.');
  }

  return traceImageDataToVectorNodes(
    imgData,
    bounds,
    imageNode.layerId || 'layer-1',
    partialOptions ?? (imageNode.imageTraceParams as Partial<ImageTraceOptions> | undefined)
  );
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function createProceduralSampleBitmap(
  w: number,
  h: number
): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < w * 0.22) {
        data[idx] = 255;
        data[idx + 1] = 154;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      } else if (dist < w * 0.38) {
        data[idx] = 20;
        data[idx + 1] = 115;
        data[idx + 2] = 230;
        data[idx + 3] = 255;
      } else {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      }
    }
  }
  return { width: w, height: h, data };
}

function quantizePixels(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  opts: ImageTraceOptions
): { palette: string[]; indexMap: Int16Array } {
  const total = w * h;
  const indexMap = new Int16Array(total);

  if (opts.mode === 'bw') {
    const palette = ['#141414', '#ffffff'];
    for (let i = 0; i < total; i++) {
      const p = i * 4;
      const a = pixels[p + 3];
      if (a < 32) {
        indexMap[i] = -1;
        continue;
      }
      const lum = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
      const isBlack = lum < opts.threshold;
      if (isBlack) {
        indexMap[i] = 0;
      } else {
        indexMap[i] = opts.ignoreWhite ? -1 : 1;
      }
    }
    return { palette, indexMap };
  }

  if (opts.mode === 'grayscale') {
    const levels = Math.max(2, Math.min(32, opts.colors));
    const palette: string[] = [];
    for (let k = 0; k < levels; k++) {
      const v = Math.round((k / (levels - 1)) * 255);
      palette.push(rgbToHex({ r: v, g: v, b: v }));
    }
    for (let i = 0; i < total; i++) {
      const p = i * 4;
      if (pixels[p + 3] < 32) {
        indexMap[i] = -1;
        continue;
      }
      const lum = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
      if (opts.ignoreWhite && lum > 244) {
        indexMap[i] = -1;
        continue;
      }
      const bucket = Math.min(levels - 1, Math.floor((lum / 256) * levels));
      indexMap[i] = bucket;
    }
    return { palette, indexMap };
  }

  // Color quantization via uniform RGB bin clustering + centroid averaging
  const numColors = Math.max(2, Math.min(64, opts.colors));
  const buckets = new Map<
    number,
    { rSum: number; gSum: number; bSum: number; count: number; indices: number[] }
  >();
  const div = Math.max(1, Math.floor(256 / Math.ceil(Math.cbrt(numColors * 2))));

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    if (pixels[p + 3] < 32) {
      indexMap[i] = -1;
      continue;
    }
    const r = pixels[p];
    const g = pixels[p + 1];
    const b = pixels[p + 2];
    if (opts.ignoreWhite && r > 244 && g > 244 && b > 244) {
      indexMap[i] = -1;
      continue;
    }
    const key = (Math.floor(r / div) << 10) | (Math.floor(g / div) << 5) | Math.floor(b / div);
    let bkt = buckets.get(key);
    if (!bkt) {
      bkt = { rSum: 0, gSum: 0, bSum: 0, count: 0, indices: [] };
      buckets.set(key, bkt);
    }
    bkt.rSum += r;
    bkt.gSum += g;
    bkt.bSum += b;
    bkt.count++;
    bkt.indices.push(i);
  }

  const sortedBuckets = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const topBuckets = sortedBuckets.slice(0, numColors);
  const paletteRGB = topBuckets.map((b) => ({
    r: Math.round(b.rSum / b.count),
    g: Math.round(b.gSum / b.count),
    b: Math.round(b.bSum / b.count),
  }));
  const palette = paletteRGB.map((c) => rgbToHex(c));

  if (palette.length === 0) {
    return { palette: ['#1a1a1a'], indexMap: indexMap.fill(-1) };
  }

  topBuckets.forEach((bkt, palIdx) => {
    for (const pixIdx of bkt.indices) {
      indexMap[pixIdx] = palIdx;
    }
  });

  // Map remaining minor buckets to nearest palette centroid
  for (let k = numColors; k < sortedBuckets.length; k++) {
    const bkt = sortedBuckets[k];
    const r = bkt.rSum / bkt.count;
    const g = bkt.gSum / bkt.count;
    const b = bkt.bSum / bkt.count;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < paletteRGB.length; j++) {
      const c = paletteRGB[j];
      const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    for (const pixIdx of bkt.indices) {
      indexMap[pixIdx] = bestIdx;
    }
  }

  return { palette, indexMap };
}

function traceMooreContour(
  indexMap: Int16Array,
  w: number,
  h: number,
  startX: number,
  startY: number,
  colorIdx: number
): Array<{ x: number; y: number }> {
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
  ];

  const contour: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  let cx = startX;
  let cy = startY;
  let backtrackDir = 6; // from top
  const maxSteps = w * h * 2;

  for (let step = 0; step < maxSteps; step++) {
    let foundNext = false;
    for (let i = 0; i < 8; i++) {
      const dIdx = (backtrackDir + 1 + i) % 8;
      const nx = cx + dirs[dIdx].dx;
      const ny = cy + dirs[dIdx].dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && indexMap[ny * w + nx] === colorIdx) {
        if (nx === startX && ny === startY) {
          return contour;
        }
        contour.push({ x: nx, y: ny });
        cx = nx;
        cy = ny;
        backtrackDir = (dIdx + 4) % 8;
        foundNext = true;
        break;
      }
    }
    if (!foundNext) break;
  }

  // Fallback bounding polygon if single pixel or thin line
  if (contour.length < 3) {
    return [
      { x: startX, y: startY },
      { x: startX + 1, y: startY },
      { x: startX + 1, y: startY + 1 },
      { x: startX, y: startY + 1 },
    ];
  }
  return contour;
}

function simplifyRDP(
  pts: Array<{ x: number; y: number }>,
  epsilon: number
): Array<{ x: number; y: number }> {
  if (pts.length <= 4) return pts;

  let maxDist = 0;
  let index = 0;
  const first = pts[0];
  const last = pts[pts.length - 1];

  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], first, last);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(pts.slice(0, index + 1), epsilon);
    const right = simplifyRDP(pts.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  }
  return [first, last];
}

function perpendicularDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function fitSmoothBezierAnchors(
  pts: Array<{ x: number; y: number }>,
  cornerCosThreshold: number
): AnchorPoint[] {
  const n = pts.length;
  return pts.map((curr, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const cosAngle = (v1x * v2x + v1y * v2y) / (l1 * l2);

    const isCorner = cosAngle < cornerCosThreshold;
    if (isCorner) {
      return {
        id: `pt-${i}-${Math.random().toString(36).slice(2, 6)}`,
        x: curr.x,
        y: curr.y,
        pointType: 'corner',
      };
    }

    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tLen = Math.hypot(tx, ty) || 1;
    const ux = tx / tLen;
    const uy = ty / tLen;
    const hInLen = l1 * 0.28;
    const hOutLen = l2 * 0.28;

    return {
      id: `pt-${i}-${Math.random().toString(36).slice(2, 6)}`,
      x: curr.x,
      y: curr.y,
      pointType: 'smooth',
      handleIn: { x: curr.x - ux * hInLen, y: curr.y - uy * hInLen },
      handleOut: { x: curr.x + ux * hOutLen, y: curr.y + uy * hOutLen },
    };
  });
}
