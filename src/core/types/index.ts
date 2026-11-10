import type { UnitType } from '../math/units';
import type { RGBColor, CMYKColor, HSBColor, HarmonyRule } from '../math/color';

export type { UnitType, RGBColor, CMYKColor, HSBColor, HarmonyRule };

export type ColorMode = 'RGB' | 'CMYK';
export type UIThemeBrightness = 'dark' | 'medium-dark' | 'medium-light' | 'light';
export type Language = 'id' | 'en';
export type DrawingMode = 'normal' | 'behind' | 'inside';
export type ScreenMode = 'normal' | 'fullscreen-menu' | 'fullscreen';
export type ViewMode = 'preview' | 'outline' | 'pixel' | 'trim';

export type ToolId =
  | 'select'
  | 'direct-select'
  | 'group-select'
  | 'magic-wand'
  | 'lasso'
  | 'pen'
  | 'add-anchor'
  | 'delete-anchor'
  | 'anchor-point'
  | 'curvature'
  | 'type'
  | 'area-type'
  | 'type-on-path'
  | 'vertical-type'
  | 'touch-type'
  | 'line'
  | 'arc'
  | 'spiral'
  | 'rect-grid'
  | 'polar-grid'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'flare'
  | 'paintbrush'
  | 'blob-brush'
  | 'pencil'
  | 'smooth'
  | 'path-eraser'
  | 'eraser'
  | 'scissors'
  | 'knife'
  | 'rotate'
  | 'reflect'
  | 'scale'
  | 'shear'
  | 'width'
  | 'warp'
  | 'twirl'
  | 'pucker'
  | 'bloat'
  | 'scallop'
  | 'crystallize'
  | 'wrinkle'
  | 'free-transform'
  | 'puppet-warp'
  | 'shape-builder'
  | 'live-paint-bucket'
  | 'live-paint-select'
  | 'perspective-grid'
  | 'perspective-select'
  | 'mesh'
  | 'gradient'
  | 'eyedropper'
  | 'measure'
  | 'blend'
  | 'symbol-sprayer'
  | 'symbol-shifter'
  | 'symbol-scruncher'
  | 'symbol-sizer'
  | 'symbol-spinner'
  | 'symbol-stainer'
  | 'symbol-screener'
  | 'symbol-styler'
  | 'column-graph'
  | 'stacked-column-graph'
  | 'bar-graph'
  | 'line-graph'
  | 'pie-graph'
  | 'radar-graph'
  | 'artboard'
  | 'slice'
  | 'slice-select'
  | 'hand'
  | 'zoom';

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnchorPoint {
  id: string;
  x: number;
  y: number;
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
  pointType: 'corner' | 'smooth';
  cornerRadius?: number;
  cornerType?: 'round' | 'inverted' | 'chamfer';
  widthLeft?: number;
  widthRight?: number;
}

export interface GradientStop {
  id: string;
  offset: number; // 0 to 1
  color: string;
  opacity: number;
  midpoint?: number; // 0.13 to 0.87, default 0.5
}

export interface FreeformStop {
  id: string;
  x: number; // 0 to 1 normalized inside bounds
  y: number; // 0 to 1 normalized inside bounds
  color: string;
  opacity: number;
  spread: number; // 0.1 to 1.0
}

export interface GradientDef {
  id: string;
  name: string;
  type: 'linear' | 'radial' | 'freeform';
  angle: number;
  aspectRatio: number;
  stops: GradientStop[];
  freeformPoints?: FreeformStop[];
  strokeApplication?: 'within' | 'along' | 'across';
}

export type BlendMode =
  | 'normal'
  | 'darken'
  | 'multiply'
  | 'color-burn'
  | 'lighten'
  | 'screen'
  | 'color-dodge'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type LiveEffectType =
  | 'drop-shadow'
  | 'inner-glow'
  | 'outer-glow'
  | 'feather'
  | 'gaussian-blur'
  | 'radial-blur'
  | 'round-corners'
  | 'offset-path'
  | 'outline-stroke'
  | 'pucker-bloat'
  | 'roughen'
  | 'zig-zag'
  | 'twist'
  | 'tweak'
  | 'transform-effect'
  | 'warp'
  | 'extrude-3d'
  | 'revolve-3d'
  | 'rotate-3d'
  | 'scribble'
  | 'convert-to-shape';

export interface LiveEffectItem {
  id: string;
  type: LiveEffectType;
  name: string;
  enabled: boolean;
  params: Record<string, any>;
}

export interface FillItem {
  id: string;
  visible: boolean;
  type: 'solid' | 'gradient' | 'pattern' | 'none';
  color: string;
  globalSwatchId?: string;
  tint?: number;
  gradient?: GradientDef;
  patternId?: string;
  opacity: number;
  blendMode: BlendMode;
  effects?: LiveEffectItem[];
}

export interface StrokeItem {
  id: string;
  visible: boolean;
  color: string;
  globalSwatchId?: string;
  tint?: number;
  gradient?: GradientDef;
  weight: number;
  cap: 'butt' | 'round' | 'projecting';
  join: 'miter' | 'round' | 'bevel';
  miterLimit: number;
  align: 'center' | 'inside' | 'outside';
  dashArray: number[];
  widthProfileId?: string;
  brushId?: string;
  opacity: number;
  blendMode: BlendMode;
  effects?: LiveEffectItem[];
}

export interface MeshPoint {
  row: number;
  col: number;
  x: number;
  y: number;
  color: string;
  opacity: number;
}

export interface CharacterTouchTransform {
  charIndex: number;
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface TextStyle {
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  leading: number;
  kerning: number;
  tracking: number;
  horizontalScale: number;
  verticalScale: number;
  baselineShift: number;
  characterRotation: number;
  textCase: 'normal' | 'uppercase' | 'small-caps' | 'superscript' | 'subscript';
  underline: boolean;
  strikethrough: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  indentLeft: number;
  indentRight: number;
  indentFirstLine: number;
  spaceBefore: number;
  spaceAfter: number;
  hyphenation: boolean;
  typeMode: 'point' | 'area' | 'path';
  vertical: boolean;
  pathId?: string;
  pathStartBracket?: number;
  pathEndBracket?: number;
  pathFlip?: boolean;
  pathEffect?: 'rainbow' | 'skew' | 'ribbon' | 'stair' | 'gravity';
  threadedNextNodeId?: string;
  textWrap?: boolean;
  textWrapOffset?: number;
  touchTransforms?: CharacterTouchTransform[];
}

export interface GraphSpec {
  graphType: 'column' | 'stacked-column' | 'bar' | 'stacked-bar' | 'line' | 'area' | 'scatter' | 'pie' | 'radar';
  labels: string[];
  seriesNames: string[];
  data: number[][];
  showLegend: boolean;
  showShadow: boolean;
}

export type VectorNodeType =
  | 'path'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'text'
  | 'group'
  | 'compound-path'
  | 'compound-shape'
  | 'clipping-group'
  | 'live-paint-group'
  | 'mesh'
  | 'symbol-instance'
  | 'image'
  | 'blend'
  | 'envelope'
  | 'graph';

export interface VectorNode {
  id: string;
  name: string;
  type: VectorNodeType;
  layerId: string;
  parentId?: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  points: AnchorPoint[];
  closed: boolean;
  cornerRadius?: number;
  cornerType?: 'round' | 'inverted' | 'chamfer';
  sides?: number;
  innerRadius?: number;
  fills: FillItem[];
  strokes: StrokeItem[];
  effects: LiveEffectItem[];
  opacity: number;
  blendMode: BlendMode;
  fillRule?: 'nonzero' | 'evenodd';
  children?: string[];
  compoundMode?: 'unite' | 'minus-front' | 'intersect' | 'exclude';
  textContent?: string;
  textStyle?: TextStyle;
  imageUrl?: string;
  imageTraceParams?: Record<string, any>;
  symbolId?: string;
  meshGrid?: { rows: number; cols: number; points: MeshPoint[] };
  envelopeSpec?: {
    mode: 'warp' | 'mesh' | 'top-object';
    warpStyle?: string;
    bend?: number;
    hDistort?: number;
    vDistort?: number;
    rows?: number;
    cols?: number;
  };
  blendSpec?: {
    mode: 'smooth' | 'steps' | 'distance';
    steps: number;
    spinePoints?: AnchorPoint[];
  };
  livePaintFaces?: { id: string; points: { x: number; y: number }[]; color: string }[];
  graphSpec?: GraphSpec;
  opacityMask?: {
    enabled: boolean;
    clip: boolean;
    invert: boolean;
    maskColorStops?: GradientStop[];
  };
  isGuide?: boolean;
}

export interface LayerItem {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  outlineMode: boolean;
  templateMode: boolean;
  expanded: boolean;
  nodeIds: string[];
  effects: LiveEffectItem[];
  opacity: number;
  blendMode: BlendMode;
}

export interface ArtboardItem {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  showCenterMark: boolean;
  showCrossHairs: boolean;
  showVideoSafeAreas: boolean;
  backgroundColor?: string;
}

export interface GuideItem {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number;
  locked: boolean;
}

export interface SliceItem {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SwatchItem {
  id: string;
  name: string;
  type: 'solid' | 'gradient' | 'pattern';
  color: string;
  isGlobal: boolean;
  isSpot: boolean;
  tint: number;
  gradient?: GradientDef;
  patternId?: string;
  groupName?: string;
}

export interface BrushItem {
  id: string;
  name: string;
  type: 'calligraphic' | 'scatter' | 'art' | 'pattern';
  angle: number;
  roundness: number;
  size: number;
  spacing?: number;
  scatter?: number;
  colorization?: 'none' | 'tints' | 'hue-shift';
  svgPath?: string;
}

export interface SymbolItem {
  id: string;
  name: string;
  isDynamic: boolean;
  previewColor: string;
  paths: { d: string; fill: string; stroke: string }[];
}

export interface GraphicStyleItem {
  id: string;
  name: string;
  fills: FillItem[];
  strokes: StrokeItem[];
  effects: LiveEffectItem[];
  opacity: number;
  blendMode: BlendMode;
}

export interface PatternItem {
  id: string;
  name: string;
  tileType: 'grid' | 'brick-row' | 'brick-col' | 'hex-col' | 'hex-row';
  brickOffset: number;
  width: number;
  height: number;
  hSpacing: number;
  vSpacing: number;
  dimCopies: number;
  elements: {
    type: 'circle' | 'rect' | 'path' | 'line';
    d?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    fill: string;
    stroke: string;
  }[];
}

export interface ExportAssetItem {
  id: string;
  name: string;
  sourceNodeId: string;
  scales: ('1x' | '2x' | '3x')[];
  formats: ('png' | 'svg' | 'pdf' | 'jpg' | 'webp')[];
}

export interface SavedSelection {
  id: string;
  name: string;
  nodeIds: string[];
}

export interface StudioDocument {
  id: string;
  name: string;
  updatedAt: number;
  unit: UnitType;
  colorMode: ColorMode;
  rasterPPI: 72 | 150 | 300;
  bleed: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    linked: boolean;
  };
  artboards: ArtboardItem[];
  activeArtboardId: string;
  layers: LayerItem[];
  activeLayerId: string;
  nodes: Record<string, VectorNode>;
  guides: GuideItem[];
  slices: SliceItem[];
  swatches: SwatchItem[];
  brushes: BrushItem[];
  symbols: SymbolItem[];
  graphicStyles: GraphicStyleItem[];
  patterns: PatternItem[];
  exportAssets: ExportAssetItem[];
  savedSelections: SavedSelection[];
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  snapshot: StudioDocument;
}

export type ActiveModalType =
  | null
  | 'new-document'
  | 'recolor-artwork'
  | 'image-trace'
  | 'envelope-warp'
  | 'envelope-mesh'
  | 'blend-options'
  | 'transform-each'
  | 'offset-path'
  | 'simplify-path'
  | 'split-into-grid'
  | 'pattern-maker'
  | 'graph-data'
  | 'export-screens'
  | 'save-for-web'
  | 'export-pdf'
  | 'export-svg'
  | 'preferences'
  | 'keyboard-shortcuts'
  | 'shape-dialog';

export type PathfinderOp =
  | 'unite'
  | 'minus-front'
  | 'intersect'
  | 'exclude'
  | 'divide'
  | 'trim'
  | 'merge'
  | 'crop'
  | 'outline'
  | 'minus-back';

export type AlignOp =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom'
  | 'distribute-h'
  | 'distribute-v'
  | 'spacing-h'
  | 'spacing-v';

export type AlignTarget = 'selection' | 'key-object' | 'artboard';
