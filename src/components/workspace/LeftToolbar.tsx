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

export const LeftToolbar: React.FC = () => {
  const store = useStudioStore() as any;

  const activeTool: ToolId = store.activeTool || 'select';
  const language: 'id' | 'en' = store.language || 'en';
  const drawingMode: DrawingMode = store.drawingMode || 'normal';
  const screenMode: ScreenMode = store.screenMode || 'normal';
  const hideAllPanels: boolean = Boolean(store.hideAllPanels);

  const [columns, setColumns] = useState<1 | 2>(() =>
    store.toolbarColumns === 1 ? 1 : 2
  );
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
      top: rect.top,
      left: rect.right + 3,
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
          x: (openFlyout?.left ?? 80) + 20,
          y: Math.max(68, openFlyout?.top ?? 120),
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
            ? { ...p, x: Math.max(4, origX + dx), y: Math.max(30, origY + dy) }
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
        style={{ position: 'relative', userSelect: 'none' }}
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
          <span
            style={{
              width: 10,
              height: 3,
              borderTop: '1px dotted var(--ai-text-muted)',
              borderBottom: '1px dotted var(--ai-text-muted)',
            }}
          />
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

        {/* Tool Buttons Grid */}
        <div className="ai-tool-grid">
          {TOOL_GROUPS.map((grp) => {
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
                title={toolTitle}
                onClick={(e) => {
                  if (openFlyout?.groupId === grp.id) {
                    setOpenFlyout(null);
                  } else {
                    selectTool(currentTool.id, grp.id);
                  }
                  e.stopPropagation();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openGroupFlyout(grp, e.currentTarget);
                }}
                onPointerDown={(e) => {
                  if (hasSubTools && e.button === 0) {
                    const targetEl = e.currentTarget;
                    longPressTimerRef.current = window.setTimeout(() => {
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
                      if (btn) openGroupFlyout(grp, btn);
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
              overflow: 'hidden',
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
