import React, { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import { TOOL_GROUPS, ToolGroup, ToolDefinition } from '../../core/tools/toolRegistry';
import { ToolIcon } from '../primitives/IllustratorIcons';
import { FillStrokeProxy } from '../primitives/FillStrokeProxy';
import type { ToolId, DrawingMode, ScreenMode } from '../../core/types';

interface FloatingToolPalette {
  groupId: string;
  label: string;
  tools: ToolDefinition[];
  x: number;
  y: number;
  vertical: boolean;
}

const TOOLBAR_STORAGE_KEY = 'adore.toolbar.v1';
interface ToolbarPreferences { columns: 1 | 2; position: { x: number; y: number } | null; order: string[] }
const defaultOrder = TOOL_GROUPS.map(group => group.id);
function readToolbarPreferences(): ToolbarPreferences {
  const defaults: ToolbarPreferences = { columns: 2, position: null, order: defaultOrder };
  try {
    const data = JSON.parse(localStorage.getItem(TOOLBAR_STORAGE_KEY) || 'null');
    if (!data || !Array.isArray(data.order)) return defaults;
    const known = data.order.filter((id: unknown): id is string => typeof id === 'string' && defaultOrder.includes(id));
    const order = [...new Set<string>(known), ...defaultOrder.filter(id => !known.includes(id))];
    const position = data.position && Number.isFinite(data.position.x) && Number.isFinite(data.position.y)
      ? { x: Math.max(0, Math.min(data.position.x, window.innerWidth - 64)), y: Math.max(0, Math.min(data.position.y, window.innerHeight - 50)) } : null;
    return { columns: data.columns === 1 ? 1 : 2, position, order };
  } catch { return defaults; }
}

export const LeftToolbar: React.FC = () => {
  const store = useStudioStore() as any;

  const activeTool: ToolId = store.activeTool || 'select';
  const language: 'id' | 'en' = store.language || 'en';
  const drawingMode: DrawingMode = store.drawingMode || 'normal';
  const screenMode: ScreenMode = store.screenMode || 'normal';
  const hideAllPanels: boolean = Boolean(store.hideAllPanels);

  const initialPrefs = useRef(readToolbarPreferences());
  const [columns, setColumns] = useState<1 | 2>(initialPrefs.current.columns);
  const [toolOrder, setToolOrder] = useState<string[]>(initialPrefs.current.order);
  const [customizing, setCustomizing] = useState(false);
  const draggedGroup = useRef<string | null>(null);
  const orderedGroups = toolOrder.map(id => TOOL_GROUPS.find(group => group.id === id)).filter((group): group is ToolGroup => Boolean(group));
  const moveGroup = (from: string, to: string) => setToolOrder(previous => {
    const source = previous.indexOf(from), target = previous.indexOf(to);
    if (source < 0 || target < 0 || source === target) return previous;
    const next = [...previous]; next.splice(source, 1); next.splice(target, 0, from); return next;
  });
  const [groupActiveTool, setGroupActiveTool] = useState<Record<string, ToolId>>(() => {
    const initial: Record<string, ToolId> = {};
    for (const grp of TOOL_GROUPS) {
      initial[grp.id] = grp.defaultToolId;
    }
    return initial;
  });

  const [openFlyout, setOpenFlyout] = useState<{
    groupId: string;
    top: number;
    left: number;
  } | null>(null);

  const [tornOffPalettes, setTornOffPalettes] = useState<FloatingToolPalette[]>([]);
  const [drawModeMenuOpen, setDrawModeMenuOpen] = useState(false);
  const [screenModeMenuOpen, setScreenModeMenuOpen] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(initialPrefs.current.position);
  useEffect(() => {
    try { localStorage.setItem(TOOLBAR_STORAGE_KEY, JSON.stringify({ columns, position: toolbarPosition, order: toolOrder })); } catch { /* Storage is optional. */ }
  }, [columns, toolbarPosition, toolOrder]);
  useEffect(() => {
    const clamp = () => setToolbarPosition(pos => pos ? { x: Math.max(0, Math.min(pos.x, window.innerWidth - 64)), y: Math.max(0, Math.min(pos.y, window.innerHeight - 50)) } : null);
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);
  const dragToolbar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || !toolbarRef.current) return;
    e.preventDefault();
    const rect = toolbarRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const move = (event: PointerEvent) => {
      setToolbarPosition({
        x: Math.max(0, Math.min(window.innerWidth - rect.width, rect.left + event.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - Math.min(rect.height, 60), rect.top + event.clientY - startY)),
      });
    };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Sync activeTool to its group's displayed icon
  useEffect(() => {
    for (const grp of TOOL_GROUPS) {
      const match = grp.tools.find((t) => t.id === activeTool);
      if (match) {
        setGroupActiveTool((prev) =>
          prev[grp.id] === match.id ? prev : { ...prev, [grp.id]: match.id }
        );
        break;
      }
    }
  }, [activeTool]);

  useEffect(() => {
    const reset = (event: Event) => {
      if ((event as CustomEvent).detail?.reset) {
        setToolbarPosition(null);
        setTornOffPalettes([]);
        setColumns(2);
        setToolOrder(defaultOrder);
        setCustomizing(false);
        store.setToolbarColumns?.(2);
      }
    };
    window.addEventListener('ai-workspace-preset', reset);
    return () => window.removeEventListener('ai-workspace-preset', reset);
  }, []);

  // Close flyouts when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenFlyout(null);
        setDrawModeMenuOpen(false);
        setScreenModeMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  if (hideAllPanels || screenMode === 'fullscreen') {
    return null;
  }

  const selectTool = (toolId: ToolId, groupId?: string) => {
    if (groupId) {
      setGroupActiveTool((prev) => ({ ...prev, [groupId]: toolId }));
    }
    if (typeof store.setActiveTool === 'function') {
      store.setActiveTool(toolId);
    } else {
      useStudioStore.setState({ activeTool: toolId } as any);
    }
    setOpenFlyout(null);
  };

  const setDrawingMode = (mode: DrawingMode) => {
    if (typeof store.setDrawingMode === 'function') {
      store.setDrawingMode(mode);
    } else {
      useStudioStore.setState({ drawingMode: mode } as any);
    }
    setDrawModeMenuOpen(false);
  };

  const setScreenMode = (mode: ScreenMode) => {
    if (typeof store.setScreenMode === 'function') {
      store.setScreenMode(mode);
    } else {
      useStudioStore.setState({ screenMode: mode } as any);
    }
    setScreenModeMenuOpen(false);
  };

  const toggleColumns = () => {
    const next: 1 | 2 = columns === 2 ? 1 : 2;
    setColumns(next);
    if (typeof store.setToolbarColumns === 'function') {
      store.setToolbarColumns(next);
    } else {
      useStudioStore.setState({ toolbarColumns: next } as any);
    }
  };

  const openGroupFlyout = (grp: ToolGroup, buttonEl: HTMLElement) => {
    if (grp.tools.length <= 1) return;
    const rect = buttonEl.getBoundingClientRect();
    setOpenFlyout({
      groupId: grp.id,
      top: Math.max(4, Math.min(rect.top, window.innerHeight - Math.min(grp.tools.length * 25 + 6, window.innerHeight - 8) - 4)),
      left: Math.max(4, Math.min(rect.right + 3, window.innerWidth - 230)),
    });
  };

  const handleTearOff = (grp: ToolGroup) => {
    setTornOffPalettes((prev) => {
      const exists = prev.find((p) => p.groupId === grp.id);
      if (exists) return prev;
      return [
        ...prev,
        {
          groupId: grp.id,
          label: grp.label,
          tools: grp.tools,
          x: Math.max(0, Math.min((openFlyout?.left ?? 80) + 20, window.innerWidth - Math.min(window.innerWidth, grp.tools.length * 28 + 40))),
          y: Math.max(0, Math.min(openFlyout?.top ?? 120, window.innerHeight - 40)),
          vertical: false,
        },
      ];
    });
    setOpenFlyout(null);
  };

  const handleDragPalette = (groupId: string, e: React.PointerEvent) => {
    e.preventDefault();
    const target = tornOffPalettes.find((p) => p.groupId === groupId);
    if (!target) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = target.x;
    const origY = target.y;

    const onMove = (mv: PointerEvent) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      setTornOffPalettes((prev) =>
        prev.map((p) =>
          p.groupId === groupId
            ? { ...p, x: Math.max(0, Math.min(window.innerWidth - 50, origX + dx)), y: Math.max(0, Math.min(window.innerHeight - 40, origY + dy)) }
            : p
        )
      );
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const activeFlyoutGroup = openFlyout
    ? TOOL_GROUPS.find((g) => g.id === openFlyout.groupId)
    : null;

  return (
    <>
      <aside
        ref={toolbarRef}
        className={`ai-left-toolbar ${columns === 2 ? 'cols-2' : 'cols-1'}`}
        style={toolbarPosition ? { position: 'fixed', left: toolbarPosition.x, top: toolbarPosition.y, maxHeight: 'calc(100vh - 30px)', zIndex: 950, boxShadow: 'var(--ai-shadow-floating)', userSelect: 'none' } : { position: 'relative', userSelect: 'none' }}
      >
        {/* Top Bar: 1-Col / 2-Col Collapse Toggle (<< / >>) */}
        <div
          style={{
            width: '100%',
            height: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 3px',
            marginBottom: 3,
            borderBottom: '1px solid var(--ai-border-strong)',
          }}
        >
          <button type="button" onPointerDown={dragToolbar} onDoubleClick={() => setToolbarPosition(null)}
            title="Drag to move toolbar; double-click to dock" aria-label="Move toolbar; double-click to dock"
            style={{ width: 20, height: 15, border: 0, background: 'transparent', color: 'var(--ai-text-secondary)', cursor: 'move', padding: 0 }}>⠿</button>
          {toolbarPosition && <button type="button" title="Dock toolbar" aria-label="Dock toolbar" onClick={() => setToolbarPosition(null)} style={{ border: 0, background: 'transparent', color: 'var(--ai-text-primary)', cursor: 'pointer' }}>⇥</button>}
          <button
            type="button"
            onClick={toggleColumns}
            title={columns === 2 ? 'Collapse to Single Column (<<)' : 'Expand to Two Columns (>>)'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ai-text-secondary)',
              fontSize: 9,
              fontWeight: 700,
              padding: 0,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            {columns === 2 ? '«' : '»'}
          </button>
        </div>

        <button type="button" className="ai-toolbar-customize" aria-pressed={customizing}
          title="Customize tool order" onClick={() => setCustomizing(value => !value)}>
          {customizing ? 'Done' : 'Edit'}
        </button>
        {customizing && <span className="ai-toolbar-hint" title="Drag tools or use arrow keys to reorder">↕</span>}

        {/* Tool Buttons Grid */}
        <div className="ai-tool-grid">
          {orderedGroups.map((grp) => {
            const currentToolId = groupActiveTool[grp.id] || grp.defaultToolId;
            const currentTool =
              grp.tools.find((t) => t.id === currentToolId) || grp.tools[0];
            const isGroupSelected = grp.tools.some((t) => t.id === activeTool);
            const hasSubTools = grp.tools.length > 1;
            const toolTitle = `${
              language === 'id' ? currentTool.nameId : currentTool.name
            }${currentTool.shortcut ? ` (${currentTool.shortcut})` : ''}${
              hasSubTools ? ' — Right-click or hold for sub-tools' : ''
            }`;

            return (
              <button
                key={grp.id}
                type="button"
                className={`ai-tool-btn ${isGroupSelected ? 'active' : ''}`}
                title={customizing ? `${toolTitle} — drag or use arrow keys to reorder` : toolTitle}
                draggable={customizing}
                aria-label={toolTitle}
                onDragStart={(e) => { if (!customizing) return; draggedGroup.current = grp.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', grp.id); }}
                onDragOver={(e) => { if (customizing && draggedGroup.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                onDrop={(e) => { e.preventDefault(); if (draggedGroup.current) moveGroup(draggedGroup.current, grp.id); draggedGroup.current = null; }}
                onDragEnd={() => { draggedGroup.current = null; }}
                onKeyDown={(e) => {
                  if (!customizing || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                  e.preventDefault();
                  const index = toolOrder.indexOf(grp.id);
                  const delta = e.key === 'ArrowUp' ? -columns : e.key === 'ArrowDown' ? columns : e.key === 'ArrowLeft' ? -1 : 1;
                  const target = toolOrder[index + delta]; if (target) moveGroup(grp.id, target);
                }}
                onClick={(e) => {
                  if (customizing) { e.stopPropagation(); return; }
                  if (didLongPressRef.current) { didLongPressRef.current = false; e.stopPropagation(); return; }
                  if (openFlyout?.groupId === grp.id) {
                    setOpenFlyout(null);
                  } else {
                    selectTool(currentTool.id, grp.id);
                  }
                  e.stopPropagation();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!customizing) openGroupFlyout(grp, e.currentTarget);
                }}
                onPointerDown={(e) => {
                  didLongPressRef.current = false;
                  if (customizing) return;
                  if (hasSubTools && e.button === 0) {
                    const targetEl = e.currentTarget;
                    longPressTimerRef.current = window.setTimeout(() => {
                      didLongPressRef.current = true;
                      openGroupFlyout(grp, targetEl);
                    }, 320);
                  }
                }}
                onPointerUp={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onPointerLeave={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
              >
                <ToolIcon
                  toolId={currentTool.id}
                  iconName={currentTool.iconName}
                  badge={currentTool.badge}
                  size={15}
                />
                {hasSubTools && (
                  <span
                    className="ai-tool-flyout-corner"
                    onClick={(e) => {
                      e.stopPropagation();
                      const btn = e.currentTarget.parentElement;
                      if (btn && !customizing) openGroupFlyout(grp, btn);
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div
          style={{
            width: '82%',
            height: 1,
            backgroundColor: 'var(--ai-border-strong)',
            margin: '6px 0',
          }}
        />

        {/* Overlapping Fill & Stroke Proxy */}
        <FillStrokeProxy compact={columns === 1} />

        {/* Divider */}
        <div
          style={{
            width: '82%',
            height: 1,
            backgroundColor: 'var(--ai-border-strong)',
            margin: '6px 0 4px',
          }}
        />

        {/* Bottom Mode Controls: Drawing Modes (Shift+D) & Screen Modes (F) */}
        <div
          style={{
            display: 'flex',
            flexDirection: columns === 2 ? 'row' : 'column',
            gap: 2,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Drawing Mode Button */}
          <button
            type="button"
            className="ai-icon-btn"
            title={`Drawing Mode: Draw ${
              drawingMode.charAt(0).toUpperCase() + drawingMode.slice(1)
            } (Shift+D)`}
            onClick={() => {
              setDrawModeMenuOpen((v) => !v);
              setScreenModeMenuOpen(false);
            }}
            onDoubleClick={() => {
              const order: DrawingMode[] = ['normal', 'behind', 'inside'];
              const next = order[(order.indexOf(drawingMode) + 1) % order.length];
              setDrawingMode(next);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect
                x="2"
                y="2"
                width="7.5"
                height="7.5"
                fill={drawingMode === 'normal' ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.1"
              />
              <circle
                cx="9.5"
                cy="9.5"
                r="3.8"
                fill={drawingMode === 'behind' ? 'var(--ai-accent-blue)' : 'var(--ai-bg-toolbar)'}
                stroke="currentColor"
                strokeWidth="1.1"
              />
              {drawingMode === 'inside' && (
                <path
                  d="M1 3V1H3M12 1H14V3M1 12V14H3M12 14H14V12"
                  stroke="var(--ai-accent-blue)"
                  strokeWidth="1.2"
                />
              )}
            </svg>
          </button>

          {/* Screen Mode Button */}
          <button
            type="button"
            className="ai-icon-btn"
            title={`Screen Mode: ${screenMode} (F)`}
            onClick={() => {
              setScreenModeMenuOpen((v) => !v);
              setDrawModeMenuOpen(false);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="1.5" y="2.5" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <line x1="1.5" y1="5" x2="13.5" y2="5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>

          {/* Drawing Modes Popup Menu */}
          {drawModeMenuOpen && (
            <div
              className="ai-dropdown-menu"
              style={{
                left: columns === 2 ? 62 : 34,
                bottom: 0,
                top: 'auto',
                minWidth: 165,
              }}
            >
              {(
                [
                  { id: 'normal', label: 'Draw Normal', desc: 'Default stacking' },
                  { id: 'behind', label: 'Draw Behind', desc: 'Behind all/selected' },
                  { id: 'inside', label: 'Draw Inside', desc: 'Inside selected mask' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="ai-dropdown-item"
                  onClick={() => setDrawingMode(m.id)}
                >
                  <span>
                    {drawingMode === m.id ? '✓ ' : '   '}
                    {m.label}
                  </span>
                  <span className="ai-shortcut">Shift+D</span>
                </button>
              ))}
            </div>
          )}

          {/* Screen Modes Popup Menu */}
          {screenModeMenuOpen && (
            <div
              className="ai-dropdown-menu"
              style={{
                left: columns === 2 ? 62 : 34,
                bottom: 0,
                top: 'auto',
                minWidth: 210,
              }}
            >
              {(
                [
                  { id: 'normal', label: 'Normal Screen Mode' },
                  { id: 'fullscreen-menu', label: 'Full Screen Mode with Menu Bar' },
                  { id: 'fullscreen', label: 'Full Screen Mode' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="ai-dropdown-item"
                  onClick={() => setScreenMode(m.id)}
                >
                  <span>
                    {screenMode === m.id ? '✓ ' : '   '}
                    {m.label}
                  </span>
                  <span className="ai-shortcut">F</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sub-Tool Flyout Menu with Right-Edge Tear-Off Bar */}
        {activeFlyoutGroup && openFlyout && (
          <div
            style={{
              position: 'fixed',
              left: openFlyout.left,
              top: openFlyout.top,
              backgroundColor: 'var(--ai-bg-menu)',
              border: '1px solid var(--ai-border-strong)',
              boxShadow: 'var(--ai-shadow-menu)',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'stretch',
              zIndex: 1200,
              maxHeight: 'calc(100vh - 8px)',
              maxWidth: 'calc(100vw - 8px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
              {activeFlyoutGroup.tools.map((subTool) => {
                const isSelected = activeTool === subTool.id;
                return (
                  <button
                    key={subTool.id}
                    type="button"
                    onClick={() => selectTool(subTool.id, activeFlyoutGroup.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      height: 25,
                      padding: '0 10px',
                      background: isSelected ? 'var(--ai-accent-blue)' : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--ai-text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <ToolIcon
                        toolId={subTool.id}
                        iconName={subTool.iconName}
                        badge={subTool.badge}
                        size={14}
                      />
                      <span>{language === 'id' ? subTool.nameId : subTool.name}</span>
                    </span>
                    {subTool.shortcut && (
                      <span
                        style={{
                          fontSize: 10,
                          opacity: 0.75,
                          marginLeft: 8,
                        }}
                      >
                        {subTool.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Authentic Illustrator Right-Edge Tear-Off Bar */}
            <button
              type="button"
              onClick={() => handleTearOff(activeFlyoutGroup)}
              title="Tear Off Tool Group into Floating Palette"
              style={{
                width: 13,
                backgroundColor: 'var(--ai-bg-panel-header)',
                border: 'none',
                borderLeft: '1px solid var(--ai-border-strong)',
                color: 'var(--ai-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              <span
                style={{
                  width: 3,
                  height: 16,
                  borderLeft: '1px dotted currentColor',
                  borderRight: '1px dotted currentColor',
                }}
              />
            </button>
          </div>
        )}
      </aside>

      {/* Torn-Off Floating Mini Tool Palettes on Canvas */}
      {tornOffPalettes.map((palette) => (
        <div
          key={palette.groupId}
          style={{
            position: 'fixed',
            left: palette.x,
            top: palette.y,
            backgroundColor: 'var(--ai-bg-toolbar)',
            border: '1px solid var(--ai-border-strong)',
            boxShadow: 'var(--ai-shadow-floating)',
            borderRadius: 2,
            zIndex: 950,
            display: 'flex',
            flexDirection: palette.vertical ? 'column' : 'row',
            alignItems: 'stretch',
            maxWidth: 'calc(100vw - 8px)',
            maxHeight: 'calc(100vh - 8px)',
            overflow: 'auto',
            userSelect: 'none',
          }}
        >
          {/* Floating Palette Drag Handle Bar */}
          <div
            onPointerDown={(e) => handleDragPalette(palette.groupId, e)}
            title={`${palette.label} (Drag to move, double-click to flip orientation)`}
            onDoubleClick={() =>
              setTornOffPalettes((prev) =>
                prev.map((p) =>
                  p.groupId === palette.groupId ? { ...p, vertical: !p.vertical } : p
                )
              )
            }
            style={{
              backgroundColor: 'var(--ai-bg-panel-header)',
              borderRight: palette.vertical ? 'none' : '1px solid var(--ai-border-strong)',
              borderBottom: palette.vertical ? '1px solid var(--ai-border-strong)' : 'none',
              padding: palette.vertical ? '2px 4px' : '4px 3px',
              cursor: 'move',
              display: 'flex',
              flexDirection: palette.vertical ? 'row' : 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: 'var(--ai-text-secondary)',
                lineHeight: 1,
              }}
            >
              ⋮
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTornOffPalettes((prev) =>
                  prev.filter((p) => p.groupId !== palette.groupId)
                );
              }}
              title="Close Floating Tool Palette"
              style={{
                width: 11,
                height: 11,
                padding: 0,
                background: 'transparent',
                border: 'none',
                color: 'var(--ai-text-secondary)',
                fontSize: 10,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>

          {/* Floating Tool Icons */}
          <div
            style={{
              display: 'flex',
              flexDirection: palette.vertical ? 'column' : 'row',
              padding: 2,
              gap: 1,
            }}
          >
            {palette.tools.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className={`ai-tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                title={`${tool.name}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
                onClick={() => selectTool(tool.id, palette.groupId)}
              >
                <ToolIcon
                  toolId={tool.id}
                  iconName={tool.iconName}
                  badge={tool.badge}
                  size={15}
                />
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default LeftToolbar;
