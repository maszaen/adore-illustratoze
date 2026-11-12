import { createGridAnchors } from '../../core/math/gridShapes';
import { blendIntermediateNodes } from '../../core/math/blend';
import { collectSnapTargets, movingSelectionBounds, snapMove, type SnapTargets } from '../../core/math/snapping';
import { rotateNodeAround } from '../../core/math/selectionRotate';
import { cornerDragRadius, toggleCornerSelection } from '../../core/math/liveCorners';
import { DEFAULT_TEXT_STYLE } from '../panels/TypographyPanel';
import { canReflectVector, getSelectionResize, resizeVectorNode, selectionNodeBounds } from '../../core/math/selectionResize';
import { clipsTextToFrame, fitPointTextFrame, layoutText, textGlyphTransform } from '../../core/math/textLayout';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import {
  anchorsToSvgPath,
  applyLiquifyBrushToAnchors,
  computeAutoSmoothHandles,
  computeBoundingBoxFromAnchors,
  createArcAnchors,
  createEllipseAnchors,
  createLineAnchors,
  createPolygonAnchors,
  createRectangleAnchors,
  createSpiralAnchors,
  createStarAnchors,
  distance2D,
  generateNodeSvgPath,
  generateVariableWidthStrokePolygon,
  insertAnchorOnPath,
  makeAnchorId,
  nearestPointOnPath,
  smoothAnchorPoints,
  splitPathAtAnchor,
} from '../../core/math/bezier';
import { applyColorTint } from '../../core/math/color';
import { RulersAndGuides } from './RulersAndGuides';
import { GradientAnnotator } from './GradientAnnotator';
import { PerspectiveGridOverlay } from './PerspectiveGridOverlay';
import type {
  AnchorPoint,
  ArtboardItem,
  BoundingBox,
  FillItem,
  Point2D,
  StrokeItem,
  VectorNode,
} from '../../core/types';

interface SmartGuideSnap {
  x?: number;
  y?: number;
  labelX?: string;
  labelY?: string;
  lineX?: { x: number; y1: number; y2: number };
  lineY?: { y: number; x1: number; x2: number };
}

export const StudioCanvas: React.FC = () => {
  const store = useStudioStore();
  const doc = store.getActiveDocument();
  const activeTool = store.activeTool;
  const zoom = store.zoom;
  const panX = store.panX;
  const panY = store.panY;
  const viewMode = store.viewMode;
  const showGrid = store.showGrid;
  const snapToGrid = store.snapToGrid;
  const showSmartGuides = store.showSmartGuides;
  const showTransparencyGrid = store.showTransparencyGrid;
  const showBoundingBox = store.showBoundingBox;
  const showEdges = store.showEdges;
  const selectedIds = store.selectedNodeIds;
  const selectedAnchorIds = store.selectedAnchorIds;
  const keyObjectId = store.keyObjectId;
  const isolationGroupId = store.isolationGroupId;
  const patternEditId = store.patternEditId;
  const drawingMode = store.drawingMode;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [viewportSize, setViewportSize] = useState({ width: 1400, height: 900 });
  const [cursorCanvasPos, setCursorCanvasPos] = useState<Point2D>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ screenX: number; screenY: number; panX: number; panY: number } | null>(
    null
  );

  // Marquee / Lasso selection state
  const [marqueeRect, setMarqueeRect] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [lassoPoints, setLassoPoints] = useState<Point2D[]>([]);

  // Dragging object / anchor / handle / resize / rotate / live-corner / artboard / slice
  const [dragAction, setDragAction] = useState<
    | null
    | {
        type: 'move-nodes';
        initialBounds: BoundingBox | null;
        snapTargets: SnapTargets;
        startCanvas: Point2D;
        initialNodes: Record<string, VectorNode>;
        duplicated: boolean;
      }
    | {
        type: 'resize-bbox';
        handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
        startCanvas: Point2D;
        initialBounds: { x: number; y: number; width: number; height: number };
        initialNodes: Record<string, VectorNode>;
      }
    | {
        type: 'rotate-bbox';
        center: Point2D;
        startAngle: number;
        initialNodes: Record<string, VectorNode>;
      }
    | {
        type: 'live-corner';
        nodeId: string;
        anchorId: string;
        startCanvas: Point2D;
        direction: Point2D;
        initialNodes: Record<string, VectorNode>;
        targetIds: string[];
        shift: boolean;
        moved: boolean;
      }
    | {
        type: 'move-anchor';
        nodeId: string;
        anchorId: string;
        startCanvas: Point2D;
        initialPoints: AnchorPoint[];
      }
    | {
        type: 'move-handle';
        nodeId: string;
        anchorId: string;
        which: 'in' | 'out';
        breakHandles: boolean;
      }
    | { type: 'draw-text'; startCanvas: Point2D; currentCanvas: Point2D; forceArea: boolean }
    | {
        type: 'draw-shape';
        shapeTool: string;
        startCanvas: Point2D;
        currentCanvas: Point2D;
        sides: number;
        innerRatio: number;
        cornerRadius: number;
      }
    | {
        type: 'freehand';
        tool: string;
        points: Point2D[];
      }
    | {
        type: 'pen-drag-handle';
        nodeId: string;
        anchorId: string;
        anchorPos: Point2D;
      }
    | {
        type: 'artboard-resize';
        artboardId: string;
        handle: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | 'new';
        startCanvas: Point2D;
        initialArtboard: ArtboardItem;
      }
    | {
        type: 'slice-draw';
        startCanvas: Point2D;
        currentCanvas: Point2D;
      }
    | {
        type: 'measure-drag';
        startCanvas: Point2D;
        currentCanvas: Point2D;
      }
    | {
        type: 'width-drag';
        nodeId: string;
        anchorId: string;
        anchorPos: Point2D;
        asymmetric: boolean;
      }
    | {
        type: 'shape-builder-drag';
        visitedIds: string[];
        deleteMode: boolean;
        pathPoints: Point2D[];
      }
    | {
        type: 'transform-tool-drag';
        mode: 'rotate' | 'scale' | 'reflect' | 'shear' | 'free-transform';
        origin: Point2D;
        startCanvas: Point2D;
        initialNodes: Record<string, VectorNode>;
      }
  >(null);

  // Active Pen/Curvature path in progress
  const [activeDrawingNodeId, setActiveDrawingNodeId] = useState<string | null>(null);

  // Movable Transform Origin Pin for Rotate (R), Scale (S), Reflect (O), Shear
  const [transformOrigin, setTransformOrigin] = useState<Point2D | null>(null);

  const selectionKey = selectedIds.join('\u0000');
  useEffect(() => { setTransformOrigin(null); }, [selectionKey, activeTool]);

  // Inline Text Editing State
  const [editingTextNodeId, setEditingTextNodeId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  // Smart Guide active snap lines
  const [smartSnap, setSmartSnap] = useState<SmartGuideSnap | null>(null);

  // Liquify / Symbol / Eraser brush radius
  const [brushRadius, setBrushRadius] = useState(44);

  // Observe canvas container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setViewportSize({
        width: el.clientWidth || 1400,
        height: el.clientHeight || 900,
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spacebar temporary Hand tool & [ / ] brush size shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
      } else if (e.key === '[') {
        setBrushRadius((r) => Math.max(8, r - 6));
      } else if (e.key === ']') {
        setBrushRadius((r) => Math.min(200, r + 6));
      } else if (e.key === 'Escape') {
        if (dragAction?.type === 'draw-text') setDragAction(null);
        if (dragAction?.type === 'live-corner') {
          store.updateDocument(draft => { for (const [id, node] of Object.entries(dragAction.initialNodes)) draft.nodes[id] = structuredClone(node); }, 'Cancel Corners', { silent: true });
          useStudioStore.setState({ isTransactionActive: false, transactionLabel: null });
          setDragAction(null);
        }
        if (dragAction?.type === 'rotate-bbox' || (dragAction?.type === 'transform-tool-drag' && dragAction.mode === 'rotate')) {
          store.updateDocument(draft => { for (const [id, original] of Object.entries(dragAction.initialNodes)) if (draft.nodes[id]) draft.nodes[id] = structuredClone(original); }, 'Cancel Rotation', { silent: true });
          useStudioStore.setState({ isTransactionActive: false, transactionLabel: null, statusMessage: 'Rotation cancelled' });
          setDragAction(null);
        }
        if (dragAction?.type === 'move-nodes') {
          store.updateDocument(draft => { for (const [id, original] of Object.entries(dragAction.initialNodes)) if (draft.nodes[id]) draft.nodes[id] = structuredClone(original); }, 'Cancel Move', { silent: true });
          useStudioStore.setState({ isTransactionActive: false, transactionLabel: null, statusMessage: 'Move cancelled' });
          setSmartSnap(null); setDragAction(null);
        }
        if (dragAction?.type === 'resize-bbox') {
          store.updateDocument(draft => {
            for (const [id, original] of Object.entries(dragAction.initialNodes)) {
              if (draft.nodes[id]) draft.nodes[id] = structuredClone(original);
            }
          }, 'Cancel Resize', { silent: true });
          useStudioStore.setState({ isTransactionActive: false, transactionLabel: null, statusMessage: 'Resize cancelled' });
          setDragAction(null);
        }
        if (activeDrawingNodeId) {
          setActiveDrawingNodeId(null);
        }
        if (editingTextNodeId) {
          setEditingTextNodeId(null);
        }
      } else if (
        dragAction?.type === 'draw-shape' &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        setDragAction((prev) => {
          if (!prev || prev.type !== 'draw-shape') return prev;
          if (e.key === 'ArrowUp') {
            return { ...prev, sides: Math.min(24, prev.sides + 1) };
          }
          if (e.key === 'ArrowDown') {
            return { ...prev, sides: Math.max(3, prev.sides - 1) };
          }
          if (e.key === 'ArrowRight') {
            return { ...prev, cornerRadius: Math.min(120, prev.cornerRadius + 4) };
          }
          if (e.key === 'ArrowLeft') {
            return { ...prev, cornerRadius: Math.max(0, prev.cornerRadius - 4) };
          }
          return prev;
        });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isSpacePressed, activeDrawingNodeId, editingTextNodeId, dragAction]);

  // Reset active pen path if switching away from pen/curvature
  useEffect(() => {
    if (activeTool !== 'pen' && activeTool !== 'curvature') {
      setActiveDrawingNodeId(null);
    }
  }, [activeTool]);

  // Convert screen clientX/clientY to canvas coordinates
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): Point2D => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - panX) / zoom,
        y: (sy - panY) / zoom,
      };
    },
    [panX, panY, zoom]
  );

  // Point snapping is used for placement/anchor editing; selection movement
  // uses the moving object's bounds instead of the pointer location.
  const applySnapping = useCallback((pt: Point2D, excludeIds: string[] = []): Point2D => {
    const artboard = doc.artboards.find(ab => ab.id === doc.activeArtboardId) || doc.artboards[0];
    const targets = showSmartGuides ? collectSnapTargets(doc, excludeIds, store.showGuides) : { x: [], y: [] };
    const result = snapMove({ x:pt.x, y:pt.y, width:0, height:0 }, {x:0,y:0}, targets, {
      zoom, smart:showSmartGuides, grid:snapToGrid, gridOrigin: {x:artboard?.x ?? 0, y:artboard?.y ?? 0},
    });
    setSmartSnap(result.guide);
    return { x: pt.x + result.delta.x, y: pt.y + result.delta.y };
  }, [snapToGrid, showSmartGuides, zoom, doc, store.showGuides]);

  // Combined selection bounding box (computed freshly on every render so dragging/resizing updates live)
  const selectionBounds = (() => {
    if (selectedIds.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;

    const includeNodeBounds = (nid: string) => {
      const n = doc.nodes[nid];
      if (!n || !n.visible) return;
      if ((n.type === 'group' || n.type === 'clipping-group' || n.type === 'blend') && n.children?.length) {
        for (const cid of n.children) {
          includeNodeBounds(cid);
        }
        return;
      }
      count++;
      const box = selectionNodeBounds(n);
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + Math.max(1, box.width));
      maxY = Math.max(maxY, box.y + Math.max(1, box.height));
    };

    for (const id of selectedIds) {
      includeNodeBounds(id);
    }

    if (count === 0) return null;
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  })();

  // Helper to collect selected node IDs plus all nested group children for move/resize/rotate
  const collectTargetAndDescendantNodes = useCallback(
    (rootIds: string[], sourceNodes: Record<string, VectorNode>): Record<string, VectorNode> => {
      const map: Record<string, VectorNode> = {};
      const visit = (id: string) => {
        const n = sourceNodes[id];
        if (!n || map[id]) return;
        map[id] = JSON.parse(JSON.stringify(n));
        if (n.children && n.children.length > 0) {
          for (const cid of n.children) {
            visit(cid);
          }
        }
      };
      for (const id of rootIds) {
        visit(id);
      }
      return map;
    },
    []
  );

  // Resolve color with Global Swatch & Tint support
  const resolveFillOrStrokeColor = useCallback(
    (color: string, globalSwatchId?: string, tint = 100): string => {
      if (!color || color === 'none') return 'none';
      let baseHex = color;
      if (globalSwatchId) {
        const sw = doc.swatches.find((s) => s.id === globalSwatchId);
        if (sw && sw.color) {
          baseHex = sw.color;
        }
      }
      if (tint !== undefined && tint < 100) {
        return applyColorTint(baseHex, tint);
      }
      return baseHex;
    },
    [doc.swatches]
  );

  // Wheel Zoom & Pan
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (e.ctrlKey || e.metaKey || e.altKey) {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const nextZoom = Math.max(0.0313, Math.min(640, zoom * factor));
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const nextPanX = mouseX - ((mouseX - panX) / zoom) * nextZoom;
        const nextPanY = mouseY - ((mouseY - panY) / zoom) * nextZoom;
        store.setZoom(nextZoom);
        store.setPan(nextPanX, nextPanY);
      } else {
        store.setPan(panX - e.deltaX, panY - e.deltaY);
      }
    },
    [zoom, panX, panY, store]
  );

  // Helper to update a node's anchors and recompute its bounding box
  const updateNodeAnchorsAndBounds = useCallback(
    (
      nodeId: string,
      nextPoints: AnchorPoint[],
      closed?: boolean,
      label?: string,
      options?: { silent?: boolean }
    ) => {
      const bbox = computeBoundingBoxFromAnchors(nextPoints, closed ?? true);
      store.updateNode(
        nodeId,
        (n) => {
          n.points = nextPoints;
          if (closed !== undefined) n.closed = closed;
          n.x = bbox.x;
          n.y = bbox.y;
          n.width = bbox.width;
          n.height = bbox.height;
        },
        label,
        options
      );
    },
    [store]
  );

  // Create a new VectorNode with current active Fill/Stroke
  const createDefaultStyledNode = useCallback(
    (partial: Partial<VectorNode> & { type: VectorNode['type']; name: string }): VectorNode => {
      const targetLayer =
        doc.layers.find((l) => l.id === doc.activeLayerId) || doc.layers[0];
      const fills: FillItem[] =
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
            ];
      const strokes: StrokeItem[] =
        store.currentStrokeColor === 'none' || store.currentStrokeWeight <= 0
          ? []
          : [
              {
                id: makeAnchorId('strk'),
                visible: true,
                color: store.currentStrokeColor || '#1e1b4b',
                weight: store.currentStrokeWeight || 2,
                cap: 'round',
                join: 'round',
                miterLimit: 10,
                align: 'center',
                dashArray: [],
                 brushId:
                  activeTool === 'paintbrush' ? store.activeBrushId : undefined,
                opacity: 1,
                blendMode: 'normal',
              },
            ];

      return {
        id: makeAnchorId('node'),
        layerId: targetLayer ? targetLayer.id : 'layer-1',
        visible: true,
        locked: false,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        points: [],
        closed: true,
        fills,
        strokes,
        effects: [],
        opacity: 1,
        blendMode: 'normal',
        ...partial,
      };
    },
    [
      doc.layers,
      doc.activeLayerId,
      store.currentFillColor,
      store.currentStrokeColor,
      store.currentStrokeWeight,
      store.activeBrushId,
      activeTool,
    ]
  );

  // Pointer Down on Canvas Background or Object
  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || isSpacePressed || activeTool === 'hand') {
      setIsPanning(true);
      panStartRef.current = {
        screenX: e.clientX,
        screenY: e.clientY,
        panX,
        panY,
      };
      return;
    }

    const rawPos = screenToCanvas(e.clientX, e.clientY);
    const pos = applySnapping(rawPos);

    // Zoom Tool (Z)
    if (activeTool === 'zoom') {
      const factor = e.altKey ? 1 / 1.35 : 1.35;
      const nextZoom = Math.max(0.0313, Math.min(640, zoom * factor));
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        store.setZoom(nextZoom);
        store.setPan(
          mx - ((mx - panX) / zoom) * nextZoom,
          my - ((my - panY) / zoom) * nextZoom
        );
      }
      return;
    }

    // Artboard Tool (Shift+O): draw new artboard on empty pasteboard drag
    if (activeTool === 'artboard') {
      const newAb: ArtboardItem = {
        id: makeAnchorId('ab'),
        name: `Artboard ${doc.artboards.length + 1}`,
        x: pos.x,
        y: pos.y,
        width: 400,
        height: 300,
        orientation: 'landscape',
        showCenterMark: false,
        showCrossHairs: false,
        showVideoSafeAreas: false,
        backgroundColor: '#ffffff',
      };
      store.addArtboard(newAb);
      setDragAction({
        type: 'artboard-resize',
        artboardId: newAb.id,
        handle: 'se',
        startCanvas: pos,
        initialArtboard: { ...newAb, width: 10, height: 10 },
      });
      return;
    }

    // Slice Tool (Shift+K)
    if (activeTool === 'slice') {
      setDragAction({
        type: 'slice-draw',
        startCanvas: pos,
        currentCanvas: pos,
      });
      return;
    }

    // Measure Tool
    if (activeTool === 'measure') {
      setDragAction({
        type: 'measure-drag',
        startCanvas: pos,
        currentCanvas: pos,
      });
      store.setMeasureInfo({
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
        distance: 0,
        angle: 0,
      });
      return;
    }

    // Rotate / Scale / Reflect / Shear / Free Transform origin & drag
    if (
      activeTool === 'rotate' ||
      activeTool === 'scale' ||
      activeTool === 'reflect' ||
      activeTool === 'shear' ||
      activeTool === 'free-transform'
    ) {
      const origin =
        transformOrigin ||
        (selectionBounds
          ? {
              x: selectionBounds.x + selectionBounds.width / 2,
              y: selectionBounds.y + selectionBounds.height / 2,
            }
          : pos);

      if (e.altKey) {
        setTransformOrigin(pos);
        store.setActiveModal('transform-each');
        return;
      }

      if (selectedIds.length === 0) return;
      if (!transformOrigin) {
        setTransformOrigin(origin);
      }
      e.currentTarget.setPointerCapture(e.pointerId);

      const initialNodes = collectTargetAndDescendantNodes(selectedIds, doc.nodes);
      store.beginTransaction(`Transform (${activeTool})`);

      setDragAction({
        type: 'transform-tool-drag',
        mode: activeTool,
        origin,
        startCanvas: pos,
        initialNodes,
      });
      return;
    }

    // Pen Tool (P) & Curvature Tool (Shift+~)
    if (activeTool === 'pen' || activeTool === 'curvature') {
      const isCurvature = activeTool === 'curvature';
      if (activeDrawingNodeId && doc.nodes[activeDrawingNodeId]) {
        const currentNode = doc.nodes[activeDrawingNodeId];
        const pts = currentNode.points || [];

        // Check if clicking near first point to close path
        if (pts.length >= 2 && distance2D(pos, pts[0]) <= 10 / zoom) {
          const closedPts = isCurvature
            ? computeAutoSmoothHandles(pts, true)
            : pts;
          updateNodeAnchorsAndBounds(activeDrawingNodeId, closedPts, true, 'Close Path');
          setActiveDrawingNodeId(null);
          return;
        }

        const newPt: AnchorPoint = {
          id: makeAnchorId('pt'),
          x: pos.x,
          y: pos.y,
          pointType: isCurvature && !e.altKey ? 'smooth' : 'corner',
        };
        const nextPts = isCurvature
          ? computeAutoSmoothHandles([...pts, newPt], false)
          : [...pts, newPt];

        updateNodeAnchorsAndBounds(activeDrawingNodeId, nextPts, false, 'Add Anchor Point');
        store.setSelectedAnchorIds([newPt.id]);

        if (!isCurvature) {
          store.beginTransaction('Adjust Bezier Handles');
          setDragAction({
            type: 'pen-drag-handle',
            nodeId: activeDrawingNodeId,
            anchorId: newPt.id,
            anchorPos: pos,
          });
        }
      } else {
        const firstPt: AnchorPoint = {
          id: makeAnchorId('pt'),
          x: pos.x,
          y: pos.y,
          pointType: isCurvature && !e.altKey ? 'smooth' : 'corner',
        };
        const newNode = createDefaultStyledNode({
          name: '<Path>',
          type: 'path',
          x: pos.x,
          y: pos.y,
          width: 1,
          height: 1,
          points: [firstPt],
          closed: false,
        });
        store.addNode(newNode, 'Pen Path');
        store.selectNodes([newNode.id], false);
        store.setSelectedAnchorIds([firstPt.id]);
        setActiveDrawingNodeId(newNode.id);

        if (!isCurvature) {
          store.beginTransaction('Adjust Bezier Handles');
          setDragAction({
            type: 'pen-drag-handle',
            nodeId: newNode.id,
            anchorId: firstPt.id,
            anchorPos: pos,
          });
        }
      }
      return;
    }

    // Click creates point text; dragging creates a permanent area frame.
    if (activeTool === 'type' || activeTool === 'area-type') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragAction({ type: 'draw-text', startCanvas: pos, currentCanvas: pos, forceArea: activeTool === 'area-type' });
      return;
    }
    // Other Type Tools (T)
    if (
      activeTool === 'type-on-path' ||
      activeTool === 'vertical-type' ||
      activeTool === 'touch-type'
    ) {
      const isArea = false;
      const isPath = activeTool === 'type-on-path';
      const isVert = activeTool === 'vertical-type';
      const w = isArea ? 260 : 180;
      const h = isArea ? 110 : 36;
      const textNode = createDefaultStyledNode({
        name: '<Type: Lorem Ipsum>',
        type: 'text',
        x: pos.x,
        y: pos.y,
        width: w,
        height: h,
        points: createRectangleAnchors(pos.x, pos.y, w, h),
        closed: true,
        strokes: [],
        textContent: isArea
          ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vector area typography flows seamlessly inside frames.'
          : 'Adore Illustratoze',
        textStyle: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontStyle: 'Bold',
          fontSize: isArea ? 14 : 28,
          leading: isArea ? 20 : 34,
          kerning: 0,
          tracking: 0,
          horizontalScale: 100,
          verticalScale: 100,
          baselineShift: 0,
          characterRotation: 0,
          textCase: 'normal',
          underline: false,
          strikethrough: false,
          align: 'left',
          indentLeft: 0,
          indentRight: 0,
          indentFirstLine: 0,
          spaceBefore: 0,
          spaceAfter: 0,
          hyphenation: true,
          typeMode: isArea ? 'area' : isPath ? 'path' : 'point',
          vertical: isVert,
          pathEffect: 'rainbow',
        },
      });
      store.addNode(textNode, 'Add Type');
      store.selectNodes([textNode.id], false);
      setEditingTextNodeId(textNode.id);
      setEditingTextValue(textNode.textContent || '');
      return;
    }

    // Geometric Live Shapes & Line / Arc / Spiral / Grids
    if (
      [
        'rectangle',
        'rounded-rectangle',
        'ellipse',
        'polygon',
        'star',
        'flare',
        'line',
        'arc',
        'spiral',
        'rect-grid',
        'polar-grid',
      ].includes(activeTool)
    ) {
      setDragAction({
        type: 'draw-shape',
        shapeTool: activeTool,
        startCanvas: pos,
        currentCanvas: pos,
        sides: activeTool === 'star' ? 5 : 6,
        innerRatio: 0.45,
        cornerRadius: activeTool === 'rounded-rectangle' ? 16 : 0,
      });
      return;
    }

    // Graph Tools (J)
    if (
      [
        'column-graph',
        'stacked-column-graph',
        'bar-graph',
        'line-graph',
        'pie-graph',
        'radar-graph',
      ].includes(activeTool)
    ) {
      const gTypeMap: Record<string, NonNullable<VectorNode['graphSpec']>['graphType']> = {
        'column-graph': 'column',
        'stacked-column-graph': 'stacked-column',
        'bar-graph': 'bar',
        'line-graph': 'line',
        'pie-graph': 'pie',
        'radar-graph': 'radar',
      };
      const graphNode = createDefaultStyledNode({
        name: `<Graph: ${activeTool}>`,
        type: 'graph',
        x: pos.x,
        y: pos.y,
        width: 340,
        height: 220,
        points: createRectangleAnchors(pos.x, pos.y, 340, 220),
        closed: true,
        graphSpec: {
          graphType: gTypeMap[activeTool] || 'column',
          labels: ['Q1', 'Q2', 'Q3', 'Q4'],
          seriesNames: ['Print', 'Digital', 'Brand'],
          data: [
            [42, 28, 35],
            [58, 44, 49],
            [74, 62, 68],
            [91, 78, 84],
          ],
          showLegend: true,
          showShadow: false,
        },
      });
      store.addNode(graphNode, 'Create Graph');
      store.selectNodes([graphNode.id], false);
      store.setActiveModal('graph-data');
      return;
    }

    // Symbol Sprayer & Symbolism Tools (Shift+S)
    if (activeTool.startsWith('symbol-')) {
      if (activeTool === 'symbol-sprayer') svgRef.current?.setPointerCapture(e.pointerId);
      setDragAction({
        type: 'freehand',
        tool: activeTool,
        points: [pos],
      });
      return;
    }

    // Freehand Brushes, Pencil, Smooth, Path Eraser, Eraser, Knife, Liquify tools
    if (
      [
        'paintbrush',
        'blob-brush',
        'pencil',
        'smooth',
        'path-eraser',
        'eraser',
        'knife',
        'warp',
        'twirl',
        'pucker',
        'bloat',
        'scallop',
        'crystallize',
        'wrinkle',
      ].includes(activeTool)
    ) {
      setDragAction({
        type: 'freehand',
        tool: activeTool,
        points: [pos],
      });
      return;
    }

    // Lasso Tool (Q)
    if (activeTool === 'lasso') {
      setLassoPoints([pos]);
      return;
    }

    // Default Selection / Direct Selection marquee on empty pasteboard/artboard
    if (!e.shiftKey) {
      store.clearSelection();
    }
    setMarqueeRect({
      x1: pos.x,
      y1: pos.y,
      x2: pos.x,
      y2: pos.y,
    });
  };

  // Pointer Move on Canvas
  const handleCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rawPos = screenToCanvas(e.clientX, e.clientY);
    setCursorCanvasPos(rawPos);

    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.screenX;
      const dy = e.clientY - panStartRef.current.screenY;
      store.setPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy);
      return;
    }

    // Marquee Selection update
    if (marqueeRect) {
      setMarqueeRect((prev) => (prev ? { ...prev, x2: rawPos.x, y2: rawPos.y } : null));
      return;
    }

    // Lasso Selection update
    if (lassoPoints.length > 0) {
      setLassoPoints((prev) => [...prev, rawPos]);
      return;
    }

    if (!dragAction) return;

    switch (dragAction.type) {
      case 'move-nodes': {
        let dx = rawPos.x - dragAction.startCanvas.x;
        let dy = rawPos.y - dragAction.startCanvas.y;
        const axis = e.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : 'both';
        if (axis === 'x') dy = 0;
        if (axis === 'y') dx = 0;
        if (dragAction.initialBounds && Math.hypot(dx, dy) * zoom >= 0.5) {
          const artboard = doc.artboards.find(ab => ab.id === doc.activeArtboardId) || doc.artboards[0];
          const result = snapMove(dragAction.initialBounds, { x:dx, y:dy }, dragAction.snapTargets, {
            zoom, smart:showSmartGuides, grid:snapToGrid, axis, gridOrigin:{x:artboard?.x ?? 0, y:artboard?.y ?? 0},
          });
          dx = result.delta.x; dy = result.delta.y;
          setSmartSnap(result.guide);
        } else {
          setSmartSnap(null);
        }

        store.updateDocument(
          (targetDoc) => {
            for (const [id, initNode] of Object.entries(dragAction.initialNodes)) {
              const liveNode = targetDoc.nodes[id];
              if (!liveNode || liveNode.locked) continue;
              liveNode.x = initNode.x + dx;
              liveNode.y = initNode.y + dy;
              liveNode.points = (initNode.points || []).map((pt) => ({
                ...pt,
                x: pt.x + dx,
                y: pt.y + dy,
                handleIn: pt.handleIn
                  ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy }
                  : undefined,
                handleOut: pt.handleOut
                  ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy }
                  : undefined,
              }));
            }
          },
          'Move Selection',
          { silent: true }
        );
        useStudioStore.setState({
          lastTransformDelta: {
            dx,
            dy,
            dRotation: 0,
            scaleX: 1,
            scaleY: 1,
            isCopy: dragAction.duplicated,
          },
        });
        break;
      }

      case 'resize-bbox': {
        const { handle, initialBounds, initialNodes } = dragAction;
        const delta = { x: rawPos.x - dragAction.startCanvas.x, y: rawPos.y - dragAction.startCanvas.y };
        if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) {
          store.updateDocument(draft => {
            for (const [id, original] of Object.entries(initialNodes)) if (draft.nodes[id]) draft.nodes[id] = structuredClone(original);
          }, 'Scale Selection', { silent: true });
          break;
        }
        let transform = getSelectionResize(initialBounds, handle, delta, e.shiftKey);
        const canReflect = Object.values(initialNodes).every(n => canReflectVector(n) || (n.type === 'text' && n.textStyle?.typeMode === 'point') || n.type === 'group' || n.type === 'clipping-group' || n.type === 'blend');
        if (!canReflect && (transform.scaleX <= 0 || transform.scaleY <= 0)) {
          // Area text, images and other special renderers do not yet support reflection.
          transform = { ...transform, scaleX: Math.max(0.001, transform.scaleX), scaleY: Math.max(0.001, transform.scaleY) };
          store.setStatusMessage('Flip currently supports vector shapes and point text; area text and images cannot be flipped by resizing yet.');
        }
        // Avoid a singular glyph transform at exactly zero while still allowing flips.
        if (Object.values(initialNodes).some(n => n.type === 'text' && n.textStyle?.typeMode === 'point')) {
          const nonzero = (value: number) => Math.abs(value) < 0.001 ? (value < 0 ? -0.001 : 0.001) : value;
          transform = { ...transform, scaleX: nonzero(transform.scaleX), scaleY: nonzero(transform.scaleY) };
        }
        const { anchor, scaleX: sx, scaleY: sy } = transform;
        const mapPoint = (point: Point2D) => ({ x: anchor.x + (point.x - anchor.x) * sx, y: anchor.y + (point.y - anchor.y) * sy });
        store.updateDocument((targetDoc) => {
          for (const [id, initNode] of Object.entries(initialNodes)) {
            const liveNode = targetDoc.nodes[id];
            if (!liveNode || liveNode.locked) continue;
            if (canReflectVector(initNode)) {
              Object.assign(liveNode, resizeVectorNode(initNode, transform));
              continue;
            }
            const p1 = mapPoint({ x: initNode.x, y: initNode.y });
            const p2 = mapPoint({ x: initNode.x + initNode.width, y: initNode.y + initNode.height });
            liveNode.x = Math.min(p1.x, p2.x);
            liveNode.y = Math.min(p1.y, p2.y);
            liveNode.width = Math.max(0.01, Math.abs(p2.x - p1.x));
            liveNode.height = Math.max(0.01, Math.abs(p2.y - p1.y));
            if (initNode.type === 'text' && initNode.textStyle) {
              if (initNode.textStyle.typeMode === 'point') {
                liveNode.textScaleX = (initNode.textScaleX ?? 1) * sx;
                liveNode.textScaleY = (initNode.textScaleY ?? 1) * sy;
              }
            }
            liveNode.points = (initNode.points || []).map(point => ({ ...point, ...mapPoint(point),
              handleIn: point.handleIn && mapPoint(point.handleIn), handleOut: point.handleOut && mapPoint(point.handleOut) }));
          }
        }, 'Scale Selection', { silent: true });
        break;
      }

      case 'rotate-bbox': {
        const { center, startAngle, initialNodes } = dragAction;
        const currAngle =
          (Math.atan2(rawPos.y - center.y, rawPos.x - center.x) * 180) / Math.PI;
        let deltaDeg = currAngle - startAngle;
        if (e.shiftKey) {
          deltaDeg = Math.round(deltaDeg / 45) * 45;
        }
        store.updateDocument(targetDoc => {
          for (const [id, initial] of Object.entries(initialNodes)) {
            const live = targetDoc.nodes[id];
            if (live && !live.locked) Object.assign(live, rotateNodeAround(initial, center, deltaDeg));
          }
        }, 'Rotate Selection', { silent: true });
        break;
      }

      case 'live-corner': {
        const dx = rawPos.x - dragAction.startCanvas.x;
        const dy = rawPos.y - dragAction.startCanvas.y;
        if (!dragAction.moved && Math.hypot(dx, dy) * zoom < 3) break;
        if (!dragAction.moved) setDragAction(prev => prev?.type === 'live-corner' ? { ...prev, moved: true } : prev);
        // Signed projection, not distance to centre: dragging beyond the maximum
        // remains clamped until the pointer actually moves back.
        store.updateDocument(draft => {
          for (const [id, original] of Object.entries(dragAction.initialNodes)) {
            const node = draft.nodes[id];
            if (!node) continue;
            node.points = original.points.map((pt, index, points) => {
              if (!dragAction.targetIds.includes(pt.id)) return pt;
              const prev = points[(index - 1 + points.length) % points.length];
              const next = points[(index + 1) % points.length];
              const max = Math.min(distance2D(pt, prev), distance2D(pt, next)) * 0.48;
              const radius = cornerDragRadius(pt.cornerRadius ?? original.cornerRadius ?? 0, max, dragAction.startCanvas, rawPos, dragAction.direction);
              return { ...pt, cornerRadius: radius };
            });
          }
        }, 'Live Corner Radius', { silent: true });
        break;
      }

      case 'move-anchor': {
        const anchor = dragAction.initialPoints.find(pt => pt.id === dragAction.anchorId);
        if (!anchor) break;
        const desired = { x: anchor.x + rawPos.x - dragAction.startCanvas.x, y: anchor.y + rawPos.y - dragAction.startCanvas.y };
        const snapped = Math.hypot(rawPos.x - dragAction.startCanvas.x, rawPos.y - dragAction.startCanvas.y) * zoom >= 0.5
          ? applySnapping(desired, [dragAction.nodeId]) : desired;
        const dx = snapped.x - anchor.x;
        const dy = snapped.y - anchor.y;
        const movingSet = new Set(
          selectedAnchorIds.includes(dragAction.anchorId)
            ? selectedAnchorIds
            : [dragAction.anchorId]
        );
        const nextPts = dragAction.initialPoints.map((pt) => {
          if (!movingSet.has(pt.id)) return pt;
          return {
            ...pt,
            x: pt.x + dx,
            y: pt.y + dy,
            handleIn: pt.handleIn
              ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy }
              : undefined,
            handleOut: pt.handleOut
              ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy }
              : undefined,
          };
        });
        updateNodeAnchorsAndBounds(dragAction.nodeId, nextPts, undefined, 'Move Anchor Point', {
          silent: true,
        });
        break;
      }

      case 'move-handle': {
        const node = doc.nodes[dragAction.nodeId];
        if (!node) break;
        const nextPts = (node.points || []).map((pt) => {
          if (pt.id !== dragAction.anchorId) return pt;
          const mirror = {
            x: pt.x * 2 - rawPos.x,
            y: pt.y * 2 - rawPos.y,
          };
          if (dragAction.which === 'out') {
            return {
              ...pt,
              handleOut: { x: rawPos.x, y: rawPos.y },
              handleIn:
                e.altKey || dragAction.breakHandles ? pt.handleIn : mirror,
              pointType: e.altKey || dragAction.breakHandles ? ('corner' as const) : ('smooth' as const),
            };
          } else {
            return {
              ...pt,
              handleIn: { x: rawPos.x, y: rawPos.y },
              handleOut:
                e.altKey || dragAction.breakHandles ? pt.handleOut : mirror,
              pointType: e.altKey || dragAction.breakHandles ? ('corner' as const) : ('smooth' as const),
            };
          }
        });
        updateNodeAnchorsAndBounds(dragAction.nodeId, nextPts, undefined, 'Adjust Bezier Handle', {
          silent: true,
        });
        break;
      }

      case 'pen-drag-handle': {
        const node = doc.nodes[dragAction.nodeId];
        if (!node) break;
        const nextPts = (node.points || []).map((pt) => {
          if (pt.id !== dragAction.anchorId) return pt;
          const mirror = {
            x: dragAction.anchorPos.x * 2 - rawPos.x,
            y: dragAction.anchorPos.y * 2 - rawPos.y,
          };
          return {
            ...pt,
            pointType: 'smooth' as const,
            handleOut: { x: rawPos.x, y: rawPos.y },
            handleIn: e.altKey ? pt.handleIn : mirror,
          };
        });
        updateNodeAnchorsAndBounds(dragAction.nodeId, nextPts, node.closed, 'Adjust Bezier Handle', {
          silent: true,
        });
        break;
      }

      case 'draw-text': {
        setDragAction(prev => prev?.type === 'draw-text' ? { ...prev, currentCanvas: rawPos } : prev);
        break;
      }

      case 'draw-shape': {
        setDragAction((prev) =>
          prev && prev.type === 'draw-shape' ? { ...prev, currentCanvas: rawPos } : prev
        );
        break;
      }

      case 'freehand': {
        const nextPts = [...dragAction.points, rawPos];
        setDragAction({ ...dragAction, points: nextPts });

        // Live Liquify / Warp / Smooth / Symbol tools update immediately on move
        if (
          [
            'warp',
            'twirl',
            'pucker',
            'bloat',
            'scallop',
            'crystallize',
            'wrinkle',
          ].includes(dragAction.tool)
        ) {
          if (!useStudioStore.getState().isTransactionActive) {
            store.beginTransaction(`Liquify (${dragAction.tool})`);
          }
          const prevPt = dragAction.points[dragAction.points.length - 1] || rawPos;
          const delta = { x: rawPos.x - prevPt.x, y: rawPos.y - prevPt.y };
          const targets =
            selectedIds.length > 0 ? selectedIds : Object.keys(doc.nodes);
          for (const nid of targets) {
            const n = doc.nodes[nid];
            if (!n || n.locked || !n.visible || !n.points?.length) continue;
            const warpedPts = applyLiquifyBrushToAnchors(
              n.points,
              rawPos,
              brushRadius,
              dragAction.tool as any,
              delta,
              0.35
            );
            updateNodeAnchorsAndBounds(nid, warpedPts, n.closed, `Liquify (${dragAction.tool})`, {
              silent: true,
            });
          }
        }
        break;
      }

      case 'artboard-resize': {
        const { artboardId, handle, startCanvas, initialArtboard } = dragAction;
        if (!useStudioStore.getState().isTransactionActive) {
          store.beginTransaction('Modify Artboard');
        }
        const dx = rawPos.x - startCanvas.x;
        const dy = rawPos.y - startCanvas.y;
        if (handle === 'move') {
          const nextX = Math.round(initialArtboard.x + dx);
          const nextY = Math.round(initialArtboard.y + dy);
          store.updateArtboard(artboardId, { x: nextX, y: nextY }, { silent: true });
        } else {
          let x = initialArtboard.x;
          let y = initialArtboard.y;
          let w = initialArtboard.width;
          let h = initialArtboard.height;
          if (handle.includes('e')) w = Math.max(50, initialArtboard.width + dx);
          if (handle.includes('s')) h = Math.max(50, initialArtboard.height + dy);
          if (handle.includes('w')) {
            w = Math.max(50, initialArtboard.width - dx);
            x = initialArtboard.x + (initialArtboard.width - w);
          }
          if (handle.includes('n')) {
            h = Math.max(50, initialArtboard.height - dy);
            y = initialArtboard.y + (initialArtboard.height - h);
          }
          store.updateArtboard(
            artboardId,
            {
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(w),
              height: Math.round(h),
              orientation: w >= h ? 'landscape' : 'portrait',
            },
            { silent: true }
          );
        }
        break;
      }

      case 'slice-draw': {
        setDragAction({ ...dragAction, currentCanvas: rawPos });
        break;
      }

      case 'measure-drag': {
        const dx = rawPos.x - dragAction.startCanvas.x;
        const dy = rawPos.y - dragAction.startCanvas.y;
        const dist = Math.round(Math.hypot(dx, dy) * 100) / 100;
        const angle = Math.round(((Math.atan2(-dy, dx) * 180) / Math.PI) * 100) / 100;
        setDragAction({ ...dragAction, currentCanvas: rawPos });
        store.setMeasureInfo({
          x1: dragAction.startCanvas.x,
          y1: dragAction.startCanvas.y,
          x2: rawPos.x,
          y2: rawPos.y,
          distance: dist,
          angle,
        });
        break;
      }

      case 'width-drag': {
        if (!useStudioStore.getState().isTransactionActive) {
          store.beginTransaction('Adjust Variable Width');
        }
        const dist = Math.max(1, Math.min(120, distance2D(rawPos, dragAction.anchorPos)));
        store.updateNode(
          dragAction.nodeId,
          (n) => {
            n.points = (n.points || []).map((pt) => {
              if (pt.id !== dragAction.anchorId) return pt;
              return {
                ...pt,
                widthLeft: dist,
                widthRight: e.altKey || dragAction.asymmetric ? pt.widthRight ?? 4 : dist,
              };
            });
          },
          'Adjust Variable Width',
          { silent: true }
        );
        break;
      }

      case 'shape-builder-drag': {
        setDragAction((prev) =>
          prev && prev.type === 'shape-builder-drag'
            ? { ...prev, pathPoints: [...prev.pathPoints, rawPos] }
            : prev
        );
        break;
      }

      case 'transform-tool-drag': {
        const { mode, origin, startCanvas, initialNodes } = dragAction;
        const dx = rawPos.x - startCanvas.x;
        const dy = rawPos.y - startCanvas.y;

        store.updateDocument(
          (targetDoc) => {
            for (const [id, initNode] of Object.entries(initialNodes)) {
              const liveNode = targetDoc.nodes[id];
              if (!liveNode || liveNode.locked) continue;

              if (mode === 'rotate') {
                const a0 = Math.atan2(startCanvas.y - origin.y, startCanvas.x - origin.x);
                const a1 = Math.atan2(rawPos.y - origin.y, rawPos.x - origin.x);
                let degrees = (a1 - a0) * 180 / Math.PI;
                if (e.shiftKey) degrees = Math.round(degrees / 45) * 45;
                Object.assign(liveNode, rotateNodeAround(initNode, origin, degrees));
                continue;
              } else if (mode === 'scale' || mode === 'free-transform') {
                const sx = Math.max(0.1, 1 + dx / 150);
                const sy = e.shiftKey ? sx : Math.max(0.1, 1 + dy / 150);
                liveNode.points = (initNode.points || []).map((pt) => ({
                  ...pt,
                  x: origin.x + (pt.x - origin.x) * sx,
                  y: origin.y + (pt.y - origin.y) * sy,
                }));
              } else if (mode === 'reflect') {
                const flipX = Math.abs(dx) >= Math.abs(dy) ? -1 : 1;
                const flipY = flipX === -1 ? 1 : -1;
                liveNode.points = (initNode.points || []).map((pt) => ({
                  ...pt,
                  x: origin.x + (pt.x - origin.x) * flipX,
                  y: origin.y + (pt.y - origin.y) * flipY,
                }));
              } else if (mode === 'shear') {
                const shearFactor = dx / 180;
                liveNode.points = (initNode.points || []).map((pt) => ({
                  ...pt,
                  x: pt.x + (pt.y - origin.y) * shearFactor,
                  y: pt.y,
                }));
              }
              const bbox = computeBoundingBoxFromAnchors(liveNode.points, liveNode.closed);
              liveNode.x = bbox.x;
              liveNode.y = bbox.y;
              liveNode.width = bbox.width;
              liveNode.height = bbox.height;
              if ((mode === 'scale' || mode === 'free-transform') && initNode.type === 'text' && initNode.textStyle?.typeMode === 'point') {
                liveNode.textScaleX = (initNode.textScaleX ?? 1) * bbox.width / Math.max(0.01, initNode.width);
                liveNode.textScaleY = (initNode.textScaleY ?? 1) * bbox.height / Math.max(0.01, initNode.height);
              }
            }
          },
          `Transform (${mode})`,
          { silent: true }
        );
        break;
      }
    }
  };

  // Pointer Up on Canvas
  const handleCanvasPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setSmartSnap(null);

    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }

    // Complete Marquee Selection
    if (marqueeRect) {
      const minX = Math.min(marqueeRect.x1, marqueeRect.x2);
      const minY = Math.min(marqueeRect.y1, marqueeRect.y2);
      const maxX = Math.max(marqueeRect.x1, marqueeRect.x2);
      const maxY = Math.max(marqueeRect.y1, marqueeRect.y2);
      setMarqueeRect(null);

      if (maxX - minX > 3 || maxY - minY > 3) {
        if (activeTool === 'direct-select') {
          const hitAnchorIds: string[] = [];
          const hitNodeIds: string[] = [];
          for (const node of Object.values(doc.nodes)) {
            if (!node.visible || node.locked) continue;
            let matchedNode = false;
            for (const pt of node.points || []) {
              if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
                hitAnchorIds.push(pt.id);
                matchedNode = true;
              }
            }
            if (matchedNode) hitNodeIds.push(node.id);
          }
          store.selectNodes(hitNodeIds, e.shiftKey);
          store.setSelectedAnchorIds(hitAnchorIds);
        } else {
          const hitIds = Object.values(doc.nodes)
            .filter(
              (n) =>
                n.visible &&
                !n.locked &&
                !n.parentId &&
                n.x + n.width >= minX &&
                n.x <= maxX &&
                n.y + n.height >= minY &&
                n.y <= maxY
            )
            .map((n) => n.id);
          store.selectNodes(hitIds, e.shiftKey);
        }
      }
      return;
    }

    // Complete Lasso Selection
    if (lassoPoints.length > 0) {
      const poly = lassoPoints;
      setLassoPoints([]);
      if (poly.length >= 3) {
        const bbox = computeBoundingBoxFromAnchors(
          poly.map((p, i) => ({ id: `${i}`, x: p.x, y: p.y, pointType: 'corner' })),
          true
        );
        const hitAnchorIds: string[] = [];
        const hitNodeIds: string[] = [];
        for (const node of Object.values(doc.nodes)) {
          if (!node.visible || node.locked) continue;
          for (const pt of node.points || []) {
            if (
              pt.x >= bbox.x &&
              pt.x <= bbox.x + bbox.width &&
              pt.y >= bbox.y &&
              pt.y <= bbox.y + bbox.height
            ) {
              hitAnchorIds.push(pt.id);
              if (!hitNodeIds.includes(node.id)) hitNodeIds.push(node.id);
            }
          }
        }
        store.selectNodes(hitNodeIds, e.shiftKey);
        store.setSelectedAnchorIds(hitAnchorIds);
      }
      return;
    }

    if (!dragAction) return;

    if (dragAction.type === 'draw-text') {
      const start = dragAction.startCanvas;
      const end = screenToCanvas(e.clientX, e.clientY);
      const area = Math.hypot(end.x - start.x, end.y - start.y) * zoom >= 4;
      if (dragAction.forceArea && !area) { setDragAction(null); return; }
      const x = area ? Math.min(start.x, end.x) : start.x;
      const y = area ? Math.min(start.y, end.y) : start.y;
      const width = area ? Math.max(1, Math.abs(end.x - start.x)) : 1;
      const height = area ? Math.max(1, Math.abs(end.y - start.y)) : 1;
      let node = createDefaultStyledNode({
        name: '<Type: Lorem Ipsum Dolor>', type: 'text', x, y, width, height,
        points: createRectangleAnchors(x, y, width, height), closed: true, strokes: [],
        textContent: 'Lorem Ipsum Dolor',
        textStyle: { ...DEFAULT_TEXT_STYLE, ...((store as any).defaultTextStyle || {}), typeMode: area ? 'area' : 'point', wrapInFrame: false },
      });
      if (!area) node = fitPointTextFrame(node);
      store.addNode(node, 'Add Type');
      store.selectNodes([node.id], false);
      setEditingTextNodeId(node.id);
      setEditingTextValue(node.textContent || '');
      setDragAction(null);
      return;
    }

    // Finalize Draw Shape
    if (dragAction.type === 'draw-shape') {
      const { shapeTool, startCanvas, currentCanvas, sides, innerRatio, cornerRadius } =
        dragAction;
      setDragAction(null);

      const dx = currentCanvas.x - startCanvas.x;
      const dy = currentCanvas.y - startCanvas.y;

      // Single click without drag opens numeric Shape Dialog
      if (Math.hypot(dx, dy) < 4) {
        store.setActiveModal('shape-dialog');
        return;
      }

      let w = Math.abs(dx);
      let h = Math.abs(dy);
      if (e.shiftKey) {
        const m = Math.max(w, h);
        w = m;
        h = m;
      }

      const x = e.altKey ? startCanvas.x - w : dx >= 0 ? startCanvas.x : startCanvas.x - w;
      const y = e.altKey ? startCanvas.y - h : dy >= 0 ? startCanvas.y : startCanvas.y - h;
      const finalW = e.altKey ? w * 2 : w;
      const finalH = e.altKey ? h * 2 : h;

      let points: AnchorPoint[] = [];
      let closed = true;
      let nodeType: VectorNode['type'] = 'path';
      let label = '<Shape>';

      switch (shapeTool) {
        case 'rectangle':
        case 'rounded-rectangle':
          nodeType = 'rectangle';
          label =
            shapeTool === 'rounded-rectangle' || cornerRadius > 0
              ? '<Rounded Rectangle>'
              : '<Rectangle>';
          points = createRectangleAnchors(x, y, finalW, finalH, cornerRadius);
          break;
        case 'ellipse':
          nodeType = 'ellipse';
          label = '<Ellipse>';
          points = createEllipseAnchors(x, y, finalW, finalH);
          break;
        case 'polygon':
          nodeType = 'polygon';
          label = '<Polygon>';
          points = createPolygonAnchors(x, y, finalW, finalH, sides, cornerRadius);
          break;
        case 'star':
        case 'flare':
          nodeType = 'star';
          label = shapeTool === 'flare' ? '<Flare>' : '<Star>';
          points = createStarAnchors(
            x,
            y,
            finalW,
            finalH,
            shapeTool === 'flare' ? 12 : sides,
            shapeTool === 'flare' ? 0.25 : innerRatio,
            cornerRadius
          );
          break;
        case 'line':
          nodeType = 'line';
          label = '<Line>';
          points = createLineAnchors(startCanvas.x, startCanvas.y, currentCanvas.x, currentCanvas.y);
          closed = false;
          break;
        case 'arc':
          nodeType = 'path';
          label = '<Arc>';
          points = createArcAnchors(startCanvas.x, startCanvas.y, currentCanvas.x, currentCanvas.y);
          closed = false;
          break;
        case 'spiral':
          nodeType = 'path';
          label = '<Spiral>';
          points = createSpiralAnchors(
            startCanvas.x,
            startCanvas.y,
            Math.hypot(finalW, finalH) / 2
          );
          closed = false;
          break;
        case 'rect-grid':
        case 'polar-grid':
          nodeType = 'path';
          label = shapeTool === 'polar-grid' ? '<Polar Grid>' : '<Rectangular Grid>';
          points = createGridAnchors(shapeTool, x, y, finalW, finalH);
          closed = false;
          break;
      }

      const newNode = createDefaultStyledNode({
        name: label,
        type: nodeType,
        x,
        y,
        width: Math.max(2, finalW),
        height: Math.max(2, finalH),
        points,
        closed,
        cornerRadius,
        sides,
        innerRadius: innerRatio,
        ...((shapeTool === 'rect-grid' || shapeTool === 'polar-grid') ? { fills: [] } : {}),
      });

      store.addNode(newNode, `Draw ${label}`);
      store.selectNodes([newNode.id], false);
      return;
    }

    // Finalize Freehand (Paintbrush, Blob Brush, Pencil, Smooth, Eraser, Knife)
    if (dragAction.type === 'freehand') {
      const { tool, points } = dragAction;
      setDragAction(null);
      if (tool === 'symbol-sprayer') {
        if (!doc.symbols.length) return;
        const placements = [points[0]];
        let last = points[0];
        for (const end of points.slice(1)) {
          let distance = distance2D(last, end);
          while (distance >= 32 && placements.length < 100) {
            const t = 32 / distance;
            last = { x: last.x + (end.x - last.x) * t, y: last.y + (end.y - last.y) * t };
            placements.push(last);
            distance = distance2D(last, end);
          }
        }
        store.beginTransaction('Spray Symbols');
        for (const p of placements) store.placeSymbolInstance(store.activeSymbolId, p.x - 32, p.y - 32);
        store.commitTransaction();
        return;
      }
      if (points.length < 2) return;

      if (tool === 'paintbrush' || tool === 'pencil' || tool === 'blob-brush') {
        const rawAnchors: AnchorPoint[] = points
          .filter((_, idx) => idx % 2 === 0 || idx === points.length - 1)
          .map((p) => ({
            id: makeAnchorId('fh'),
            x: p.x,
            y: p.y,
            pointType: 'smooth' as const,
          }));
        const isBlob = tool === 'blob-brush';
        const smoothed = smoothAnchorPoints(rawAnchors, isBlob, 0.45);
        const bbox = computeBoundingBoxFromAnchors(smoothed, isBlob);
        const newNode = createDefaultStyledNode({
          name: isBlob ? '<Blob Shape>' : tool === 'paintbrush' ? '<Brush Path>' : '<Pencil Path>',
          type: 'path',
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          points: smoothed,
          closed: isBlob,
        });
        store.addNode(newNode, `Draw ${tool}`);
        store.selectNodes([newNode.id], false);
      } else if (tool === 'smooth' && selectedIds.length > 0) {
        for (const nid of selectedIds) {
          const n = doc.nodes[nid];
          if (n && n.points?.length >= 3) {
            const nextPts = smoothAnchorPoints(n.points, n.closed, 0.55);
            updateNodeAnchorsAndBounds(nid, nextPts, n.closed, 'Smooth Path');
          }
        }
      } else if (tool === 'eraser' || tool === 'path-eraser') {
        // Erase points within brushRadius of stroke
        const targets = selectedIds.length > 0 ? selectedIds : Object.keys(doc.nodes);
        for (const nid of targets) {
          const n = doc.nodes[nid];
          if (!n || n.locked || !n.visible || !n.points?.length) continue;
          const remaining = n.points.filter(
            (ap) => !points.some((ep) => distance2D(ap, ep) <= brushRadius * 0.6)
          );
          if (remaining.length !== n.points.length && remaining.length >= 2) {
            updateNodeAnchorsAndBounds(nid, remaining, n.closed, 'Erase Path');
          }
        }
      } else if (tool === 'knife' && selectedIds.length > 0) {
        store.runPathfinder('divide');
      }
      return;
    }

    // Finalize Slice Draw
    if (dragAction.type === 'slice-draw') {
      const { startCanvas, currentCanvas } = dragAction;
      setDragAction(null);
      const x = Math.min(startCanvas.x, currentCanvas.x);
      const y = Math.min(startCanvas.y, currentCanvas.y);
      const width = Math.max(24, Math.abs(currentCanvas.x - startCanvas.x));
      const height = Math.max(24, Math.abs(currentCanvas.y - startCanvas.y));
      store.addSlice({
        id: makeAnchorId('slice'),
        name: `slice_${doc.slices.length + 1}`,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
      return;
    }

    // Finalize Shape Builder Drag
    if (dragAction.type === 'shape-builder-drag') {
      const { visitedIds, deleteMode } = dragAction;
      setDragAction(null);
      if (visitedIds.length >= 1) {
        store.selectNodes(visitedIds, false);
        if (deleteMode) {
          store.deleteSelectedNodes();
        } else if (visitedIds.length >= 2) {
          store.runPathfinder('unite');
        }
      }
      return;
    }

    if (dragAction.type === 'live-corner' && !dragAction.moved) {
      const ids = useStudioStore.getState().selectedAnchorIds;
      store.setSelectedAnchorIds(toggleCornerSelection(ids, dragAction.anchorId, dragAction.shift));
      useStudioStore.setState({ isTransactionActive: false, transactionLabel: null });
      setDragAction(null);
      return;
    }
    if (((dragAction.type === 'move-nodes' && !dragAction.duplicated) || dragAction.type === 'resize-bbox' || dragAction.type === 'rotate-bbox' || (dragAction.type === 'transform-tool-drag' && dragAction.mode === 'rotate')) && Object.entries(dragAction.initialNodes).every(([id, original]) =>
      JSON.stringify(useStudioStore.getState().getActiveDocument().nodes[id]) === JSON.stringify(original))) {
      useStudioStore.setState({ isTransactionActive: false, transactionLabel: null });
      setDragAction(null);
      return;
    }
    if (useStudioStore.getState().isTransactionActive) {
      store.commitTransaction();
    } else if (
      dragAction.type === 'move-nodes' ||
      dragAction.type === 'resize-bbox' ||
      dragAction.type === 'rotate-bbox' ||
      dragAction.type === 'transform-tool-drag'
    ) {
      store.pushHistory(`Transform Selection`);
    }

    setDragAction(null);
  };

  // Pointer Down on a specific VectorNode
  const handleNodePointerDown = (e: React.PointerEvent, node: VectorNode) => {
    // 1. Middle mouse button, Spacebar pan, Hand tool, or Zoom tool must pass through to canvas
    if (e.button !== 0 || isSpacePressed || activeTool === 'hand' || activeTool === 'zoom') {
      return;
    }

    // 2. Drawing, Shape, Type, Freehand, Transform, Navigation & Slice tools must pass through to canvas
    const objectTargetTools = new Set([
      'select',
      'direct-select',
      'group-select',
      'eyedropper',
      'magic-wand',
      'add-anchor',
      'delete-anchor',
      'anchor-point',
      'scissors',
      'live-paint-bucket',
      'live-paint-select',
      'mesh',
      'blend',
      'shape-builder',
      'width',
    ]);
    if (!objectTargetTools.has(activeTool)) {
      return;
    }

    e.stopPropagation();
    if (node.locked) return;

    const rawPos = screenToCanvas(e.clientX, e.clientY);

    // Eyedropper Tool (I)
    if (activeTool === 'eyedropper') {
      const sampledFill = node.fills?.[0]?.color || '#ff9a00';
      const sampledStroke = node.strokes?.[0]?.color || '#1e1b4b';
      const sampledWeight = node.strokes?.[0]?.weight ?? 2;
      store.setCurrentFillColor(sampledFill);
      store.setCurrentStrokeColor(sampledStroke);
      store.setCurrentStrokeWeight(sampledWeight);
      if (selectedIds.length > 0) {
        store.updateNodes(
          selectedIds,
          (target) => {
            target.fills = JSON.parse(JSON.stringify(node.fills || []));
            target.strokes = JSON.parse(JSON.stringify(node.strokes || []));
            target.opacity = node.opacity;
            target.blendMode = node.blendMode;
          },
          'Apply Eyedropper Appearance'
        );
      }
      return;
    }

    // Magic Wand Tool (Y)
    if (activeTool === 'magic-wand') {
      store.selectByMagicWand(node.id);
      return;
    }

    // Add Anchor Point Tool (+)
    if (activeTool === 'add-anchor' && node.points?.length >= 2) {
      const hit = nearestPointOnPath(node.points, node.closed, rawPos);
      if (hit) {
        const nextPts = insertAnchorOnPath(node.points, node.closed, hit.segmentIndex, hit.t);
        updateNodeAnchorsAndBounds(node.id, nextPts, node.closed, 'Add Anchor Point');
      }
      return;
    }

    // Scissors Tool (C)
    if (activeTool === 'scissors' && node.points?.length >= 2) {
      const hit = nearestPointOnPath(node.points, node.closed, rawPos);
      if (hit) {
        const { pathA } = splitPathAtAnchor(node.points, node.closed, hit.segmentIndex);
        updateNodeAnchorsAndBounds(node.id, pathA, false, 'Scissors Split Path');
      }
      return;
    }

    // Live Paint Bucket (K)
    if (activeTool === 'live-paint-bucket') {
      store.updateNode(
        node.id,
        (n) => {
          if (n.fills && n.fills.length > 0) {
            n.fills[0].color = store.currentFillColor;
            n.fills[0].visible = true;
          } else {
            n.fills = [
              {
                id: makeAnchorId('fill'),
                visible: true,
                type: 'solid',
                color: store.currentFillColor,
                opacity: 1,
                blendMode: 'normal',
              },
            ];
          }
        },
        'Live Paint Bucket Fill'
      );
      return;
    }

    // Mesh Tool (U): convert or color mesh point
    if (activeTool === 'mesh') {
      store.selectNodes([node.id], false);
      if (node.type !== 'mesh') {
        store.createGradientMesh(3, 3);
      }
      return;
    }

    // Blend Tool (W)
    if (activeTool === 'blend') {
      if (selectedIds.length === 1 && selectedIds[0] !== node.id) {
        store.selectNodes([selectedIds[0], node.id], false);
        store.makeBlend('steps', 6);
      } else {
        store.selectNodes([node.id], false);
      }
      return;
    }

    // Shape Builder Tool (Shift+M)
    if (activeTool === 'shape-builder') {
      setDragAction({
        type: 'shape-builder-drag',
        visitedIds: [node.id],
        deleteMode: e.altKey,
        pathPoints: [rawPos],
      });
      return;
    }

    // Key Object Selection: clicking an already-selected object in a multi-selection without Shift
    const alreadySelected = selectedIds.includes(node.id);
    if (
      activeTool === 'select' &&
      alreadySelected &&
      selectedIds.length > 1 &&
      !e.shiftKey &&
      !e.altKey
    ) {
      store.setKeyObjectId(keyObjectId === node.id ? null : node.id);
    }

    const nextSelection = e.shiftKey
      ? alreadySelected
        ? selectedIds.filter((id) => id !== node.id)
        : [...selectedIds, node.id]
      : alreadySelected
      ? selectedIds
      : [node.id];

    store.selectNodes(nextSelection, false);

    // Alt+drag duplicates selected nodes
    let moveTargetIds = nextSelection;
    let duplicated = false;
    if (e.altKey && activeTool === 'select') {
      store.duplicateSelectedNodes(0, 0);
      moveTargetIds = useStudioStore.getState().selectedNodeIds;
      duplicated = true;
    }

    const latestDoc = useStudioStore.getState().getActiveDocument();
    const initialNodes = collectTargetAndDescendantNodes(moveTargetIds, latestDoc.nodes);
    svgRef.current?.setPointerCapture(e.pointerId);
    store.beginTransaction(duplicated ? 'Duplicate Selection' : 'Move Selection');

    setDragAction({
      type: 'move-nodes',
      initialBounds: movingSelectionBounds(initialNodes),
      snapTargets: showSmartGuides ? collectSnapTargets(latestDoc, Object.keys(initialNodes), store.showGuides) : { x: [], y: [] },
      startCanvas: rawPos,
      initialNodes,
      duplicated,
    });
  };

  // Render SVG Filter defs, Gradients, Patterns, and Clipping Masks
  const renderSvgDefs = () => {
    const gradients: React.ReactNode[] = [];
    const filters: React.ReactNode[] = [];
    const patterns: React.ReactNode[] = [];

    // Built-in & Document Patterns
    for (const pat of doc.patterns || []) {
      patterns.push(
        <pattern
          key={pat.id}
          id={`pat-${pat.id}`}
          width={Math.max(8, pat.width + pat.hSpacing)}
          height={Math.max(8, pat.height + pat.vSpacing)}
          patternUnits="userSpaceOnUse"
        >
          {(pat.elements || []).map((el, i) => {
            if (el.type === 'circle') {
              return (
                <circle
                  key={i}
                  cx={el.x + el.w / 2}
                  cy={el.y + el.h / 2}
                  r={Math.min(el.w, el.h) / 2}
                  fill={el.fill}
                  stroke={el.stroke}
                />
              );
            }
            if (el.type === 'rect') {
              return (
                <rect
                  key={i}
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  fill={el.fill}
                  stroke={el.stroke}
                />
              );
            }
            return (
              <path
                key={i}
                d={el.d || `M ${el.x} ${el.y} L ${el.x + el.w} ${el.y + el.h}`}
                fill={el.fill}
                stroke={el.stroke}
              />
            );
          })}
        </pattern>
      );
    }

    // Per-Node Gradients & Live Effect Filters
    for (const node of Object.values(doc.nodes)) {
      for (const fill of node.fills || []) {
        if (fill.type === 'gradient' && fill.gradient) {
          const g = fill.gradient;
          const gradId = `grad-${node.id}-${fill.id}`;
          if (g.type === 'radial') {
            gradients.push(
              <radialGradient key={gradId} id={gradId} cx="50%" cy="50%" r="50%">
                {(g.stops || []).map((st) => (
                  <stop
                    key={st.id}
                    offset={`${st.offset * 100}%`}
                    stopColor={st.color}
                    stopOpacity={st.opacity}
                  />
                ))}
              </radialGradient>
            );
          } else {
            const rad = ((g.angle || 0) * Math.PI) / 180;
            const x1 = 50 - Math.cos(rad) * 50;
            const y1 = 50 - Math.sin(rad) * 50;
            const x2 = 50 + Math.cos(rad) * 50;
            const y2 = 50 + Math.sin(rad) * 50;
            gradients.push(
              <linearGradient
                key={gradId}
                id={gradId}
                x1={`${x1}%`}
                y1={`${y1}%`}
                x2={`${x2}%`}
                y2={`${y2}%`}
              >
                {(g.stops || []).map((st) => (
                  <stop
                    key={st.id}
                    offset={`${st.offset * 100}%`}
                    stopColor={st.color}
                    stopOpacity={st.opacity}
                  />
                ))}
              </linearGradient>
            );
          }
        }
      }

      // Live Effect SVG filters (Drop Shadow, Gaussian Blur, Feather, Outer Glow)
      const enabledEffects = (node.effects || []).filter((fx) => fx.enabled);
      if (enabledEffects.length > 0) {
        const dropShadow = enabledEffects.find((fx) => fx.type === 'drop-shadow');
        const blurFx = enabledEffects.find(
          (fx) => fx.type === 'gaussian-blur' || fx.type === 'feather' || fx.type === 'radial-blur'
        );
        const glowFx = enabledEffects.find(
          (fx) => fx.type === 'outer-glow' || fx.type === 'inner-glow'
        );

        if (dropShadow || blurFx || glowFx) {
          filters.push(
            <filter
              key={`fx-${node.id}`}
              id={`fx-${node.id}`}
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              {dropShadow && (
                <feDropShadow
                  dx={Number(dropShadow.params?.offsetX ?? 6)}
                  dy={Number(dropShadow.params?.offsetY ?? 6)}
                  stdDeviation={Number(dropShadow.params?.blur ?? 6)}
                  floodColor={String(dropShadow.params?.color ?? '#000000')}
                  floodOpacity={Number(dropShadow.params?.opacity ?? 0.55)}
                />
              )}
              {glowFx && (
                <feDropShadow
                  dx={0}
                  dy={0}
                  stdDeviation={Number(glowFx.params?.blur ?? 10)}
                  floodColor={String(glowFx.params?.color ?? '#38bdf8')}
                  floodOpacity={Number(glowFx.params?.opacity ?? 0.85)}
                />
              )}
              {blurFx && (
                <feGaussianBlur stdDeviation={Number(blurFx.params?.radius ?? 6)} />
              )}
            </filter>
          );
        }
      }
    }

    return (
      <defs>
        {/* Shape Builder Region Hatch Pattern */}
        <pattern
          id="shape-builder-hatch"
          width="6"
          height="6"
          patternTransform="rotate(45 0 0)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1473e6" strokeWidth="2" opacity="0.65" />
        </pattern>
        {/* Transparency Checkerboard Pattern */}
        <pattern id="ai-transparency-checker" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#ffffff" />
          <rect width="8" height="8" fill="#d9d9d9" />
          <rect x="8" y="8" width="8" height="8" fill="#d9d9d9" />
        </pattern>
        {gradients}
        {patterns}
        {filters}
      </defs>
    );
  };

  // Render a single VectorNode with full Appearance Stack & Live Effects
  const renderVectorNode = (node: VectorNode, layerOutlineMode = false): React.ReactNode => {
    if (!node || !node.visible) return null;

    const isOutline = viewMode === 'outline' || layerOutlineMode;
    const isDimmedByIsolation =
      Boolean(isolationGroupId) &&
      node.id !== isolationGroupId &&
      node.parentId !== isolationGroupId;

    // Guide path
    if (node.isGuide) {
      if (!store.showGuides) return null;
      const d = generateNodeSvgPath(node, doc.nodes);
      return (
        <path
          key={node.id}
          d={d}
          fill="none"
          stroke="#00ffff"
          strokeWidth={1 / zoom}
          strokeDasharray={`${4 / zoom} ${3 / zoom}`}
        />
      );
    }

    // Group / Clipping Group container
    if (node.type === 'group' || node.type === 'clipping-group' || node.type === 'blend') {
      const children = (node.children || [])
        .map((cid) => doc.nodes[cid])
        .filter(Boolean);
      return (
        <g
          key={node.id}
          opacity={isDimmedByIsolation ? 0.28 : node.opacity}
          data-vector-node-id={node.id}
          onPointerDown={(e) => handleNodePointerDown(e, node)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            store.enterIsolationMode(node.id);
          }}
        >
          {node.type === 'blend' && children.length === 2 ? <>
            <g pointerEvents={activeTool === 'direct-select' || activeTool === 'group-select' || isolationGroupId === node.id ? 'auto' : 'none'}>{renderVectorNode(children[0], layerOutlineMode)}</g>
            <g pointerEvents="none">{blendIntermediateNodes(node, doc.nodes).map(ch => renderVectorNode(ch, layerOutlineMode))}</g>
            <g pointerEvents={activeTool === 'direct-select' || activeTool === 'group-select' || isolationGroupId === node.id ? 'auto' : 'none'}>{renderVectorNode(children[1], layerOutlineMode)}</g>
          </> : children.map((ch) => renderVectorNode(ch, layerOutlineMode))}
        </g>
      );
    }

    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const transformAttr = node.rotation
      ? `rotate(${node.rotation} ${cx} ${cy})`
      : undefined;

    // Outline View (`Ctrl+Y`) wireframe mode
    if (isOutline) {
      const d = generateNodeSvgPath(node, doc.nodes);
      return (
        <g
          key={node.id}
          transform={transformAttr}
          data-vector-node-id={node.id}
          onPointerDown={(e) => handleNodePointerDown(e, node)}
        >
          {node.type === 'text' ? (
            <text
              x={node.x}
              y={node.y + (node.textStyle?.fontSize || 24)}
              fill="none"
              stroke="#e5e5e5"
              strokeWidth={1 / zoom}
              fontSize={node.textStyle?.fontSize || 24}
              fontFamily={node.textStyle?.fontFamily || 'Inter, sans-serif'}
            >
              {node.textContent}
            </text>
          ) : (
            <path d={d} fill="none" stroke="#e5e5e5" strokeWidth={1 / zoom} />
          )}
          {/* Center cross mark in Outline View */}
          <line
            x1={cx - 4 / zoom}
            y1={cy}
            x2={cx + 4 / zoom}
            y2={cy}
            stroke="#9e9e9e"
            strokeWidth={1 / zoom}
          />
          <line
            x1={cx}
            y1={cy - 4 / zoom}
            x2={cx}
            y2={cy + 4 / zoom}
            stroke="#9e9e9e"
            strokeWidth={1 / zoom}
          />
        </g>
      );
    }

    const hasSvgFilter = (node.effects || []).some(
      (fx) =>
        fx.enabled &&
        ['drop-shadow', 'gaussian-blur', 'feather', 'outer-glow', 'inner-glow'].includes(fx.type)
    );
    const filterUrl = hasSvgFilter ? `url(#fx-${node.id})` : undefined;

    // 1. Raster Image Node
    if (node.type === 'image' && node.imageUrl) {
      return (
        <g
          key={node.id}
          transform={transformAttr}
          opacity={isDimmedByIsolation ? 0.28 : node.opacity}
          filter={filterUrl}
          data-vector-node-id={node.id}
          onPointerDown={(e) => handleNodePointerDown(e, node)}
        >
          <image
            href={node.imageUrl}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            preserveAspectRatio="none"
          />
        </g>
      );
    }

    // 2. Symbol Instance Node
    if (node.type === 'symbol-instance' && node.symbolId) {
      const sym = doc.symbols.find((s) => s.id === node.symbolId) || doc.symbols[0];
      return (
        <g
          key={node.id}
          transform={`translate(${node.x}, ${node.y}) scale(${node.width / 64}, ${
            node.height / 64
          }) ${node.rotation ? `rotate(${node.rotation} 32 32)` : ''}`}
          opacity={isDimmedByIsolation ? 0.28 : node.opacity}
          filter={filterUrl}
          data-vector-node-id={node.id}
          onPointerDown={(e) => handleNodePointerDown(e, node)}
        >
          {(sym?.paths || []).map((sp, idx) => (
            <path key={idx} d={sp.d} fill={sp.fill} stroke={sp.stroke} strokeWidth={1.5} />
          ))}
        </g>
      );
    }

    // 3. Data-Driven Vector Graph Node (J)
    if (node.type === 'graph' && node.graphSpec) {
      const spec = node.graphSpec;
      const flatVals = spec.data.flat();
      const maxVal = Math.max(10, ...flatVals);
      const pad = 28;
      const chartX = node.x + pad;
      const chartY = node.y + 16;
      const chartW = Math.max(60, node.width - pad * 2);
      const chartH = Math.max(50, node.height - 44);
      const palette = ['#1473e6', '#ff9a00', '#10b981', '#a855f7', '#ef4444'];

      return (
        <g
          key={node.id}
          transform={transformAttr}
          opacity={isDimmedByIsolation ? 0.28 : node.opacity}
          filter={filterUrl}
          data-vector-node-id={node.id}
          onPointerDown={(e) => handleNodePointerDown(e, node)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            store.selectNodes([node.id], false);
            store.setActiveModal('graph-data');
          }}
        >
          <rect
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            fill="#ffffff"
            stroke="#334155"
            strokeWidth={1}
            rx={4}
          />
          {spec.graphType === 'pie' ? (
            (() => {
              const row = spec.data[0] || [40, 30, 30];
              const total = row.reduce((a, b) => a + Math.max(0, b), 0) || 1;
              let startAngle = -Math.PI / 2;
              const r = Math.min(chartW, chartH) * 0.42;
              const pcx = node.x + node.width / 2;
              const pcy = node.y + node.height / 2;
              return row.map((val, idx) => {
                const sliceAngle = (Math.max(0, val) / total) * Math.PI * 2;
                const endAngle = startAngle + sliceAngle;
                const x1 = pcx + r * Math.cos(startAngle);
                const y1 = pcy + r * Math.sin(startAngle);
                const x2 = pcx + r * Math.cos(endAngle);
                const y2 = pcy + r * Math.sin(endAngle);
                const largeArc = sliceAngle > Math.PI ? 1 : 0;
                const d = `M ${pcx} ${pcy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                startAngle = endAngle;
                return (
                  <path
                    key={idx}
                    d={d}
                    fill={palette[idx % palette.length]}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                );
              });
            })()
          ) : (
            <>
              <line
                x1={chartX}
                y1={chartY}
                x2={chartX}
                y2={chartY + chartH}
                stroke="#475569"
                strokeWidth={1.2}
              />
              <line
                x1={chartX}
                y1={chartY + chartH}
                x2={chartX + chartW}
                y2={chartY + chartH}
                stroke="#475569"
                strokeWidth={1.2}
              />
              {spec.data.map((groupVals, gIdx) => {
                const groupW = chartW / Math.max(1, spec.data.length);
                const barW = (groupW * 0.72) / Math.max(1, groupVals.length);
                return (
                  <g key={gIdx}>
                    {groupVals.map((v, sIdx) => {
                      const bh = (Math.max(0, v) / maxVal) * (chartH - 10);
                      const bx = chartX + gIdx * groupW + groupW * 0.14 + sIdx * barW;
                      const by = chartY + chartH - bh;
                      return (
                        <rect
                          key={sIdx}
                          x={bx}
                          y={by}
                          width={Math.max(4, barW - 2)}
                          height={bh}
                          fill={palette[sIdx % palette.length]}
                          rx={1.5}
                        />
                      );
                    })}
                    <text
                      x={chartX + gIdx * groupW + groupW / 2}
                      y={chartY + chartH + 15}
                      fontSize={10}
                      fill="#1e293b"
                      textAnchor="middle"
                    >
                      {spec.labels[gIdx] || `G${gIdx + 1}`}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </g>
      );
    }

    // 4. Gradient Mesh Object (U)
    if (node.type === 'mesh' && node.meshGrid) {
      const { rows, cols, points: mPts } = node.meshGrid;
      const d = generateNodeSvgPath(node, doc.nodes);
      return (
        <g
          key={node.id}
          transform={transformAttr}
          opacity={isDimmedByIsolation ? 0.28 : node.opacity}
          data-vector-node-id={node.id}
          onPointerDown={(e) => handleNodePointerDown(e, node)}
        >
          <path d={d} fill={node.fills?.[0]?.color || '#38bdf8'} />
          {mPts.map((mp, idx) => (
            <circle
              key={idx}
              cx={mp.x}
              cy={mp.y}
              r={Math.max(node.width, node.height) / Math.max(rows, cols)}
              fill={mp.color}
              opacity={0.55}
              style={{ filter: 'blur(14px)' }}
            />
          ))}
        </g>
      );
    }

    // 5. Typography Node (Point Type, Area Type, Type on a Path, Touch Type)
    if (node.type === 'text') {
      const ts = node.textStyle;
      const layout = layoutText(node);
      const { fontSize, lines } = layout;
      const glyph = textGlyphTransform(node);
      const fillItem = node.fills?.find((f) => f.visible && f.type !== 'none');
      const fillHex = fillItem?.type === 'gradient' && fillItem.gradient ? `url(#grad-${node.id}-${fillItem.id})` : fillItem ? resolveFillOrStrokeColor(fillItem.color || '#000000', fillItem.globalSwatchId, fillItem.tint) : 'none';
      const strokeItem = node.strokes?.find((s) => s.visible && s.weight > 0);

      return (
        <g
          key={node.id}
          transform={transformAttr}
          opacity={isDimmedByIsolation ? 0.28 : node.opacity}
          filter={filterUrl}
          data-vector-node-id={node.id}
          onPointerDown={(e) => handleNodePointerDown(e, node)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingTextNodeId(node.id);
            setEditingTextValue(node.textContent || '');
          }}
        >
          {/* Invisible bounding hit rect so clicking anywhere on the text frame selects/drags easily */}
          <rect
            x={node.x}
            y={node.y}
            width={Math.max(10, node.width)}
            height={Math.max(10, node.height)}
            fill="transparent"
          />
          {clipsTextToFrame(node) && <defs><clipPath id={`text-frame-${Array.from(node.id).map(c => c.codePointAt(0)!.toString(16)).join('-')}`} clipPathUnits="userSpaceOnUse"><rect x={node.x} y={node.y} width={Math.max(0, node.width)} height={Math.max(0, node.height)} /></clipPath></defs>}
          <g clipPath={clipsTextToFrame(node) ? `url(#text-frame-${Array.from(node.id).map(c => c.codePointAt(0)!.toString(16)).join('-')})` : undefined}>
          <g transform={`matrix(${glyph.sx} 0 0 ${glyph.sy} ${glyph.tx} ${glyph.ty})`}>
          {lines.map((line, lIdx) => (
            <text
              key={lIdx}
              x={layout.x}
              y={layout.y + lIdx * layout.leading}
              fill={fillHex}
              fillOpacity={fillItem?.opacity ?? 1}
              strokeOpacity={strokeItem?.opacity ?? 1}
              stroke={strokeItem ? strokeItem.color : 'none'}
              strokeWidth={strokeItem ? strokeItem.weight : 0}
              fontFamily={ts?.fontFamily || 'Inter, sans-serif'}
              fontSize={fontSize}
              fontWeight={ts?.fontStyle?.toLowerCase().includes('bold') ? 700 : 400}
              fontStyle={ts?.fontStyle?.toLowerCase().includes('italic') ? 'italic' : 'normal'}
              letterSpacing={layout.letterSpacing}
              xmlSpace="preserve"
              textAnchor={
                ts?.align === 'center' ? 'middle' : ts?.align === 'right' ? 'end' : 'start'
              }
              textDecoration={
                ts?.underline ? 'underline' : ts?.strikethrough ? 'line-through' : undefined
              }
              style={{
                textTransform: ts?.textCase === 'uppercase' ? 'uppercase' : undefined,
                writingMode: ts?.vertical ? 'vertical-rl' : undefined,
                userSelect: 'none',
              }}
            >
              {line}
            </text>
          ))}
          </g>
          </g>
          {layout.overflow && selectedIds.includes(node.id) && <g pointerEvents="none"><rect x={node.x + node.width - 9 / zoom} y={node.y + node.height - 9 / zoom} width={9 / zoom} height={9 / zoom} fill="#fff" stroke="#d22" strokeWidth={1 / zoom} /><text x={node.x + node.width - 4.5 / zoom} y={node.y + node.height - 1.3 / zoom} textAnchor="middle" fontSize={9 / zoom} fill="#d22">+</text></g>}
        </g>
      );
    }

    // 6. Standard Vector Path / Shape / Compound Path with Multi-Fill & Multi-Stroke Appearance Stack
    const d = generateNodeSvgPath(node, doc.nodes);
    if (!d) return null;

    // 3D Extrude & Bevel live effect isometric extrusion layers
    const extrudeFx = (node.effects || []).find(
      (fx) => fx.enabled && (fx.type === 'extrude-3d' || fx.type === 'revolve-3d')
    );
    const transformFx = (node.effects || []).find(
      (fx) => fx.enabled && fx.type === 'transform-effect'
    );

    const visibleFills = (node.fills || []).filter((f) => f.visible && f.type !== 'none');
    const visibleStrokes = (node.strokes || []).filter((s) => s.visible && s.weight > 0);

    const renderSingleInstance = (keyPrefix: string, extraTransform?: string) => (
      <g key={keyPrefix} transform={extraTransform}>
        {/* 3D Extrude Depth Layers */}
        {extrudeFx &&
          (() => {
            const depth = Math.min(40, Math.max(4, Number(extrudeFx.params?.depth ?? 18)));
            const dxStep = Number(extrudeFx.params?.bevelX ?? 0.6);
            const dyStep = Number(extrudeFx.params?.bevelY ?? 0.6);
            const shadeColor = String(extrudeFx.params?.shadeColor ?? '#1e293b');
            return Array.from({ length: Math.min(12, Math.round(depth / 2)) }).map((_, sIdx) => (
              <path
                key={`ext-${sIdx}`}
                d={d}
                transform={`translate(${(sIdx + 1) * dxStep * 2}, ${(sIdx + 1) * dyStep * 2})`}
                fill={shadeColor}
                opacity={0.75}
              />
            ));
          })()}

        {/* Multiple Fills in Appearance Stack Order */}
        {visibleFills.map((fill) => {
          let fillPaint = 'none';
          if (fill.type === 'gradient' && fill.gradient) {
            fillPaint = `url(#grad-${node.id}-${fill.id})`;
          } else if (fill.type === 'pattern' && fill.patternId) {
            fillPaint = `url(#pat-${fill.patternId})`;
          } else {
            fillPaint = resolveFillOrStrokeColor(fill.color, fill.globalSwatchId, fill.tint);
          }

          return (
            <path
              key={fill.id}
              d={d}
              fill={fillPaint}
              fillRule={node.fillRule || 'nonzero'}
              fillOpacity={fill.opacity}
              style={{ mixBlendMode: (fill.blendMode as any) || 'normal' }}
            />
          );
        })}

        {/* Multiple Strokes in Appearance Stack Order */}
        {visibleStrokes.map((stroke) => {
          const strokePaint = resolveFillOrStrokeColor(
            stroke.color,
            stroke.globalSwatchId,
            stroke.tint
          );
          const hasVariableWidth =
            Boolean(stroke.widthProfileId && stroke.widthProfileId !== 'uniform') ||
            (node.points || []).some((p) => p.widthLeft !== undefined);

          if (hasVariableWidth && node.points?.length >= 2) {
            const vwPath = generateVariableWidthStrokePolygon(
              node.points,
              node.closed,
              stroke.weight,
              stroke.widthProfileId
            );
            return (
              <path
                key={stroke.id}
                d={vwPath}
                fill={strokePaint}
                opacity={stroke.opacity}
                style={{ mixBlendMode: (stroke.blendMode as any) || 'normal' }}
              />
            );
          }

          return (
            <path
              key={stroke.id}
              d={d}
              fill="none"
              stroke={strokePaint}
              strokeWidth={stroke.weight}
              strokeLinecap={
                stroke.cap === 'projecting' ? 'square' : stroke.cap || 'round'
              }
              strokeLinejoin={stroke.join || 'round'}
              strokeMiterlimit={stroke.miterLimit || 10}
              strokeDasharray={
                stroke.dashArray && stroke.dashArray.length > 0
                  ? stroke.dashArray.join(' ')
                  : undefined
              }
              strokeOpacity={stroke.opacity}
              style={{ mixBlendMode: (stroke.blendMode as any) || 'normal' }}
            />
          );
        })}

        {/* Transparent Hit Target when object has no visible fill */}
        {visibleFills.length === 0 && (
          <path d={d} fill="transparent" stroke="transparent" strokeWidth={Math.max(8, 10 / zoom)} />
        )}

        {/* Shape Builder Interactive Region Highlight */}
        {activeTool === 'shape-builder' && selectedIds.includes(node.id) && (
          <path
            d={d}
            fill="url(#shape-builder-hatch)"
            stroke="#1473e6"
            strokeWidth={1.5 / zoom}
            onPointerEnter={() => {
              if (dragAction?.type === 'shape-builder-drag') {
                setDragAction((prev) =>
                  prev && prev.type === 'shape-builder-drag'
                    ? {
                        ...prev,
                        visitedIds: prev.visitedIds.includes(node.id)
                          ? prev.visitedIds
                          : [...prev.visitedIds, node.id],
                      }
                    : prev
                );
              }
            }}
          />
        )}
      </g>
    );

    // Transform Effect Live Copies
    const copiesCount = transformFx ? Math.min(24, Number(transformFx.params?.copies ?? 0)) : 0;

    return (
      <g
        key={node.id}
        transform={transformAttr}
        opacity={isDimmedByIsolation ? 0.28 : node.opacity}
        filter={filterUrl}
        style={{ mixBlendMode: (node.blendMode as any) || 'normal' }}
        data-vector-node-id={node.id}
        onPointerDown={(e) => handleNodePointerDown(e, node)}
      >
        {renderSingleInstance('base')}
        {copiesCount > 0 &&
          Array.from({ length: copiesCount }).map((_, idx) => {
            const step = idx + 1;
            const moveX = Number(transformFx?.params?.moveX ?? 20) * step;
            const moveY = Number(transformFx?.params?.moveY ?? 0) * step;
            const rot = Number(transformFx?.params?.rotate ?? 15) * step;
            const scX = Math.pow(Number(transformFx?.params?.scaleX ?? 100) / 100, step);
            const scY = Math.pow(Number(transformFx?.params?.scaleY ?? 100) / 100, step);
            return renderSingleInstance(
              `copy-${step}`,
              `translate(${moveX}, ${moveY}) translate(${cx}, ${cy}) rotate(${rot}) scale(${scX}, ${scY}) translate(${-cx}, ${-cy})`
            );
          })}
      </g>
    );
  };

  // Determine cursor style for active tool & active drag handle
  const canvasCursor = useMemo(() => {
    if (isPanning) return 'grabbing';
    if (isSpacePressed || activeTool === 'hand') return 'grab';
    if (dragAction?.type === 'resize-bbox' || dragAction?.type === 'artboard-resize') {
      const h = dragAction.handle;
      if (h === 'nw' || h === 'se') return 'nwse-resize';
      if (h === 'ne' || h === 'sw') return 'nesw-resize';
      if (h === 'n' || h === 's') return 'ns-resize';
      if (h === 'e' || h === 'w') return 'ew-resize';
    }
    if (dragAction?.type === 'rotate-bbox') return 'grabbing';
    if (dragAction?.type === 'live-corner') return 'pointer';
    if (activeTool === 'zoom') return 'zoom-in';
    if (activeTool === 'type' || activeTool.includes('type')) return 'text';
    if (activeTool === 'select') return 'default';
    return 'crosshair';
  }, [isPanning, isSpacePressed, activeTool, dragAction]);

  return (
    <div
      ref={containerRef}
      className="ai-canvas-container"
      onWheel={handleWheel}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor:
          viewMode === 'trim' ? '#121212' : 'var(--ai-bg-pasteboard, #1e1e1e)',
        cursor: canvasCursor,
        userSelect: 'none',
      }}
    >
      {/* Isolation Mode Top Breadcrumb Bar */}
      {isolationGroupId && (
        <div
          style={{
            position: 'absolute',
            top: store.showRulers ? 20 : 0,
            left: store.showRulers ? 20 : 0,
            right: 0,
            height: 26,
            backgroundColor: '#383838',
            borderBottom: '1px solid #1a1a1a',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            zIndex: 80,
            fontSize: 11,
            color: '#e8e8e8',
          }}
        >
          <button
            type="button"
            className="ai-btn"
            style={{ height: 18, padding: '0 6px' }}
            onClick={() => store.exitIsolationMode()}
          >
            ← Exit Isolation Mode
          </button>
          <span style={{ color: '#9e9e9e' }}>Layer 1</span>
          <span>▸</span>
          <strong style={{ color: '#ff9a00' }}>
            {doc.nodes[isolationGroupId]?.name || '<Group>'}
          </strong>
        </div>
      )}

      {/* Pattern Editing Mode Top Banner */}
      {patternEditId && (
        <div
          style={{
            position: 'absolute',
            top: store.showRulers ? 20 : 0,
            left: store.showRulers ? 20 : 0,
            right: 0,
            height: 28,
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            zIndex: 80,
            fontSize: 11,
            color: '#f8fafc',
          }}
        >
          <span>
            ❖ <strong>Pattern Editing Mode</strong> — Tile repetitions preview active
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="ai-btn active"
              style={{ height: 20, padding: '0 10px' }}
              onClick={() => store.exitPatternEditMode(true)}
            >
              ✓ Done (Save Pattern Swatch)
            </button>
            <button
              type="button"
              className="ai-btn"
              style={{ height: 20, padding: '0 8px' }}
              onClick={() => store.exitPatternEditMode(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Interactive Vector SVG Surface */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerOver={(e) => {
          const element = (e.target as Element).closest?.('[data-vector-node-id]');
          const id = element?.getAttribute('data-vector-node-id');
          const node = id ? doc.nodes[id] : undefined;
          const layer = node && doc.layers.find(l => l.id === node.layerId);
          setHoveredNodeId(node && !node.locked && layer?.visible && !layer.locked ? node.id : null);
        }}
        onPointerLeave={() => setHoveredNodeId(null)}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={() => {
          if (dragAction?.type === 'draw-text' || dragAction?.type === 'freehand' && dragAction.tool === 'symbol-sprayer') { setDragAction(null); return; }
          if (dragAction?.type === 'live-corner') {
            store.updateDocument(draft => { for (const [id, node] of Object.entries(dragAction.initialNodes)) draft.nodes[id] = structuredClone(node); }, 'Cancel Corners', { silent: true });
            useStudioStore.setState({ isTransactionActive: false, transactionLabel: null });
            setDragAction(null); return;
          }
          if (dragAction?.type === 'rotate-bbox' || (dragAction?.type === 'transform-tool-drag' && dragAction.mode === 'rotate')) {
            store.updateDocument(draft => { for (const [id, original] of Object.entries(dragAction.initialNodes)) if (draft.nodes[id]) draft.nodes[id] = structuredClone(original); }, 'Cancel Rotation', { silent: true });
            useStudioStore.setState({ isTransactionActive: false, transactionLabel: null, statusMessage: 'Rotation cancelled' });
            setDragAction(null); return;
          }
          if (dragAction?.type === 'move-nodes') {
            store.updateDocument(draft => { for (const [id, original] of Object.entries(dragAction.initialNodes)) if (draft.nodes[id]) draft.nodes[id] = structuredClone(original); }, 'Cancel Move', { silent: true });
            useStudioStore.setState({ isTransactionActive: false, transactionLabel: null, statusMessage: 'Move cancelled' });
            setSmartSnap(null); setDragAction(null); return;
          }
          if (dragAction?.type !== 'resize-bbox') return;
          store.updateDocument(draft => {
            for (const [id, original] of Object.entries(dragAction.initialNodes)) {
              if (draft.nodes[id]) draft.nodes[id] = structuredClone(original);
            }
          }, 'Cancel Resize', { silent: true });
          useStudioStore.setState({ isTransactionActive: false, transactionLabel: null, statusMessage: 'Resize cancelled' });
          setDragAction(null);
        }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        {renderSvgDefs()}

        {/* World Coordinate Transform Group (Pan + Zoom) */}
        <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          {/* 1. Artboards, Bleed Frames, Grids & Safe Areas */}
          {doc.artboards.map((ab, idx) => {
            const isActiveAb = ab.id === doc.activeArtboardId;
            const bleed = doc.bleed || { top: 0, bottom: 0, left: 0, right: 0 };
            const hasBleed =
              bleed.top > 0 || bleed.bottom > 0 || bleed.left > 0 || bleed.right > 0;

            return (
              <g
                key={ab.id}
                onPointerDown={(e) => {
                  if (activeTool === 'artboard') {
                    e.stopPropagation();
                    store.setActiveArtboardId(ab.id);
                    const startPos = screenToCanvas(e.clientX, e.clientY);
                    if (e.altKey) {
                      store.addArtboard({
                        ...ab,
                        id: makeAnchorId('ab'),
                        name: `${ab.name} Copy`,
                        x: ab.x + 40,
                        y: ab.y + 40,
                      });
                      return;
                    }
                    setDragAction({
                      type: 'artboard-resize',
                      artboardId: ab.id,
                      handle: 'move',
                      startCanvas: startPos,
                      initialArtboard: { ...ab },
                    });
                  } else {
                    store.setActiveArtboardId(ab.id);
                  }
                }}
              >
                {/* Drop shadow behind artboard */}
                <rect
                  x={ab.x + 3 / zoom}
                  y={ab.y + 4 / zoom}
                  width={ab.width}
                  height={ab.height}
                  fill="rgba(0,0,0,0.38)"
                />

                {/* Artboard Paper / Transparency Grid Surface */}
                <rect
                  x={ab.x}
                  y={ab.y}
                  width={ab.width}
                  height={ab.height}
                  fill={
                    viewMode === 'outline'
                      ? '#262626'
                      : showTransparencyGrid
                      ? 'url(#ai-transparency-checker)'
                      : ab.backgroundColor || '#ffffff'
                  }
                  stroke={isActiveAb ? '#000000' : '#555555'}
                  strokeWidth={(isActiveAb ? 1.5 : 1) / zoom}
                />

                {/* Document Grid Overlay (`Ctrl+'`) */}
                {showGrid && (
                  <g opacity={0.22} pointerEvents="none">
                    {Array.from({ length: Math.floor(ab.width / 20) }).map((_, gx) => (
                      <line
                        key={`gx-${gx}`}
                        x1={ab.x + (gx + 1) * 20}
                        y1={ab.y}
                        x2={ab.x + (gx + 1) * 20}
                        y2={ab.y + ab.height}
                        stroke="#64748b"
                        strokeWidth={((gx + 1) % 5 === 0 ? 1 : 0.5) / zoom}
                      />
                    ))}
                    {Array.from({ length: Math.floor(ab.height / 20) }).map((_, gy) => (
                      <line
                        key={`gy-${gy}`}
                        x1={ab.x}
                        y1={ab.y + (gy + 1) * 20}
                        x2={ab.x + ab.width}
                        y2={ab.y + (gy + 1) * 20}
                        stroke="#64748b"
                        strokeWidth={((gy + 1) % 5 === 0 ? 1 : 0.5) / zoom}
                      />
                    ))}
                  </g>
                )}

                {/* Red Print Bleed Frame (`#ff0000`) */}
                {hasBleed && viewMode !== 'trim' && (
                  <rect
                    x={ab.x - bleed.left}
                    y={ab.y - bleed.top}
                    width={ab.width + bleed.left + bleed.right}
                    height={ab.height + bleed.top + bleed.bottom}
                    fill="none"
                    stroke="#ff0000"
                    strokeWidth={1 / zoom}
                    pointerEvents="none"
                  />
                )}

                {/* Center Mark / Cross Hairs / Video Safe Areas */}
                {ab.showCenterMark && (
                  <g stroke="#22c55e" strokeWidth={1 / zoom} pointerEvents="none">
                    <line
                      x1={ab.x + ab.width / 2 - 10}
                      y1={ab.y + ab.height / 2}
                      x2={ab.x + ab.width / 2 + 10}
                      y2={ab.y + ab.height / 2}
                    />
                    <line
                      x1={ab.x + ab.width / 2}
                      y1={ab.y + ab.height / 2 - 10}
                      x2={ab.x + ab.width / 2}
                      y2={ab.y + ab.height / 2 + 10}
                    />
                  </g>
                )}

                {ab.showVideoSafeAreas && (
                  <g fill="none" stroke="#22d3ee" strokeWidth={1 / zoom} pointerEvents="none">
                    <rect
                      x={ab.x + ab.width * 0.05}
                      y={ab.y + ab.height * 0.05}
                      width={ab.width * 0.9}
                      height={ab.height * 0.9}
                      strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                    />
                    <rect
                      x={ab.x + ab.width * 0.1}
                      y={ab.y + ab.height * 0.1}
                      width={ab.width * 0.8}
                      height={ab.height * 0.8}
                      strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                    />
                  </g>
                )}

                {/* Artboard Badge & 8 Resize Handles when Artboard Tool (`Shift+O`) is active */}
                {(activeTool === 'artboard' || doc.artboards.length > 1) && (
                  <g>
                    <rect
                      x={ab.x}
                      y={ab.y - 20 / zoom}
                      width={135 / zoom}
                      height={18 / zoom}
                      fill={isActiveAb ? '#1473e6' : '#323232'}
                      rx={2 / zoom}
                    />
                    <text
                      x={ab.x + 6 / zoom}
                      y={ab.y - 7 / zoom}
                      fill="#ffffff"
                      fontSize={10 / zoom}
                      fontWeight={600}
                    >
                      {String(idx + 1).padStart(2, '0')} - {ab.name}
                    </text>
                  </g>
                )}

                {activeTool === 'artboard' && isActiveAb && (
                  <g>
                    <rect
                      x={ab.x}
                      y={ab.y}
                      width={ab.width}
                      height={ab.height}
                      fill="none"
                      stroke="#1473e6"
                      strokeWidth={2 / zoom}
                      strokeDasharray={`${5 / zoom} ${3 / zoom}`}
                    />
                    {(
                      [
                        ['nw', ab.x, ab.y, 'nwse-resize'],
                        ['ne', ab.x + ab.width, ab.y, 'nesw-resize'],
                        ['se', ab.x + ab.width, ab.y + ab.height, 'nwse-resize'],
                        ['sw', ab.x, ab.y + ab.height, 'nesw-resize'],
                      ] as const
                    ).map(([hName, hx, hy, cur]) => (
                      <rect
                        key={hName}
                        x={hx - 4 / zoom}
                        y={hy - 4 / zoom}
                        width={8 / zoom}
                        height={8 / zoom}
                        fill="#ffffff"
                        stroke="#1473e6"
                        strokeWidth={1.5 / zoom}
                        style={{ cursor: cur }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setDragAction({
                            type: 'artboard-resize',
                            artboardId: ab.id,
                            handle: hName,
                            startCanvas: screenToCanvas(e.clientX, e.clientY),
                            initialArtboard: { ...ab },
                          });
                        }}
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}

          {/* 2. Scene Graph Layers & Vector Nodes (Bottom-to-Top Render Order) */}
          {[...doc.layers]
            .reverse()
            .filter((layer) => layer.visible)
            .map((layer) => (
              <g
                key={layer.id}
                opacity={layer.templateMode ? 0.5 : layer.opacity ?? 1}
                style={{ pointerEvents: layer.locked ? 'none' : 'auto' }}
              >
                {layer.nodeIds.map((nid) => {
                  const node = doc.nodes[nid];
                  if (!node || node.parentId) return null;
                  return renderVectorNode(node, layer.outlineMode);
                })}
              </g>
            ))}

          {/* 3. Draw Inside Mode Dashed Corner Frame */}
          {drawingMode === 'inside' && selectionBounds && (
            <g pointerEvents="none" stroke="#38bdf8" strokeWidth={1.5 / zoom}>
              <rect
                x={selectionBounds.x - 4}
                y={selectionBounds.y - 4}
                width={selectionBounds.width + 8}
                height={selectionBounds.height + 8}
                fill="none"
                strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              />
            </g>
          )}

          {/* 4. User Slices Overlay */}
          {doc.slices.map((sl, idx) => (
            <g key={sl.id}>
              <rect
                x={sl.x}
                y={sl.y}
                width={sl.width}
                height={sl.height}
                fill="rgba(255, 154, 0, 0.08)"
                stroke="#ff9a00"
                strokeWidth={1 / zoom}
                strokeDasharray={`${4 / zoom} ${2 / zoom}`}
              />
              <rect
                x={sl.x}
                y={sl.y}
                width={58 / zoom}
                height={15 / zoom}
                fill="#ff9a00"
              />
              <text
                x={sl.x + 4 / zoom}
                y={sl.y + 11 / zoom}
                fill="#111111"
                fontSize={9 / zoom}
                fontWeight={700}
              >
                {idx + 1}: {sl.name}
              </text>
            </g>
          ))}

          {/* 5. Selection Bounding Box, Key Object Highlight, Live Corner Widgets & Anchor Handles */}
          {showEdges &&
            selectedIds.map((id) => {
              const node = doc.nodes[id];
              if (!node || !node.visible) return null;
              const layer = doc.layers.find((l) => l.id === node.layerId);
              const layerColor = layer?.color || '#4f8cff';
              const isKeyObject = keyObjectId === node.id;
              const d = generateNodeSvgPath(node, doc.nodes);

              return (
                <g key={`sel-${id}`}>
                  {/* Selected Path Outline in Layer Color */}
                  <path
                    d={d}
                    transform={node.rotation ? `rotate(${node.rotation} ${node.x + node.width / 2} ${node.y + node.height / 2})` : undefined}
                    fill="none"
                    stroke={layerColor}
                    strokeWidth={(isKeyObject ? 3 : 1.2) / zoom}
                    pointerEvents="none"
                  />

                  {/* Live Corner Widgets for Corner Points (Click & Drag inward/outward, Alt+Click to cycle Round/Inverted/Chamfer) */}
                  {(activeTool === 'select' ||
                    activeTool === 'direct-select' ||
                    activeTool === 'rounded-rectangle') &&
                    node.type !== 'text' && node.type !== 'image' &&
                    (node.points || []).map((pt) => {
                      if (pt.pointType !== 'corner' || pt.handleIn || pt.handleOut) return null;
                      const cx = node.x + node.width / 2;
                      const cy = node.y + node.height / 2;
                      const dx = cx - pt.x;
                      const dy = cy - pt.y;
                      const len = Math.hypot(dx, dy) || 1;
                      const curRad = pt.cornerRadius ?? node.cornerRadius ?? 0;
                      const offsetDist = Math.min(
                        Math.max(14 / zoom, curRad * 0.85 + 10 / zoom),
                        len * 0.45
                      );
                      const wx = pt.x + (dx / len) * offsetDist;
                      const wy = pt.y + (dy / len) * offsetDist;

                      return (
                        <g
                          key={`lc-${pt.id}`}
                          data-corner-widget={pt.id}
                          data-corner-selected={selectedAnchorIds.includes(pt.id) ? "true" : "false"}
                          style={{ cursor: 'pointer' }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (e.altKey) {
                              const cycle: ('round' | 'inverted' | 'chamfer')[] = [
                                'round',
                                'inverted',
                                'chamfer',
                              ];
                              const currType = pt.cornerType || node.cornerType || 'round';
                              const nextType = cycle[(cycle.indexOf(currType) + 1) % cycle.length];
                              store.updateNode(
                                node.id,
                                (n) => {
                                  n.cornerType = nextType;
                                  n.points = (n.points || []).map((ap) =>
                                    ap.id === pt.id ? { ...ap, cornerType: nextType } : ap
                                  );
                                },
                                `Corner Style: ${nextType}`
                              );
                              return;
                            }
                            const eligible = (p: AnchorPoint) => p.pointType === 'corner' && !p.handleIn && !p.handleOut;
                            const chosen = selectedAnchorIds.includes(pt.id)
                              ? selectedAnchorIds
                              : selectedAnchorIds.length ? [pt.id] : node.points.filter(eligible).map(p => p.id);
                            const initialNodes: Record<string, VectorNode> = {};
                            for (const selectedId of selectedIds) {
                              const selected = doc.nodes[selectedId];
                              if (selected && !selected.locked && selected.points.some(p => chosen.includes(p.id))) initialNodes[selectedId] = structuredClone(selected);
                            }
                            const direction = { x: dx / len, y: dy / len };
                            svgRef.current?.setPointerCapture(e.pointerId);
                            store.beginTransaction('Live Corner Radius');
                            setDragAction({ type: 'live-corner', nodeId: node.id, anchorId: pt.id,
                              startCanvas: screenToCanvas(e.clientX, e.clientY), direction, initialNodes,
                              targetIds: chosen, shift: e.shiftKey, moved: false });
                          }}
                        >
                          {/* Invisible larger hit target for easy grabbing */}
                          <circle cx={wx} cy={wy} r={9 / zoom} fill="transparent" />
                          <circle
                            cx={wx}
                            cy={wy}
                            r={5 / zoom}
                            fill={selectedAnchorIds.includes(pt.id) ? layerColor : "#ffffff"}
                            stroke={layerColor}
                            strokeWidth={1.4 / zoom}
                          />
                          <circle cx={wx} cy={wy} r={2 / zoom} fill={selectedAnchorIds.includes(pt.id) ? "#ffffff" : layerColor} />
                        </g>
                      );
                    })}

                  {/* Direct Selection / Pen / Anchor Point / Width Tool Anchor Points & Bezier Handles */}
                  {(activeTool === 'direct-select' ||
                    activeTool === 'pen' ||
                    activeTool === 'add-anchor' ||
                    activeTool === 'delete-anchor' ||
                    activeTool === 'curvature' ||
                    activeTool === 'anchor-point' ||
                    activeTool === 'width') &&
                    (node.points || []).map((pt) => {
                      const isAnchorSelected =
                        selectedAnchorIds.includes(pt.id) || selectedAnchorIds.length === 0;
                      const size = 6 / zoom;

                      return (
                        <g key={`ap-${pt.id}`}>
                          {/* Bezier Handle In */}
                          {pt.handleIn && (
                            <>
                              <line
                                x1={pt.x}
                                y1={pt.y}
                                x2={pt.handleIn.x}
                                y2={pt.handleIn.y}
                                stroke={layerColor}
                                strokeWidth={1 / zoom}
                              />
                              <circle
                                cx={pt.handleIn.x}
                                cy={pt.handleIn.y}
                                r={3.5 / zoom}
                                fill={layerColor}
                                stroke="#ffffff"
                                strokeWidth={1 / zoom}
                                style={{ cursor: 'pointer' }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  store.beginTransaction('Adjust Bezier Handle');
                                  setDragAction({
                                    type: 'move-handle',
                                    nodeId: node.id,
                                    anchorId: pt.id,
                                    which: 'in',
                                    breakHandles: e.altKey || activeTool === 'anchor-point',
                                  });
                                }}
                              />
                            </>
                          )}

                          {/* Bezier Handle Out */}
                          {pt.handleOut && (
                            <>
                              <line
                                x1={pt.x}
                                y1={pt.y}
                                x2={pt.handleOut.x}
                                y2={pt.handleOut.y}
                                stroke={layerColor}
                                strokeWidth={1 / zoom}
                              />
                              <circle
                                cx={pt.handleOut.x}
                                cy={pt.handleOut.y}
                                r={3.5 / zoom}
                                fill={layerColor}
                                stroke="#ffffff"
                                strokeWidth={1 / zoom}
                                style={{ cursor: 'pointer' }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  store.beginTransaction('Adjust Bezier Handle');
                                  setDragAction({
                                    type: 'move-handle',
                                    nodeId: node.id,
                                    anchorId: pt.id,
                                    which: 'out',
                                    breakHandles: e.altKey || activeTool === 'anchor-point',
                                  });
                                }}
                              />
                            </>
                          )}

                          {/* Anchor Square: Solid when selected, Hollow white when unselected */}
                          <rect
                            data-anchor-id={pt.id}
                            x={pt.x - size / 2}
                            y={pt.y - size / 2}
                            width={size}
                            height={size}
                            fill={isAnchorSelected ? layerColor : '#ffffff'}
                            stroke={layerColor}
                            strokeWidth={1.3 / zoom}
                            style={{ cursor: 'pointer' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const canvasPt = screenToCanvas(e.clientX, e.clientY);

                              if (activeTool === 'delete-anchor') {
                                const nextPts = (node.points || []).filter(
                                  (ap) => ap.id !== pt.id
                                );
                                if (nextPts.length >= 2) {
                                  updateNodeAnchorsAndBounds(
                                    node.id,
                                    nextPts,
                                    node.closed,
                                    'Delete Anchor Point'
                                  );
                                }
                                return;
                              }

                              if (activeTool === 'anchor-point') {
                                if (pt.pointType === 'smooth') {
                                  const nextPts = (node.points || []).map((ap) =>
                                    ap.id === pt.id
                                      ? {
                                          ...ap,
                                          pointType: 'corner' as const,
                                          handleIn: undefined,
                                          handleOut: undefined,
                                        }
                                      : ap
                                  );
                                  updateNodeAnchorsAndBounds(
                                    node.id,
                                    nextPts,
                                    node.closed,
                                    'Convert Anchor to Corner'
                                  );
                                } else {
                                  store.beginTransaction('Convert Anchor to Smooth');
                                  setDragAction({
                                    type: 'pen-drag-handle',
                                    nodeId: node.id,
                                    anchorId: pt.id,
                                    anchorPos: { x: pt.x, y: pt.y },
                                  });
                                }
                                return;
                              }

                              if (activeTool === 'width') {
                                store.beginTransaction('Adjust Variable Width');
                                setDragAction({
                                  type: 'width-drag',
                                  nodeId: node.id,
                                  anchorId: pt.id,
                                  anchorPos: { x: pt.x, y: pt.y },
                                  asymmetric: e.altKey,
                                });
                                return;
                              }

                              const nextAnchors = e.shiftKey
                                ? selectedAnchorIds.includes(pt.id)
                                  ? selectedAnchorIds.filter((a) => a !== pt.id)
                                  : [...selectedAnchorIds, pt.id]
                                : [pt.id];
                              store.setSelectedAnchorIds(nextAnchors);

                              store.beginTransaction('Move Anchor Point');
                              setDragAction({
                                type: 'move-anchor',
                                nodeId: node.id,
                                anchorId: pt.id,
                                startCanvas: canvasPt,
                                initialPoints: JSON.parse(JSON.stringify(node.points || [])),
                              });
                            }}
                          />
                        </g>
                      );
                    })}
                </g>
              );
            })}

          {/* Hover feedback is non-interactive and never exported. */}
          {showBoundingBox && showEdges && !dragAction && activeTool === 'select' && hoveredNodeId && !selectedIds.includes(hoveredNodeId) && (() => {
            const node = doc.nodes[hoveredNodeId];
            if (!node) return null;
            const bounds = movingSelectionBounds(collectTargetAndDescendantNodes([node.id], doc.nodes));
            if (!bounds) return null;
            return <rect data-hover-bounds={node.id} x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="none" stroke={doc.layers.find(l => l.id === node.layerId)?.color || '#4f8cff'} strokeWidth={1 / zoom} pointerEvents="none" />;
          })()}

          {/* 6. Selection Bounding Box & 8 Resize + Rotate Handles (`Shift+Ctrl+B`) */}
          {showBoundingBox &&
            showEdges &&
            selectionBounds &&
            activeTool === 'select' && (
              <g>
                <rect
                  data-selection-bounds="true"
                  x={selectionBounds.x}
                  y={selectionBounds.y}
                  width={selectionBounds.width}
                  height={selectionBounds.height}
                  fill="none"
                  stroke={doc.layers.find(l => l.id === doc.nodes[selectedIds[0]]?.layerId)?.color || '#4f8cff'}
                  strokeWidth={1 / zoom}
                  pointerEvents="none"
                />

                {/* Rotation Handle Stem above top-center */}
                <line
                  x1={selectionBounds.x + selectionBounds.width / 2}
                  y1={selectionBounds.y}
                  x2={selectionBounds.x + selectionBounds.width / 2}
                  y2={selectionBounds.y - 18 / zoom}
                  stroke={doc.layers.find(l => l.id === doc.nodes[selectedIds[0]]?.layerId)?.color || '#4f8cff'}
                  strokeWidth={1 / zoom}
                />
                <circle
                  data-rotate-handle="true"
                  cx={selectionBounds.x + selectionBounds.width / 2}
                  cy={selectionBounds.y - 18 / zoom}
                  r={5 / zoom}
                  fill="#ffffff"
                  stroke={doc.layers.find(l => l.id === doc.nodes[selectedIds[0]]?.layerId)?.color || '#4f8cff'}
                  strokeWidth={1.4 / zoom}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const center = {
                      x: selectionBounds.x + selectionBounds.width / 2,
                      y: selectionBounds.y + selectionBounds.height / 2,
                    };
                    const p = screenToCanvas(e.clientX, e.clientY);
                    const startAngle =
                      (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
                    const initialNodes = collectTargetAndDescendantNodes(selectedIds, doc.nodes);
                    svgRef.current?.setPointerCapture(e.pointerId);
                    store.beginTransaction('Rotate Selection');
                    setDragAction({
                      type: 'rotate-bbox',
                      center,
                      startAngle,
                      initialNodes,
                    });
                  }}
                />

                {/* 8 Resize Handles with Directional Cursors & Enlarged Hit Areas */}
                {(
                  [
                    ['nw', selectionBounds.x, selectionBounds.y, 'nwse-resize'],
                    ['n', selectionBounds.x + selectionBounds.width / 2, selectionBounds.y, 'ns-resize'],
                    ['ne', selectionBounds.x + selectionBounds.width, selectionBounds.y, 'nesw-resize'],
                    [
                      'e',
                      selectionBounds.x + selectionBounds.width,
                      selectionBounds.y + selectionBounds.height / 2,
                      'ew-resize',
                    ],
                    [
                      'se',
                      selectionBounds.x + selectionBounds.width,
                      selectionBounds.y + selectionBounds.height,
                      'nwse-resize',
                    ],
                    [
                      's',
                      selectionBounds.x + selectionBounds.width / 2,
                      selectionBounds.y + selectionBounds.height,
                      'ns-resize',
                    ],
                    ['sw', selectionBounds.x, selectionBounds.y + selectionBounds.height, 'nesw-resize'],
                    ['w', selectionBounds.x, selectionBounds.y + selectionBounds.height / 2, 'ew-resize'],
                  ] as const
                ).map(([hName, hx, hy, cursorType]) => {
                  const sz = 7.5 / zoom;
                  const hitSz = 14 / zoom;
                  return (
                    <g
                      key={hName}
                      data-resize-handle={hName}
                      style={{ cursor: cursorType }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        svgRef.current?.setPointerCapture(e.pointerId);
                        const initialNodes = collectTargetAndDescendantNodes(selectedIds, doc.nodes);
                        store.beginTransaction('Scale Selection');
                        setDragAction({
                          type: 'resize-bbox',
                          handle: hName,
                          startCanvas: screenToCanvas(e.clientX, e.clientY),
                          initialBounds: { ...selectionBounds },
                          initialNodes,
                        });
                      }}
                    >
                      <rect
                        x={hx - hitSz / 2}
                        y={hy - hitSz / 2}
                        width={hitSz}
                        height={hitSz}
                        fill="transparent"
                      />
                      <rect
                        x={hx - sz / 2}
                        y={hy - sz / 2}
                        width={sz}
                        height={sz}
                        fill="#ffffff"
                        stroke={doc.layers.find(l => l.id === doc.nodes[selectedIds[0]]?.layerId)?.color || '#4f8cff'}
                        strokeWidth={1.4 / zoom}
                      />
                    </g>
                  );
                })}
              </g>
            )}

          {/* 7. Pen Tool / Curvature Tool Rubber Band Preview */}
          {(activeTool === 'pen' || activeTool === 'curvature') &&
            activeDrawingNodeId &&
            doc.nodes[activeDrawingNodeId]?.points?.length > 0 &&
            (() => {
              const pts = doc.nodes[activeDrawingNodeId].points;
              const lastPt = pts[pts.length - 1];
              const isNearClose =
                pts.length >= 2 && distance2D(cursorCanvasPos, pts[0]) <= 10 / zoom;
              return (
                <g pointerEvents="none">
                  <line
                    x1={lastPt.x}
                    y1={lastPt.y}
                    x2={cursorCanvasPos.x}
                    y2={cursorCanvasPos.y}
                    stroke="#1473e6"
                    strokeWidth={1.2 / zoom}
                    strokeDasharray={`${4 / zoom} ${3 / zoom}`}
                  />
                  {isNearClose && (
                    <circle
                      cx={pts[0].x}
                      cy={pts[0].y}
                      r={6 / zoom}
                      fill="none"
                      stroke="#ff9a00"
                      strokeWidth={1.8 / zoom}
                    />
                  )}
                </g>
              );
            })()}

          {dragAction?.type === 'draw-text' && <rect x={Math.min(dragAction.startCanvas.x, dragAction.currentCanvas.x)} y={Math.min(dragAction.startCanvas.y, dragAction.currentCanvas.y)} width={Math.abs(dragAction.currentCanvas.x - dragAction.startCanvas.x)} height={Math.abs(dragAction.currentCanvas.y - dragAction.startCanvas.y)} fill="none" stroke="#1473e6" strokeWidth={1 / zoom} pointerEvents="none" />}
          {/* 8. Live Shape Drawing Preview */}
          {dragAction?.type === 'draw-shape' &&
            (() => {
              const { shapeTool, startCanvas, currentCanvas, sides, innerRatio, cornerRadius } =
                dragAction;
              const x = Math.min(startCanvas.x, currentCanvas.x);
              const y = Math.min(startCanvas.y, currentCanvas.y);
              const w = Math.max(2, Math.abs(currentCanvas.x - startCanvas.x));
              const h = Math.max(2, Math.abs(currentCanvas.y - startCanvas.y));
              let pts: AnchorPoint[] = [];
              let closed = true;
              if (shapeTool === 'rect-grid' || shapeTool === 'polar-grid') {
                pts = createGridAnchors(shapeTool, x, y, w, h);
                closed = false;
              } else if (shapeTool === 'ellipse') {
                pts = createEllipseAnchors(x, y, w, h);
              } else if (shapeTool === 'polygon') {
                pts = createPolygonAnchors(x, y, w, h, sides, cornerRadius);
              } else if (shapeTool === 'star' || shapeTool === 'flare') {
                pts = createStarAnchors(x, y, w, h, sides, innerRatio, cornerRadius);
              } else if (shapeTool === 'line') {
                pts = createLineAnchors(
                  startCanvas.x,
                  startCanvas.y,
                  currentCanvas.x,
                  currentCanvas.y
                );
                closed = false;
              } else if (shapeTool === 'arc') {
                pts = createArcAnchors(
                  startCanvas.x,
                  startCanvas.y,
                  currentCanvas.x,
                  currentCanvas.y
                );
                closed = false;
              } else if (shapeTool === 'spiral') {
                pts = createSpiralAnchors(startCanvas.x, startCanvas.y, Math.hypot(w, h) / 2);
                closed = false;
              } else {
                pts = createRectangleAnchors(x, y, w, h, cornerRadius);
              }
              const previewD = anchorsToSvgPath(pts, closed, cornerRadius);
              return (
                <path
                  d={previewD}
                  fill="rgba(20, 115, 230, 0.12)"
                  stroke="#1473e6"
                  strokeWidth={1.5 / zoom}
                  pointerEvents="none"
                />
              );
            })()}

          {/* 9. Freehand Brush / Pencil / Eraser / Liquify Circle Preview */}
          {dragAction?.type === 'freehand' && dragAction.points.length > 1 && (
            <polyline
              points={dragAction.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="#1473e6"
              strokeWidth={
                dragAction.tool === 'blob-brush' ? brushRadius * 0.4 : 2 / zoom
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* Brush Radius Circle for Blob Brush, Eraser, Symbol Sprayer, Liquify tools */}
          {[
            'blob-brush',
            'eraser',
            'symbol-sprayer',
            'warp',
            'twirl',
            'pucker',
            'bloat',
            'scallop',
            'crystallize',
            'wrinkle',
          ].includes(activeTool) && (
            <circle
              cx={cursorCanvasPos.x}
              cy={cursorCanvasPos.y}
              r={brushRadius / 2}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1 / zoom}
              strokeDasharray={`${3 / zoom} ${3 / zoom}`}
              pointerEvents="none"
            />
          )}

          {/* 10. Transform Origin Pin (`R`, `S`, `O`, `Shear`) */}
          {transformOrigin &&
            ['rotate', 'scale', 'reflect', 'shear', 'free-transform'].includes(activeTool) && (
              <g pointerEvents="none" stroke="#00ffff" strokeWidth={1.4 / zoom}>
                <circle
                  cx={transformOrigin.x}
                  cy={transformOrigin.y}
                  r={5 / zoom}
                  fill="none"
                />
                <line
                  x1={transformOrigin.x - 8 / zoom}
                  y1={transformOrigin.y}
                  x2={transformOrigin.x + 8 / zoom}
                  y2={transformOrigin.y}
                />
                <line
                  x1={transformOrigin.x}
                  y1={transformOrigin.y - 8 / zoom}
                  x2={transformOrigin.x}
                  y2={transformOrigin.y + 8 / zoom}
                />
              </g>
            )}

          {/* 11. Measure Tool Overlay */}
          {store.measureInfo && activeTool === 'measure' && (
            <g pointerEvents="none">
              <line
                x1={store.measureInfo.x1}
                y1={store.measureInfo.y1}
                x2={store.measureInfo.x2}
                y2={store.measureInfo.y2}
                stroke="#22c55e"
                strokeWidth={1.5 / zoom}
              />
              <rect
                x={store.measureInfo.x2 + 8 / zoom}
                y={store.measureInfo.y2 - 22 / zoom}
                width={126 / zoom}
                height={20 / zoom}
                fill="#111827"
                stroke="#22c55e"
                strokeWidth={1 / zoom}
                rx={3 / zoom}
              />
              <text
                x={store.measureInfo.x2 + 13 / zoom}
                y={store.measureInfo.y2 - 9 / zoom}
                fill="#22c55e"
                fontSize={10 / zoom}
              >
                D: {store.measureInfo.distance}px ({store.measureInfo.angle}°)
              </text>
            </g>
          )}

          {/* 12. Smart Guides Magenta Alignment Lines & Labels (`Ctrl+U`) */}
          {smartSnap && (
            <g data-smart-guides="true" pointerEvents="none">
              {smartSnap.lineX && (
                <>
                  <line
                    x1={smartSnap.lineX.x}
                    y1={smartSnap.lineX.y1}
                    x2={smartSnap.lineX.x}
                    y2={smartSnap.lineX.y2}
                    stroke="#ff2ec4"
                    strokeWidth={1 / zoom}
                  />
                  <text
                    x={smartSnap.lineX.x + 4 / zoom}
                    y={cursorCanvasPos.y - 6 / zoom}
                    fill="#ff2ec4"
                    fontSize={10 / zoom}
                    fontWeight={600}
                  >
                    {smartSnap.labelX || 'align'}
                  </text>
                </>
              )}
              {smartSnap.lineY && (
                <>
                  <line
                    x1={smartSnap.lineY.x1}
                    y1={smartSnap.lineY.y}
                    x2={smartSnap.lineY.x2}
                    y2={smartSnap.lineY.y}
                    stroke="#ff2ec4"
                    strokeWidth={1 / zoom}
                  />
                  <text
                    x={cursorCanvasPos.x + 6 / zoom}
                    y={smartSnap.lineY.y - 4 / zoom}
                    fill="#ff2ec4"
                    fontSize={10 / zoom}
                    fontWeight={600}
                  >
                    {smartSnap.labelY || 'align'}
                  </text>
                </>
              )}
            </g>
          )}

          {/* 13. Marquee & Lasso Selection Overlays */}
          {marqueeRect && (
            <rect
              x={Math.min(marqueeRect.x1, marqueeRect.x2)}
              y={Math.min(marqueeRect.y1, marqueeRect.y2)}
              width={Math.abs(marqueeRect.x2 - marqueeRect.x1)}
              height={Math.abs(marqueeRect.y2 - marqueeRect.y1)}
              fill="rgba(20, 115, 230, 0.1)"
              stroke="#1473e6"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
              pointerEvents="none"
            />
          )}

          {lassoPoints.length > 1 && (
            <polygon
              points={lassoPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(20, 115, 230, 0.1)"
              stroke="#1473e6"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom} ${3 / zoom}`}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      {/* Inline On-Canvas Text Editor when double-clicking a Type object */}
      {editingTextNodeId &&
        doc.nodes[editingTextNodeId] &&
        (() => {
          const tNode = doc.nodes[editingTextNodeId];
          const sx = tNode.x * zoom + panX;
          const sy = tNode.y * zoom + panY;
          return (
            <div
              style={{
                position: 'absolute',
                left: sx,
                top: sy,
                zIndex: 120,
                backgroundColor: 'rgba(30, 30, 30, 0.95)',
                border: '1px solid #1473e6',
                borderRadius: 4,
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 220,
              }}
            >
              <textarea
                autoFocus
                value={editingTextValue}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingTextValue(val);
                  store.updateNode(editingTextNodeId, {
                    textContent: val,
                    name: `<Type: ${val.slice(0, 18)}>`,
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                    setEditingTextNodeId(null);
                  }
                }}
                style={{
                  background: '#1e1e1e',
                  color: '#ffffff',
                  border: '1px solid #3f3f3f',
                  borderRadius: 3,
                  padding: '4px 6px',
                  fontSize: 12,
                  minHeight: 54,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                <button
                  type="button"
                  className="ai-btn active"
                  style={{ height: 20, padding: '0 8px', fontSize: 10 }}
                  onClick={() => setEditingTextNodeId(null)}
                >
                  Commit Text (Ctrl+Enter)
                </button>
              </div>
            </div>
          );
        })()}

      {/* Perspective Grid Overlay (`Shift+P`) */}
      <PerspectiveGridOverlay panX={panX} panY={panY} zoom={zoom} />

      {/* On-Canvas Gradient Annotator (`G`) */}
      <GradientAnnotator panX={panX} panY={panY} zoom={zoom} />

      {/* Rulers & Draggable Custom Guides (`Ctrl+R`) */}
      <RulersAndGuides
        panX={panX}
        panY={panY}
        zoom={zoom}
        cursorCanvasPos={cursorCanvasPos}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
      />
    </div>
  );
};

export default StudioCanvas;
