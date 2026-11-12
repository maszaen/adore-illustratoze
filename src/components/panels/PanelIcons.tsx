import React from 'react';
import {
  SlidersHorizontal, Layers, Sparkles, Shapes, Palette, SwatchBook, Grid2X2,
  Blend, PenLine, Paintbrush, Stamp, Combine, AlignHorizontalDistributeCenter,
  Move, Type, AlignLeft, CaseSensitive, PanelsTopLeft, FileOutput, ScanLine,
  Info, History, WandSparkles, CircleDashed, type LucideIcon,
} from 'lucide-react';

const PANEL_ICONS: Record<string, LucideIcon> = {
  properties: SlidersHorizontal, layers: Layers, appearance: Sparkles, 'graphic-styles': Shapes,
  color: Palette, 'color-guide': SwatchBook, swatches: Grid2X2, gradient: Blend,
  stroke: PenLine, brushes: Paintbrush, symbols: Stamp, pathfinder: Combine,
  align: AlignHorizontalDistributeCenter, transform: Move, character: Type, paragraph: AlignLeft,
  opentype: CaseSensitive, artboards: PanelsTopLeft, 'asset-export': FileOutput,
  transparency: CircleDashed, 'image-trace': ScanLine, info: Info, history: History, 'magic-wand': WandSparkles,
};

export function PanelIcon({ panelId }: { panelId: string }) {
  const Icon = PANEL_ICONS[panelId] || Shapes;
  return <Icon data-panel-icon={panelId} size={16} strokeWidth={1.7} aria-hidden="true" focusable="false" />;
}
