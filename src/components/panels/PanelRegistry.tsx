import React from 'react';
import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { AppearancePanel } from './AppearancePanel';
import { PathfinderAlignPanel } from './PathfinderAlignPanel';
import { ColorSwatchesGradientPanel } from './ColorSwatchesGradientPanel';
import { StrokeBrushesSymbolsPanel } from './StrokeBrushesSymbolsPanel';
import { TypographyPanel } from './TypographyPanel';
import { ArtboardsAssetHistoryInfoPanel } from './ArtboardsAssetHistoryInfoPanel';

export interface StudioPanelMetadataItem {
  id: string;
  title: string;
  titleId: string;
  shortcut: string;
  shortIcon: string;
  category: 'core' | 'color' | 'drawing' | 'typography' | 'utility';
}

export const STUDIO_PANEL_REGISTRY: StudioPanelMetadataItem[] = [
  { id: 'properties', title: 'Properties', titleId: 'Properti', shortcut: '', shortIcon: 'Pr', category: 'core' },
  { id: 'layers', title: 'Layers', titleId: 'Lapisan', shortcut: 'F7', shortIcon: 'Ly', category: 'core' },
  { id: 'appearance', title: 'Appearance', titleId: 'Tampilan', shortcut: 'Shift+F6', shortIcon: 'Ap', category: 'core' },
  { id: 'graphic-styles', title: 'Graphic Styles', titleId: 'Gaya Grafis', shortcut: 'Shift+F5', shortIcon: 'Gs', category: 'core' },
  { id: 'color', title: 'Color', titleId: 'Warna', shortcut: 'F6', shortIcon: 'Cl', category: 'color' },
  { id: 'color-guide', title: 'Color Guide', titleId: 'Panduan Warna', shortcut: 'Shift+F3', shortIcon: 'Cg', category: 'color' },
  { id: 'swatches', title: 'Swatches', titleId: 'Palet Warna', shortcut: '', shortIcon: 'Sw', category: 'color' },
  { id: 'gradient', title: 'Gradient', titleId: 'Gradasi', shortcut: 'Ctrl+F9', shortIcon: 'Gr', category: 'color' },
  { id: 'stroke', title: 'Stroke', titleId: 'Garis Tepi', shortcut: 'Ctrl+F10', shortIcon: 'St', category: 'drawing' },
  { id: 'brushes', title: 'Brushes', titleId: 'Kuas Vektor', shortcut: 'F5', shortIcon: 'Br', category: 'drawing' },
  { id: 'symbols', title: 'Symbols', titleId: 'Simbol', shortcut: 'Shift+Ctrl+F11', shortIcon: 'Sy', category: 'drawing' },
  { id: 'pathfinder', title: 'Pathfinder', titleId: 'Pathfinder', shortcut: 'Shift+Ctrl+F9', shortIcon: 'Pf', category: 'drawing' },
  { id: 'align', title: 'Align', titleId: 'Perataan', shortcut: 'Shift+F7', shortIcon: 'Al', category: 'drawing' },
  { id: 'transform', title: 'Transform', titleId: 'Transformasi', shortcut: 'Shift+F8', shortIcon: 'Tf', category: 'drawing' },
  { id: 'character', title: 'Character', titleId: 'Karakter Teks', shortcut: 'Ctrl+T', shortIcon: 'Ch', category: 'typography' },
  { id: 'paragraph', title: 'Paragraph', titleId: 'Paragraf', shortcut: 'Alt+Ctrl+T', shortIcon: 'Pa', category: 'typography' },
  { id: 'opentype', title: 'OpenType', titleId: 'OpenType', shortcut: 'Alt+Shift+Ctrl+T', shortIcon: 'Ot', category: 'typography' },
  { id: 'artboards', title: 'Artboards', titleId: 'Artboard', shortcut: '', shortIcon: 'Ab', category: 'utility' },
  { id: 'asset-export', title: 'Asset Export', titleId: 'Ekspor Aset', shortcut: '', shortIcon: 'Ex', category: 'utility' },
  { id: 'transparency', title: 'Transparency', titleId: 'Transparansi', shortcut: 'Shift+Ctrl+F10', shortIcon: 'Tr', category: 'utility' },
  { id: 'image-trace', title: 'Image Trace', titleId: 'Vektorisasi Gambar', shortcut: '', shortIcon: 'It', category: 'utility' },
  { id: 'info', title: 'Info', titleId: 'Informasi', shortcut: 'F8', shortIcon: 'In', category: 'utility' },
  { id: 'history', title: 'History', titleId: 'Riwayat', shortcut: '', shortIcon: 'Hs', category: 'utility' },
  { id: 'magic-wand', title: 'Magic Wand', titleId: 'Tongkat Sihir', shortcut: 'Y', shortIcon: 'Mw', category: 'utility' },
];

export const PANEL_METADATA_MAP: Record<string, StudioPanelMetadataItem> = Object.fromEntries(
  STUDIO_PANEL_REGISTRY.map((item) => [item.id, item])
);

/**
 * Renders any dockable or floating Studio Panel by its panelId.
 */
export function renderStudioPanel(panelId: string): React.ReactNode {
  switch (panelId) {
    case 'layers':
      return <LayersPanel key="layers" />;

    case 'appearance':
      return <AppearancePanel key="appearance" showTabs={false} initialTab="appearance" />;
    case 'graphic-styles':
      return <AppearancePanel key="graphic-styles" showTabs={false} initialTab="graphic-styles" />;

    case 'pathfinder':
      return <PathfinderAlignPanel key="pathfinder" showTabs={false} initialTab="pathfinder" />;
    case 'align':
      return <PathfinderAlignPanel key="align" showTabs={false} initialTab="align" />;
    case 'transform':
      return <PathfinderAlignPanel key="transform" showTabs={false} initialTab="transform" />;

    case 'color':
      return <ColorSwatchesGradientPanel key="color" showTabs={false} initialTab="color" />;
    case 'color-guide':
      return <ColorSwatchesGradientPanel key="color-guide" showTabs={false} initialTab="color-guide" />;
    case 'swatches':
      return <ColorSwatchesGradientPanel key="swatches" showTabs={false} initialTab="swatches" />;
    case 'gradient':
      return <ColorSwatchesGradientPanel key="gradient" showTabs={false} initialTab="gradient" />;

    case 'stroke':
      return <StrokeBrushesSymbolsPanel key="stroke" showTabs={false} initialTab="stroke" />;
    case 'brushes':
      return <StrokeBrushesSymbolsPanel key="brushes" showTabs={false} initialTab="brushes" />;
    case 'symbols':
      return <StrokeBrushesSymbolsPanel key="symbols" showTabs={false} initialTab="symbols" />;

    case 'character':
      return <TypographyPanel key="character" showTabs={false} initialTab="character" />;
    case 'paragraph':
      return <TypographyPanel key="paragraph" showTabs={false} initialTab="paragraph" />;
    case 'opentype':
      return <TypographyPanel key="opentype" showTabs={false} initialTab="opentype" />;

    case 'artboards':
      return <ArtboardsAssetHistoryInfoPanel key="artboards" showTabs={false} initialTab="artboards" />;
    case 'asset-export':
      return <ArtboardsAssetHistoryInfoPanel key="asset-export" showTabs={false} initialTab="asset-export" />;
    case 'transparency':
      return <ArtboardsAssetHistoryInfoPanel key="transparency" showTabs={false} initialTab="transparency" />;
    case 'image-trace':
      return <ArtboardsAssetHistoryInfoPanel key="image-trace" showTabs={false} initialTab="image-trace" />;
    case 'info':
      return <ArtboardsAssetHistoryInfoPanel key="info" showTabs={false} initialTab="info" />;
    case 'history':
      return <ArtboardsAssetHistoryInfoPanel key="history" showTabs={false} initialTab="history" />;
    case 'magic-wand':
      return <ArtboardsAssetHistoryInfoPanel key="magic-wand" showTabs={false} initialTab="magic-wand" />;

    case 'properties':
      return <PropertiesPanel key="properties" />;
    default:
      return <div className="ai-properties-panel">Panel not available: {panelId}</div>;
  }
}

export {
  LayersPanel,
  AppearancePanel,
  PathfinderAlignPanel,
  ColorSwatchesGradientPanel,
  StrokeBrushesSymbolsPanel,
  TypographyPanel,
  ArtboardsAssetHistoryInfoPanel,
};

export default renderStudioPanel;
