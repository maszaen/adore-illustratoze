import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, X } from 'lucide-react';
import React from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import { getToolDefinition } from '../../core/tools/toolRegistry';
import { ToolIcon } from '../primitives/IllustratorIcons';
import type { ArtboardItem } from '../../core/types';

const ZOOM_PRESETS: { label: string; value: number }[] = [
  { label: '3.13%', value: 0.0313 },
  { label: '6.25%', value: 0.0625 },
  { label: '12.5%', value: 0.125 },
  { label: '25%', value: 0.25 },
  { label: '33.3%', value: 0.3333 },
  { label: '50%', value: 0.5 },
  { label: '66.7%', value: 0.6667 },
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
  { label: '300%', value: 3 },
  { label: '400%', value: 4 },
  { label: '600%', value: 6 },
  { label: '800%', value: 8 },
  { label: '1200%', value: 12 },
  { label: '1600%', value: 16 },
  { label: '3200%', value: 32 },
  { label: '6400%', value: 64 },
  { label: '64000%', value: 640 },
];

export const BottomStatusBar: React.FC = () => {
  const store = useStudioStore() as any;

  const doc = store.document || store.activeDocument || store.getActiveDocument?.() || {};
  const zoom: number = store.zoom ?? store.viewport?.zoom ?? 1;
  const activeTool: string = store.activeTool || 'select';
  const language: 'id' | 'en' = store.language || 'en';
  const screenMode: string = store.screenMode || 'normal';

  const artboards: ArtboardItem[] = doc.artboards || [];
  const activeArtboardId: string =
    doc.activeArtboardId || store.activeArtboardId || artboards[0]?.id || '';
  const activeArtboardIndex = Math.max(
    0,
    artboards.findIndex((a) => a.id === activeArtboardId)
  );

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || [];
  const historyList: any[] = store.history || store.undoStack || [];
  const historyIndex: number =
    typeof store.historyIndex === 'number'
      ? store.historyIndex
      : Math.max(0, historyList.length - 1);
  const undoCount = historyIndex;
  const redoCount = Math.max(0, historyList.length - 1 - historyIndex);
  const statusMessage: string | null = store.statusMessage || store.warningMessage || null;
  const viewMode: string = store.viewMode || 'preview';

  if (screenMode === 'fullscreen') {
    return null;
  }

  const toolDef = getToolDefinition(activeTool);

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.0313, Math.min(640, newZoom));
    if (typeof store.setZoom === 'function') {
      store.setZoom(clamped);
    } else if (typeof store.setViewport === 'function') {
      store.setViewport({ zoom: clamped });
    } else {
      useStudioStore.setState({ zoom: clamped } as any);
    }
  };

  const selectArtboardByIndex = (idx: number) => {
    if (idx < 0 || idx >= artboards.length) return;
    const target = artboards[idx];
    if (!target) return;
    if (typeof store.setActiveArtboardId === 'function') {
      store.setActiveArtboardId(target.id);
    } else if (typeof store.setActiveArtboard === 'function') {
      store.setActiveArtboard(target.id);
    } else {
      useStudioStore.setState((s: any) => {
        const next = structuredClone ? structuredClone(s) : JSON.parse(JSON.stringify(s));
        const targetDoc = next.document || next.activeDocument;
        if (targetDoc) targetDoc.activeArtboardId = target.id;
        next.activeArtboardId = target.id;
        return next;
      });
    }
  };

  const zoomPercentText = `${Math.round(zoom * 10000) / 100}%`;

  return (
    <footer className="ai-statusbar"
      style={{
        height: 22,
        backgroundColor: 'var(--ai-bg-statusbar)',
        borderTop: '1px solid var(--ai-border-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: 10.5,
        color: 'var(--ai-text-secondary)',
        zIndex: 100,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Left Cluster: Zoom Selector + Artboard Navigation */}
      <div className="ai-statusbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Zoom Level Dropdown */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <select
            className="ai-select"
            title="Zoom Level (3.13% – 64000%)"
            value={
              ZOOM_PRESETS.some((p) => Math.abs(p.value - zoom) < 0.000001)
                ? String(
                    ZOOM_PRESETS.find((p) => Math.abs(p.value - zoom) < 0.000001)?.value
                  )
                : 'custom'
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'fit') {
                if (typeof store.fitArtboardInWindow === 'function') {
                  store.fitArtboardInWindow();
                } else {
                  handleZoomChange(1);
                }
              } else if (val !== 'custom') {
                handleZoomChange(parseFloat(val));
              }
            }}
            style={{
              height: 18,
              width: 76,
              fontSize: 10.5,
              padding: '0 3px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {!ZOOM_PRESETS.some((p) => Math.abs(p.value - zoom) < 0.000001) && (
              <option value="custom">{zoomPercentText}</option>
            )}
            <option value="fit">Fit Screen</option>
            {ZOOM_PRESETS.map((p) => (
              <option key={p.label} value={String(p.value)}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <span style={{ color: 'var(--ai-border-subtle)' }}>|</span>

        {/* Artboard Navigation Bar */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            className="ai-icon-btn"
            disabled={activeArtboardIndex <= 0}
            onClick={() => selectArtboardByIndex(0)}
            title="First Artboard"
            style={{ width: 16, height: 16, fontSize: 9 }}
          >
            <ChevronsLeft size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ai-icon-btn"
            disabled={activeArtboardIndex <= 0}
            onClick={() => selectArtboardByIndex(activeArtboardIndex - 1)}
            title="Previous Artboard"
            style={{ width: 16, height: 16, fontSize: 9 }}
          >
            <ChevronLeft size={13} aria-hidden="true" />
          </button>

          <select
            className="ai-select"
            title="Active Artboard Selector"
            value={activeArtboardId}
            onChange={(e) => {
              const idx = artboards.findIndex((a) => a.id === e.target.value);
              if (idx >= 0) selectArtboardByIndex(idx);
            }}
            style={{
              height: 18,
              minWidth: 110,
              maxWidth: 160,
              fontSize: 10.5,
              padding: '0 19px 0 4px',
            }}
          >
            {artboards.map((ab, i) => (
              <option key={ab.id} value={ab.id}>
                {String(i + 1).padStart(2, '0')} - {ab.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="ai-icon-btn"
            disabled={activeArtboardIndex >= artboards.length - 1}
            onClick={() => selectArtboardByIndex(activeArtboardIndex + 1)}
            title="Next Artboard"
            style={{ width: 16, height: 16, fontSize: 9 }}
          >
            <ChevronRight size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ai-icon-btn"
            disabled={activeArtboardIndex >= artboards.length - 1}
            onClick={() => selectArtboardByIndex(artboards.length - 1)}
            title="Last Artboard"
            style={{ width: 16, height: 16, fontSize: 9 }}
          >
            <ChevronsRight size={13} aria-hidden="true" />
          </button>
        </div>

        <span style={{ color: 'var(--ai-border-subtle)' }}>|</span>

        {/* Active Tool Status */}
        <div className="ai-statusbar-tool"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            color: 'var(--ai-text-primary)',
          }}
        >
          <ToolIcon toolId={toolDef.id} iconName={toolDef.iconName} size={12} />
          <span style={{ fontWeight: 500 }}>
            {language === 'id' ? toolDef.nameId : toolDef.name}
          </span>
          {toolDef.shortcut && (
            <span style={{ color: 'var(--ai-text-muted)' }}>({toolDef.shortcut})</span>
          )}
        </div>
      </div>

      {/* Center / Contextual Warning or Status Message */}
      {statusMessage && (
        <div className="ai-statusbar-message" title={statusMessage}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '1px 8px',
            borderRadius: 2,
            backgroundColor: 'var(--ai-bg-panel)',
            border: '1px solid var(--ai-border-subtle)',
            color: 'var(--ai-text-secondary)',
            fontSize: 10.5,
          }}
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => {
              if (typeof store.setStatusMessage === 'function') {
                store.setStatusMessage(null);
              } else {
                useStudioStore.setState({ statusMessage: null, warningMessage: null } as any);
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              fontSize: 11,
            }}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Right Cluster: Selection Info, View Mode, Document Color Mode & Undo/Redo Status */}
      <div className="ai-statusbar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>
          {selectedIds.length === 0
            ? language === 'id'
              ? 'Tidak ada seleksi'
              : 'No Selection'
            : `${selectedIds.length} ${
                selectedIds.length === 1
                  ? language === 'id'
                    ? 'objek terpilih'
                    : 'object selected'
                  : language === 'id'
                  ? 'objek terpilih'
                  : 'objects selected'
              }`}
        </span>

        <span style={{ color: 'var(--ai-border-subtle)' }}>|</span>

        <span style={{ textTransform: 'uppercase', fontSize: 10 }}>
          {viewMode === 'outline' ? 'Outline (Ctrl+Y)' : 'Preview'}
        </span>

        <span style={{ color: 'var(--ai-border-subtle)' }}>|</span>

        <span>
          {doc.colorMode || 'RGB'} • {doc.unit || 'px'}
        </span>

        <span style={{ color: 'var(--ai-border-subtle)' }}>|</span>

        <span title="Undo / Redo History States">
          Undo: {undoCount} / Redo: {redoCount}
        </span>
      </div>
    </footer>
  );
};

export default BottomStatusBar;
