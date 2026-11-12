import { selectionNodeBounds } from '../core/math/selectionResize';
import { canBlend } from '../core/math/blend';
import { fitPointTextFrame } from '../core/math/textLayout';
import { create } from 'zustand';
import type {
  ActiveModalType,
  AlignOp,
  AlignTarget,
  AnchorPoint,
  ArtboardItem,
  BlendMode,
  BrushItem,
  ColorMode,
  DrawingMode,
  ExportAssetItem,
  FillItem,
  GradientDef,
  GraphicStyleItem,
  GuideItem,
  HistoryEntry,
  Language,
  LayerItem,
  LiveEffectItem,
  LiveEffectType,
  MeshPoint,
  PathfinderOp,
  PatternItem,
  ScreenMode,
  SliceItem,
  StrokeItem,
  StudioDocument,
  SwatchItem,
  SymbolItem,
  ToolId,
  UIThemeBrightness,
  UnitType,
  VectorNode,
  ViewMode,
} from '../core/types';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import {
  applyEnvelopeDistortToPoints,
  computeBoundingBoxFromAnchors,
  createEllipseAnchors,
  createPolygonAnchors,
  createRectangleAnchors,
  createStarAnchors,
  makeAnchorId,
} from '../core/math/bezier';
import {
  computeLivePaintFaces,
  nodeToPolygon,
  offsetVectorNode,
  outlineStrokeNode,
  performPathfinder,
  polygonToAnchors,
  simplifyPathPoints,
  splitIntoGridNodes,
} from '../core/math/pathfinder';
import { shiftColorHarmony } from '../core/math/color';

function cloneDoc(doc: StudioDocument): StudioDocument {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(doc);
    } catch {
      // Fallback to JSON clone if non-cloneable reference exists
    }
  }
  return JSON.parse(JSON.stringify(doc));
}

/** Clone complete selected subtrees and remap all internal parent/child links. */
function cloneSubtrees(source: Record<string, VectorNode>, roots: string[], dx: number, dy: number, layerId?: string) {
  const originals: VectorNode[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    const node = source[id];
    if (!node || visited.has(id)) return;
    visited.add(id); originals.push(node);
    (node.children || []).forEach(visit);
  };
  roots.forEach(visit);
  const ids = new Map(originals.map(node => [node.id, makeAnchorId('copy')]));
  const nodes = originals.map(orig => {
    const copy: VectorNode = JSON.parse(JSON.stringify(orig));
    copy.id = ids.get(orig.id)!;
    copy.parentId = orig.parentId ? ids.get(orig.parentId) : undefined;
    copy.children = orig.children?.map(id => ids.get(id)).filter((id): id is string => !!id);
    if (layerId) copy.layerId = layerId;
    copy.x += dx; copy.y += dy;
    copy.points = (copy.points || []).map(pt => ({ ...pt, id: makeAnchorId('pt'), x: pt.x + dx, y: pt.y + dy,
      handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
      handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined }));
    return copy;
  });
  return { nodes, rootIds: roots.map(id => ids.get(id)).filter((id): id is string => !!id) };
}

export interface StudioStoreState {
  // Multi-Document State
  documents: Record<string, StudioDocument>;
  activeDocumentId: string;
  document: StudioDocument;
  activeDocument: StudioDocument;
  showHomeScreen: boolean;

  // Tool & Proxy State
  activeTool: ToolId;
  activeProxy: 'fill' | 'stroke';
  currentFillColor: string;
  currentStrokeColor: string;
  currentStrokeWeight: number;
  activeSymbolId: string;
  activeBrushId: string;
  magicWandSettings: {
    fillColor: boolean;
    fillTolerance: number;
    strokeColor: boolean;
    strokeTolerance: number;
    strokeWeight: boolean;
    weightTolerance: number;
    opacity: boolean;
    opacityTolerance: number;
    blendMode: boolean;
  };

  // Selection & Modes
  selectedNodeIds: string[];
  selectedIds: string[];
  selectedAnchorIds: string[];
  lastSelectionIds: string[];
  keyObjectId: string | null;
  alignTarget: AlignTarget;
  isolationGroupId: string | null;
  isolatedGroupId: string | null;
  targetedAppearanceId: string | null;
  patternEditId: string | null;

  // Viewport & View Settings
  zoom: number;
  panX: number;
  panY: number;
  viewMode: ViewMode;
  rulerOriginMode: 'artboard' | 'global';
  showRulers: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  showGuides: boolean;
  lockGuides: boolean;
  showSmartGuides: boolean;
  showTransparencyGrid: boolean;
  showBoundingBox: boolean;
  showEdges: boolean;
  showPerspectiveGrid: boolean;
  activePerspectivePlane: 'left' | 'right' | 'horizontal' | 'none';
  drawingMode: DrawingMode;
  screenMode: ScreenMode;
  hideAllPanels: boolean;
  moveArtworkWithArtboard: boolean;
  toolbarColumns: 1 | 2;

  // Workspace, Theme, i18n, Modal, Status
  activeWorkspace: string;
  customWorkspaces: string[];
  openPanels: Record<string, boolean>;
  uiBrightness: UIThemeBrightness;
  pasteboardMatchUI: boolean;
  language: Language;
  activeModal: ActiveModalType;
  statusMessage: string;
  measureInfo: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    distance: number;
    angle: number;
  } | null;
  clipboardNodes: VectorNode[];
  clipboardOrigin: { x: number; y: number };
  lastTransformDelta: {
    dx: number;
    dy: number;
    dRotation: number;
    scaleX: number;
    scaleY: number;
    isCopy: boolean;
  } | null;

  // History
  history: HistoryEntry[];
  historyIndex: number;
  documentHistories: Record<string, { history: HistoryEntry[]; historyIndex: number }>;
  isTransactionActive: boolean;
  transactionLabel: string | null;

  // Document Actions
  getActiveDocument: () => StudioDocument;
  setShowHomeScreen: (show: boolean) => void;
  createDocument: (options?: {
    name?: string;
    width?: number;
    height?: number;
    unit?: UnitType;
    colorMode?: ColorMode;
    rasterPPI?: 72 | 150 | 300;
    artboardCount?: number;
    bleed?: number;
    includeSampleArtwork?: boolean;
  }) => StudioDocument;
  openDocument: (doc: StudioDocument) => void;
  closeDocument: (docId: string) => void;
  switchDocument: (docId: string) => void;
  setActiveDocumentId: (docId: string) => void;
  renameDocument: (docId: string, name: string) => void;
  updateDocument: (
    updater: (doc: StudioDocument, state?: StudioStoreState) => void,
    historyLabel?: string,
    options?: { silent?: boolean; coalesce?: boolean }
  ) => void;

  // History Actions
  beginTransaction: (label?: string) => void;
  commitTransaction: (label?: string) => void;
  pushHistory: (label: string, snapshotOverride?: StudioDocument) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistory: (index: number) => void;

  // Tool & Proxy Actions
  setActiveTool: (tool: ToolId) => void;
  setActiveProxy: (proxy: 'fill' | 'stroke') => void;
  toggleActiveProxy: () => void;
  setCurrentFillColor: (color: string) => void;
  setCurrentStrokeColor: (color: string) => void;
  setCurrentStrokeWeight: (weight: number) => void;
  swapFillAndStroke: () => void;
  resetDefaultFillAndStroke: () => void;
  setProxyNone: () => void;
  applyGradientToProxy: (gradient?: GradientDef) => void;
  setActiveSymbolId: (id: string) => void;
  setActiveBrushId: (id: string) => void;
  setMagicWandSettings: (patch: Partial<StudioStoreState['magicWandSettings']>) => void;

  // Selection Actions
  selectNodes: (ids: string[], additive?: boolean) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedAnchorIds: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  selectAllOnActiveArtboard: () => void;
  invertSelection: () => void;
  reselect: () => void;
  selectSame: (
    criterion:
      | 'appearance'
      | 'blend-mode'
      | 'fill-and-stroke'
      | 'fill-color'
      | 'opacity'
      | 'stroke-color'
      | 'stroke-weight'
      | 'graphic-style'
      | 'symbol-instance'
  ) => void;
  selectByMagicWand: (targetNodeId: string) => void;
  setKeyObjectId: (id: string | null) => void;
  setAlignTarget: (target: AlignTarget) => void;
  enterIsolationMode: (groupId: string) => void;
  exitIsolationMode: () => void;
  setTargetedAppearanceId: (id: string | null) => void;
  enterPatternEditMode: (patternId?: string) => void;
  exitPatternEditMode: (saveChanges?: boolean) => void;
  saveSelection: (name: string) => void;
  loadSavedSelection: (selectionId: string) => void;
  deleteSavedSelection: (selectionId: string) => void;

  // Viewport & View Actions
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitArtboardInWindow: (viewportW?: number, viewportH?: number) => void;
  fitAllArtboardsInWindow: (viewportW?: number, viewportH?: number) => void;
  actualSize: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleOutlineMode: () => void;
  setRulerOriginMode: (mode: 'artboard' | 'global') => void;
  toggleRulers: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  toggleGuides: () => void;
  toggleLockGuides: () => void;
  toggleSmartGuides: () => void;
  toggleTransparencyGrid: () => void;
  toggleBoundingBox: () => void;
  toggleEdges: () => void;
  togglePerspectiveGrid: () => void;
  setActivePerspectivePlane: (plane: 'left' | 'right' | 'horizontal' | 'none') => void;
  setDrawingMode: (mode: DrawingMode) => void;
  cycleDrawingMode: () => void;
  setScreenMode: (mode: ScreenMode) => void;
  cycleScreenMode: () => void;
  setHideAllPanels: (hide: boolean) => void;
  toggleHideAllPanels: () => void;
  setMoveArtworkWithArtboard: (val: boolean) => void;
  setToolbarColumns: (cols: 1 | 2) => void;

  // Workspace, Theme, i18n, Modal Actions
  setActiveWorkspace: (ws: string) => void;
  saveCustomWorkspace: (name: string) => void;
  resetWorkspace: () => void;
  togglePanelVisibility: (panelId: string) => void;
  setPanelVisibility: (panelId: string, open: boolean) => void;
  setUIBrightness: (brightness: UIThemeBrightness) => void;
  setPasteboardMatchUI: (val: boolean) => void;
  setLanguage: (lang: Language) => void;
  setActiveModal: (modal: ActiveModalType) => void;
  setStatusMessage: (msg: string) => void;
  setMeasureInfo: (info: StudioStoreState['measureInfo']) => void;

  // Node CRUD & Manipulation Actions
  addNode: (node: VectorNode, label?: string) => void;
  updateNode: (
    nodeId: string,
    patch: Partial<VectorNode> | ((node: VectorNode) => void),
    label?: string,
    options?: { silent?: boolean }
  ) => void;
  updateNodes: (
    nodeIds: string[],
    patch: Partial<VectorNode> | ((node: VectorNode) => void),
    label?: string,
    options?: { silent?: boolean }
  ) => void;
  deleteNode: (nodeId: string) => void;
  deleteSelectedNodes: () => void;
  duplicateSelectedNodes: (dx?: number, dy?: number) => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: (
    mode?: 'normal' | 'in-front' | 'in-back' | 'in-place' | 'all-artboards'
  ) => void;
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  lockSelection: () => void;
  unlockAll: () => void;
  hideSelection: () => void;
  showAll: () => void;
  transformAgain: () => void;
  transformEach: (params: {
    scaleX: number;
    scaleY: number;
    moveX: number;
    moveY: number;
    rotate: number;
    random?: boolean;
    copy?: boolean;
  }) => void;

  // Layer Actions
  addLayer: (name?: string) => void;
  deleteLayer: (layerId: string) => void;
  updateLayer: (layerId: string, patch: Partial<LayerItem>) => void;
  setActiveLayerId: (layerId: string) => void;
  reorderLayers: (fromIdx: number, toIdx: number) => void;
  collectInNewLayer: () => void;
  releaseToLayers: (mode?: 'sequence' | 'build') => void;

  // Artboard, Guide & Slice Actions
  addArtboard: (spec?: Partial<ArtboardItem>) => void;
  deleteArtboard: (artboardId: string) => void;
  updateArtboard: (
    artboardId: string,
    patch: Partial<ArtboardItem>,
    options?: { silent?: boolean }
  ) => void;
  setActiveArtboardId: (artboardId: string) => void;
  rearrangeArtboards: (columns?: number, spacing?: number) => void;
  fitArtboardToArtwork: (selectedOnly?: boolean) => void;
  addGuide: (orientation: 'horizontal' | 'vertical', position: number) => void;
  removeGuide: (guideId: string) => void;
  clearGuides: () => void;
  makeGuidesFromSelection: () => void;
  releaseGuides: () => void;
  addSlice: (slice: SliceItem) => void;
  removeSlice: (sliceId: string) => void;

  // Pathfinder, Align & Path Operations
  runPathfinder: (op: PathfinderOp, asCompoundShape?: boolean) => void;
  alignNodes: (op: AlignOp, target?: AlignTarget, spacingValue?: number) => void;
  joinSelectedPaths: (averageFirst?: boolean) => void;
  averageSelectedAnchors: (axis: 'horizontal' | 'vertical' | 'both') => void;
  offsetSelectedPaths: (
    offset: number,
    joins?: 'miter' | 'round' | 'bevel',
    miterLimit?: number
  ) => void;
  simplifySelectedPaths: (curvePrecision?: number, angleThreshold?: number) => void;
  outlineSelectedStrokes: () => void;
  splitSelectedIntoGrid: (options: {
    rows: number;
    cols: number;
    gutterH: number;
    gutterV: number;
  }) => void;
  cleanUpDocument: () => void;

  // Appearance, Styles, Type, Masks, Blend, Envelope, Live Paint
  addFillToSelection: (color?: string) => void;
  addStrokeToSelection: (color?: string, weight?: number) => void;
  addLiveEffectToSelection: (type: LiveEffectType, params?: Record<string, any>) => void;
  removeLiveEffectFromSelection: (effectId: string) => void;
  applyGraphicStyle: (styleId: string, merge?: boolean) => void;
  saveSelectionAsGraphicStyle: (name: string) => void;
  expandAppearance: () => void;
  createOutlinesFromSelection: () => void;
  makeClippingMask: () => void;
  releaseClippingMask: () => void;
  makeCompoundPath: () => void;
  releaseCompoundPath: () => void;
  makeBlend: (mode?: 'smooth' | 'steps' | 'distance', steps?: number) => void;
  releaseBlend: () => void;
  makeEnvelopeWarp: (
    warpStyle?: string,
    bend?: number,
    hDistort?: number,
    vDistort?: number
  ) => void;
  makeEnvelopeMesh: (rows?: number, cols?: number) => void;
  makeEnvelopeTopObject: () => void;
  releaseEnvelope: () => void;
  makeLivePaintGroup: () => void;
  expandLivePaintGroup: () => void;
  createGradientMesh: (rows?: number, cols?: number) => void;

  // Swatches, Global Colors, Recolor, Symbols, Brushes, Assets
  addSwatch: (swatch: SwatchItem) => void;
  updateGlobalSwatch: (swatchId: string, newColor: string) => void;
  deleteSwatch: (swatchId: string) => void;
  recolorSelectedArtwork: (
    colorMap: Record<string, string>,
    hueShiftDeg?: number,
    satMult?: number,
    brightMult?: number
  ) => void;
  addSymbolFromSelection: (name?: string, isDynamic?: boolean) => void;
  placeSymbolInstance: (symbolId: string, x?: number, y?: number) => void;
  breakSymbolLink: () => void;
  addBrush: (brush: BrushItem) => void;
  addExportAssetFromSelection: () => void;
  removeExportAsset: (assetId: string) => void;
}

const initialDoc = createDefaultDocument({
  id: 'doc-initial',
  name: 'Adore-Brand-Master.adloze',
  width: 1200,
  height: 800,
  unit: 'px',
  colorMode: 'RGB',
  includeSampleArtwork: true,
});

const initialHistoryEntry: HistoryEntry = {
  id: 'hist-0',
  label: 'Open Document',
  timestamp: Date.now(),
  snapshot: cloneDoc(initialDoc),
};

const WORKSPACE_PREFERENCE_KEY = 'adore.activeWorkspace.v1';
function getInitialWorkspace(): string {
  try {
    const saved = localStorage.getItem(WORKSPACE_PREFERENCE_KEY);
    if (saved && ['essentials', 'essentials-classic', 'illustration', 'typography', 'layout-print', 'tracing', 'web'].includes(saved)) return saved;
  } catch { /* Storage is optional. */ }
  return 'essentials-classic';
}

const UI_THEME_PREFERENCE_KEY = 'adore.uiTheme.v1';
function getInitialTheme(): UIThemeBrightness {
  try {
    const saved = localStorage.getItem(UI_THEME_PREFERENCE_KEY);
    if (saved === 'dark' || saved === 'medium-dark' || saved === 'medium-light' || saved === 'light') return saved;
  } catch { /* Storage is optional. */ }
  return 'dark';
}

export const useStudioStore = create<StudioStoreState>((set, get) => ({
  documents: { [initialDoc.id]: initialDoc },
  activeDocumentId: initialDoc.id,
  document: initialDoc,
  activeDocument: initialDoc,
  showHomeScreen: false,

  activeTool: 'select',
  activeProxy: 'fill',
  currentFillColor: '#ff9a00',
  currentStrokeColor: '#1e1b4b',
  currentStrokeWeight: 2,
  activeSymbolId: 'sym-crown',
  activeBrushId: 'brush-callig-flat',
  magicWandSettings: {
    fillColor: true,
    fillTolerance: 32,
    strokeColor: false,
    strokeTolerance: 32,
    strokeWeight: false,
    weightTolerance: 2,
    opacity: false,
    opacityTolerance: 10,
    blendMode: false,
  },

  selectedNodeIds: ['node-hero-hex'],
  selectedIds: ['node-hero-hex'],
  selectedAnchorIds: [],
  lastSelectionIds: ['node-hero-hex'],
  keyObjectId: null,
  alignTarget: 'selection',
  isolationGroupId: null,
  isolatedGroupId: null,
  targetedAppearanceId: null,
  patternEditId: null,

  zoom: 0.85,
  panX: 110,
  panY: 60,
  viewMode: 'preview',
  rulerOriginMode: 'artboard',
  showRulers: true,
  showGrid: false,
  snapToGrid: false,
  showGuides: true,
  lockGuides: false,
  showSmartGuides: true,
  showTransparencyGrid: false,
  showBoundingBox: true,
  showEdges: true,
  showPerspectiveGrid: false,
  activePerspectivePlane: 'left',
  drawingMode: 'normal',
  screenMode: 'normal',
  hideAllPanels: false,
  moveArtworkWithArtboard: true,
  toolbarColumns: 2,

  activeWorkspace: getInitialWorkspace(),
  customWorkspaces: [],
  openPanels: {
    properties: true,
    layers: true,
    appearance: true,
    color: true,
    gradient: true,
    pathfinder: true,
    character: true,
    brushes: true,
    artboards: true,
    history: true,
  },
  uiBrightness: getInitialTheme(),
  pasteboardMatchUI: true,
  language: 'en',
  activeModal: null,
  statusMessage: '',
  measureInfo: null,
  clipboardNodes: [],
  clipboardOrigin: { x: 0, y: 0 },
  lastTransformDelta: null,

  history: [initialHistoryEntry],
  historyIndex: 0,
  documentHistories: {},
  isTransactionActive: false,
  transactionLabel: null,

  getActiveDocument: () => {
    const s = get();
    return s.documents[s.activeDocumentId] || s.document;
  },

  setShowHomeScreen: (show) => set({ showHomeScreen: show }),

  createDocument: (options) => {
    const newDoc = createDefaultDocument(options);
    const firstNodeId = Object.keys(newDoc.nodes)[0];
    const sel = firstNodeId ? [firstNodeId] : [];
    const entry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      label: `New Document (${newDoc.name})`,
      timestamp: Date.now(),
      snapshot: cloneDoc(newDoc),
    };
    set((s) => ({
      documents: { ...s.documents, [newDoc.id]: newDoc },
      activeDocumentId: newDoc.id,
      document: newDoc,
      activeDocument: newDoc,
      selectedNodeIds: sel,
      selectedIds: sel,
      selectedAnchorIds: [],
      showHomeScreen: false,
      activeModal: null,
      documentHistories: { ...s.documentHistories, [s.activeDocumentId]: { history: s.history, historyIndex: s.historyIndex }, [newDoc.id]: { history: [entry], historyIndex: 0 } },
      history: [entry],
      historyIndex: 0,
      statusMessage: `Created document "${newDoc.name}"`,
    }));
    return newDoc;
  },

  openDocument: (doc) => {
    const entry: HistoryEntry = {
      id: `hist-${Date.now()}`,
      label: `Open "${doc.name}"`,
      timestamp: Date.now(),
      snapshot: cloneDoc(doc),
    };
    set((s) => ({
      documents: { ...s.documents, [doc.id]: doc },
      activeDocumentId: doc.id,
      document: doc,
      activeDocument: doc,
      selectedNodeIds: [],
      selectedIds: [],
      selectedAnchorIds: [],
      showHomeScreen: false,
      documentHistories: { ...s.documentHistories, [s.activeDocumentId]: { history: s.history, historyIndex: s.historyIndex }, [doc.id]: { history: [entry], historyIndex: 0 } },
      history: [entry],
      historyIndex: 0,
      statusMessage: `Opened "${doc.name}"`,
    }));
  },

  closeDocument: (docId) => {
    const s = get();
    const ids = Object.keys(s.documents);
    if (ids.length <= 1) {
      set({ showHomeScreen: true });
      return;
    }
    if (!s.documents[docId]) return;
    const nextDocs = { ...s.documents };
    delete nextDocs[docId];
    const nextHistories = { ...s.documentHistories };
    delete nextHistories[docId];
    if (s.activeDocumentId !== docId) {
      set({ documents: nextDocs, documentHistories: nextHistories });
      return;
    }
    const nextActiveId = Object.keys(nextDocs)[0];
    const nextDoc = nextDocs[nextActiveId];
    const restored = nextHistories[nextActiveId] || { history: [{ id: `hist-${Date.now()}`, label: 'Open Document', timestamp: Date.now(), snapshot: cloneDoc(nextDoc) }], historyIndex: 0 };
    set({
      documents: nextDocs, documentHistories: nextHistories,
      activeDocumentId: nextActiveId, document: nextDoc, activeDocument: nextDoc,
      history: restored.history, historyIndex: restored.historyIndex,
      selectedNodeIds: [], selectedIds: [], selectedAnchorIds: [],
      isolationGroupId: null, isolatedGroupId: null,
    });
  },

  switchDocument: (docId) => {
    const s = get();
    const target = s.documents[docId];
    if (!target) return;
    if (docId === s.activeDocumentId) return;
    const restored = s.documentHistories[docId] || { history: [{ id: `hist-${Date.now()}`, label: 'Open Document', timestamp: Date.now(), snapshot: cloneDoc(target) }], historyIndex: 0 };
    set({
      documentHistories: { ...s.documentHistories, [s.activeDocumentId]: { history: s.history, historyIndex: s.historyIndex } },
      history: restored.history, historyIndex: restored.historyIndex,
      activeDocumentId: docId,
      document: target,
      activeDocument: target,
      selectedNodeIds: [],
      selectedIds: [],
      selectedAnchorIds: [],
      isolationGroupId: null,
      isolatedGroupId: null,
      statusMessage: `Switched to "${target.name}"`,
    });
  },

  setActiveDocumentId: (docId) => get().switchDocument(docId),

  renameDocument: (docId, name) => {
    get().updateDocument((d) => {
      if (d.id === docId) d.name = name;
    }, `Rename Document to ${name}`);
  },

  updateDocument: (updater, historyLabel = 'Edit Artwork', options) => {
    const s = get();
    const currentDoc = s.documents[s.activeDocumentId] || s.document;
    const nextDoc = cloneDoc(currentDoc);
    nextDoc.updatedAt = Date.now();

    updater(nextDoc, s);

    // Text mode is fixed at creation. Only content/typography changes remeasure
    // point text; selection transforms manage their own geometry inside transactions.
    for (const [id, next] of Object.entries(nextDoc.nodes)) {
      const previous = currentDoc.nodes[id];
      if (!previous || previous.type !== 'text' || next.type !== 'text' || !next.textStyle) continue;
      if (previous.textStyle?.typeMode === 'point' || previous.textStyle?.typeMode === 'area') next.textStyle.typeMode = previous.textStyle.typeMode;
      if (options?.silent || s.isTransactionActive || next.textStyle.typeMode !== 'point') continue;
      const keys = ['fontFamily', 'fontStyle', 'fontSize', 'leading', 'tracking', 'textCase', 'align'] as const;
      if (next.textContent !== previous.textContent || keys.some(key => next.textStyle?.[key] !== previous.textStyle?.[key])) {
        nextDoc.nodes[id] = fitPointTextFrame(next);
      }
    }

    // Live blend bounds follow edits to either endpoint, including transaction previews.
    for (const blend of Object.values(nextDoc.nodes)) {
      if (blend.type !== 'blend' || !blend.children?.length) continue;
      const children = blend.children.map(id => nextDoc.nodes[id]).filter(Boolean);
      if (!children.length) continue;
      const boxes = children.map(selectionNodeBounds);
      const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
      blend.x = x; blend.y = y;
      blend.width = Math.max(...boxes.map(b => b.x + b.width)) - x;
      blend.height = Math.max(...boxes.map(b => b.y + b.height)) - y;
    }

    if (options?.silent || s.isTransactionActive) {
      set({
        documents: { ...s.documents, [nextDoc.id]: nextDoc },
        document: nextDoc,
        activeDocument: nextDoc,
      });
      return;
    }

    const now = Date.now();
    const lastEntry = s.history[s.historyIndex];
    // Smart rapid-fire coalescing for sliders / color pickers within 350ms
    if (
      options?.coalesce !== false &&
      lastEntry &&
      s.historyIndex === s.history.length - 1 &&
      lastEntry.label === historyLabel &&
      now - lastEntry.timestamp < 350
    ) {
      const updatedEntry: HistoryEntry = {
        ...lastEntry,
        timestamp: now,
        snapshot: cloneDoc(nextDoc),
      };
      const nextHistory = [...s.history];
      nextHistory[s.historyIndex] = updatedEntry;
      set({
        documents: { ...s.documents, [nextDoc.id]: nextDoc },
        document: nextDoc,
        activeDocument: nextDoc,
        history: nextHistory,
        statusMessage: historyLabel,
      });
      return;
    }

    const newEntry: HistoryEntry = {
      id: `hist-${now}-${Math.random().toString(36).slice(2, 5)}`,
      label: historyLabel,
      timestamp: now,
      snapshot: cloneDoc(nextDoc),
    };
    const slicedHistory = s.history.slice(0, s.historyIndex + 1).slice(-49);
    const nextHistory = [...slicedHistory, newEntry];

    set({
      documents: { ...s.documents, [nextDoc.id]: nextDoc },
      document: nextDoc,
      activeDocument: nextDoc,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
      statusMessage: historyLabel,
    });
  },

  beginTransaction: (label = 'Transform Artwork') => {
    const s = get();
    const currentDoc = s.documents[s.activeDocumentId] || s.document;
    const isolatedDoc = cloneDoc(currentDoc);
    set({
      isTransactionActive: true,
      transactionLabel: label,
      documents: { ...s.documents, [isolatedDoc.id]: isolatedDoc },
      document: isolatedDoc,
      activeDocument: isolatedDoc,
    });
  },

  commitTransaction: (label) => {
    const s = get();
    if (!s.isTransactionActive) return;
    const finalLabel = label || s.transactionLabel || 'Transform Artwork';
    const currentDoc = s.documents[s.activeDocumentId] || s.document;
    const newEntry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: finalLabel,
      timestamp: Date.now(),
      snapshot: cloneDoc(currentDoc),
    };
    const sliced = s.history.slice(0, s.historyIndex + 1).slice(-49);
    const nextHistory = [...sliced, newEntry];
    set({
      isTransactionActive: false,
      transactionLabel: null,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
      statusMessage: finalLabel,
    });
  },

  pushHistory: (label, snapshotOverride) => {
    const s = get();
    const doc = snapshotOverride ?? (s.documents[s.activeDocumentId] || s.document);
    const newEntry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label,
      timestamp: Date.now(),
      snapshot: cloneDoc(doc),
    };
    const sliced = s.history.slice(0, s.historyIndex + 1).slice(-49);
    const nextHistory = [...sliced, newEntry];
    set({
      isTransactionActive: false,
      transactionLabel: null,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
      statusMessage: label,
    });
  },

  undo: () => {
    const s = get();
    if (s.historyIndex <= 0) {
      set({ statusMessage: 'Nothing to Undo' });
      return;
    }
    const nextIdx = s.historyIndex - 1;
    const entry = s.history[nextIdx];
    const restored = cloneDoc(entry.snapshot);
    set({
      documents: { ...s.documents, [restored.id]: restored },
      activeDocumentId: restored.id,
      document: restored,
      activeDocument: restored,
      historyIndex: nextIdx,
      statusMessage: `Undo: ${entry.label}`,
    });
  },

  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) {
      set({ statusMessage: 'Nothing to Redo' });
      return;
    }
    const nextIdx = s.historyIndex + 1;
    const entry = s.history[nextIdx];
    const restored = cloneDoc(entry.snapshot);
    set({
      documents: { ...s.documents, [restored.id]: restored },
      activeDocumentId: restored.id,
      document: restored,
      activeDocument: restored,
      historyIndex: nextIdx,
      statusMessage: `Redo: ${entry.label}`,
    });
  },

  jumpToHistory: (index) => {
    const s = get();
    if (index < 0 || index >= s.history.length) return;
    const entry = s.history[index];
    const restored = cloneDoc(entry.snapshot);
    set({
      documents: { ...s.documents, [restored.id]: restored },
      activeDocumentId: restored.id,
      document: restored,
      activeDocument: restored,
      historyIndex: index,
      statusMessage: `History: ${entry.label}`,
    });
  },

  setActiveTool: (tool) => set({ activeTool: tool, statusMessage: `Tool: ${tool}` }),

  setActiveProxy: (proxy) => set({ activeProxy: proxy }),

  toggleActiveProxy: () =>
    set((s) => ({ activeProxy: s.activeProxy === 'fill' ? 'stroke' : 'fill' })),

  setCurrentFillColor: (color) => {
    set({ currentFillColor: color });
    const s = get();
    if (s.selectedNodeIds.length > 0) {
      s.updateNodes(
        s.selectedNodeIds,
        (n) => {
          if (n.fills.length === 0) {
            n.fills.push({
              id: makeAnchorId('fill'),
              visible: true,
              type: color === 'none' ? 'none' : 'solid',
              color,
              opacity: 1,
              blendMode: 'normal',
            });
          } else {
            n.fills[0].color = color;
            n.fills[0].type = color === 'none' ? 'none' : 'solid';
            n.fills[0].visible = color !== 'none';
          }
        },
        'Change Fill Color'
      );
    }
  },

  setCurrentStrokeColor: (color) => {
    set({ currentStrokeColor: color });
    const s = get();
    if (s.selectedNodeIds.length > 0) {
      s.updateNodes(
        s.selectedNodeIds,
        (n) => {
          if (n.strokes.length === 0) {
            n.strokes.push({
              id: makeAnchorId('stroke'),
              visible: color !== 'none',
              color,
              weight: s.currentStrokeWeight || 1,
              cap: 'round',
              join: 'round',
              miterLimit: 4,
              align: 'center',
              dashArray: [],
              opacity: 1,
              blendMode: 'normal',
            });
          } else {
            n.strokes[0].color = color;
            n.strokes[0].visible = color !== 'none';
          }
        },
        'Change Stroke Color'
      );
    }
  },

  setCurrentStrokeWeight: (weight) => {
    const w = Math.max(0, weight);
    set({ currentStrokeWeight: w });
    const s = get();
    if (s.selectedNodeIds.length > 0) {
      s.updateNodes(
        s.selectedNodeIds,
        (n) => {
          if (n.strokes.length > 0) {
            n.strokes[0].weight = w;
            n.strokes[0].visible = w > 0;
          }
        },
        `Stroke Weight ${w}pt`
      );
    }
  },

  swapFillAndStroke: () => {
    const s = get();
    const nextFill = s.currentStrokeColor;
    const nextStroke = s.currentFillColor;
    set({ currentFillColor: nextFill, currentStrokeColor: nextStroke });
    if (s.selectedNodeIds.length > 0) {
      s.updateNodes(
        s.selectedNodeIds,
        (n) => {
          const fColor = n.fills[0]?.color ?? 'none';
          const sColor = n.strokes[0]?.color ?? 'none';
          if (n.fills[0]) {
            n.fills[0].color = sColor;
            n.fills[0].type = sColor === 'none' ? 'none' : 'solid';
            n.fills[0].visible = sColor !== 'none';
          }
          if (n.strokes[0]) {
            n.strokes[0].color = fColor;
            n.strokes[0].visible = fColor !== 'none';
          }
        },
        'Swap Fill and Stroke (Shift+X)'
      );
    }
  },

  resetDefaultFillAndStroke: () => {
    set({
      currentFillColor: '#ffffff',
      currentStrokeColor: '#000000',
      currentStrokeWeight: 1,
    });
    const s = get();
    if (s.selectedNodeIds.length > 0) {
      s.updateNodes(
        s.selectedNodeIds,
        (n) => {
          n.fills = [
            {
              id: makeAnchorId('fill'),
              visible: true,
              type: 'solid',
              color: '#ffffff',
              opacity: 1,
              blendMode: 'normal',
            },
          ];
          n.strokes = [
            {
              id: makeAnchorId('stroke'),
              visible: true,
              color: '#000000',
              weight: 1,
              cap: 'butt',
              join: 'miter',
              miterLimit: 4,
              align: 'center',
              dashArray: [],
              opacity: 1,
              blendMode: 'normal',
            },
          ];
        },
        'Default Fill & Stroke (D)'
      );
    }
  },

  setProxyNone: () => {
    const s = get();
    if (s.activeProxy === 'fill') {
      s.setCurrentFillColor('none');
    } else {
      s.setCurrentStrokeColor('none');
    }
  },

  applyGradientToProxy: (gradient) => {
    const s = get();
    const doc = s.getActiveDocument();
    const grad =
      gradient ??
      doc.swatches.find((sw) => sw.type === 'gradient')?.gradient ?? {
        id: 'grad-default',
        name: 'Linear Gradient',
        type: 'linear',
        angle: 0,
        aspectRatio: 1,
        stops: [
          { id: 'gs1', offset: 0, color: '#ffffff', opacity: 1, midpoint: 0.5 },
          { id: 'gs2', offset: 1, color: '#000000', opacity: 1, midpoint: 0.5 },
        ],
      };

    if (s.selectedNodeIds.length > 0) {
      s.updateNodes(
        s.selectedNodeIds,
        (n) => {
          if (s.activeProxy === 'fill') {
            if (n.fills.length === 0) {
              n.fills.push({
                id: makeAnchorId('fill'),
                visible: true,
                type: 'gradient',
                color: grad.stops[0]?.color || '#ff9a00',
                gradient: grad,
                opacity: 1,
                blendMode: 'normal',
              });
            } else {
              n.fills[0].type = 'gradient';
              n.fills[0].gradient = grad;
              n.fills[0].visible = true;
            }
          } else if (n.strokes.length > 0) {
            n.strokes[0].gradient = grad;
            n.strokes[0].visible = true;
          }
        },
        'Apply Gradient (>)'
      );
    }
  },

  setActiveSymbolId: (id) => set({ activeSymbolId: id }),
  setActiveBrushId: (id) => set({ activeBrushId: id }),
  setMagicWandSettings: (patch) =>
    set((s) => ({ magicWandSettings: { ...s.magicWandSettings, ...patch } })),

  selectNodes: (ids, additive = false) => {
    const s = get();
    const next = additive ? Array.from(new Set([...s.selectedNodeIds, ...ids])) : ids;
    const doc = s.getActiveDocument();
    const primary = next.length > 0 ? doc.nodes[next[0]] : null;

    set({
      selectedNodeIds: next,
      selectedIds: next,
      lastSelectionIds: next.length > 0 ? next : s.lastSelectionIds,
      keyObjectId: next.includes(s.keyObjectId || '') ? s.keyObjectId : null,
      currentFillColor: primary?.fills[0]?.color ?? s.currentFillColor,
      currentStrokeColor: primary?.strokes[0]?.color ?? s.currentStrokeColor,
      currentStrokeWeight: primary?.strokes[0]?.weight ?? s.currentStrokeWeight,
    });
  },

  setSelectedNodeIds: (ids) => get().selectNodes(ids, false),

  setSelectedAnchorIds: (ids) => set({ selectedAnchorIds: ids }),

  clearSelection: () =>
    set({
      selectedNodeIds: [],
      selectedIds: [],
      selectedAnchorIds: [],
      keyObjectId: null,
    }),

  selectAll: () => {
    const doc = get().getActiveDocument();
    const unlockedIds = Object.values(doc.nodes)
      .filter((n) => n.visible && !n.locked && !n.parentId)
      .map((n) => n.id);
    get().selectNodes(unlockedIds, false);
  },

  selectAllOnActiveArtboard: () => {
    const doc = get().getActiveDocument();
    const ab = doc.artboards.find((a) => a.id === doc.activeArtboardId) || doc.artboards[0];
    if (!ab) return;
    const ids = Object.values(doc.nodes)
      .filter(
        (n) =>
          n.visible &&
          !n.locked &&
          n.x + n.width >= ab.x &&
          n.x <= ab.x + ab.width &&
          n.y + n.height >= ab.y &&
          n.y <= ab.y + ab.height
      )
      .map((n) => n.id);
    get().selectNodes(ids, false);
  },

  invertSelection: () => {
    const s = get();
    const doc = s.getActiveDocument();
    const current = new Set(s.selectedNodeIds);
    const inverted = Object.values(doc.nodes)
      .filter((n) => n.visible && !n.locked && !current.has(n.id))
      .map((n) => n.id);
    s.selectNodes(inverted, false);
  },

  reselect: () => {
    const s = get();
    if (s.lastSelectionIds.length > 0) {
      s.selectNodes(s.lastSelectionIds, false);
    }
  },

  selectSame: (criterion) => {
    const s = get();
    const doc = s.getActiveDocument();
    const refNode = doc.nodes[s.selectedNodeIds[0]];
    if (!refNode) return;

    const refFill = refNode.fills[0]?.color;
    const refStroke = refNode.strokes[0]?.color;
    const refWeight = refNode.strokes[0]?.weight;

    const matching = Object.values(doc.nodes)
      .filter((n) => {
        if (!n.visible || n.locked) return false;
        switch (criterion) {
          case 'fill-color':
            return n.fills[0]?.color === refFill;
          case 'stroke-color':
            return n.strokes[0]?.color === refStroke;
          case 'stroke-weight':
            return n.strokes[0]?.weight === refWeight;
          case 'fill-and-stroke':
            return n.fills[0]?.color === refFill && n.strokes[0]?.color === refStroke;
          case 'opacity':
            return Math.abs(n.opacity - refNode.opacity) < 0.01;
          case 'blend-mode':
            return n.blendMode === refNode.blendMode;
          case 'symbol-instance':
            return Boolean(refNode.symbolId && n.symbolId === refNode.symbolId);
          default:
            return n.fills[0]?.color === refFill && n.strokes[0]?.weight === refWeight;
        }
      })
      .map((n) => n.id);

    s.selectNodes(matching, false);
    set({ statusMessage: `Selected ${matching.length} object(s) with same ${criterion}` });
  },

  selectByMagicWand: (targetNodeId) => {
    const s = get();
    const doc = s.getActiveDocument();
    const target = doc.nodes[targetNodeId];
    if (!target) return;
    s.selectNodes([targetNodeId], false);
    s.selectSame('fill-color');
  },

  setKeyObjectId: (id) =>
    set({
      keyObjectId: id,
      alignTarget: id ? 'key-object' : 'selection',
    }),

  setAlignTarget: (target) => set({ alignTarget: target }),

  enterIsolationMode: (groupId) =>
    set({
      isolationGroupId: groupId,
      isolatedGroupId: groupId,
      statusMessage: 'Isolation Mode Active — Press Esc to Exit',
    }),

  exitIsolationMode: () =>
    set({
      isolationGroupId: null,
      isolatedGroupId: null,
      statusMessage: 'Exited Isolation Mode',
    }),

  setTargetedAppearanceId: (id) => set({ targetedAppearanceId: id }),

  enterPatternEditMode: (patternId) => {
    const doc = get().getActiveDocument();
    const pid = patternId || doc.patterns[0]?.id || 'pat-polka-dots';
    set({
      patternEditId: pid,
      activeModal: 'pattern-maker',
      statusMessage: 'Pattern Editing Mode Active',
    });
  },

  exitPatternEditMode: () =>
    set({
      patternEditId: null,
      activeModal: null,
      statusMessage: 'Saved Pattern Swatch',
    }),

  saveSelection: (name) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateDocument((d) => {
      d.savedSelections.push({
        id: `sel-${Date.now()}`,
        name: name.trim() || `Selection ${d.savedSelections.length + 1}`,
        nodeIds: [...s.selectedNodeIds],
      });
    }, `Save Selection "${name}"`);
  },

  loadSavedSelection: (selectionId) => {
    const s = get();
    const doc = s.getActiveDocument();
    const found = doc.savedSelections.find((item) => item.id === selectionId);
    if (found) {
      s.selectNodes(
        found.nodeIds.filter((id) => Boolean(doc.nodes[id])),
        false
      );
    }
  },

  deleteSavedSelection: (selectionId) => {
    get().updateDocument((d) => {
      d.savedSelections = d.savedSelections.filter((item) => item.id !== selectionId);
    }, 'Delete Saved Selection');
  },

  setZoom: (zoom) => set({ zoom: Math.max(0.0313, Math.min(64, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  zoomIn: () => set((s) => ({ zoom: Math.min(64, +(s.zoom * 1.25).toFixed(4)) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(0.0313, +(s.zoom / 1.25).toFixed(4)) })),

  fitArtboardInWindow: (viewportW = 1100, viewportH = 720) => {
    const doc = get().getActiveDocument();
    const ab = doc.artboards.find((a) => a.id === doc.activeArtboardId) || doc.artboards[0];
    if (!ab) return;
    const scaleX = (viewportW - 140) / Math.max(1, ab.width);
    const scaleY = (viewportH - 140) / Math.max(1, ab.height);
    const zoom = Math.max(0.05, Math.min(8, Math.min(scaleX, scaleY)));
    const panX = Math.round((viewportW - ab.width * zoom) / 2 - ab.x * zoom);
    const panY = Math.round((viewportH - ab.height * zoom) / 2 - ab.y * zoom);
    set({ zoom, panX, panY, statusMessage: 'Fit Artboard in Window (Ctrl+0)' });
  },

  fitAllArtboardsInWindow: (viewportW = 1100, viewportH = 720) => {
    const doc = get().getActiveDocument();
    if (doc.artboards.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ab of doc.artboards) {
      minX = Math.min(minX, ab.x);
      minY = Math.min(minY, ab.y);
      maxX = Math.max(maxX, ab.x + ab.width);
      maxY = Math.max(maxY, ab.y + ab.height);
    }
    const totalW = Math.max(1, maxX - minX);
    const totalH = Math.max(1, maxY - minY);
    const zoom = Math.max(
      0.05,
      Math.min(4, Math.min((viewportW - 160) / totalW, (viewportH - 160) / totalH))
    );
    const panX = Math.round((viewportW - totalW * zoom) / 2 - minX * zoom);
    const panY = Math.round((viewportH - totalH * zoom) / 2 - minY * zoom);
    set({ zoom, panX, panY, statusMessage: 'Fit All Artboards in Window (Alt+Ctrl+0)' });
  },

  actualSize: () => set({ zoom: 1, statusMessage: 'Actual Size 100% (Ctrl+1)' }),

  setViewMode: (mode) => set({ viewMode: mode, statusMessage: `View Mode: ${mode}` }),

  toggleOutlineMode: () =>
    set((s) => {
      const next = s.viewMode === 'outline' ? 'preview' : 'outline';
      return {
        viewMode: next,
        statusMessage: next === 'outline' ? 'Outline View (Ctrl+Y)' : 'GPU Preview (Ctrl+Y)',
      };
    }),

  setRulerOriginMode: (mode) => set({ rulerOriginMode: mode }),
  toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
  toggleLockGuides: () => set((s) => ({ lockGuides: !s.lockGuides })),
  toggleSmartGuides: () => set((s) => ({ showSmartGuides: !s.showSmartGuides })),
  toggleTransparencyGrid: () => set((s) => ({ showTransparencyGrid: !s.showTransparencyGrid })),
  toggleBoundingBox: () => set((s) => ({ showBoundingBox: !s.showBoundingBox })),
  toggleEdges: () => set((s) => ({ showEdges: !s.showEdges })),
  togglePerspectiveGrid: () => set((s) => ({ showPerspectiveGrid: !s.showPerspectiveGrid })),
  setActivePerspectivePlane: (plane) => set({ activePerspectivePlane: plane }),

  setDrawingMode: (mode) => set({ drawingMode: mode, statusMessage: `Drawing Mode: ${mode}` }),
  cycleDrawingMode: () =>
    set((s) => {
      const order: DrawingMode[] = ['normal', 'behind', 'inside'];
      const next = order[(order.indexOf(s.drawingMode) + 1) % order.length];
      return { drawingMode: next, statusMessage: `Drawing Mode: ${next} (Shift+D)` };
    }),

  setScreenMode: (mode) => set({ screenMode: mode }),
  cycleScreenMode: () =>
    set((s) => {
      const order: ScreenMode[] = ['normal', 'fullscreen-menu', 'fullscreen'];
      const next = order[(order.indexOf(s.screenMode) + 1) % order.length];
      return { screenMode: next, statusMessage: `Screen Mode: ${next} (F)` };
    }),

  setHideAllPanels: (hide) => set({ hideAllPanels: hide }),
  toggleHideAllPanels: () => set((s) => ({ hideAllPanels: !s.hideAllPanels })),
  setMoveArtworkWithArtboard: (val) => set({ moveArtworkWithArtboard: val }),
  setToolbarColumns: (cols) => set({ toolbarColumns: cols }),

  setActiveWorkspace: (ws) => {
    try { localStorage.setItem(WORKSPACE_PREFERENCE_KEY, ws); } catch { /* Storage is optional. */ }
    set({ activeWorkspace: ws, hideAllPanels: false, statusMessage: `Workspace: ${ws}` });
  },

  saveCustomWorkspace: (name) =>
    set((s) => ({
      customWorkspaces: Array.from(new Set([...s.customWorkspaces, name])),
      activeWorkspace: name,
    })),

  resetWorkspace: () =>
    set({
      hideAllPanels: false,
      openPanels: {
        properties: true,
        layers: true,
        appearance: true,
        color: true,
        gradient: true,
        pathfinder: true,
        character: true,
        brushes: true,
        artboards: true,
        history: true,
      },
      statusMessage: 'Workspace Reset to Defaults',
    }),

  togglePanelVisibility: (panelId) =>
    set((s) => ({
      openPanels: { ...s.openPanels, [panelId]: !s.openPanels[panelId] },
    })),

  setPanelVisibility: (panelId, open) =>
    set((s) => ({
      openPanels: { ...s.openPanels, [panelId]: open },
    })),

  setUIBrightness: (brightness) => {
    try { localStorage.setItem(UI_THEME_PREFERENCE_KEY, brightness); } catch { /* Storage is optional. */ }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', brightness);
    }
    set({ uiBrightness: brightness });
  },

  setPasteboardMatchUI: (val) => set({ pasteboardMatchUI: val }),
  setLanguage: (lang) => set({ language: lang }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setStatusMessage: (msg) => set({ statusMessage: msg }),
  setMeasureInfo: (info) => set({ measureInfo: info }),

  addNode: (node, label = `Create ${node.name || node.type}`) => {
    const s = get();
    s.updateDocument((d) => {
      const targetLayer =
        d.layers.find((l) => l.id === (node.layerId || d.activeLayerId)) || d.layers[0];
      if (!targetLayer) return;
      node.layerId = targetLayer.id;
      d.nodes[node.id] = node;

      if (s.drawingMode === 'behind') {
        targetLayer.nodeIds.unshift(node.id);
      } else {
        targetLayer.nodeIds.push(node.id);
      }
    }, label);
    s.selectNodes([node.id], false);
  },

  updateNode: (nodeId, patch, label = 'Transform Object', options) => {
    get().updateNodes([nodeId], patch, label, options);
  },

  updateNodes: (nodeIds, patch, label = 'Update Objects', options) => {
    if (nodeIds.length === 0) return;
    get().updateDocument(
      (d) => {
        for (const id of nodeIds) {
          const target = d.nodes[id];
          if (!target) continue;
          if (typeof patch === 'function') {
            patch(target);
          } else {
            Object.assign(target, patch);
          }
        }
      },
      label,
      options
    );
  },

  deleteNode: (nodeId) => {
    get().updateDocument((d) => {
      delete d.nodes[nodeId];
      for (const l of d.layers) {
        l.nodeIds = l.nodeIds.filter((id) => id !== nodeId);
      }
    }, 'Delete Object');
  },

  deleteSelectedNodes: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const toRemove = new Set(s.selectedNodeIds);
    s.updateDocument((d) => {
      const visit = (id: string) => {
        for (const child of d.nodes[id]?.children || []) {
          if (!toRemove.has(child)) { toRemove.add(child); visit(child); }
        }
      };
      for (const id of s.selectedNodeIds) visit(id);
      for (const id of toRemove) delete d.nodes[id];
      for (const node of Object.values(d.nodes)) {
        if (node.children) node.children = node.children.filter(id => !toRemove.has(id));
      }
      for (const l of d.layers) l.nodeIds = l.nodeIds.filter((id) => !toRemove.has(id));
    }, `Delete ${s.selectedNodeIds.length} Object(s)`);
    s.clearSelection();
  },

  duplicateSelectedNodes: (dx = 20, dy = 20) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const newIds: string[] = [];
    s.updateDocument((d) => {
      const selected = new Set(s.selectedNodeIds);
      const roots = s.selectedNodeIds.filter(id => !d.nodes[id]?.parentId || !selected.has(d.nodes[id].parentId!));
      const cloned = cloneSubtrees(d.nodes, roots, dx, dy);
      for (const node of cloned.nodes) {
        d.nodes[node.id] = node;
        if (node.parentId) (d.layers.find(l => l.id === node.layerId) || d.layers[0])?.nodeIds.push(node.id);
      }
      for (const id of cloned.rootIds) {
        const node = d.nodes[id];
        const layer = d.layers.find(l => l.id === node.layerId) || d.layers[0];
        layer?.nodeIds.push(id);
        newIds.push(id);
      }
    }, 'Duplicate Selection');
    set({
      lastTransformDelta: { dx, dy, dRotation: 0, scaleX: 1, scaleY: 1, isCopy: true },
    });
    s.selectNodes(newIds, false);
  },

  copySelection: () => {
    const s = get();
    const doc = s.getActiveDocument();
    const selected = new Set(s.selectedNodeIds);
    const roots = s.selectedNodeIds.filter(id => !doc.nodes[id]?.parentId || !selected.has(doc.nodes[id].parentId!));
    const copied: VectorNode[] = [];
    const seen = new Set<string>();
    const collect = (id: string) => {
      const node = doc.nodes[id];
      if (!node || seen.has(id)) return;
      seen.add(id); copied.push(JSON.parse(JSON.stringify(node)));
      node.children?.forEach(collect);
    };
    roots.forEach(collect);
    const ab = doc.artboards.find(a => a.id === doc.activeArtboardId) || doc.artboards[0];
    set({ clipboardNodes: copied, clipboardOrigin: { x: ab?.x ?? 0, y: ab?.y ?? 0 }, statusMessage: `Copied ${roots.length} object(s)` });
  },

  cutSelection: () => {
    const s = get();
    s.copySelection();
    s.deleteSelectedNodes();
  },

  pasteClipboard: (mode = 'normal') => {
    const s = get();
    if (s.clipboardNodes.length === 0) return;
    const newIds: string[] = [];
    const offset = mode === 'normal' ? 18 : 0;

    s.updateDocument((d) => {
      const targetArtboards =
        mode === 'all-artboards'
          ? d.artboards
          : [d.artboards.find((a) => a.id === d.activeArtboardId) || d.artboards[0]];

      for (const ab of targetArtboards) {
        if (!ab) continue;
        const source = Object.fromEntries(s.clipboardNodes.map(node => [node.id, node]));
        const roots = s.clipboardNodes.filter(node => !node.parentId || !source[node.parentId]).map(node => node.id);
        const dx = mode === 'all-artboards' ? ab.x - s.clipboardOrigin.x : offset;
        const dy = mode === 'all-artboards' ? ab.y - s.clipboardOrigin.y : offset;
        const layer = d.layers.find(l => l.id === d.activeLayerId) || d.layers[0];
        if (!layer) continue;
        const cloned = cloneSubtrees(source, roots, dx, dy, layer.id);
        for (const node of cloned.nodes) {
          d.nodes[node.id] = node;
          if (node.parentId) layer.nodeIds.push(node.id);
        }
        if (mode === 'in-back') layer.nodeIds.unshift(...cloned.rootIds);
        else layer.nodeIds.push(...cloned.rootIds);
        newIds.push(...cloned.rootIds);
      }
    }, `Paste (${mode})`);

    s.selectNodes(newIds, false);
  },

  bringForward: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const id = s.selectedNodeIds[0];
    s.updateDocument((d) => {
      for (const l of d.layers) {
        const idx = l.nodeIds.indexOf(id);
        if (idx >= 0 && idx < l.nodeIds.length - 1) {
          const tmp = l.nodeIds[idx + 1];
          l.nodeIds[idx + 1] = id;
          l.nodeIds[idx] = tmp;
        }
      }
    }, 'Bring Forward (Ctrl+])');
  },

  sendBackward: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const id = s.selectedNodeIds[0];
    s.updateDocument((d) => {
      for (const l of d.layers) {
        const idx = l.nodeIds.indexOf(id);
        if (idx > 0) {
          const tmp = l.nodeIds[idx - 1];
          l.nodeIds[idx - 1] = id;
          l.nodeIds[idx] = tmp;
        }
      }
    }, 'Send Backward (Ctrl+[)');
  },

  bringToFront: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const sel = new Set(s.selectedNodeIds);
    s.updateDocument((d) => {
      for (const l of d.layers) {
        const rest = l.nodeIds.filter((id) => !sel.has(id));
        const picked = l.nodeIds.filter((id) => sel.has(id));
        l.nodeIds = [...rest, ...picked];
      }
    }, 'Bring to Front (Shift+Ctrl+])');
  },

  sendToBack: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const sel = new Set(s.selectedNodeIds);
    s.updateDocument((d) => {
      for (const l of d.layers) {
        const rest = l.nodeIds.filter((id) => !sel.has(id));
        const picked = l.nodeIds.filter((id) => sel.has(id));
        l.nodeIds = [...picked, ...rest];
      }
    }, 'Send to Back (Shift+Ctrl+[)');
  },

  groupSelection: () => {
    const s = get();
    if (s.selectedNodeIds.length < 2) return;
    let groupId = '';
    s.updateDocument((d) => {
      const children = s.selectedNodeIds.map((id) => d.nodes[id]).filter(Boolean);
      if (children.length < 2) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const c of children) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.width);
        maxY = Math.max(maxY, c.y + c.height);
      }
      groupId = makeAnchorId('group');
      const layer = d.layers.find((l) => l.id === children[0].layerId) || d.layers[0];
      const groupNode: VectorNode = {
        id: groupId,
        name: '<Group>',
        type: 'group',
        layerId: layer.id,
        visible: true,
        locked: false,
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        rotation: 0,
        points: [],
        closed: true,
        children: children.map((c) => c.id),
        fills: [],
        strokes: [],
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      };
      for (const c of children) {
        c.parentId = groupId;
      }
      d.nodes[groupId] = groupNode;
      layer.nodeIds.push(groupId);
    }, 'Group Selection (Ctrl+G)');
    if (groupId) s.selectNodes([groupId], false);
  },

  ungroupSelection: () => {
    const s = get();
    const releasedIds: string[] = [];
    s.updateDocument((d) => {
      for (const id of s.selectedNodeIds) {
        const grp = d.nodes[id];
        if (!grp || !grp.children || grp.children.length === 0) continue;
        for (const cid of grp.children) {
          if (d.nodes[cid]) {
            d.nodes[cid].parentId = undefined;
            releasedIds.push(cid);
          }
        }
        delete d.nodes[id];
        for (const l of d.layers) {
          l.nodeIds = l.nodeIds.filter((nid) => nid !== id);
        }
      }
    }, 'Ungroup (Shift+Ctrl+G)');
    if (releasedIds.length > 0) s.selectNodes(releasedIds, false);
  },

  lockSelection: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(s.selectedNodeIds, { locked: true }, 'Lock Selection (Ctrl+2)');
    s.clearSelection();
  },

  unlockAll: () => {
    get().updateDocument((d) => {
      for (const n of Object.values(d.nodes)) {
        n.locked = false;
      }
    }, 'Unlock All (Alt+Ctrl+2)');
  },

  hideSelection: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(s.selectedNodeIds, { visible: false }, 'Hide Selection (Ctrl+3)');
    s.clearSelection();
  },

  showAll: () => {
    get().updateDocument((d) => {
      for (const n of Object.values(d.nodes)) {
        n.visible = true;
      }
    }, 'Show All (Alt+Ctrl+3)');
  },

  transformAgain: () => {
    const s = get();
    const delta = s.lastTransformDelta ?? {
      dx: 24,
      dy: 24,
      dRotation: 0,
      scaleX: 1,
      scaleY: 1,
      isCopy: true,
    };
    if (delta.isCopy) {
      s.duplicateSelectedNodes(delta.dx, delta.dy);
    } else {
      s.updateNodes(
        s.selectedNodeIds,
        (n) => {
          n.x += delta.dx;
          n.y += delta.dy;
          n.rotation = (n.rotation + delta.dRotation) % 360;
          n.width = Math.max(2, n.width * delta.scaleX);
          n.height = Math.max(2, n.height * delta.scaleY);
          n.points = (n.points || []).map((pt) => ({
            ...pt,
            x: pt.x + delta.dx,
            y: pt.y + delta.dy,
            handleIn: pt.handleIn
              ? { x: pt.handleIn.x + delta.dx, y: pt.handleIn.y + delta.dy }
              : undefined,
            handleOut: pt.handleOut
              ? { x: pt.handleOut.x + delta.dx, y: pt.handleOut.y + delta.dy }
              : undefined,
          }));
        },
        'Transform Again (Ctrl+D)'
      );
    }
  },

  transformEach: ({ scaleX, scaleY, moveX, moveY, rotate, random, copy }) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    if (copy) s.duplicateSelectedNodes(0, 0);

    s.updateNodes(
      get().selectedNodeIds,
      (n) => {
        const rFactor = random ? 0.35 + Math.random() * 0.65 : 1;
        const sx = 1 + ((scaleX / 100 - 1) * rFactor);
        const sy = 1 + ((scaleY / 100 - 1) * rFactor);
        const dx = moveX * rFactor;
        const dy = moveY * rFactor;
        const dRot = rotate * rFactor;

        const cx = n.x + n.width / 2;
        const cy = n.y + n.height / 2;
        const newW = Math.max(2, n.width * sx);
        const newH = Math.max(2, n.height * sy);

        n.x = cx - newW / 2 + dx;
        n.y = cy - newH / 2 + dy;
        n.width = newW;
        n.height = newH;
        n.rotation = (n.rotation + dRot) % 360;

        n.points = (n.points || []).map((pt) => ({
          ...pt,
          x: cx + (pt.x - cx) * sx + dx,
          y: cy + (pt.y - cy) * sy + dy,
          handleIn: pt.handleIn
            ? {
                x: cx + (pt.handleIn.x - cx) * sx + dx,
                y: cy + (pt.handleIn.y - cy) * sy + dy,
              }
            : undefined,
          handleOut: pt.handleOut
            ? {
                x: cx + (pt.handleOut.x - cx) * sx + dx,
                y: cy + (pt.handleOut.y - cy) * sy + dy,
              }
            : undefined,
        }));
      },
      'Transform Each'
    );
  },

  addLayer: (name) => {
    const colors = ['#4f9eff', '#ff4f4f', '#4fcf5f', '#ff4fcf', '#00d9ff', '#ff9a00'];
    get().updateDocument((d) => {
      const idx = d.layers.length + 1;
      const newLayer: LayerItem = {
        id: `layer-${Date.now()}`,
        name: name || `Layer ${idx}`,
        color: colors[(idx - 1) % colors.length],
        visible: true,
        locked: false,
        outlineMode: false,
        templateMode: false,
        expanded: true,
        nodeIds: [],
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      };
      d.layers.unshift(newLayer);
      d.activeLayerId = newLayer.id;
    }, 'Add New Layer');
  },

  deleteLayer: (layerId) => {
    get().updateDocument((d) => {
      if (d.layers.length <= 1) return;
      const target = d.layers.find((l) => l.id === layerId);
      if (target) {
        for (const nid of target.nodeIds) {
          delete d.nodes[nid];
        }
      }
      d.layers = d.layers.filter((l) => l.id !== layerId);
      if (d.activeLayerId === layerId) {
        d.activeLayerId = d.layers[0].id;
      }
    }, 'Delete Layer');
  },

  updateLayer: (layerId, patch) => {
    get().updateDocument((d) => {
      const l = d.layers.find((item) => item.id === layerId);
      if (l) Object.assign(l, patch);
    }, 'Update Layer');
  },

  setActiveLayerId: (layerId) => {
    get().updateDocument((d) => {
      d.activeLayerId = layerId;
    }, 'Select Active Layer');
  },

  reorderLayers: (fromIdx, toIdx) => {
    get().updateDocument((d) => {
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= d.layers.length || toIdx >= d.layers.length) return;
      const [moved] = d.layers.splice(fromIdx, 1);
      d.layers.splice(toIdx, 0, moved);
    }, 'Reorder Layers');
  },

  collectInNewLayer: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateDocument((d) => {
      const newLayerId = `layer-${Date.now()}`;
      const newLayer: LayerItem = {
        id: newLayerId,
        name: `Collected Layer (${s.selectedNodeIds.length})`,
        color: '#00d9ff',
        visible: true,
        locked: false,
        outlineMode: false,
        templateMode: false,
        expanded: true,
        nodeIds: [...s.selectedNodeIds],
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      };
      const selSet = new Set(s.selectedNodeIds);
      for (const l of d.layers) {
        l.nodeIds = l.nodeIds.filter((id) => !selSet.has(id));
      }
      for (const id of s.selectedNodeIds) {
        if (d.nodes[id]) d.nodes[id].layerId = newLayerId;
      }
      d.layers.unshift(newLayer);
      d.activeLayerId = newLayerId;
    }, 'Collect in New Layer');
  },

  releaseToLayers: () => {
    const s = get();
    s.updateDocument((d) => {
      const activeLayer = d.layers.find((l) => l.id === d.activeLayerId) || d.layers[0];
      if (!activeLayer || activeLayer.nodeIds.length <= 1) return;
      const colors = ['#4f9eff', '#ff4f4f', '#4fcf5f', '#ff4fcf', '#00d9ff', '#ff9a00'];
      activeLayer.nodeIds.forEach((nid, idx) => {
        const subLayer: LayerItem = {
          id: `layer-rel-${Date.now()}-${idx}`,
          name: `${activeLayer.name} - Seq ${idx + 1}`,
          color: colors[idx % colors.length],
          visible: true,
          locked: false,
          outlineMode: false,
          templateMode: false,
          expanded: true,
          nodeIds: [nid],
          effects: [],
          opacity: 1,
          blendMode: 'normal',
        };
        if (d.nodes[nid]) d.nodes[nid].layerId = subLayer.id;
        d.layers.push(subLayer);
      });
      activeLayer.nodeIds = [];
    }, 'Release to Layers (Sequence)');
  },

  addArtboard: (spec) => {
    get().updateDocument((d) => {
      const last = d.artboards[d.artboards.length - 1] || {
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
      };
      const idx = d.artboards.length + 1;
      const w = spec?.width ?? last.width;
      const h = spec?.height ?? last.height;
      const newAb: ArtboardItem = {
        id: `ab-${Date.now()}`,
        name: spec?.name ?? `Artboard ${idx}`,
        x: spec?.x ?? last.x + last.width + 120,
        y: spec?.y ?? last.y,
        width: w,
        height: h,
        orientation: w >= h ? 'landscape' : 'portrait',
        showCenterMark: spec?.showCenterMark ?? false,
        showCrossHairs: spec?.showCrossHairs ?? false,
        showVideoSafeAreas: spec?.showVideoSafeAreas ?? false,
        backgroundColor: spec?.backgroundColor ?? '#ffffff',
      };
      d.artboards.push(newAb);
      d.activeArtboardId = newAb.id;
    }, 'New Artboard');
  },

  deleteArtboard: (artboardId) => {
    get().updateDocument((d) => {
      if (d.artboards.length <= 1) return;
      d.artboards = d.artboards.filter((a) => a.id !== artboardId);
      if (d.activeArtboardId === artboardId) {
        d.activeArtboardId = d.artboards[0].id;
      }
    }, 'Delete Artboard');
  },

  updateArtboard: (artboardId, patch, options) => {
    const s = get();
    s.updateDocument(
      (d) => {
        const ab = d.artboards.find((a) => a.id === artboardId);
        if (!ab) return;
        const dx = patch.x !== undefined ? patch.x - ab.x : 0;
        const dy = patch.y !== undefined ? patch.y - ab.y : 0;

        if (s.moveArtworkWithArtboard && (dx !== 0 || dy !== 0)) {
          for (const n of Object.values(d.nodes)) {
            if (
              n.x + n.width >= ab.x &&
              n.x <= ab.x + ab.width &&
              n.y + n.height >= ab.y &&
              n.y <= ab.y + ab.height
            ) {
              n.x += dx;
              n.y += dy;
              n.points = (n.points || []).map((pt) => ({
                ...pt,
                x: pt.x + dx,
                y: pt.y + dy,
                handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
                handleOut: pt.handleOut
                  ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy }
                  : undefined,
              }));
            }
          }
        }

        Object.assign(ab, patch);
        if (patch.width !== undefined || patch.height !== undefined) {
          ab.orientation = ab.width >= ab.height ? 'landscape' : 'portrait';
        }
      },
      'Modify Artboard',
      options
    );
  },

  setActiveArtboardId: (artboardId) => {
    get().updateDocument((d) => {
      d.activeArtboardId = artboardId;
    }, 'Switch Active Artboard');
  },

  rearrangeArtboards: (columns = 2, spacing = 120) => {
    const cols = Math.max(1, columns);
    get().updateDocument((d) => {
      let curX = 0;
      let curY = 0;
      let rowMaxH = 0;
      d.artboards.forEach((ab, idx) => {
        if (idx > 0 && idx % cols === 0) {
          curX = 0;
          curY += rowMaxH + spacing;
          rowMaxH = 0;
        }
        ab.x = curX;
        ab.y = curY;
        curX += ab.width + spacing;
        rowMaxH = Math.max(rowMaxH, ab.height);
      });
    }, 'Rearrange All Artboards');
  },

  fitArtboardToArtwork: (selectedOnly = false) => {
    const s = get();
    s.updateDocument((d) => {
      const targetNodes = selectedOnly
        ? s.selectedNodeIds.map((id) => d.nodes[id]).filter(Boolean)
        : Object.values(d.nodes).filter((n) => n.visible);
      if (targetNodes.length === 0) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of targetNodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      }
      const ab = d.artboards.find((a) => a.id === d.activeArtboardId) || d.artboards[0];
      if (ab) {
        ab.x = Math.round(minX - 24);
        ab.y = Math.round(minY - 24);
        ab.width = Math.max(50, Math.round(maxX - minX + 48));
        ab.height = Math.max(50, Math.round(maxY - minY + 48));
      }
    }, 'Fit Artboard to Artwork Bounds');
  },

  addGuide: (orientation, position) => {
    get().updateDocument((d) => {
      d.guides.push({
        id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        orientation,
        position,
        locked: false,
      });
    }, 'Add Ruler Guide');
  },

  removeGuide: (guideId) => {
    get().updateDocument((d) => {
      d.guides = d.guides.filter((g) => g.id !== guideId);
    }, 'Remove Guide');
  },

  clearGuides: () => {
    get().updateDocument((d) => {
      d.guides = [];
    }, 'Clear Guides');
  },

  makeGuidesFromSelection: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(s.selectedNodeIds, { isGuide: true }, 'Make Guides (Ctrl+5)');
  },

  releaseGuides: () => {
    const s = get();
    s.updateDocument((d) => {
      for (const n of Object.values(d.nodes)) {
        if (n.isGuide) n.isGuide = false;
      }
    }, 'Release Guides (Alt+Ctrl+5)');
  },

  addSlice: (slice) => {
    get().updateDocument((d) => {
      d.slices.push(slice);
    }, 'Create Slice');
  },

  removeSlice: (sliceId) => {
    get().updateDocument((d) => {
      d.slices = d.slices.filter((sl) => sl.id !== sliceId);
    }, 'Delete Slice');
  },

  runPathfinder: (op, asCompoundShape = false) => {
    const s = get();
    const doc = s.getActiveDocument();
    const order = [...doc.layers].reverse().flatMap(layer => layer.nodeIds);
    const selNodes = s.selectedNodeIds.map(id => doc.nodes[id]).filter(Boolean)
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    if (selNodes.length < 2) {
      set({ statusMessage: 'Pathfinder requires at least 2 selected vector objects.' });
      return;
    }
    if (asCompoundShape) {
      set({ statusMessage: 'Live compound shapes are not supported yet. Use the regular Pathfinder operation.' });
      return;
    }
    const supported = new Set(['path', 'rectangle', 'ellipse', 'polygon', 'star']);
    if (selNodes.some(node => !supported.has(node.type) || node.closed === false || node.parentId || node.locked ||
      !node.visible || node.effects?.some(effect => effect.enabled) || node.envelopeSpec ||
      !doc.layers.some(layer => layer.id === node.layerId && layer.visible && !layer.locked))) {
      set({ statusMessage: 'Pathfinder requires unlocked, visible, closed vector shapes outside groups, without live effects.' });
      return;
    }
    let results: VectorNode[];
    try {
      results = performPathfinder(selNodes, op);
    } catch (error) {
      set({ statusMessage: `Pathfinder failed; original artwork was kept. ${error instanceof Error ? error.message : ''}` });
      return;
    }
    if (results.length === 0) {
      set({ statusMessage: `Pathfinder ${op}: No overlapping area produced.` });
      return;
    }

    const newIds: string[] = [];
    const oldSet = new Set(s.selectedNodeIds);
    s.updateDocument((d) => {
      const layer = d.layers.find((l) => l.id === selNodes[selNodes.length - 1].layerId) || d.layers[0];
      const topIndex = layer.nodeIds.lastIndexOf(selNodes[selNodes.length - 1].id);
      const insertIndex = topIndex < 0 ? layer.nodeIds.length : layer.nodeIds.slice(0, topIndex).filter(id => !oldSet.has(id)).length;
      for (const oldId of oldSet) delete d.nodes[oldId];
      for (const existingLayer of d.layers) existingLayer.nodeIds = existingLayer.nodeIds.filter((id) => !oldSet.has(id));
      for (const rNode of results) {
        rNode.layerId = layer.id;
        d.nodes[rNode.id] = rNode;
        newIds.push(rNode.id);
      }
      layer.nodeIds.splice(insertIndex, 0, ...newIds);
    }, `Pathfinder: ${op.toUpperCase()}`);

    s.selectNodes(newIds, false);
  },

  alignNodes: (op, targetOverride, spacingValue = 16) => {
    const s = get();
    const targetMode = targetOverride ?? s.alignTarget;
    if (s.selectedNodeIds.length === 0) return;

    s.updateDocument((d) => {
      const nodes = s.selectedNodeIds.map((id) => d.nodes[id]).filter(Boolean);
      if (nodes.length === 0) return;

      let refBounds = { x: 0, y: 0, width: 100, height: 100 };
      if (targetMode === 'artboard') {
        const ab = d.artboards.find((a) => a.id === d.activeArtboardId) || d.artboards[0];
        if (ab) refBounds = { x: ab.x, y: ab.y, width: ab.width, height: ab.height };
      } else if (targetMode === 'key-object' && s.keyObjectId && d.nodes[s.keyObjectId]) {
        const k = d.nodes[s.keyObjectId];
        refBounds = { x: k.x, y: k.y, width: k.width, height: k.height };
      } else {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of nodes) {
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x + n.width);
          maxY = Math.max(maxY, n.y + n.height);
        }
        refBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }

      const shiftNode = (n: VectorNode, newX: number, newY: number) => {
        const dx = newX - n.x;
        const dy = newY - n.y;
        n.x = newX;
        n.y = newY;
        n.points = (n.points || []).map((pt) => ({
          ...pt,
          x: pt.x + dx,
          y: pt.y + dy,
          handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
          handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
        }));
      };

      if (op === 'distribute-h' && nodes.length >= 3) {
        const sorted = [...nodes].sort((a, b) => a.x - b.x);
        const startX = sorted[0].x;
        const endX = sorted[sorted.length - 1].x;
        const step = (endX - startX) / (sorted.length - 1);
        sorted.forEach((n, idx) => shiftNode(n, startX + step * idx, n.y));
        return;
      }

      if (op === 'distribute-v' && nodes.length >= 3) {
        const sorted = [...nodes].sort((a, b) => a.y - b.y);
        const startY = sorted[0].y;
        const endY = sorted[sorted.length - 1].y;
        const step = (endY - startY) / (sorted.length - 1);
        sorted.forEach((n, idx) => shiftNode(n, n.x, startY + step * idx));
        return;
      }

      if (op === 'spacing-h' && nodes.length >= 2) {
        const sorted = [...nodes].sort((a, b) => a.x - b.x);
        let cursor = sorted[0].x + sorted[0].width + spacingValue;
        for (let i = 1; i < sorted.length; i++) {
          shiftNode(sorted[i], cursor, sorted[i].y);
          cursor += sorted[i].width + spacingValue;
        }
        return;
      }

      if (op === 'spacing-v' && nodes.length >= 2) {
        const sorted = [...nodes].sort((a, b) => a.y - b.y);
        let cursor = sorted[0].y + sorted[0].height + spacingValue;
        for (let i = 1; i < sorted.length; i++) {
          shiftNode(sorted[i], sorted[i].x, cursor);
          cursor += sorted[i].height + spacingValue;
        }
        return;
      }

      for (const n of nodes) {
        if (targetMode === 'key-object' && n.id === s.keyObjectId) continue;
        switch (op) {
          case 'left':
            shiftNode(n, refBounds.x, n.y);
            break;
          case 'center-h':
            shiftNode(n, refBounds.x + (refBounds.width - n.width) / 2, n.y);
            break;
          case 'right':
            shiftNode(n, refBounds.x + refBounds.width - n.width, n.y);
            break;
          case 'top':
            shiftNode(n, n.x, refBounds.y);
            break;
          case 'center-v':
            shiftNode(n, n.x, refBounds.y + (refBounds.height - n.height) / 2);
            break;
          case 'bottom':
            shiftNode(n, n.x, refBounds.y + refBounds.height - n.height);
            break;
        }
      }
    }, `Align Objects (${op})`);
  },

  joinSelectedPaths: (averageFirst = false) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateDocument((d) => {
      if (s.selectedNodeIds.length === 1) {
        const n = d.nodes[s.selectedNodeIds[0]];
        if (n) n.closed = true;
        return;
      }
      const first = d.nodes[s.selectedNodeIds[0]];
      const second = d.nodes[s.selectedNodeIds[1]];
      if (!first || !second) return;
      const ptsA = [...(first.points || [])];
      const ptsB = [...(second.points || [])];
      if (averageFirst && ptsA.length > 0 && ptsB.length > 0) {
        const lastA = ptsA[ptsA.length - 1];
        const firstB = ptsB[0];
        const mx = (lastA.x + firstB.x) / 2;
        const my = (lastA.y + firstB.y) / 2;
        lastA.x = mx;
        lastA.y = my;
        firstB.x = mx;
        firstB.y = my;
      }
      first.points = [...ptsA, ...ptsB];
      const bounds = computeBoundingBoxFromAnchors(first.points, first.closed);
      first.x = bounds.x;
      first.y = bounds.y;
      first.width = bounds.width;
      first.height = bounds.height;
      delete d.nodes[second.id];
      for (const l of d.layers) {
        l.nodeIds = l.nodeIds.filter((id) => id !== second.id);
      }
    }, 'Join Paths (Ctrl+J)');
  },

  averageSelectedAnchors: (axis) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        if (!n.points || n.points.length < 2) return;
        const avgX = n.points.reduce((acc, p) => acc + p.x, 0) / n.points.length;
        const avgY = n.points.reduce((acc, p) => acc + p.y, 0) / n.points.length;
        n.points = n.points.map((pt) => ({
          ...pt,
          x: axis === 'horizontal' || axis === 'both' ? avgX : pt.x,
          y: axis === 'vertical' || axis === 'both' ? avgY : pt.y,
        }));
      },
      `Average Anchors (${axis})`
    );
  },

  offsetSelectedPaths: (offset, joins = 'miter', miterLimit = 4) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const newIds: string[] = [];
    s.updateDocument((d) => {
      for (const id of s.selectedNodeIds) {
        const orig = d.nodes[id];
        if (!orig) continue;
        const offsetNode = offsetVectorNode(orig, offset, joins, miterLimit);
        d.nodes[offsetNode.id] = offsetNode;
        const layer = d.layers.find((l) => l.id === orig.layerId) || d.layers[0];
        layer.nodeIds.push(offsetNode.id);
        newIds.push(offsetNode.id);
      }
    }, `Offset Path (${offset}pt)`);
    if (newIds.length > 0) s.selectNodes(newIds, false);
  },

  simplifySelectedPaths: (curvePrecision = 75, angleThreshold = 35) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        if (n.points && n.points.length > 3) {
          n.points = simplifyPathPoints(n.points, n.closed, curvePrecision, angleThreshold);
        }
      },
      'Simplify Path'
    );
  },

  outlineSelectedStrokes: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const newIds: string[] = [];
    s.updateDocument((d) => {
      for (const id of s.selectedNodeIds) {
        const orig = d.nodes[id];
        if (!orig) continue;
        const outlined = outlineStrokeNode(orig);
        d.nodes[outlined.id] = outlined;
        const layer = d.layers.find((l) => l.id === orig.layerId) || d.layers[0];
        const idx = layer.nodeIds.indexOf(id);
        if (idx >= 0) {
          layer.nodeIds.splice(idx, 1, outlined.id);
        } else {
          layer.nodeIds.push(outlined.id);
        }
        delete d.nodes[id];
        newIds.push(outlined.id);
      }
    }, 'Outline Stroke');
    if (newIds.length > 0) s.selectNodes(newIds, false);
  },

  splitSelectedIntoGrid: (options) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    const newIds: string[] = [];
    s.updateDocument((d) => {
      for (const id of s.selectedNodeIds) {
        const orig = d.nodes[id];
        if (!orig) continue;
        const cells = splitIntoGridNodes(orig, options);
        const layer = d.layers.find((l) => l.id === orig.layerId) || d.layers[0];
        layer.nodeIds = layer.nodeIds.filter((nid) => nid !== id);
        delete d.nodes[id];
        for (const cell of cells) {
          cell.layerId = layer.id;
          d.nodes[cell.id] = cell;
          layer.nodeIds.push(cell.id);
          newIds.push(cell.id);
        }
      }
    }, `Split Into Grid (${options.rows}×${options.cols})`);
    if (newIds.length > 0) s.selectNodes(newIds, false);
  },

  cleanUpDocument: () => {
    let removedCount = 0;
    get().updateDocument((d) => {
      for (const [id, n] of Object.entries(d.nodes)) {
        const isStray = n.type === 'path' && n.points.length <= 1;
        const isEmptyText = n.type === 'text' && (!n.textContent || !n.textContent.trim());
        if (isStray || isEmptyText) {
          delete d.nodes[id];
          for (const l of d.layers) {
            l.nodeIds = l.nodeIds.filter((nid) => nid !== id);
          }
          removedCount++;
        }
      }
    }, `Clean Up Document (${removedCount} stray items removed)`);
  },

  addFillToSelection: (color = '#1473e6') => {
    const s = get();
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        n.fills.unshift({
          id: makeAnchorId('fill'),
          visible: true,
          type: 'solid',
          color,
          opacity: 1,
          blendMode: 'normal',
        });
      },
      'Add New Fill'
    );
  },

  addStrokeToSelection: (color = '#1e1b4b', weight = 2) => {
    const s = get();
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        n.strokes.unshift({
          id: makeAnchorId('stroke'),
          visible: true,
          color,
          weight,
          cap: 'round',
          join: 'round',
          miterLimit: 4,
          align: 'center',
          dashArray: [],
          opacity: 1,
          blendMode: 'normal',
        });
      },
      'Add New Stroke'
    );
  },

  addLiveEffectToSelection: (type, params = {}) => {
    const s = get();
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        n.effects.push({
          id: makeAnchorId('fx'),
          type,
          name: type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          enabled: true,
          params,
        });
      },
      `Add Effect: ${type}`
    );
  },

  removeLiveEffectFromSelection: (effectId) => {
    const s = get();
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        n.effects = n.effects.filter((e) => e.id !== effectId);
      },
      'Remove Live Effect'
    );
  },

  applyGraphicStyle: (styleId, merge = false) => {
    const s = get();
    const doc = s.getActiveDocument();
    const style = doc.graphicStyles.find((g) => g.id === styleId);
    if (!style || s.selectedNodeIds.length === 0) return;

    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        const clonedFills: FillItem[] = JSON.parse(JSON.stringify(style.fills));
        const clonedStrokes: StrokeItem[] = JSON.parse(JSON.stringify(style.strokes));
        const clonedEffects: LiveEffectItem[] = JSON.parse(JSON.stringify(style.effects));
        if (merge) {
          n.fills = [...clonedFills, ...n.fills];
          n.strokes = [...clonedStrokes, ...n.strokes];
          n.effects = [...n.effects, ...clonedEffects];
        } else {
          n.fills = clonedFills;
          n.strokes = clonedStrokes;
          n.effects = clonedEffects;
          n.opacity = style.opacity;
          n.blendMode = style.blendMode;
        }
      },
      `Apply Graphic Style "${style.name}"`
    );
  },

  saveSelectionAsGraphicStyle: (name) => {
    const s = get();
    const doc = s.getActiveDocument();
    const primary = doc.nodes[s.selectedNodeIds[0]];
    if (!primary) return;

    s.updateDocument((d) => {
      d.graphicStyles.push({
        id: `gs-${Date.now()}`,
        name: name.trim() || `Style ${d.graphicStyles.length + 1}`,
        fills: JSON.parse(JSON.stringify(primary.fills)),
        strokes: JSON.parse(JSON.stringify(primary.strokes)),
        effects: JSON.parse(JSON.stringify(primary.effects)),
        opacity: primary.opacity,
        blendMode: primary.blendMode,
      });
    }, `Save Graphic Style "${name}"`);
  },

  expandAppearance: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        const poly = nodeToPolygon(n, 14);
        n.points = polygonToAnchors(poly, n.closed);
        n.type = 'path';
        n.envelopeSpec = undefined;
        n.effects = n.effects.filter(
          (fx) => fx.type === 'drop-shadow' || fx.type === 'outer-glow' || fx.type === 'gaussian-blur'
        );
      },
      'Expand Appearance'
    );
  },

  createOutlinesFromSelection: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        if (n.type === 'text') {
          n.type = 'compound-path';
          n.name = `${n.textContent || 'Type'} (Outlines)`;
          n.points = createRectangleAnchors(n.x, n.y, n.width, n.height, 4, 'round');
          n.closed = true;
        }
      },
      'Create Outlines (Shift+Ctrl+O)'
    );
  },

  makeClippingMask: () => {
    const s = get();
    if (s.selectedNodeIds.length < 2) return;
    let clipGroupId = '';
    s.updateDocument((d) => {
      const nodes = s.selectedNodeIds.map((id) => d.nodes[id]).filter(Boolean);
      if (nodes.length < 2) return;
      const topMask = nodes[nodes.length - 1];
      clipGroupId = makeAnchorId('clipgrp');
      const layer = d.layers.find((l) => l.id === topMask.layerId) || d.layers[0];
      d.nodes[clipGroupId] = {
        ...topMask,
        id: clipGroupId,
        name: '<Clipping Group>',
        type: 'clipping-group',
        children: nodes.map((n) => n.id),
      };
      layer.nodeIds.push(clipGroupId);
    }, 'Make Clipping Mask (Ctrl+7)');
    if (clipGroupId) s.selectNodes([clipGroupId], false);
  },

  releaseClippingMask: () => {
    get().ungroupSelection();
  },

  makeCompoundPath: () => {
    const s = get();
    if (s.selectedNodeIds.length < 2) return;
    let cpId = '';
    s.updateDocument((d) => {
      const nodes = s.selectedNodeIds.map((id) => d.nodes[id]).filter(Boolean);
      if (nodes.length < 2) return;
      const allAnchors: AnchorPoint[] = [];
      for (const n of nodes) {
        allAnchors.push(...polygonToAnchors(nodeToPolygon(n, 10), true));
      }
      const bounds = computeBoundingBoxFromAnchors(allAnchors, true);
      const top = nodes[nodes.length - 1];
      cpId = makeAnchorId('cpath');
      const layer = d.layers.find((l) => l.id === top.layerId) || d.layers[0];
      d.nodes[cpId] = {
        ...top,
        id: cpId,
        name: '<Compound Path>',
        type: 'compound-path',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        points: allAnchors,
        fillRule: 'evenodd',
        children: nodes.map((n) => n.id),
      };
      layer.nodeIds.push(cpId);
    }, 'Make Compound Path (Ctrl+8)');
    if (cpId) s.selectNodes([cpId], false);
  },

  releaseCompoundPath: () => {
    get().ungroupSelection();
  },

  makeBlend: (mode = 'steps', steps = 6) => {
    const s = get();
    const doc = s.getActiveDocument();
    const nodes = s.selectedNodeIds.map(id => doc.nodes[id]).filter(Boolean);
    if (nodes.length !== 2 || !canBlend(nodes[0], nodes[1]) || !doc.layers.some(layer => layer.id === nodes[0].layerId && layer.visible && !layer.locked && nodes.every(n => layer.nodeIds.includes(n.id)))) {
      if (typeof window !== 'undefined') window.alert('Blend requires two unlocked single-contour vectors on the same visible layer, both open or both closed, with simple solid styles.');
      return;
    }
    const [first, last] = nodes;
    const blendId = makeAnchorId('blend');
    s.updateDocument(d => {
      const layer = d.layers.find(l => l.id === first.layerId)!;
      const index = Math.max(layer.nodeIds.indexOf(first.id), layer.nodeIds.indexOf(last.id));
      layer.nodeIds.splice(index + 1, 0, blendId);
      d.nodes[first.id].parentId = blendId;
      d.nodes[last.id].parentId = blendId;
      const x = Math.min(first.x, last.x), y = Math.min(first.y, last.y);
      d.nodes[blendId] = {
        id: blendId, name: '<Blend>', type: 'blend', layerId: layer.id, visible: true, locked: false,
        x, y, width: Math.max(first.x + first.width, last.x + last.width) - x,
        height: Math.max(first.y + first.height, last.y + last.height) - y,
        rotation: 0, points: [], closed: false, children: [first.id, last.id], fills: [], strokes: [], effects: [], opacity: 1, blendMode: 'normal',
        blendSpec: { mode, steps: Math.max(1, Math.min(250, Number.isFinite(steps) ? Math.round(steps) : 6)) },
      };
    }, 'Make Blend');
    s.selectNodes([blendId], false);
  },

  releaseBlend: () => {
    const s = get();
    const ids = s.selectedNodeIds.filter(id => s.getActiveDocument().nodes[id]?.type === 'blend');
    if (!ids.length) return;
    const released: string[] = [];
    s.updateDocument(d => {
      for (const id of ids) {
        const blend = d.nodes[id];
        if (!blend || blend.parentId) continue;
        for (const childId of blend.children || []) {
          const child = d.nodes[childId];
          if (child && child.parentId === id) { child.parentId = undefined; released.push(childId); }
        }
        for (const layer of d.layers) layer.nodeIds = layer.nodeIds.filter(nid => nid !== id);
        delete d.nodes[id];
      }
    }, 'Release Blend');
    if (released.length) s.selectNodes(released, false);
  },

  makeEnvelopeWarp: (warpStyle = 'arc', bend = 45, hDistort = 0, vDistort = 0) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        n.envelopeSpec = {
          mode: 'warp',
          warpStyle,
          bend,
          hDistort,
          vDistort,
        };
      },
      `Envelope Warp (${warpStyle})`
    );
  },

  makeEnvelopeMesh: (rows = 4, cols = 4) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        n.envelopeSpec = {
          mode: 'mesh',
          rows,
          cols,
          bend: 20,
        };
      },
      `Envelope Mesh (${rows}×${cols})`
    );
  },

  makeEnvelopeTopObject: () => {
    const s = get();
    if (s.selectedNodeIds.length < 2) return;
    const targetId = s.selectedNodeIds[0];
    s.updateNode(
      targetId,
      (n) => {
        n.envelopeSpec = { mode: 'top-object', bend: 35 };
      },
      'Make Envelope with Top Object (Alt+Ctrl+C)'
    );
  },

  releaseEnvelope: () => {
    const s = get();
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        n.envelopeSpec = undefined;
      },
      'Release Envelope'
    );
  },

  makeLivePaintGroup: () => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    let lpgId = '';
    s.updateDocument((d) => {
      const nodes = s.selectedNodeIds.map((id) => d.nodes[id]).filter(Boolean);
      if (nodes.length === 0) return;
      const faces = computeLivePaintFaces(nodes);
      const first = nodes[0];
      lpgId = makeAnchorId('lpg');
      const layer = d.layers.find((l) => l.id === first.layerId) || d.layers[0];
      d.nodes[lpgId] = {
        ...first,
        id: lpgId,
        name: '<Live Paint Group>',
        type: 'live-paint-group',
        children: nodes.map((n) => n.id),
        livePaintFaces: faces,
      };
      layer.nodeIds.push(lpgId);
    }, 'Make Live Paint Group (Alt+Ctrl+X)');
    if (lpgId) s.selectNodes([lpgId], false);
  },

  expandLivePaintGroup: () => {
    get().ungroupSelection();
  },

  createGradientMesh: (rows = 4, cols = 4) => {
    const s = get();
    if (s.selectedNodeIds.length === 0) return;
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        const baseColor = n.fills[0]?.color && n.fills[0]?.color !== 'none' ? n.fills[0].color : '#ff9a00';
        const pts: MeshPoint[] = [];
        for (let r = 0; r <= rows; r++) {
          for (let c = 0; c <= cols; c++) {
            const isCenter = r > 0 && r < rows && c > 0 && c < cols;
            pts.push({
              row: r,
              col: c,
              x: n.x + (c / cols) * n.width,
              y: n.y + (r / rows) * n.height,
              color: isCenter ? '#ffffff' : baseColor,
              opacity: 1,
            });
          }
        }
        n.type = 'mesh';
        n.meshGrid = { rows, cols, points: pts };
      },
      `Create Gradient Mesh (${rows}×${cols})`
    );
  },

  addSwatch: (swatch) => {
    get().updateDocument((d) => {
      d.swatches.push(swatch);
    }, `Add Swatch "${swatch.name}"`);
  },

  updateGlobalSwatch: (swatchId, newColor) => {
    get().updateDocument((d) => {
      const sw = d.swatches.find((s) => s.id === swatchId);
      if (!sw) return;
      const oldColor = sw.color;
      sw.color = newColor;

      // Update every node in document linked to this global swatch or matching its color
      for (const n of Object.values(d.nodes)) {
        for (const f of n.fills) {
          if (f.globalSwatchId === swatchId || (sw.isGlobal && f.color === oldColor)) {
            f.color = newColor;
          }
        }
        for (const st of n.strokes) {
          if (st.globalSwatchId === swatchId || (sw.isGlobal && st.color === oldColor)) {
            st.color = newColor;
          }
        }
      }
    }, 'Update Global Color Swatch');
  },

  deleteSwatch: (swatchId) => {
    get().updateDocument((d) => {
      d.swatches = d.swatches.filter((s) => s.id !== swatchId);
    }, 'Delete Swatch');
  },

  recolorSelectedArtwork: (colorMap, hueShiftDeg = 0, satMult = 1, brightMult = 1) => {
    const s = get();
    const targetIds =
      s.selectedNodeIds.length > 0
        ? s.selectedNodeIds
        : Object.keys(s.getActiveDocument().nodes);

    s.updateNodes(
      targetIds,
      (n) => {
        for (const f of n.fills) {
          if (f.color && f.color !== 'none') {
            const mapped = colorMap[f.color.toLowerCase()] ?? f.color;
            f.color =
              hueShiftDeg !== 0 || satMult !== 1 || brightMult !== 1
                ? shiftColorHarmony(mapped, hueShiftDeg, satMult, brightMult)
                : mapped;
          }
          if (f.gradient) {
            f.gradient.stops = f.gradient.stops.map((st) => ({
              ...st,
              color:
                hueShiftDeg !== 0 || satMult !== 1 || brightMult !== 1
                  ? shiftColorHarmony(
                      colorMap[st.color.toLowerCase()] ?? st.color,
                      hueShiftDeg,
                      satMult,
                      brightMult
                    )
                  : colorMap[st.color.toLowerCase()] ?? st.color,
            }));
          }
        }
        for (const st of n.strokes) {
          if (st.color && st.color !== 'none') {
            const mapped = colorMap[st.color.toLowerCase()] ?? st.color;
            st.color =
              hueShiftDeg !== 0 || satMult !== 1 || brightMult !== 1
                ? shiftColorHarmony(mapped, hueShiftDeg, satMult, brightMult)
                : mapped;
          }
        }
      },
      'Recolor Artwork'
    );
  },

  addSymbolFromSelection: (name, isDynamic = true) => {
    const s = get();
    const doc = s.getActiveDocument();
    const primary = doc.nodes[s.selectedNodeIds[0]];
    if (!primary) return;

    s.updateDocument((d) => {
      const sym: SymbolItem = {
        id: `sym-${Date.now()}`,
        name: name?.trim() || `${primary.name} Symbol`,
        isDynamic,
        previewColor: primary.fills[0]?.color || '#ff9a00',
        paths: [
          {
            d: 'M 12 12 L 52 12 L 52 52 L 12 52 Z',
            fill: primary.fills[0]?.color || '#ff9a00',
            stroke: primary.strokes[0]?.color || '#1e1b4b',
          },
        ],
      };
      d.symbols.push(sym);
    }, 'Create New Symbol (F8)');
  },

  placeSymbolInstance: (symbolId, x = 320, y = 240) => {
    const s = get();
    const doc = s.getActiveDocument();
    const sym = doc.symbols.find((item) => item.id === symbolId) || doc.symbols[0];
    if (!sym) return;

    const instNode: VectorNode = {
      id: makeAnchorId('syminst'),
      name: `<Symbol: ${sym.name}>`,
      type: 'symbol-instance',
      symbolId: sym.id,
      layerId: doc.activeLayerId,
      visible: true,
      locked: false,
      x,
      y,
      width: 64,
      height: 64,
      rotation: 0,
      points: createRectangleAnchors(x, y, 64, 64),
      closed: true,
      fills: [
        {
          id: makeAnchorId('fill'),
          visible: true,
          type: 'solid',
          color: sym.previewColor,
          opacity: 1,
          blendMode: 'normal',
        },
      ],
      strokes: [],
      effects: [],
      opacity: 1,
      blendMode: 'normal',
    };
    s.addNode(instNode, `Place Symbol "${sym.name}"`);
  },

  breakSymbolLink: () => {
    const s = get();
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        if (n.type === 'symbol-instance') {
          n.type = 'path';
          n.symbolId = undefined;
          n.name = n.name.replace('<Symbol:', '').replace('>', '').trim();
        }
      },
      'Break Link to Symbol'
    );
  },

  addBrush: (brush) => {
    get().updateDocument((d) => {
      d.brushes.push(brush);
    }, `Add Brush "${brush.name}"`);
  },

  addExportAssetFromSelection: () => {
    const s = get();
    const doc = s.getActiveDocument();
    if (s.selectedNodeIds.length === 0) return;

    s.updateDocument((d) => {
      for (const id of s.selectedNodeIds) {
        const n = doc.nodes[id];
        if (!n) continue;
        d.exportAssets.push({
          id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: n.name.replace(/[<>]/g, '') || 'Vector-Asset',
          sourceNodeId: n.id,
          scales: ['1x', '2x'],
          formats: ['svg', 'png'],
        });
      }
    }, 'Collect Selection for Asset Export');
  },

  removeExportAsset: (assetId) => {
    get().updateDocument((d) => {
      d.exportAssets = d.exportAssets.filter((a) => a.id !== assetId);
    }, 'Remove Export Asset');
  },

  // Convenience aliases used by UI components
  loadDocument: (doc: StudioDocument) => get().openDocument(doc),
  setDocument: (doc: StudioDocument) => get().openDocument(doc),
  setShowHomeDashboard: (show: boolean) => set({ showHomeScreen: show }),
  openModal: (modal: ActiveModalType) => set({ activeModal: modal }),
  setUITheme: (theme: UIThemeBrightness) => get().setUIBrightness(theme),
  setDocumentColorMode: (mode: ColorMode) =>
    get().updateDocument((d) => {
      d.colorMode = mode;
    }, `Document Color Mode: ${mode}`),
  setColorMode: (mode: ColorMode) =>
    get().updateDocument((d) => {
      d.colorMode = mode;
    }, `Document Color Mode: ${mode}`),
  pasteSelection: (mode?: string) =>
    get().pasteClipboard(
      mode === 'front'
        ? 'in-front'
        : mode === 'back'
        ? 'in-back'
        : mode === 'place'
        ? 'in-place'
        : 'normal'
    ),
  paste: () => get().pasteClipboard('normal'),
  pasteInFront: () => get().pasteClipboard('in-front'),
  pasteInBack: () => get().pasteClipboard('in-back'),
  pasteInPlace: () => get().pasteClipboard('in-place'),
  pasteOnAllArtboards: () => get().pasteClipboard('all-artboards'),
  outlineStrokeSelection: () => get().outlineSelectedStrokes(),
  outlineStroke: () => get().outlineSelectedStrokes(),
  createOutlinesFromText: () => get().createOutlinesFromSelection(),
  createOutlines: () => get().createOutlinesFromSelection(),
  deselectAll: () => get().clearSelection(),
  saveCurrentSelection: () => get().saveSelection(`Selection ${Date.now().toString().slice(-3)}`),
  selectByType: (nodeType: string) => {
    const doc = get().getActiveDocument();
    const ids = Object.values(doc.nodes)
      .filter((n) => n.visible && !n.locked && n.type === nodeType)
      .map((n) => n.id);
    get().selectNodes(ids, false);
  },
  changeTextCase: (caseMode: string) => {
    const s = get();
    s.updateNodes(
      s.selectedNodeIds,
      (n) => {
        if (!n.textContent) return;
        if (caseMode === 'uppercase') n.textContent = n.textContent.toUpperCase();
        else if (caseMode === 'lowercase') n.textContent = n.textContent.toLowerCase();
        else if (caseMode === 'titlecase') {
          n.textContent = n.textContent.replace(
            /\w\S*/g,
            (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
          );
        }
      },
      `Change Text Case (${caseMode})`
    );
  },
  toggleTextTypeMode: () => {
    set({ statusMessage: 'Text type is fixed when created. Click for point text or drag for area text.' });
  },
} as StudioStoreState));

