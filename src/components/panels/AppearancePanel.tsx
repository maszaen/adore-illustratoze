import React, { useState, useMemo } from 'react';
import {
  Eye,
  Plus,
  Copy,
  Trash2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Layers,
  Ban,
  Maximize2,
  Palette,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import { ColorSwatchButton } from '../primitives/ColorSwatchButton';
import type {
  BlendMode,
  FillItem,
  GraphicStyleItem,
  LiveEffectItem,
  LiveEffectType,
  StrokeItem,
  VectorNode,
} from '../../core/types';

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'darken', label: 'Darken' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'screen', label: 'Screen' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

export const LIVE_EFFECT_CATALOG: {
  type: LiveEffectType;
  name: string;
  category: string;
  defaultParams: Record<string, any>;
}[] = [
  {
    type: 'drop-shadow',
    name: 'Drop Shadow',
    category: 'Stylize',
    defaultParams: { dx: 4, dy: 4, blur: 6, opacity: 0.65, color: '#000000', mode: 'multiply' },
  },
  {
    type: 'extrude-3d',
    name: '3D Extrude & Bevel',
    category: '3D and Materials',
    defaultParams: { rotateX: -18, rotateY: -26, rotateZ: 8, depth: 24, bevel: 'classic', shadingColor: '#1a1a1a' },
  },
  {
    type: 'offset-path',
    name: 'Offset Path',
    category: 'Path',
    defaultParams: { offset: 8, joins: 'miter', miterLimit: 4 },
  },
  {
    type: 'round-corners',
    name: 'Round Corners',
    category: 'Stylize',
    defaultParams: { radius: 12 },
  },
  {
    type: 'pucker-bloat',
    name: 'Pucker & Bloat',
    category: 'Distort & Transform',
    defaultParams: { amount: 25 },
  },
  {
    type: 'zig-zag',
    name: 'Zig Zag',
    category: 'Distort & Transform',
    defaultParams: { size: 6, ridgesPerSegment: 4, points: 'smooth' },
  },
  {
    type: 'roughen',
    name: 'Roughen',
    category: 'Distort & Transform',
    defaultParams: { size: 4, detail: 10, points: 'corner' },
  },
  {
    type: 'transform-effect',
    name: 'Transform Effect',
    category: 'Distort & Transform',
    defaultParams: { scaleX: 90, scaleY: 90, moveX: 12, moveY: 8, angle: 15, copies: 4 },
  },
  {
    type: 'warp',
    name: 'Warp',
    category: 'Warp',
    defaultParams: { style: 'arc', bend: 35, hDistort: 0, vDistort: 0 },
  },
  {
    type: 'gaussian-blur',
    name: 'Gaussian Blur',
    category: 'Blur',
    defaultParams: { radius: 6 },
  },
  {
    type: 'scribble',
    name: 'Scribble',
    category: 'Stylize',
    defaultParams: { angle: 45, pathOverlap: 2, variation: 3, strokeWidth: 1.5, curviness: 20, spacing: 4 },
  },
  {
    type: 'convert-to-shape',
    name: 'Convert to Shape',
    category: 'Convert to Shape',
    defaultParams: { shape: 'rounded-rectangle', extraWidth: 16, extraHeight: 10, cornerRadius: 8 },
  },
  {
    type: 'outer-glow',
    name: 'Outer Glow',
    category: 'Stylize',
    defaultParams: { blur: 10, opacity: 0.85, color: '#00ffff', mode: 'screen' },
  },
  {
    type: 'inner-glow',
    name: 'Inner Glow',
    category: 'Stylize',
    defaultParams: { blur: 6, opacity: 0.75, color: '#ffffff', mode: 'screen' },
  },
];

export const DEFAULT_GRAPHIC_STYLES: GraphicStyleItem[] = [
  {
    id: 'gs-neon-glow',
    name: 'Neon Cyber Glow',
    opacity: 1,
    blendMode: 'normal',
    fills: [{ id: 'f1', visible: true, type: 'solid', color: '#090d16', opacity: 1, blendMode: 'normal' }],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#00f0ff',
        weight: 3,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 1,
        blendMode: 'screen',
      },
      {
        id: 's2',
        visible: true,
        color: '#ffffff',
        weight: 1,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 0.9,
        blendMode: 'normal',
      },
    ],
    effects: [
      {
        id: 'e1',
        type: 'outer-glow',
        name: 'Outer Glow',
        enabled: true,
        params: { blur: 12, opacity: 0.9, color: '#00f0ff', mode: 'screen' },
      },
    ],
  },
  {
    id: 'gs-retro-3d',
    name: 'Retro 3D Extrude',
    opacity: 1,
    blendMode: 'normal',
    fills: [{ id: 'f1', visible: true, type: 'solid', color: '#ff9a00', opacity: 1, blendMode: 'normal' }],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#221100',
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
        id: 'e1',
        type: 'extrude-3d',
        name: '3D Extrude & Bevel',
        enabled: true,
        params: { rotateX: -16, rotateY: -24, rotateZ: 5, depth: 20, bevel: 'classic', shadingColor: '#7a2e00' },
      },
    ],
  },
  {
    id: 'gs-road-double',
    name: 'Highway Double Stroke',
    opacity: 1,
    blendMode: 'normal',
    fills: [{ id: 'f1', visible: true, type: 'none', color: 'none', opacity: 1, blendMode: 'normal' }],
    strokes: [
      {
        id: 's-top',
        visible: true,
        color: '#ffd600',
        weight: 1.5,
        cap: 'butt',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [8, 6],
        opacity: 1,
        blendMode: 'normal',
      },
      {
        id: 's-mid',
        visible: true,
        color: '#2e3238',
        weight: 10,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 1,
        blendMode: 'normal',
      },
      {
        id: 's-bot',
        visible: true,
        color: '#ffffff',
        weight: 13,
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
  },
  {
    id: 'gs-sticker',
    name: 'Die-Cut Sticker Outline',
    opacity: 1,
    blendMode: 'normal',
    fills: [{ id: 'f1', visible: true, type: 'solid', color: '#ff3b6b', opacity: 1, blendMode: 'normal' }],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#1a1a1a',
        weight: 2,
        cap: 'round',
        join: 'round',
        miterLimit: 4,
        align: 'center',
        dashArray: [],
        opacity: 1,
        blendMode: 'normal',
      },
      {
        id: 's2',
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
        id: 'e1',
        type: 'drop-shadow',
        name: 'Drop Shadow',
        enabled: true,
        params: { dx: 3, dy: 4, blur: 6, opacity: 0.45, color: '#000000', mode: 'multiply' },
      },
    ],
  },
  {
    id: 'gs-scribble',
    name: 'Hand Sketch Scribble',
    opacity: 1,
    blendMode: 'normal',
    fills: [{ id: 'f1', visible: true, type: 'solid', color: '#4f9eff', opacity: 1, blendMode: 'normal' }],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#143d6b',
        weight: 1.5,
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
        id: 'e1',
        type: 'scribble',
        name: 'Scribble',
        enabled: true,
        params: { angle: 40, pathOverlap: 2, variation: 3, strokeWidth: 1.5, curviness: 22, spacing: 3.5 },
      },
    ],
  },
  {
    id: 'gs-badge-button',
    name: 'Auto-Size Pill Badge',
    opacity: 1,
    blendMode: 'normal',
    fills: [{ id: 'f1', visible: true, type: 'solid', color: '#1473e6', opacity: 1, blendMode: 'normal' }],
    strokes: [
      {
        id: 's1',
        visible: true,
        color: '#6eb4ff',
        weight: 1.5,
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
        id: 'e1',
        type: 'convert-to-shape',
        name: 'Convert to Shape',
        enabled: true,
        params: { shape: 'rounded-rectangle', extraWidth: 18, extraHeight: 10, cornerRadius: 12 },
      },
    ],
  },
];

export interface AppearancePanelProps {
  initialTab?: 'appearance' | 'graphic-styles';
}

export const AppearancePanel: React.FC<AppearancePanelProps> = ({ initialTab = 'appearance' }) => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || { nodes: {}, layers: [], graphicStyles: [] };
  const unit = doc.unit || 'pt';

  const [activeTab, setActiveTab] = useState<'appearance' | 'graphic-styles'>(initialTab);
  const [selectedStackItem, setSelectedStackItem] = useState<{
    kind: 'fill' | 'stroke' | 'effect';
    id: string;
  } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [fxMenuTarget, setFxMenuTarget] = useState<
    null | { scope: 'object' } | { scope: 'fill'; fillId: string } | { scope: 'stroke'; strokeId: string }
  >(null);
  const [editingEffect, setEditingEffect] = useState<{
    scope: 'object' | 'fill' | 'stroke';
    ownerId?: string;
    effect: LiveEffectItem;
  } | null>(null);

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const selectedNodes: VectorNode[] = useMemo(
    () => selectedIds.map((id) => nodesMap[id]).filter(Boolean),
    [selectedIds, nodesMap]
  );
  const primaryNode: VectorNode | null = selectedNodes[0] || null;

  const targetTypeLabel = useMemo(() => {
    if (selectedNodes.length === 0) return 'No Selection';
    if (selectedNodes.length > 1) return `Mixed Objects (${selectedNodes.length})`;
    const t = primaryNode?.type || 'path';
    if (t === 'group') return 'Group';
    if (t === 'compound-path') return 'Compound Path';
    if (t === 'compound-shape') return 'Compound Shape';
    if (t === 'clipping-group') return 'Clipping Group';
    if (t === 'text') return 'Type';
    if (t === 'rectangle') return 'Rectangle';
    if (t === 'ellipse') return 'Ellipse';
    return 'Path';
  }, [selectedNodes, primaryNode]);

  const mutateSelectedNodes = (
    mutator: (node: VectorNode, draftDoc: any) => void,
    historyLabel = 'Update Appearance'
  ) => {
    if (typeof store.pushHistory === 'function') {
      store.pushHistory(historyLabel);
    } else if (typeof store.recordHistory === 'function') {
      store.recordHistory(historyLabel);
    }
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      selectedIds.forEach((id) => {
        if (d.nodes && d.nodes[id]) {
          mutator(d.nodes[id], d);
        }
      });
      return next;
    });
  };

  const fills: FillItem[] = primaryNode?.fills || [];
  const strokes: StrokeItem[] = primaryNode?.strokes || [];
  const effects: LiveEffectItem[] = primaryNode?.effects || [];
  const graphicStyles: GraphicStyleItem[] =
    doc.graphicStyles && doc.graphicStyles.length > 0 ? doc.graphicStyles : DEFAULT_GRAPHIC_STYLES;

  const handleAddNewFill = () => {
    if (!primaryNode) return;
    if (typeof store.addFillToSelection === 'function') {
      store.addFillToSelection();
      return;
    }
    const newFill: FillItem = {
      id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      visible: true,
      type: 'solid',
      color: fills[0]?.color && fills[0].color !== 'none' ? fills[0].color : '#1473e6',
      opacity: 1,
      blendMode: 'normal',
      effects: [],
    };
    mutateSelectedNodes((node) => {
      if (!node.fills) node.fills = [];
      node.fills.unshift(newFill);
    }, 'Add New Fill');
    setSelectedStackItem({ kind: 'fill', id: newFill.id });
  };

  const handleAddNewStroke = () => {
    if (!primaryNode) return;
    if (typeof store.addStrokeToSelection === 'function') {
      store.addStrokeToSelection();
      return;
    }
    const newStroke: StrokeItem = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      visible: true,
      color: strokes[0]?.color && strokes[0].color !== 'none' ? strokes[0].color : '#1a1a1a',
      weight: (strokes[0]?.weight || 1) + (strokes.length > 0 ? 2 : 0),
      cap: 'round',
      join: 'round',
      miterLimit: 4,
      align: 'center',
      dashArray: [],
      opacity: 1,
      blendMode: 'normal',
      effects: [],
    };
    mutateSelectedNodes((node) => {
      if (!node.strokes) node.strokes = [];
      node.strokes.unshift(newStroke);
    }, 'Add New Stroke');
    setSelectedStackItem({ kind: 'stroke', id: newStroke.id });
  };

  const handleDuplicateSelectedItem = () => {
    if (!primaryNode || !selectedStackItem) return;
    mutateSelectedNodes((node) => {
      if (selectedStackItem.kind === 'fill') {
        const idx = (node.fills || []).findIndex((f) => f.id === selectedStackItem.id);
        if (idx !== -1) {
          const copy: FillItem = JSON.parse(JSON.stringify(node.fills[idx]));
          copy.id = `fill-${Date.now()}`;
          node.fills.splice(idx, 0, copy);
        }
      } else if (selectedStackItem.kind === 'stroke') {
        const idx = (node.strokes || []).findIndex((s) => s.id === selectedStackItem.id);
        if (idx !== -1) {
          const copy: StrokeItem = JSON.parse(JSON.stringify(node.strokes[idx]));
          copy.id = `stroke-${Date.now()}`;
          node.strokes.splice(idx, 0, copy);
        }
      } else if (selectedStackItem.kind === 'effect') {
        const idx = (node.effects || []).findIndex((e) => e.id === selectedStackItem.id);
        if (idx !== -1) {
          const copy: LiveEffectItem = JSON.parse(JSON.stringify(node.effects[idx]));
          copy.id = `fx-${Date.now()}`;
          node.effects.splice(idx + 1, 0, copy);
        }
      }
    }, 'Duplicate Appearance Item');
  };

  const handleReorderItem = (kind: 'fill' | 'stroke', id: string, dir: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    mutateSelectedNodes((node) => {
      const list = kind === 'fill' ? node.fills : node.strokes;
      if (!list) return;
      const idx = list.findIndex((item) => item.id === id);
      if (idx === -1) return;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= list.length) return;
      const [moved] = list.splice(idx, 1);
      list.splice(nextIdx, 0, moved as any);
    }, 'Reorder Appearance Stack');
  };

  const handleDeleteStackItem = (kind: 'fill' | 'stroke' | 'effect', id: string, ownerId?: string) => {
    mutateSelectedNodes((node) => {
      if (kind === 'fill') {
        node.fills = (node.fills || []).filter((f) => f.id !== id);
      } else if (kind === 'stroke') {
        node.strokes = (node.strokes || []).filter((s) => s.id !== id);
      } else if (kind === 'effect') {
        if (!ownerId) {
          node.effects = (node.effects || []).filter((ef) => ef.id !== id);
        } else {
          const f = (node.fills || []).find((x) => x.id === ownerId);
          if (f && f.effects) f.effects = f.effects.filter((ef) => ef.id !== id);
          const s = (node.strokes || []).find((x) => x.id === ownerId);
          if (s && s.effects) s.effects = s.effects.filter((ef) => ef.id !== id);
        }
      }
    }, 'Remove Appearance Item');
    if (editingEffect?.effect.id === id) setEditingEffect(null);
  };

  const handleAddLiveEffect = (catalogEntry: (typeof LIVE_EFFECT_CATALOG)[number]) => {
    if (!primaryNode || !fxMenuTarget) return;
    const newFx: LiveEffectItem = {
      id: `fx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type: catalogEntry.type,
      name: catalogEntry.name,
      enabled: true,
      params: { ...catalogEntry.defaultParams },
    };

    mutateSelectedNodes((node) => {
      if (fxMenuTarget.scope === 'object') {
        if (!node.effects) node.effects = [];
        node.effects.push(newFx);
      } else if (fxMenuTarget.scope === 'fill') {
        const f = (node.fills || []).find((x) => x.id === fxMenuTarget.fillId);
        if (f) {
          if (!f.effects) f.effects = [];
          f.effects.push(newFx);
        }
      } else if (fxMenuTarget.scope === 'stroke') {
        const s = (node.strokes || []).find((x) => x.id === fxMenuTarget.strokeId);
        if (s) {
          if (!s.effects) s.effects = [];
          s.effects.push(newFx);
        }
      }
    }, `Add Effect: ${catalogEntry.name}`);

    setEditingEffect({
      scope: fxMenuTarget.scope,
      ownerId:
        fxMenuTarget.scope === 'fill'
          ? fxMenuTarget.fillId
          : fxMenuTarget.scope === 'stroke'
          ? fxMenuTarget.strokeId
          : undefined,
      effect: newFx,
    });
    setFxMenuTarget(null);
  };

  const handleUpdateEffectParam = (key: string, val: any) => {
    if (!editingEffect) return;
    const updatedFx: LiveEffectItem = {
      ...editingEffect.effect,
      params: { ...editingEffect.effect.params, [key]: val },
    };
    setEditingEffect({ ...editingEffect, effect: updatedFx });

    mutateSelectedNodes((node) => {
      if (editingEffect.scope === 'object') {
        const target = (node.effects || []).find((e) => e.id === updatedFx.id);
        if (target) target.params = { ...updatedFx.params };
      } else if (editingEffect.scope === 'fill') {
        const f = (node.fills || []).find((x) => x.id === editingEffect.ownerId);
        const target = f?.effects?.find((e) => e.id === updatedFx.id);
        if (target) target.params = { ...updatedFx.params };
      } else if (editingEffect.scope === 'stroke') {
        const s = (node.strokes || []).find((x) => x.id === editingEffect.ownerId);
        const target = s?.effects?.find((e) => e.id === updatedFx.id);
        if (target) target.params = { ...updatedFx.params };
      }
    }, `Update ${editingEffect.effect.name}`);
  };

  const handleClearAppearance = () => {
    if (!primaryNode) return;
    if (typeof store.clearAppearance === 'function') {
      store.clearAppearance();
      return;
    }
    mutateSelectedNodes((node) => {
      node.fills = [
        {
          id: `fill-${Date.now()}`,
          visible: true,
          type: 'solid',
          color: '#ffffff',
          opacity: 1,
          blendMode: 'normal',
        },
      ];
      node.strokes = [
        {
          id: `stroke-${Date.now()}`,
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
      node.effects = [];
      node.opacity = 1;
      node.blendMode = 'normal';
    }, 'Clear Appearance');
    setEditingEffect(null);
  };

  const handleExpandAppearance = () => {
    if (!primaryNode) return;
    if (typeof store.expandAppearance === 'function') {
      store.expandAppearance();
      return;
    }
    // Expand Appearance: converts live effects (like Offset Path, Transform copies, Convert to Shape)
    // and multi-strokes/fills into concrete vector paths
    mutateSelectedNodes((node, d) => {
      const offsetFx = (node.effects || []).find((e) => e.enabled && e.type === 'offset-path');
      if (offsetFx) {
        const off = Number(offsetFx.params.offset) || 0;
        node.x -= off;
        node.y -= off;
        node.width = Math.max(2, node.width + off * 2);
        node.height = Math.max(2, node.height + off * 2);
      }
      const roundFx = (node.effects || []).find((e) => e.enabled && e.type === 'round-corners');
      if (roundFx) {
        node.cornerRadius = Number(roundFx.params.radius) || 8;
      }
      const transformFx = (node.effects || []).find((e) => e.enabled && e.type === 'transform-effect');
      if (transformFx && Number(transformFx.params.copies) > 0) {
        const copies = Math.min(24, Number(transformFx.params.copies) || 1);
        const moveX = Number(transformFx.params.moveX) || 0;
        const moveY = Number(transformFx.params.moveY) || 0;
        const angle = Number(transformFx.params.angle) || 0;
        const layer = (d.layers || []).find((l: any) => l.id === node.layerId);
        for (let i = 1; i <= copies; i++) {
          const cloneId = `${node.id}-exp-${Date.now()}-${i}`;
          const clone: VectorNode = JSON.parse(JSON.stringify(node));
          clone.id = cloneId;
          clone.name = `${node.name || 'Path'} (Expanded ${i})`;
          clone.x += moveX * i;
          clone.y += moveY * i;
          clone.rotation = (clone.rotation || 0) + angle * i;
          clone.effects = [];
          d.nodes[cloneId] = clone;
          if (layer && Array.isArray(layer.nodeIds)) {
            layer.nodeIds.unshift(cloneId);
          }
        }
      }
      node.effects = [];
      (node.fills || []).forEach((f) => {
        f.effects = [];
      });
      (node.strokes || []).forEach((s) => {
        s.effects = [];
      });
    }, 'Expand Appearance');
    setEditingEffect(null);
  };

  const handleApplyGraphicStyle = (style: GraphicStyleItem, e: React.MouseEvent) => {
    if (!primaryNode) return;
    const isAltMerge = e.altKey;
    mutateSelectedNodes((node) => {
      const clonedFills: FillItem[] = JSON.parse(JSON.stringify(style.fills)).map((f: FillItem, i: number) => ({
        ...f,
        id: `fill-gs-${Date.now()}-${i}`,
      }));
      const clonedStrokes: StrokeItem[] = JSON.parse(JSON.stringify(style.strokes)).map((s: StrokeItem, i: number) => ({
        ...s,
        id: `stroke-gs-${Date.now()}-${i}`,
      }));
      const clonedEffects: LiveEffectItem[] = JSON.parse(JSON.stringify(style.effects)).map(
        (ef: LiveEffectItem, i: number) => ({
          ...ef,
          id: `fx-gs-${Date.now()}-${i}`,
        })
      );

      if (isAltMerge) {
        // Alt+Click merges Graphic Style onto existing Appearance Stack!
        node.fills = [...clonedFills, ...(node.fills || [])];
        node.strokes = [...clonedStrokes, ...(node.strokes || [])];
        node.effects = [...(node.effects || []), ...clonedEffects];
      } else {
        node.fills = clonedFills;
        node.strokes = clonedStrokes;
        node.effects = clonedEffects;
        node.opacity = style.opacity ?? 1;
        node.blendMode = style.blendMode ?? 'normal';
      }
    }, isAltMerge ? `Merge Graphic Style "${style.name}"` : `Apply Graphic Style "${style.name}"`);
  };

  const handleSaveNewGraphicStyle = () => {
    if (!primaryNode) return;
    const newStyle: GraphicStyleItem = {
      id: `gs-custom-${Date.now()}`,
      name: `${primaryNode.name || 'Custom Style'} ${graphicStyles.length + 1}`,
      fills: JSON.parse(JSON.stringify(primaryNode.fills || [])),
      strokes: JSON.parse(JSON.stringify(primaryNode.strokes || [])),
      effects: JSON.parse(JSON.stringify(primaryNode.effects || [])),
      opacity: primaryNode.opacity ?? 1,
      blendMode: primaryNode.blendMode ?? 'normal',
    };
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      if (!d.graphicStyles || d.graphicStyles.length === 0) {
        d.graphicStyles = [...DEFAULT_GRAPHIC_STYLES, newStyle];
      } else {
        d.graphicStyles.push(newStyle);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#323232] text-[#e8e8e8] select-none text-[11px]">
      {/* Sub-Tabs: Appearance (Shift+F6) & Graphic Styles (Shift+F5) */}
      <div className="flex items-center bg-[#262626] border-b border-[#1a1a1a]">
        <button
          onClick={() => setActiveTab('appearance')}
          className={`px-3 py-1.5 font-medium border-r border-[#1a1a1a] ${
            activeTab === 'appearance'
              ? 'bg-[#323232] text-white border-t-2 border-t-[#1473e6]'
              : 'text-[#9e9e9e] hover:text-white'
          }`}
        >
          Appearance
        </button>
        <button
          onClick={() => setActiveTab('graphic-styles')}
          className={`px-3 py-1.5 font-medium border-r border-[#1a1a1a] ${
            activeTab === 'graphic-styles'
              ? 'bg-[#323232] text-white border-t-2 border-t-[#1473e6]'
              : 'text-[#9e9e9e] hover:text-white'
          }`}
        >
          Graphic Styles
        </button>
      </div>

      {activeTab === 'appearance' ? (
        <>
          {/* Target Object Header */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#2a2a2a] border-b border-[#1a1a1a]">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full border border-[#cfcfcf] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1473e6]" />
              </span>
              <span className="font-semibold text-white">{targetTypeLabel}</span>
            </div>
            {primaryNode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExpandAppearance}
                  className="px-1.5 py-0.5 rounded bg-[#3f3f3f] hover:bg-[#1473e6] text-[10px] flex items-center gap-1"
                  title="Expand Appearance (Convert live effects & multi-strokes to vector paths)"
                >
                  <Maximize2 size={10} />
                  <span>Expand</span>
                </button>
              </div>
            )}
          </div>

          {/* Appearance Stack List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#242424]">
            {!primaryNode ? (
              <div className="p-4 text-center text-[#888] italic">
                Select an object or target a layer to inspect and stack multiple Fills, Strokes, and Live Effects.
              </div>
            ) : (
              <>
                {/* STROKES STACK */}
                {strokes.map((stroke, sIdx) => {
                  const rowKey = `stroke-${stroke.id}`;
                  const isExpanded = !!expandedRows[rowKey];
                  const isSelected =
                    selectedStackItem?.kind === 'stroke' && selectedStackItem.id === stroke.id;

                  return (
                    <div
                      key={stroke.id}
                      onClick={() => setSelectedStackItem({ kind: 'stroke', id: stroke.id })}
                      className={`${isSelected ? 'bg-[#3b4754]' : 'bg-[#323232] hover:bg-[#383838]'}`}
                    >
                      <div className="flex items-center h-7 px-1.5 gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            mutateSelectedNodes((n) => {
                              const s = n.strokes.find((x) => x.id === stroke.id);
                              if (s) s.visible = !s.visible;
                            }, 'Toggle Stroke Visibility');
                          }}
                          className="w-4 h-4 flex items-center justify-center text-[#cfcfcf]"
                        >
                          {stroke.visible ? <Eye size={11} /> : <span className="w-2 h-0.5 bg-[#666]" />}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRows((p) => ({ ...p, [rowKey]: !isExpanded }));
                          }}
                          className="w-3.5 h-3.5 flex items-center justify-center text-[#9e9e9e]"
                        >
                          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </button>

                        <ColorSwatchButton
                          color={stroke.color}
                          isStroke
                          size={15}
                          allowColorPicker
                          onChange={(newCol) =>
                            mutateSelectedNodes((n) => {
                              const s = n.strokes.find((x) => x.id === stroke.id);
                              if (s) s.color = newCol;
                            }, 'Change Stroke Color')
                          }
                        />

                        <span className="font-medium text-[11px] flex-1 truncate">
                          Stroke #{strokes.length - sIdx}
                        </span>

                        <NumericScrubInput
                          value={stroke.weight}
                          unit={unit}
                          min={0}
                          max={500}
                          step={0.5}
                          width={48}
                          compact
                          onChange={(w) =>
                            mutateSelectedNodes((n) => {
                              const s = n.strokes.find((x) => x.id === stroke.id);
                              if (s) s.weight = w;
                            }, 'Change Stroke Weight')
                          }
                        />

                        {/* Add fx to this specific Stroke */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFxMenuTarget({ scope: 'stroke', strokeId: stroke.id });
                          }}
                          title="Add Live Effect to this Stroke only"
                          className="px-1 py-0.5 rounded bg-[#292929] hover:bg-[#1473e6] text-[9px] font-bold italic"
                        >
                          fx
                        </button>

                        <button
                          onClick={(e) => handleReorderItem('stroke', stroke.id, -1, e)}
                          className="p-0.5 text-[#9e9e9e] hover:text-white"
                          title="Move Stroke Up"
                        >
                          <ArrowUp size={10} />
                        </button>
                        <button
                          onClick={(e) => handleReorderItem('stroke', stroke.id, 1, e)}
                          className="p-0.5 text-[#9e9e9e] hover:text-white"
                          title="Move Stroke Down"
                        >
                          <ArrowDown size={10} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="pl-7 pr-2 py-1.5 bg-[#292929] space-y-1.5 border-t border-[#222]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#9e9e9e]">Opacity & Blend:</span>
                            <div className="flex items-center gap-1">
                              <select
                                value={stroke.blendMode}
                                onChange={(e) =>
                                  mutateSelectedNodes((n) => {
                                    const s = n.strokes.find((x) => x.id === stroke.id);
                                    if (s) s.blendMode = e.target.value as BlendMode;
                                  }, 'Stroke Blend Mode')
                                }
                                className="ai-select text-[10px] h-5"
                              >
                                {BLEND_MODES.map((bm) => (
                                  <option key={bm.value} value={bm.value}>
                                    {bm.label}
                                  </option>
                                ))}
                              </select>
                              <NumericScrubInput
                                value={Math.round((stroke.opacity ?? 1) * 100)}
                                suffix="%"
                                min={0}
                                max={100}
                                width={44}
                                compact
                                onChange={(pct) =>
                                  mutateSelectedNodes((n) => {
                                    const s = n.strokes.find((x) => x.id === stroke.id);
                                    if (s) s.opacity = pct / 100;
                                  }, 'Stroke Opacity')
                                }
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#9e9e9e]">Align & Cap:</span>
                            <div className="flex items-center gap-1">
                              {(['center', 'inside', 'outside'] as const).map((al) => (
                                <button
                                  key={al}
                                  onClick={() =>
                                    mutateSelectedNodes((n) => {
                                      const s = n.strokes.find((x) => x.id === stroke.id);
                                      if (s) s.align = al;
                                    })
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[9px] capitalize ${
                                    stroke.align === al ? 'bg-[#1473e6] text-white' : 'bg-[#383838]'
                                  }`}
                                >
                                  {al}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Per-Stroke Live Effects */}
                          {(stroke.effects || []).map((ef) => (
                            <div
                              key={ef.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEffect({ scope: 'stroke', ownerId: stroke.id, effect: ef });
                              }}
                              className="flex items-center justify-between px-1.5 py-1 rounded bg-[#222] hover:bg-[#333] cursor-pointer"
                            >
                              <span className="text-[10px] text-[#ff9a00] flex items-center gap-1">
                                <span>fx</span>
                                <span className="underline">{ef.name}</span>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteStackItem('effect', ef.id, stroke.id);
                                }}
                                className="text-[#888] hover:text-[#ff6b6b]"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* FILLS STACK */}
                {fills.map((fill, fIdx) => {
                  const rowKey = `fill-${fill.id}`;
                  const isExpanded = !!expandedRows[rowKey];
                  const isSelected =
                    selectedStackItem?.kind === 'fill' && selectedStackItem.id === fill.id;

                  return (
                    <div
                      key={fill.id}
                      onClick={() => setSelectedStackItem({ kind: 'fill', id: fill.id })}
                      className={`${isSelected ? 'bg-[#3b4754]' : 'bg-[#323232] hover:bg-[#383838]'}`}
                    >
                      <div className="flex items-center h-7 px-1.5 gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            mutateSelectedNodes((n) => {
                              const f = n.fills.find((x) => x.id === fill.id);
                              if (f) f.visible = !f.visible;
                            }, 'Toggle Fill Visibility');
                          }}
                          className="w-4 h-4 flex items-center justify-center text-[#cfcfcf]"
                        >
                          {fill.visible ? <Eye size={11} /> : <span className="w-2 h-0.5 bg-[#666]" />}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRows((p) => ({ ...p, [rowKey]: !isExpanded }));
                          }}
                          className="w-3.5 h-3.5 flex items-center justify-center text-[#9e9e9e]"
                        >
                          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </button>

                        <ColorSwatchButton
                          color={fill.type === 'none' ? 'none' : fill.color}
                          size={15}
                          allowColorPicker
                          onChange={(newCol) =>
                            mutateSelectedNodes((n) => {
                              const f = n.fills.find((x) => x.id === fill.id);
                              if (f) {
                                f.type = 'solid';
                                f.color = newCol;
                              }
                            }, 'Change Fill Color')
                          }
                        />

                        <span className="font-medium text-[11px] flex-1 truncate">
                          Fill #{fills.length - fIdx}{' '}
                          {fill.type !== 'solid' ? `(${fill.type})` : ''}
                        </span>

                        <span className="text-[10px] text-[#9e9e9e]">
                          {Math.round((fill.opacity ?? 1) * 100)}%
                        </span>

                        {/* Add fx to this specific Fill */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFxMenuTarget({ scope: 'fill', fillId: fill.id });
                          }}
                          title="Add Live Effect to this Fill only"
                          className="px-1 py-0.5 rounded bg-[#292929] hover:bg-[#1473e6] text-[9px] font-bold italic"
                        >
                          fx
                        </button>

                        <button
                          onClick={(e) => handleReorderItem('fill', fill.id, -1, e)}
                          className="p-0.5 text-[#9e9e9e] hover:text-white"
                          title="Move Fill Up"
                        >
                          <ArrowUp size={10} />
                        </button>
                        <button
                          onClick={(e) => handleReorderItem('fill', fill.id, 1, e)}
                          className="p-0.5 text-[#9e9e9e] hover:text-white"
                          title="Move Fill Down"
                        >
                          <ArrowDown size={10} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="pl-7 pr-2 py-1.5 bg-[#292929] space-y-1.5 border-t border-[#222]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[#9e9e9e]">Opacity & Blend:</span>
                            <div className="flex items-center gap-1">
                              <select
                                value={fill.blendMode}
                                onChange={(e) =>
                                  mutateSelectedNodes((n) => {
                                    const f = n.fills.find((x) => x.id === fill.id);
                                    if (f) f.blendMode = e.target.value as BlendMode;
                                  }, 'Fill Blend Mode')
                                }
                                className="ai-select text-[10px] h-5"
                              >
                                {BLEND_MODES.map((bm) => (
                                  <option key={bm.value} value={bm.value}>
                                    {bm.label}
                                  </option>
                                ))}
                              </select>
                              <NumericScrubInput
                                value={Math.round((fill.opacity ?? 1) * 100)}
                                suffix="%"
                                min={0}
                                max={100}
                                width={44}
                                compact
                                onChange={(pct) =>
                                  mutateSelectedNodes((n) => {
                                    const f = n.fills.find((x) => x.id === fill.id);
                                    if (f) f.opacity = pct / 100;
                                  }, 'Fill Opacity')
                                }
                              />
                            </div>
                          </div>

                          {/* Per-Fill Live Effects */}
                          {(fill.effects || []).map((ef) => (
                            <div
                              key={ef.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingEffect({ scope: 'fill', ownerId: fill.id, effect: ef });
                              }}
                              className="flex items-center justify-between px-1.5 py-1 rounded bg-[#222] hover:bg-[#333] cursor-pointer"
                            >
                              <span className="text-[10px] text-[#ff9a00] flex items-center gap-1">
                                <span>fx</span>
                                <span className="underline">{ef.name}</span>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteStackItem('effect', ef.id, fill.id);
                                }}
                                className="text-[#888] hover:text-[#ff6b6b]"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* WHOLE-OBJECT LIVE EFFECTS */}
                {effects.map((ef) => {
                  const isSelected =
                    selectedStackItem?.kind === 'effect' && selectedStackItem.id === ef.id;
                  return (
                    <div
                      key={ef.id}
                      onClick={() => {
                        setSelectedStackItem({ kind: 'effect', id: ef.id });
                        setEditingEffect({ scope: 'object', effect: ef });
                      }}
                      className={`flex items-center h-7 px-1.5 gap-1.5 cursor-pointer ${
                        isSelected ? 'bg-[#3b4754]' : 'bg-[#2e2b26] hover:bg-[#3a3630]'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          mutateSelectedNodes((n) => {
                            const target = (n.effects || []).find((x) => x.id === ef.id);
                            if (target) target.enabled = !target.enabled;
                          }, 'Toggle Live Effect');
                        }}
                        className="w-4 h-4 flex items-center justify-center text-[#cfcfcf]"
                      >
                        {ef.enabled ? <Eye size={11} /> : <span className="w-2 h-0.5 bg-[#666]" />}
                      </button>
                      <span className="px-1 rounded bg-[#332200] text-[#ff9a00] font-bold italic text-[10px]">
                        fx
                      </span>
                      <span className="flex-1 truncate underline decoration-dotted text-[#ffd591]">
                        {ef.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStackItem('effect', ef.id);
                        }}
                        className="p-0.5 text-[#9e9e9e] hover:text-[#ff6b6b]"
                        title="Delete Live Effect"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })}

                {/* Overall Object Opacity & Blend Mode Row */}
                <div className="flex items-center justify-between px-2 py-1.5 bg-[#2a2a2a]">
                  <span className="text-[11px] text-[#cfcfcf]">Opacity:</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={primaryNode.blendMode || 'normal'}
                      onChange={(e) =>
                        mutateSelectedNodes((n) => {
                          n.blendMode = e.target.value as BlendMode;
                        }, 'Change Object Blend Mode')
                      }
                      className="ai-select text-[10px] h-5"
                    >
                      {BLEND_MODES.map((bm) => (
                        <option key={bm.value} value={bm.value}>
                          {bm.label}
                        </option>
                      ))}
                    </select>
                    <NumericScrubInput
                      value={Math.round((primaryNode.opacity ?? 1) * 100)}
                      suffix="%"
                      min={0}
                      max={100}
                      width={46}
                      compact
                      onChange={(pct) =>
                        mutateSelectedNodes((n) => {
                          n.opacity = pct / 100;
                        }, 'Change Object Opacity')
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Live Effect Parameter Editor Drawer */}
          {editingEffect && (
            <div className="p-2 bg-[#242424] border-t border-[#1a1a1a] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#ff9a00] flex items-center gap-1">
                  <Sparkles size={11} />
                  <span>{editingEffect.effect.name} Settings</span>
                </span>
                <button
                  onClick={() => setEditingEffect(null)}
                  className="text-[10px] text-[#9e9e9e] hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                {Object.entries(editingEffect.effect.params).map(([paramKey, paramVal]) => {
                  if (typeof paramVal === 'number') {
                    return (
                      <div key={paramKey} className="flex items-center justify-between">
                        <span className="text-[10px] text-[#b0b0b0] capitalize">{paramKey}:</span>
                        <NumericScrubInput
                          value={paramVal}
                          width={50}
                          compact
                          onChange={(v) => handleUpdateEffectParam(paramKey, v)}
                        />
                      </div>
                    );
                  }
                  if (typeof paramVal === 'string' && paramVal.startsWith('#')) {
                    return (
                      <div key={paramKey} className="flex items-center justify-between">
                        <span className="text-[10px] text-[#b0b0b0] capitalize">{paramKey}:</span>
                        <ColorSwatchButton
                          color={paramVal}
                          size={16}
                          allowColorPicker
                          onChange={(c) => handleUpdateEffectParam(paramKey, c)}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={paramKey} className="flex items-center justify-between col-span-2">
                      <span className="text-[10px] text-[#b0b0b0] capitalize">{paramKey}:</span>
                      <input
                        value={String(paramVal)}
                        onChange={(e) => handleUpdateEffectParam(paramKey, e.target.value)}
                        className="ai-input w-28 text-[10px]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add Live Effect (fx) Popover Menu */}
          {fxMenuTarget && (
            <div className="p-2 bg-[#222222] border-t border-[#1a1a1a] max-h-48 overflow-y-auto space-y-1">
              <div className="flex items-center justify-between pb-1 border-b border-[#333]">
                <span className="font-semibold text-[10px] text-[#ff9a00]">
                  Add Live Effect ({fxMenuTarget.scope})
                </span>
                <button
                  onClick={() => setFxMenuTarget(null)}
                  className="text-[10px] text-[#9e9e9e] hover:text-white"
                >
                  Cancel
                </button>
              </div>
              {LIVE_EFFECT_CATALOG.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddLiveEffect(item)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[#1473e6] text-left"
                >
                  <span>{item.name}</span>
                  <span className="text-[9px] opacity-70">{item.category}</span>
                </button>
              ))}
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1">
              <button
                onClick={handleAddNewStroke}
                disabled={!primaryNode}
                title="Add New Stroke"
                className="px-1.5 py-0.5 rounded bg-[#383838] hover:bg-[#484848] disabled:opacity-40 text-[10px] flex items-center gap-1"
              >
                <span className="w-2.5 h-2.5 border border-white inline-block" />
                <span>+Stroke</span>
              </button>
              <button
                onClick={handleAddNewFill}
                disabled={!primaryNode}
                title="Add New Fill"
                className="px-1.5 py-0.5 rounded bg-[#383838] hover:bg-[#484848] disabled:opacity-40 text-[10px] flex items-center gap-1"
              >
                <span className="w-2.5 h-2.5 bg-white inline-block" />
                <span>+Fill</span>
              </button>
              <button
                onClick={() => setFxMenuTarget(fxMenuTarget ? null : { scope: 'object' })}
                disabled={!primaryNode}
                title="Add New Effect (fx)"
                className="px-1.5 py-0.5 rounded bg-[#383838] hover:bg-[#1473e6] disabled:opacity-40 text-[10px] font-bold italic"
              >
                fx
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearAppearance}
                disabled={!primaryNode}
                title="Clear Appearance (Reset to basic)"
                className="p-1 rounded hover:bg-[#3f3f3f] disabled:opacity-40 text-[#cfcfcf]"
              >
                <Ban size={12} />
              </button>
              <button
                onClick={handleDuplicateSelectedItem}
                disabled={!primaryNode || !selectedStackItem}
                title="Duplicate Selected Fill/Stroke/Effect"
                className="p-1 rounded hover:bg-[#3f3f3f] disabled:opacity-40 text-[#cfcfcf]"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => {
                  if (selectedStackItem) {
                    handleDeleteStackItem(selectedStackItem.kind, selectedStackItem.id);
                  }
                }}
                disabled={!primaryNode || !selectedStackItem}
                title="Remove Selected Item"
                className="p-1 rounded hover:bg-[#3f3f3f] disabled:opacity-40 text-[#cfcfcf] hover:text-[#ff6b6b]"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </>
      ) : (
        /* GRAPHIC STYLES TAB (Shift+F5) */
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-2.5 py-1.5 bg-[#2a2a2a] border-b border-[#1a1a1a] text-[10px] text-[#9e9e9e]">
            Click a Graphic Style to apply. Hold <strong className="text-white">Alt+Click</strong> to merge with current Appearance.
          </div>

          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
            {graphicStyles.map((gs) => {
              const topFill = gs.fills?.[0]?.color && gs.fills[0].color !== 'none' ? gs.fills[0].color : '#323232';
              const topStroke = gs.strokes?.[0]?.color || '#ffffff';
              const has3D = gs.effects?.some((e) => e.type === 'extrude-3d');
              const hasGlow = gs.effects?.some((e) => e.type === 'outer-glow');

              return (
                <button
                  key={gs.id}
                  onClick={(e) => handleApplyGraphicStyle(gs, e)}
                  className="group flex flex-col items-center p-2 rounded bg-[#292929] hover:bg-[#383838] border border-[#1a1a1a] hover:border-[#1473e6] transition-all text-left"
                  title={`${gs.name} — Click to Apply, Alt+Click to Merge`}
                >
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center mb-1.5 relative"
                    style={{
                      backgroundColor: topFill,
                      border: `2.5px solid ${topStroke}`,
                      boxShadow: hasGlow
                        ? `0 0 10px ${topStroke}`
                        : has3D
                        ? '3px 4px 0 #5a2200'
                        : '0 2px 4px rgba(0,0,0,0.4)',
                    }}
                  >
                    <span className="text-[9px] font-bold text-white drop-shadow">
                      {gs.strokes.length}S/{gs.fills.length}F
                    </span>
                    {gs.effects.length > 0 && (
                      <span className="absolute -top-1 -right-1 px-1 rounded bg-[#ff9a00] text-black font-bold text-[8px]">
                        fx
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium truncate w-full text-center text-[#e0e0e0]">
                    {gs.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
            <span className="text-[10px] text-[#9e9e9e]">{graphicStyles.length} Styles</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleSaveNewGraphicStyle}
                disabled={!primaryNode}
                title="Save Selected Object Appearance as New Graphic Style (+)"
                className="px-2 py-0.5 rounded bg-[#1473e6] hover:bg-[#0d66d0] disabled:opacity-40 text-white text-[10px] flex items-center gap-1"
              >
                <Plus size={11} />
                <span>New Graphic Style</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppearancePanel;
