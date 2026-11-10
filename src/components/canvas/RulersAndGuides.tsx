import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import { fromPoints, toPoints } from '../../core/math/units';
import type { GuideItem, UnitType } from '../../core/types';

export interface RulersAndGuidesProps {
  panX?: number;
  panY?: number;
  zoom?: number;
  cursorCanvasPos?: { x: number; y: number } | null;
  viewportWidth?: number;
  viewportHeight?: number;
}

const UNIT_CYCLE: UnitType[] = ['px', 'pt', 'mm', 'cm', 'in', 'pc'];

export const RulersAndGuides: React.FC<RulersAndGuidesProps> = ({
  panX: propPanX,
  panY: propPanY,
  zoom: propZoom,
  cursorCanvasPos,
  viewportWidth = 1400,
  viewportHeight = 900,
}) => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || store.getActiveDocument?.() || {};
  const showRulers: boolean = store.showRulers ?? true;
  const showGuides: boolean = store.showGuides ?? true;
  const lockGuides: boolean = store.lockGuides ?? false;
  const rulerOriginMode: 'artboard' | 'global' = store.rulerOriginMode ?? 'artboard';

  const panX: number = propPanX ?? store.panX ?? store.viewport?.panX ?? 120;
  const panY: number = propPanY ?? store.panY ?? store.viewport?.panY ?? 80;
  const zoom: number = propZoom ?? store.zoom ?? store.viewport?.zoom ?? 1;

  const unit: UnitType = doc.unit || 'px';
  const guides: GuideItem[] = doc.guides || [];
  const artboards = doc.artboards || [];
  const activeArtboard =
    artboards.find((a: any) => a.id === doc.activeArtboardId) || artboards[0] || { x: 0, y: 0 };

  const originX = rulerOriginMode === 'artboard' ? activeArtboard.x : 0;
  const originY = rulerOriginMode === 'artboard' ? activeArtboard.y : 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingNewGuide, setDraggingNewGuide] = useState<{
    orientation: 'horizontal' | 'vertical';
    canvasPos: number;
    screenPos: number;
  } | null>(null);

  const [draggingExistingGuideId, setDraggingExistingGuideId] = useState<string | null>(null);

  const commitNewGuide = useCallback(
    (orientation: 'horizontal' | 'vertical', position: number) => {
      if (typeof store.addGuide === 'function') {
        store.addGuide(orientation, Math.round(position * 10) / 10);
        return;
      }
      const newGuide: GuideItem = {
        id: `guide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orientation,
        position: Math.round(position * 10) / 10,
        locked: false,
      };
      if (typeof store.updateDocument === 'function') {
        store.updateDocument((d: any) => {
          d.guides = [...(d.guides || []), newGuide];
        }, 'Add Ruler Guide');
      } else {
        useStudioStore.setState((s: any) => {
          const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
          const targetDoc = next.document || next.activeDocument;
          if (targetDoc) {
            targetDoc.guides = [...(targetDoc.guides || []), newGuide];
          }
          return next;
        });
      }
    },
    [store]
  );

  const updateGuidePosition = useCallback(
    (guideId: string, position: number | null) => {
      if (position === null) {
        if (typeof store.removeGuide === 'function') {
          store.removeGuide(guideId);
          return;
        }
      }
      useStudioStore.setState((s: any) => {
        const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
        const targetDoc = next.document || next.activeDocument;
        if (!targetDoc) return next;
        if (position === null) {
          targetDoc.guides = (targetDoc.guides || []).filter((g: GuideItem) => g.id !== guideId);
        } else {
          targetDoc.guides = (targetDoc.guides || []).map((g: GuideItem) =>
            g.id === guideId ? { ...g, position: Math.round(position * 10) / 10 } : g
          );
        }
        return next;
      });
    },
    [store]
  );

  useEffect(() => {
    if (!draggingNewGuide && !draggingExistingGuideId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = containerRef.current?.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (draggingNewGuide) {
        if (draggingNewGuide.orientation === 'horizontal') {
          const canvasY = (localY - panY) / zoom;
          setDraggingNewGuide({
            orientation: 'horizontal',
            canvasPos: canvasY,
            screenPos: localY,
          });
        } else {
          const canvasX = (localX - panX) / zoom;
          setDraggingNewGuide({
            orientation: 'vertical',
            canvasPos: canvasX,
            screenPos: localX,
          });
        }
      } else if (draggingExistingGuideId) {
        const g = guides.find((item) => item.id === draggingExistingGuideId);
        if (!g) return;
        if (g.orientation === 'horizontal') {
          const canvasY = (localY - panY) / zoom;
          updateGuidePosition(g.id, canvasY);
        } else {
          const canvasX = (localX - panX) / zoom;
          updateGuidePosition(g.id, canvasX);
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const rect = containerRef.current?.parentElement?.getBoundingClientRect();
      if (draggingNewGuide && rect) {
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        if (draggingNewGuide.orientation === 'horizontal' && localY > 20) {
          commitNewGuide('horizontal', draggingNewGuide.canvasPos);
        } else if (draggingNewGuide.orientation === 'vertical' && localX > 20) {
          commitNewGuide('vertical', draggingNewGuide.canvasPos);
        }
      } else if (draggingExistingGuideId && rect) {
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const g = guides.find((item) => item.id === draggingExistingGuideId);
        // Dragging a guide back onto the ruler deletes it
        if (g?.orientation === 'horizontal' && localY <= 20) {
          updateGuidePosition(g.id, null);
        } else if (g?.orientation === 'vertical' && localX <= 20) {
          updateGuidePosition(g.id, null);
        }
      }
      setDraggingNewGuide(null);
      setDraggingExistingGuideId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    draggingNewGuide,
    draggingExistingGuideId,
    panX,
    panY,
    zoom,
    guides,
    commitNewGuide,
    updateGuidePosition,
  ]);

  const cycleUnit = () => {
    const nextIdx = (UNIT_CYCLE.indexOf(unit) + 1) % UNIT_CYCLE.length;
    const nextUnit = UNIT_CYCLE[nextIdx];
    if (typeof store.setDocumentUnit === 'function') {
      store.setDocumentUnit(nextUnit);
    } else {
      useStudioStore.setState((s: any) => {
        const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
        const targetDoc = next.document || next.activeDocument;
        if (targetDoc) targetDoc.unit = nextUnit;
        return next;
      });
    }
  };

  // Compute major tick step in unit values so ticks stay ~50-110 screen pixels apart
  const unitInPoints = toPoints(1, unit);
  const pixelsPerUnit = unitInPoints * zoom;
  const candidateSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  const majorStepUnits =
    candidateSteps.find((step) => step * pixelsPerUnit >= 55) || candidateSteps[candidateSteps.length - 1];
  const minorDivisions = 5;

  const buildTicks = (lengthPx: number, panOffset: number, originCoord: number) => {
    const startCanvasPt = (0 - panOffset) / zoom - originCoord;
    const endCanvasPt = (lengthPx - panOffset) / zoom - originCoord;
    const startUnit = fromPoints(startCanvasPt, unit);
    const endUnit = fromPoints(endCanvasPt, unit);

    const firstMajor = Math.floor(startUnit / majorStepUnits) * majorStepUnits;
    const ticks: { screenPos: number; label?: string; isMajor: boolean; isMid: boolean }[] = [];

    for (let u = firstMajor; u <= endUnit + majorStepUnits; u += majorStepUnits / minorDivisions) {
      const pt = toPoints(u, unit) + originCoord;
      const screenPos = pt * zoom + panOffset;
      if (screenPos < 18 || screenPos > lengthPx) continue;
      const remainder = Math.abs(Math.round((u / majorStepUnits) * minorDivisions) % minorDivisions);
      const isMajor = remainder === 0;
      const isMid = remainder === Math.floor(minorDivisions / 2);
      ticks.push({
        screenPos,
        label: isMajor ? `${Math.round(u * 100) / 100}` : undefined,
        isMajor,
        isMid,
      });
    }
    return ticks;
  };

  const hTicks = showRulers ? buildTicks(viewportWidth, panX, originX) : [];
  const vTicks = showRulers ? buildTicks(viewportHeight, panY, originY) : [];

  const cursorScreenX = cursorCanvasPos ? cursorCanvasPos.x * zoom + panX : null;
  const cursorScreenY = cursorCanvasPos ? cursorCanvasPos.y * zoom + panY : null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {/* Canvas Guides (#00ffff) */}
      {showGuides &&
        guides.map((g) => {
          const isH = g.orientation === 'horizontal';
          const screenCoord = isH ? g.position * zoom + panY : g.position * zoom + panX;
          const canDrag = !lockGuides && !g.locked;
          const unitVal = Math.round(fromPoints(g.position - (isH ? originY : originX), unit) * 10) / 10;

          return isH ? (
            <div
              key={g.id}
              onPointerDown={(e) => {
                if (!canDrag) return;
                e.stopPropagation();
                setDraggingExistingGuideId(g.id);
              }}
              title={`Horizontal Guide: ${unitVal} ${unit}${lockGuides || g.locked ? ' (Locked)' : ' (Drag to move, drag to ruler to delete)'}`}
              style={{
                top: `${screenCoord}px`,
                left: showRulers ? 20 : 0,
                right: 0,
                height: '1px',
                backgroundColor: '#00ffff',
                boxShadow: '0 0 1px rgba(0,255,255,0.6)',
              }}
              className={`absolute group ${canDrag ? 'pointer-events-auto cursor-row-resize' : 'pointer-events-none'}`}
            >
              <div className="absolute -top-1.5 -bottom-1.5 inset-x-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-2 -top-4 bg-[#1a1a1a]/90 text-[#00ffff] border border-[#00ffff]/40 px-1 py-0.2 text-[9px] font-mono rounded pointer-events-none">
                Y: {unitVal} {unit}
              </span>
            </div>
          ) : (
            <div
              key={g.id}
              onPointerDown={(e) => {
                if (!canDrag) return;
                e.stopPropagation();
                setDraggingExistingGuideId(g.id);
              }}
              title={`Vertical Guide: ${unitVal} ${unit}${lockGuides || g.locked ? ' (Locked)' : ' (Drag to move, drag to ruler to delete)'}`}
              style={{
                left: `${screenCoord}px`,
                top: showRulers ? 20 : 0,
                bottom: 0,
                width: '1px',
                backgroundColor: '#00ffff',
                boxShadow: '0 0 1px rgba(0,255,255,0.6)',
              }}
              className={`absolute group ${canDrag ? 'pointer-events-auto cursor-col-resize' : 'pointer-events-none'}`}
            >
              <div className="absolute -left-1.5 -right-1.5 inset-y-0" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 left-1.5 bg-[#1a1a1a]/90 text-[#00ffff] border border-[#00ffff]/40 px-1 py-0.2 text-[9px] font-mono rounded whitespace-nowrap pointer-events-none">
                X: {unitVal} {unit}
              </span>
            </div>
          );
        })}

      {/* Live Preview while dragging a new Guide from Ruler */}
      {draggingNewGuide && (
        <div
          style={
            draggingNewGuide.orientation === 'horizontal'
              ? {
                  top: `${draggingNewGuide.screenPos}px`,
                  left: 0,
                  right: 0,
                  height: '1px',
                  backgroundColor: '#00ffff',
                }
              : {
                  left: `${draggingNewGuide.screenPos}px`,
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  backgroundColor: '#00ffff',
                }
          }
          className="absolute pointer-events-none z-40"
        >
          <span
            style={{
              left: draggingNewGuide.orientation === 'horizontal' ? 32 : 6,
              top: draggingNewGuide.orientation === 'horizontal' ? -18 : 32,
            }}
            className="absolute bg-[#1473e6] text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow"
          >
            {draggingNewGuide.orientation === 'horizontal' ? 'Y' : 'X'}:{' '}
            {Math.round(
              fromPoints(
                draggingNewGuide.canvasPos -
                  (draggingNewGuide.orientation === 'horizontal' ? originY : originX),
                unit
              ) * 10
            ) / 10}{' '}
            {unit}
          </span>
        </div>
      )}

      {/* Top Horizontal & Left Vertical Rulers */}
      {showRulers && (
        <>
          {/* Top-Left Unit / Origin Corner Box (20x20) */}
          <button
            type="button"
            onClick={cycleUnit}
            title={`Document Unit: ${unit.toUpperCase()} (Click to cycle px / pt / mm / cm / in / pc)`}
            className="pointer-events-auto absolute top-0 left-0 w-[20px] h-[20px] bg-[#262626] border-r border-b border-[#1a1a1a] flex items-center justify-center text-[9px] font-mono text-[#b8b8b8] hover:text-white hover:bg-[#323232] z-30 select-none"
          >
            {unit}
          </button>

          {/* Horizontal Ruler Bar */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const localY = e.clientY - rect.top;
              const canvasY = (localY - panY) / zoom;
              setDraggingNewGuide({
                orientation: 'horizontal',
                canvasPos: canvasY,
                screenPos: localY,
              });
            }}
            title="Drag down onto canvas to create Horizontal Guide (#00ffff)"
            className="pointer-events-auto absolute top-0 left-[20px] right-0 h-[20px] bg-[#262626] border-b border-[#1a1a1a] cursor-row-resize select-none overflow-hidden"
          >
            <svg width="100%" height="20" className="block">
              {hTicks.map((t, idx) => {
                const x = t.screenPos - 20;
                const tickH = t.isMajor ? 11 : t.isMid ? 6 : 3.5;
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={20 - tickH}
                      x2={x}
                      y2={20}
                      stroke={t.isMajor ? '#9e9e9e' : '#666666'}
                      strokeWidth={1}
                    />
                    {t.label !== undefined && (
                      <text
                        x={x + 3}
                        y={9}
                        fill="#b0b0b0"
                        fontSize="8.5"
                        fontFamily="Inter, Segoe UI, monospace"
                      >
                        {t.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {cursorScreenX !== null && cursorScreenX >= 20 && (
                <line
                  x1={cursorScreenX - 20}
                  y1={0}
                  x2={cursorScreenX - 20}
                  y2={20}
                  stroke="#ff9a00"
                  strokeWidth={1}
                />
              )}
            </svg>
          </div>

          {/* Vertical Ruler Bar */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const localX = e.clientX - rect.left;
              const canvasX = (localX - panX) / zoom;
              setDraggingNewGuide({
                orientation: 'vertical',
                canvasPos: canvasX,
                screenPos: localX,
              });
            }}
            title="Drag right onto canvas to create Vertical Guide (#00ffff)"
            className="pointer-events-auto absolute top-[20px] left-0 bottom-0 w-[20px] bg-[#262626] border-r border-[#1a1a1a] cursor-col-resize select-none overflow-hidden"
          >
            <svg width="20" height="100%" className="block">
              {vTicks.map((t, idx) => {
                const y = t.screenPos - 20;
                const tickW = t.isMajor ? 11 : t.isMid ? 6 : 3.5;
                return (
                  <g key={idx}>
                    <line
                      x1={20 - tickW}
                      y1={y}
                      x2={20}
                      y2={y}
                      stroke={t.isMajor ? '#9e9e9e' : '#666666'}
                      strokeWidth={1}
                    />
                    {t.label !== undefined && (
                      <text
                        x={8}
                        y={y - 3}
                        fill="#b0b0b0"
                        fontSize="8.5"
                        fontFamily="Inter, Segoe UI, monospace"
                        transform={`rotate(-90 8 ${y - 3})`}
                      >
                        {t.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {cursorScreenY !== null && cursorScreenY >= 20 && (
                <line
                  x1={0}
                  y1={cursorScreenY - 20}
                  x2={20}
                  y2={cursorScreenY - 20}
                  stroke="#ff9a00"
                  strokeWidth={1}
                />
              )}
            </svg>
          </div>
        </>
      )}
    </div>
  );
};
export default RulersAndGuides;
