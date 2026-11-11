import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Link2,
  Unlink2,
  Shuffle,
  Download,
  Copy,
  Check,
  Upload,
  RefreshCw,
  Grid,
  Sparkles,
  Printer,
  FileCode,
  Sliders,
  Keyboard,
  BarChart3,
  Layers,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import type {
  ActiveModalType,
  ColorMode,
  Language,
  PatternItem,
  StudioDocument,
  UIThemeBrightness,
  UnitType,
  VectorNode,
} from '../../core/types';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import { AngleDial } from '../primitives/AngleDial';
import {
  DOCUMENT_PRESETS,
  createDefaultDocument,
  type DocumentPresetItem,
} from '../../core/presets/defaultPresets';
import { toPoints } from '../../core/math/units';
import {
  hexToRgb,
  rgbToHsb,
  hsbToRgb,
  rgbToHex,
  shiftColorHarmony,
} from '../../core/math/color';
import {
  applyEnvelopeDistortToPoints,
  computeBoundingBoxFromAnchors,
  createEllipseAnchors,
  createPolygonAnchors,
  createRectangleAnchors,
  createStarAnchors,
  makeAnchorId,
} from '../../core/math/bezier';
import {
  offsetVectorNode,
  simplifyPathPoints,
  splitIntoGridNodes,
} from '../../core/math/pathfinder';
import {
  exportDocumentToSvgString,
  triggerSvgDownload,
  type SvgStylingMode,
  type SvgFontMode,
  type SvgObjectIdMode,
} from '../../core/io/svgIo';
import { exportDocumentToPdfBytes, triggerPdfDownload } from '../../core/io/pdfExport';
import {
  exportDocumentToDataUrl,
  exportSliceToDataUrl,
  exportAssetToDataUrl,
  resolveScaleMultiplier,
  triggerDataUrlDownload,
  type RasterFormat,
} from '../../core/io/rasterExport';
import {
  IMAGE_TRACE_PRESETS,
  getImageTracePresetOptions,
  traceImageNodeToVectorNodes,
  type ImageTracePresetId,
} from '../../core/io/imageTrace';
import { saveCustomPresetToDb, saveProjectToDb, listCustomPresetsFromDb, type CustomDocumentPreset } from '../../core/io/db';

const DEFAULT_SHORTCUT_BINDINGS = [
  { id: 'sc-select', category: 'Tools', label: 'Selection Tool', key: 'V' },
  { id: 'sc-direct', category: 'Tools', label: 'Direct Selection Tool', key: 'A' },
  { id: 'sc-magic', category: 'Tools', label: 'Magic Wand Tool', key: 'Y' },
  { id: 'sc-lasso', category: 'Tools', label: 'Lasso Tool', key: 'Q' },
  { id: 'sc-pen', category: 'Tools', label: 'Pen Tool', key: 'P' },
  { id: 'sc-curvature', category: 'Tools', label: 'Curvature Tool', key: 'Shift+~' },
  { id: 'sc-type', category: 'Tools', label: 'Type Tool', key: 'T' },
  { id: 'sc-touch-type', category: 'Tools', label: 'Touch Type Tool', key: 'Shift+T' },
  { id: 'sc-line', category: 'Tools', label: 'Line Segment Tool', key: '\\' },
  { id: 'sc-rect', category: 'Tools', label: 'Rectangle Tool', key: 'M' },
  { id: 'sc-ellipse', category: 'Tools', label: 'Ellipse Tool', key: 'L' },
  { id: 'sc-brush', category: 'Tools', label: 'Paintbrush Tool', key: 'B' },
  { id: 'sc-blob', category: 'Tools', label: 'Blob Brush Tool', key: 'Shift+B' },
  { id: 'sc-pencil', category: 'Tools', label: 'Pencil Tool', key: 'N' },
  { id: 'sc-eraser', category: 'Tools', label: 'Eraser Tool', key: 'Shift+E' },
  { id: 'sc-scissors', category: 'Tools', label: 'Scissors Tool', key: 'C' },
  { id: 'sc-rotate', category: 'Tools', label: 'Rotate Tool', key: 'R' },
  { id: 'sc-reflect', category: 'Tools', label: 'Reflect Tool', key: 'O' },
  { id: 'sc-scale', category: 'Tools', label: 'Scale Tool', key: 'S' },
  { id: 'sc-width', category: 'Tools', label: 'Width Tool', key: 'Shift+W' },
  { id: 'sc-free-transform', category: 'Tools', label: 'Free Transform Tool', key: 'E' },
  { id: 'sc-shape-builder', category: 'Tools', label: 'Shape Builder Tool', key: 'Shift+M' },
  { id: 'sc-live-paint', category: 'Tools', label: 'Live Paint Bucket', key: 'K' },
  { id: 'sc-perspective', category: 'Tools', label: 'Perspective Grid Tool', key: 'Shift+P' },
  { id: 'sc-mesh', category: 'Tools', label: 'Mesh Tool', key: 'U' },
  { id: 'sc-gradient', category: 'Tools', label: 'Gradient Tool', key: 'G' },
  { id: 'sc-eyedropper', category: 'Tools', label: 'Eyedropper Tool', key: 'I' },
  { id: 'sc-blend', category: 'Tools', label: 'Blend Tool', key: 'W' },
  { id: 'sc-symbol-sprayer', category: 'Tools', label: 'Symbol Sprayer Tool', key: 'Shift+S' },
  { id: 'sc-graph', category: 'Tools', label: 'Column Graph Tool', key: 'J' },
  { id: 'sc-artboard', category: 'Tools', label: 'Artboard Tool', key: 'Shift+O' },
  { id: 'sc-slice', category: 'Tools', label: 'Slice Tool', key: 'Shift+K' },
  { id: 'sc-hand', category: 'Tools', label: 'Hand Tool', key: 'H' },
  { id: 'sc-zoom', category: 'Tools', label: 'Zoom Tool', key: 'Z' },
  { id: 'sc-group', category: 'Object', label: 'Group / Ungroup', key: 'Ctrl+G / Shift+Ctrl+G' },
  { id: 'sc-join', category: 'Object', label: 'Join Paths', key: 'Ctrl+J' },
  { id: 'sc-clip', category: 'Object', label: 'Make Clipping Mask', key: 'Ctrl+7' },
  { id: 'sc-compound', category: 'Object', label: 'Make Compound Path', key: 'Ctrl+8' },
  { id: 'sc-outlines', category: 'Type', label: 'Create Outlines', key: 'Shift+Ctrl+O' },
  { id: 'sc-outline-view', category: 'View', label: 'Outline / Preview View', key: 'Ctrl+Y' },
  { id: 'sc-export-screens', category: 'File', label: 'Export for Screens', key: 'Alt+Ctrl+E' },
  { id: 'sc-save-web', category: 'File', label: 'Save for Web (Legacy)', key: 'Alt+Shift+Ctrl+S' },
];

export const StudioModals: React.FC = () => {
  const store = useStudioStore() as any;
  const activeModal: ActiveModalType = store.activeModal || null;
  const doc: StudioDocument =
    store.document || store.activeDocument || createDefaultDocument();
  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeModal) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    (first || dialogRef.current)?.focus();
    return () => { if (previouslyFocused?.isConnected) previouslyFocused.focus(); };
  }, [activeModal]);

  const closeModal = () => {
    if (typeof store.setActiveModal === 'function') {
      store.setActiveModal(null);
    } else if (typeof store.closeModal === 'function') {
      store.closeModal();
    } else {
      useStudioStore.setState({ activeModal: null } as any);
    }
  };

  const mutateDocument = (
    updater: (draft: StudioDocument) => void,
    historyLabel = 'Modal Operation'
  ) => {
    if (typeof store.updateDocument === 'function') {
      store.updateDocument((draft: StudioDocument) => {
        updater(draft);
        saveProjectToDb(draft).catch(() => {});
      }, historyLabel);
      return;
    }
    if (typeof store.pushHistory === 'function') {
      store.pushHistory(historyLabel);
    }
    const nextDoc: StudioDocument = JSON.parse(JSON.stringify(doc));
    updater(nextDoc);
    nextDoc.updatedAt = Date.now();
    useStudioStore.setState((state: any) => ({
      ...state,
      document: nextDoc,
      activeDocument: nextDoc,
      documents: { ...(state.documents || {}), [nextDoc.id]: nextDoc },
    }));
    saveProjectToDb(nextDoc).catch(() => {});
  };

  // --- 1. NEW DOCUMENT MODAL STATE ---
  const [newDocCat, setNewDocCat] = useState<'saved' | 'mobile' | 'web' | 'print' | 'film' | 'art'>('web');
  const [newDocName, setNewDocName] = useState('Untitled-1');
  const [savedPresets, setSavedPresets] = useState<CustomDocumentPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  useEffect(() => {
    if (activeModal === 'new-document') listCustomPresetsFromDb().then(setSavedPresets).catch(() => setSavedPresets([]));
  }, [activeModal]);
  const [newDocW, setNewDocW] = useState(1920);
  const [newDocH, setNewDocH] = useState(1080);
  const [newDocUnit, setNewDocUnit] = useState<UnitType>('px');
  const [newDocOrientation, setNewDocOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [newDocArtboards, setNewDocArtboards] = useState(1);
  const [newDocBleedTop, setNewDocBleedTop] = useState(0);
  const [newDocBleedBottom, setNewDocBleedBottom] = useState(0);
  const [newDocBleedLeft, setNewDocBleedLeft] = useState(0);
  const [newDocBleedRight, setNewDocBleedRight] = useState(0);
  const [newDocBleedLinked, setNewDocBleedLinked] = useState(true);
  const [newDocColorMode, setNewDocColorMode] = useState<ColorMode>('RGB');
  const [newDocPpi, setNewDocPpi] = useState<72 | 150 | 300>(300);

  // --- 2. RECOLOR ARTWORK MODAL STATE ---
  const [linkHarmony, setLinkHarmony] = useState(true);
  const [hueDelta, setHueDelta] = useState(0);
  const [satMult, setSatMult] = useState(1);
  const [brightMult, setBrightMult] = useState(1);
  const [colorReduction, setColorReduction] = useState<'all' | '2' | '3' | '5' | 'grayscale'>('all');
  const [colorMappings, setColorMappings] = useState<Array<{ from: string; to: string }>>([]);

  // --- 3. EXPORT FOR SCREENS MODAL STATE ---
  const [exportTab, setExportTab] = useState<'artboards' | 'assets'>('artboards');
  const [selectedArtboardIds, setSelectedArtboardIds] = useState<string[]>([]);
  const [exportEntries, setExportEntries] = useState<
    Array<{ id: string; scale: '1x' | '2x' | '3x'; suffix: string; format: 'png' | 'svg' | 'pdf' | 'jpg' | 'webp' }>
  >([
    { id: 'exp-1', scale: '1x', suffix: '', format: 'png' },
    { id: 'exp-2', scale: '2x', suffix: '@2x', format: 'png' },
    { id: 'exp-3', scale: '1x', suffix: '', format: 'svg' },
  ]);

  // --- 4. SAVE FOR WEB (LEGACY) MODAL STATE ---
  const [webPresetFormat, setWebPresetFormat] = useState<'png-24' | 'png-8' | 'jpg' | 'webp'>('png-24');
  const [webQuality, setWebQuality] = useState(85);
  const [webTransparent, setWebTransparent] = useState(true);
  const [webMatte, setWebMatte] = useState('#ffffff');
  const [webScalePct, setWebScalePct] = useState(100);
  const [webSliceScope, setWebSliceScope] = useState<'all' | 'slices'>('all');

  // --- 5. PDF EXPORT MODAL STATE ---
  const [pdfUseDocBleed, setPdfUseDocBleed] = useState(true);
  const [pdfCustomBleed, setPdfCustomBleed] = useState(9);
  const [pdfTrimMarks, setPdfTrimMarks] = useState(true);
  const [pdfRegMarks, setPdfRegMarks] = useState(true);
  const [pdfColorBars, setPdfColorBars] = useState(true);
  const [pdfPageInfo, setPdfPageInfo] = useState(true);

  // --- 6. SVG EXPORT MODAL STATE ---
  const [svgStyling, setSvgStyling] = useState<SvgStylingMode>('presentation');
  const [svgFontMode, setSvgFontMode] = useState<SvgFontMode>('svg');
  const [svgDecimals, setSvgDecimals] = useState(2);
  const [svgObjIds, setSvgObjIds] = useState<SvgObjectIdMode>('layer-names');
  const [svgMinify, setSvgMinify] = useState(false);
  const [svgResponsive, setSvgResponsive] = useState(false);
  const [showSvgCode, setShowSvgCode] = useState(false);
  const [copiedSvg, setCopiedSvg] = useState(false);

  // --- 7. TRANSFORM EACH MODAL STATE ---
  const [teScaleH, setTeScaleH] = useState(100);
  const [teScaleV, setTeScaleV] = useState(100);
  const [teMoveX, setTeMoveX] = useState(0);
  const [teMoveY, setTeMoveY] = useState(0);
  const [teAngle, setTeAngle] = useState(0);
  const [teReflectX, setTeReflectX] = useState(false);
  const [teReflectY, setTeReflectY] = useState(false);
  const [teRandom, setTeRandom] = useState(false);

  // --- 8. OFFSET PATH / SIMPLIFY / SPLIT INTO GRID / BLEND / ENVELOPE STATE ---
  const [offsetDist, setOffsetDist] = useState(10);
  const [offsetJoins, setOffsetJoins] = useState<'miter' | 'round' | 'bevel'>('miter');
  const [offsetMiter, setOffsetMiter] = useState(4);

  const [simpPrecision, setSimpPrecision] = useState(75);
  const [simpAngle, setSimpAngle] = useState(35);

  const [gridRows, setGridRows] = useState(3);
  const [gridCols, setGridCols] = useState(3);
  const [gridGutterH, setGridGutterH] = useState(12);
  const [gridGutterV, setGridGutterV] = useState(12);

  const [blendModeSpacing, setBlendModeSpacing] = useState<'smooth' | 'steps' | 'distance'>('steps');
  const [blendSteps, setBlendSteps] = useState(8);

  const [warpStyle, setWarpStyle] = useState('arc');
  const [warpBend, setWarpBend] = useState(40);
  const [warpHDist, setWarpHDist] = useState(0);
  const [warpVDist, setWarpVDist] = useState(0);
  const [meshRows, setMeshRows] = useState(4);
  const [meshCols, setMeshCols] = useState(4);

  // --- 9. PATTERN MAKER MODAL STATE ---
  const [patName, setPatName] = useState('New Geometric Pattern');
  const [patTileType, setPatTileType] = useState<PatternItem['tileType']>('grid');
  const [patBrickOffset, setPatBrickOffset] = useState(0.5);
  const [patW, setPatW] = useState(64);
  const [patH, setPatH] = useState(64);
  const [patHSpacing, setPatHSpacing] = useState(0);
  const [patVSpacing, setPatVSpacing] = useState(0);
  const [patDimCopies, setPatDimCopies] = useState(50);

  // --- 10. GRAPH DATA SPREADSHEET MODAL STATE ---
  const [graphType, setGraphType] = useState<
    'column' | 'stacked-column' | 'bar' | 'stacked-bar' | 'line' | 'area' | 'scatter' | 'pie' | 'radar'
  >('column');
  const [graphLabels, setGraphLabels] = useState<string[]>(['Q1', 'Q2', 'Q3', 'Q4']);
  const [graphSeries, setGraphSeries] = useState<string[]>(['Revenue', 'Growth']);
  const [graphData, setGraphData] = useState<number[][]>([
    [42, 28],
    [68, 45],
    [54, 62],
    [89, 76],
  ]);
  const [graphShowLegend, setGraphShowLegend] = useState(true);
  const [graphShowShadow, setGraphShowShadow] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // --- 11. IMAGE TRACE MODAL STATE ---
  const [tracePreset, setTracePreset] = useState<ImageTracePresetId>('bw-logo');
  const [traceMode, setTraceMode] = useState<'color' | 'grayscale' | 'bw'>('bw');
  const [traceThreshold, setTraceThreshold] = useState(128);
  const [traceColors, setTraceColors] = useState(16);
  const [tracePaths, setTracePaths] = useState(75);
  const [traceCorners, setTraceCorners] = useState(75);
  const [traceNoise, setTraceNoise] = useState(12);
  const [traceIgnoreWhite, setTraceIgnoreWhite] = useState(true);

  // --- 12. SHAPE DIALOG STATE ---
  const [shapeType, setShapeType] = useState<'rectangle' | 'ellipse' | 'polygon' | 'star'>('rectangle');
  const [shapeW, setShapeW] = useState(200);
  const [shapeH, setShapeH] = useState(200);
  const [shapeRadius, setShapeRadius] = useState(0);
  const [shapeSides, setShapeSides] = useState(6);
  const [shapeInnerRatio, setShapeInnerRatio] = useState(0.45);

  // --- 13. PREFERENCES & SHORTCUTS STATE ---
  const [shortcutSearch, setShortcutSearch] = useState('');
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUT_BINDINGS);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);

  // Initialize modal-specific data when opened
  useEffect(() => {
    if (activeModal === 'shape-dialog') {
      const tool = store.activeTool;
      if (tool === 'rounded-rectangle') {
        setShapeType('rectangle');
        setShapeRadius(20);
      } else if (tool === 'rectangle') {
        setShapeType('rectangle');
        setShapeRadius(0);
      } else if (tool === 'ellipse') {
        setShapeType('ellipse');
      } else if (tool === 'polygon') {
        setShapeType('polygon');
      } else if (tool === 'star' || tool === 'flare') {
        setShapeType('star');
      }
    } else if (activeModal === 'export-screens') {
      setSelectedArtboardIds((doc.artboards || []).map((a) => a.id));
    } else if (activeModal === 'recolor-artwork') {
      const targetNodes =
        selectedIds.length > 0
          ? selectedIds.map((id) => doc.nodes[id]).filter(Boolean)
          : Object.values(doc.nodes || {});
      const uniqueColors = new Set<string>();
      for (const n of targetNodes) {
        for (const f of n.fills || []) {
          if (f.visible && f.color && f.color !== 'none') uniqueColors.add(f.color.toLowerCase());
        }
        for (const s of n.strokes || []) {
          if (s.visible && s.color && s.color !== 'none') uniqueColors.add(s.color.toLowerCase());
        }
      }
      const list = Array.from(uniqueColors).slice(0, 16);
      if (list.length === 0) list.push('#ff9a00', '#1473e6', '#0f172a');
      setColorMappings(list.map((c) => ({ from: c, to: c })));
      setHueDelta(0);
      setSatMult(1);
      setBrightMult(1);
    }
  }, [activeModal]);

  const liveSvgCode = useMemo(() => {
    if (activeModal !== 'export-svg') return '';
    return exportDocumentToSvgString(doc, {
      styling: svgStyling,
      fontMode: svgFontMode,
      decimalPlaces: svgDecimals,
      objectIds: svgObjIds,
      minify: svgMinify,
      responsive: svgResponsive,
    });
  }, [
    activeModal,
    doc,
    svgStyling,
    svgFontMode,
    svgDecimals,
    svgObjIds,
    svgMinify,
    svgResponsive,
  ]);

  if (!activeModal) return null;

  const applySelectedPreset = (preset: DocumentPresetItem) => {
    setSelectedPresetId(preset.id);
    setNewDocW(preset.width);
    setNewDocH(preset.height);
    setNewDocUnit(preset.unit);
    setNewDocColorMode(preset.colorMode);
    setNewDocPpi(preset.ppi);
    setNewDocArtboards(preset.artboards);
    setNewDocBleedTop(preset.bleed);
    setNewDocBleedBottom(preset.bleed);
    setNewDocBleedLeft(preset.bleed);
    setNewDocBleedRight(preset.bleed);
    setNewDocOrientation(preset.width >= preset.height ? 'landscape' : 'portrait');
  };

  const handleCreateNewDocument = async () => {
    const newDoc = createDefaultDocument({
      name: newDocName.endsWith('.adloze') ? newDocName : `${newDocName}.adloze`,
      width: newDocW,
      height: newDocH,
      unit: newDocUnit,
      colorMode: newDocColorMode,
      rasterPPI: newDocPpi,
      artboardCount: newDocArtboards,
      bleed: newDocBleedTop,
      includeSampleArtwork: false,
    });
    newDoc.bleed = {
      top: toPoints(newDocBleedTop, newDocUnit),
      bottom: toPoints(newDocBleedBottom, newDocUnit),
      left: toPoints(newDocBleedLeft, newDocUnit),
      right: toPoints(newDocBleedRight, newDocUnit),
      linked: newDocBleedLinked,
    };

    await saveProjectToDb(newDoc);
    if (typeof store.openDocument === 'function') {
      store.openDocument(newDoc);
    } else if (typeof store.loadDocument === 'function') {
      store.loadDocument(newDoc);
    } else {
      useStudioStore.setState((state: any) => ({
        ...state,
        document: newDoc,
        activeDocument: newDoc,
        activeDocumentId: newDoc.id,
        documents: { ...(state.documents || {}), [newDoc.id]: newDoc },
        selectedIds: [],
        selectedNodeIds: [],
        showHomeScreen: false,
      }));
    }
    if (typeof store.setShowHomeScreen === 'function') {
      store.setShowHomeScreen(false);
    }
    closeModal();
  };

  return (
    <div
      className="ai-modal-backdrop"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={activeModal.replace(/-/g, ' ')}
      tabIndex={-1}
      onKeyDown={(event) => {
        // Do not let editor shortcuts operate behind an open modal.
        event.stopPropagation();
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          closeModal();
        } else if (event.key === 'Tab') {
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
            .filter(element => element.getClientRects().length > 0);
          if (!controls.length) { event.preventDefault(); event.currentTarget.focus(); return; }
          const current = document.activeElement;
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && (current === first || !event.currentTarget.contains(current))) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (current === last || !event.currentTarget.contains(current))) { event.preventDefault(); first.focus(); }
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
        fontSize: 12,
        color: 'var(--ai-text-primary)',
      }}
    >
      {/* ====================================================================
          1. NEW DOCUMENT MODAL
         ==================================================================== */}
      {activeModal === 'new-document' && (
        <div className="ai-new-document" style={{ ...modalBoxStyle, width: 780 }}>
          <div style={modalHeaderStyle}>
            <span>New Document</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          {/* Preset Categories */}
          <div className="ai-new-document-categories"
            style={{
              display: 'flex',
              gap: 6,
              padding: '10px 18px',
              background: 'var(--ai-bg-panel-header)',
              borderBottom: '1px solid var(--ai-border-subtle)',
            }}
          >
            {(['saved', 'mobile', 'web', 'print', 'film', 'art'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setNewDocCat(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 4,
                  border: 'none',
                  background: newDocCat === cat ? '#1473e6' : 'transparent',
                  color: newDocCat === cat ? '#ffffff' : 'var(--ai-text-secondary)',
                  fontWeight: newDocCat === cat ? 600 : 400,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {cat === 'film' ? 'Film & Video' : cat === 'art' ? 'Art & Illustration' : cat}
              </button>
            ))}
          </div>

          <div className="ai-new-document-content" style={{ display: 'flex', padding: 18, gap: 18 }}>
            {/* Left: Preset Cards */}
            <div className="ai-new-document-presets"
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                maxHeight: 370,
                overflowY: 'auto',
                alignContent: 'start',
              }}
            >
              {newDocCat === 'saved' && savedPresets.length === 0 && <div style={{ color: 'var(--ai-text-secondary)', gridColumn: '1 / -1' }}>No saved presets yet.</div>}
              {newDocCat === 'saved' && savedPresets.map((preset) => (
                <button key={preset.id} type="button" onClick={() => {
                  setSelectedPresetId(preset.id);
                  setNewDocName(preset.name); setNewDocW(preset.width); setNewDocH(preset.height);
                  setNewDocUnit(preset.unit); setNewDocColorMode(preset.colorMode); setNewDocPpi(preset.rasterPpi);
                  setNewDocArtboards(preset.artboards); setNewDocOrientation(preset.orientation);
                  setNewDocBleedTop(preset.bleedTop); setNewDocBleedBottom(preset.bleedBottom);
                  setNewDocBleedLeft(preset.bleedLeft); setNewDocBleedRight(preset.bleedRight);
                }} style={{ background: 'var(--ai-bg-panel-header)', color: 'var(--ai-text-primary)', textAlign: 'left', border: selectedPresetId === preset.id ? '1px solid #1473e6' : '1px solid var(--ai-border-subtle)', borderRadius: 6, padding: 12, cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600 }}>{preset.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ai-text-secondary)', marginTop: 4 }}>{preset.width} × {preset.height} {preset.unit} · {preset.colorMode} ({preset.rasterPpi} ppi)</div>
                </button>
              ))}
              {DOCUMENT_PRESETS.filter((p) => p.category === newDocCat).map(
                (preset) => (
                  <div
                    key={preset.id}
                    onClick={() => applySelectedPreset(preset)}
                    style={{
                      background: 'var(--ai-bg-panel-header)',
                      border:
                        selectedPresetId === preset.id
                          ? '1.5px solid #1473e6'
                          : '1px solid var(--ai-border-subtle)',
                      borderRadius: 6,
                      padding: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--ai-text-primary)' }}>{preset.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ai-text-secondary)', marginTop: 4 }}>
                      {preset.width} × {preset.height} {preset.unit} • {preset.colorMode} ({preset.ppi}{' '}
                      ppi)
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Right: Preset Details Inspector */}
            <div className="ai-new-document-details"
              style={{
                width: 280,
                background: 'var(--ai-bg-panel-header)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ai-text-primary)' }}>PRESET DETAILS</div>

              <div>
                <label style={labelStyle}>Document Title</label>
                <input
                  type="text"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  style={fullInputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Width</label>
                  <input
                    type="number"
                    value={newDocW}
                    onChange={(e) => setNewDocW(Math.max(1, Number(e.target.value)))}
                    style={fullInputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Units</label>
                  <select
                    value={newDocUnit}
                    onChange={(e) => setNewDocUnit(e.target.value as UnitType)}
                    style={fullInputStyle}
                  >
                    <option value="px">Pixels (px)</option>
                    <option value="pt">Points (pt)</option>
                    <option value="pc">Picas (pc)</option>
                    <option value="mm">Millimeters (mm)</option>
                    <option value="cm">Centimeters (cm)</option>
                    <option value="in">Inches (in)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Height</label>
                  <input
                    type="number"
                    value={newDocH}
                    onChange={(e) => setNewDocH(Math.max(1, Number(e.target.value)))}
                    style={fullInputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Orientation</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => {
                        setNewDocOrientation('portrait');
                        if (newDocW > newDocH) {
                          setNewDocW(newDocH);
                          setNewDocH(newDocW);
                        }
                      }}
                      style={{
                        ...smallToggleBtn,
                        background: newDocOrientation === 'portrait' ? '#1473e6' : 'var(--ai-bg-hover)',
                        color: newDocOrientation === 'portrait' ? '#ffffff' : 'var(--ai-text-primary)',
                      }}
                    >
                      Port
                    </button>
                    <button
                      onClick={() => {
                        setNewDocOrientation('landscape');
                        if (newDocH > newDocW) {
                          setNewDocW(newDocH);
                          setNewDocH(newDocW);
                        }
                      }}
                      style={{
                        ...smallToggleBtn,
                        background: newDocOrientation === 'landscape' ? '#1473e6' : 'var(--ai-bg-hover)',
                        color: newDocOrientation === 'landscape' ? '#ffffff' : 'var(--ai-text-primary)',
                      }}
                    >
                      Land
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Artboards</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newDocArtboards}
                    onChange={(e) => setNewDocArtboards(Math.max(1, Number(e.target.value)))}
                    style={fullInputStyle}
                  />
                </div>
              </div>

              {/* Bleed Controls */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={labelStyle}>Bleed ({newDocUnit})</label>
                  <button
                    onClick={() => setNewDocBleedLinked(!newDocBleedLinked)}
                    title="Link Bleed Values"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: newDocBleedLinked ? '#1473e6' : '#888',
                      cursor: 'pointer',
                    }}
                  >
                    {newDocBleedLinked ? <Link2 size={13} /> : <Unlink2 size={13} />}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {(
                    [
                      ['Top', newDocBleedTop, setNewDocBleedTop],
                      ['Bottom', newDocBleedBottom, setNewDocBleedBottom],
                      ['Left', newDocBleedLeft, setNewDocBleedLeft],
                      ['Right', newDocBleedRight, setNewDocBleedRight],
                    ] as const
                  ).map(([lbl, val, setter]) => (
                    <div key={lbl}>
                      <div style={{ fontSize: 9, color: 'var(--ai-text-secondary)' }}>{lbl}</div>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={val}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          if (newDocBleedLinked) {
                            setNewDocBleedTop(v);
                            setNewDocBleedBottom(v);
                            setNewDocBleedLeft(v);
                            setNewDocBleedRight(v);
                          } else {
                            setter(v);
                          }
                        }}
                        style={fullInputStyle}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Color Mode & Raster Effects */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Color Mode</label>
                  <select
                    value={newDocColorMode}
                    onChange={(e) => setNewDocColorMode(e.target.value as ColorMode)}
                    style={fullInputStyle}
                  >
                    <option value="RGB">RGB Color</option>
                    <option value="CMYK">CMYK Color</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Raster Effects</label>
                  <select
                    value={newDocPpi}
                    onChange={(e) => setNewDocPpi(Number(e.target.value) as 72 | 150 | 300)}
                    style={fullInputStyle}
                  >
                    <option value={300}>High (300 ppi)</option>
                    <option value={150}>Medium (150 ppi)</option>
                    <option value={72}>Screen (72 ppi)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={async () => {
                  await saveCustomPresetToDb({
                    id: `custom-${Date.now()}`,
                    name: newDocName,
                    category: 'saved',
                    width: newDocW,
                    height: newDocH,
                    unit: newDocUnit,
                    orientation: newDocOrientation,
                    artboards: newDocArtboards,
                    bleedTop: newDocBleedTop,
                    bleedBottom: newDocBleedBottom,
                    bleedLeft: newDocBleedLeft,
                    bleedRight: newDocBleedRight,
                    colorMode: newDocColorMode,
                    rasterPpi: newDocPpi,
                    createdAt: Date.now(),
                  });
                  setSavedPresets(await listCustomPresetsFromDb());
                  setNewDocCat('saved');
                }}
                style={{ ...secondaryBtnStyle, width: '100%' }}
              >
                Save to Custom Presets
              </button>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button onClick={handleCreateNewDocument} style={primaryBtnStyle}>
              Create
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          2. RECOLOR ARTWORK MODAL
         ==================================================================== */}
      {activeModal === 'recolor-artwork' && (
        <div style={{ ...modalBoxStyle, width: 680 }}>
          <div style={modalHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} color="#ff9a00" /> Recolor Artwork
            </span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', padding: 18, gap: 20 }}>
            {/* Interactive Color Wheel */}
            <div
              style={{
                width: 260,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 210,
                  height: 210,
                  borderRadius: '50%',
                  position: 'relative',
                  background:
                    'conic-gradient(from 90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                  boxShadow: 'inset 0 0 28px rgba(255,255,255,0.45), 0 4px 16px rgba(0,0,0,0.4)',
                  border: '2px solid #444',
                }}
              >
                {/* Harmony Nodes */}
                {colorMappings.map((item, idx) => {
                  const hsb = rgbToHsb(hexToRgb(item.to));
                  const rad = (hsb.h * Math.PI) / 180;
                  const dist = (hsb.s / 100) * 88;
                  const nx = 105 + Math.cos(rad) * dist;
                  const ny = 105 + Math.sin(rad) * dist;
                  return (
                    <div
                      key={idx}
                      title={`${item.from} → ${item.to}`}
                      style={{
                        position: 'absolute',
                        left: nx - 8,
                        top: ny - 8,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: item.to,
                        border: idx === 0 ? '2.5px solid #ffffff' : '1.5px solid #ffffff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.65)',
                      }}
                    />
                  );
                })}
              </div>

              {/* Harmony Rotation & Brightness Sliders */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--ai-text-secondary)' }}>Harmony Hue Shift ({hueDelta}°)</span>
                  <button
                    onClick={() => setLinkHarmony(!linkHarmony)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      padding: '3px 7px',
                      borderRadius: 4,
                      border: '1px solid var(--ai-border-subtle)',
                      background: linkHarmony ? '#1473e6' : 'var(--ai-bg-panel)',
                      color: linkHarmony ? '#ffffff' : 'var(--ai-text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {linkHarmony ? <Link2 size={11} /> : <Unlink2 size={11} />}
                    Link Harmony
                  </button>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={hueDelta}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    setHueDelta(deg);
                    setColorMappings((prev) =>
                      prev.map((m, i) => ({
                        ...m,
                        to:
                          linkHarmony || i === 0
                            ? shiftColorHarmony(m.from, deg, satMult, brightMult)
                            : m.to,
                      }))
                    );
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--ai-text-secondary)' }}>Brightness</span>
                  <span style={{ fontSize: 11 }}>{Math.round(brightMult * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={150}
                  value={Math.round(brightMult * 100)}
                  onChange={(e) => {
                    const bm = Number(e.target.value) / 100;
                    setBrightMult(bm);
                    setColorMappings((prev) =>
                      prev.map((m) => ({
                        ...m,
                        to: shiftColorHarmony(m.from, hueDelta, satMult, bm),
                      }))
                    );
                  }}
                />
              </div>
            </div>

            {/* Current Colors -> New Colors Table */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <label style={labelStyle}>Color Reduction Preset</label>
                  <select
                    value={colorReduction}
                    onChange={(e) => {
                      const mode = e.target.value as any;
                      setColorReduction(mode);
                      if (mode === 'grayscale') {
                        setColorMappings((prev) =>
                          prev.map((m) => {
                            const { r, g, b } = hexToRgb(m.from);
                            const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                            return { ...m, to: rgbToHex({ r: v, g: v, b: v }) };
                          })
                        );
                      } else if (mode !== 'all') {
                        const limit = parseInt(mode, 10);
                        setColorMappings((prev) =>
                          prev.map((m, idx) => ({
                            ...m,
                            to: prev[idx % limit]?.from || m.from,
                          }))
                        );
                      }
                    }}
                    style={fullInputStyle}
                  >
                    <option value="all">Preserve All Colors</option>
                    <option value="2">2-Color Posterize</option>
                    <option value="3">3-Color Triad</option>
                    <option value="5">5-Color Brand Palette</option>
                    <option value="grayscale">Convert to Shades of Gray</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setColorMappings((prev) => {
                      const targets = prev.map((p) => p.to);
                      for (let i = targets.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [targets[i], targets[j]] = [targets[j], targets[i]];
                      }
                      return prev.map((p, idx) => ({ ...p, to: targets[idx] }));
                    });
                  }}
                  style={{ ...secondaryBtnStyle, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Shuffle size={13} /> Randomize Order
                </button>
              </div>

              <div
                style={{
                  background: '#222222',
                  border: '1px solid var(--ai-border-subtle)',
                  borderRadius: 6,
                  maxHeight: 240,
                  overflowY: 'auto',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {colorMappings.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      background: 'var(--ai-bg-panel-header)',
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 22,
                          height: 18,
                          borderRadius: 3,
                          background: row.from,
                          border: '1px solid #555',
                        }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.from}</span>
                    </div>
                    <span style={{ color: 'var(--ai-text-secondary)' }}>→</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="color"
                        value={row.to.startsWith('#') ? row.to : '#1473e6'}
                        onChange={(e) => {
                          const nextHex = e.target.value;
                          setColorMappings((prev) =>
                            prev.map((m, i) => (i === idx ? { ...m, to: nextHex } : m))
                          );
                        }}
                        style={{
                          width: 28,
                          height: 22,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: 11, width: 62 }}>
                        {row.to}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                const mapLookup = new Map(
                  colorMappings.map((m) => [m.from.toLowerCase(), m.to])
                );
                mutateDocument((draft) => {
                  const ids =
                    selectedIds.length > 0 ? selectedIds : Object.keys(draft.nodes || {});
                  for (const id of ids) {
                    const n = draft.nodes[id];
                    if (!n) continue;
                    for (const f of n.fills || []) {
                      const mapped = mapLookup.get((f.color || '').toLowerCase());
                      if (mapped) f.color = mapped;
                    }
                    for (const s of n.strokes || []) {
                      const mapped = mapLookup.get((s.color || '').toLowerCase());
                      if (mapped) s.color = mapped;
                    }
                  }
                }, 'Recolor Artwork');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK (Apply Recolor)
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          3. EXPORT FOR SCREENS MODAL (Alt+Ctrl+E)
         ==================================================================== */}
      {activeModal === 'export-screens' && (
        <div style={{ ...modalBoxStyle, width: 720 }}>
          <div style={modalHeaderStyle}>
            <span>Export for Screens (Alt+Ctrl+E)</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--ai-border-subtle)', background: 'var(--ai-bg-panel-header)' }}>
            {(['artboards', 'assets'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setExportTab(tab)}
                style={{
                  padding: '9px 20px',
                  border: 'none',
                  borderBottom: exportTab === tab ? '2px solid #1473e6' : '2px solid transparent',
                  background: 'transparent',
                  color: exportTab === tab ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'artboards'
                  ? `Artboards (${doc.artboards.length})`
                  : `Assets & Slices (${(doc.exportAssets?.length || 0) + (doc.slices?.length || 0)})`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', padding: 18, gap: 18 }}>
            {/* Left: Artboards or Assets/Slices checklist */}
            <div
              style={{
                flex: 1,
                background: 'var(--ai-bg-elevated)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                padding: 12,
                maxHeight: 290,
                overflowY: 'auto',
              }}
            >
              {exportTab === 'artboards' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {doc.artboards.map((ab, idx) => {
                    const checked = selectedArtboardIds.includes(ab.id);
                    return (
                      <label
                        key={ab.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: checked ? '#2c394b' : '#2d2d2d',
                          border: checked ? '1px solid #1473e6' : '1px solid var(--ai-border-subtle)',
                          borderRadius: 5,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedArtboardIds([...selectedArtboardIds, ab.id]);
                              } else {
                                setSelectedArtboardIds(
                                  selectedArtboardIds.filter((id) => id !== ab.id)
                                );
                              }
                            }}
                          />
                          <span style={{ fontWeight: 600, color: 'var(--ai-text-primary)' }}>
                            {idx + 1}. {ab.name}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--ai-text-secondary)' }}>
                          {Math.round(ab.width)} × {Math.round(ab.height)} pt
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(doc.exportAssets || []).map((asset) => (
                    <div
                      key={asset.id}
                      style={{
                        padding: '8px 10px',
                        background: '#2d2d2d',
                        border: '1px solid var(--ai-border-subtle)',
                        borderRadius: 5,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{asset.name}</span>
                      <span style={{ fontSize: 10, color: '#1473e6' }}>Asset</span>
                    </div>
                  ))}
                  {(doc.slices || []).map((slice) => (
                    <div
                      key={slice.id}
                      style={{
                        padding: '8px 10px',
                        background: '#2d2d2d',
                        border: '1px solid #ff9a00',
                        borderRadius: 5,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{slice.name}</span>
                      <span style={{ fontSize: 10, color: '#ff9a00' }}>
                        Slice ({Math.round(slice.width)}×{Math.round(slice.height)})
                      </span>
                    </div>
                  ))}
                  {(doc.exportAssets?.length || 0) === 0 && (doc.slices?.length || 0) === 0 && (
                    <div style={{ color: 'var(--ai-text-secondary)', textAlign: 'center', padding: 24 }}>
                      No custom slices or assets yet. Selected objects or active artboard will be
                      exported.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: Formats & Scales Table */}
            <div
              style={{
                width: 310,
                background: 'var(--ai-bg-elevated)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700 }}>FORMATS & SCALES</span>
                <button
                  onClick={() =>
                    setExportEntries([
                      ...exportEntries,
                      {
                        id: `exp-${Date.now()}`,
                        scale: '1x',
                        suffix: '',
                        format: 'png',
                      },
                    ])
                  }
                  style={secondaryBtnStyle}
                >
                  + Add Scale
                </button>
              </div>

              {exportEntries.map((row, i) => (
                <div
                  key={row.id}
                  style={{ display: 'grid', gridTemplateColumns: '68px 1fr 82px 24px', gap: 6, alignItems: 'center' }}
                >
                  <select
                    value={row.scale}
                    onChange={(e) => {
                      const sc = e.target.value as '1x' | '2x' | '3x';
                      setExportEntries((prev) =>
                        prev.map((r, idx) =>
                          idx === i
                            ? { ...r, scale: sc, suffix: sc === '1x' ? '' : `@${sc}` }
                            : r
                        )
                      );
                    }}
                    style={fullInputStyle}
                  >
                    <option value="1x">1x</option>
                    <option value="2x">2x</option>
                    <option value="3x">3x</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Suffix"
                    value={row.suffix}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExportEntries((prev) =>
                        prev.map((r, idx) => (idx === i ? { ...r, suffix: val } : r))
                      );
                    }}
                    style={fullInputStyle}
                  />

                  <select
                    value={row.format}
                    onChange={(e) => {
                      const fmt = e.target.value as any;
                      setExportEntries((prev) =>
                        prev.map((r, idx) => (idx === i ? { ...r, format: fmt } : r))
                      );
                    }}
                    style={fullInputStyle}
                  >
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    <option value="webp">WebP</option>
                    <option value="svg">SVG</option>
                    <option value="pdf">PDF</option>
                  </select>

                  <button
                    onClick={() =>
                      setExportEntries(exportEntries.filter((_, idx) => idx !== i))
                    }
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--ai-text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={async () => {
                const targetAbs =
                  selectedArtboardIds.length > 0
                    ? doc.artboards.filter((a) => selectedArtboardIds.includes(a.id))
                    : doc.artboards;

                for (const ab of targetAbs) {
                  for (const entry of exportEntries) {
                    const baseFile = `${ab.name.replace(/\s+/g, '_')}${entry.suffix}`;
                    if (entry.format === 'svg') {
                      const svg = exportDocumentToSvgString(doc, { artboardId: ab.id });
                      triggerSvgDownload(svg, `${baseFile}.svg`);
                    } else if (entry.format === 'pdf') {
                      const pdfBytes = await exportDocumentToPdfBytes(doc, {
                        artboardIds: [ab.id],
                      });
                      triggerPdfDownload(pdfBytes, `${baseFile}.pdf`);
                    } else {
                      const url = exportDocumentToDataUrl(doc, {
                        artboardId: ab.id,
                        format: entry.format as RasterFormat,
                        scale: resolveScaleMultiplier(entry.scale),
                        transparentBackground: entry.format !== 'jpg',
                      });
                      triggerDataUrlDownload(url, `${baseFile}.${entry.format}`);
                    }
                  }
                }
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              Export Artboard(s)
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          4. SAVE FOR WEB (LEGACY) MODAL (Alt+Shift+Ctrl+S)
         ==================================================================== */}
      {activeModal === 'save-for-web' && (
        <div style={{ ...modalBoxStyle, width: 760 }}>
          <div style={modalHeaderStyle}>
            <span>Save for Web (Legacy) (Alt+Shift+Ctrl+S)</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', padding: 18, gap: 18 }}>
            {/* 2-Up Original vs Optimized Preview */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div
                style={{
                  background: '#1a1a1a',
                  border: '1px solid var(--ai-border-subtle)',
                  borderRadius: 6,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--ai-text-secondary)', fontWeight: 600 }}>
                  ORIGINAL VECTOR SOURCE
                </div>
                <div
                  style={{
                    height: 190,
                    background: '#222',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={exportDocumentToDataUrl(doc, {
                      format: 'png',
                      scale: 0.4,
                      transparentBackground: true,
                    })}
                    alt="Original"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ fontSize: 10, color: 'var(--ai-text-secondary)' }}>
                  {doc.name} • {Object.keys(doc.nodes || {}).length} vector objects
                </div>
              </div>

              <div
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #1473e6',
                  borderRadius: 6,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 10, color: '#1473e6', fontWeight: 600 }}>
                  OPTIMIZED ({webPresetFormat.toUpperCase()} • {webQuality}% Quality)
                </div>
                <div
                  style={{
                    height: 190,
                    background: webTransparent && webPresetFormat !== 'jpg' ? '#2a2a2a' : webMatte,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={exportDocumentToDataUrl(doc, {
                      format: webPresetFormat === 'jpg' ? 'jpg' : webPresetFormat === 'webp' ? 'webp' : 'png',
                      scale: 0.4 * (webScalePct / 100),
                      quality: webQuality / 100,
                      transparentBackground: webTransparent && webPresetFormat !== 'jpg',
                      matteColor: webMatte,
                    })}
                    alt="Optimized"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div style={{ fontSize: 10, color: 'var(--ai-text-secondary)' }}>
                  Scale: {webScalePct}% • Est. Size: ~{Math.max(4, Math.round((webQuality * webScalePct) / 180))} KB
                </div>
              </div>
            </div>

            {/* Optimization Controls */}
            <div
              style={{
                width: 240,
                background: 'var(--ai-bg-panel-header)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div>
                <label style={labelStyle}>Format</label>
                <select
                  value={webPresetFormat}
                  onChange={(e) => setWebPresetFormat(e.target.value as any)}
                  style={fullInputStyle}
                >
                  <option value="png-24">PNG-24 (Lossless Alpha)</option>
                  <option value="png-8">PNG-8 (Indexed 256)</option>
                  <option value="jpg">JPEG (Progressive)</option>
                  <option value="webp">WebP (High Compression)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Quality ({webQuality}%)</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={webQuality}
                  onChange={(e) => setWebQuality(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={webTransparent}
                  disabled={webPresetFormat === 'jpg'}
                  onChange={(e) => setWebTransparent(e.target.checked)}
                />
                <span>Transparency</span>
              </label>

              <div>
                <label style={labelStyle}>Matte Color</label>
                <input
                  type="color"
                  value={webMatte}
                  onChange={(e) => setWebMatte(e.target.value)}
                  style={{ width: '100%', height: 26, border: 'none', background: 'transparent' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Image Size Scale (%)</label>
                <input
                  type="number"
                  min={10}
                  max={400}
                  value={webScalePct}
                  onChange={(e) => setWebScalePct(Math.max(10, Number(e.target.value)))}
                  style={fullInputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Slices Export Scope</label>
                <select
                  value={webSliceScope}
                  onChange={(e) => setWebSliceScope(e.target.value as any)}
                  style={fullInputStyle}
                >
                  <option value="all">Full Active Artboard</option>
                  <option value="slices">Export All User Slices ({doc.slices?.length || 0})</option>
                </select>
              </div>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                const fmt: RasterFormat =
                  webPresetFormat === 'jpg'
                    ? 'jpg'
                    : webPresetFormat === 'webp'
                      ? 'webp'
                      : 'png';
                if (webSliceScope === 'slices' && doc.slices && doc.slices.length > 0) {
                  for (const slice of doc.slices) {
                    const url = exportSliceToDataUrl(doc, slice, {
                      format: fmt,
                      scale: webScalePct / 100,
                      quality: webQuality / 100,
                      transparentBackground: webTransparent && fmt !== 'jpg',
                      matteColor: webMatte,
                    });
                    triggerDataUrlDownload(url, `${slice.name}.${fmt}`);
                  }
                } else {
                  const url = exportDocumentToDataUrl(doc, {
                    format: fmt,
                    scale: webScalePct / 100,
                    quality: webQuality / 100,
                    transparentBackground: webTransparent && fmt !== 'jpg',
                    matteColor: webMatte,
                  });
                  triggerDataUrlDownload(
                    url,
                    `${(doc.name || 'web-export').replace(/\.adloze$/i, '')}.${fmt}`
                  );
                }
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              Save...
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          5. PRINT-READY PDF EXPORT MODAL
         ==================================================================== */}
      {activeModal === 'export-pdf' && (
        <div style={{ ...modalBoxStyle, width: 500 }}>
          <div style={modalHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Printer size={14} color="#ff9a00" /> Save Adobe PDF (Print-Ready Vector)
            </span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                background: 'var(--ai-bg-panel-header)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--ai-text-primary)' }}>Printer's Marks</div>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={pdfTrimMarks}
                  onChange={(e) => setPdfTrimMarks(e.target.checked)}
                />
                <span>Trim Marks (Corner Crop Hairlines)</span>
              </label>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={pdfRegMarks}
                  onChange={(e) => setPdfRegMarks(e.target.checked)}
                />
                <span>Registration Marks (Bullseye Targets)</span>
              </label>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={pdfColorBars}
                  onChange={(e) => setPdfColorBars(e.target.checked)}
                />
                <span>Color Bars (CMYK & Grayscale Calibration Strip)</span>
              </label>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={pdfPageInfo}
                  onChange={(e) => setPdfPageInfo(e.target.checked)}
                />
                <span>Page Information (Filename, Artboard, Date & Color Mode)</span>
              </label>
            </div>

            <div
              style={{
                background: 'var(--ai-bg-panel-header)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--ai-text-primary)' }}>Bleeds</div>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={pdfUseDocBleed}
                  onChange={(e) => setPdfUseDocBleed(e.target.checked)}
                />
                <span>
                  Use Document Bleed Settings ({Math.round(doc.bleed?.top || 0)} pt)
                </span>
              </label>
              {!pdfUseDocBleed && (
                <div>
                  <label style={labelStyle}>Custom Uniform Bleed (pt)</label>
                  <input
                    type="number"
                    min={0}
                    value={pdfCustomBleed}
                    onChange={(e) => setPdfCustomBleed(Math.max(0, Number(e.target.value)))}
                    style={fullInputStyle}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={async () => {
                const bytes = await exportDocumentToPdfBytes(doc, {
                  useDocumentBleed: pdfUseDocBleed,
                  customBleed: {
                    top: pdfCustomBleed,
                    bottom: pdfCustomBleed,
                    left: pdfCustomBleed,
                    right: pdfCustomBleed,
                  },
                  trimMarks: pdfTrimMarks,
                  registrationMarks: pdfRegMarks,
                  colorBars: pdfColorBars,
                  pageInformation: pdfPageInfo,
                });
                triggerPdfDownload(
                  bytes,
                  `${(doc.name || 'print-ready').replace(/\.adloze$/i, '')}.pdf`
                );
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              Save PDF
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          6. SVG EXPORT OPTIONS MODAL
         ==================================================================== */}
      {activeModal === 'export-svg' && (
        <div style={{ ...modalBoxStyle, width: 580 }}>
          <div style={modalHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCode size={14} color="#1473e6" /> SVG Options
            </span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Styling</label>
                <select
                  value={svgStyling}
                  onChange={(e) => setSvgStyling(e.target.value as SvgStylingMode)}
                  style={fullInputStyle}
                >
                  <option value="internal-css">Internal CSS</option>
                  <option value="inline">Inline Style</option>
                  <option value="presentation">Presentation Attributes</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Font</label>
                <select
                  value={svgFontMode}
                  onChange={(e) => setSvgFontMode(e.target.value as SvgFontMode)}
                  style={fullInputStyle}
                >
                  <option value="svg">SVG (&lt;text&gt;)</option>
                  <option value="outline">Convert to Outlines (Bezier Paths)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Object IDs</label>
                <select
                  value={svgObjIds}
                  onChange={(e) => setSvgObjIds(e.target.value as SvgObjectIdMode)}
                  style={fullInputStyle}
                >
                  <option value="layer-names">Layer Names</option>
                  <option value="minimal">Minimal (a, b, c...)</option>
                  <option value="unique">Unique</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Decimal Places (1–7)</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={svgDecimals}
                  onChange={(e) =>
                    setSvgDecimals(Math.max(1, Math.min(7, Number(e.target.value))))
                  }
                  style={fullInputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 18 }}>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={svgMinify}
                  onChange={(e) => setSvgMinify(e.target.checked)}
                />
                <span>Minify</span>
              </label>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={svgResponsive}
                  onChange={(e) => setSvgResponsive(e.target.checked)}
                />
                <span>Responsive (Omit Fixed Width/Height)</span>
              </label>
            </div>

            {showSvgCode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--ai-text-secondary)' }}>Generated SVG Code</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(liveSvgCode);
                      setCopiedSvg(true);
                      setTimeout(() => setCopiedSvg(false), 1800);
                    }}
                    style={{
                      ...secondaryBtnStyle,
                      padding: '3px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {copiedSvg ? <Check size={12} color="#4fcf5f" /> : <Copy size={12} />}
                    {copiedSvg ? 'Copied!' : 'Copy SVG'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={liveSvgCode}
                  style={{
                    height: 160,
                    background: '#181818',
                    border: '1px solid var(--ai-border-subtle)',
                    borderRadius: 4,
                    color: '#80cbc4',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    padding: 8,
                    resize: 'vertical',
                  }}
                />
              </div>
            )}
          </div>

          <div style={modalFooterStyle}>
            <button
              onClick={() => setShowSvgCode(!showSvgCode)}
              style={{ ...secondaryBtnStyle, marginRight: 'auto' }}
            >
              {showSvgCode ? 'Hide SVG Code' : 'Show SVG Code'}
            </button>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                triggerSvgDownload(
                  liveSvgCode,
                  `${(doc.name || 'artwork').replace(/\.adloze$/i, '')}.svg`
                );
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK (Export .SVG)
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          7. TRANSFORM EACH MODAL (Alt+Shift+Ctrl+D)
         ==================================================================== */}
      {activeModal === 'transform-each' && (
        <div style={{ ...modalBoxStyle, width: 460 }}>
          <div style={modalHeaderStyle}>
            <span>Transform Each (Alt+Shift+Ctrl+D)</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={sectionBoxStyle}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Scale</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Horizontal</span>
                <NumericScrubInput
                  value={teScaleH}
                  onChange={setTeScaleH}
                  suffix="%"
                  min={1}
                  max={1000}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Vertical</span>
                <NumericScrubInput
                  value={teScaleV}
                  onChange={setTeScaleV}
                  suffix="%"
                  min={1}
                  max={1000}
                />
              </div>
            </div>

            <div style={sectionBoxStyle}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Move</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Horizontal</span>
                <NumericScrubInput value={teMoveX} onChange={setTeMoveX} unit={doc.unit} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Vertical</span>
                <NumericScrubInput value={teMoveY} onChange={setTeMoveY} unit={doc.unit} />
              </div>
            </div>

            <div style={sectionBoxStyle}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Rotate & Options</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <AngleDial angle={teAngle} onChange={setTeAngle} size={32} />
                <NumericScrubInput value={teAngle} onChange={setTeAngle} suffix="°" min={-360} max={360} />
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={teReflectX}
                    onChange={(e) => setTeReflectX(e.target.checked)}
                  />
                  <span>Reflect X</span>
                </label>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={teReflectY}
                    onChange={(e) => setTeReflectY(e.target.checked)}
                  />
                  <span>Reflect Y</span>
                </label>
                <label style={checkboxRowStyle}>
                  <input
                    type="checkbox"
                    checked={teRandom}
                    onChange={(e) => setTeRandom(e.target.checked)}
                  />
                  <span>Random</span>
                </label>
              </div>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button
              onClick={() => {
                // Copy & Transform Each
                mutateDocument((draft) => {
                  const targets =
                    selectedIds.length > 0 ? selectedIds : Object.keys(draft.nodes || {});
                  for (const id of targets) {
                    const orig = draft.nodes[id];
                    if (!orig) continue;
                    const factor = teRandom ? Math.random() : 1;
                    const sx = (1 + ((teScaleH / 100 - 1) * factor)) * (teReflectX ? -1 : 1);
                    const sy = (1 + ((teScaleV / 100 - 1) * factor)) * (teReflectY ? -1 : 1);
                    const dx = teMoveX * factor;
                    const dy = teMoveY * factor;
                    const rot = teAngle * factor;

                    const copy: VectorNode = JSON.parse(JSON.stringify(orig));
                    copy.id = `${orig.id}-copy-${Math.random().toString(36).slice(2, 6)}`;
                    copy.name = `${orig.name} Copy`;
                    copy.width = Math.max(2, orig.width * Math.abs(sx));
                    copy.height = Math.max(2, orig.height * Math.abs(sy));
                    copy.x = orig.x + dx;
                    copy.y = orig.y + dy;
                    copy.rotation = (orig.rotation || 0) + rot;
                    draft.nodes[copy.id] = copy;
                    const layer = draft.layers.find((l) => l.id === copy.layerId) || draft.layers[0];
                    if (layer) layer.nodeIds.push(copy.id);
                  }
                }, 'Transform Each (Copy)');
                closeModal();
              }}
              style={{ ...secondaryBtnStyle, marginRight: 'auto' }}
            >
              Copy
            </button>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  const targets =
                    selectedIds.length > 0 ? selectedIds : Object.keys(draft.nodes || {});
                  for (const id of targets) {
                    const n = draft.nodes[id];
                    if (!n) continue;
                    const factor = teRandom ? Math.random() : 1;
                    const sx = 1 + (teScaleH / 100 - 1) * factor;
                    const sy = 1 + (teScaleV / 100 - 1) * factor;
                    const cx = n.x + n.width / 2;
                    const cy = n.y + n.height / 2;
                    const newW = Math.max(2, n.width * sx);
                    const newH = Math.max(2, n.height * sy);
                    n.x = cx - newW / 2 + teMoveX * factor;
                    n.y = cy - newH / 2 + teMoveY * factor;
                    n.width = newW;
                    n.height = newH;
                    n.rotation = (n.rotation || 0) + teAngle * factor;
                    n.points = (n.points || []).map((pt) => ({
                      ...pt,
                      x: cx + (pt.x - cx) * sx * (teReflectX ? -1 : 1) + teMoveX * factor,
                      y: cy + (pt.y - cy) * sy * (teReflectY ? -1 : 1) + teMoveY * factor,
                    }));
                  }
                }, 'Transform Each');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          8. OFFSET PATH MODAL
         ==================================================================== */}
      {activeModal === 'offset-path' && (
        <div style={{ ...modalBoxStyle, width: 380 }}>
          <div style={modalHeaderStyle}>
            <span>Offset Path</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Offset</span>
              <NumericScrubInput value={offsetDist} onChange={setOffsetDist} unit={doc.unit} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Joins</span>
              <select
                value={offsetJoins}
                onChange={(e) => setOffsetJoins(e.target.value as any)}
                style={{ ...fullInputStyle, width: 130 }}
              >
                <option value="miter">Miter</option>
                <option value="round">Round</option>
                <option value="bevel">Bevel</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Miter Limit</span>
              <NumericScrubInput value={offsetMiter} onChange={setOffsetMiter} min={1} max={50} />
            </div>
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  const targets =
                    selectedIds.length > 0 ? selectedIds : Object.keys(draft.nodes || {}).slice(0, 1);
                  for (const id of targets) {
                    const src = draft.nodes[id];
                    if (!src) continue;
                    const offsetNode = offsetVectorNode(src, offsetDist, offsetJoins, offsetMiter);
                    draft.nodes[offsetNode.id] = offsetNode;
                    const layer =
                      draft.layers.find((l) => l.id === src.layerId) || draft.layers[0];
                    if (layer) layer.nodeIds.push(offsetNode.id);
                  }
                }, 'Offset Path');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          9. SIMPLIFY PATH MODAL
         ==================================================================== */}
      {activeModal === 'simplify-path' && (
        <div style={{ ...modalBoxStyle, width: 400 }}>
          <div style={modalHeaderStyle}>
            <span>Simplify Path</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Curve Precision</span>
                <span>{simpPrecision}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={simpPrecision}
                onChange={(e) => setSimpPrecision(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Angle Threshold</span>
                <span>{simpAngle}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={180}
                value={simpAngle}
                onChange={(e) => setSimpAngle(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  const targets =
                    selectedIds.length > 0 ? selectedIds : Object.keys(draft.nodes || {});
                  for (const id of targets) {
                    const n = draft.nodes[id];
                    if (!n || !n.points || n.points.length <= 3) continue;
                    n.points = simplifyPathPoints(n.points, n.closed, simpPrecision, simpAngle);
                  }
                }, 'Simplify Path');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          10. SPLIT INTO GRID MODAL
         ==================================================================== */}
      {activeModal === 'split-into-grid' && (
        <div style={{ ...modalBoxStyle, width: 420 }}>
          <div style={modalHeaderStyle}>
            <span>Split Into Grid</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={sectionBoxStyle}>
              <div style={{ fontWeight: 700 }}>Rows</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Number</span>
                <NumericScrubInput value={gridRows} onChange={setGridRows} min={1} max={30} decimals={0} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Gutter</span>
                <NumericScrubInput value={gridGutterV} onChange={setGridGutterV} min={0} unit={doc.unit} />
              </div>
            </div>
            <div style={sectionBoxStyle}>
              <div style={{ fontWeight: 700 }}>Columns</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Number</span>
                <NumericScrubInput value={gridCols} onChange={setGridCols} min={1} max={30} decimals={0} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Gutter</span>
                <NumericScrubInput value={gridGutterH} onChange={setGridGutterH} min={0} unit={doc.unit} />
              </div>
            </div>
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  const targets =
                    selectedIds.length > 0 ? selectedIds : Object.keys(draft.nodes || {}).slice(0, 1);
                  for (const id of targets) {
                    const src = draft.nodes[id];
                    if (!src) continue;
                    const cells = splitIntoGridNodes(src, {
                      rows: gridRows,
                      cols: gridCols,
                      gutterH: gridGutterH,
                      gutterV: gridGutterV,
                    });
                    delete draft.nodes[id];
                    const layer =
                      draft.layers.find((l) => l.id === src.layerId) || draft.layers[0];
                    if (layer) {
                      layer.nodeIds = layer.nodeIds.filter((nid) => nid !== id);
                      for (const cell of cells) {
                        draft.nodes[cell.id] = cell;
                        layer.nodeIds.push(cell.id);
                      }
                    }
                  }
                }, 'Split Into Grid');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          11. BLEND OPTIONS MODAL
         ==================================================================== */}
      {activeModal === 'blend-options' && (
        <div style={{ ...modalBoxStyle, width: 380 }}>
          <div style={modalHeaderStyle}>
            <span>Blend Options</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Spacing</span>
              <select
                value={blendModeSpacing}
                onChange={(e) => setBlendModeSpacing(e.target.value as any)}
                style={{ ...fullInputStyle, width: 170 }}
              >
                <option value="smooth">Smooth Color</option>
                <option value="steps">Specified Steps</option>
                <option value="distance">Specified Distance</option>
              </select>
            </div>
            {blendModeSpacing !== 'smooth' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{blendModeSpacing === 'steps' ? 'Steps' : 'Distance'}</span>
                <NumericScrubInput
                  value={blendSteps}
                  onChange={setBlendSteps}
                  min={1}
                  max={250}
                  decimals={0}
                />
              </div>
            )}
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  for (const n of Object.values(draft.nodes || {})) {
                    if (n.type === 'blend' || selectedIds.includes(n.id)) {
                      n.blendSpec = {
                        mode: blendModeSpacing,
                        steps: Math.max(1, Math.round(blendSteps)),
                      };
                    }
                  }
                }, 'Blend Options');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          12. ENVELOPE WARP & ENVELOPE MESH MODALS
         ==================================================================== */}
      {(activeModal === 'envelope-warp' || activeModal === 'envelope-mesh') && (
        <div style={{ ...modalBoxStyle, width: 430 }}>
          <div style={modalHeaderStyle}>
            <span>
              {activeModal === 'envelope-warp' ? 'Envelope Warp Options' : 'Envelope Mesh Options'}
            </span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeModal === 'envelope-warp' ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Style</span>
                  <select
                    value={warpStyle}
                    onChange={(e) => setWarpStyle(e.target.value)}
                    style={{ ...fullInputStyle, width: 190 }}
                  >
                    {[
                      'arc',
                      'arc-lower',
                      'arc-upper',
                      'arch',
                      'bulge',
                      'shell-lower',
                      'shell-upper',
                      'flag',
                      'wave',
                      'fish',
                      'rise',
                      'fisheye',
                      'inflate',
                      'squeeze',
                      'twist',
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Bend</span>
                    <span>{warpBend}%</span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={warpBend}
                    onChange={(e) => setWarpBend(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Horizontal Distortion</span>
                    <span>{warpHDist}%</span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={warpHDist}
                    onChange={(e) => setWarpHDist(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Vertical Distortion</span>
                    <span>{warpVDist}%</span>
                  </div>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    value={warpVDist}
                    onChange={(e) => setWarpVDist(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Rows</label>
                  <NumericScrubInput value={meshRows} onChange={setMeshRows} min={1} max={20} decimals={0} />
                </div>
                <div>
                  <label style={labelStyle}>Columns</label>
                  <NumericScrubInput value={meshCols} onChange={setMeshCols} min={1} max={20} decimals={0} />
                </div>
              </div>
            )}
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  const targets =
                    selectedIds.length > 0 ? selectedIds : Object.keys(draft.nodes || {});
                  for (const id of targets) {
                    const n = draft.nodes[id];
                    if (!n) continue;
                    const spec =
                      activeModal === 'envelope-warp'
                        ? {
                            mode: 'warp' as const,
                            warpStyle,
                            bend: warpBend,
                            hDistort: warpHDist,
                            vDistort: warpVDist,
                          }
                        : {
                            mode: 'mesh' as const,
                            rows: meshRows,
                            cols: meshCols,
                          };
                    n.envelopeSpec = spec;
                    if (n.points && n.points.length > 0) {
                      n.points = applyEnvelopeDistortToPoints(
                        n.points,
                        { x: n.x, y: n.y, width: n.width, height: n.height },
                        spec
                      );
                      const nb = computeBoundingBoxFromAnchors(n.points, n.closed);
                      n.x = nb.x;
                      n.y = nb.y;
                      n.width = nb.width;
                      n.height = nb.height;
                    }
                  }
                }, 'Envelope Distort');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          13. PATTERN MAKER OPTIONS MODAL
         ==================================================================== */}
      {activeModal === 'pattern-maker' && (
        <div style={{ ...modalBoxStyle, width: 520 }}>
          <div style={modalHeaderStyle}>
            <span>Pattern Options (Pattern Editing Mode)</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  value={patName}
                  onChange={(e) => setPatName(e.target.value)}
                  style={fullInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tile Type</label>
                <select
                  value={patTileType}
                  onChange={(e) => setPatTileType(e.target.value as PatternItem['tileType'])}
                  style={fullInputStyle}
                >
                  <option value="grid">Grid</option>
                  <option value="brick-row">Brick by Row</option>
                  <option value="brick-col">Brick by Column</option>
                  <option value="hex-col">Hex by Column</option>
                  <option value="hex-row">Hex by Row</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelStyle}>Width</label>
                  <NumericScrubInput value={patW} onChange={setPatW} min={8} max={512} unit="px" />
                </div>
                <div>
                  <label style={labelStyle}>Height</label>
                  <NumericScrubInput value={patH} onChange={setPatH} min={8} max={512} unit="px" />
                </div>
                <div>
                  <label style={labelStyle}>H Spacing</label>
                  <NumericScrubInput value={patHSpacing} onChange={setPatHSpacing} unit="px" />
                </div>
                <div>
                  <label style={labelStyle}>V Spacing</label>
                  <NumericScrubInput value={patVSpacing} onChange={setPatVSpacing} unit="px" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Dim Copies to: {patDimCopies}%</label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={patDimCopies}
                  onChange={(e) => setPatDimCopies(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Live Tiling Preview */}
            <div
              style={{
                width: 190,
                background: '#1a1a1a',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="170" height="170" viewBox="0 0 170 170">
                {[0, 1, 2].map((r) =>
                  [0, 1, 2].map((c) => {
                    const isCenter = r === 1 && c === 1;
                    const offsetX =
                      patTileType === 'brick-row' && r % 2 === 1 ? patW * patBrickOffset * 0.4 : 0;
                    const x = 18 + c * 48 + offsetX;
                    const y = 18 + r * 48;
                    return (
                      <g
                        key={`${r}-${c}`}
                        opacity={isCenter ? 1 : patDimCopies / 100}
                      >
                        <rect
                          x={x}
                          y={y}
                          width={40}
                          height={40}
                          fill="none"
                          stroke={isCenter ? '#1473e6' : '#444'}
                          strokeDasharray={isCenter ? 'none' : '2 2'}
                        />
                        <circle cx={x + 20} cy={y + 20} r={12} fill="#ff9a00" />
                      </g>
                    );
                  })
                )}
              </svg>
            </div>
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  const patId = `pat-${Date.now()}`;
                  const newPat: PatternItem = {
                    id: patId,
                    name: patName,
                    tileType: patTileType,
                    brickOffset: patBrickOffset,
                    width: patW,
                    height: patH,
                    hSpacing: patHSpacing,
                    vSpacing: patVSpacing,
                    dimCopies: patDimCopies,
                    elements: [
                      {
                        type: 'circle',
                        x: patW / 2,
                        y: patH / 2,
                        w: patW * 0.45,
                        h: patH * 0.45,
                        fill: '#ff9a00',
                        stroke: '#1473e6',
                      },
                    ],
                  };
                  draft.patterns.push(newPat);
                  draft.swatches.push({
                    id: `sw-${patId}`,
                    name: patName,
                    type: 'pattern',
                    color: '#ff9a00',
                    isGlobal: false,
                    isSpot: false,
                    tint: 100,
                    patternId: patId,
                    groupName: 'Patterns',
                  });
                }, 'Save Pattern Swatch');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              Done (Save to Swatches)
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          14. GRAPH DATA SPREADSHEET MODAL
         ==================================================================== */}
      {activeModal === 'graph-data' && (
        <div style={{ ...modalBoxStyle, width: 620 }}>
          <div style={modalHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={14} color="#1473e6" /> Graph Data & Type Window
            </span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.txt"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const lines = text
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean);
              if (lines.length >= 2) {
                const headers = lines[0].split(',').map((s) => s.trim());
                setGraphSeries(headers.slice(1));
                const nextLabels: string[] = [];
                const nextData: number[][] = [];
                for (let i = 1; i < lines.length; i++) {
                  const cols = lines[i].split(',').map((s) => s.trim());
                  nextLabels.push(cols[0] || `Row ${i}`);
                  nextData.push(cols.slice(1).map((v) => parseFloat(v) || 0));
                }
                setGraphLabels(nextLabels);
                setGraphData(nextData);
              }
              e.target.value = '';
            }}
          />

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={labelStyle}>Graph Type:</label>
                <select
                  value={graphType}
                  onChange={(e) => setGraphType(e.target.value as any)}
                  style={{ ...fullInputStyle, width: 170 }}
                >
                  <option value="column">Column Graph</option>
                  <option value="stacked-column">Stacked Column</option>
                  <option value="bar">Bar Graph</option>
                  <option value="stacked-bar">Stacked Bar</option>
                  <option value="line">Line Graph</option>
                  <option value="area">Area Graph</option>
                  <option value="scatter">Scatter Graph</option>
                  <option value="pie">Pie Graph</option>
                  <option value="radar">Radar Graph</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => csvInputRef.current?.click()}
                  style={{ ...secondaryBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <Upload size={12} /> Import CSV
                </button>
                <button
                  onClick={() => {
                    // Transpose rows and columns
                    const newSeries = [...graphLabels];
                    const newLabels = [...graphSeries];
                    const newData = graphSeries.map((_, colIdx) =>
                      graphData.map((row) => row[colIdx] ?? 0)
                    );
                    setGraphLabels(newLabels);
                    setGraphSeries(newSeries);
                    setGraphData(newData);
                  }}
                  style={{ ...secondaryBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <RefreshCw size={12} /> Transpose
                </button>
              </div>
            </div>

            {/* Spreadsheet Table */}
            <div
              style={{
                background: 'var(--ai-bg-input)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#2a2a2a' }}>
                    <th style={{ padding: 6, border: '1px solid var(--ai-border-subtle)' }}>Category</th>
                    {graphSeries.map((ser, sIdx) => (
                      <th key={sIdx} style={{ padding: 4, border: '1px solid var(--ai-border-subtle)' }}>
                        <input
                          type="text"
                          value={ser}
                          onChange={(e) => {
                            const next = [...graphSeries];
                            next[sIdx] = e.target.value;
                            setGraphSeries(next);
                          }}
                          style={{ ...fullInputStyle, height: 22, textAlign: 'center', fontWeight: 700 }}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {graphLabels.map((lbl, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ padding: 4, border: '1px solid #333' }}>
                        <input
                          type="text"
                          value={lbl}
                          onChange={(e) => {
                            const next = [...graphLabels];
                            next[rIdx] = e.target.value;
                            setGraphLabels(next);
                          }}
                          style={{ ...fullInputStyle, height: 22 }}
                        />
                      </td>
                      {graphSeries.map((_, cIdx) => (
                        <td key={cIdx} style={{ padding: 4, border: '1px solid #333' }}>
                          <input
                            type="number"
                            value={graphData[rIdx]?.[cIdx] ?? 0}
                            onChange={(e) => {
                              const next = graphData.map((r) => [...r]);
                              if (!next[rIdx]) next[rIdx] = [];
                              next[rIdx][cIdx] = parseFloat(e.target.value) || 0;
                              setGraphData(next);
                            }}
                            style={{ ...fullInputStyle, height: 22, textAlign: 'right' }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={graphShowLegend}
                  onChange={(e) => setGraphShowLegend(e.target.checked)}
                />
                <span>Show Legend</span>
              </label>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={graphShowShadow}
                  onChange={(e) => setGraphShowShadow(e.target.checked)}
                />
                <span>Add Drop Shadow</span>
              </label>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                mutateDocument((draft) => {
                  const existingGraph = selectedIds
                    .map((id) => draft.nodes[id])
                    .find((n) => n && n.type === 'graph');

                  if (existingGraph) {
                    existingGraph.graphSpec = {
                      graphType,
                      labels: [...graphLabels],
                      seriesNames: [...graphSeries],
                      data: graphData.map((r) => [...r]),
                      showLegend: graphShowLegend,
                      showShadow: graphShowShadow,
                    };
                  } else {
                    const ab = draft.artboards[0] || { x: 0, y: 0, width: 800, height: 600 };
                    const gid = `graph-${Date.now()}`;
                    const layer =
                      draft.layers.find((l) => l.id === draft.activeLayerId) || draft.layers[0];
                    const gx = ab.x + 120;
                    const gy = ab.y + 120;
                    const gw = 420;
                    const gh = 280;
                    draft.nodes[gid] = {
                      id: gid,
                      name: `<Graph> (${graphType})`,
                      type: 'graph',
                      layerId: layer.id,
                      visible: true,
                      locked: false,
                      x: gx,
                      y: gy,
                      width: gw,
                      height: gh,
                      rotation: 0,
                      points: createRectangleAnchors(gx, gy, gw, gh),
                      closed: true,
                      fills: [
                        {
                          id: 'fill-g',
                          visible: true,
                          type: 'solid',
                          color: '#1473e6',
                          opacity: 1,
                          blendMode: 'normal',
                        },
                      ],
                      strokes: [],
                      effects: [],
                      opacity: 1,
                      blendMode: 'normal',
                      graphSpec: {
                        graphType,
                        labels: [...graphLabels],
                        seriesNames: [...graphSeries],
                        data: graphData.map((r) => [...r]),
                        showLegend: graphShowLegend,
                        showShadow: graphShowShadow,
                      },
                    };
                    layer.nodeIds.push(gid);
                  }
                }, 'Apply Graph Data');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              Apply ✓
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          15. IMAGE TRACE MODAL
         ==================================================================== */}
      {activeModal === 'image-trace' && (
        <div style={{ ...modalBoxStyle, width: 420 }}>
          <div style={modalHeaderStyle}>
            <span>Image Trace (Bitmap to Vector)</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Preset</label>
              <select
                value={tracePreset}
                onChange={(e) => {
                  const p = e.target.value as ImageTracePresetId;
                  setTracePreset(p);
                  const opts = getImageTracePresetOptions(p);
                  setTraceMode(opts.mode);
                  setTraceThreshold(opts.threshold);
                  setTraceColors(opts.colors);
                  setTracePaths(opts.paths);
                  setTraceCorners(opts.corners);
                  setTraceNoise(opts.noise);
                  setTraceIgnoreWhite(opts.ignoreWhite);
                }}
                style={fullInputStyle}
              >
                {Object.entries(IMAGE_TRACE_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Mode</label>
              <select
                value={traceMode}
                onChange={(e) => setTraceMode(e.target.value as any)}
                style={fullInputStyle}
              >
                <option value="color">Color</option>
                <option value="grayscale">Grayscale</option>
                <option value="bw">Black and White</option>
              </select>
            </div>
            {traceMode === 'bw' ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Threshold</span>
                  <span>{traceThreshold}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={254}
                  value={traceThreshold}
                  onChange={(e) => setTraceThreshold(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Palette Colors</span>
                  <span>{traceColors}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={64}
                  value={traceColors}
                  onChange={(e) => setTraceColors(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            )}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Paths Fitting</span>
                <span>{tracePaths}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={tracePaths}
                onChange={(e) => setTracePaths(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Corners</span>
                <span>{traceCorners}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={traceCorners}
                onChange={(e) => setTraceCorners(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Noise (Min Pixel Area)</span>
                <span>{traceNoise} px</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={traceNoise}
                onChange={(e) => setTraceNoise(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={traceIgnoreWhite}
                onChange={(e) => setTraceIgnoreWhite(e.target.checked)}
              />
              <span>Ignore White Background</span>
            </label>
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={async () => {
                const targetNode =
                  selectedIds.map((id) => doc.nodes[id]).find(Boolean) ||
                  ({
                    id: 'sample-img',
                    name: 'Bitmap',
                    type: 'image',
                    layerId: doc.activeLayerId || doc.layers[0]?.id || 'layer-1',
                    visible: true,
                    locked: false,
                    x: 200,
                    y: 200,
                    width: 260,
                    height: 260,
                    rotation: 0,
                    points: [],
                    closed: true,
                    fills: [],
                    strokes: [],
                    effects: [],
                    opacity: 1,
                    blendMode: 'normal',
                  } as VectorNode);

                const res = await traceImageNodeToVectorNodes(targetNode, {
                  preset: tracePreset,
                  mode: traceMode,
                  threshold: traceThreshold,
                  colors: traceColors,
                  paths: tracePaths,
                  corners: traceCorners,
                  noise: traceNoise,
                  ignoreWhite: traceIgnoreWhite,
                });

                mutateDocument((draft) => {
                  const layer =
                    draft.layers.find((l) => l.id === targetNode.layerId) || draft.layers[0];
                  draft.nodes[res.groupNode.id] = res.groupNode;
                  for (const pn of res.pathNodes) {
                    draft.nodes[pn.id] = pn;
                  }
                  if (layer) {
                    layer.nodeIds.push(res.groupNode.id);
                  }
                }, 'Image Trace & Expand');
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              Trace & Expand
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          16. PARAMETRIC SHAPE DIALOG MODAL
         ==================================================================== */}
      {activeModal === 'shape-dialog' && (
        <div style={{ ...modalBoxStyle, width: 360 }}>
          <div style={modalHeaderStyle}>
            <span>Create Parametric Shape</span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={labelStyle}>Shape Type</label>
              <select
                value={shapeType}
                onChange={(e) => setShapeType(e.target.value as any)}
                style={fullInputStyle}
              >
                <option value="rectangle">Rectangle / Rounded Rectangle</option>
                <option value="ellipse">Ellipse</option>
                <option value="polygon">Polygon</option>
                <option value="star">Star</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Width</span>
              <NumericScrubInput value={shapeW} onChange={setShapeW} unit={doc.unit} min={4} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Height</span>
              <NumericScrubInput value={shapeH} onChange={setShapeH} unit={doc.unit} min={4} />
            </div>
            {shapeType === 'rectangle' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Corner Radius</span>
                <NumericScrubInput value={shapeRadius} onChange={setShapeRadius} unit={doc.unit} min={0} />
              </div>
            )}
            {(shapeType === 'polygon' || shapeType === 'star') && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Sides / Points</span>
                <NumericScrubInput
                  value={shapeSides}
                  onChange={setShapeSides}
                  min={3}
                  max={32}
                  decimals={0}
                />
              </div>
            )}
          </div>
          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={secondaryBtnStyle}>
              Cancel
            </button>
            <button
              onClick={() => {
                let createdId = '';
                mutateDocument((draft) => {
                  const ab = draft.artboards[0] || { x: 0, y: 0, width: 800, height: 600 };
                  const x = ab.x + (ab.width - shapeW) / 2;
                  const y = ab.y + (ab.height - shapeH) / 2;
                  const id = makeAnchorId('shape');
                  createdId = id;
                  const layer =
                    draft.layers.find((l) => l.id === draft.activeLayerId) || draft.layers[0];
                  const pts =
                    shapeType === 'ellipse'
                      ? createEllipseAnchors(x, y, shapeW, shapeH)
                      : shapeType === 'polygon'
                        ? createPolygonAnchors(x, y, shapeW, shapeH, shapeSides, shapeRadius)
                        : shapeType === 'star'
                          ? createStarAnchors(x, y, shapeW, shapeH, shapeSides, shapeInnerRatio, shapeRadius)
                          : createRectangleAnchors(x, y, shapeW, shapeH, shapeRadius);

                  draft.nodes[id] = {
                    id,
                    name:
                      shapeType === 'rectangle' && shapeRadius > 0
                        ? '<Rounded Rectangle>'
                        : `<${shapeType.charAt(0).toUpperCase() + shapeType.slice(1)}>`,
                    type: shapeType,
                    layerId: layer.id,
                    visible: true,
                    locked: false,
                    x,
                    y,
                    width: shapeW,
                    height: shapeH,
                    rotation: 0,
                    points: pts,
                    closed: true,
                    cornerRadius: shapeRadius,
                    sides: shapeSides,
                    innerRadius: shapeInnerRatio,
                    fills:
                      store.currentFillColor === 'none'
                        ? []
                        : [
                            {
                              id: makeAnchorId('fill'),
                              visible: true,
                              type: 'solid',
                              color: store.currentFillColor || '#ff9a00',
                              opacity: 1,
                              blendMode: 'normal',
                            },
                          ],
                    strokes:
                      store.currentStrokeColor === 'none' || store.currentStrokeWeight <= 0
                        ? []
                        : [
                            {
                              id: makeAnchorId('stroke'),
                              visible: true,
                              color: store.currentStrokeColor || '#1e1b4b',
                              weight: store.currentStrokeWeight || 2,
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
                    opacity: 1,
                    blendMode: 'normal',
                  };
                  layer.nodeIds.push(id);
                }, 'Create Shape');
                if (createdId && typeof store.selectNodes === 'function') {
                  store.selectNodes([createdId], false);
                }
                closeModal();
              }}
              style={primaryBtnStyle}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          17. PREFERENCES MODAL (Ctrl+K)
         ==================================================================== */}
      {activeModal === 'preferences' && (
        <div style={{ ...modalBoxStyle, width: 520 }}>
          <div style={modalHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={14} color="#1473e6" /> Preferences
            </span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={sectionBoxStyle}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                User Interface Brightness (Adobe Spectrum)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(
                  [
                    { id: 'dark', label: 'Dark', swatch: '#323232' },
                    { id: 'medium-dark', label: 'Medium Dark', swatch: '#535353' },
                    { id: 'medium-light', label: 'Medium Light', swatch: '#b8b8b8' },
                    { id: 'light', label: 'Light', swatch: '#f0f0f0' },
                  ] as const
                ).map((t) => {
                  const active = (store.uiBrightness || store.uiTheme || 'dark') === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (typeof store.setUIBrightness === 'function') {
                          store.setUIBrightness(t.id as UIThemeBrightness);
                        }
                        if (typeof store.setUiTheme === 'function') {
                          store.setUiTheme(t.id as UIThemeBrightness);
                        }
                        useStudioStore.setState({ uiBrightness: t.id, uiTheme: t.id } as any);
                        document.documentElement.setAttribute('data-ui-theme', t.id);
                      }}
                      style={{
                        padding: '8px 6px',
                        borderRadius: 5,
                        border: active ? '2px solid #1473e6' : '1px solid #444',
                        background: '#222',
                        color: 'var(--ai-text-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 16,
                          borderRadius: 3,
                          background: t.swatch,
                          border: '1px solid #666',
                        }}
                      />
                      <span style={{ fontSize: 10 }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={sectionBoxStyle}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Units & Language</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle}>General Units</label>
                  <select
                    value={doc.unit || 'px'}
                    onChange={(e) => {
                      const u = e.target.value as UnitType;
                      mutateDocument((draft) => {
                        draft.unit = u;
                      }, 'Change Document Unit');
                    }}
                    style={fullInputStyle}
                  >
                    <option value="px">Pixels (px)</option>
                    <option value="pt">Points (pt)</option>
                    <option value="pc">Picas (pc)</option>
                    <option value="mm">Millimeters (mm)</option>
                    <option value="cm">Centimeters (cm)</option>
                    <option value="in">Inches (in)</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Application Language (i18n)</label>
                  <select
                    value={store.language || 'en'}
                    onChange={(e) => {
                      const lang = e.target.value as Language;
                      if (typeof store.setLanguage === 'function') {
                        store.setLanguage(lang);
                      } else {
                        useStudioStore.setState({ language: lang } as any);
                      }
                    }}
                    style={fullInputStyle}
                  >
                    <option value="en">English (International)</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={primaryBtnStyle}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          18. KEYBOARD SHORTCUTS MODAL (Alt+Shift+Ctrl+K)
         ==================================================================== */}
      {activeModal === 'keyboard-shortcuts' && (
        <div style={{ ...modalBoxStyle, width: 600 }}>
          <div style={modalHeaderStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Keyboard size={14} color="#ff9a00" /> Keyboard Shortcuts (Alt+Shift+Ctrl+K)
            </span>
            <button type="button" aria-label="Close dialog" onClick={closeModal} style={closeBtnStyle}>
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <input
                type="text"
                placeholder="Search tool or command shortcut..."
                value={shortcutSearch}
                onChange={(e) => setShortcutSearch(e.target.value)}
                style={{ ...fullInputStyle, flex: 1 }}
              />
              <button
                onClick={() => setShortcuts(DEFAULT_SHORTCUT_BINDINGS)}
                style={secondaryBtnStyle}
              >
                Reset to Illustrator Defaults
              </button>
            </div>

            <div
              style={{
                background: 'var(--ai-bg-input)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: 6,
                maxHeight: 310,
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--ai-bg-panel-header)', color: 'var(--ai-text-secondary)', textAlign: 'left' }}>
                    <th style={{ padding: '7px 12px' }}>Category</th>
                    <th style={{ padding: '7px 12px' }}>Command / Tool</th>
                    <th style={{ padding: '7px 12px' }}>Shortcut (Click to Edit)</th>
                  </tr>
                </thead>
                <tbody>
                  {shortcuts
                    .filter(
                      (s) =>
                        !shortcutSearch.trim() ||
                        s.label.toLowerCase().includes(shortcutSearch.toLowerCase()) ||
                        s.key.toLowerCase().includes(shortcutSearch.toLowerCase())
                    )
                    .map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #2c2c2c' }}>
                        <td style={{ padding: '6px 12px', color: 'var(--ai-text-secondary)' }}>{item.category}</td>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{item.label}</td>
                        <td style={{ padding: '6px 12px' }}>
                          {editingShortcutId === item.id ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={item.key}
                              onBlur={(e) => {
                                const val = e.target.value.trim() || item.key;
                                setShortcuts((prev) =>
                                  prev.map((sc) => (sc.id === item.id ? { ...sc, key: val } : sc))
                                );
                                setEditingShortcutId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                              }}
                              style={{ ...fullInputStyle, height: 22, width: 120 }}
                            />
                          ) : (
                            <span
                              onClick={() => setEditingShortcutId(item.id)}
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: 'var(--ai-bg-panel)',
                                border: '1px solid #484848',
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                              }}
                            >
                              {item.key}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={modalFooterStyle}>
            <button onClick={closeModal} style={primaryBtnStyle}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const modalBoxStyle: React.CSSProperties = {
  background: 'var(--ai-bg-panel)',
  border: '1px solid var(--ai-border-subtle)',
  borderRadius: 6,
  boxShadow: '0 18px 48px rgba(0, 0, 0, 0.65)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '90vh',
  maxWidth: 'calc(100vw - 24px)',
  overflowY: 'auto',
};

const modalHeaderStyle: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  background: 'var(--ai-bg-panel-header)',
  borderBottom: '1px solid var(--ai-border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--ai-text-primary)',
};

const modalFooterStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'var(--ai-bg-panel-header)',
  borderTop: '1px solid var(--ai-border-subtle)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--ai-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--ai-text-secondary)',
  marginBottom: 4,
};

const fullInputStyle: React.CSSProperties = {
  width: '100%',
  height: 26,
  padding: '0 8px',
  borderRadius: 4,
  background: 'var(--ai-bg-input)',
  border: '1px solid var(--ai-border-subtle)',
  color: 'var(--ai-text-primary)',
  fontSize: 11,
  boxSizing: 'border-box',
};

const smallToggleBtn: React.CSSProperties = {
  flex: 1,
  height: 26,
  borderRadius: 4,
  border: '1px solid var(--ai-border-subtle)',
  color: 'var(--ai-text-primary)',
  fontSize: 10,
  cursor: 'pointer',
};

const primaryBtnStyle: React.CSSProperties = {
  height: 28,
  padding: '0 16px',
  borderRadius: 14,
  background: '#1473e6',
  border: 'none',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 28,
  padding: '0 14px',
  borderRadius: 14,
  background: 'transparent',
  border: '1px solid var(--ai-border-subtle)',
  color: 'var(--ai-text-primary)',
  fontWeight: 500,
  fontSize: 11,
  cursor: 'pointer',
};

const sectionBoxStyle: React.CSSProperties = {
  background: 'var(--ai-bg-panel-header)',
  border: '1px solid var(--ai-border-subtle)',
  borderRadius: 5,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontSize: 11,
};

export default StudioModals;
