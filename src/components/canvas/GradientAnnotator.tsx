import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import type { FillItem, FreeformStop, GradientDef, GradientStop, VectorNode } from '../../core/types';

export interface GradientAnnotatorProps {
  panX?: number;
  panY?: number;
  zoom?: number;
}

const DEFAULT_GRADIENT: GradientDef = {
  id: 'grad-annotator-default',
  name: 'Linear Gradient',
  type: 'linear',
  angle: 0,
  aspectRatio: 1,
  stops: [
    { id: 'st-1', offset: 0, color: '#1473e6', opacity: 1, midpoint: 0.5 },
    { id: 'st-2', offset: 1, color: '#ff9a00', opacity: 1, midpoint: 0.5 },
  ],
};

export const GradientAnnotator: React.FC<GradientAnnotatorProps> = ({
  panX: propPanX,
  panY: propPanY,
  zoom: propZoom,
}) => {
  const store = useStudioStore() as any;
  const activeTool: string = store.activeTool || 'select';
  const doc = store.document || store.activeDocument || store.getActiveDocument?.() || {};
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || store.selectedObjectIds || [];

  const panX: number = propPanX ?? store.panX ?? store.viewport?.panX ?? 120;
  const panY: number = propPanY ?? store.panY ?? store.viewport?.panY ?? 80;
  const zoom: number = propZoom ?? store.zoom ?? store.viewport?.zoom ?? 1;

  const selectedNode: VectorNode | null =
    selectedIds.length > 0 ? nodesMap[selectedIds[0]] || null : null;

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [draggingMode, setDraggingMode] = useState<
    | null
    | { type: 'stop'; stopId: string }
    | { type: 'midpoint'; stopIndex: number }
    | { type: 'angle' }
    | { type: 'aspect' }
    | { type: 'freeform'; pointId: string }
  >(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const activeGradientFill: FillItem | undefined = selectedNode?.fills?.find(
    (f) => f.visible && f.type === 'gradient' && f.gradient
  );

  const gradient: GradientDef = activeGradientFill?.gradient || DEFAULT_GRADIENT;

  const updateNodeGradient = useCallback(
    (updater: (grad: GradientDef) => GradientDef) => {
      if (!selectedNode) return;
      const nextGrad = updater(
        structuredClone ? structuredClone(gradient) : JSON.parse(JSON.stringify(gradient))
      );

      if (typeof store.updateNode === 'function') {
        const existingFills: FillItem[] = selectedNode.fills?.length
          ? selectedNode.fills.map((f) => ({ ...f }))
          : [
              {
                id: `fill-${Date.now()}`,
                visible: true,
                type: 'gradient',
                color: '#1473e6',
                gradient: nextGrad,
                opacity: 1,
                blendMode: 'normal',
              },
            ];
        const gradIdx = existingFills.findIndex((f) => f.type === 'gradient');
        if (gradIdx >= 0) {
          existingFills[gradIdx] = {
            ...existingFills[gradIdx],
            type: 'gradient',
            gradient: nextGrad,
          };
        } else {
          existingFills[0] = {
            ...existingFills[0],
            type: 'gradient',
            gradient: nextGrad,
          };
        }
        store.updateNode(selectedNode.id, { fills: existingFills });
        return;
      }

      useStudioStore.setState((s: any) => {
        const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
        const targetDoc = next.document || next.activeDocument;
        const targetNode: VectorNode | undefined = targetDoc?.nodes?.[selectedNode.id];
        if (!targetNode) return next;
        if (!targetNode.fills || targetNode.fills.length === 0) {
          targetNode.fills = [
            {
              id: `fill-${Date.now()}`,
              visible: true,
              type: 'gradient',
              color: '#1473e6',
              gradient: nextGrad,
              opacity: 1,
              blendMode: 'normal',
            },
          ];
        } else {
          const idx = targetNode.fills.findIndex((f) => f.type === 'gradient');
          if (idx >= 0) {
            targetNode.fills[idx].gradient = nextGrad;
          } else {
            targetNode.fills[0].type = 'gradient';
            targetNode.fills[0].gradient = nextGrad;
          }
        }
        return next;
      });
    },
    [selectedNode, gradient, store]
  );

  // Compute screen coordinates of the gradient annotator spine
  const cx = selectedNode ? (selectedNode.x + selectedNode.width / 2) * zoom + panX : 0;
  const cy = selectedNode ? (selectedNode.y + selectedNode.height / 2) * zoom + panY : 0;
  const halfLen = selectedNode
    ? Math.max(45, (Math.min(selectedNode.width, selectedNode.height) * 0.42 + 20) * zoom)
    : 80;
  const rad = ((gradient.angle || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const startX = gradient.type === 'radial' ? cx : cx - cos * halfLen;
  const startY = gradient.type === 'radial' ? cy : cy - sin * halfLen;
  const endX = cx + cos * halfLen;
  const endY = cy + sin * halfLen;
  const spineLen = Math.hypot(endX - startX, endY - startY) || 1;

  useEffect(() => {
    if (!draggingMode || !selectedNode) return;
    let hasMoved = false;

    const handleMove = (e: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (!hasMoved) {
        hasMoved = true;
        useStudioStore.getState().beginTransaction('Adjust Gradient');
      }
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (draggingMode.type === 'angle') {
        const rawDeg = (Math.atan2(sy - cy, sx - cx) * 180) / Math.PI;
        const snapped = e.shiftKey ? Math.round(rawDeg / 15) * 15 : Math.round(rawDeg * 10) / 10;
        updateNodeGradient((g) => ({ ...g, angle: snapped }));
      } else if (draggingMode.type === 'aspect') {
        const dx = sx - cx;
        const dy = sy - cy;
        const perpDist = Math.abs(- dx * sin + dy * cos);
        const ratio = Math.max(0.15, Math.min(2.5, Math.round((perpDist / halfLen) * 100) / 100));
        updateNodeGradient((g) => ({ ...g, aspectRatio: ratio }));
      } else if (draggingMode.type === 'stop') {
        const vx = endX - startX;
        const vy = endY - startY;
        const proj = ((sx - startX) * vx + (sy - startY) * vy) / (spineLen * spineLen);
        const clamped = Math.max(0, Math.min(1, Math.round(proj * 1000) / 1000));
        updateNodeGradient((g) => ({
          ...g,
          stops: g.stops
            .map((st) => (st.id === draggingMode.stopId ? { ...st, offset: clamped } : st))
            .sort((a, b) => a.offset - b.offset),
        }));
      } else if (draggingMode.type === 'midpoint') {
        const sorted = [...gradient.stops].sort((a, b) => a.offset - b.offset);
        const stA = sorted[draggingMode.stopIndex];
        const stB = sorted[draggingMode.stopIndex + 1];
        if (!stA || !stB) return;
        const vx = endX - startX;
        const vy = endY - startY;
        const proj = ((sx - startX) * vx + (sy - startY) * vy) / (spineLen * spineLen);
        const span = Math.max(0.01, stB.offset - stA.offset);
        const mid = Math.max(0.13, Math.min(0.87, (proj - stA.offset) / span));
        updateNodeGradient((g) => ({
          ...g,
          stops: g.stops.map((st) =>
            st.id === stA.id ? { ...st, midpoint: Math.round(mid * 100) / 100 } : st
          ),
        }));
      } else if (draggingMode.type === 'freeform') {
        const canvasX = (sx - panX) / zoom;
        const canvasY = (sy - panY) / zoom;
        const nx = Math.max(
          0.02,
          Math.min(0.98, (canvasX - selectedNode.x) / Math.max(1, selectedNode.width))
        );
        const ny = Math.max(
          0.02,
          Math.min(0.98, (canvasY - selectedNode.y) / Math.max(1, selectedNode.height))
        );
        updateNodeGradient((g) => ({
          ...g,
          freeformPoints: (g.freeformPoints || []).map((fp) =>
            fp.id === draggingMode.pointId ? { ...fp, x: nx, y: ny } : fp
          ),
        }));
      }
    };

    const handleUp = () => {
      if (hasMoved) {
        useStudioStore.getState().commitTransaction('Adjust Gradient');
      }
      setDraggingMode(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [
    draggingMode,
    selectedNode,
    cx,
    cy,
    startX,
    startY,
    endX,
    endY,
    spineLen,
    sin,
    cos,
    halfLen,
    panX,
    panY,
    zoom,
    gradient.stops,
    updateNodeGradient,
  ]);

  if (activeTool !== 'gradient' || !selectedNode) {
    return null;
  }

  const sortedStops = [...(gradient.stops || DEFAULT_GRADIENT.stops)].sort(
    (a, b) => a.offset - b.offset
  );

  const handleBarDoubleClick = (e: React.MouseEvent<SVGLineElement>) => {
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vx = endX - startX;
    const vy = endY - startY;
    const proj = Math.max(
      0.02,
      Math.min(0.98, ((sx - startX) * vx + (sy - startY) * vy) / (spineLen * spineLen))
    );
    const newStop: GradientStop = {
      id: `st-${Date.now().toString(36)}`,
      offset: Math.round(proj * 100) / 100,
      color: '#ffffff',
      opacity: 1,
      midpoint: 0.5,
    };
    updateNodeGradient((g) => ({
      ...g,
      stops: [...g.stops, newStop].sort((a, b) => a.offset - b.offset),
    }));
    setSelectedStopId(newStop.id);
  };

  const activeStop = sortedStops.find((s) => s.id === selectedStopId) || sortedStops[0];

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      <svg ref={svgRef} width="100%" height="100%" className="block">
        <defs>
          <linearGradient id="annotator-ramp-preview" x1="0%" y1="0%" x2="100%" y2="0%">
            {sortedStops.map((st) => (
              <stop
                key={st.id}
                offset={`${st.offset * 100}%`}
                stopColor={st.color}
                stopOpacity={st.opacity}
              />
            ))}
          </linearGradient>
        </defs>

        {/* Freeform Gradient Mode Annotator */}
        {gradient.type === 'freeform' ? (
          <g>
            {(
              gradient.freeformPoints || [
                { id: 'fp-1', x: 0.25, y: 0.3, color: '#1473e6', opacity: 1, spread: 0.5 },
                { id: 'fp-2', x: 0.75, y: 0.7, color: '#ff9a00', opacity: 1, spread: 0.5 },
                { id: 'fp-3', x: 0.3, y: 0.78, color: '#2ecc71', opacity: 1, spread: 0.5 },
              ]
            ).map((fp: FreeformStop) => {
              const px = (selectedNode.x + fp.x * selectedNode.width) * zoom + panX;
              const py = (selectedNode.y + fp.y * selectedNode.height) * zoom + panY;
              const spreadR = Math.max(18, fp.spread * 55 * zoom);
              return (
                <g key={fp.id}>
                  <circle
                    cx={px}
                    cy={py}
                    r={spreadR}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.75}
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r={7}
                    fill={fp.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="pointer-events-auto cursor-move"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDraggingMode({ type: 'freeform', pointId: fp.id });
                    }}
                  />
                </g>
              );
            })}
          </g>
        ) : (
          <g>
            {/* Radial Gradient Ellipse Ring + Aspect Ratio Handle */}
            {gradient.type === 'radial' && (
              <g transform={`translate(${cx}, ${cy}) rotate(${gradient.angle || 0})`}>
                <ellipse
                  cx={0}
                  cy={0}
                  rx={halfLen}
                  ry={halfLen * (gradient.aspectRatio || 1)}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.85}
                />
                <circle
                  cx={0}
                  cy={-halfLen * (gradient.aspectRatio || 1)}
                  r={4.5}
                  fill="#1a1a1a"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  className="pointer-events-auto cursor-ns-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingMode({ type: 'aspect' });
                  }}
                >
                  <title>Drag to adjust Radial Gradient Aspect Ratio</title>
                </circle>
              </g>
            )}

            {/* Annotator Track Backdrop + Double-Click Zone */}
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#000000"
              strokeWidth={7}
              strokeLinecap="round"
              opacity={0.55}
            />
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#ffffff"
              strokeWidth={4}
              strokeLinecap="round"
              className="pointer-events-auto cursor-copy"
              onDoubleClick={handleBarDoubleClick}
            >
              <title>Double-click along gradient bar to add a new Color Stop</title>
            </line>

            {/* Midpoint Diamonds between stops */}
            {sortedStops.slice(0, -1).map((st, idx) => {
              const nextSt = sortedStops[idx + 1];
              const midRatio = st.midpoint ?? 0.5;
              const t = st.offset + (nextSt.offset - st.offset) * midRatio;
              const mx = startX + (endX - startX) * t - sin * 11;
              const my = startY + (endY - startY) * t + cos * 11;
              return (
                <polygon
                  key={`mid-${st.id}`}
                  points={`${mx},${my - 4.5} ${mx + 4.5},${my} ${mx},${my + 4.5} ${mx - 4.5},${my}`}
                  fill="#e8e8e8"
                  stroke="#1a1a1a"
                  strokeWidth={1}
                  className="pointer-events-auto cursor-ew-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDraggingMode({ type: 'midpoint', stopIndex: idx });
                  }}
                >
                  <title>Midpoint ({Math.round(midRatio * 100)}%) — Drag to shift color transition</title>
                </polygon>
              );
            })}

            {/* Color Stop Circles */}
            {sortedStops.map((st) => {
              const sx = startX + (endX - startX) * st.offset;
              const sy = startY + (endY - startY) * st.offset;
              const isSelected = st.id === (selectedStopId ?? sortedStops[0]?.id);
              return (
                <g
                  key={st.id}
                  transform={`translate(${sx}, ${sy})`}
                  className="pointer-events-auto cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (e.altKey && sortedStops.length > 2) {
                      updateNodeGradient((g) => ({
                        ...g,
                        stops: g.stops.filter((item) => item.id !== st.id),
                      }));
                      return;
                    }
                    setSelectedStopId(st.id);
                    setDraggingMode({ type: 'stop', stopId: st.id });
                  }}
                >
                  <title>
                    Color Stop ({Math.round(st.offset * 100)}%) — Drag to slide, Alt+Click to remove
                  </title>
                  <circle
                    r={isSelected ? 7.5 : 6}
                    fill={st.color}
                    stroke={isSelected ? '#1473e6' : '#ffffff'}
                    strokeWidth={isSelected ? 2.5 : 1.75}
                  />
                  <circle r={isSelected ? 8.5 : 7} fill="none" stroke="#111111" strokeWidth={0.8} />
                </g>
              );
            })}

            {/* Rotation / End Handle */}
            <g
              transform={`translate(${endX + cos * 14}, ${endY + sin * 14})`}
              className="pointer-events-auto cursor-grab"
              onPointerDown={(e) => {
                e.stopPropagation();
                setDraggingMode({ type: 'angle' });
              }}
            >
              <title>Drag to rotate Gradient Angle ({gradient.angle}°). Hold Shift to snap 15°.</title>
              <rect
                x={-5}
                y={-5}
                width={10}
                height={10}
                rx={2}
                fill="#1473e6"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          </g>
        )}
      </svg>

      {/* Floating Mini HUD for Active Gradient Stop & Type Switcher */}
      <div
        style={{
          left: Math.max(32, Math.min(window.innerWidth - 340, cx - 135)),
          top: Math.max(32, cy + halfLen + 22),
        }}
        className="pointer-events-auto absolute flex items-center gap-2 bg-[#262626]/95 border border-[#454545] rounded px-2.5 py-1 shadow-xl text-[11px] text-[#e8e8e8]"
      >
        <span className="text-[#9e9e9e] font-medium">Gradient:</span>
        {(['linear', 'radial', 'freeform'] as const).map((gType) => (
          <button
            key={gType}
            type="button"
            onClick={() =>
              updateNodeGradient((g) => ({
                ...g,
                type: gType,
                freeformPoints:
                  gType === 'freeform' && (!g.freeformPoints || g.freeformPoints.length === 0)
                    ? [
                        { id: 'fp-1', x: 0.25, y: 0.3, color: '#1473e6', opacity: 1, spread: 0.5 },
                        { id: 'fp-2', x: 0.75, y: 0.7, color: '#ff9a00', opacity: 1, spread: 0.5 },
                        { id: 'fp-3', x: 0.3, y: 0.78, color: '#2ecc71', opacity: 1, spread: 0.5 },
                      ]
                    : g.freeformPoints,
              }))
            }
            className={`px-1.5 py-0.5 rounded capitalize ${
              gradient.type === gType
                ? 'bg-[#1473e6] text-white'
                : 'bg-[#383838] text-[#b8b8b8] hover:text-white'
            }`}
          >
            {gType}
          </button>
        ))}

        {activeStop && gradient.type !== 'freeform' && (
          <>
            <div className="h-3 w-[1px] bg-[#454545]" />
            <label className="flex items-center gap-1 cursor-pointer" title="Active Stop Color">
              <input
                type="color"
                value={activeStop.color}
                onChange={(e) => {
                  const nextColor = e.target.value;
                  updateNodeGradient((g) => ({
                    ...g,
                    stops: g.stops.map((st) =>
                      st.id === activeStop.id ? { ...st, color: nextColor } : st
                    ),
                  }));
                }}
                className="w-4 h-4 rounded border border-[#666] bg-transparent cursor-pointer p-0"
              />
              <span className="font-mono text-[10px] text-[#b8b8b8]">
                {Math.round(activeStop.offset * 100)}%
              </span>
            </label>
            <span className="font-mono text-[10px] text-[#9e9e9e]">{gradient.angle || 0}°</span>
          </>
        )}
      </div>
    </div>
  );
};
export default GradientAnnotator;
