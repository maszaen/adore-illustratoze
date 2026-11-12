import React, { useState, useMemo } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Maximize,
  Download,
  Clock,
  Info,
  Wand2,
  Image as ImageIcon,
  Layers,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import { BLEND_MODES } from './AppearancePanel';
import {
  IMAGE_TRACE_PRESETS,
  ImageTraceOptions,
  ImageTracePresetId,
  getImageTracePresetOptions,
  traceImageNodeToVectorNodes,
} from '../../core/io/imageTrace';
import {
  exportAssetToDataUrl,
  triggerDataUrlDownload,
  RasterFormat,
} from '../../core/io/rasterExport';
import { hexToRgb, rgbToCmyk } from '../../core/math/color';
import type {
  ArtboardItem,
  BlendMode,
  ExportAssetItem,
  HistoryEntry,
  VectorNode,
} from '../../core/types';

export type MultiUtilityTabId =
  | 'artboards'
  | 'asset-export'
  | 'transparency'
  | 'image-trace'
  | 'info'
  | 'history'
  | 'magic-wand'
  | 'properties';

export interface ArtboardsAssetHistoryInfoPanelProps {
  initialTab?: MultiUtilityTabId;
  showTabs?: boolean;
}

const ARTBOARD_SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: 'Web Large (1920 × 1080 px)', w: 1920, h: 1080 },
  { label: 'Web Standard (1440 × 900 px)', w: 1440, h: 900 },
  { label: 'A4 Print (595.28 × 841.89 pt)', w: 595.28, h: 841.89 },
  { label: 'US Letter (612 × 792 pt)', w: 612, h: 792 },
  { label: 'Square Social (1080 × 1080 px)', w: 1080, h: 1080 },
  { label: 'iPhone Pro (393 × 852 pt)', w: 393, h: 852 },
];

export const ArtboardsAssetHistoryInfoPanel: React.FC<
  ArtboardsAssetHistoryInfoPanelProps
> = ({ initialTab = 'artboards', showTabs = true }) => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || {
    artboards: [],
    nodes: {},
    layers: [],
    exportAssets: [],
    slices: [],
  };
  const unit = doc.unit || 'pt';

  const [activeTab, setActiveTab] = useState<MultiUtilityTabId>(initialTab);

  // Artboard Rearrange settings
  const [rearrangeCols, setRearrangeCols] = useState<number>(2);
  const [rearrangeSpacing, setRearrangeSpacing] = useState<number>(40);

  // Transparency extra flags
  const [isolateBlending, setIsolateBlending] = useState<boolean>(false);
  const [knockoutGroup, setKnockoutGroup] = useState<boolean>(false);

  // Image Trace state
  const [traceOpts, setTraceOpts] = useState<ImageTraceOptions>(() =>
    getImageTracePresetOptions('bw-logo')
  );
  const [traceStats, setTraceStats] = useState<{
    paths: number;
    anchors: number;
    colors: number;
  } | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);

  // Magic Wand state
  const [wandCriteria, setWandCriteria] = useState({
    fillColor: true,
    fillTolerance: 32,
    strokeColor: false,
    strokeColorTolerance: 32,
    strokeWeight: false,
    strokeWeightTolerance: 2,
    opacity: false,
    opacityTolerance: 10,
    blendMode: false,
  });

  const artboards: ArtboardItem[] = doc.artboards || [];
  const activeArtboardId: string = doc.activeArtboardId || artboards[0]?.id || '';
  const activeArtboard: ArtboardItem | undefined =
    artboards.find((a) => a.id === activeArtboardId) || artboards[0];

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const selectedNodes: VectorNode[] = useMemo(
    () => selectedIds.map((id) => nodesMap[id]).filter(Boolean),
    [selectedIds, nodesMap]
  );
  const primaryNode: VectorNode | null = selectedNodes[0] || null;
  const exportAssets: ExportAssetItem[] = doc.exportAssets || [];
  const historyList: HistoryEntry[] = store.history || store.historyEntries || [];
  const historyIndex: number = store.historyIndex ?? historyList.length - 1;

  const updateDocument = (
    updater: (d: any, s: any) => void,
    label = 'Update Document'
  ) => {
    if (typeof store.pushHistory === 'function') store.pushHistory(label);
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      updater(d, next);
      return next;
    });
  };

  // ============================================================================
  // 1. ARTBOARDS HANDLERS
  // ============================================================================
  const handleAddArtboard = () => {
    if (typeof store.addArtboard === 'function') {
      store.addArtboard();
      return;
    }
    const last = artboards[artboards.length - 1];
    const w = last?.width || 800;
    const h = last?.height || 600;
    const x = last ? last.x + last.width + 60 : 0;
    const y = last ? last.y : 0;
    const newAb: ArtboardItem = {
      id: `ab-${Date.now()}`,
      name: `Artboard ${artboards.length + 1}`,
      x,
      y,
      width: w,
      height: h,
      orientation: w >= h ? 'landscape' : 'portrait',
      showCenterMark: false,
      showCrossHairs: false,
      showVideoSafeAreas: false,
    };
    updateDocument((d) => {
      if (!d.artboards) d.artboards = [];
      d.artboards.push(newAb);
      d.activeArtboardId = newAb.id;
    }, 'Add Artboard');
  };

  const handleDuplicateArtboard = (ab: ArtboardItem) => {
    const dup: ArtboardItem = {
      ...JSON.parse(JSON.stringify(ab)),
      id: `ab-${Date.now()}`,
      name: `${ab.name} Copy`,
      x: ab.x + ab.width + 60,
    };
    updateDocument((d) => {
      d.artboards.push(dup);
      d.activeArtboardId = dup.id;
    }, 'Duplicate Artboard');
  };

  const handleDeleteArtboard = (id: string) => {
    if (artboards.length <= 1) return;
    updateDocument((d) => {
      d.artboards = (d.artboards || []).filter((a: ArtboardItem) => a.id !== id);
      if (d.activeArtboardId === id) {
        d.activeArtboardId = d.artboards[0]?.id || '';
      }
    }, 'Delete Artboard');
  };

  const handleMoveArtboardOrder = (id: string, dir: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    updateDocument((d) => {
      const idx = (d.artboards || []).findIndex((a: ArtboardItem) => a.id === id);
      if (idx === -1) return;
      const target = idx + dir;
      if (target < 0 || target >= d.artboards.length) return;
      const [item] = d.artboards.splice(idx, 1);
      d.artboards.splice(target, 0, item);
    }, 'Reorder Artboards');
  };

  const handleRearrangeAllArtboards = () => {
    const cols = Math.max(1, rearrangeCols);
    const gap = Math.max(0, rearrangeSpacing);
    updateDocument((d) => {
      let curX = 0;
      let curY = 0;
      let rowMaxH = 0;
      (d.artboards || []).forEach((ab: ArtboardItem, i: number) => {
        if (i > 0 && i % cols === 0) {
          curX = 0;
          curY += rowMaxH + gap;
          rowMaxH = 0;
        }
        ab.x = curX;
        ab.y = curY;
        curX += ab.width + gap;
        if (ab.height > rowMaxH) rowMaxH = ab.height;
      });
    }, 'Rearrange All Artboards');
  };

  const handleFitArtboardToArtwork = (onlySelected = false) => {
    if (!activeArtboard) return;
    const pool = onlySelected
      ? selectedNodes
      : Object.values(nodesMap).filter((n) => n && n.visible && !n.isGuide);
    if (pool.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    pool.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });
    updateDocument((d) => {
      const ab = (d.artboards || []).find((a: ArtboardItem) => a.id === activeArtboard.id);
      if (ab) {
        ab.x = Math.round(minX);
        ab.y = Math.round(minY);
        ab.width = Math.max(10, Math.round(maxX - minX));
        ab.height = Math.max(10, Math.round(maxY - minY));
      }
    }, 'Fit Artboard to Artwork Bounds');
  };

  // ============================================================================
  // 2. ASSET EXPORT HANDLERS
  // ============================================================================
  const handleAddSelectionToAssetExport = () => {
    if (selectedNodes.length === 0) return;
    updateDocument((d) => {
      if (!d.exportAssets) d.exportAssets = [];
      selectedNodes.forEach((n) => {
        if (!d.exportAssets.some((a: ExportAssetItem) => a.sourceNodeId === n.id)) {
          d.exportAssets.push({
            id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            name: (n.name || n.type || 'Asset').replace(/[<>]/g, '').trim(),
            sourceNodeId: n.id,
            scales: ['1x', '2x'],
            formats: ['png', 'svg'],
          });
        }
      });
    }, 'Add to Asset Export');
  };

  const handleExportAllAssetsNow = () => {
    if (exportAssets.length === 0) {
      // If no queued assets, open Export for Screens modal or export active artboard 1x PNG
      const url = exportAssetToDataUrl(
        doc,
        {
          id: 'quick',
          name: doc.name || 'Artwork',
          sourceNodeId: primaryNode?.id || '',
          scales: ['1x'],
          formats: ['png'],
        },
        '1x',
        'png'
      );
      triggerDataUrlDownload(url, `${doc.name || 'Artwork'}-1x.png`);
      return;
    }

    exportAssets.forEach((asset) => {
      asset.scales.forEach((sc) => {
        asset.formats.forEach((fmt) => {
          if (fmt === 'png' || fmt === 'jpg' || fmt === 'webp') {
            const url = exportAssetToDataUrl(doc, asset, sc, fmt as RasterFormat);
            triggerDataUrlDownload(url, `${asset.name}-${sc}.${fmt}`);
          } else if (fmt === 'svg') {
            const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><title>${asset.name}</title></svg>`;
            const url = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
            triggerDataUrlDownload(url, `${asset.name}.svg`);
          }
        });
      });
    });
  };

  // ============================================================================
  // 3. IMAGE TRACE HANDLERS
  // ============================================================================
  const handleRunImageTrace = async (expandImmediately = false) => {
    const targetNode =
      primaryNode ||
      Object.values(nodesMap)[0] || {
        id: 'sample-img',
        name: 'Sample Bitmap',
        type: 'image' as const,
        layerId: doc.activeLayerId || 'layer-1',
        visible: true,
        locked: false,
        x: 120,
        y: 120,
        width: 240,
        height: 240,
        rotation: 0,
        points: [],
        closed: true,
        fills: [],
        strokes: [],
        effects: [],
        opacity: 1,
        blendMode: 'normal' as const,
      };

    setIsTracing(true);
    try {
      const res = await traceImageNodeToVectorNodes(targetNode, traceOpts);
      setTraceStats({
        paths: res.pathCount,
        anchors: res.anchorCount,
        colors: res.colorCount,
      });

      updateDocument((d, s) => {
        if (!d.nodes) d.nodes = {};
        if (expandImmediately && d.nodes[targetNode.id]) {
          delete d.nodes[targetNode.id];
        }
        d.nodes[res.groupNode.id] = res.groupNode;
        res.pathNodes.forEach((pn) => {
          d.nodes[pn.id] = pn;
        });
        const layer = (d.layers || []).find((l: any) => l.id === res.groupNode.layerId);
        if (layer && Array.isArray(layer.nodeIds)) {
          layer.nodeIds = [
            res.groupNode.id,
            ...layer.nodeIds.filter((id: string) => id !== targetNode.id),
          ];
        }
        s.selectedIds = [res.groupNode.id];
        s.selectedNodeIds = [res.groupNode.id];
      }, expandImmediately ? 'Expand Image Trace' : 'Image Trace');
    } catch (error) {
      store.setStatusMessage(error instanceof Error ? error.message : 'Image Trace failed.');
    } finally {
      setIsTracing(false);
    }
  };

  // ============================================================================
  // 4. MAGIC WAND HANDLER
  // ============================================================================
  const handleMagicWandSelect = () => {
    if (!primaryNode) return;
    const baseFillRgb = hexToRgb(primaryNode.fills?.[0]?.color || '#000000');
    const baseStrokeRgb = hexToRgb(primaryNode.strokes?.[0]?.color || '#000000');
    const baseWeight = primaryNode.strokes?.[0]?.weight ?? 1;
    const baseOpacity = (primaryNode.opacity ?? 1) * 100;
    const baseBlend = primaryNode.blendMode || 'normal';

    const matchedIds = Object.values(nodesMap)
      .filter((n) => {
        if (!n || !n.visible || n.locked || n.isGuide) return false;
        if (wandCriteria.fillColor) {
          const rgb = hexToRgb(n.fills?.[0]?.color || '#000000');
          const dist = Math.hypot(
            rgb.r - baseFillRgb.r,
            rgb.g - baseFillRgb.g,
            rgb.b - baseFillRgb.b
          );
          if (dist > wandCriteria.fillTolerance) return false;
        }
        if (wandCriteria.strokeColor) {
          const rgb = hexToRgb(n.strokes?.[0]?.color || '#000000');
          const dist = Math.hypot(
            rgb.r - baseStrokeRgb.r,
            rgb.g - baseStrokeRgb.g,
            rgb.b - baseStrokeRgb.b
          );
          if (dist > wandCriteria.strokeColorTolerance) return false;
        }
        if (wandCriteria.strokeWeight) {
          const w = n.strokes?.[0]?.weight ?? 1;
          if (Math.abs(w - baseWeight) > wandCriteria.strokeWeightTolerance) return false;
        }
        if (wandCriteria.opacity) {
          const op = (n.opacity ?? 1) * 100;
          if (Math.abs(op - baseOpacity) > wandCriteria.opacityTolerance) return false;
        }
        if (wandCriteria.blendMode) {
          if ((n.blendMode || 'normal') !== baseBlend) return false;
        }
        return true;
      })
      .map((n) => n.id);

    useStudioStore.setState({
      selectedIds: matchedIds,
      selectedNodeIds: matchedIds,
    } as any);
  };

  return (
    <div className="flex flex-col h-full bg-[#323232] text-[#e8e8e8] select-none text-[11px]">
      {/* Multi-Panel Sub-Tabs Bar */}
      {showTabs && (
      <div className="flex items-center bg-[#262626] border-b border-[#1a1a1a] overflow-x-auto">
        {[
          { id: 'artboards' as const, label: 'Artboards' },
          { id: 'asset-export' as const, label: 'Exports' },
          { id: 'transparency' as const, label: 'Transparency' },
          { id: 'image-trace' as const, label: 'Trace' },
          { id: 'info' as const, label: 'Info' },
          { id: 'history' as const, label: 'History' },
          { id: 'magic-wand' as const, label: 'Wand' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-2 py-1.5 font-medium whitespace-nowrap border-r border-[#1a1a1a] text-[10px] ${
              activeTab === t.id || (activeTab === 'properties' && t.id === 'info')
                ? 'bg-[#323232] text-white border-t-2 border-t-[#1473e6]'
                : 'text-[#9e9e9e] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      {/* ====================================================================
          TAB 1: ARTBOARDS PANEL
          ==================================================================== */}
      {activeTab === 'artboards' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto divide-y divide-[#242424]">
            {artboards.map((ab, idx) => {
              const isActive = ab.id === activeArtboardId;
              return (
                <div
                  key={ab.id}
                  onClick={() =>
                    updateDocument((d) => {
                      d.activeArtboardId = ab.id;
                    }, 'Select Artboard')
                  }
                  className={`flex items-center justify-between px-2 py-1.5 cursor-pointer ${
                    isActive ? 'bg-[#384656]' : 'hover:bg-[#383838]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-[#1e1e1e] text-[#ff9a00] font-mono text-[10px]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <input
                      value={ab.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDocument((d) => {
                          const target = (d.artboards || []).find(
                            (a: ArtboardItem) => a.id === ab.id
                          );
                          if (target) target.name = val;
                        });
                      }}
                      className="bg-transparent border-b border-transparent focus:border-[#1473e6] outline-none truncate w-28"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#9e9e9e]">
                    <span>
                      {Math.round(ab.width)}×{Math.round(ab.height)}
                    </span>
                    <button
                      onClick={(e) => handleMoveArtboardOrder(ab.id, -1, e)}
                      className="p-0.5 hover:text-white"
                      title="Move Artboard Up"
                    >
                      <ArrowUp size={10} />
                    </button>
                    <button
                      onClick={(e) => handleMoveArtboardOrder(ab.id, 1, e)}
                      className="p-0.5 hover:text-white"
                      title="Move Artboard Down"
                    >
                      <ArrowDown size={10} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateArtboard(ab);
                      }}
                      className="p-0.5 hover:text-white"
                      title="Duplicate Artboard"
                    >
                      <Copy size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Artboard Size, Preset, Orientation & Rearrange All */}
          {activeArtboard && (
            <div className="p-2 bg-[#292929] border-t border-[#1a1a1a] space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] text-[#b0b0b0]">Preset:</span>
                <select
                  onChange={(e) => {
                    const p = ARTBOARD_SIZE_PRESETS[Number(e.target.value)];
                    if (!p) return;
                    updateDocument((d) => {
                      const target = (d.artboards || []).find(
                        (a: ArtboardItem) => a.id === activeArtboard.id
                      );
                      if (target) {
                        target.width = p.w;
                        target.height = p.h;
                        target.orientation = p.w >= p.h ? 'landscape' : 'portrait';
                      }
                    }, 'Artboard Preset Size');
                  }}
                  className="ai-select flex-1 text-[10px]"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose Size Preset...
                  </option>
                  {ARTBOARD_SIZE_PRESETS.map((p, i) => (
                    <option key={p.label} value={i}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-1.5">
                <NumericScrubInput
                  label="W:"
                  value={activeArtboard.width}
                  unit={unit}
                  min={10}
                  width={54}
                  compact
                  onChange={(w) =>
                    updateDocument((d) => {
                      const target = (d.artboards || []).find(
                        (a: ArtboardItem) => a.id === activeArtboard.id
                      );
                      if (target) target.width = w;
                    }, 'Artboard Width')
                  }
                />
                <NumericScrubInput
                  label="H:"
                  value={activeArtboard.height}
                  unit={unit}
                  min={10}
                  width={54}
                  compact
                  onChange={(h) =>
                    updateDocument((d) => {
                      const target = (d.artboards || []).find(
                        (a: ArtboardItem) => a.id === activeArtboard.id
                      );
                      if (target) target.height = h;
                    }, 'Artboard Height')
                  }
                />
                <button
                  onClick={() =>
                    updateDocument((d) => {
                      const target = (d.artboards || []).find(
                        (a: ArtboardItem) => a.id === activeArtboard.id
                      );
                      if (target) {
                        const tmp = target.width;
                        target.width = target.height;
                        target.height = tmp;
                        target.orientation =
                          target.orientation === 'portrait' ? 'landscape' : 'portrait';
                      }
                    }, 'Swap Artboard Orientation')
                  }
                  className="ai-btn text-[10px] px-1.5"
                  title="Toggle Portrait / Landscape Orientation"
                >
                  {activeArtboard.orientation === 'portrait' ? '▯ Port' : '▭ Land'}
                </button>
              </div>

              {/* Rearrange All Artboards & Fit to Artwork Bounds */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#222]">
                <NumericScrubInput
                  label="Cols:"
                  value={rearrangeCols}
                  min={1}
                  max={12}
                  width={36}
                  compact
                  onChange={setRearrangeCols}
                />
                <NumericScrubInput
                  label="Gap:"
                  value={rearrangeSpacing}
                  unit="pt"
                  min={0}
                  max={500}
                  width={42}
                  compact
                  onChange={setRearrangeSpacing}
                />
                <button
                  onClick={handleRearrangeAllArtboards}
                  className="ai-btn text-[10px]"
                  title="Rearrange All Artboards into Grid"
                >
                  Rearrange
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => handleFitArtboardToArtwork(false)}
                  className="ai-btn text-[10px]"
                >
                  Fit to Artwork Bounds
                </button>
                <button
                  onClick={() => handleFitArtboardToArtwork(true)}
                  disabled={selectedNodes.length === 0}
                  className="ai-btn text-[10px]"
                >
                  Fit to Selected Art
                </button>
              </div>
            </div>
          )}

          {/* Artboards Footer */}
          <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
            <span className="text-[10px] text-[#9e9e9e]">{artboards.length} Artboards</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleAddArtboard}
                title="New Artboard (+)"
                className="p-1 rounded hover:bg-[#3f3f3f] text-[#cfcfcf]"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={() => activeArtboard && handleDeleteArtboard(activeArtboard.id)}
                disabled={artboards.length <= 1}
                title="Delete Active Artboard"
                className="p-1 rounded hover:bg-[#3f3f3f] disabled:opacity-40 text-[#cfcfcf] hover:text-[#ff6b6b]"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: ASSET EXPORT PANEL
          ==================================================================== */}
      {activeTab === 'asset-export' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="p-2 bg-[#292929] border-b border-[#1a1a1a] flex items-center justify-between">
            <span className="text-[10px] text-[#b0b0b0]">
              Collect objects/icons for multi-scale export:
            </span>
            <button
              onClick={handleAddSelectionToAssetExport}
              disabled={selectedNodes.length === 0}
              className="px-2 py-0.5 rounded bg-[#1473e6] disabled:opacity-40 text-white text-[10px] flex items-center gap-1"
            >
              <Plus size={11} />
              <span>Add Selection</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {exportAssets.length === 0 ? (
              <div className="p-4 text-center text-[#888] italic border border-dashed border-[#444] rounded">
                Select any vector object, icon, or group on the canvas and click "+ Add Selection" to queue for 1x/2x/3x batch export.
              </div>
            ) : (
              exportAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="p-2 rounded bg-[#292929] border border-[#1a1a1a] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <input
                      value={asset.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDocument((d) => {
                          const target = (d.exportAssets || []).find(
                            (a: ExportAssetItem) => a.id === asset.id
                          );
                          if (target) target.name = val;
                        });
                      }}
                      className="ai-input flex-1 mr-2"
                    />
                    <button
                      onClick={() =>
                        updateDocument((d) => {
                          d.exportAssets = (d.exportAssets || []).filter(
                            (a: ExportAssetItem) => a.id !== asset.id
                          );
                        }, 'Remove Export Asset')
                      }
                      className="text-[#888] hover:text-[#ff6b6b]"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Scales: 1x, 2x, 3x */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#9e9e9e]">Scales:</span>
                    <div className="flex items-center gap-1">
                      {(['1x', '2x', '3x'] as const).map((sc) => {
                        const has = asset.scales.includes(sc);
                        return (
                          <button
                            key={sc}
                            onClick={() =>
                              updateDocument((d) => {
                                const target = (d.exportAssets || []).find(
                                  (a: ExportAssetItem) => a.id === asset.id
                                );
                                if (!target) return;
                                target.scales = has
                                  ? target.scales.filter((x: string) => x !== sc)
                                  : [...target.scales, sc];
                              })
                            }
                            className={`px-1.5 py-0.5 rounded text-[9px] ${
                              has ? 'bg-[#1473e6] text-white' : 'bg-[#383838] text-[#9e9e9e]'
                            }`}
                          >
                            {sc}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Formats: PNG, SVG, PDF, JPG, WebP */}
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#9e9e9e]">Formats:</span>
                    <div className="flex items-center gap-1">
                      {(['png', 'svg', 'pdf', 'jpg', 'webp'] as const).map((fmt) => {
                        const has = asset.formats.includes(fmt);
                        return (
                          <button
                            key={fmt}
                            onClick={() =>
                              updateDocument((d) => {
                                const target = (d.exportAssets || []).find(
                                  (a: ExportAssetItem) => a.id === asset.id
                                );
                                if (!target) return;
                                target.formats = has
                                  ? target.formats.filter((x: string) => x !== fmt)
                                  : [...target.formats, fmt];
                              })
                            }
                            className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                              has ? 'bg-[#ff9a00] text-black font-bold' : 'bg-[#383838] text-[#9e9e9e]'
                            }`}
                          >
                            {fmt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-2 bg-[#262626] border-t border-[#1a1a1a] flex items-center justify-between gap-2">
            <button
              onClick={() => {
                if (typeof store.setActiveModal === 'function') {
                  store.setActiveModal('export-screens');
                } else {
                  useStudioStore.setState({ activeModal: 'export-screens' } as any);
                }
              }}
              className="ai-btn text-[10px]"
            >
              Export for Screens...
            </button>
            <button
              onClick={handleExportAllAssetsNow}
              className="ai-btn active flex-1 flex items-center justify-center gap-1"
            >
              <Download size={12} />
              <span>Export ({exportAssets.length || 1})</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: TRANSPARENCY PANEL (Shift+Ctrl+F10)
          ==================================================================== */}
      {activeTab === 'transparency' && (
        <div className="p-2.5 space-y-3 overflow-y-auto flex-1">
          {/* Blend Mode & Opacity */}
          <div className="flex items-center justify-between gap-2">
            <select
              value={primaryNode?.blendMode || 'normal'}
              disabled={!primaryNode}
              onChange={(e) =>
                updateDocument((d) => {
                  selectedIds.forEach((id) => {
                    if (d.nodes[id]) d.nodes[id].blendMode = e.target.value as BlendMode;
                  });
                }, 'Change Blend Mode')
              }
              className="ai-select flex-1"
            >
              {BLEND_MODES.map((bm) => (
                <option key={bm.value} value={bm.value}>
                  {bm.label}
                </option>
              ))}
            </select>

            <NumericScrubInput
              label="Opacity:"
              value={Math.round((primaryNode?.opacity ?? 1) * 100)}
              suffix="%"
              min={0}
              max={100}
              width={48}
              disabled={!primaryNode}
              onChange={(pct) =>
                updateDocument((d) => {
                  selectedIds.forEach((id) => {
                    if (d.nodes[id]) d.nodes[id].opacity = pct / 100;
                  });
                }, 'Change Opacity')
              }
            />
          </div>

          {/* Opacity Mask (Luminance Mask) Thumbnail Pair & Controls */}
          <div className="p-2.5 rounded bg-[#292929] border border-[#1a1a1a] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Artwork Thumbnail */}
                <div className="w-10 h-10 rounded bg-[#1e1e1e] border border-[#1473e6] flex items-center justify-center">
                  <div
                    className="w-6 h-6 rounded-sm"
                    style={{
                      backgroundColor: primaryNode?.fills?.[0]?.color || '#1473e6',
                    }}
                  />
                </div>
                <span className="text-[#888]">⛓</span>
                {/* Opacity Mask Thumbnail */}
                <div
                  className={`w-10 h-10 rounded border flex items-center justify-center ${
                    primaryNode?.opacityMask?.enabled
                      ? 'border-[#ff9a00] bg-gradient-to-br from-white to-black'
                      : 'border-dashed border-[#555] bg-[#1e1e1e]'
                  }`}
                >
                  {!primaryNode?.opacityMask?.enabled && (
                    <span className="text-[9px] text-[#777]">No Mask</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  disabled={!primaryNode}
                  onClick={() =>
                    updateDocument((d) => {
                      if (!primaryNode) return;
                      const n = d.nodes[primaryNode.id];
                      if (!n) return;
                      const currentlyEnabled = !!n.opacityMask?.enabled;
                      n.opacityMask = {
                        enabled: !currentlyEnabled,
                        clip: n.opacityMask?.clip ?? true,
                        invert: n.opacityMask?.invert ?? false,
                      };
                    }, 'Make/Release Opacity Mask')
                  }
                  className="ai-btn text-[10px]"
                >
                  {primaryNode?.opacityMask?.enabled ? 'Release Mask' : 'Make Mask'}
                </button>
              </div>
            </div>

            {/* Clip & Invert Mask Checkboxes */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#222] text-[10px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!primaryNode?.opacityMask?.enabled}
                  checked={primaryNode?.opacityMask?.clip ?? true}
                  onChange={(e) =>
                    updateDocument((d) => {
                      if (primaryNode && d.nodes[primaryNode.id]?.opacityMask) {
                        d.nodes[primaryNode.id].opacityMask.clip = e.target.checked;
                      }
                    }, 'Toggle Opacity Mask Clip')
                  }
                />
                <span>Clip</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!primaryNode?.opacityMask?.enabled}
                  checked={primaryNode?.opacityMask?.invert ?? false}
                  onChange={(e) =>
                    updateDocument((d) => {
                      if (primaryNode && d.nodes[primaryNode.id]?.opacityMask) {
                        d.nodes[primaryNode.id].opacityMask.invert = e.target.checked;
                      }
                    }, 'Invert Opacity Mask')
                  }
                />
                <span>Invert Mask</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isolateBlending}
                  onChange={(e) => setIsolateBlending(e.target.checked)}
                />
                <span>Isolate Blending</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={knockoutGroup}
                  onChange={(e) => setKnockoutGroup(e.target.checked)}
                />
                <span>Knockout Group</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: IMAGE TRACE PANEL (Bitmap to Vector Tracing)
          ==================================================================== */}
      {activeTab === 'image-trace' && (
        <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#b0b0b0]">Preset:</span>
            <select
              value={traceOpts.preset}
              onChange={(e) => {
                const pid = e.target.value as ImageTracePresetId;
                setTraceOpts(getImageTracePresetOptions(pid));
              }}
              className="ai-select flex-1 text-[10px]"
            >
              {Object.entries(IMAGE_TRACE_PRESETS).map(([id, cfg]) => (
                <option key={id} value={id}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#b0b0b0]">Mode:</span>
            <select
              value={traceOpts.mode}
              onChange={(e) =>
                setTraceOpts({ ...traceOpts, mode: e.target.value as any })
              }
              className="ai-select flex-1 text-[10px]"
            >
              <option value="color">Color</option>
              <option value="grayscale">Grayscale</option>
              <option value="bw">Black and White</option>
            </select>
          </div>

          {/* Threshold (B&W) or Colors (Color/Grayscale) */}
          {traceOpts.mode === 'bw' ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#b0b0b0] w-16">Threshold:</span>
              <input
                type="range"
                min={1}
                max={255}
                value={traceOpts.threshold}
                onChange={(e) =>
                  setTraceOpts({ ...traceOpts, threshold: Number(e.target.value) })
                }
                className="flex-1 accent-[#1473e6] h-1.5"
              />
              <NumericScrubInput
                value={traceOpts.threshold}
                min={1}
                max={255}
                width={42}
                compact
                onChange={(v) => setTraceOpts({ ...traceOpts, threshold: v })}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#b0b0b0] w-16">Colors:</span>
              <input
                type="range"
                min={2}
                max={64}
                value={traceOpts.colors}
                onChange={(e) =>
                  setTraceOpts({ ...traceOpts, colors: Number(e.target.value) })
                }
                className="flex-1 accent-[#1473e6] h-1.5"
              />
              <NumericScrubInput
                value={traceOpts.colors}
                min={2}
                max={64}
                width={42}
                compact
                onChange={(v) => setTraceOpts({ ...traceOpts, colors: v })}
              />
            </div>
          )}

          {/* Advanced Sliders: Paths, Corners, Noise */}
          <div className="pt-1 border-t border-[#222] space-y-1.5">
            <span className="block text-[10px] font-semibold text-[#9e9e9e]">Advanced:</span>
            {[
              { key: 'paths' as const, label: 'Paths:', min: 1, max: 100, suf: '%' },
              { key: 'corners' as const, label: 'Corners:', min: 0, max: 100, suf: '%' },
              { key: 'noise' as const, label: 'Noise:', min: 1, max: 100, suf: 'px' },
            ].map((sl) => (
              <div key={sl.key} className="flex items-center gap-2">
                <span className="text-[10px] text-[#b0b0b0] w-14">{sl.label}</span>
                <input
                  type="range"
                  min={sl.min}
                  max={sl.max}
                  value={traceOpts[sl.key]}
                  onChange={(e) =>
                    setTraceOpts({ ...traceOpts, [sl.key]: Number(e.target.value) })
                  }
                  className="flex-1 accent-[#1473e6] h-1.5"
                />
                <NumericScrubInput
                  value={traceOpts[sl.key]}
                  suffix={sl.suf}
                  min={sl.min}
                  max={sl.max}
                  width={44}
                  compact
                  onChange={(v) => setTraceOpts({ ...traceOpts, [sl.key]: v })}
                />
              </div>
            ))}
          </div>

          {/* Method: Abutting vs Overlapping + Ignore White */}
          <div className="pt-1 border-t border-[#222] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#b0b0b0]">Method:</span>
              <div className="flex items-center gap-1">
                {(['abutting', 'overlapping'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setTraceOpts({ ...traceOpts, method: m })}
                    className={`px-2 py-0.5 rounded text-[10px] capitalize ${
                      traceOpts.method === m ? 'bg-[#1473e6] text-white' : 'bg-[#292929]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px]">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={traceOpts.fills}
                  onChange={(e) => setTraceOpts({ ...traceOpts, fills: e.target.checked })}
                />
                <span>Fills</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={traceOpts.strokes}
                  onChange={(e) => setTraceOpts({ ...traceOpts, strokes: e.target.checked })}
                />
                <span>Strokes</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer font-semibold text-[#ff9a00]">
                <input
                  type="checkbox"
                  checked={traceOpts.ignoreWhite}
                  onChange={(e) =>
                    setTraceOpts({ ...traceOpts, ignoreWhite: e.target.checked })
                  }
                />
                <span>Ignore White</span>
              </label>
            </div>
          </div>

          {traceStats && (
            <div className="px-2 py-1 rounded bg-[#222] text-[10px] text-[#b0b0b0] flex justify-between">
              <span>Paths: {traceStats.paths}</span>
              <span>Anchors: {traceStats.anchors}</span>
              <span>Colors: {traceStats.colors}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              onClick={() => handleRunImageTrace(false)}
              disabled={isTracing}
              className="ai-btn"
            >
              {isTracing ? 'Tracing...' : 'Trace'}
            </button>
            <button
              onClick={() => handleRunImageTrace(true)}
              disabled={isTracing}
              className="ai-btn active"
            >
              Expand Vector
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 5: INFO (F8) & PROPERTIES READOUT
          ==================================================================== */}
      {(activeTab === 'info' || activeTab === 'properties') && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-2 p-2 rounded bg-[#292929] border border-[#1a1a1a] font-mono text-[10px]">
            <div>
              <span className="text-[#888]">X: </span>
              <span>{Math.round((primaryNode?.x ?? store.cursorX ?? 0) * 10) / 10} {unit}</span>
            </div>
            <div>
              <span className="text-[#888]">W: </span>
              <span>{Math.round((primaryNode?.width ?? 0) * 10) / 10} {unit}</span>
            </div>
            <div>
              <span className="text-[#888]">Y: </span>
              <span>{Math.round((primaryNode ? primaryNode.y : store.cursorY ?? 0) * 10) / 10} {unit}</span>
            </div>
            <div>
              <span className="text-[#888]">H: </span>
              <span>{Math.round((primaryNode?.height ?? 0) * 10) / 10} {unit}</span>
            </div>
            <div>
              <span className="text-[#888]">D: </span>
              <span>
                {Math.round(
                  Math.hypot(primaryNode?.width ?? 0, primaryNode?.height ?? 0) * 10
                ) / 10}{' '}
                {unit}
              </span>
            </div>
            <div>
              <span className="text-[#888]">∠: </span>
              <span>{Math.round((primaryNode?.rotation ?? 0) * 10) / 10}°</span>
            </div>
          </div>

          {primaryNode ? (
            <div className="p-2 rounded bg-[#292929] border border-[#1a1a1a] space-y-1 text-[10px]">
              <div className="font-semibold text-white">{primaryNode.name || primaryNode.type}</div>
              <div className="text-[#9e9e9e]">
                Anchors: {primaryNode.points?.length || 0} | Closed:{' '}
                {primaryNode.closed ? 'Yes' : 'Open'}
              </div>
              {primaryNode.fills?.[0]?.color?.startsWith('#') && (() => {
                const rgb = hexToRgb(primaryNode.fills[0].color);
                const cmyk = rgbToCmyk(rgb);
                return (
                  <div className="text-[#b0b0b0] font-mono text-[9px] pt-1 border-t border-[#222]">
                    <div>RGB: {rgb.r}, {rgb.g}, {rgb.b}</div>
                    <div>CMYK: {cmyk.c}%, {cmyk.m}%, {cmyk.y}%, {cmyk.k}%</div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-[#888] italic text-center py-3">
              Document: {doc.name} ({doc.colorMode || 'RGB'}, {unit})
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB 6: HISTORY PANEL (Time-Travel Undo/Redo Stack)
          ==================================================================== */}
      {activeTab === 'history' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto divide-y divide-[#242424]">
            {historyList.length === 0 ? (
              <div className="px-3 py-2 bg-[#384656] text-white flex items-center gap-2">
                <Clock size={12} />
                <span>Open Document (Initial State)</span>
              </div>
            ) : (
              historyList.map((entry, idx) => {
                const isCurrent = idx === historyIndex;
                return (
                  <button
                    key={entry.id || idx}
                    onClick={() => {
                      if (typeof store.jumpToHistory === 'function') {
                        store.jumpToHistory(idx);
                      } else if (entry.snapshot) {
                        useStudioStore.setState({
                          document: JSON.parse(JSON.stringify(entry.snapshot)),
                          historyIndex: idx,
                        } as any);
                      }
                    }}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between ${
                      isCurrent
                        ? 'bg-[#1473e6] text-white font-medium'
                        : idx > historyIndex
                        ? 'opacity-45 hover:bg-[#383838]'
                        : 'hover:bg-[#383838]'
                    }`}
                  >
                    <span className="truncate">{entry.label || `Step ${idx + 1}`}</span>
                    <span className="text-[9px] opacity-75">
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : ''}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => store.undo?.()}
                title="Undo (Ctrl+Z)"
                className="ai-icon-btn"
              >
                <RotateCcw size={12} />
              </button>
              <button
                onClick={() => store.redo?.()}
                title="Redo (Shift+Ctrl+Z)"
                className="ai-icon-btn"
              >
                <RotateCw size={12} />
              </button>
            </div>
            <span className="text-[10px] text-[#9e9e9e]">
              {historyList.length || 1} States
            </span>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 7: MAGIC WAND PANEL (Y)
          ==================================================================== */}
      {activeTab === 'magic-wand' && (
        <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
          <span className="block text-[10px] text-[#b0b0b0]">
            Magic Wand Matching Attributes & Tolerance:
          </span>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wandCriteria.fillColor}
                  onChange={(e) =>
                    setWandCriteria({ ...wandCriteria, fillColor: e.target.checked })
                  }
                />
                <span>Fill Color</span>
              </label>
              <NumericScrubInput
                label="Tol:"
                value={wandCriteria.fillTolerance}
                min={0}
                max={255}
                width={44}
                compact
                disabled={!wandCriteria.fillColor}
                onChange={(v) => setWandCriteria({ ...wandCriteria, fillTolerance: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wandCriteria.strokeColor}
                  onChange={(e) =>
                    setWandCriteria({ ...wandCriteria, strokeColor: e.target.checked })
                  }
                />
                <span>Stroke Color</span>
              </label>
              <NumericScrubInput
                label="Tol:"
                value={wandCriteria.strokeColorTolerance}
                min={0}
                max={255}
                width={44}
                compact
                disabled={!wandCriteria.strokeColor}
                onChange={(v) =>
                  setWandCriteria({ ...wandCriteria, strokeColorTolerance: v })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wandCriteria.strokeWeight}
                  onChange={(e) =>
                    setWandCriteria({ ...wandCriteria, strokeWeight: e.target.checked })
                  }
                />
                <span>Stroke Weight</span>
              </label>
              <NumericScrubInput
                label="Tol:"
                value={wandCriteria.strokeWeightTolerance}
                unit="pt"
                min={0}
                max={100}
                width={44}
                compact
                disabled={!wandCriteria.strokeWeight}
                onChange={(v) =>
                  setWandCriteria({ ...wandCriteria, strokeWeightTolerance: v })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wandCriteria.opacity}
                  onChange={(e) =>
                    setWandCriteria({ ...wandCriteria, opacity: e.target.checked })
                  }
                />
                <span>Opacity</span>
              </label>
              <NumericScrubInput
                label="Tol:"
                value={wandCriteria.opacityTolerance}
                suffix="%"
                min={0}
                max={100}
                width={44}
                compact
                disabled={!wandCriteria.opacity}
                onChange={(v) => setWandCriteria({ ...wandCriteria, opacityTolerance: v })}
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={wandCriteria.blendMode}
                onChange={(e) =>
                  setWandCriteria({ ...wandCriteria, blendMode: e.target.checked })
                }
              />
              <span>Blending Mode</span>
            </label>
          </div>

          <button
            onClick={handleMagicWandSelect}
            disabled={!primaryNode}
            className="ai-btn active w-full mt-2 flex items-center justify-center gap-1.5"
          >
            <Wand2 size={12} />
            <span>Select Similar Objects Now</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ArtboardsAssetHistoryInfoPanel;
