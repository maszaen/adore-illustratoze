import React, { useState, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
  FolderPlus,
  RefreshCw,
  Sliders,
  Sparkles,
  Grid,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import { NumericScrubInput } from '../primitives/NumericScrubInput';
import { ColorSwatchButton } from '../primitives/ColorSwatchButton';
import { FillStrokeProxy } from '../primitives/FillStrokeProxy';
import { AngleDial } from '../primitives/AngleDial';
import {
  hexToRgb,
  rgbToHex,
  rgbToCmyk,
  cmykToRgb,
  rgbToHsb,
  hsbToRgb,
  toWebSafeHex,
  rgbToGrayscalePercent,
  grayscalePercentToHex,
  isOutOfCmykGamut,
  correctToCmykGamut,
  applyColorTint,
  generateColorHarmony,
  HarmonyRule,
} from '../../core/math/color';
import type {
  GradientDef,
  GradientStop,
  SwatchItem,
  VectorNode,
} from '../../core/types';

export interface ColorSwatchesGradientPanelProps {
  initialTab?: 'color' | 'color-guide' | 'swatches' | 'gradient';
}

type ColorSpaceMode = 'RGB' | 'CMYK' | 'HSB' | 'Grayscale' | 'WebSafe';

export const DEFAULT_SWATCHES: SwatchItem[] = [
  { id: 'sw-none', name: '[None]', type: 'solid', color: 'none', isGlobal: false, isSpot: false, tint: 100 },
  { id: 'sw-white', name: 'White', type: 'solid', color: '#ffffff', isGlobal: false, isSpot: false, tint: 100 },
  { id: 'sw-black', name: 'Black', type: 'solid', color: '#000000', isGlobal: false, isSpot: false, tint: 100 },
  { id: 'sw-red', name: 'CMYK Red', type: 'solid', color: '#ed1c24', isGlobal: true, isSpot: false, tint: 100, groupName: 'Primary' },
  { id: 'sw-orange', name: 'Illustrator Orange', type: 'solid', color: '#ff9a00', isGlobal: true, isSpot: true, tint: 100, groupName: 'Primary' },
  { id: 'sw-yellow', name: 'CMYK Yellow', type: 'solid', color: '#fff200', isGlobal: true, isSpot: false, tint: 100, groupName: 'Primary' },
  { id: 'sw-green', name: 'Emerald Green', type: 'solid', color: '#00a651', isGlobal: true, isSpot: false, tint: 100, groupName: 'Primary' },
  { id: 'sw-cyan', name: 'CMYK Cyan', type: 'solid', color: '#00aeef', isGlobal: true, isSpot: false, tint: 100, groupName: 'Primary' },
  { id: 'sw-blue', name: 'Spectrum Blue', type: 'solid', color: '#1473e6', isGlobal: true, isSpot: true, tint: 100, groupName: 'Primary' },
  { id: 'sw-magenta', name: 'CMYK Magenta', type: 'solid', color: '#ec008c', isGlobal: true, isSpot: false, tint: 100, groupName: 'Primary' },
  { id: 'sw-purple', name: 'Royal Violet', type: 'solid', color: '#662d91', isGlobal: false, isSpot: false, tint: 100, groupName: 'Accents' },
  { id: 'sw-teal', name: 'Deep Teal', type: 'solid', color: '#008080', isGlobal: false, isSpot: false, tint: 100, groupName: 'Accents' },
  {
    id: 'sw-grad-sunset',
    name: 'Sunset Horizon',
    type: 'gradient',
    color: 'linear-gradient(90deg, #ff512f 0%, #f09819 50%, #dd2476 100%)',
    isGlobal: false,
    isSpot: false,
    tint: 100,
    groupName: 'Gradients',
    gradient: {
      id: 'grad-sunset',
      name: 'Sunset Horizon',
      type: 'linear',
      angle: 0,
      aspectRatio: 100,
      stops: [
        { id: 'st-1', offset: 0, color: '#ff512f', opacity: 1, midpoint: 0.5 },
        { id: 'st-2', offset: 0.5, color: '#f09819', opacity: 1, midpoint: 0.5 },
        { id: 'st-3', offset: 1, color: '#dd2476', opacity: 1, midpoint: 0.5 },
      ],
    },
  },
  {
    id: 'sw-grad-cyber',
    name: 'Neon Cyber Radial',
    type: 'gradient',
    color: 'radial-gradient(circle, #00f2fe 0%, #4facfe 50%, #0b132b 100%)',
    isGlobal: false,
    isSpot: false,
    tint: 100,
    groupName: 'Gradients',
    gradient: {
      id: 'grad-cyber',
      name: 'Neon Cyber Radial',
      type: 'radial',
      angle: 0,
      aspectRatio: 100,
      stops: [
        { id: 'st-c1', offset: 0, color: '#00f2fe', opacity: 1, midpoint: 0.5 },
        { id: 'st-c2', offset: 0.5, color: '#4facfe', opacity: 1, midpoint: 0.5 },
        { id: 'st-c3', offset: 1, color: '#0b132b', opacity: 1, midpoint: 0.5 },
      ],
    },
  },
];

export const ColorSwatchesGradientPanel: React.FC<ColorSwatchesGradientPanelProps> = ({
  initialTab = 'color',
}) => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || { nodes: {}, swatches: [] };

  const [activeTab, setActiveTab] = useState<'color' | 'color-guide' | 'swatches' | 'gradient'>(
    initialTab
  );
  const [colorMode, setColorMode] = useState<ColorSpaceMode>('RGB');
  const [harmonyRule, setHarmonyRule] = useState<HarmonyRule>('complementary');
  const [activeSwatchId, setActiveSwatchId] = useState<string | null>(null);
  const [globalTint, setGlobalTint] = useState<number>(100);
  const [editingSwatchModal, setEditingSwatchModal] = useState<SwatchItem | null>(null);
  const [isCreatingSwatch, setIsCreatingSwatch] = useState<boolean>(false);

  // Gradient local state
  const [gradDef, setGradDef] = useState<GradientDef>({
    id: 'grad-active',
    name: 'Custom Gradient',
    type: 'linear',
    angle: 0,
    aspectRatio: 100,
    strokeApplication: 'within',
    stops: [
      { id: 'stop-0', offset: 0, color: '#1473e6', opacity: 1, midpoint: 0.5 },
      { id: 'stop-1', offset: 1, color: '#ff9a00', opacity: 1, midpoint: 0.5 },
    ],
    freeformPoints: [
      { id: 'fp-1', x: 0.25, y: 0.25, color: '#1473e6', opacity: 1, spread: 0.5 },
      { id: 'fp-2', x: 0.75, y: 0.75, color: '#ff9a00', opacity: 1, spread: 0.5 },
    ],
  });
  const [selectedStopId, setSelectedStopId] = useState<string>('stop-0');
  const [freeformSubMode, setFreeformSubMode] = useState<'points' | 'lines'>('points');
  const rampRef = useRef<HTMLDivElement>(null);

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const nodesMap: Record<string, VectorNode> = doc.nodes || {};
  const primaryNode: VectorNode | null = selectedIds[0] ? nodesMap[selectedIds[0]] || null : null;

  const paintTarget: 'fill' | 'stroke' =
    store.activeProxy ?? store.activePaintTarget ?? store.activeColorTarget ?? 'fill';

  const currentColorHex: string = useMemo(() => {
    if (primaryNode) {
      if (paintTarget === 'fill') {
        const f = primaryNode.fills?.[0];
        if (f && f.color && f.color.startsWith('#')) return f.color;
      } else {
        const s = primaryNode.strokes?.[0];
        if (s && s.color && s.color.startsWith('#')) return s.color;
      }
    }
    const raw =
      paintTarget === 'fill'
        ? store.currentFillColor ?? store.activeFillColor ?? store.fillColor ?? '#1473e6'
        : store.currentStrokeColor ?? store.activeStrokeColor ?? store.strokeColor ?? '#000000';
    return raw && raw.startsWith('#') ? raw : '#1473e6';
  }, [
    primaryNode,
    paintTarget,
    store.currentFillColor,
    store.activeFillColor,
    store.fillColor,
    store.currentStrokeColor,
    store.activeStrokeColor,
    store.strokeColor,
  ]);

  const swatches: SwatchItem[] =
    doc.swatches && doc.swatches.length > 0 ? doc.swatches : DEFAULT_SWATCHES;
  const activeSwatch = swatches.find((s) => s.id === activeSwatchId) || null;

  const applyColorToActiveTarget = (
    hexOrCss: string,
    opts?: { globalSwatchId?: string; tint?: number; gradient?: GradientDef }
  ) => {
    if (paintTarget === 'fill') {
      if (typeof store.setCurrentFillColor === 'function') store.setCurrentFillColor(hexOrCss);
      else if (typeof store.setFillColor === 'function') store.setFillColor(hexOrCss);
      else if (typeof store.setActiveFillColor === 'function') store.setActiveFillColor(hexOrCss);
    } else {
      if (typeof store.setCurrentStrokeColor === 'function') store.setCurrentStrokeColor(hexOrCss);
      else if (typeof store.setStrokeColor === 'function') store.setStrokeColor(hexOrCss);
      else if (typeof store.setActiveStrokeColor === 'function') store.setActiveStrokeColor(hexOrCss);
    }

    if (typeof store.updateDocument === 'function') {
      store.updateDocument((d: any) => {
        selectedIds.forEach((id) => {
          const node: VectorNode | undefined = d.nodes?.[id];
          if (!node) return;
          if (paintTarget === 'fill') {
            if (!node.fills || node.fills.length === 0) {
              node.fills = [
                {
                  id: `fill-${Date.now()}`,
                  visible: true,
                  type: hexOrCss === 'none' ? 'none' : opts?.gradient ? 'gradient' : 'solid',
                  color: hexOrCss,
                  globalSwatchId: opts?.globalSwatchId,
                  tint: opts?.tint,
                  gradient: opts?.gradient,
                  opacity: 1,
                  blendMode: 'normal',
                },
              ];
            } else {
              node.fills[0].visible = true;
              node.fills[0].type =
                hexOrCss === 'none' ? 'none' : opts?.gradient ? 'gradient' : 'solid';
              node.fills[0].color = hexOrCss;
              node.fills[0].globalSwatchId = opts?.globalSwatchId;
              node.fills[0].tint = opts?.tint;
              if (opts?.gradient) node.fills[0].gradient = opts.gradient;
            }
          } else {
            if (!node.strokes || node.strokes.length === 0) {
              node.strokes = [
                {
                  id: `stroke-${Date.now()}`,
                  visible: hexOrCss !== 'none',
                  color: hexOrCss,
                  globalSwatchId: opts?.globalSwatchId,
                  tint: opts?.tint,
                  gradient: opts?.gradient,
                  weight: 1,
                  cap: 'round',
                  join: 'round',
                  miterLimit: 4,
                  align: 'center',
                  dashArray: [],
                  opacity: 1,
                  blendMode: 'normal',
                },
              ];
            } else {
              node.strokes[0].visible = hexOrCss !== 'none';
              node.strokes[0].color = hexOrCss;
              node.strokes[0].globalSwatchId = opts?.globalSwatchId;
              node.strokes[0].tint = opts?.tint;
              if (opts?.gradient) node.strokes[0].gradient = opts.gradient;
            }
          }
        });
      }, 'Apply Color / Gradient');
    }
  };

  // Propagate Global Swatch color edits live across all document nodes!
  const handleSaveSwatchModal = (swatch: SwatchItem) => {
    useStudioStore.setState((state: any) => {
      const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      const d = next.document || next.activeDocument || next;
      if (!d.swatches || d.swatches.length === 0) {
        d.swatches = [...DEFAULT_SWATCHES];
      }
      const existingIdx = d.swatches.findIndex((s: SwatchItem) => s.id === swatch.id);
      if (existingIdx !== -1) {
        d.swatches[existingIdx] = swatch;
      } else {
        d.swatches.push(swatch);
      }

      // If Global Color, live-update every node fill/stroke referencing this globalSwatchId!
      if (swatch.isGlobal && d.nodes) {
        Object.values(d.nodes as Record<string, VectorNode>).forEach((node) => {
          (node.fills || []).forEach((f) => {
            if (f.globalSwatchId === swatch.id) {
              f.color = applyColorTint(swatch.color, f.tint ?? swatch.tint ?? 100);
            }
          });
          (node.strokes || []).forEach((st) => {
            if (st.globalSwatchId === swatch.id) {
              st.color = applyColorTint(swatch.color, st.tint ?? swatch.tint ?? 100);
            }
          });
        });
      }
      return next;
    });
    setEditingSwatchModal(null);
    setIsCreatingSwatch(false);
  };

  const rgb = hexToRgb(currentColorHex);
  const cmyk = rgbToCmyk(rgb);
  const hsb = rgbToHsb(rgb);
  const kGray = rgbToGrayscalePercent(currentColorHex);
  const outOfGamut = isOutOfCmykGamut(currentColorHex);

  const buildGradientCss = (g: GradientDef): string => {
    const sorted = [...g.stops].sort((a, b) => a.offset - b.offset);
    const stopsStr = sorted
      .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(', ');
    if (g.type === 'radial') {
      return `radial-gradient(circle, ${stopsStr})`;
    }
    return `linear-gradient(${g.angle}deg, ${stopsStr})`;
  };

  const commitGradientUpdate = (nextGrad: GradientDef) => {
    setGradDef(nextGrad);
    const css = buildGradientCss(nextGrad);
    applyColorToActiveTarget(css, { gradient: nextGrad });
  };

  const selectedStop =
    gradDef.stops.find((s) => s.id === selectedStopId) || gradDef.stops[0];

  return (
    <div className="flex flex-col h-full bg-[#323232] text-[#e8e8e8] select-none text-[11px]">
      {/* Sub-Tabs: Color (F6) | Guide (Shift+F3) | Swatches | Gradient (Ctrl+F9) */}
      <div className="flex items-center bg-[#262626] border-b border-[#1a1a1a] overflow-x-auto">
        {[
          { id: 'color' as const, label: 'Color' },
          { id: 'color-guide' as const, label: 'Color Guide' },
          { id: 'swatches' as const, label: 'Swatches' },
          { id: 'gradient' as const, label: 'Gradient' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-2.5 py-1.5 font-medium whitespace-nowrap border-r border-[#1a1a1a] ${
              activeTab === t.id
                ? 'bg-[#323232] text-white border-t-2 border-t-[#1473e6]'
                : 'text-[#9e9e9e] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ====================================================================
          TAB 1: COLOR PANEL (F6)
          ==================================================================== */}
      {activeTab === 'color' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FillStrokeProxy compact />
              {/* Out of Gamut Warning Triangle (!) */}
              {outOfGamut && (
                <button
                  onClick={() => applyColorToActiveTarget(correctToCmykGamut(currentColorHex))}
                  title="Out of Gamut Warning (!): Click to snap to nearest printable CMYK color"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#3a2800] border border-[#f5a623] text-[#f5a623] text-[10px]"
                >
                  <AlertTriangle size={11} />
                  <span>In Gamut</span>
                </button>
              )}
            </div>

            {/* Color Mode Switcher */}
            <select
              value={colorMode}
              onChange={(e) => {
                const nextMode = e.target.value as ColorSpaceMode;
                setColorMode(nextMode);
                if (nextMode === 'WebSafe') {
                  applyColorToActiveTarget(toWebSafeHex(currentColorHex));
                }
              }}
              className="ai-select text-[10px]"
            >
              <option value="RGB">RGB</option>
              <option value="CMYK">CMYK</option>
              <option value="HSB">HSB</option>
              <option value="Grayscale">Grayscale</option>
              <option value="WebSafe">Web Safe RGB</option>
            </select>
          </div>

          {/* Sliders by Color Mode */}
          {(colorMode === 'RGB' || colorMode === 'WebSafe') && (
            <div className="space-y-1.5">
              {(['r', 'g', 'b'] as const).map((ch) => (
                <div key={ch} className="flex items-center gap-2">
                  <span className="w-4 uppercase font-semibold text-[#b0b0b0]">{ch}</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    step={colorMode === 'WebSafe' ? 51 : 1}
                    value={rgb[ch]}
                    onChange={(e) => {
                      const nextRgb = { ...rgb, [ch]: Number(e.target.value) };
                      const hex = rgbToHex(nextRgb);
                      applyColorToActiveTarget(colorMode === 'WebSafe' ? toWebSafeHex(hex) : hex);
                    }}
                    className="flex-1 accent-[#1473e6] h-1.5"
                  />
                  <NumericScrubInput
                    value={rgb[ch]}
                    min={0}
                    max={255}
                    width={44}
                    compact
                    onChange={(v) => {
                      const nextRgb = { ...rgb, [ch]: v };
                      applyColorToActiveTarget(rgbToHex(nextRgb));
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {colorMode === 'CMYK' && (
            <div className="space-y-1.5">
              {(['c', 'm', 'y', 'k'] as const).map((ch) => (
                <div key={ch} className="flex items-center gap-2">
                  <span className="w-4 uppercase font-semibold text-[#b0b0b0]">{ch}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={cmyk[ch]}
                    onChange={(e) => {
                      const nextCmyk = { ...cmyk, [ch]: Number(e.target.value) };
                      applyColorToActiveTarget(rgbToHex(cmykToRgb(nextCmyk)));
                    }}
                    className="flex-1 accent-[#1473e6] h-1.5"
                  />
                  <NumericScrubInput
                    value={cmyk[ch]}
                    suffix="%"
                    min={0}
                    max={100}
                    width={48}
                    compact
                    onChange={(v) => {
                      const nextCmyk = { ...cmyk, [ch]: v };
                      applyColorToActiveTarget(rgbToHex(cmykToRgb(nextCmyk)));
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {colorMode === 'HSB' && (
            <div className="space-y-1.5">
              {[
                { key: 'h' as const, max: 360, suf: '°' },
                { key: 's' as const, max: 100, suf: '%' },
                { key: 'b' as const, max: 100, suf: '%' },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="w-4 uppercase font-semibold text-[#b0b0b0]">{item.key}</span>
                  <input
                    type="range"
                    min={0}
                    max={item.max}
                    value={hsb[item.key]}
                    onChange={(e) => {
                      const nextHsb = { ...hsb, [item.key]: Number(e.target.value) };
                      applyColorToActiveTarget(rgbToHex(hsbToRgb(nextHsb)));
                    }}
                    className="flex-1 accent-[#1473e6] h-1.5"
                  />
                  <NumericScrubInput
                    value={hsb[item.key]}
                    suffix={item.suf}
                    min={0}
                    max={item.max}
                    width={48}
                    compact
                    onChange={(v) => {
                      const nextHsb = { ...hsb, [item.key]: v };
                      applyColorToActiveTarget(rgbToHex(hsbToRgb(nextHsb)));
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {colorMode === 'Grayscale' && (
            <div className="flex items-center gap-2">
              <span className="w-4 font-semibold text-[#b0b0b0]">K</span>
              <input
                type="range"
                min={0}
                max={100}
                value={kGray}
                onChange={(e) =>
                  applyColorToActiveTarget(grayscalePercentToHex(Number(e.target.value)))
                }
                className="flex-1 accent-[#1473e6] h-1.5"
              />
              <NumericScrubInput
                value={kGray}
                suffix="%"
                min={0}
                max={100}
                width={48}
                compact
                onChange={(v) => applyColorToActiveTarget(grayscalePercentToHex(v))}
              />
            </div>
          )}

          {/* Hex Input */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-[#9e9e9e]"># Hex:</span>
            <input
              type="text"
              value={currentColorHex}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                  applyColorToActiveTarget(v);
                }
              }}
              className="ai-input w-24 text-right font-mono"
            />
          </div>

          {/* Clickable Spectrum Ramp at Bottom */}
          <div className="pt-1">
            <div className="flex items-center gap-1">
              <button
                onClick={() => applyColorToActiveTarget('none')}
                title="None (/)"
                className="w-4 h-5 bg-white border border-[#1a1a1a] relative shrink-0"
              >
                <span className="absolute inset-0 border-b-2 border-[#e3242b] -rotate-45" />
              </button>
              <button
                onClick={() => applyColorToActiveTarget('#ffffff')}
                title="White"
                className="w-3.5 h-5 bg-white border border-[#1a1a1a] shrink-0"
              />
              <button
                onClick={() => applyColorToActiveTarget('#000000')}
                title="Black"
                className="w-3.5 h-5 bg-black border border-[#1a1a1a] shrink-0"
              />
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const hue = Math.round(ratio * 360);
                  const picked = rgbToHex(hsbToRgb({ h: hue, s: 90, b: 95 }));
                  applyColorToActiveTarget(
                    colorMode === 'WebSafe' ? toWebSafeHex(picked) : picked
                  );
                }}
                title="Click anywhere on Spectrum Ramp to pick color"
                className="flex-1 h-5 rounded-sm border border-[#1a1a1a] cursor-crosshair"
                style={{
                  background:
                    'linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: COLOR GUIDE PANEL (Shift+F3)
          ==================================================================== */}
      {activeTab === 'color-guide' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#9e9e9e]">Base:</span>
            <ColorSwatchButton color={currentColorHex} size={18} />
            <select
              value={harmonyRule}
              onChange={(e) => setHarmonyRule(e.target.value as HarmonyRule)}
              className="ai-select flex-1 text-[10px]"
            >
              <option value="complementary">Complementary</option>
              <option value="analogous">Analogous</option>
              <option value="monochromatic">Monochromatic</option>
              <option value="triad">Triad</option>
              <option value="compound">Compound</option>
              <option value="shades">Shades & Tints</option>
            </select>
          </div>

          {/* Interactive 5x7 Shades & Tints Matrix */}
          <div className="space-y-1">
            <div className="grid grid-cols-7 text-[9px] text-[#888] text-center">
              <span>-60%</span>
              <span>-40%</span>
              <span>-20%</span>
              <span className="text-white font-bold">Base</span>
              <span>+25%</span>
              <span>+50%</span>
              <span>+75%</span>
            </div>
            {generateColorHarmony(currentColorHex, harmonyRule).map((rowColor, rIdx) => {
              const rowHsb = rgbToHsb(hexToRgb(rowColor));
              const steps = [
                rgbToHex(hsbToRgb({ ...rowHsb, b: Math.max(10, rowHsb.b * 0.35) })),
                rgbToHex(hsbToRgb({ ...rowHsb, b: Math.max(15, rowHsb.b * 0.55) })),
                rgbToHex(hsbToRgb({ ...rowHsb, b: Math.max(20, rowHsb.b * 0.78) })),
                rowColor,
                applyColorTint(rowColor, 75),
                applyColorTint(rowColor, 50),
                applyColorTint(rowColor, 25),
              ];
              return (
                <div key={rIdx} className="grid grid-cols-7 gap-0.5">
                  {steps.map((cellHex, cIdx) => (
                    <button
                      key={cIdx}
                      onClick={() => applyColorToActiveTarget(cellHex)}
                      title={`Apply ${cellHex}`}
                      className={`h-5 border ${
                        cIdx === 3 ? 'border-white/70' : 'border-[#1a1a1a]'
                      } hover:scale-110 transition-transform`}
                      style={{ backgroundColor: cellHex }}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => {
              const harmonyColors = generateColorHarmony(currentColorHex, harmonyRule);
              useStudioStore.setState((state: any) => {
                const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
                const d = next.document || next.activeDocument || next;
                if (!d.swatches || d.swatches.length === 0) d.swatches = [...DEFAULT_SWATCHES];
                harmonyColors.forEach((hc, idx) => {
                  d.swatches.push({
                    id: `sw-harm-${Date.now()}-${idx}`,
                    name: `${harmonyRule} ${idx + 1}`,
                    type: 'solid',
                    color: hc,
                    isGlobal: true,
                    isSpot: false,
                    tint: 100,
                    groupName: `Harmony (${harmonyRule})`,
                  });
                });
                return next;
              });
              setActiveTab('swatches');
            }}
            className="ai-btn w-full text-[10px]"
          >
            Save Harmony Group to Swatches
          </button>
        </div>
      )}

      {/* ====================================================================
          TAB 3: SWATCHES PANEL (Global Colors, Tint Slider, Recolor Artwork)
          ==================================================================== */}
      {activeTab === 'swatches' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Global Color Tint Slider when a Global Swatch is active */}
          {activeSwatch && activeSwatch.isGlobal && (
            <div className="px-2.5 py-1.5 bg-[#292929] border-b border-[#1a1a1a] flex items-center gap-2">
              <span className="text-[10px] text-[#ff9a00] font-semibold">Global Tint:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={globalTint}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  setGlobalTint(t);
                  const tinted = applyColorTint(activeSwatch.color, t);
                  applyColorToActiveTarget(tinted, {
                    globalSwatchId: activeSwatch.id,
                    tint: t,
                  });
                }}
                className="flex-1 accent-[#1473e6] h-1.5"
              />
              <NumericScrubInput
                value={globalTint}
                suffix="%"
                min={0}
                max={100}
                width={44}
                compact
                onChange={(t) => {
                  setGlobalTint(t);
                  const tinted = applyColorTint(activeSwatch.color, t);
                  applyColorToActiveTarget(tinted, {
                    globalSwatchId: activeSwatch.id,
                    tint: t,
                  });
                }}
              />
            </div>
          )}

          {/* Swatches Grid & Color Groups */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {swatches.map((sw) => (
                <ColorSwatchButton
                  key={sw.id}
                  color={sw.color}
                  size={20}
                  isGlobal={sw.isGlobal}
                  isSpot={sw.isSpot}
                  selected={activeSwatchId === sw.id}
                  title={`${sw.name}${sw.isGlobal ? ' (Global Color - Double-click to live edit)' : ''}${
                    sw.isSpot ? ' [Spot]' : ''
                  }`}
                  onClick={() => {
                    setActiveSwatchId(sw.id);
                    setGlobalTint(sw.tint ?? 100);
                    if (sw.type === 'gradient' && sw.gradient) {
                      commitGradientUpdate(sw.gradient);
                    } else {
                      const col = sw.isGlobal
                        ? applyColorTint(sw.color, sw.tint ?? 100)
                        : sw.color;
                      applyColorToActiveTarget(col, {
                        globalSwatchId: sw.isGlobal ? sw.id : undefined,
                        tint: sw.tint ?? 100,
                      });
                    }
                  }}
                  onDoubleClick={() => {
                    if (sw.color !== 'none') {
                      setEditingSwatchModal({ ...sw });
                      setIsCreatingSwatch(false);
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* New / Edit Global Swatch Modal */}
          {editingSwatchModal && (
            <div className="p-2.5 bg-[#242424] border-t border-[#1a1a1a] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[11px]">
                  {isCreatingSwatch ? 'New Swatch' : 'Swatch Options'}
                </span>
                <button
                  onClick={() => setEditingSwatchModal(null)}
                  className="text-[10px] text-[#9e9e9e] hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                value={editingSwatchModal.name}
                onChange={(e) =>
                  setEditingSwatchModal({ ...editingSwatchModal, name: e.target.value })
                }
                placeholder="Swatch Name"
                className="ai-input w-full"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ColorSwatchButton
                    color={editingSwatchModal.color}
                    size={22}
                    allowColorPicker
                    onChange={(newHex) =>
                      setEditingSwatchModal({ ...editingSwatchModal, color: newHex })
                    }
                  />
                  <span className="font-mono text-[10px]">{editingSwatchModal.color}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingSwatchModal.isGlobal}
                      onChange={(e) =>
                        setEditingSwatchModal({
                          ...editingSwatchModal,
                          isGlobal: e.target.checked,
                        })
                      }
                    />
                    <span>Global</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingSwatchModal.isSpot}
                      onChange={(e) =>
                        setEditingSwatchModal({
                          ...editingSwatchModal,
                          isSpot: e.target.checked,
                        })
                      }
                    />
                    <span>Spot</span>
                  </label>
                </div>
              </div>
              <button
                onClick={() => handleSaveSwatchModal(editingSwatchModal)}
                className="ai-btn active w-full"
              >
                {editingSwatchModal.isGlobal
                  ? 'Save & Live-Update All Objects'
                  : 'Save Swatch'}
              </button>
            </div>
          )}

          {/* Swatches Footer Action Bar */}
          <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (typeof store.setActiveModal === 'function') {
                    store.setActiveModal('recolor-artwork');
                  } else {
                    useStudioStore.setState({ activeModal: 'recolor-artwork' } as any);
                  }
                }}
                title="Recolor Artwork (Interactive Harmony Wheel)"
                className="px-1.5 py-0.5 rounded bg-[#383838] hover:bg-[#1473e6] text-[10px] flex items-center gap-1"
              >
                <Sparkles size={11} className="text-[#ff9a00]" />
                <span>Recolor Artwork</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsCreatingSwatch(true);
                  setEditingSwatchModal({
                    id: `sw-${Date.now()}`,
                    name: `Global ${ currentColorHex.toUpperCase() }`,
                    type: 'solid',
                    color: currentColorHex,
                    isGlobal: true,
                    isSpot: false,
                    tint: 100,
                  });
                }}
                title="New Swatch (+)"
                className="p-1 rounded hover:bg-[#3f3f3f] text-[#cfcfcf]"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={() => {
                  if (!activeSwatchId) return;
                  useStudioStore.setState((state: any) => {
                    const next = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
                    const d = next.document || next.activeDocument || next;
                    if (d.swatches) {
                      d.swatches = d.swatches.filter((s: SwatchItem) => s.id !== activeSwatchId);
                    }
                    return next;
                  });
                }}
                disabled={!activeSwatchId}
                title="Delete Selected Swatch"
                className="p-1 rounded hover:bg-[#3f3f3f] disabled:opacity-40 text-[#cfcfcf] hover:text-[#ff6b6b]"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 4: GRADIENT PANEL (Ctrl+F9)
          ==================================================================== */}
      {activeTab === 'gradient' && (
        <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
          {/* Type Switcher: Linear, Radial, Freeform */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#b0b0b0]">Type:</span>
            <div className="flex items-center gap-1">
              {(['linear', 'radial', 'freeform'] as const).map((gt) => (
                <button
                  key={gt}
                  onClick={() => commitGradientUpdate({ ...gradDef, type: gt })}
                  className={`px-2 py-0.5 rounded text-[10px] capitalize border ${
                    gradDef.type === gt
                      ? 'bg-[#1473e6] border-[#1473e6] text-white'
                      : 'bg-[#292929] border-[#1a1a1a] text-[#cfcfcf]'
                  }`}
                >
                  {gt}
                </button>
              ))}
            </div>
          </div>

          {gradDef.type === 'freeform' ? (
            /* Freeform Gradient Points / Lines Editor */
            <div className="space-y-2 p-2 rounded bg-[#292929] border border-[#1a1a1a]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#b0b0b0]">Draw Mode:</span>
                <div className="flex items-center gap-1">
                  {(['points', 'lines'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setFreeformSubMode(m)}
                      className={`px-2 py-0.5 rounded text-[10px] capitalize ${
                        freeformSubMode === m ? 'bg-[#1473e6] text-white' : 'bg-[#383838]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                {(gradDef.freeformPoints || []).map((fp, idx) => (
                  <div
                    key={fp.id}
                    className="flex items-center justify-between px-1.5 py-1 rounded bg-[#222]"
                  >
                    <ColorSwatchButton
                      color={fp.color}
                      size={16}
                      allowColorPicker
                      onChange={(col) => {
                        const pts = [...(gradDef.freeformPoints || [])];
                        pts[idx] = { ...pts[idx], color: col };
                        commitGradientUpdate({ ...gradDef, freeformPoints: pts });
                      }}
                    />
                    <span className="text-[10px]">
                      Pt #{idx + 1} ({Math.round(fp.x * 100)}%, {Math.round(fp.y * 100)}%)
                    </span>
                    <NumericScrubInput
                      label="Spread:"
                      value={Math.round((fp.spread ?? 0.5) * 100)}
                      suffix="%"
                      min={10}
                      max={100}
                      width={42}
                      compact
                      onChange={(sp) => {
                        const pts = [...(gradDef.freeformPoints || [])];
                        pts[idx] = { ...pts[idx], spread: sp / 100 };
                        commitGradientUpdate({ ...gradDef, freeformPoints: pts });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Interactive Gradient Ramp with Draggable Color Stops & Midpoint Diamonds */
            <div className="space-y-2">
              <div className="relative pt-3 pb-4">
                {/* Midpoint Diamonds Row */}
                <div className="relative h-3 mb-0.5">
                  {gradDef.stops.slice(0, -1).map((st, idx) => {
                    const nextSt = gradDef.stops[idx + 1];
                    const midRatio = st.midpoint ?? 0.5;
                    const posPct =
                      (st.offset + (nextSt.offset - st.offset) * midRatio) * 100;
                    return (
                      <div
                        key={`mid-${st.id}`}
                        title={`Midpoint: ${Math.round(midRatio * 100)}%`}
                        style={{ left: `${posPct}%` }}
                        className="absolute -translate-x-1/2 top-0.5 w-2 h-2 rotate-45 bg-[#cfcfcf] border border-[#1a1a1a] cursor-ew-resize"
                      />
                    );
                  })}
                </div>

                {/* Gradient Bar Track (Click to add stop) */}
                <div
                  ref={rampRef}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const offset = Math.max(
                      0,
                      Math.min(1, Math.round(((e.clientX - rect.left) / rect.width) * 100) / 100)
                    );
                    const newStop: GradientStop = {
                      id: `stop-${Date.now()}`,
                      offset,
                      color: currentColorHex,
                      opacity: 1,
                      midpoint: 0.5,
                    };
                    const nextStops = [...gradDef.stops, newStop].sort(
                      (a, b) => a.offset - b.offset
                    );
                    setSelectedStopId(newStop.id);
                    commitGradientUpdate({ ...gradDef, stops: nextStops });
                  }}
                  title="Click on ramp to add a new Color Stop"
                  className="h-5 w-full rounded-sm border border-[#1a1a1a] cursor-copy"
                  style={{ background: buildGradientCss({ ...gradDef, type: 'linear', angle: 90 }) }}
                />

                {/* Draggable Color Stop Handles */}
                <div className="relative h-4 mt-0.5">
                  {gradDef.stops.map((st) => (
                    <button
                      key={st.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStopId(st.id);
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedStopId(st.id);
                        const bar = rampRef.current;
                        if (!bar) return;
                        const rect = bar.getBoundingClientRect();
                        const onMove = (mv: PointerEvent) => {
                          const nextOff = Math.max(
                            0,
                            Math.min(1, Math.round(((mv.clientX - rect.left) / rect.width) * 100) / 100)
                          );
                          const updatedStops = gradDef.stops
                            .map((s) => (s.id === st.id ? { ...s, offset: nextOff } : s))
                            .sort((a, b) => a.offset - b.offset);
                          commitGradientUpdate({ ...gradDef, stops: updatedStops });
                        };
                        const onUp = () => {
                          window.removeEventListener('pointermove', onMove);
                          window.removeEventListener('pointerup', onUp);
                        };
                        window.addEventListener('pointermove', onMove);
                        window.addEventListener('pointerup', onUp);
                      }}
                      style={{ left: `${st.offset * 100}%`, backgroundColor: st.color }}
                      title={`Stop ${Math.round(st.offset * 100)}%`}
                      className={`absolute -translate-x-1/2 top-0 w-3 h-3.5 rounded-b-sm border ${
                        selectedStop?.id === st.id
                          ? 'border-white ring-1 ring-[#1473e6] scale-110'
                          : 'border-[#1a1a1a]'
                      } cursor-ew-resize`}
                    />
                  ))}
                </div>
              </div>

              {/* Selected Stop Controls: Color, Opacity, Location % */}
              {selectedStop && (
                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#222]">
                  <ColorSwatchButton
                    color={selectedStop.color}
                    size={18}
                    allowColorPicker
                    onChange={(newCol) => {
                      const nextStops = gradDef.stops.map((s) =>
                        s.id === selectedStop.id ? { ...s, color: newCol } : s
                      );
                      commitGradientUpdate({ ...gradDef, stops: nextStops });
                    }}
                  />
                  <NumericScrubInput
                    label="Opacity:"
                    value={Math.round((selectedStop.opacity ?? 1) * 100)}
                    suffix="%"
                    min={0}
                    max={100}
                    width={44}
                    compact
                    onChange={(pct) => {
                      const nextStops = gradDef.stops.map((s) =>
                        s.id === selectedStop.id ? { ...s, opacity: pct / 100 } : s
                      );
                      commitGradientUpdate({ ...gradDef, stops: nextStops });
                    }}
                  />
                  <NumericScrubInput
                    label="Loc:"
                    value={Math.round(selectedStop.offset * 100)}
                    suffix="%"
                    min={0}
                    max={100}
                    width={44}
                    compact
                    onChange={(loc) => {
                      const nextStops = gradDef.stops
                        .map((s) =>
                          s.id === selectedStop.id ? { ...s, offset: loc / 100 } : s
                        )
                        .sort((a, b) => a.offset - b.offset);
                      commitGradientUpdate({ ...gradDef, stops: nextStops });
                    }}
                  />
                  {gradDef.stops.length > 2 && (
                    <button
                      onClick={() => {
                        const nextStops = gradDef.stops.filter((s) => s.id !== selectedStop.id);
                        setSelectedStopId(nextStops[0].id);
                        commitGradientUpdate({ ...gradDef, stops: nextStops });
                      }}
                      title="Delete Color Stop"
                      className="text-[#9e9e9e] hover:text-[#ff6b6b]"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Angle, Aspect Ratio & Reverse Gradient */}
              <div className="flex items-center justify-between pt-1.5 border-t border-[#222]">
                <AngleDial
                  angle={gradDef.angle}
                  size={22}
                  onChange={(deg) => commitGradientUpdate({ ...gradDef, angle: deg })}
                />
                {gradDef.type === 'radial' && (
                  <NumericScrubInput
                    label="Ratio:"
                    value={gradDef.aspectRatio}
                    suffix="%"
                    min={10}
                    max={300}
                    width={46}
                    compact
                    onChange={(ar) => commitGradientUpdate({ ...gradDef, aspectRatio: ar })}
                  />
                )}
                <button
                  onClick={() => {
                    const reversed = gradDef.stops
                      .map((s) => ({ ...s, offset: Math.round((1 - s.offset) * 100) / 100 }))
                      .sort((a, b) => a.offset - b.offset);
                    commitGradientUpdate({ ...gradDef, stops: reversed });
                  }}
                  title="Reverse Gradient"
                  className="ai-btn px-2"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
            </div>
          )}

          {/* Gradient on Stroke Options (Within, Along, Across) */}
          <div className="flex items-center justify-between pt-1.5 border-t border-[#222]">
            <span className="text-[10px] text-[#b0b0b0]">Stroke Gradient:</span>
            <div className="flex items-center gap-1">
              {(['within', 'along', 'across'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() =>
                    commitGradientUpdate({ ...gradDef, strokeApplication: mode })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] capitalize ${
                    (gradDef.strokeApplication || 'within') === mode
                      ? 'bg-[#1473e6] text-white'
                      : 'bg-[#292929] text-[#cfcfcf]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSwatchesGradientPanel;
