import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '../../state/useStudioStore';

export type PerspectiveMode = '1-point' | '2-point' | '3-point';
export type PerspectivePlane = 'left' | 'right' | 'horizontal' | 'none';

export interface PerspectiveGridOverlayProps {
  panX?: number;
  panY?: number;
  zoom?: number;
}

export const PerspectiveGridOverlay: React.FC<PerspectiveGridOverlayProps> = ({
  panX: propPanX,
  panY: propPanY,
  zoom: propZoom,
}) => {
  const store = useStudioStore() as any;
  const activeTool: string = store.activeTool || 'select';
  const showPerspectiveGrid: boolean =
    store.showPerspectiveGrid ??
    (activeTool === 'perspective-grid' || activeTool === 'perspective-select');

  const mode: PerspectiveMode = store.perspectiveMode || '2-point';
  const activePlane: PerspectivePlane = store.activePerspectivePlane || 'left';

  const panX: number = propPanX ?? store.panX ?? store.viewport?.panX ?? 120;
  const panY: number = propPanY ?? store.panY ?? store.viewport?.panY ?? 80;
  const zoom: number = propZoom ?? store.zoom ?? store.viewport?.zoom ?? 1;

  const doc = store.document || store.activeDocument || store.getActiveDocument?.() || {};
  const artboard =
    (doc.artboards || []).find((a: any) => a.id === doc.activeArtboardId) ||
    doc.artboards?.[0] || { x: 0, y: 0, width: 1200, height: 800 };

  const [horizonOffsetY, setHorizonOffsetY] = useState(0); // relative to artboard center
  const [leftVpOffsetX, setLeftVpOffsetX] = useState(-artboard.width * 0.65);
  const [rightVpOffsetX, setRightVpOffsetX] = useState(artboard.width * 0.65);
  const [thirdVpOffsetY, setThirdVpOffsetY] = useState(artboard.height * 0.9);
  const [draggingHandle, setDraggingHandle] = useState<
    null | 'horizon' | 'left-vp' | 'right-vp' | 'third-vp'
  >(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const setPerspectiveState = (patch: Partial<{
    showPerspectiveGrid: boolean;
    perspectiveMode: PerspectiveMode;
    activePerspectivePlane: PerspectivePlane;
  }>) => {
    if (patch.activePerspectivePlane && typeof store.setActivePerspectivePlane === 'function') {
      store.setActivePerspectivePlane(patch.activePerspectivePlane);
    }
    if (patch.perspectiveMode && typeof store.setPerspectiveMode === 'function') {
      store.setPerspectiveMode(patch.perspectiveMode);
    }
    if (
      patch.showPerspectiveGrid !== undefined &&
      typeof store.togglePerspectiveGrid === 'function' &&
      patch.showPerspectiveGrid !== showPerspectiveGrid
    ) {
      store.togglePerspectiveGrid();
    }
    useStudioStore.setState((s: any) => ({
      ...s,
      ...patch,
    }));
  };

  const centerX = artboard.x + artboard.width / 2;
  const centerY = artboard.y + artboard.height * 0.48 + horizonOffsetY;
  const groundY = artboard.y + artboard.height * 0.85;
  const topY = artboard.y + artboard.height * 0.12;

  useEffect(() => {
    if (!draggingHandle) return;
    const onMove = (e: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (e.clientX - rect.left - panX) / zoom;
      const canvasY = (e.clientY - rect.top - panY) / zoom;

      if (draggingHandle === 'horizon') {
        setHorizonOffsetY(canvasY - (artboard.y + artboard.height * 0.48));
      } else if (draggingHandle === 'left-vp') {
        setLeftVpOffsetX(Math.min(-80, canvasX - centerX));
      } else if (draggingHandle === 'right-vp') {
        setRightVpOffsetX(Math.max(80, canvasX - centerX));
      } else if (draggingHandle === 'third-vp') {
        setThirdVpOffsetY(Math.max(120, canvasY - centerY));
      }
    };
    const onUp = () => setDraggingHandle(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingHandle, panX, panY, zoom, artboard.y, artboard.height, centerX, centerY]);

  if (!showPerspectiveGrid) {
    return null;
  }

  const toScreen = (x: number, y: number) => ({
    x: x * zoom + panX,
    y: y * zoom + panY,
  });

  const leftVP = toScreen(centerX + leftVpOffsetX, centerY);
  const rightVP = toScreen(centerX + rightVpOffsetX, centerY);
  const centerVP = toScreen(centerX, centerY);
  const thirdVP = toScreen(centerX, centerY + thirdVpOffsetY);
  const spineTop = toScreen(centerX, topY);
  const spineBottom = toScreen(centerX, groundY);

  const steps = 10;
  const isInteractiveTool =
    activeTool === 'perspective-grid' || activeTool === 'perspective-select';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      {/* Perspective Grid Lines SVG */}
      <svg ref={svgRef} width="100%" height="100%" className="block">
        {/* Horizon Line */}
        <line
          x1={leftVP.x - 120}
          y1={centerVP.y}
          x2={rightVP.x + 120}
          y2={centerVP.y}
          stroke="#9e9e9e"
          strokeWidth={1}
          strokeDasharray="6 4"
          opacity={0.75}
        />

        {mode === '1-point' ? (
          <g>
            {/* 1-Point Perspective: Single central Vanishing Point */}
            {Array.from({ length: steps + 1 }).map((_, idx) => {
              const t = idx / steps;
              const bx = artboard.x + artboard.width * 0.15 + artboard.width * 0.7 * t;
              const pTop = toScreen(bx, topY);
              const pBot = toScreen(bx, groundY);
              return (
                <g key={`1p-${idx}`}>
                  {/* Horizontal Ground Plane Rays (Green #22c55e) */}
                  <line
                    x1={centerVP.x}
                    y1={centerVP.y}
                    x2={pBot.x}
                    y2={pBot.y}
                    stroke="#22c55e"
                    strokeWidth={activePlane === 'horizontal' ? 1.15 : 0.75}
                    opacity={activePlane === 'horizontal' ? 0.78 : 0.42}
                  />
                  {/* Frontal / Left Plane Grid (Blue #3b82f6) */}
                  <line
                    x1={pTop.x}
                    y1={pTop.y}
                    x2={pBot.x}
                    y2={pBot.y}
                    stroke="#3b82f6"
                    strokeWidth={activePlane === 'left' ? 1.1 : 0.7}
                    opacity={activePlane === 'left' ? 0.75 : 0.38}
                  />
                </g>
              );
            })}
            {Array.from({ length: 7 }).map((_, idx) => {
              const t = idx / 6;
              const y = topY + (groundY - topY) * t;
              const pL = toScreen(artboard.x + artboard.width * 0.15, y);
              const pR = toScreen(artboard.x + artboard.width * 0.85, y);
              return (
                <line
                  key={`1p-h-${idx}`}
                  x1={pL.x}
                  y1={pL.y}
                  x2={pR.x}
                  y2={pR.y}
                  stroke="#3b82f6"
                  strokeWidth={0.8}
                  opacity={0.5}
                />
              );
            })}
          </g>
        ) : (
          <g>
            {/* 2-Point and 3-Point Perspective: Left Plane (Blue #3b82f6), Right Plane (Orange #f97316), Ground Plane (Green #22c55e) */}
            {Array.from({ length: steps + 1 }).map((_, idx) => {
              const t = idx / steps;
              const spineY = topY + (groundY - topY) * t;
              const sp = toScreen(centerX, spineY);

              // Interpolate along left and right wings
              const wingLeftX = centerX + leftVpOffsetX * 0.55 * t;
              const wingRightX = centerX + rightVpOffsetX * 0.55 * t;
              const wingY = groundY - (groundY - centerY) * 0.55 * t;
              const pWingLeft = toScreen(wingLeftX, wingY);
              const pWingRight = toScreen(wingRightX, wingY);

              // Vertical or 3rd-VP converging subdivisions
              const subLeftTop = toScreen(
                centerX + leftVpOffsetX * 0.55 * t,
                topY + (centerY - topY) * 0.55 * t
              );
              const subRightTop = toScreen(
                centerX + rightVpOffsetX * 0.55 * t,
                topY + (centerY - topY) * 0.55 * t
              );

              return (
                <g key={`2p-${idx}`}>
                  {/* Left Plane Vanishing Rays (Blue #3b82f6) */}
                  <line
                    x1={leftVP.x}
                    y1={leftVP.y}
                    x2={sp.x}
                    y2={sp.y}
                    stroke="#3b82f6"
                    strokeWidth={activePlane === 'left' ? 1.15 : 0.7}
                    opacity={activePlane === 'left' ? 0.8 : 0.38}
                  />
                  {/* Left Plane Vertical / 3rd-Point Subdivision */}
                  <line
                    x1={subLeftTop.x}
                    y1={subLeftTop.y}
                    x2={mode === '3-point' ? (pWingLeft.x * 2 + thirdVP.x) / 3 : pWingLeft.x}
                    y2={mode === '3-point' ? (pWingLeft.y * 2 + thirdVP.y) / 3 : pWingLeft.y}
                    stroke="#3b82f6"
                    strokeWidth={activePlane === 'left' ? 1 : 0.65}
                    opacity={activePlane === 'left' ? 0.7 : 0.35}
                  />

                  {/* Right Plane Vanishing Rays (Orange #f97316) */}
                  <line
                    x1={rightVP.x}
                    y1={rightVP.y}
                    x2={sp.x}
                    y2={sp.y}
                    stroke="#f97316"
                    strokeWidth={activePlane === 'right' ? 1.15 : 0.7}
                    opacity={activePlane === 'right' ? 0.8 : 0.38}
                  />
                  {/* Right Plane Vertical / 3rd-Point Subdivision */}
                  <line
                    x1={subRightTop.x}
                    y1={subRightTop.y}
                    x2={mode === '3-point' ? (pWingRight.x * 2 + thirdVP.x) / 3 : pWingRight.x}
                    y2={mode === '3-point' ? (pWingRight.y * 2 + thirdVP.y) / 3 : pWingRight.y}
                    stroke="#f97316"
                    strokeWidth={activePlane === 'right' ? 1 : 0.65}
                    opacity={activePlane === 'right' ? 0.7 : 0.35}
                  />

                  {/* Horizontal Ground Plane Criss-Cross (Green #22c55e) */}
                  <line
                    x1={leftVP.x}
                    y1={leftVP.y}
                    x2={pWingRight.x}
                    y2={pWingRight.y}
                    stroke="#22c55e"
                    strokeWidth={activePlane === 'horizontal' ? 1.15 : 0.65}
                    opacity={activePlane === 'horizontal' ? 0.78 : 0.34}
                  />
                  <line
                    x1={rightVP.x}
                    y1={rightVP.y}
                    x2={pWingLeft.x}
                    y2={pWingLeft.y}
                    stroke="#22c55e"
                    strokeWidth={activePlane === 'horizontal' ? 1.15 : 0.65}
                    opacity={activePlane === 'horizontal' ? 0.78 : 0.34}
                  />
                </g>
              );
            })}

            {/* Central Vertical Spine */}
            <line
              x1={spineTop.x}
              y1={spineTop.y}
              x2={spineBottom.x}
              y2={spineBottom.y}
              stroke="#ffffff"
              strokeWidth={1.5}
              opacity={0.85}
            />
          </g>
        )}

        {/* Interactive Vanishing Point & Horizon Handles when Perspective Grid Tool is active */}
        {isInteractiveTool && (
          <g>
            {/* Left Vanishing Point Diamond */}
            <polygon
              points={`${leftVP.x},${leftVP.y - 6} ${leftVP.x + 6},${leftVP.y} ${leftVP.x},${leftVP.y + 6} ${leftVP.x - 6},${leftVP.y}`}
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth={1.5}
              className="pointer-events-auto cursor-ew-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                setDraggingHandle('left-vp');
              }}
            >
              <title>Left Vanishing Point (Drag horizontally)</title>
            </polygon>

            {/* Right Vanishing Point Diamond */}
            <polygon
              points={`${rightVP.x},${rightVP.y - 6} ${rightVP.x + 6},${rightVP.y} ${rightVP.x},${rightVP.y + 6} ${rightVP.x - 6},${rightVP.y}`}
              fill="#f97316"
              stroke="#ffffff"
              strokeWidth={1.5}
              className="pointer-events-auto cursor-ew-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                setDraggingHandle('right-vp');
              }}
            >
              <title>Right Vanishing Point (Drag horizontally)</title>
            </polygon>

            {/* Horizon Height Handle */}
            <circle
              cx={centerVP.x}
              cy={centerVP.y}
              r={5.5}
              fill="#22c55e"
              stroke="#ffffff"
              strokeWidth={1.5}
              className="pointer-events-auto cursor-ns-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                setDraggingHandle('horizon');
              }}
            >
              <title>Horizon Height Handle (Drag vertically)</title>
            </circle>

            {/* 3rd Vanishing Point Handle */}
            {mode === '3-point' && (
              <polygon
                points={`${thirdVP.x},${thirdVP.y - 6} ${thirdVP.x + 6},${thirdVP.y} ${thirdVP.x},${thirdVP.y + 6} ${thirdVP.x - 6},${thirdVP.y}`}
                fill="#e879f9"
                stroke="#ffffff"
                strokeWidth={1.5}
                className="pointer-events-auto cursor-ns-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDraggingHandle('third-vp');
                }}
              >
                <title>3rd Point Vertical Vanishing Point</title>
              </polygon>
            )}
          </g>
        )}
      </svg>

      {/* Top-Left Plane Switching Cube Widget (Authentic Adobe Illustrator Perspective Widget) */}
      <div className="pointer-events-auto absolute top-7 left-7 bg-[#262626]/95 border border-[#424242] rounded-lg p-2 shadow-2xl flex items-center gap-2.5 z-30">
        {/* Close Perspective Grid Button */}
        <button
          type="button"
          onClick={() => setPerspectiveState({ showPerspectiveGrid: false })}
          title="Hide Perspective Grid (Shift+Ctrl+I)"
          className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-[#383838] border border-[#555] text-[#ccc] hover:text-white hover:bg-[#e53935] text-[9px] flex items-center justify-center leading-none"
        >
          ×
        </button>

        {/* Interactive Isometric Plane Switching Cube SVG */}
        <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0">
          {/* Top / No Active Grid Ring */}
          <circle
            cx={23}
            cy={23}
            r={21}
            fill="none"
            stroke={activePlane === 'none' ? '#ffffff' : '#555555'}
            strokeWidth={1.2}
            className="cursor-pointer"
            onClick={() => setPerspectiveState({ activePerspectivePlane: 'none' })}
          >
            <title>No Active Grid Plane (4)</title>
          </circle>

          {/* Left Grid Face (Blue #3b82f6) */}
          <polygon
            points="9,15 23,22 23,37 9,29"
            fill={activePlane === 'left' ? '#3b82f6' : '#2c3e50'}
            stroke="#ffffff"
            strokeWidth={1}
            className="cursor-pointer transition-colors hover:opacity-90"
            onClick={() => setPerspectiveState({ activePerspectivePlane: 'left' })}
          >
            <title>Left Grid Plane - Blue (1)</title>
          </polygon>

          {/* Right Grid Face (Orange #f97316) */}
          <polygon
            points="23,22 37,15 37,29 23,37"
            fill={activePlane === 'right' ? '#f97316' : '#5c3b1e'}
            stroke="#ffffff"
            strokeWidth={1}
            className="cursor-pointer transition-colors hover:opacity-90"
            onClick={() => setPerspectiveState({ activePerspectivePlane: 'right' })}
          >
            <title>Right Grid Plane - Orange (3)</title>
          </polygon>

          {/* Horizontal / Ground Grid Face (Green #22c55e) */}
          <polygon
            points="9,15 23,8 37,15 23,22"
            fill={activePlane === 'horizontal' ? '#22c55e' : '#1e4d2b'}
            stroke="#ffffff"
            strokeWidth={1}
            className="cursor-pointer transition-colors hover:opacity-90"
            onClick={() => setPerspectiveState({ activePerspectivePlane: 'horizontal' })}
          >
            <title>Horizontal Grid Plane - Green (2)</title>
          </polygon>
        </svg>

        {/* Plane & Perspective Point Mode Controls */}
        <div className="flex flex-col gap-1 text-[10px]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[#b8b8b8] font-semibold">
              {activePlane === 'left'
                ? 'Left Grid (1)'
                : activePlane === 'horizontal'
                  ? 'Horizontal (2)'
                  : activePlane === 'right'
                    ? 'Right Grid (3)'
                    : 'No Active Plane'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {(['1-point', '2-point', '3-point'] as PerspectiveMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPerspectiveState({ perspectiveMode: m })}
                className={`px-1.5 py-0.5 rounded font-mono text-[9.5px] ${
                  mode === m
                    ? 'bg-[#1473e6] text-white'
                    : 'bg-[#363636] text-[#9e9e9e] hover:text-white'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default PerspectiveGridOverlay;
