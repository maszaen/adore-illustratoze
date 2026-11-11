import React, { useState, useMemo } from 'react';
import {
  Link2,
  Unlink2,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Grid,
  Scissors,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import { AngleDial } from '../primitives/AngleDial';
import {
  performPathfinder,
  offsetVectorNode,
  outlineStrokeNode,
  simplifyPathPoints,
} from '../../core/math/pathfinder';
import type {
  AlignOp,
  AlignTarget,
  ArtboardItem,
  PathfinderOp,
  VectorNode,
} from '../../core/types';

export interface PathfinderAlignPanelProps {
  initialTab?: 'pathfinder' | 'align' | 'transform';
  showTabs?: boolean;
}

type RefPointIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const REF_OFFSETS: { rx: number; ry: number; label: string }[] = [
  { rx: 0, ry: 0, label: 'Top Left' },
  { rx: 0.5, ry: 0, label: 'Top Center' },
  { rx: 1, ry: 0, label: 'Top Right' },
  { rx: 0, ry: 0.5, label: 'Middle Left' },
  { rx: 0.5, ry: 0.5, label: 'Center' },
  { rx: 1, ry: 0.5, label: 'Middle Right' },
  { rx: 0, ry: 1, label: 'Bottom Left' },
  { rx: 0.5, ry: 1, label: 'Bottom Center' },
  { rx: 1, ry: 1, label: 'Bottom Right' },
];

export const PathfinderAlignPanel: React.FC<PathfinderAlignPanelProps> = ({
  initialTab = 'pathfinder',
  showTabs = true,
}) => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || { nodes: {}, layers: [], artboards: [] };
  const unit = doc.unit || 'pt';

  const [activeTab, setActiveTab] = useState<'pathfinder' | 'align' | 'transform'>(initialTab);
  const [alignTarget, setAlignTarget] = useState<AlignTarget>(
    store.alignTarget || 'selection'
  );
  const [keyObjectId, setKeyObjectId] = useState<string | null>(store.keyObjectId || null);
  const [distributeSpacingVal, setDistributeSpacingVal] = useState<number>(12);

  // Transform states
  const [refPoint, setRefPoint] = useState<RefPointIndex>(4);
  const [constrainProportions, setConstrainProportions] = useState<boolean>(true);
  const [scaleCorners, setScaleCorners] = useState<boolean>(true);
  const [scaleStrokesAndEffects, setScaleStrokesAndEffects] = useState<boolean>(true);
  const [transformObjects, setTransformObjects] = useState<boolean>(true);
  const [transformPatterns, setTransformPatterns] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const selectedNodes: VectorNode[] = useMemo(
    () => selectedIds.map((id) => nodesMap[id]).filter(Boolean),
    [selectedIds, nodesMap]
  );
  const primaryNode: VectorNode | null = selectedNodes[0] || null;
  const activeArtboard: ArtboardItem = useMemo(() => {
    const list: ArtboardItem[] = doc.artboards || [];
    return list.find((a) => a.id === doc.activeArtboardId) || list[0] || {
      id: 'ab-1',
      name: 'Artboard 1',
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      orientation: 'landscape',
      showCenterMark: false,
      showCrossHairs: false,
      showVideoSafeAreas: false,
    };
  }, [doc.artboards, doc.activeArtboardId]);

  const selectionBounds = useMemo(() => {
    if (selectedNodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0, rotation: 0, skewX: 0 };
    }
    if (selectedNodes.length === 1 && primaryNode) {
      return {
        x: primaryNode.x,
        y: primaryNode.y,
        width: primaryNode.width,
        height: primaryNode.height,
        rotation: primaryNode.rotation || 0,
        skewX: primaryNode.skewX || 0,
      };
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    selectedNodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      rotation: primaryNode?.rotation || 0,
      skewX: primaryNode?.skewX || 0,
    };
  }, [selectedNodes, primaryNode]);

  const refOffset = REF_OFFSETS[refPoint];
  const displayedX = selectionBounds.x + selectionBounds.width * refOffset.rx;
  const displayedY = selectionBounds.y + selectionBounds.height * refOffset.ry;

  const updateDocument = (updater: (d: any, s: any) => void, label = 'Pathfinder / Transform') => {
    if (typeof store.pushHistory === 'function') {
      store.pushHistory(label);
    } else if (typeof store.recordHistory === 'function') {
      store.recordHistory(label);
    }
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      updater(d, next);
      return next;
    });
  };

  // ============================================================================
  // PATHFINDER OPERATIONS (Shape Modes with Alt Compound Shape + Pathfinders)
  // ============================================================================
  const handlePathfinderClick = (op: PathfinderOp, e: React.MouseEvent) => {
    const isAltCompound =
      e.altKey &&
      (op === 'unite' || op === 'minus-front' || op === 'intersect' || op === 'exclude');

    if (selectedNodes.length < 2) {
      setStatusNote('Select at least 2 overlapping objects to apply Pathfinder.');
      setTimeout(() => setStatusNote(null), 2600);
      return;
    }

    if (typeof store.runPathfinder === 'function' && !isAltCompound) {
      store.runPathfinder(op, false);
      return;
    }

    if (isAltCompound) {
      // Non-Destructive Compound Shape!
      const compoundId = `compound-shape-${Date.now()}`;
      const top = selectedNodes[selectedNodes.length - 1];
      updateDocument((d, s) => {
        const compoundNode: VectorNode = {
          id: compoundId,
          name: `<Compound Shape> (${op})`,
          type: 'compound-shape',
          layerId: top.layerId,
          visible: true,
          locked: false,
          x: selectionBounds.x,
          y: selectionBounds.y,
          width: selectionBounds.width,
          height: selectionBounds.height,
          rotation: 0,
          points: top.points || [],
          closed: true,
          fills: JSON.parse(JSON.stringify(top.fills || [])),
          strokes: JSON.parse(JSON.stringify(top.strokes || [])),
          effects: [],
          opacity: top.opacity ?? 1,
          blendMode: top.blendMode ?? 'normal',
          compoundMode: op,
          children: [...selectedIds],
        };
        selectedIds.forEach((cid) => {
          if (d.nodes[cid]) d.nodes[cid].parentId = compoundId;
        });
        d.nodes[compoundId] = compoundNode;
        const layer = (d.layers || []).find((l: any) => l.id === top.layerId);
        if (layer && Array.isArray(layer.nodeIds)) {
          layer.nodeIds = [
            compoundId,
            ...layer.nodeIds.filter((id: string) => !selectedIds.includes(id)),
          ];
        }
        s.selectedIds = [compoundId];
        s.selectedNodeIds = [compoundId];
      }, `Create Compound Shape (${op})`);
      setStatusNote(`Created Non-Destructive Compound Shape (${op}). Click Expand to commit.`);
      setTimeout(() => setStatusNote(null), 3000);
      return;
    }

    // Destructive Boolean Pathfinder
    const resultNodes = performPathfinder(selectedNodes, op);
    if (!resultNodes || resultNodes.length === 0) {
      setStatusNote('Pathfinder operation produced an empty intersection.');
      setTimeout(() => setStatusNote(null), 2500);
      return;
    }

    updateDocument((d, s) => {
      const targetLayerId = selectedNodes[selectedNodes.length - 1].layerId;
      selectedIds.forEach((id) => {
        delete d.nodes[id];
      });
      const newIds: string[] = [];
      resultNodes.forEach((rn) => {
        rn.layerId = targetLayerId;
        d.nodes[rn.id] = rn;
        newIds.push(rn.id);
      });
      const layer = (d.layers || []).find((l: any) => l.id === targetLayerId);
      if (layer && Array.isArray(layer.nodeIds)) {
        layer.nodeIds = [
          ...newIds,
          ...layer.nodeIds.filter((id: string) => !selectedIds.includes(id)),
        ];
      }
      s.selectedIds = newIds;
      s.selectedNodeIds = newIds;
    }, `Pathfinder: ${op}`);
  };

  const handleExpandCompoundShape = () => {
    if (!primaryNode) return;
    if (primaryNode.type === 'compound-shape' && primaryNode.children?.length) {
      const childNodes = primaryNode.children
        .map((cid) => nodesMap[cid])
        .filter((n): n is VectorNode => Boolean(n));
      const mode = primaryNode.compoundMode || 'unite';
      const baked = performPathfinder(childNodes, mode);
      if (baked.length > 0) {
        updateDocument((d, s) => {
          primaryNode.children?.forEach((cid) => delete d.nodes[cid]);
          delete d.nodes[primaryNode.id];
          const bakedNode = baked[0];
          bakedNode.layerId = primaryNode.layerId;
          d.nodes[bakedNode.id] = bakedNode;
          const layer = (d.layers || []).find((l: any) => l.id === primaryNode.layerId);
          if (layer && Array.isArray(layer.nodeIds)) {
            layer.nodeIds = layer.nodeIds.map((id: string) =>
              id === primaryNode.id ? bakedNode.id : id
            );
          }
          s.selectedIds = [bakedNode.id];
          s.selectedNodeIds = [bakedNode.id];
        }, 'Expand Compound Shape');
        setStatusNote('Compound Shape expanded into permanent Bezier path.');
        setTimeout(() => setStatusNote(null), 2400);
      }
    }
  };

  // ============================================================================
  // ALIGN & DISTRIBUTE OPERATIONS
  // ============================================================================
  const handleAlign = (op: AlignOp) => {
    if (selectedNodes.length === 0) return;
    if (typeof store.alignSelected === 'function' && op !== 'spacing-h' && op !== 'spacing-v') {
      store.alignSelected(op, alignTarget, keyObjectId);
      return;
    }

    updateDocument((d) => {
      const nodes = selectedIds.map((id) => d.nodes[id]).filter(Boolean) as VectorNode[];
      if (nodes.length === 0) return;

      let refBox = {
        x: selectionBounds.x,
        y: selectionBounds.y,
        width: selectionBounds.width,
        height: selectionBounds.height,
      };

      if (alignTarget === 'artboard' || (nodes.length === 1 && alignTarget === 'selection')) {
        refBox = {
          x: activeArtboard.x,
          y: activeArtboard.y,
          width: activeArtboard.width,
          height: activeArtboard.height,
        };
      } else if (alignTarget === 'key-object') {
        const keyNode = nodes.find((n) => n.id === keyObjectId) || nodes[0];
        refBox = {
          x: keyNode.x,
          y: keyNode.y,
          width: keyNode.width,
          height: keyNode.height,
        };
      }

      const translateNode = (node: VectorNode, dx: number, dy: number) => {
        node.x += dx;
        node.y += dy;
        if (Array.isArray(node.points)) {
          node.points.forEach((pt) => {
            pt.x += dx;
            pt.y += dy;
            if (pt.handleIn) {
              pt.handleIn.x += dx;
              pt.handleIn.y += dy;
            }
            if (pt.handleOut) {
              pt.handleOut.x += dx;
              pt.handleOut.y += dy;
            }
          });
        }
      };

      switch (op) {
        case 'left':
          nodes.forEach((n) => translateNode(n, refBox.x - n.x, 0));
          break;
        case 'center-h':
          nodes.forEach((n) =>
            translateNode(n, refBox.x + refBox.width / 2 - (n.x + n.width / 2), 0)
          );
          break;
        case 'right':
          nodes.forEach((n) =>
            translateNode(n, refBox.x + refBox.width - (n.x + n.width), 0)
          );
          break;
        case 'top':
          nodes.forEach((n) => translateNode(n, 0, refBox.y - n.y));
          break;
        case 'center-v':
          nodes.forEach((n) =>
            translateNode(n, 0, refBox.y + refBox.height / 2 - (n.y + n.height / 2))
          );
          break;
        case 'bottom':
          nodes.forEach((n) =>
            translateNode(n, 0, refBox.y + refBox.height - (n.y + n.height))
          );
          break;
        case 'distribute-h': {
          if (nodes.length < 3) break;
          const sorted = [...nodes].sort((a, b) => a.x - b.x);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const span = last.x + last.width / 2 - (first.x + first.width / 2);
          const step = span / (sorted.length - 1);
          sorted.forEach((n, idx) => {
            const targetCenter = first.x + first.width / 2 + step * idx;
            translateNode(n, targetCenter - (n.x + n.width / 2), 0);
          });
          break;
        }
        case 'distribute-v': {
          if (nodes.length < 3) break;
          const sorted = [...nodes].sort((a, b) => a.y - b.y);
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          const span = last.y + last.height / 2 - (first.y + first.height / 2);
          const step = span / (sorted.length - 1);
          sorted.forEach((n, idx) => {
            const targetCenter = first.y + first.height / 2 + step * idx;
            translateNode(n, 0, targetCenter - (n.y + n.height / 2));
          });
          break;
        }
        case 'spacing-h': {
          if (nodes.length < 2) break;
          const sorted = [...nodes].sort((a, b) => a.x - b.x);
          let cursorX = sorted[0].x + sorted[0].width + distributeSpacingVal;
          for (let i = 1; i < sorted.length; i++) {
            translateNode(sorted[i], cursorX - sorted[i].x, 0);
            cursorX = sorted[i].x + sorted[i].width + distributeSpacingVal;
          }
          break;
        }
        case 'spacing-v': {
          if (nodes.length < 2) break;
          const sorted = [...nodes].sort((a, b) => a.y - b.y);
          let cursorY = sorted[0].y + sorted[0].height + distributeSpacingVal;
          for (let i = 1; i < sorted.length; i++) {
            translateNode(sorted[i], 0, cursorY - sorted[i].y);
            cursorY = sorted[i].y + sorted[i].height + distributeSpacingVal;
          }
          break;
        }
      }
    }, `Align: ${op}`);
  };

  // ============================================================================
  // TRANSFORM OPERATIONS (9-Point Reference Grid, Constrain W/H, Scale Strokes)
  // ============================================================================
  const applyTransformChange = (
    field: 'x' | 'y' | 'w' | 'h' | 'rotation' | 'skewX',
    newVal: number
  ) => {
    if (selectedNodes.length === 0) return;

    updateDocument((d) => {
      const nodes = selectedIds.map((id) => d.nodes[id]).filter(Boolean) as VectorNode[];
      if (nodes.length === 0) return;

      if (field === 'x' || field === 'y') {
        const dx = field === 'x' ? newVal - displayedX : 0;
        const dy = field === 'y' ? newVal - displayedY : 0;
        nodes.forEach((n) => {
          n.x += dx;
          n.y += dy;
          (n.points || []).forEach((pt) => {
            pt.x += dx;
            pt.y += dy;
            if (pt.handleIn) {
              pt.handleIn.x += dx;
              pt.handleIn.y += dy;
            }
            if (pt.handleOut) {
              pt.handleOut.x += dx;
              pt.handleOut.y += dy;
            }
          });
        });
        return;
      }

      if (field === 'w' || field === 'h') {
        const safeNew = Math.max(1, newVal);
        const oldW = Math.max(1, selectionBounds.width);
        const oldH = Math.max(1, selectionBounds.height);
        let sx = field === 'w' ? safeNew / oldW : 1;
        let sy = field === 'h' ? safeNew / oldH : 1;
        if (constrainProportions) {
          if (field === 'w') sy = sx;
          else sx = sy;
        }
        const anchorX = selectionBounds.x + oldW * refOffset.rx;
        const anchorY = selectionBounds.y + oldH * refOffset.ry;

        nodes.forEach((n) => {
          if (transformObjects) {
            n.x = anchorX + (n.x - anchorX) * sx;
            n.y = anchorY + (n.y - anchorY) * sy;
            n.width = Math.max(1, n.width * sx);
            n.height = Math.max(1, n.height * sy);
            (n.points || []).forEach((pt) => {
              pt.x = anchorX + (pt.x - anchorX) * sx;
              pt.y = anchorY + (pt.y - anchorY) * sy;
              if (pt.handleIn) {
                pt.handleIn.x = anchorX + (pt.handleIn.x - anchorX) * sx;
                pt.handleIn.y = anchorY + (pt.handleIn.y - anchorY) * sy;
              }
              if (pt.handleOut) {
                pt.handleOut.x = anchorX + (pt.handleOut.x - anchorX) * sx;
                pt.handleOut.y = anchorY + (pt.handleOut.y - anchorY) * sy;
              }
              if (scaleCorners && pt.cornerRadius) {
                pt.cornerRadius = pt.cornerRadius * ((sx + sy) / 2);
              }
            });
            if (scaleCorners && n.cornerRadius) {
              n.cornerRadius = n.cornerRadius * ((sx + sy) / 2);
            }
            if (scaleStrokesAndEffects) {
              const factor = (sx + sy) / 2;
              (n.strokes || []).forEach((s) => {
                s.weight = Math.max(0.1, Math.round(s.weight * factor * 100) / 100);
              });
            }
          }
        });
        return;
      }

      if (field === 'rotation') {
        nodes.forEach((n) => {
          n.rotation = newVal;
        });
      } else if (field === 'skewX') {
        nodes.forEach((n) => {
          n.skewX = newVal;
        });
      }
    }, `Transform ${field.toUpperCase()}`);
  };

  const handleFlip = (axis: 'h' | 'v') => {
    if (selectedNodes.length === 0) return;
    const cx = selectionBounds.x + selectionBounds.width / 2;
    const cy = selectionBounds.y + selectionBounds.height / 2;
    updateDocument((d) => {
      selectedIds.forEach((id) => {
        const n = d.nodes[id] as VectorNode | undefined;
        if (!n) return;
        if (axis === 'h') {
          n.x = 2 * cx - (n.x + n.width);
          (n.points || []).forEach((pt) => {
            pt.x = 2 * cx - pt.x;
            if (pt.handleIn) pt.handleIn.x = 2 * cx - pt.handleIn.x;
            if (pt.handleOut) pt.handleOut.x = 2 * cx - pt.handleOut.x;
          });
        } else {
          n.y = 2 * cy - (n.y + n.height);
          (n.points || []).forEach((pt) => {
            pt.y = 2 * cy - pt.y;
            if (pt.handleIn) pt.handleIn.y = 2 * cy - pt.handleIn.y;
            if (pt.handleOut) pt.handleOut.y = 2 * cy - pt.handleOut.y;
          });
        }
      });
    }, axis === 'h' ? 'Flip Horizontal' : 'Flip Vertical');
  };

  return (
    <div className="flex flex-col h-full bg-[#323232] text-[#e8e8e8] select-none text-[11px]">
      {/* Sub-Tabs: Pathfinder | Align | Transform */}
      {showTabs && (
      <div className="flex items-center bg-[#262626] border-b border-[#1a1a1a]">
        {(['pathfinder', 'align', 'transform'] as const).map((tab) => (
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
      )}

      {/* TAB 1: PATHFINDER (Shift+Ctrl+F9) */}
      {activeTab === 'pathfinder' && (
        <div className="p-2.5 space-y-3 overflow-y-auto flex-1">
          {/* Row 1: Shape Modes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-[#b0b0b0] font-semibold">
                Shape Modes <span className="font-normal text-[#888]">(Alt+Click = Compound Shape)</span>
              </span>
              <button
                onClick={handleExpandCompoundShape}
                disabled={!primaryNode || primaryNode.type !== 'compound-shape'}
                className="px-2 py-0.5 rounded bg-[#3f3f3f] hover:bg-[#1473e6] disabled:opacity-40 text-[10px] font-medium"
                title="Expand Compound Shape into permanent Bezier vector path"
              >
                Expand
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { op: 'unite' as PathfinderOp, label: 'Unite', icon: '⊞' },
                { op: 'minus-front' as PathfinderOp, label: 'Minus Front', icon: '⊟' },
                { op: 'intersect' as PathfinderOp, label: 'Intersect', icon: '⊡' },
                { op: 'exclude' as PathfinderOp, label: 'Exclude', icon: '⊠' },
              ].map((item) => (
                <button
                  key={item.op}
                  onClick={(e) => handlePathfinderClick(item.op, e)}
                  title={`${item.label} (Hold Alt for Non-Destructive Compound Shape)`}
                  className="flex flex-col items-center justify-center py-2 px-1 rounded bg-[#292929] hover:bg-[#1473e6] border border-[#1a1a1a] transition-colors group"
                >
                  <svg width="20" height="20" viewBox="0 0 22 22" className="mb-1">
                    {item.op === 'unite' && (
                      <>
                        <rect x="3" y="3" width="11" height="11" fill="currentColor" opacity="0.85" />
                        <rect x="8" y="8" width="11" height="11" fill="currentColor" opacity="0.85" />
                      </>
                    )}
                    {item.op === 'minus-front' && (
                      <>
                        <rect x="3" y="3" width="11" height="11" fill="currentColor" />
                        <rect
                          x="8"
                          y="8"
                          width="11"
                          height="11"
                          fill="#292929"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                      </>
                    )}
                    {item.op === 'intersect' && (
                      <>
                        <rect
                          x="3"
                          y="3"
                          width="11"
                          height="11"
                          fill="none"
                          stroke="currentColor"
                          strokeDasharray="2 1"
                        />
                        <rect
                          x="8"
                          y="8"
                          width="11"
                          height="11"
                          fill="none"
                          stroke="currentColor"
                          strokeDasharray="2 1"
                        />
                        <rect x="8" y="8" width="6" height="6" fill="currentColor" />
                      </>
                    )}
                    {item.op === 'exclude' && (
                      <>
                        <rect x="3" y="3" width="11" height="11" fill="currentColor" />
                        <rect x="8" y="8" width="11" height="11" fill="currentColor" />
                        <rect x="8" y="8" width="6" height="6" fill="#292929" />
                      </>
                    )}
                  </svg>
                  <span className="text-[9px] text-[#cfcfcf] group-hover:text-white">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#222222]" />

          {/* Row 2: Pathfinders */}
          <div>
            <span className="block text-[10px] text-[#b0b0b0] font-semibold mb-1.5">
              Pathfinders:
            </span>
            <div className="grid grid-cols-6 gap-1">
              {[
                { op: 'divide' as PathfinderOp, label: 'Divide' },
                { op: 'trim' as PathfinderOp, label: 'Trim' },
                { op: 'merge' as PathfinderOp, label: 'Merge' },
                { op: 'crop' as PathfinderOp, label: 'Crop' },
                { op: 'outline' as PathfinderOp, label: 'Outline' },
                { op: 'minus-back' as PathfinderOp, label: 'Minus Back' },
              ].map((item) => (
                <button
                  key={item.op}
                  onClick={(e) => handlePathfinderClick(item.op, e)}
                  title={item.label}
                  className="flex flex-col items-center justify-center py-1.5 px-0.5 rounded bg-[#292929] hover:bg-[#1473e6] border border-[#1a1a1a] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" className="mb-0.5">
                    <rect
                      x="2"
                      y="2"
                      width="9"
                      height="9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                    <rect
                      x="7"
                      y="7"
                      width="9"
                      height="9"
                      fill="currentColor"
                      fillOpacity={item.op === 'outline' ? 0 : 0.45}
                      stroke="currentColor"
                      strokeWidth="1.3"
                    />
                  </svg>
                  <span className="text-[8px] truncate w-full text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#222222]" />

          {/* Quick Path Geometry Actions */}
          <div>
            <span className="block text-[10px] text-[#b0b0b0] font-semibold mb-1.5">
              Path Operations:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                disabled={!primaryNode}
                onClick={() => {
                  if (!primaryNode) return;
                  const offNode = offsetVectorNode(primaryNode, 8, 'miter', 4);
                  updateDocument((d, s) => {
                    d.nodes[offNode.id] = offNode;
                    const layer = (d.layers || []).find((l: any) => l.id === primaryNode.layerId);
                    if (layer?.nodeIds) layer.nodeIds.unshift(offNode.id);
                    s.selectedIds = [offNode.id];
                  }, 'Offset Path (+8pt)');
                }}
                className="ai-btn text-[10px]"
                title="Create an outward 8pt Offset Path from selection"
              >
                Offset Path
              </button>
              <button
                disabled={!primaryNode}
                onClick={() => {
                  if (!primaryNode) return;
                  const outNode = outlineStrokeNode(primaryNode);
                  updateDocument((d, s) => {
                    d.nodes[outNode.id] = outNode;
                    delete d.nodes[primaryNode.id];
                    const layer = (d.layers || []).find((l: any) => l.id === primaryNode.layerId);
                    if (layer?.nodeIds) {
                      layer.nodeIds = layer.nodeIds.map((id: string) =>
                        id === primaryNode.id ? outNode.id : id
                      );
                    }
                    s.selectedIds = [outNode.id];
                  }, 'Outline Stroke');
                }}
                className="ai-btn text-[10px]"
                title="Convert Stroke into Closed Filled Vector Shape"
              >
                Outline Stroke
              </button>
              <button
                disabled={!primaryNode}
                onClick={() => {
                  if (!primaryNode || !primaryNode.points?.length) return;
                  const simplified = simplifyPathPoints(
                    primaryNode.points,
                    primaryNode.closed,
                    75,
                    35
                  );
                  updateDocument((d) => {
                    if (d.nodes[primaryNode.id]) {
                      d.nodes[primaryNode.id].points = simplified;
                    }
                  }, 'Simplify Path');
                }}
                className="ai-btn text-[10px]"
                title="Simplify Anchor Points while preserving Bezier curve fidelity"
              >
                Simplify Path
              </button>
            </div>
          </div>

          {statusNote && (
            <div className="px-2 py-1.5 rounded bg-[#1473e6]/25 border border-[#1473e6] text-[10px] text-white">
              {statusNote}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALIGN (Shift+F7) */}
      {activeTab === 'align' && (
        <div className="p-2.5 space-y-3 overflow-y-auto flex-1">
          {/* Align Objects */}
          <div>
            <span className="block text-[10px] text-[#b0b0b0] font-semibold mb-1.5">
              Align Objects:
            </span>
            <div className="grid grid-cols-6 gap-1">
              {[
                { op: 'left' as AlignOp, title: 'Horizontal Align Left', sym: '⫷' },
                { op: 'center-h' as AlignOp, title: 'Horizontal Align Center', sym: '⫿' },
                { op: 'right' as AlignOp, title: 'Horizontal Align Right', sym: '⫸' },
                { op: 'top' as AlignOp, title: 'Vertical Align Top', sym: '⊤' },
                { op: 'center-v' as AlignOp, title: 'Vertical Align Center', sym: '⊶' },
                { op: 'bottom' as AlignOp, title: 'Vertical Align Bottom', sym: '⊥' },
              ].map((btn) => (
                <button
                  key={btn.op}
                  onClick={() => handleAlign(btn.op)}
                  disabled={selectedNodes.length === 0}
                  title={btn.title}
                  className="h-7 rounded bg-[#292929] hover:bg-[#1473e6] disabled:opacity-40 border border-[#1a1a1a] flex items-center justify-center text-[13px]"
                >
                  {btn.sym}
                </button>
              ))}
            </div>
          </div>

          {/* Distribute Objects */}
          <div>
            <span className="block text-[10px] text-[#b0b0b0] font-semibold mb-1.5">
              Distribute Objects:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleAlign('distribute-h')}
                disabled={selectedNodes.length < 3}
                className="ai-btn text-[10px]"
                title="Horizontal Distribute Center"
              >
                Distribute Horizontally
              </button>
              <button
                onClick={() => handleAlign('distribute-v')}
                disabled={selectedNodes.length < 3}
                className="ai-btn text-[10px]"
                title="Vertical Distribute Center"
              >
                Distribute Vertically
              </button>
            </div>
          </div>

          <div className="border-t border-[#222222]" />

          {/* Distribute Spacing + Align To Selector */}
          <div className="grid grid-cols-2 gap-2 items-end">
            <div className="space-y-1">
              <span className="block text-[10px] text-[#b0b0b0] font-semibold">
                Distribute Spacing:
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAlign('spacing-v')}
                  disabled={selectedNodes.length < 2}
                  title="Vertical Distribute Space"
                  className="ai-btn px-2"
                >
                  ↕
                </button>
                <button
                  onClick={() => handleAlign('spacing-h')}
                  disabled={selectedNodes.length < 2}
                  title="Horizontal Distribute Space"
                  className="ai-btn px-2"
                >
                  ↔
                </button>
                <NumericScrubInput
                  value={distributeSpacingVal}
                  onChange={setDistributeSpacingVal}
                  unit={unit}
                  width={54}
                  compact
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="block text-[10px] text-[#b0b0b0] font-semibold">Align To:</span>
              <select
                value={alignTarget}
                onChange={(e) => {
                  const nextTarget = e.target.value as AlignTarget;
                  setAlignTarget(nextTarget);
                  if (nextTarget === 'key-object' && !keyObjectId && selectedIds[0]) {
                    setKeyObjectId(selectedIds[0]);
                  }
                }}
                className="ai-select w-full text-[10px]"
              >
                <option value="selection">Align to Selection</option>
                <option value="key-object">Align to Key Object</option>
                <option value="artboard">Align to Artboard</option>
              </select>
            </div>
          </div>

          {alignTarget === 'key-object' && selectedNodes.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#ff9a00]">Key Object:</span>
              <select
                value={keyObjectId || selectedNodes[0].id}
                onChange={(e) => setKeyObjectId(e.target.value)}
                className="ai-select text-[10px] w-36"
              >
                {selectedNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name || n.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRANSFORM */}
      {activeTab === 'transform' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          <div className="flex items-center gap-3">
            {/* 9-Point Reference Point Locator Grid */}
            <div
              className="grid grid-cols-3 gap-1 p-1 bg-[#262626] border border-[#1a1a1a] rounded shrink-0"
              title="9-Point Transform Reference Origin"
            >
              {REF_OFFSETS.map((pt, idx) => (
                <button
                  key={pt.label}
                  onClick={() => setRefPoint(idx as RefPointIndex)}
                  title={pt.label}
                  className={`w-2.5 h-2.5 rounded-[1px] border ${
                    refPoint === idx
                      ? 'bg-[#1473e6] border-white scale-110'
                      : 'bg-[#3f3f3f] border-[#666] hover:border-white'
                  }`}
                />
              ))}
            </div>

            {/* X, Y, W, H + Constrain Proportions Link */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 flex-1">
              <NumericScrubInput
                label="X:"
                value={displayedX}
                unit={unit}
                width={58}
                disabled={selectedNodes.length === 0}
                onChange={(v) => applyTransformChange('x', v)}
              />
              <div className="flex items-center gap-1">
                <NumericScrubInput
                  label="W:"
                  value={selectionBounds.width}
                  unit={unit}
                  min={1}
                  width={54}
                  disabled={selectedNodes.length === 0}
                  onChange={(v) => applyTransformChange('w', v)}
                />
                <button
                  onClick={() => setConstrainProportions((v) => !v)}
                  title="Constrain Width and Height Proportions"
                  className={`p-0.5 rounded ${
                    constrainProportions ? 'text-[#1473e6]' : 'text-[#777]'
                  }`}
                >
                  {constrainProportions ? <Link2 size={12} /> : <Unlink2 size={12} />}
                </button>
              </div>

              <NumericScrubInput
                label="Y:"
                value={displayedY}
                unit={unit}
                width={58}
                disabled={selectedNodes.length === 0}
                onChange={(v) => applyTransformChange('y', v)}
              />
              <NumericScrubInput
                label="H:"
                value={selectionBounds.height}
                unit={unit}
                min={1}
                width={54}
                disabled={selectedNodes.length === 0}
                onChange={(v) => applyTransformChange('h', v)}
              />
            </div>
          </div>

          {/* Rotation, Shear & Flip */}
          <div className="flex items-center justify-between pt-1 border-t border-[#222222]">
            <AngleDial
              label="∠"
              angle={selectionBounds.rotation}
              size={22}
              disabled={selectedNodes.length === 0}
              onChange={(deg) => applyTransformChange('rotation', deg)}
            />
            <NumericScrubInput
              label="Shear:"
              value={selectionBounds.skewX}
              suffix="°"
              min={-85}
              max={85}
              width={46}
              disabled={selectedNodes.length === 0}
              onChange={(sk) => applyTransformChange('skewX', sk)}
            />
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleFlip('h')}
                disabled={selectedNodes.length === 0}
                title="Flip Along Horizontal Axis"
                className="ai-icon-btn"
              >
                <FlipHorizontal size={13} />
              </button>
              <button
                onClick={() => handleFlip('v')}
                disabled={selectedNodes.length === 0}
                title="Flip Along Vertical Axis"
                className="ai-icon-btn"
              >
                <FlipVertical size={13} />
              </button>
            </div>
          </div>

          {/* Live Shape Properties (Corner Radius & Type) */}
          {primaryNode && (
            <div className="flex items-center justify-between pt-1.5 border-t border-[#222222]">
              <span className="text-[10px] text-[#b0b0b0]">Live Corners:</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={primaryNode.cornerType || 'round'}
                  onChange={(e) =>
                    updateDocument((d) => {
                      selectedIds.forEach((id) => {
                        if (d.nodes[id]) d.nodes[id].cornerType = e.target.value;
                      });
                    }, 'Change Corner Type')
                  }
                  className="ai-select text-[10px]"
                >
                  <option value="round">Round</option>
                  <option value="inverted">Inverted Round</option>
                  <option value="chamfer">Chamfer</option>
                </select>
                <NumericScrubInput
                  value={primaryNode.cornerRadius || 0}
                  unit={unit}
                  min={0}
                  max={500}
                  width={48}
                  compact
                  onChange={(r) =>
                    updateDocument((d) => {
                      selectedIds.forEach((id) => {
                        if (d.nodes[id]) d.nodes[id].cornerRadius = r;
                      });
                    }, 'Change Corner Radius')
                  }
                />
              </div>
            </div>
          )}

          {/* Checkboxes: Scale Corners, Scale Strokes & Effects, Transform Objects/Patterns */}
          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#222222] text-[10px] text-[#cfcfcf]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={scaleCorners}
                onChange={(e) => setScaleCorners(e.target.checked)}
              />
              <span>Scale Corners</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={scaleStrokesAndEffects}
                onChange={(e) => setScaleStrokesAndEffects(e.target.checked)}
              />
              <span>Scale Strokes & Effects</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={transformObjects}
                onChange={(e) => setTransformObjects(e.target.checked)}
              />
              <span>Transform Objects</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={transformPatterns}
                onChange={(e) => setTransformPatterns(e.target.checked)}
              />
              <span>Transform Patterns</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default PathfinderAlignPanel;
