import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import { PANEL_METADATA_MAP } from '../panels/PanelRegistry';
import { readDockWorkspace, saveDockWorkspace } from './workspaceStorage';

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

type DockColumn = 'leftColumn' | 'bottomRow' | 'rightInnerColumn' | 'rightOuterColumn';

export interface DockManagerProps {
  renderPanel: (panelId: string) => React.ReactNode;
  children?: React.ReactNode;
}

export const PANEL_METADATA: Record<string, { title: string; titleId: string; shortIcon: string }> = PANEL_METADATA_MAP;

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
            tabs: ['properties'],
            activeTab: 'properties',
            heightWeight: 1.2,
          },
          {
            id: 'grp-ess-bottom',
            tabs: ['layers', 'artboards'],
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
            tabs: ['character', 'paragraph', 'opentype'],
            activeTab: 'character',
            heightWeight: 1,
          },
        ],
        rightInnerCollapsed: false,
        rightOuterColumn: [
          {
            id: 'grp-typo-outer-1',
            tabs: ['properties', 'appearance', 'graphic-styles'],
            activeTab: 'properties',
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

    case 'layout-print': {
      const layout = createPresetLayout('essentials');
      layout.rightOuterColumn = [
        { id: 'grp-print-layout', tabs: ['transform', 'align', 'pathfinder'], activeTab: 'transform', heightWeight: 1 },
        { id: 'grp-print-type', tabs: ['character', 'paragraph', 'opentype'], activeTab: 'character', heightWeight: 1 },
        { id: 'grp-print-document', tabs: ['layers', 'artboards', 'appearance'], activeTab: 'layers', heightWeight: 1 },
      ];
      return layout;
    }
    case 'web': {
      const layout = createPresetLayout('essentials');
      layout.rightOuterColumn = [
        { id: 'grp-web-design', tabs: ['properties', 'color', 'swatches'], activeTab: 'properties', heightWeight: 1 },
        { id: 'grp-web-assets', tabs: ['layers', 'artboards', 'asset-export'], activeTab: 'layers', heightWeight: 1 },
      ];
      return layout;
    }
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
            tabs: ['character', 'brushes', 'symbols'],
            activeTab: 'character',
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

  const [workspaceId, setWorkspaceId] = useState<string>(() => store.activeWorkspace || 'essentials-classic');
  const initialWorkspace = useRef(readDockWorkspace(store.activeWorkspace || 'essentials-classic'));
  const [layout, setLayout] = useState<WorkspaceDockLayout>(() =>
    initialWorkspace.current?.layout || createPresetLayout(store.activeWorkspace || 'essentials-classic')
  );
  const [rightOuterWidth, setRightOuterWidth] = useState<number>(() => initialWorkspace.current?.rightOuterWidth ?? 286);
  const [rightInnerWidth, setRightInnerWidth] = useState<number>(() => initialWorkspace.current?.rightInnerWidth ?? 264);

  useEffect(() => {
    saveDockWorkspace(workspaceId, { version: 1, layout, rightOuterWidth, rightInnerWidth });
  }, [workspaceId, layout, rightOuterWidth, rightInnerWidth]);

  useEffect(() => {
    const clampWindows = () => setLayout(prev => ({ ...prev, floatingWindows: prev.floatingWindows.map(win => ({
      ...win, x: Math.max(0, Math.min(win.x, window.innerWidth - 120)), y: Math.max(0, Math.min(win.y, window.innerHeight - 50)),
    })) }));
    window.addEventListener('resize', clampWindows);
    return () => window.removeEventListener('resize', clampWindows);
  }, []);

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
    moved: boolean;
    wholeGroup: boolean;
  } | null>(null);
  const suppressTabClickRef = useRef(false);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);
  const [dropTab, setDropTab] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ panelId: string; x: number; y: number } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);
  const [panelMenu, setPanelMenu] = useState<{ panelId: string; groupId: string; column: DockColumn; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!panelMenu) return;
    const close = () => setPanelMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', onKey, true); };
  }, [panelMenu]);
  const [draggingPanel, setDraggingPanel] = useState(false);
  const [dropDestination, setDropDestination] = useState<DockColumn | null>(null);
  const [frontWindowId, setFrontWindowId] = useState<string | null>(null);

  // Listen for Workspace Switcher & Window menu panel open events
  useEffect(() => {
    const onPresetChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.preset) {
        const saved = detail.reset ? null : readDockWorkspace(detail.preset);
        setWorkspaceId(detail.preset);
        setLayout(saved?.layout || createPresetLayout(detail.preset));
        setRightOuterWidth(saved?.rightOuterWidth ?? 286);
        setRightInnerWidth(saved?.rightInnerWidth ?? 264);
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

        // Search the left and bottom docks too; never open a duplicate.
        for (const [column, collapsed] of [['leftColumn', 'leftCollapsed'], ['bottomRow', 'bottomCollapsed']] as const) {
          const group = next[column].find(item => item.tabs.includes(panelId));
          if (group) {
            group.activeTab = panelId;
            group.minimized = false;
            next[collapsed] = false;
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
      removeFromColumn(next.bottomRow);

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
  const dockFloatingWindowBack = (floatId: string, targetCol: DockColumn = 'rightOuterColumn') => {
    setLayout((prev) => {
      const next: WorkspaceDockLayout = JSON.parse(JSON.stringify(prev));
      const idx = next.floatingWindows.findIndex((w) => w.id === floatId);
      if (idx === -1) return prev;
      const [win] = next.floatingWindows.splice(idx, 1);

      const col = next[targetCol];
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
      if (targetCol === 'rightOuterColumn') next.rightOuterCollapsed = false;
      else if (targetCol === 'rightInnerColumn') next.rightInnerCollapsed = false;
      else if (targetCol === 'leftColumn') next.leftCollapsed = false;
      else next.bottomCollapsed = false;
      return next;
    });
  };

  const moveTabToColumn = (panelId: string, groupId: string, targetColumn: DockColumn) => {
    setLayout(previous => {
      const next: WorkspaceDockLayout = JSON.parse(JSON.stringify(previous));
      const columns: DockColumn[] = ['leftColumn', 'rightInnerColumn', 'rightOuterColumn', 'bottomRow'];
      const sourceName = columns.find(name => next[name].some(group => group.id === groupId));
      if (!sourceName || sourceName === targetColumn) return previous;
      const source = next[sourceName];
      const group = source.find(item => item.id === groupId);
      if (!group || !group.tabs.includes(panelId)) return previous;
      group.tabs = group.tabs.filter(id => id !== panelId);
      if (group.activeTab === panelId) group.activeTab = group.tabs[0] || '';
      if (!group.tabs.length) source.splice(source.indexOf(group), 1);
      const target = next[targetColumn];
      if (!target.length) target.push({ id: `grp-moved-${Date.now()}-${panelId}`, tabs: [], activeTab: panelId });
      if (!target[0].tabs.includes(panelId)) target[0].tabs.push(panelId);
      target[0].activeTab = panelId;
      target[0].minimized = false;
      if (targetColumn === 'rightInnerColumn') next.rightInnerCollapsed = false;
      else if (targetColumn === 'rightOuterColumn') next.rightOuterCollapsed = false;
      else if (targetColumn === 'leftColumn') next.leftCollapsed = false;
      else next.bottomCollapsed = false;
      return next;
    });
  };

  // Drop on a group to move/reorder a tab; drop elsewhere to float it.
  const handleTabPointerDown = (panelId: string, groupId: string, e: React.PointerEvent, wholeGroup = false) => {
    if (e.button !== 0) return;
    suppressTabClickRef.current = false;
    dragTabRef.current = { panelId, sourceGroupId: groupId, startX: e.clientX, startY: e.clientY, moved: false, wholeGroup };
    const edgeAt = (element: Element | null, y: number): 'before' | 'after' | null => {
      const group = element?.closest<HTMLElement>('[data-dock-group]');
      if (!group) return null;
      const rect = group.getBoundingClientRect();
      if (rect.height < 40) return null;
      // A tab header is a merge target; the very top/bottom edge creates a group.
      if (y - rect.top < 5) return 'before';
      if (rect.bottom - y < 8) return 'after';
      return null;
    };
    const handleMove = (mv: PointerEvent) => {
      const drag = dragTabRef.current;
      if (!drag) return;
      if (Math.hypot(mv.clientX - drag.startX, mv.clientY - drag.startY) > 8) drag.moved = true;
      if (drag.moved) {
        setDraggingPanel(true);
        setDragPreview({ panelId: drag.panelId, x: mv.clientX, y: mv.clientY });
        const element = document.elementFromPoint(mv.clientX, mv.clientY);
        const group = element?.closest<HTMLElement>('[data-dock-group]');
        setDropGroupId(group?.dataset.dockGroup || null);
        const edge = edgeAt(element, mv.clientY);
        setDropEdge(edge);
        const tab = element?.closest<HTMLElement>('[data-dock-tab]');
        const rect = tab?.getBoundingClientRect();
        setDropTab(!edge && tab && rect && rect.width > 0 ? { id: tab.dataset.dockTab!, side: mv.clientX < rect.left + rect.width / 2 ? 'before' : 'after' } : null);
        setDropDestination((element?.closest<HTMLElement>('[data-dock-destination]')?.dataset.dockDestination as DockColumn) || null);
      }
    };
    const handleUp = (up: PointerEvent) => {
      const drag = dragTabRef.current;
      dragTabRef.current = null;
      cleanup();
      setDropGroupId(null);
      setDropEdge(null);
      setDropTab(null);
      setDragPreview(null);
      setDraggingPanel(false);
      setDropDestination(null);
      if (!drag?.moved) return;
      suppressTabClickRef.current = true;
      window.setTimeout(() => { suppressTabClickRef.current = false; }, 0);
      const targetElement = document.elementFromPoint(up.clientX, up.clientY);
      const destination = targetElement?.closest<HTMLElement>('[data-dock-destination]')?.dataset.dockDestination as DockColumn | undefined;
      if (destination && !drag.wholeGroup) { moveTabToColumn(drag.panelId, drag.sourceGroupId, destination); return; }
      if (destination && drag.wholeGroup) {
        setLayout(previous => {
          const next: WorkspaceDockLayout = structuredClone(previous);
          const cols: DockColumn[] = ['leftColumn', 'rightInnerColumn', 'rightOuterColumn', 'bottomRow'];
          const source = cols.find(col => next[col].some(group => group.id === drag.sourceGroupId));
          if (!source || source === destination) return previous;
          const index = next[source].findIndex(group => group.id === drag.sourceGroupId);
          const [group] = next[source].splice(index, 1); next[destination].push(group);
          if (destination === 'leftColumn') next.leftCollapsed = false;
          if (destination === 'bottomRow') next.bottomCollapsed = false;
          if (destination === 'rightInnerColumn') next.rightInnerCollapsed = false;
          if (destination === 'rightOuterColumn') next.rightOuterCollapsed = false;
          return next;
        }); return;
      }
      const targetGroupId = targetElement?.closest<HTMLElement>('[data-dock-group]')?.dataset.dockGroup;
      const targetTab = targetElement?.closest<HTMLElement>('[data-dock-tab]');
      const targetTabId = targetTab?.dataset.dockTab;
      const targetRect = targetTab?.getBoundingClientRect();
      const insertAfter = Boolean(targetRect && targetRect.width > 0 && up.clientX >= targetRect.left + targetRect.width / 2);
      const targetEdge = edgeAt(targetElement, up.clientY);
      if (!targetGroupId) {
        if (!drag.wholeGroup) tearOffTabToFloating(drag.panelId, drag.sourceGroupId, up.clientX, up.clientY);
        else setLayout(previous => {
          const next: WorkspaceDockLayout = structuredClone(previous);
          const columns = [next.leftColumn, next.rightInnerColumn, next.rightOuterColumn, next.bottomRow];
          const source = columns.find(col => col.some(group => group.id === drag.sourceGroupId));
          if (!source) return previous;
          const [group] = source.splice(source.findIndex(item => item.id === drag.sourceGroupId), 1);
          next.floatingWindows.push({ id: `float-group-${Date.now()}`, tabs: group.tabs, activeTab: group.activeTab, x: Math.max(0, Math.min(window.innerWidth - 120, up.clientX - 80)), y: Math.max(0, Math.min(window.innerHeight - 50, up.clientY - 12)), width: 280, height: 360, minimized: group.minimized });
          return next;
        });
        return;
      }
      setLayout((prev) => {
        const next: WorkspaceDockLayout = JSON.parse(JSON.stringify(prev));
        const columns = [next.leftColumn, next.rightInnerColumn, next.rightOuterColumn, next.bottomRow];
        const source = columns.flat().find(g => g.id === drag.sourceGroupId);
        const target = columns.flat().find(g => g.id === targetGroupId);
        if (!source || !target || !source.tabs.includes(drag.panelId)) return prev;
        if (source === target && (drag.wholeGroup || targetTabId === drag.panelId || (targetEdge && source.tabs.length === 1))) return prev;
        const movingTabs = drag.wholeGroup ? [...source.tabs] : [drag.panelId];
        source.tabs = source.tabs.filter(t => !movingTabs.includes(t));
        if (movingTabs.includes(source.activeTab)) source.activeTab = source.tabs[0] || '';
        if (targetEdge) {
          const targetColumn = columns.find(col => col.includes(target))!;
          const index = targetColumn.indexOf(target) + (targetEdge === 'after' ? 1 : 0);
          targetColumn.splice(index, 0, { id: `grp-drag-${Date.now()}-${drag.panelId}`, tabs: movingTabs, activeTab: drag.panelId, heightWeight: 1 });
        } else {
          const index = targetTabId ? target.tabs.indexOf(targetTabId) : -1;
          target.tabs.splice(index < 0 ? target.tabs.length : index + (insertAfter ? 1 : 0), 0, ...movingTabs);
          target.activeTab = drag.panelId;
          target.minimized = false;
        }
        for (const col of columns) {
          for (let i = col.length - 1; i >= 0; i--) if (!col[i].tabs.length) col.splice(i, 1);
        }
        return next;
      });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey, true);
      dragCleanupRef.current = null;
    };
    const cancel = () => {
      cleanup(); dragTabRef.current = null; setDragPreview(null); setDraggingPanel(false); setDropGroupId(null); setDropEdge(null); setDropTab(null); setDropDestination(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } };
    dragCleanupRef.current?.();
    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey, true);
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
    let moved = false;
    const destinationAt = (x: number, y: number): DockColumn | null => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-dock-destination]'))) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return el.dataset.dockDestination as DockColumn;
      }
      return null;
    };

    const groupAt = (x: number, y: number) => {
      const elements = document.elementsFromPoint(x, y);
      return elements.find(el => !el.closest(`[data-floating-id="${floatId}"]`) && el.closest('[data-dock-group]'))?.closest<HTMLElement>('[data-dock-group]') || null;
    };
    const onMove = (mv: PointerEvent) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      if (Math.hypot(dx, dy) > 8) moved = true;
      if (moved) { setDraggingPanel(true); setDropDestination(destinationAt(mv.clientX, mv.clientY)); setDropGroupId(groupAt(mv.clientX, mv.clientY)?.dataset.dockGroup || null); }
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

    const onUp = (event: PointerEvent) => {
      const destination = moved ? destinationAt(event.clientX, event.clientY) : null;
      const targetGroup = moved && !destination ? groupAt(event.clientX, event.clientY)?.dataset.dockGroup : null;
      setDraggingPanel(false); setDropGroupId(null); setDropDestination(null);
      if (destination) dockFloatingWindowBack(floatId, destination);
      else if (targetGroup) setLayout(previous => {
        const next: WorkspaceDockLayout = structuredClone(previous);
        const index = next.floatingWindows.findIndex(item => item.id === floatId);
        const target = [next.leftColumn, next.rightInnerColumn, next.rightOuterColumn, next.bottomRow].flat().find(group => group.id === targetGroup);
        if (index < 0 || !target) return previous;
        const [floating] = next.floatingWindows.splice(index, 1);
        target.tabs.push(...floating.tabs.filter(tab => !target.tabs.includes(tab)));
        target.activeTab = floating.activeTab; target.minimized = false;
        return next;
      });
      cleanup();
    };
    const cancel = () => {
      setLayout(prev => ({ ...prev, floatingWindows: prev.floatingWindows.map(w => w.id === floatId ? { ...w, x: origX, y: origY } : w) }));
      setDraggingPanel(false); setDropGroupId(null); setDropDestination(null); cleanup();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } };
    const cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', onKey, true); dragCleanupRef.current = null; };
    dragCleanupRef.current?.(); dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey, true);
  };

  const renderTabGroupCard = (
    grp: DockTabGroup,
    columnKey: DockColumn
  ) => {
    const isMinimized = Boolean(grp.minimized);
    return (
      <div
        key={grp.id}
        className="ai-panel-shell"
        data-dock-group={grp.id}
        data-drop-edge={dropGroupId === grp.id ? dropEdge || undefined : undefined}
        style={{
          outline: dropGroupId === grp.id && !dropEdge ? '2px solid var(--ai-accent-blue)' : undefined,
          outlineOffset: -2,
          flex: isMinimized ? '0 0 25px' : `${grp.heightWeight ?? 1} 1 0%`,
          minHeight: isMinimized ? 25 : 120,
          borderLeft: 'none',
          borderRight: 'none',
        }}
      >
        {/* Tab Bar Header */}
        <div className="ai-panel-tabbar">
          <button type="button" className="ai-panel-group-grip" title="Drag panel group" aria-label={`Drag ${getPanelTitle(grp.activeTab)} panel group`} onPointerDown={event => handleTabPointerDown(grp.activeTab, grp.id, event, true)}>⠿</button>
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
                  data-dock-tab={tabId}
                  data-drop-tab={dropTab?.id === tabId ? dropTab.side : undefined}
                  title={`${getPanelTitle(tabId)} (Drag to reorder, move or float; double-click to collapse)`}
                  onPointerDown={(e) => handleTabPointerDown(tabId, grp.id, e)}
                  onContextMenu={e => { e.preventDefault(); setPanelMenu({ panelId: tabId, groupId: grp.id, column: columnKey, x: Math.max(4, Math.min(e.clientX, window.innerWidth - 210)), y: Math.max(4, Math.min(e.clientY, window.innerHeight - 100)) }); }}
                  onClick={() => {
                    if (suppressTabClickRef.current) { suppressTabClickRef.current = false; return; }
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

          {/* Right Action Icons: move without dragging, float, and minimize */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, paddingRight: 2 }}>
            <select aria-label={`Move ${getPanelTitle(grp.activeTab)} panel`} title="Move panel to a dock" value=""
              onChange={(event) => { if (event.target.value) moveTabToColumn(grp.activeTab, grp.id, event.target.value as DockColumn); }}
              className="ai-panel-move-select">
              <option value="">⇆</option>
              {([['leftColumn', 'Left'], ['rightInnerColumn', 'Right inner'], ['rightOuterColumn', 'Right outer'], ['bottomRow', 'Bottom']] as const)
                .filter(([id]) => id !== columnKey).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
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
                data-dock-group={grp.id} data-dock-tab={tabId}
                data-drop-tab={dropTab?.id === tabId ? dropTab.side : undefined}
                title={`${getPanelTitle(tabId)} (Click to open Flyout)`}
                onPointerDown={event => handleTabPointerDown(tabId, grp.id, event)}
                onClick={() => {
                  if (suppressTabClickRef.current) { suppressTabClickRef.current = false; return; }
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
                  outline: dropGroupId === grp.id ? '2px solid var(--ai-accent-blue)' : undefined,
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
              maxWidth: '32vw',
              overflowY: 'auto',
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
              maxWidth: '32vw',
              overflowY: 'auto',
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
          data-floating-id={win.id}
          className="ai-panel-shell"
          onPointerDownCapture={() => setFrontWindowId(win.id)}
          onPointerUpCapture={(event) => {
            if (win.minimized) return;
            const { width, height } = event.currentTarget.getBoundingClientRect();
            if (width < 220 || height < 160 || (Math.abs(width - win.width) < 1 && Math.abs(height - win.height) < 1)) return;
            setLayout(previous => ({ ...previous, floatingWindows: previous.floatingWindows.map(item => item.id === win.id ? { ...item, width, height } : item) }));
          }}
          style={{
            position: 'fixed',
            left: win.x,
            top: win.y,
            width: win.width,
            height: win.minimized ? 26 : win.height,
            boxShadow: 'var(--ai-shadow-floating)',
            borderRadius: 2,
            zIndex: frontWindowId === win.id ? 962 : 960,
            resize: win.minimized ? 'none' : 'both',
            minWidth: 220,
            minHeight: win.minimized ? 26 : 160,
            maxWidth: 'calc(100vw - 20px)',
            maxHeight: 'calc(100vh - 30px)',
          }}
        >
          {/* Floating Window Draggable Title Bar */}
          <div
            className="ai-panel-tabbar"
            onPointerDown={(e) => handleDragFloatingWindow(win.id, e)}
            style={{ cursor: 'move' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflowX: 'auto' }}>
              <span className="ai-floating-grip" title="Drag floating panel group" aria-label="Drag floating panel group">⠿</span>
              {win.tabs.map(tab => <button key={tab} type="button" className={`ai-panel-tab ${win.activeTab === tab ? 'active' : ''}`} onPointerDown={event => event.stopPropagation()} onClick={() => setLayout(prev => ({ ...prev, floatingWindows: prev.floatingWindows.map(item => item.id === win.id ? { ...item, activeTab: tab, minimized: false } : item) }))}>{getPanelTitle(tab)}</button>)}
            </div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 2, paddingRight: 3 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <select aria-label={`Dock ${getPanelTitle(win.activeTab)} panel`} title="Dock panel" value=""
                className="ai-panel-move-select" onChange={event => {
                  if (event.target.value) dockFloatingWindowBack(win.id, event.target.value as DockColumn);
                }}>
                <option value="">⇥</option>
                <option value="leftColumn">Left</option><option value="bottomRow">Bottom</option>
                <option value="rightInnerColumn">Right inner</option><option value="rightOuterColumn">Right outer</option>
              </select>
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
      <div className="ai-workspace-docks">
        {layout.leftColumn.length > 0 && <div className="ai-left-panel-column" aria-label="Left dock">
          {layout.leftColumn.map(group => renderTabGroupCard(group, 'leftColumn'))}
        </div>}
        <div className="ai-workspace-center">
          <div className="ai-workspace-canvas">{children}
            {draggingPanel && <>
              <div data-dock-destination="leftColumn" className={`ai-dock-drop ai-dock-drop-left ${dropDestination === 'leftColumn' ? 'active' : ''}`}>Dock left</div>
              <div data-dock-destination="bottomRow" className={`ai-dock-drop ai-dock-drop-bottom ${dropDestination === 'bottomRow' ? 'active' : ''}`}>Dock bottom</div>
            </>}
          </div>
          {layout.bottomRow.length > 0 && <div className="ai-bottom-panel-row" aria-label="Bottom dock">
            {layout.bottomRow.map(group => renderTabGroupCard(group, 'bottomRow'))}
          </div>}
        </div>
        {dockContent}
        {dragPreview && <div className="ai-panel-drag-preview" aria-hidden="true" style={{ left: dragPreview.x + 12, top: dragPreview.y + 12 }}><div>{getPanelTitle(dragPreview.panelId)}</div><span>Drag to dock or release to float</span></div>}
        {panelMenu && <div className="ai-dropdown-menu ai-panel-context-menu" role="menu" aria-label="Panel context menu" style={{ left: panelMenu.x, top: panelMenu.y }} onPointerDown={e => e.stopPropagation()}>
          <button type="button" role="menuitem" className="ai-dropdown-item" onClick={() => { tearOffTabToFloating(panelMenu.panelId, panelMenu.groupId); setPanelMenu(null); }}>Float panel</button>
          <button type="button" role="menuitem" className="ai-dropdown-item" onClick={() => {
            setLayout(previous => {
              const next: WorkspaceDockLayout = JSON.parse(JSON.stringify(previous));
              const groups = next[panelMenu.column];
              const group = groups.find(item => item.id === panelMenu.groupId);
              if (!group) return previous;
              group.tabs = group.tabs.filter(tab => tab !== panelMenu.panelId);
              if (group.activeTab === panelMenu.panelId) group.activeTab = group.tabs[0] || '';
              if (!group.tabs.length) groups.splice(groups.indexOf(group), 1);
              return next;
            });
            setPanelMenu(null);
          }}>Close panel</button>
        </div>}
      </div>
    );
  }

  return dockContent;
};

export default DockManager;
