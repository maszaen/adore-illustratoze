import React, { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../../state/useStudioStore';

/** Right-click targets artwork without starting a canvas gesture. */
export const CanvasContextMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useStudioStore();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!position) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setPosition(null); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setPosition(null); } };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key, true); };
  }, [position]);
  const selected = store.selectedIds.length;
  const items = [
    { label: 'Cut', shortcut: 'Ctrl+X', disabled: !selected, run: () => store.cutSelection() },
    { label: 'Copy', shortcut: 'Ctrl+C', disabled: !selected, run: () => store.copySelection() },
    { label: 'Paste', shortcut: 'Ctrl+V', disabled: !store.clipboardNodes.length, run: () => store.pasteClipboard('normal') },
    { label: 'Duplicate', disabled: !selected, run: () => store.duplicateSelectedNodes() },
    { label: 'Delete', shortcut: 'Delete', disabled: !selected, run: () => store.deleteSelectedNodes() },
    { label: 'Group', shortcut: 'Ctrl+G', disabled: selected < 2, run: () => store.groupSelection() },
    { label: 'Ungroup', shortcut: 'Shift+Ctrl+G', disabled: !selected, run: () => store.ungroupSelection() },
    { label: 'Bring to Front', disabled: !selected, run: () => store.bringToFront() },
    { label: 'Send to Back', disabled: !selected, run: () => store.sendToBack() },
    { label: 'Deselect', disabled: !selected, run: () => store.clearSelection() },
  ];
  return <div className="ai-canvas-context-surface" onPointerDownCapture={event => { if (event.button === 2) event.stopPropagation(); }} onContextMenu={event => {
    const target = event.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    const hit = (document.elementsFromPoint?.(event.clientX, event.clientY) || [event.target as Element])
      .map(element => element.closest<HTMLElement>('[data-vector-node-id]'))
      .find(element => element && store.getActiveDocument().nodes[element.dataset.vectorNodeId || ''] && !store.getActiveDocument().nodes[element.dataset.vectorNodeId || ''].locked);
    const id = hit?.dataset.vectorNodeId;
    if (id && !store.selectedIds.includes(id)) store.selectNodes([id], false);
    setPosition({ x: Math.max(4, Math.min(event.clientX, window.innerWidth - 230)), y: Math.max(4, Math.min(event.clientY, window.innerHeight - 260)) });
  }}>
    {children}
    {position && <div ref={menuRef} role="menu" aria-label="Canvas context menu" className="ai-dropdown-menu ai-canvas-context-menu" style={{ left: position.x, top: position.y }}>
      <div className="ai-context-caption">{selected ? `${selected} selected` : 'No selection'}</div>
      {items.map(item => <button key={item.label} type="button" role="menuitem" className="ai-dropdown-item" disabled={item.disabled} onClick={() => { setPosition(null); item.run(); }}><span>{item.label}</span>{item.shortcut && <span className="ai-shortcut">{item.shortcut}</span>}</button>)}
    </div>}
  </div>;
};
