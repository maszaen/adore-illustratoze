import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '../../state/useStudioStore';

export interface DockTabGroup {
  id: string;
  tabs: string[];
  activeTab: string;
  minimized?: boolean;
  heightWeight?: number;
}

export interface FloatingPanelWindow {
  id: string;
  tabs: string[];
  activeTab: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized?: boolean;
}

export interface WorkspaceDockLayout {
  leftColumn: DockTabGroup[];
  leftCollapsed: boolean;
  rightInnerColumn: DockTabGroup[];
  rightInnerCollapsed: boolean;
  rightOuterColumn: DockTabGroup[];
  rightOuterCollapsed: boolean;
  bottomRow: DockTabGroup[];
  bottomCollapsed: boolean;
  floatingWindows: FloatingPanelWindow[];
}

export interface DockManagerProps {
  renderPanel: (panelId: string) => React.ReactNode;
  children?: React.ReactNode;
}

export const PANEL_METADATA: Record<
  string,
  { title: string; titleId: string; shortIcon: string }
> = {
  properties: { title: 'Properties', titleId: 'Properti', shortIcon: 'Pr' },
  layers: { title: 'Layers', titleId: 'Lapisan', shortIcon: 'Ly' },
  appearance: { title: 'Appearance', titleId: 'Tampilan', shortIcon: 'Ap' },
  color: { title: 'Color', titleId: 'Warna', shortIcon: 'Cl' },
  swatches: { title: 'Swatches', titleId: 'Palet Warna', shortIcon: 'Sw' },
  gradient: { title: 'Gradient', titleId: 'Gradasi', shortIcon: 'Gr' },
  stroke: { title: 'Stroke', titleId: 'Garis Tepi', shortIcon: 'St' },
  transparency: { title: 'Transparency', titleId: 'Transparansi', shortIcon: 'Tr' },
  pathfinder: { title: 'Pathfinder', titleId: 'Pathfinder', shortIcon: 'Pf' },
  align: { title: 'Align', titleId: 'Perataan', shortIcon: 'Al' },
  transform: { title: 'Transform', titleId: 'Transformasi', shortIcon: 'Tf' },
  brushes: { title: 'Brushes', titleId: 'Kuas Vektor', shortIcon: 'Br' },
  symbols: { title: 'Symbols', titleId: 'Simbol', shortIcon: 'Sy' },
  'graphic-styles': { title: 'Graphic Styles', titleId: 'Gaya Grafis', shortIcon: 'Gs' },
  character: { title: 'Character', titleId: 'Tipografi', shortIcon: 'Ch' },
  artboards: { title: 'Artboards', titleId: 'Artboard', shortIcon: 'Ab' },
  'image-trace': { title: 'Image Trace', titleId: 'Vektorisasi', shortIcon: 'It' },
  'asset-export': { title: 'Asset Export', titleId: 'Ekspor Aset', shortIcon: 'Ex' },
  history: { title: 'History', titleId: 'Riwayat', shortIcon: 'Hs' },
};

export function createPresetLayout(preset: string): WorkspaceDockLayout {
  switch (preset) {
    case 'essentials':
      return {
        leftColumn: [],
        leftCollapsed: true,
        rightInnerColumn: [],
        rightInnerCollapsed: true,
        rightOuterColumn: [
          {
            id: 'grp-ess-top',
            tabs: ['properties', 'character', 'transform'],
            activeTab: 'properties',
            heightWeight: 1.2,
          },
          {
            id: 'grp-ess-bottom',
            tabs: ['layers', 'artboards', 'appearance'],
            activeTab: 'layers',
            heightWeight: 1,
          },
        ],
        rightOuterCollapsed: false,
        bottomRow: [],
        bottomCollapsed: true,
        floatingWindows: [],
      };

    case 'illustration':
      return {
        leftColumn: [],
        leftCollapsed: true,
        rightInnerColumn: [
          {
            id: 'grp-ill-inner-1',
            tabs: ['color', 'swatches', 'gradient'],
            activeTab: 'swatches',
            heightWeight: 1,
          },
          {
            id: 'grp-ill-inner-2',
            tabs: ['brushes', 'symbols', 'graphic-styles'],
            activeTab: 'brushes',
            heightWeight: 1,
          },
        ],
        rightInnerCollapsed: false,
        rightOuterColumn: [
          {
            id: 'grp-ill-outer-1',
            tabs: ['appearance', 'transparency', 'stroke'],
            activeTab: 'appearance',
            heightWeight: 1,
          },
          {
            id: 'grp-ill-outer-2',
            tabs: ['layers', 'pathfinder', 'history'],
            activeTab: 'layers',
            heightWeight: 1.1,
          },
        ],
        rightOuterCollapsed: false,
        bottomRow: [],
        bottomCollapsed: true,
        floatingWindows: [],
      };

    case 'typography':
      return {
        leftColumn: [],
        leftCollapsed: true,
        rightInnerColumn: [
          {
            id: 'grp-typo-inner',
            tabs: ['character', 'swatches', 'color'],
            activeTab: 'character',
            heightWeight: 1,
          },
        ],
        rightInnerCollapsed: false,
        rightOuterColumn: [
          {
            id: 'grp-typo-outer-1',
            tabs: ['properties', 'appearance', 'graphic-styles'],
            activeTab: 'character',
            heightWeight: 1,
          },
          {
            id: 'grp-typo-outer-2',
            tabs: ['layers', 'align', 'transform'],
            activeTab: 'layers',
            heightWeight: 1,
          },
        ],
        rightOuterCollapsed: false,
        bottomRow: [],
        bottomCollapsed: true,
        floatingWindows: [],
      };

    case 'tracing':
      return {
        leftColumn: [],
        leftCollapsed: true,
        rightInnerColumn: [
          {
            id: 'grp-trace-inner',
            tabs: ['image-trace', 'pathfinder', 'swatches'],
            activeTab: 'image-trace',
            heightWeight: 1,
          },
        ],
        rightInnerCollapsed: false,
        rightOuterColumn: [
          {
            id: 'grp-trace-outer',
            tabs: ['layers', 'properties', 'color'],
            activeTab: 'layers',
            heightWeight: 1,
          },
        ],
        rightOuterCollapsed: false,
        bottomRow: [],
        bottomCollapsed: true,
        floatingWindows: [],
      };

    case 'layout-print':
    case 'web':
    case 'essentials-classic':
    default:
      return {
        leftColumn: [],
        leftCollapsed: true,
        rightInnerColumn: [
          {
            id: 'grp-classic-inner-1',
            tabs: ['color', 'swatches', 'gradient'],
            activeTab: 'color',
            heightWeight: 1,
          },
          {
            id: 'grp-classic-inner-2',
            tabs: ['stroke', 'appearance', 'transparency', 'graphic-styles'],
            activeTab: 'appearance',
            heightWeight: 1,
          },
          {
            id: 'grp-classic-inner-3',
            tabs: ['pathfinder', 'align', 'transform', 'image-trace'],
            activeTab: 'pathfinder',
            heightWeight: 1,
          },
        ],
        rightInnerCollapsed: true,
        rightOuterColumn: [
          {
            id: 'grp-classic-outer-1',
            tabs: ['properties', 'character', 'brushes', 'symbols'],
            activeTab: 'properties',
            heightWeight: 1.15,
          },
          {
            id: 'grp-classic-outer-2',
            tabs: ['layers', 'artboards', 'asset-export', 'history'],
            activeTab: 'layers',
            heightWeight: 1,
          },
        ],
        rightOuterCollapsed: false,
        bottomRow: [],
        bottomCollapsed: true,
        floatingWindows: [],
      };
  }
}

export const DockManager: React.FC<DockManagerProps> = ({ renderPanel, children }) => {
  const store = useStudioStore() as any;
  const language: 'id' | 'en' = store.language || 'en';
  const hideAllPanels: boolean = Boolean(store.hideAllPanels);
  const screenMode: string = store.screenMode || 'normal';

  const [layout, setLayout] = useState<WorkspaceDockLayout>(() =>
    createPresetLayout(store.activeWorkspace || 'essentials-classic')
  );

  const [rightOuterWidth, setRightOuterWidth] = useState<number>(286);
  const [rightInnerWidth, setRightInnerWidth] = useState<number>(264);

  // Active flyout when clicking an icon in a collapsed dock column
  const [activeFlyoutGroup, setActiveFlyoutGroup] = useState<{
    column: 'rightInner' | 'rightOuter' | 'left';
    groupId: string;
    activeTab: string;
  } | null>(null);

  const dragTabRef = useRef<{
    panelId: string;
    sourceGroupId: string;
    startX: number;
    startY: number;
  } | null>(null);

  // Listen for Workspace Switcher & Window menu panel open events
  useEffect(() => {
    const onPresetChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.preset) {
        setLayout(createPresetLayout(detail.preset));
        setActiveFlyoutGroup(null);
      }
    };

    const onOpenPanel = (e: Event) => {
      const panelId = (e as CustomEvent).detail?.panelId;
      if (!panelId) return;

      setLayout((prev) => {
        const next: WorkspaceDockLayout = JSON.parse(JSON.stringify(prev));

        // 1. Check floating windows
        for (const fw of next.floatingWindows) {
          if (fw.tabs.includes(panelId)) {
            fw.activeTab = panelId;
            fw.minimized = false;
            return next;
          }
        }

        // 2. Check rightOuterColumn
        for (const grp of next.rightOuterColumn) {
          if (grp.tabs.includes(panelId)) {
            grp.activeTab = panelId;
            grp.minimized = false;
            next.rightOuterCollapsed = false;
            return next;
          }
        }

        // 3. Check rightInnerColumn
        for (const grp of next.rightInnerColumn) {
          if (grp.tabs.includes(panelId)) {
            grp.activeTab = panelId;
            grp.minimized = false;
            if (next.rightInnerCollapsed) {
              setActiveFlyoutGroup({
                column: 'rightInner',
                groupId: grp.id,
                activeTab: panelId,
              });
            }
            return next;
          }
        }

        // 4. Otherwise add to first rightOuterColumn group
        if (next.rightOuterColumn.length > 0) {
          next.rightOuterColumn[0].tabs.push(panelId);
          next.rightOuterColumn[0].activeTab = panelId;
          next.rightOuterCollapsed = false;
        } else {
          next.rightOuterColumn.push({
            id: `grp-${Date.now()}`,
            tabs: [panelId],
            activeTab: panelId,
            heightWeight: 1,
          });
          next.rightOuterCollapsed = false;
        }
        return next;
      });
    };

    window.addEventListener('ai-workspace-preset', onPresetChange);
    window.addEventListener('ai-open-panel', onOpenPanel);
    return () => {
      window.removeEventListener('ai-workspace-preset', onPresetChange);
      window.removeEventListener('ai-open-panel', onOpenPanel);
    };
  }, []);

  if (hideAllPanels || screenMode === 'fullscreen') {
    return children ? <>{children}</> : null;
  }

  const getPanelTitle = (panelId: string): string => {
    const meta = PANEL_METADATA[panelId];
    if (!meta) return panelId;
    return language === 'id' ? meta.titleId : meta.title;
  };

  const getPanelShortIcon = (panelId: string): string => {
    return PANEL_METADATA[panelId]?.shortIcon || panelId.slice(0, 2).toUpperCase();
  };

  // Tear off a panel into a floating window over the canvas
  const tearOffTabToFloating = (
    panelId: string,
    sourceGroupId: string,
    clientX = window.innerWidth - 620,
    clientY = 120
  ) => {
    setLayout((prev) => {
      const next: WorkspaceDockLayout = JSON.parse(JSON.stringify(prev));

      const removeFromColumn = (col: DockTabGroup[]) => {
        for (let i = col.length - 1; i >= 0; i--) {
          const g = col[i];
          if (g.id === sourceGroupId && g.tabs.includes(panelId)) {
            g.tabs = g.tabs.filter((t) => t !== panelId);
            if (g.activeTab === panelId) {
              g.activeTab = g.tabs[0] || '';
            }
            if (g.tabs.length === 0) {
              col.splice(i, 1);
            }
          }
        }
      };

      removeFromColumn(next.rightOuterColumn);
      removeFromColumn(next.rightInnerColumn);
      removeFromColumn(next.leftColumn);

      next.floatingWindows.push({
        id: `float-${panelId}-${Date.now()}`,
        tabs: [panelId],
        activeTab: panelId,
        x: Math.max(60, Math.min(window.innerWidth - 320, clientX - 80)),
        y: Math.max(64, Math.min(window.innerHeight - 260, clientY - 12)),
        width: 280,
        height: 360,
        minimized: false,
      });

      return next;
    });
    setActiveFlyoutGroup(null);
  };

  // Dock a floating window back into the right outer dock column
  const dockFloatingWindowBack = (floatId: string, targetCol: 'rightOuter' | 'rightInner' = 'rightOuter') => {
    setLayout((prev) => {
      const next: WorkspaceDockLayout = JSON.parse(JSON.stringify(prev));
      const idx = next.floatingWindows.findIndex((w) => w.id === floatId);
      if (idx === -1) return prev;
      const [win] = next.floatingWindows.splice(idx, 1);

      const col = targetCol === 'rightOuter' ? next.rightOuterColumn : next.rightInnerColumn;
      if (col.length > 0) {
        for (const tab of win.tabs) {
          if (!col[0].tabs.includes(tab)) {
            col[0].tabs.push(tab);
          }
        }
        col[0].activeTab = win.activeTab;
      } else {
        col.push({
          id: `grp-docked-${Date.now()}`,
          tabs: win.tabs,
          activeTab: win.activeTab,
          heightWeight: 1,
        });
      }
      if (targetCol === 'rightOuter') next.rightOuterCollapsed = false;
      else next.rightInnerCollapsed = false;
      return next;
    });
  };

  // Drag tab to tear off if pulled >45px away from tab header
  const handleTabPointerDown = (
    panelId: string,
    groupId: string,
    e: React.PointerEvent
  ) => {
    if (e.button !== 0) return;
    dragTabRef.current = {
      panelId,
      sourceGroupId: groupId,
      startX: e.clientX,
      startY: e.clientY,
    };

    const handleMove = (mv: PointerEvent) => {
      if (!dragTabRef.current) return;
      const dist = Math.hypot(
        mv.clientX - dragTabRef.current.startX,
        mv.clientY - dragTabRef.current.startY
      );
      if (dist > 48) {
        const { panelId: pId, sourceGroupId: sId } = dragTabRef.current;
        dragTabRef.current = null;
        tearOffTabToFloating(pId, sId, mv.clientX, mv.clientY);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      }
    };

    const handleUp = () => {
      dragTabRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  // Resize column width
  const handleResizeColumn = (
    col: 'rightOuter' | 'rightInner',
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = col === 'rightOuter' ? rightOuterWidth : rightInnerWidth;

    const onMove = (mv: PointerEvent) => {
      const delta = startX - mv.clientX;
      const nextW = Math.max(220, Math.min(460, startWidth + delta));
      if (col === 'rightOuter') setRightOuterWidth(nextW);
      else setRightInnerWidth(nextW);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Drag Floating Window
  const handleDragFloatingWindow = (floatId: string, e: React.PointerEvent) => {
    e.preventDefault();
    const win = layout.floatingWindows.find((w) => w.id === floatId);
    if (!win) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = win.x;
    const origY = win.y;

    const onMove = (mv: PointerEvent) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      setLayout((prev) => ({
        ...prev,
        floatingWindows: prev.floatingWindows.map((w) =>
          w.id === floatId
            ? {
                ...w,
                x: Math.max(10, Math.min(window.innerWidth - 120, origX + dx)),
                y: Math.max(30, Math.min(window.innerHeight - 60, origY + dy)),
              }
            : w
        ),
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const renderTabGroupCard = (
    grp: DockTabGroup,
    columnKey: 'rightOuterColumn' | 'rightInnerColumn'
  ) => {
    const isMinimized = Boolean(grp.minimized);
    return (
      <div
        key={grp.id}
        className="ai-panel-shell"
        style={{
          flex: isMinimized ? '0 0 25px' : `${grp.heightWeight ?? 1} 1 0%`,
          minHeight: isMinimized ? 25 : 120,
          borderLeft: 'none',
          borderRight: 'none',
        }}
      >
        {/* Tab Bar Header */}
        <div className="ai-panel-tabbar">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              overflowX: 'auto',
              flex: 1,
            }}
          >
            {grp.tabs.map((tabId) => {
              const isActive = grp.activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  className={`ai-panel-tab ${isActive ? 'active' : ''}`}
                  title={`${getPanelTitle(tabId)} (Drag out to float, Double-click to collapse)`}
                  onPointerDown={(e) => handleTabPointerDown(tabId, grp.id, e)}
                  onClick={() => {
                    setLayout((prev) => ({
                      ...prev,
                      [columnKey]: prev[columnKey].map((g) =>
                        g.id === grp.id ? { ...g, activeTab: tabId, minimized: false } : g
                      ),
                    }));
                  }}
                  onDoubleClick={() => {
                    setLayout((prev) => ({
                      ...prev,
                      [columnKey]: prev[columnKey].map((g) =>
                        g.id === grp.id ? { ...g, minimized: !g.minimized } : g
                      ),
                    }));
                  }}
                >
                  <span>{getPanelTitle(tabId)}</span>
                </button>
              );
            })}
          </div>

          {/* Right Action Icons: Tear-Off Float & Minimize */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, paddingRight: 2 }}>
            <button
              type="button"
              className="ai-icon-btn"
              title="Tear Off Active Tab into Floating Palette"
              onClick={() => tearOffTabToFloating(grp.activeTab, grp.id)}
              style={{ width: 18, height: 18, fontSize: 10 }}
            >
              ❐
            </button>
            <button
              type="button"
              className="ai-icon-btn"
              title={isMinimized ? 'Expand Panel Group' : 'Minimize Panel Group'}
              onClick={() => {
                setLayout((prev) => ({
                  ...prev,
                  [columnKey]: prev[columnKey].map((g) =>
                    g.id === grp.id ? { ...g, minimized: !g.minimized } : g
                  ),
                }));
              }}
              style={{ width: 18, height: 18, fontSize: 10 }}
            >
              {isMinimized ? '▾' : '▴'}
            </button>
          </div>
        </div>

        {/* Active Panel Content */}
        {!isMinimized && (
          <div className="ai-panel-body" style={{ padding: 0 }}>
            {renderPanel(grp.activeTab)}
          </div>
        )}
      </div>
    );
  };

  // Render Collapsed Icon Strip for a Dock Column
  const renderCollapsedStrip = (
    groups: DockTabGroup[],
    columnType: 'rightInner' | 'rightOuter',
    onExpandColumn: () => void
  ) => (
    <div
      style={{
        width: 34,
        backgroundColor: 'var(--ai-bg-toolbar)',
        borderLeft: '1px solid var(--ai-border-strong)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3px 0',
        gap: 2,
        flexShrink: 0,
        zIndex: 85,
        userSelect: 'none',
      }}
    >
      {/* Expand Column Button (<<) */}
      <button
        type="button"
        onClick={() => {
          setActiveFlyoutGroup(null);
          onExpandColumn();
        }}
        title="Expand Dock Column (<<)"
        style={{
          width: 28,
          height: 16,
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--ai-border-strong)',
          color: 'var(--ai-text-secondary)',
          fontSize: 10,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 2,
        }}
      >
        «
      </button>

      {groups.map((grp) => (
        <React.Fragment key={grp.id}>
          {grp.tabs.map((tabId) => {
            const isFlyoutOpen =
              activeFlyoutGroup?.column === columnType &&
              activeFlyoutGroup?.activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                className={`ai-tool-btn ${isFlyoutOpen ? 'active' : ''}`}
                title={`${getPanelTitle(tabId)} (Click to open Flyout)`}
                onClick={() => {
                  if (isFlyoutOpen) {
                    setActiveFlyoutGroup(null);
                  } else {
                    setActiveFlyoutGroup({
                      column: columnType,
                      groupId: grp.id,
                      activeTab: tabId,
                    });
                  }
                }}
                style={{
                  width: 28,
                  height: 26,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: -0.3,
                }}
              >
                {getPanelShortIcon(tabId)}
              </button>
            );
          })}
          <div
            style={{
              width: 20,
              height: 1,
              backgroundColor: 'var(--ai-border-strong)',
              margin: '2px 0',
            }}
          />
        </React.Fragment>
      ))}
    </div>
  );

  const dockContent = (
    <div
      style={{
        display: 'flex',
        height: '100%',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Active Flyout Panel Popover when clicking an icon in a Collapsed Strip */}
      {activeFlyoutGroup && (
        <div
          className="ai-panel-shell"
          style={{
            position: 'absolute',
            right:
              activeFlyoutGroup.column === 'rightInner'
                ? (layout.rightOuterCollapsed ? 34 : rightOuterWidth) + 36
                : 36,
            top: 6,
            width: 284,
            maxHeight: 'calc(100% - 12px)',
            height: 440,
            boxShadow: 'var(--ai-shadow-floating)',
            zIndex: 920,
            borderRadius: 2,
          }}
        >
          <div className="ai-panel-tabbar">
            <span
              style={{
                padding: '0 8px',
                fontWeight: 600,
                color: 'var(--ai-text-primary)',
              }}
            >
              {getPanelTitle(activeFlyoutGroup.activeTab)}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                type="button"
                className="ai-icon-btn"
                title="Tear Off into Floating Palette"
                onClick={() =>
                  tearOffTabToFloating(
                    activeFlyoutGroup.activeTab,
                    activeFlyoutGroup.groupId
                  )
                }
                style={{ width: 18, height: 18, fontSize: 10 }}
              >
                ❐
              </button>
              <button
                type="button"
                className="ai-icon-btn"
                title="Collapse Flyout (>>)"
                onClick={() => setActiveFlyoutGroup(null)}
                style={{ width: 18, height: 18, fontSize: 10 }}
              >
                »
              </button>
            </div>
          </div>
          <div className="ai-panel-body" style={{ padding: 0 }}>
            {renderPanel(activeFlyoutGroup.activeTab)}
          </div>
        </div>
      )}

      {/* RIGHT INNER DOCK COLUMN (Collapsed Icon Strip OR Expanded Column) */}
      {layout.rightInnerColumn.length > 0 &&
        (layout.rightInnerCollapsed ? (
          renderCollapsedStrip(layout.rightInnerColumn, 'rightInner', () =>
            setLayout((prev) => ({ ...prev, rightInnerCollapsed: false }))
          )
        ) : (
          <div
            style={{
              width: rightInnerWidth,
              height: '100%',
              backgroundColor: 'var(--ai-bg-panel)',
              borderLeft: '1px solid var(--ai-border-strong)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {/* Left Resize Splitter */}
            <div
              onPointerDown={(e) => handleResizeColumn('rightInner', e)}
              style={{
                position: 'absolute',
                left: -2,
                top: 0,
                bottom: 0,
                width: 4,
                cursor: 'ew-resize',
                zIndex: 10,
              }}
            />
            {/* Column Top Collapse Bar */}
            <div
              style={{
                height: 16,
                backgroundColor: 'var(--ai-bg-header)',
                borderBottom: '1px solid var(--ai-border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '0 4px',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setLayout((prev) => ({ ...prev, rightInnerCollapsed: true }))
                }
                title="Collapse Column to Icons (>>)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ai-text-secondary)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                »
              </button>
            </div>
            {layout.rightInnerColumn.map((grp) =>
              renderTabGroupCard(grp, 'rightInnerColumn')
            )}
          </div>
        ))}

      {/* RIGHT OUTER DOCK COLUMN (Collapsed Icon Strip OR Expanded Column) */}
      {layout.rightOuterColumn.length > 0 &&
        (layout.rightOuterCollapsed ? (
          renderCollapsedStrip(layout.rightOuterColumn, 'rightOuter', () =>
            setLayout((prev) => ({ ...prev, rightOuterCollapsed: false }))
          )
        ) : (
          <div
            style={{
              width: rightOuterWidth,
              height: '100%',
              backgroundColor: 'var(--ai-bg-panel)',
              borderLeft: '1px solid var(--ai-border-strong)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {/* Left Resize Splitter */}
            <div
              onPointerDown={(e) => handleResizeColumn('rightOuter', e)}
              style={{
                position: 'absolute',
                left: -2,
                top: 0,
                bottom: 0,
                width: 4,
                cursor: 'ew-resize',
                zIndex: 10,
              }}
            />
            {/* Column Top Collapse Bar */}
            <div
              style={{
                height: 16,
                backgroundColor: 'var(--ai-bg-header)',
                borderBottom: '1px solid var(--ai-border-strong)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 6px',
              }}
            >
              <span style={{ fontSize: 9.5, color: 'var(--ai-text-muted)' }}>
                PANELS
              </span>
              <button
                type="button"
                onClick={() =>
                  setLayout((prev) => ({ ...prev, rightOuterCollapsed: true }))
                }
                title="Collapse Column to Icons (>>)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ai-text-secondary)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                »
              </button>
            </div>
            {layout.rightOuterColumn.map((grp) =>
              renderTabGroupCard(grp, 'rightOuterColumn')
            )}
          </div>
        ))}

      {/* TEAR-OFF FLOATING PANEL WINDOWS OVER CANVAS */}
      {layout.floatingWindows.map((win) => (
        <div
          key={win.id}
          className="ai-panel-shell"
          style={{
            position: 'fixed',
            left: win.x,
            top: win.y,
            width: win.width,
            height: win.minimized ? 26 : win.height,
            boxShadow: 'var(--ai-shadow-floating)',
            borderRadius: 2,
            zIndex: 960,
          }}
        >
          {/* Floating Window Draggable Title Bar */}
          <div
            className="ai-panel-tabbar"
            onPointerDown={(e) => handleDragFloatingWindow(win.id, e)}
            style={{ cursor: 'move' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 6 }}>
              <span style={{ fontWeight: 600, color: 'var(--ai-text-primary)' }}>
                {getPanelTitle(win.activeTab)}
              </span>
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 3 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="ai-icon-btn"
                title="Dock Panel Back to Right Dock"
                onClick={() => dockFloatingWindowBack(win.id, 'rightOuter')}
                style={{ width: 18, height: 18, fontSize: 10 }}
              >
                ⇥
              </button>
              <button
                type="button"
                className="ai-icon-btn"
                title={win.minimized ? 'Expand Palette' : 'Collapse Palette'}
                onClick={() =>
                  setLayout((prev) => ({
                    ...prev,
                    floatingWindows: prev.floatingWindows.map((w) =>
                      w.id === win.id ? { ...w, minimized: !w.minimized } : w
                    ),
                  }))
                }
                style={{ width: 18, height: 18, fontSize: 10 }}
              >
                {win.minimized ? '▾' : '▴'}
              </button>
              <button
                type="button"
                className="ai-icon-btn"
                title="Close Floating Window"
                onClick={() =>
                  setLayout((prev) => ({
                    ...prev,
                    floatingWindows: prev.floatingWindows.filter((w) => w.id !== win.id),
                  }))
                }
                style={{ width: 18, height: 18, fontSize: 11 }}
              >
                ×
              </button>
            </div>
          </div>

          {!win.minimized && (
            <div className="ai-panel-body" style={{ padding: 0 }}>
              {renderPanel(win.activeTab)}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  if (children) {
    return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
          {children}
        </div>
        {dockContent}
      </div>
    );
  }

  return dockContent;
};

export default DockManager;
