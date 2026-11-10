import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Unlink,
  ArrowLeftRight,
  Sliders,
  Sparkles,
  Ban,
  Copy,
  Check,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import { AngleDial } from '../primitives/AngleDial';
import type {
  BrushItem,
  StrokeItem,
  SymbolItem,
  VectorNode,
} from '../../core/types';

export interface StrokeBrushesSymbolsPanelProps {
  initialTab?: 'stroke' | 'brushes' | 'symbols';
}

export const WIDTH_PROFILES: { id: string; name: string; svgD: string }[] = [
  { id: 'uniform', name: 'Uniform', svgD: 'M2,7 L58,7 L58,11 L2,11 Z' },
  { id: 'taper-both', name: 'Width Profile 1 (Taper Both)', svgD: 'M2,9 Q30,2 58,9 Q30,16 2,9 Z' },
  { id: 'wave', name: 'Width Profile 2 (Wave)', svgD: 'M2,9 Q15,2 30,9 T58,9 Q45,16 30,9 T2,9 Z' },
  { id: 'taper-end', name: 'Width Profile 3 (Taper End)', svgD: 'M2,4 L58,9 L2,14 Z' },
  { id: 'bowtie', name: 'Width Profile 4 (Bowtie)', svgD: 'M2,3 L30,8 L58,3 L58,15 L30,10 L2,15 Z' },
];

export const ARROWHEAD_OPTIONS = [
  { id: 'none', label: 'None' },
  { id: 'arrow-1', label: 'Arrow 1 (Classic ►)' },
  { id: 'arrow-2', label: 'Arrow 2 (Sleek ➢)' },
  { id: 'circle', label: 'Circle Marker (●)' },
  { id: 'diamond', label: 'Diamond Marker (◆)' },
  { id: 'bar', label: 'Dimension Bar (|)' },
  { id: 'open-arrow', label: 'Open Chevron (>)' },
];

export const DEFAULT_BRUSHES: BrushItem[] = [
  { id: 'br-cal-5', name: '5 pt. Flat Calligraphic', type: 'calligraphic', angle: 45, roundness: 25, size: 5 },
  { id: 'br-cal-12', name: '12 pt. Oval Calligraphic', type: 'calligraphic', angle: -30, roundness: 60, size: 12 },
  { id: 'br-cal-round', name: '8 pt. Round Marker', type: 'calligraphic', angle: 0, roundness: 100, size: 8 },
  { id: 'br-scat-stars', name: 'Starburst Scatter', type: 'scatter', angle: 0, roundness: 100, size: 10, spacing: 45, scatter: 30, colorization: 'tints' },
  { id: 'br-scat-leaves', name: 'Botanical Leaf Scatter', type: 'scatter', angle: 25, roundness: 80, size: 14, spacing: 60, scatter: 45, colorization: 'hue-shift' },
  { id: 'br-art-charcoal', name: 'Charcoal Feather Art Brush', type: 'art', angle: 0, roundness: 40, size: 6, colorization: 'tints' },
  { id: 'br-art-taper', name: 'Japanese Ink Taper', type: 'art', angle: 15, roundness: 35, size: 9, colorization: 'tints' },
  { id: 'br-pat-chain', name: 'Geometric Chain Pattern', type: 'pattern', angle: 0, roundness: 100, size: 8, spacing: 10, colorization: 'none' },
  { id: 'br-pat-rope', name: 'Nautical Rope Border', type: 'pattern', angle: 0, roundness: 100, size: 10, spacing: 5, colorization: 'tints' },
];

export const DEFAULT_SYMBOLS: SymbolItem[] = [
  {
    id: 'sym-badge-star',
    name: 'Dynamic Gold Star',
    isDynamic: true,
    previewColor: '#ff9a00',
    paths: [{ d: 'M16,2 L20,11 L30,12 L22,19 L25,29 L16,23 L7,29 L10,19 L2,12 L12,11 Z', fill: '#ff9a00', stroke: '#1a1a1a' }],
  },
  {
    id: 'sym-sparkle',
    name: '4-Point Vector Sparkle',
    isDynamic: true,
    previewColor: '#00d9ff',
    paths: [{ d: 'M16,1 Q16,16 31,16 Q16,16 16,31 Q16,16 1,16 Q16,16 16,1 Z', fill: '#00d9ff', stroke: '#ffffff' }],
  },
  {
    id: 'sym-cube-iso',
    name: 'Isometric Cube Block',
    isDynamic: true,
    previewColor: '#1473e6',
    paths: [{ d: 'M16,2 L30,9 L30,23 L16,30 L2,23 L2,9 Z', fill: '#1473e6', stroke: '#ffffff' }],
  },
  {
    id: 'sym-leaf-flora',
    name: 'Tropical Monstera Leaf',
    isDynamic: true,
    previewColor: '#4fcf5f',
    paths: [{ d: 'M16,2 C26,6 30,18 16,30 C2,18 6,6 16,2 Z', fill: '#4fcf5f', stroke: '#104a1c' }],
  },
  {
    id: 'sym-pin-loc',
    name: 'Map Location Pin',
    isDynamic: true,
    previewColor: '#ff4f4f',
    paths: [{ d: 'M16,2 C23,2 27,7 27,13 C27,21 16,30 16,30 C16,30 5,21 5,13 C5,7 9,2 16,2 Z', fill: '#ff4f4f', stroke: '#ffffff' }],
  },
  {
    id: 'sym-reg-target',
    name: 'Print Registration Mark',
    isDynamic: false,
    previewColor: '#e8e8e8',
    paths: [{ d: 'M16,4 A12,12 0 1,0 16,28 A12,12 0 1,0 16,4 Z', fill: 'none', stroke: '#e8e8e8' }],
  },
];

export const StrokeBrushesSymbolsPanel: React.FC<StrokeBrushesSymbolsPanelProps> = ({
  initialTab = 'stroke',
}) => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || { nodes: {}, brushes: [], symbols: [] };
  const unit = doc.unit || 'pt';

  const [activeTab, setActiveTab] = useState<'stroke' | 'brushes' | 'symbols'>(initialTab);

  // Stroke local controls
  const [arrowStart, setArrowStart] = useState<string>('none');
  const [arrowEnd, setArrowEnd] = useState<string>('none');
  const [arrowScale, setArrowScale] = useState<number>(100);

  // Brushes state
  const [editingBrush, setEditingBrush] = useState<BrushItem | null>(null);

  // Symbols & Symbolism tool state
  const [activeSymbolId, setActiveSymbolId] = useState<string>(DEFAULT_SYMBOLS[0].id);
  const [sprayerDiameter, setSprayerDiameter] = useState<number>(48);
  const [sprayerIntensity, setSprayerIntensity] = useState<number>(8);
  const [sprayerDensity, setSprayerDensity] = useState<number>(5);

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const primaryNode: VectorNode | null = selectedIds[0] ? nodesMap[selectedIds[0]] || null : null;
  const activeStroke: StrokeItem = primaryNode?.strokes?.[0] || {
    id: 'st-default',
    visible: true,
    color: '#000000',
    weight: 1,
    cap: 'butt',
    join: 'miter',
    miterLimit: 4,
    align: 'center',
    dashArray: [],
    widthProfileId: 'uniform',
    opacity: 1,
    blendMode: 'normal',
  };

  const isDashed = Array.isArray(activeStroke.dashArray) && activeStroke.dashArray.length > 0;
  const dashInputs = useMemo(() => {
    const arr = activeStroke.dashArray || [];
    return [arr[0] ?? 12, arr[1] ?? 0, arr[2] ?? 0, arr[3] ?? 0, arr[4] ?? 0, arr[5] ?? 0];
  }, [activeStroke.dashArray]);

  const brushes: BrushItem[] =
    doc.brushes && doc.brushes.length > 0 ? doc.brushes : DEFAULT_BRUSHES;
  const symbols: SymbolItem[] =
    doc.symbols && doc.symbols.length > 0 ? doc.symbols : DEFAULT_SYMBOLS;

  const mutateSelectedStroke = (
    updater: (stroke: StrokeItem, node: VectorNode) => void,
    label = 'Update Stroke'
  ) => {
    if (typeof store.pushHistory === 'function') store.pushHistory(label);
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      selectedIds.forEach((id) => {
        const node: VectorNode | undefined = d.nodes?.[id];
        if (!node) return;
        if (!node.strokes || node.strokes.length === 0) {
          node.strokes = [{ ...activeStroke, id: `st-${Date.now()}` }];
        }
        updater(node.strokes[0], node);
      });
      return next;
    });
  };

  const handleDashInputChange = (index: number, val: number) => {
    const nextSix = [...dashInputs];
    nextSix[index] = Math.max(0, val);
    const trimmed = nextSix.filter((v, idx) => idx === 0 || v > 0);
    mutateSelectedStroke((s) => {
      s.dashArray = trimmed;
    }, 'Update Dashed Line');
  };

  const handleApplyBrush = (brush: BrushItem) => {
    mutateSelectedStroke((s) => {
      s.brushId = brush.id;
      s.weight = brush.size;
      if (brush.type === 'calligraphic' || brush.type === 'art') {
        s.cap = 'round';
        s.join = 'round';
      }
    }, `Apply Brush: ${brush.name}`);
    useStudioStore.setState({ activeBrushId: brush.id } as any);
  };

  const handleRemoveBrushFromStroke = () => {
    mutateSelectedStroke((s) => {
      delete s.brushId;
    }, 'Remove Brush Stroke');
  };

  const handleSaveBrushParams = (updated: BrushItem) => {
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      if (!d.brushes || d.brushes.length === 0) d.brushes = [...DEFAULT_BRUSHES];
      const idx = d.brushes.findIndex((b: BrushItem) => b.id === updated.id);
      if (idx !== -1) d.brushes[idx] = updated;
      else d.brushes.push(updated);

      // Update all nodes using this brush
      if (d.nodes) {
        Object.values(d.nodes as Record<string, VectorNode>).forEach((n) => {
          (n.strokes || []).forEach((s) => {
            if (s.brushId === updated.id) {
              s.weight = updated.size;
            }
          });
        });
      }
      return next;
    });
    setEditingBrush(null);
  };

  const handlePlaceSymbolInstance = (sym: SymbolItem) => {
    const newId = `sym-inst-${Date.now()}`;
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      const layerId = d.activeLayerId || d.layers?.[0]?.id || 'layer-1';
      const instNode: VectorNode = {
        id: newId,
        name: `<Symbol> ${sym.name}`,
        type: 'symbol-instance',
        layerId,
        symbolId: sym.id,
        visible: true,
        locked: false,
        x: 180 + Math.round(Math.random() * 140),
        y: 160 + Math.round(Math.random() * 120),
        width: 64,
        height: 64,
        rotation: 0,
        points: [
          { id: 'p1', x: 180, y: 160, pointType: 'corner' },
          { id: 'p2', x: 244, y: 160, pointType: 'corner' },
          { id: 'p3', x: 244, y: 224, pointType: 'corner' },
          { id: 'p4', x: 180, y: 224, pointType: 'corner' },
        ],
        closed: true,
        fills: [
          {
            id: `f-${Date.now()}`,
            visible: true,
            type: 'solid',
            color: sym.previewColor,
            opacity: 1,
            blendMode: 'normal',
          },
        ],
        strokes: [
          {
            id: `s-${Date.now()}`,
            visible: true,
            color: '#1a1a1a',
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
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      };
      if (!d.nodes) d.nodes = {};
      d.nodes[newId] = instNode;
      const layer = (d.layers || []).find((l: any) => l.id === layerId);
      if (layer && Array.isArray(layer.nodeIds)) {
        layer.nodeIds.unshift(newId);
      }
      next.selectedIds = [newId];
      next.selectedNodeIds = [newId];
      return next;
    });
  };

  const handleBreakLinkToSymbol = () => {
    if (!primaryNode || primaryNode.type !== 'symbol-instance') return;
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      const node: VectorNode | undefined = d.nodes?.[primaryNode.id];
      if (node) {
        node.type = 'star';
        node.sides = 5;
        node.innerRadius = 0.45;
        node.name = `${node.name.replace('<Symbol> ', '')} (Unlinked Path)`;
        delete node.symbolId;
      }
      return next;
    });
  };

  const handleCreateSymbolFromSelection = (isDynamic = true) => {
    if (!primaryNode) return;
    const fillHex = primaryNode.fills?.[0]?.color || '#1473e6';
    const newSym: SymbolItem = {
      id: `sym-custom-${Date.now()}`,
      name: `${primaryNode.name || 'Artwork'} Symbol`,
      isDynamic,
      previewColor: fillHex !== 'none' ? fillHex : '#ff9a00',
      paths: [
        {
          d: 'M6,6 L26,6 L26,26 L6,26 Z',
          fill: fillHex !== 'none' ? fillHex : '#ff9a00',
          stroke: '#ffffff',
        },
      ],
    };
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      if (!d.symbols || d.symbols.length === 0) d.symbols = [...DEFAULT_SYMBOLS];
      d.symbols.push(newSym);
      return next;
    });
    setActiveSymbolId(newSym.id);
  };

  return (
    <div className="flex flex-col h-full bg-[#323232] text-[#e8e8e8] select-none text-[11px]">
      {/* Sub-Tabs: Stroke (Ctrl+F10) | Brushes (F5) | Symbols (Shift+Ctrl+F11) */}
      <div className="flex items-center bg-[#262626] border-b border-[#1a1a1a]">
        {(['stroke', 'brushes', 'symbols'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 font-medium capitalize border-r border-[#1a1a1a] ${
              activeTab === tab
                ? 'bg-[#323232] text-white border-t-2 border-t-[#1473e6]'
                : 'text-[#9e9e9e] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ====================================================================
          TAB 1: STROKE PANEL (Ctrl+F10)
          ==================================================================== */}
      {activeTab === 'stroke' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          {/* Weight & Cap */}
          <div className="flex items-center justify-between">
            <NumericScrubInput
              label="Weight:"
              value={activeStroke.weight}
              unit={unit}
              min={0}
              max={1000}
              step={0.5}
              width={60}
              onChange={(w) =>
                mutateSelectedStroke((s) => {
                  s.weight = w;
                  s.visible = w > 0;
                }, 'Stroke Weight')
              }
            />

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#b0b0b0] mr-1">Cap:</span>
              {(['butt', 'round', 'projecting'] as const).map((cap) => (
                <button
                  key={cap}
                  onClick={() =>
                    mutateSelectedStroke((s) => {
                      s.cap = cap;
                    }, `Stroke Cap: ${cap}`)
                  }
                  title={`Cap: ${cap}`}
                  className={`px-1.5 py-0.5 rounded text-[10px] capitalize border ${
                    activeStroke.cap === cap
                      ? 'bg-[#1473e6] border-[#1473e6] text-white'
                      : 'bg-[#292929] border-[#1a1a1a]'
                  }`}
                >
                  {cap === 'projecting' ? 'Proj' : cap}
                </button>
              ))}
            </div>
          </div>

          {/* Corner Join & Miter Limit */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#b0b0b0] mr-1">Corner:</span>
              {(['miter', 'round', 'bevel'] as const).map((join) => (
                <button
                  key={join}
                  onClick={() =>
                    mutateSelectedStroke((s) => {
                      s.join = join;
                    }, `Stroke Join: ${join}`)
                  }
                  title={`Join: ${join}`}
                  className={`px-1.5 py-0.5 rounded text-[10px] capitalize border ${
                    activeStroke.join === join
                      ? 'bg-[#1473e6] border-[#1473e6] text-white'
                      : 'bg-[#292929] border-[#1a1a1a]'
                  }`}
                >
                  {join}
                </button>
              ))}
            </div>

            <NumericScrubInput
              label="Limit:"
              value={activeStroke.miterLimit ?? 4}
              suffix="x"
              min={1}
              max={50}
              width={44}
              compact
              disabled={activeStroke.join !== 'miter'}
              onChange={(ml) =>
                mutateSelectedStroke((s) => {
                  s.miterLimit = ml;
                }, 'Miter Limit')
              }
            />
          </div>

          {/* Align Stroke (Center, Inside, Outside) */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#b0b0b0]">Align Stroke:</span>
            <div className="flex items-center gap-1">
              {(['center', 'inside', 'outside'] as const).map((al) => (
                <button
                  key={al}
                  onClick={() =>
                    mutateSelectedStroke((s) => {
                      s.align = al;
                    }, `Align Stroke: ${al}`)
                  }
                  className={`px-2 py-0.5 rounded text-[10px] capitalize border ${
                    activeStroke.align === al
                      ? 'bg-[#1473e6] border-[#1473e6] text-white'
                      : 'bg-[#292929] border-[#1a1a1a]'
                  }`}
                >
                  {al}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#222222]" />

          {/* Dashed Line Checkbox + 6 Dash/Gap Inputs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={isDashed}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    mutateSelectedStroke((s) => {
                      s.dashArray = checked ? [12, 6] : [];
                    }, 'Toggle Dashed Line');
                  }}
                />
                <span>Dashed Line</span>
              </label>
              <span className="text-[9px] text-[#888]">6-Slot Dash / Gap Array</span>
            </div>

            {isDashed && (
              <div className="grid grid-cols-6 gap-1">
                {['dash', 'gap', 'dash', 'gap', 'dash', 'gap'].map((lbl, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <NumericScrubInput
                      value={dashInputs[idx]}
                      min={0}
                      max={500}
                      width="100%"
                      compact
                      onChange={(v) => handleDashInputChange(idx, v)}
                    />
                    <span className="text-[9px] text-[#888] mt-0.5">{lbl}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#222222]" />

          {/* Arrowheads Start / End + Swap + Scale */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] text-[#b0b0b0]">Arrowheads:</span>
              <select
                value={arrowStart}
                onChange={(e) => setArrowStart(e.target.value)}
                className="ai-select text-[10px] w-24"
                title="Start Arrowhead"
              >
                {ARROWHEAD_OPTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const s = arrowStart;
                  setArrowStart(arrowEnd);
                  setArrowEnd(s);
                }}
                title="Swap Start and End Arrowheads"
                className="ai-icon-btn"
              >
                <ArrowLeftRight size={11} />
              </button>
              <select
                value={arrowEnd}
                onChange={(e) => setArrowEnd(e.target.value)}
                className="ai-select text-[10px] w-24"
                title="End Arrowhead"
              >
                {ARROWHEAD_OPTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            {(arrowStart !== 'none' || arrowEnd !== 'none') && (
              <div className="flex items-center justify-end gap-2">
                <NumericScrubInput
                  label="Scale:"
                  value={arrowScale}
                  suffix="%"
                  min={10}
                  max={500}
                  width={48}
                  compact
                  onChange={setArrowScale}
                />
              </div>
            )}
          </div>

          <div className="border-t border-[#222222]" />

          {/* Variable Width Profile Selector */}
          <div className="space-y-1.5">
            <span className="block text-[10px] text-[#b0b0b0]">Variable Width Profile:</span>
            <div className="grid grid-cols-1 gap-1">
              {WIDTH_PROFILES.map((wp) => {
                const isActive = (activeStroke.widthProfileId || 'uniform') === wp.id;
                return (
                  <button
                    key={wp.id}
                    onClick={() =>
                      mutateSelectedStroke((s, node) => {
                        s.widthProfileId = wp.id;
                        // Also apply variable width to anchor points for immediate canvas rendering
                        if (Array.isArray(node.points)) {
                          node.points.forEach((pt, idx) => {
                            const t = idx / Math.max(1, node.points.length - 1);
                            if (wp.id === 'taper-both') {
                              const mult = Math.sin(t * Math.PI);
                              pt.widthLeft = (s.weight / 2) * mult;
                              pt.widthRight = (s.weight / 2) * mult;
                            } else if (wp.id === 'taper-end') {
                              pt.widthLeft = (s.weight / 2) * (1 - t);
                              pt.widthRight = (s.weight / 2) * (1 - t);
                            } else {
                              delete pt.widthLeft;
                              delete pt.widthRight;
                            }
                          });
                        }
                      }, `Width Profile: ${wp.name}`)
                    }
                    className={`flex items-center justify-between px-2 py-1 rounded border ${
                      isActive
                        ? 'bg-[#384656] border-[#1473e6] text-white'
                        : 'bg-[#292929] border-[#1a1a1a] hover:bg-[#363636]'
                    }`}
                  >
                    <svg width="60" height="16" viewBox="0 0 60 18">
                      <path d={wp.svgD} fill="currentColor" />
                    </svg>
                    <span className="text-[10px] truncate">{wp.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: BRUSHES PANEL (F5)
          ==================================================================== */}
      {activeTab === 'brushes' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {brushes.map((br) => {
              const isApplied = activeStroke.brushId === br.id;
              return (
                <div
                  key={br.id}
                  onClick={() => handleApplyBrush(br)}
                  onDoubleClick={() => setEditingBrush({ ...br })}
                  className={`flex items-center justify-between px-2 py-1.5 rounded border cursor-pointer ${
                    isApplied
                      ? 'bg-[#384656] border-[#1473e6]'
                      : 'bg-[#292929] border-[#1a1a1a] hover:bg-[#363636]'
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{br.name}</span>
                      <span className="px-1 rounded bg-[#1e1e1e] text-[9px] uppercase text-[#9e9e9e]">
                        {br.type}
                      </span>
                    </div>
                    {/* Visual Brush Stroke Preview */}
                    <svg width="150" height="14" viewBox="0 0 150 14" className="mt-1">
                      {br.type === 'scatter' ? (
                        <>
                          <circle cx="20" cy="7" r="3" fill="#ff9a00" />
                          <circle cx="50" cy="4" r="4" fill="#1473e6" />
                          <circle cx="80" cy="9" r="3.5" fill="#4fcf5f" />
                          <circle cx="115" cy="6" r="4" fill="#ff4fcf" />
                        </>
                      ) : br.type === 'pattern' ? (
                        <path
                          d="M5,7 L145,7"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeDasharray="8 3 2 3"
                        />
                      ) : (
                        <path
                          d="M5,10 Q45,2 75,7 T145,5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={Math.min(6, Math.max(1.5, br.size / 2))}
                          strokeLinecap="round"
                        />
                      )}
                    </svg>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBrush({ ...br });
                    }}
                    title="Edit Brush Parameters"
                    className="ai-icon-btn text-[#9e9e9e] hover:text-white"
                  >
                    <Sliders size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Brush Parameters Editor Drawer */}
          {editingBrush && (
            <div className="p-2.5 bg-[#242424] border-t border-[#1a1a1a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#ff9a00]">{editingBrush.name} Options</span>
                <button
                  onClick={() => setEditingBrush(null)}
                  className="text-[10px] text-[#9e9e9e] hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                value={editingBrush.name}
                onChange={(e) => setEditingBrush({ ...editingBrush, name: e.target.value })}
                className="ai-input w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <AngleDial
                  label="Angle:"
                  angle={editingBrush.angle}
                  size={20}
                  onChange={(a) => setEditingBrush({ ...editingBrush, angle: a })}
                />
                <NumericScrubInput
                  label="Round:"
                  value={editingBrush.roundness}
                  suffix="%"
                  min={1}
                  max={100}
                  width={44}
                  compact
                  onChange={(r) => setEditingBrush({ ...editingBrush, roundness: r })}
                />
                <NumericScrubInput
                  label="Size:"
                  value={editingBrush.size}
                  unit="pt"
                  min={1}
                  max={200}
                  width={48}
                  compact
                  onChange={(sz) => setEditingBrush({ ...editingBrush, size: sz })}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#9e9e9e]">Color:</span>
                  <select
                    value={editingBrush.colorization || 'none'}
                    onChange={(e) =>
                      setEditingBrush({
                        ...editingBrush,
                        colorization: e.target.value as any,
                      })
                    }
                    className="ai-select text-[10px]"
                  >
                    <option value="none">None</option>
                    <option value="tints">Tints</option>
                    <option value="hue-shift">Hue Shift</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => handleSaveBrushParams(editingBrush)}
                className="ai-btn active w-full"
              >
                Apply to Strokes
              </button>
            </div>
          )}

          {/* Brushes Footer */}
          <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
            <button
              onClick={handleRemoveBrushFromStroke}
              disabled={!activeStroke.brushId}
              title="Remove Brush Stroke"
              className="px-1.5 py-0.5 rounded bg-[#383838] hover:bg-[#484848] disabled:opacity-40 text-[10px] flex items-center gap-1"
            >
              <Ban size={11} />
              <span>Remove Brush</span>
            </button>

            <button
              onClick={() => {
                setEditingBrush({
                  id: `br-custom-${Date.now()}`,
                  name: `Custom Brush ${brushes.length + 1}`,
                  type: 'calligraphic',
                  angle: 35,
                  roundness: 50,
                  size: 8,
                  colorization: 'tints',
                });
              }}
              title="New Brush (+)"
              className="px-2 py-0.5 rounded bg-[#1473e6] text-white text-[10px] flex items-center gap-1"
            >
              <Plus size={11} />
              <span>New Brush</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: SYMBOLS PANEL (Shift+Ctrl+F11)
          ==================================================================== */}
      {activeTab === 'symbols' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
            {/* Symbols Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {symbols.map((sym) => {
                const isSelected = activeSymbolId === sym.id;
                return (
                  <button
                    key={sym.id}
                    onClick={() => {
                      setActiveSymbolId(sym.id);
                      useStudioStore.setState({ activeSymbolId: sym.id } as any);
                    }}
                    onDoubleClick={() => handlePlaceSymbolInstance(sym)}
                    title={`${sym.name} (${sym.isDynamic ? 'Dynamic Symbol' : 'Static Symbol'}) — Double-click to place instance`}
                    className={`flex flex-col items-center p-1.5 rounded border relative ${
                      isSelected
                        ? 'bg-[#384656] border-[#1473e6]'
                        : 'bg-[#292929] border-[#1a1a1a] hover:bg-[#363636]'
                    }`}
                  >
                    <svg width="32" height="32" viewBox="0 0 32 32">
                      {sym.paths.map((p, i) => (
                        <path
                          key={i}
                          d={p.d}
                          fill={p.fill}
                          stroke={p.stroke}
                          strokeWidth="1.2"
                        />
                      ))}
                    </svg>
                    <span className="text-[9px] truncate w-full text-center mt-1">
                      {sym.name}
                    </span>
                    {sym.isDynamic && (
                      <span
                        title="Dynamic Symbol (+)"
                        className="absolute bottom-1 right-1 text-[9px] font-bold text-[#ff9a00]"
                      >
                        +
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Symbolism Tools Options (Sprayer, Sizer, Spinner, Stainer...) */}
            <div className="p-2 rounded bg-[#292929] border border-[#1a1a1a] space-y-1.5">
              <span className="block text-[10px] font-semibold text-[#ff9a00]">
                Symbolism Tool Parameters (Shift+S):
              </span>
              <div className="grid grid-cols-3 gap-1">
                <NumericScrubInput
                  label="Dia:"
                  value={sprayerDiameter}
                  unit="pt"
                  min={10}
                  max={400}
                  width={42}
                  compact
                  onChange={setSprayerDiameter}
                />
                <NumericScrubInput
                  label="Int:"
                  value={sprayerIntensity}
                  min={1}
                  max={10}
                  width={36}
                  compact
                  onChange={setSprayerIntensity}
                />
                <NumericScrubInput
                  label="Den:"
                  value={sprayerDensity}
                  min={1}
                  max={10}
                  width={36}
                  compact
                  onChange={setSprayerDensity}
                />
              </div>
            </div>
          </div>

          {/* Symbols Footer Actions */}
          <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const sym = symbols.find((s) => s.id === activeSymbolId) || symbols[0];
                  if (sym) handlePlaceSymbolInstance(sym);
                }}
                title="Place Symbol Instance on Artboard"
                className="px-2 py-0.5 rounded bg-[#1473e6] text-white text-[10px]"
              >
                Place Instance
              </button>
              <button
                onClick={handleBreakLinkToSymbol}
                disabled={!primaryNode || primaryNode.type !== 'symbol-instance'}
                title="Break Link to Symbol (Convert to standard editable vector path)"
                className="px-1.5 py-0.5 rounded bg-[#383838] hover:bg-[#484848] disabled:opacity-40 text-[10px] flex items-center gap-1"
              >
                <Unlink size={11} />
                <span>Break Link</span>
              </button>
            </div>

            <button
              onClick={() => handleCreateSymbolFromSelection(true)}
              disabled={!primaryNode}
              title="New Dynamic Symbol from Selection (F8)"
              className="p-1 rounded hover:bg-[#3f3f3f] disabled:opacity-40 text-[#cfcfcf]"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrokeBrushesSymbolsPanel;
