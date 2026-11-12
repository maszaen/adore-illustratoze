import { populateStarterArtwork } from './starterArtwork';
import type {
  ArtboardItem,
  BrushItem,
  ColorMode,
  GraphicStyleItem,
  LayerItem,
  PatternItem,
  StudioDocument,
  SwatchItem,
  SymbolItem,
  UnitType,
  VectorNode,
} from '../types';
import {
  createEllipseAnchors,
  createPolygonAnchors,
  createRectangleAnchors,
  createStarAnchors,
} from '../math/bezier';
import { toPoints } from '../math/units';

export interface DocumentPresetItem {
  id: string;
  name: string;
  category: 'saved' | 'mobile' | 'web' | 'print' | 'film' | 'art';
  width: number;
  height: number;
  unit: UnitType;
  colorMode: ColorMode;
  ppi: 72 | 150 | 300;
  artboards: number;
  bleed: number;
  description: string;
}

export interface StarterTemplateItem {
  id: string;
  name: string;
  category: string;
  description: string;
  dimensionsLabel: string;
  colorMode: ColorMode;
  previewAccent: string;
  buildDocument: () => StudioDocument;
}

export const DOCUMENT_PRESETS: DocumentPresetItem[] = [
  // Web
  {
    id: 'web-large',
    name: 'Web Large (1920 × 1080)',
    category: 'web',
    width: 1920,
    height: 1080,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'Full HD Desktop & Presentation Canvas',
  },
  {
    id: 'web-medium',
    name: 'Web Medium (1440 × 900)',
    category: 'web',
    width: 1440,
    height: 900,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'Standard Laptop & SaaS UI Layout',
  },
  {
    id: 'web-min',
    name: 'Web Minimum (1024 × 768)',
    category: 'web',
    width: 1024,
    height: 768,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'Compact Web & Tablet Landscape',
  },
  // Mobile
  {
    id: 'mobile-iphone-pro',
    name: 'iPhone 16 Pro',
    category: 'mobile',
    width: 393,
    height: 852,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'iOS Retina Vector Viewport',
  },
  {
    id: 'mobile-android',
    name: 'Android 1080p',
    category: 'mobile',
    width: 360,
    height: 800,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'Material Design Mobile Screen',
  },
  {
    id: 'mobile-ipad-pro',
    name: 'iPad Pro 12.9"',
    category: 'mobile',
    width: 1024,
    height: 1366,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'Tablet Illustration & UI Canvas',
  },
  // Print
  {
    id: 'print-a4',
    name: 'A4 (210 × 297 mm)',
    category: 'print',
    width: 210,
    height: 297,
    unit: 'mm',
    colorMode: 'CMYK',
    ppi: 300,
    artboards: 1,
    bleed: 3,
    description: 'ISO Standard Print Sheet with 3mm Bleed',
  },
  {
    id: 'print-letter',
    name: 'Letter (8.5 × 11 in)',
    category: 'print',
    width: 8.5,
    height: 11,
    unit: 'in',
    colorMode: 'CMYK',
    ppi: 300,
    artboards: 1,
    bleed: 0.125,
    description: 'US Standard Print Document',
  },
  {
    id: 'print-a3',
    name: 'A3 Poster (297 × 420 mm)',
    category: 'print',
    width: 297,
    height: 420,
    unit: 'mm',
    colorMode: 'CMYK',
    ppi: 300,
    artboards: 1,
    bleed: 3,
    description: 'Large Format Print Poster',
  },
  {
    id: 'print-bcard',
    name: 'Business Card (85 × 55 mm)',
    category: 'print',
    width: 85,
    height: 55,
    unit: 'mm',
    colorMode: 'CMYK',
    ppi: 300,
    artboards: 2,
    bleed: 3,
    description: 'Front & Back Print Business Card',
  },
  // Film & Video
  {
    id: 'film-1080p',
    name: 'HDTV 1080p (1920 × 1080)',
    category: 'film',
    width: 1920,
    height: 1080,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'Broadcast HD with Video Safe Areas',
  },
  {
    id: 'film-4k',
    name: '4K UHD (3840 × 2160)',
    category: 'film',
    width: 3840,
    height: 2160,
    unit: 'px',
    colorMode: 'RGB',
    ppi: 72,
    artboards: 1,
    bleed: 0,
    description: 'Ultra HD Motion Graphics Storyboard',
  },
  // Art & Illustration
  {
    id: 'art-square',
    name: 'Square Illustration (1000 × 1000 pt)',
    category: 'art',
    width: 1000,
    height: 1000,
    unit: 'pt',
    colorMode: 'RGB',
    ppi: 300,
    artboards: 1,
    bleed: 0,
    description: 'High Precision Logo & Emblem Studio',
  },
  {
    id: 'art-poster',
    name: 'Art Poster (18 × 24 in)',
    category: 'art',
    width: 18,
    height: 24,
    unit: 'in',
    colorMode: 'CMYK',
    ppi: 300,
    artboards: 1,
    bleed: 0.125,
    description: 'Gallery Exhibition Print Poster',
  },
  {
    id: 'art-postcard',
    name: 'Postcard (148 × 105 mm)',
    category: 'art',
    width: 148,
    height: 105,
    unit: 'mm',
    colorMode: 'CMYK',
    ppi: 300,
    artboards: 1,
    bleed: 3,
    description: 'A6 Illustrated Postcard',
  },
];

export const DEFAULT_PATTERNS: PatternItem[] = [
  {
    id: 'pat-polka-dots',
    name: 'Polka Dots Grid',
    tileType: 'grid',
    brickOffset: 0.5,
    width: 24,
    height: 24,
    hSpacing: 0,
    vSpacing: 0,
    dimCopies: 50,
    elements: [
      { type: 'circle', x: 12, y: 12, w: 8, h: 8, fill: '#ff9a00', stroke: 'none' },
    ],
  },
  {
    id: 'pat-blueprint-grid',
    name: 'Blueprint Crosshatch',
    tileType: 'grid',
    brickOffset: 0.5,
    width: 20,
    height: 20,
    hSpacing: 0,
    vSpacing: 0,
    dimCopies: 50,
    elements: [
      { type: 'line', d: 'M 0 0 L 20 0 M 0 0 L 0 20', x: 0, y: 0, w: 20, h: 20, fill: 'none', stroke: '#1473e6' },
    ],
  },
  {
    id: 'pat-diagonal-stripes',
    name: 'Diagonal Hazard Stripes',
    tileType: 'grid',
    brickOffset: 0.5,
    width: 16,
    height: 16,
    hSpacing: 0,
    vSpacing: 0,
    dimCopies: 50,
    elements: [
      { type: 'path', d: 'M 0 16 L 16 0', x: 0, y: 0, w: 16, h: 16, fill: 'none', stroke: '#f59e0b' },
    ],
  },
  {
    id: 'pat-honeycomb-hex',
    name: 'Honeycomb Hexagons',
    tileType: 'hex-row',
    brickOffset: 0.5,
    width: 28,
    height: 28,
    hSpacing: 2,
    vSpacing: 2,
    dimCopies: 50,
    elements: [
      {
        type: 'path',
        d: 'M 14 2 L 25 8 L 25 20 L 14 26 L 3 20 L 3 8 Z',
        x: 0,
        y: 0,
        w: 28,
        h: 28,
        fill: 'none',
        stroke: '#10b981',
      },
    ],
  },
];

export const DEFAULT_SWATCHES: SwatchItem[] = [
  // Basic Solids
  { id: 'sw-white', name: 'White', type: 'solid', color: '#ffffff', isGlobal: false, isSpot: false, tint: 100, groupName: 'Default RGB' },
  { id: 'sw-black', name: 'Black', type: 'solid', color: '#000000', isGlobal: false, isSpot: false, tint: 100, groupName: 'Default RGB' },
  { id: 'sw-red', name: 'CMYK Red', type: 'solid', color: '#ed1c24', isGlobal: false, isSpot: false, tint: 100, groupName: 'Default RGB' },
  { id: 'sw-orange', name: 'Illustrator Orange', type: 'solid', color: '#ff9a00', isGlobal: true, isSpot: false, tint: 100, groupName: 'Brand Global' },
  { id: 'sw-yellow', name: 'CMYK Yellow', type: 'solid', color: '#fff200', isGlobal: false, isSpot: false, tint: 100, groupName: 'Default RGB' },
  { id: 'sw-emerald', name: 'Emerald Green', type: 'solid', color: '#00a651', isGlobal: false, isSpot: false, tint: 100, groupName: 'Default RGB' },
  { id: 'sw-cyan', name: 'CMYK Cyan', type: 'solid', color: '#00aeef', isGlobal: false, isSpot: false, tint: 100, groupName: 'Default RGB' },
  { id: 'sw-spectrum-blue', name: 'Spectrum Blue', type: 'solid', color: '#1473e6', isGlobal: true, isSpot: false, tint: 100, groupName: 'Brand Global' },
  { id: 'sw-indigo', name: 'Royal Indigo', type: 'solid', color: '#6366f1', isGlobal: true, isSpot: false, tint: 100, groupName: 'Brand Global' },
  { id: 'sw-magenta', name: 'CMYK Magenta', type: 'solid', color: '#ec008c', isGlobal: false, isSpot: false, tint: 100, groupName: 'Default RGB' },
  { id: 'sw-coral', name: 'Coral Global', type: 'solid', color: '#f43f5e', isGlobal: true, isSpot: false, tint: 100, groupName: 'Brand Global' },
  { id: 'sw-pantone-gold', name: 'PANTONE 1235 C', type: 'solid', color: '#ffb81c', isGlobal: true, isSpot: true, tint: 100, groupName: 'Spot Colors' },
  { id: 'sw-slate-dark', name: 'Charcoal 80%', type: 'solid', color: '#334155', isGlobal: false, isSpot: false, tint: 100, groupName: 'Grays' },
  { id: 'sw-slate-mid', name: 'Neutral Gray 50%', type: 'solid', color: '#64748b', isGlobal: false, isSpot: false, tint: 100, groupName: 'Grays' },
  { id: 'sw-slate-light', name: 'Silver 20%', type: 'solid', color: '#cbd5e1', isGlobal: false, isSpot: false, tint: 100, groupName: 'Grays' },
  // Gradients
  {
    id: 'sw-grad-sunset',
    name: 'Sunset Horizon',
    type: 'gradient',
    color: '#ff9a00',
    isGlobal: false,
    isSpot: false,
    tint: 100,
    groupName: 'Gradients',
    gradient: {
      id: 'grad-sunset',
      name: 'Sunset Horizon',
      type: 'linear',
      angle: 45,
      aspectRatio: 1,
      stops: [
        { id: 's1', offset: 0, color: '#ff512f', opacity: 1, midpoint: 0.5 },
        { id: 's2', offset: 0.5, color: '#f09819', opacity: 1, midpoint: 0.5 },
        { id: 's3', offset: 1, color: '#dd2476', opacity: 1, midpoint: 0.5 },
      ],
    },
  },
  {
    id: 'sw-grad-cyber',
    name: 'Cyber Neon Radial',
    type: 'gradient',
    color: '#00d9ff',
    isGlobal: false,
    isSpot: false,
    tint: 100,
    groupName: 'Gradients',
    gradient: {
      id: 'grad-cyber',
      name: 'Cyber Neon Radial',
      type: 'radial',
      angle: 0,
      aspectRatio: 1,
      stops: [
        { id: 's1', offset: 0, color: '#00f2fe', opacity: 1, midpoint: 0.5 },
        { id: 's2', offset: 0.6, color: '#4facfe', opacity: 1, midpoint: 0.5 },
        { id: 's3', offset: 1, color: '#1e1b4b', opacity: 1, midpoint: 0.5 },
      ],
    },
  },
  {
    id: 'sw-grad-gold',
    name: 'Gold Foil Metallic',
    type: 'gradient',
    color: '#fbbf24',
    isGlobal: false,
    isSpot: false,
    tint: 100,
    groupName: 'Gradients',
    gradient: {
      id: 'grad-gold',
      name: 'Gold Foil Metallic',
      type: 'linear',
      angle: 135,
      aspectRatio: 1,
      stops: [
        { id: 's1', offset: 0, color: '#fef08a', opacity: 1, midpoint: 0.5 },
        { id: 's2', offset: 0.45, color: '#d97706', opacity: 1, midpoint: 0.5 },
        { id: 's3', offset: 0.75, color: '#fde047', opacity: 1, midpoint: 0.5 },
        { id: 's4', offset: 1, color: '#92400e', opacity: 1, midpoint: 0.5 },
      ],
    },
  },
  // Patterns
  {
    id: 'sw-pat-dots',
    name: 'Polka Dots Pattern',
    type: 'pattern',
    color: '#ff9a00',
    isGlobal: false,
    isSpot: false,
    tint: 100,
    patternId: 'pat-polka-dots',
    groupName: 'Patterns',
  },
  {
    id: 'sw-pat-blueprint',
    name: 'Blueprint Crosshatch',
    type: 'pattern',
    color: '#1473e6',
    isGlobal: false,
    isSpot: false,
    tint: 100,
    patternId: 'pat-blueprint-grid',
    groupName: 'Patterns',
  },
];

export const DEFAULT_BRUSHES: BrushItem[] = [
  {
    id: 'brush-callig-flat',
    name: '5 pt Flat Calligraphic',
    type: 'calligraphic',
    angle: 45,
    roundness: 20,
    size: 5,
    colorization: 'tints',
  },
  {
    id: 'brush-callig-italic',
    name: '12 pt Italic Nib',
    type: 'calligraphic',
    angle: 35,
    roundness: 30,
    size: 12,
    colorization: 'tints',
  },
  {
    id: 'brush-callig-round',
    name: '3 pt Fine Round Pen',
    type: 'calligraphic',
    angle: 0,
    roundness: 100,
    size: 3,
    colorization: 'tints',
  },
  {
    id: 'brush-art-charcoal',
    name: 'Charcoal Tapered Feather',
    type: 'art',
    angle: 0,
    roundness: 60,
    size: 8,
    colorization: 'tints',
    svgPath: 'M 0 4 Q 50 0 100 4 Q 50 8 0 4 Z',
  },
  {
    id: 'brush-art-marker',
    name: 'Chisel Tip Marker',
    type: 'art',
    angle: 15,
    roundness: 45,
    size: 14,
    colorization: 'hue-shift',
    svgPath: 'M 4 0 L 100 0 L 96 10 L 0 10 Z',
  },
  {
    id: 'brush-scatter-stars',
    name: 'Starburst Scatter',
    type: 'scatter',
    angle: 0,
    roundness: 100,
    size: 12,
    spacing: 22,
    scatter: 18,
    colorization: 'hue-shift',
  },
  {
    id: 'brush-scatter-confetti',
    name: 'Geometric Confetti',
    type: 'scatter',
    angle: 45,
    roundness: 80,
    size: 10,
    spacing: 16,
    scatter: 25,
    colorization: 'none',
  },
  {
    id: 'brush-pattern-chain',
    name: 'Chain Link Border',
    type: 'pattern',
    angle: 0,
    roundness: 100,
    size: 10,
    spacing: 12,
    colorization: 'tints',
  },
  {
    id: 'brush-pattern-rope',
    name: 'Twisted Nautical Rope',
    type: 'pattern',
    angle: 0,
    roundness: 100,
    size: 8,
    spacing: 8,
    colorization: 'tints',
  },
];

export const DEFAULT_GRAPHIC_STYLES: GraphicStyleItem[] = [
  {
    id: 'gs-neon-glow',
    name: 'Neon Cyber Glow',
    opacity: 1,
    blendMode: 'normal',
    fills: [
      { id: 'f1', visible: true, type: 'solid', color: '#0f172a', opacity: 1, blendMode: 'normal' },
    ],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#00f2fe',
        weight: 3,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 1,
        blendMode: 'screen',
      },
    ],
    effects: [
      {
        id: 'fx-glow',
        type: 'outer-glow',
        name: 'Outer Glow',
        enabled: true,
        params: { color: '#00f2fe', blur: 14, opacity: 0.9 },
      },
    ],
  },
  {
    id: 'gs-retro-3d',
    name: 'Retro 3D Extrude',
    opacity: 1,
    blendMode: 'normal',
    fills: [
      { id: 'f1', visible: true, type: 'solid', color: '#ff9a00', opacity: 1, blendMode: 'normal' },
    ],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#1e1b4b',
        weight: 2.5,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 1,
        blendMode: 'normal',
      },
    ],
    effects: [
      {
        id: 'fx-3d',
        type: 'extrude-3d',
        name: '3D Extrude & Bevel',
        enabled: true,
        params: { depth: 14, angleX: -18, angleY: 24, angleZ: 0, color: '#7c2d12' },
      },
    ],
  },
  {
    id: 'gs-road-double',
    name: 'Highway Double Stroke',
    opacity: 1,
    blendMode: 'normal',
    fills: [
      { id: 'f1', visible: true, type: 'none', color: 'none', opacity: 1, blendMode: 'normal' },
    ],
    strokes: [
      {
        id: 's-base',
        visible: true,
        color: '#334155',
        weight: 16,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 1,
        blendMode: 'normal',
      },
      {
        id: 's-center',
        visible: true,
        color: '#fbbf24',
        weight: 2,
        cap: 'butt',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [10, 8],
        opacity: 1,
        blendMode: 'normal',
      },
    ],
    effects: [],
  },
  {
    id: 'gs-sticker-outline',
    name: 'Sticker Die-Cut Outline',
    opacity: 1,
    blendMode: 'normal',
    fills: [
      { id: 'f1', visible: true, type: 'solid', color: '#f43f5e', opacity: 1, blendMode: 'normal' },
    ],
    strokes: [
      {
        id: 's-outer',
        visible: true,
        color: '#ffffff',
        weight: 8,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'outside',
        dashArray: [],
        opacity: 1,
        blendMode: 'normal',
      },
    ],
    effects: [
      {
        id: 'fx-sh',
        type: 'drop-shadow',
        name: 'Drop Shadow',
        enabled: true,
        params: { dx: 0, dy: 5, blur: 10, color: '#000000', opacity: 0.45 },
      },
    ],
  },
  {
    id: 'gs-scribble-sketch',
    name: 'Halftone Scribble Sketch',
    opacity: 1,
    blendMode: 'normal',
    fills: [
      { id: 'f1', visible: true, type: 'solid', color: '#6366f1', opacity: 0.9, blendMode: 'normal' },
    ],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#1e1b4b',
        weight: 2,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 1,
        blendMode: 'normal',
      },
    ],
    effects: [
      {
        id: 'fx-scr',
        type: 'scribble',
        name: 'Scribble',
        enabled: true,
        params: { angle: 45, spacing: 5, variation: 3 },
      },
    ],
  },
  {
    id: 'gs-gold-emblem',
    name: 'Gold Foil Seal',
    opacity: 1,
    blendMode: 'normal',
    fills: [
      {
        id: 'f1',
        visible: true,
        type: 'gradient',
        color: '#fbbf24',
        opacity: 1,
        blendMode: 'normal',
        gradient: DEFAULT_SWATCHES.find((s) => s.id === 'sw-grad-gold')?.gradient,
      },
    ],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#fef08a',
        weight: 2,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'inside',
        dashArray: [],
        opacity: 1,
        blendMode: 'normal',
      },
    ],
    effects: [
      {
        id: 'fx-sh',
        type: 'drop-shadow',
        name: 'Drop Shadow',
        enabled: true,
        params: { dx: 2, dy: 4, blur: 8, color: '#000000', opacity: 0.5 },
      },
    ],
  },
];

export const DEFAULT_SYMBOLS: SymbolItem[] = [
  {
    id: 'sym-crown',
    name: 'Royal Crown',
    isDynamic: true,
    previewColor: '#ff9a00',
    paths: [
      {
        d: 'M 6 38 L 10 14 L 22 26 L 32 10 L 42 26 L 54 14 L 58 38 Z M 8 44 L 56 44 L 56 50 L 8 50 Z',
        fill: '#ff9a00',
        stroke: '#1e1b4b',
      },
    ],
  },
  {
    id: 'sym-sparkle',
    name: '4-Point Sparkle Star',
    isDynamic: true,
    previewColor: '#00f2fe',
    paths: [
      {
        d: 'M 32 2 C 34 22 42 30 62 32 C 42 34 34 42 32 62 C 30 42 22 34 2 32 C 22 30 30 22 32 2 Z',
        fill: '#00f2fe',
        stroke: '#0284c7',
      },
    ],
  },
  {
    id: 'sym-heart',
    name: 'Vector Heart Badge',
    isDynamic: true,
    previewColor: '#f43f5e',
    paths: [
      {
        d: 'M 32 56 C 32 56 8 40 8 22 C 8 12 16 6 24 6 C 29 6 32 10 32 12 C 32 10 35 6 40 6 C 48 6 56 12 56 22 C 56 40 32 56 32 56 Z',
        fill: '#f43f5e',
        stroke: '#881337',
      },
    ],
  },
  {
    id: 'sym-bolt',
    name: 'Lightning Bolt',
    isDynamic: true,
    previewColor: '#fbbf24',
    paths: [
      {
        d: 'M 36 4 L 12 34 L 30 34 L 26 60 L 52 28 L 34 28 Z',
        fill: '#fbbf24',
        stroke: '#92400e',
      },
    ],
  },
  {
    id: 'sym-shield',
    name: 'Security Shield',
    isDynamic: true,
    previewColor: '#1473e6',
    paths: [
      {
        d: 'M 32 4 L 56 14 L 56 32 C 56 46 45 56 32 60 C 19 56 8 46 8 32 L 8 14 Z',
        fill: '#1473e6',
        stroke: '#1e3a8a',
      },
    ],
  },
  {
    id: 'sym-leaf',
    name: 'Botanical Leaf',
    isDynamic: true,
    previewColor: '#10b981',
    paths: [
      {
        d: 'M 54 10 C 54 38 38 54 10 54 C 10 26 26 10 54 10 Z M 12 52 L 46 18',
        fill: '#10b981',
        stroke: '#064e3b',
      },
    ],
  },
  {
    id: 'sym-hex-node',
    name: 'Isometric Hex Cube',
    isDynamic: true,
    previewColor: '#6366f1',
    paths: [
      {
        d: 'M 32 4 L 58 18 L 58 46 L 32 60 L 6 46 L 6 18 Z',
        fill: '#6366f1',
        stroke: '#312e81',
      },
    ],
  },
  {
    id: 'sym-pin',
    name: 'Map Location Pin',
    isDynamic: true,
    previewColor: '#ec4899',
    paths: [
      {
        d: 'M 32 4 C 18 4 10 14 10 26 C 10 42 32 60 32 60 C 32 60 54 42 54 26 C 54 14 46 4 32 4 Z',
        fill: '#ec4899',
        stroke: '#831843',
      },
    ],
  },
];

/**
 * Helper to create a complete StudioDocument with starter vector artwork on Artboard 1.
 */
export function createDefaultDocument(options?: {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  unit?: UnitType;
  colorMode?: ColorMode;
  rasterPPI?: 72 | 150 | 300;
  artboardCount?: number;
  bleed?: number;
  includeSampleArtwork?: boolean;
}): StudioDocument {
  const unit: UnitType = options?.unit ?? 'px';
  const rawW = options?.width ?? 1200;
  const rawH = options?.height ?? 800;
  const wPt = Math.round(toPoints(rawW, unit));
  const hPt = Math.round(toPoints(rawH, unit));
  const bleedPt = toPoints(options?.bleed ?? 0, unit);
  const count = Math.max(1, options?.artboardCount ?? 1);

  const artboards: ArtboardItem[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    artboards.push({
      id: `ab-${i + 1}`,
      name: `Artboard ${i + 1}`,
      x: col * (wPt + 120),
      y: row * (hPt + 120),
      width: wPt,
      height: hPt,
      orientation: wPt >= hPt ? 'landscape' : 'portrait',
      showCenterMark: false,
      showCrossHairs: false,
      showVideoSafeAreas: false,
      backgroundColor: '#ffffff',
    });
  }

  const layer1Id = 'layer-artwork';
  const layer2Id = 'layer-construction';

  const nodes: Record<string, VectorNode> = {};
  const layer1NodeIds: string[] = [];
  const layer2NodeIds: string[] = [];

  if (options?.includeSampleArtwork !== false) {
    const cx = Math.round(wPt / 2);
    const cy = Math.round(hPt / 2);

    // 1. Background Emblem Shield Hexagon
    const hexId = 'node-hero-hex';
    const hexW = 280;
    const hexH = 280;
    nodes[hexId] = {
      id: hexId,
      name: 'Hexagon Emblem Base',
      type: 'polygon',
      layerId: layer1Id,
      visible: true,
      locked: false,
      x: cx - hexW / 2,
      y: cy - hexH / 2,
      width: hexW,
      height: hexH,
      rotation: 0,
      sides: 6,
      cornerRadius: 18,
      cornerType: 'round',
      points: createPolygonAnchors(cx - hexW / 2, cy - hexH / 2, hexW, hexH, 6, 18),
      closed: true,
      opacity: 1,
      blendMode: 'normal',
      fills: [
        {
          id: 'fill-hex',
          visible: true,
          type: 'gradient',
          color: '#ff9a00',
          opacity: 1,
          blendMode: 'normal',
          gradient: DEFAULT_SWATCHES.find((s) => s.id === 'sw-grad-sunset')?.gradient,
        },
      ],
      strokes: [
        {
          id: 'stroke-hex',
          visible: true,
          color: '#1e1b4b',
          weight: 4,
          cap: 'round',
          join: 'round',
          miterLimit: 4,
          align: 'center',
          dashArray: [],
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      effects: [
        {
          id: 'fx-hex-shadow',
          type: 'drop-shadow',
          name: 'Drop Shadow',
          enabled: true,
          params: { dx: 0, dy: 10, blur: 18, color: '#000000', opacity: 0.35 },
        },
      ],
    };
    layer1NodeIds.push(hexId);

    // 2. Inner Golden Ratio Ring
    const ringId = 'node-inner-ring';
    const ringSize = 186;
    nodes[ringId] = {
      id: ringId,
      name: 'Precision Orbit Ring',
      type: 'ellipse',
      layerId: layer1Id,
      visible: true,
      locked: false,
      x: cx - ringSize / 2,
      y: cy - ringSize / 2,
      width: ringSize,
      height: ringSize,
      rotation: 0,
      points: createEllipseAnchors(cx - ringSize / 2, cy - ringSize / 2, ringSize, ringSize),
      closed: true,
      opacity: 0.95,
      blendMode: 'normal',
      fills: [
        {
          id: 'fill-ring',
          visible: true,
          type: 'solid',
          color: '#0f172a',
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      strokes: [
        {
          id: 'stroke-ring',
          visible: true,
          color: '#ff9a00',
          globalSwatchId: 'sw-orange',
          tint: 100,
          weight: 3,
          cap: 'round',
          join: 'round',
          miterLimit: 4,
          align: 'center',
          dashArray: [],
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      effects: [],
    };
    layer1NodeIds.push(ringId);

    // 3. Center Vector Star Crest
    const starId = 'node-center-star';
    const starSize = 116;
    nodes[starId] = {
      id: starId,
      name: 'Illustratoze Star Crest',
      type: 'star',
      layerId: layer1Id,
      visible: true,
      locked: false,
      x: cx - starSize / 2,
      y: cy - starSize / 2,
      width: starSize,
      height: starSize,
      rotation: 0,
      sides: 5,
      innerRadius: 0.44,
      points: createStarAnchors(cx - starSize / 2, cy - starSize / 2, starSize, starSize, 5, 0.44),
      closed: true,
      opacity: 1,
      blendMode: 'normal',
      fills: [
        {
          id: 'fill-star',
          visible: true,
          type: 'solid',
          color: '#ff9a00',
          globalSwatchId: 'sw-orange',
          tint: 100,
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      strokes: [
        {
          id: 'stroke-star',
          visible: true,
          color: '#ffffff',
          weight: 2,
          cap: 'round',
          join: 'round',
          miterLimit: 4,
          align: 'center',
          dashArray: [],
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      effects: [],
    };
    layer1NodeIds.push(starId);

    // 4. Studio Title Text Node
    const titleId = 'node-studio-title';
    nodes[titleId] = {
      id: titleId,
      name: 'ADORE ILLUSTRATOZE',
      type: 'text',
      layerId: layer1Id,
      visible: true,
      locked: false,
      x: cx - 170,
      y: cy + 165,
      width: 340,
      height: 40,
      rotation: 0,
      points: createRectangleAnchors(cx - 170, cy + 165, 340, 40),
      closed: true,
      opacity: 1,
      blendMode: 'normal',
      textContent: 'ADORE ILLUSTRATOZE',
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontStyle: 'Bold',
        fontSize: 26,
        leading: 32,
        kerning: 0,
        tracking: 120,
        horizontalScale: 100,
        verticalScale: 100,
        baselineShift: 0,
        characterRotation: 0,
        textCase: 'uppercase',
        underline: false,
        strikethrough: false,
        align: 'center',
        indentLeft: 0,
        indentRight: 0,
        indentFirstLine: 0,
        spaceBefore: 0,
        spaceAfter: 0,
        hyphenation: false,
        typeMode: 'point',
        vertical: false,
      },
      fills: [
        {
          id: 'fill-title',
          visible: true,
          type: 'solid',
          color: '#0f172a',
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      strokes: [],
      effects: [],
    };
    layer1NodeIds.push(titleId);

    // 5. Construction Grid Circle on Layer 2
    const gridCircleId = 'node-construction-circle';
    const gcSize = 350;
    nodes[gridCircleId] = {
      id: gridCircleId,
      name: 'Golden Ratio Construction Circle',
      type: 'ellipse',
      layerId: layer2Id,
      visible: true,
      locked: false,
      x: cx - gcSize / 2,
      y: cy - gcSize / 2,
      width: gcSize,
      height: gcSize,
      rotation: 0,
      points: createEllipseAnchors(cx - gcSize / 2, cy - gcSize / 2, gcSize, gcSize),
      closed: true,
      opacity: 0.55,
      blendMode: 'normal',
      fills: [],
      strokes: [
        {
          id: 'stroke-gc',
          visible: true,
          color: '#1473e6',
          weight: 1,
          cap: 'butt',
          join: 'miter',
          miterLimit: 4,
          align: 'center',
          dashArray: [6, 4],
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      effects: [],
    };
    layer2NodeIds.push(gridCircleId);
  }

  const layers: LayerItem[] = [
    {
      id: layer1Id,
      name: 'Layer 1 - Vector Artwork',
      color: '#4f9eff',
      visible: true,
      locked: false,
      outlineMode: false,
      templateMode: false,
      expanded: true,
      nodeIds: layer1NodeIds,
      effects: [],
      opacity: 1,
      blendMode: 'normal',
    },
    {
      id: layer2Id,
      name: 'Layer 2 - Construction Grid',
      color: '#ff4fcf',
      visible: true,
      locked: false,
      outlineMode: false,
      templateMode: false,
      expanded: true,
      nodeIds: layer2NodeIds,
      effects: [],
      opacity: 1,
      blendMode: 'normal',
    },
  ];

  return {
    id: options?.id ?? `doc-${Date.now().toString(36)}`,
    name: options?.name ?? 'Untitled-1.adloze',
    updatedAt: Date.now(),
    unit,
    colorMode: options?.colorMode ?? 'RGB',
    rasterPPI: options?.rasterPPI ?? 300,
    bleed: {
      top: bleedPt,
      bottom: bleedPt,
      left: bleedPt,
      right: bleedPt,
      linked: true,
    },
    artboards,
    activeArtboardId: artboards[0].id,
    layers,
    activeLayerId: layer1Id,
    nodes,
    guides: [],
    slices: [],
    swatches: structuredCloneSwatches(DEFAULT_SWATCHES),
    brushes: [...DEFAULT_BRUSHES],
    symbols: [...DEFAULT_SYMBOLS],
    graphicStyles: [...DEFAULT_GRAPHIC_STYLES],
    patterns: [...DEFAULT_PATTERNS],
    exportAssets: [],
    savedSelections: [],
  };
}

function structuredCloneSwatches(swatches: SwatchItem[]): SwatchItem[] {
  return JSON.parse(JSON.stringify(swatches));
}

export const STARTER_TEMPLATES: StarterTemplateItem[] = [
  {
    id: 'tpl-brand-grid', name: 'Brand Identity Starter', category: 'Branding & Identity',
    description: 'Editable emblem, wordmark and colour palette for a fictional outdoor brand.',
    dimensionsLabel: '1200 × 800 px • RGB', colorMode: 'RGB', previewAccent: '#7fa897',
    buildDocument: () => populateStarterArtwork(createDefaultDocument({ name: 'Brand-Identity-Starter.adloze', width: 1200, height: 800, unit: 'px', colorMode: 'RGB', includeSampleArtwork: false }), 'brand'),
  },
  {
    id: 'tpl-isometric-poster', name: 'Isometric Illustration Poster', category: 'Art & Illustration',
    description: 'A colourful geometric poster with editable isometric shapes and typography.',
    dimensionsLabel: '1000 × 1200 pt • RGB', colorMode: 'RGB', previewAccent: '#8fe2d8',
    buildDocument: () => populateStarterArtwork(createDefaultDocument({ name: 'Isometric-Poster-Art.adloze', width: 1000, height: 1200, unit: 'pt', colorMode: 'RGB', includeSampleArtwork: false }), 'poster'),
  },
  {
    id: 'tpl-packaging-dieline', name: 'Packaging Box Study', category: 'Print & Packaging',
    description: 'Editable box layout with cut and fold guides. Verify dimensions before production.',
    dimensionsLabel: '297 × 210 mm • CMYK • 3 mm bleed', colorMode: 'CMYK', previewAccent: '#ec008c',
    buildDocument: () => populateStarterArtwork(createDefaultDocument({ name: 'Packaging-Box-Study.adloze', width: 297, height: 210, unit: 'mm', colorMode: 'CMYK', bleed: 3, includeSampleArtwork: false }), 'packaging'),
  },
  {
    id: 'tpl-icon-grid', name: 'Icon Set Multi-Artboard Grid', category: 'UI & Iconography',
    description: 'Four editable icons on separate artboards, ready to adapt for your project.',
    dimensionsLabel: '4 artboards • 512 × 512 px • RGB', colorMode: 'RGB', previewAccent: '#1473e6',
    buildDocument: () => populateStarterArtwork(createDefaultDocument({ name: 'Icon-System-Set.adloze', width: 512, height: 512, unit: 'px', colorMode: 'RGB', artboardCount: 4, includeSampleArtwork: false }), 'icons'),
  },
];
