import { useEffect } from 'react';
import { useStudioStore, type StudioStoreState } from '../../state/useStudioStore';
import type { ToolId } from '../types';
import { exportDocumentAsAdlozeFile } from '../io/adlozeIo';
import { saveProjectToDb } from '../io/db';

export interface ShortcutDefinition {
  id: string;
  key: string;
  description: string;
  category: 'tools' | 'proxy-modes' | 'edit' | 'object' | 'type' | 'view' | 'panels' | 'file';
}

export const ILLUSTRATOR_SHORTCUT_CATALOG: ShortcutDefinition[] = [
  // Tools
  { id: 'tool-select', key: 'V', description: 'Selection Tool', category: 'tools' },
  { id: 'tool-direct-select', key: 'A', description: 'Direct Selection Tool', category: 'tools' },
  { id: 'tool-group-select', key: 'Shift+A', description: 'Group Selection Tool', category: 'tools' },
  { id: 'tool-magic-wand', key: 'Y', description: 'Magic Wand Tool', category: 'tools' },
  { id: 'tool-lasso', key: 'Q', description: 'Lasso Tool', category: 'tools' },
  { id: 'tool-pen', key: 'P', description: 'Pen Tool', category: 'tools' },
  { id: 'tool-add-anchor', key: '+', description: 'Add Anchor Point Tool', category: 'tools' },
  { id: 'tool-delete-anchor', key: '-', description: 'Delete Anchor Point Tool', category: 'tools' },
  { id: 'tool-anchor-point', key: 'Shift+C', description: 'Anchor Point Tool', category: 'tools' },
  { id: 'tool-curvature', key: 'Shift+~', description: 'Curvature Tool', category: 'tools' },
  { id: 'tool-type', key: 'T', description: 'Type Tool', category: 'tools' },
  { id: 'tool-touch-type', key: 'Shift+T', description: 'Touch Type Tool', category: 'tools' },
  { id: 'tool-line', key: '\\', description: 'Line Segment Tool', category: 'tools' },
  { id: 'tool-rectangle', key: 'M', description: 'Rectangle Tool', category: 'tools' },
  { id: 'tool-ellipse', key: 'L', description: 'Ellipse Tool', category: 'tools' },
  { id: 'tool-paintbrush', key: 'B', description: 'Paintbrush Tool', category: 'tools' },
  { id: 'tool-blob-brush', key: 'Shift+B', description: 'Blob Brush Tool', category: 'tools' },
  { id: 'tool-pencil', key: 'N', description: 'Pencil Tool', category: 'tools' },
  { id: 'tool-eraser', key: 'Shift+E', description: 'Eraser Tool', category: 'tools' },
  { id: 'tool-scissors', key: 'C', description: 'Scissors Tool', category: 'tools' },
  { id: 'tool-rotate', key: 'R', description: 'Rotate Tool', category: 'tools' },
  { id: 'tool-reflect', key: 'O', description: 'Reflect Tool', category: 'tools' },
  { id: 'tool-scale', key: 'S', description: 'Scale Tool', category: 'tools' },
  { id: 'tool-width', key: 'Shift+W', description: 'Width Tool', category: 'tools' },
  { id: 'tool-warp', key: 'Shift+R', description: 'Warp Tool', category: 'tools' },
  { id: 'tool-free-transform', key: 'E', description: 'Free Transform Tool', category: 'tools' },
  { id: 'tool-shape-builder', key: 'Shift+M', description: 'Shape Builder Tool', category: 'tools' },
  { id: 'tool-live-paint-bucket', key: 'K', description: 'Live Paint Bucket', category: 'tools' },
  { id: 'tool-live-paint-select', key: 'Shift+L', description: 'Live Paint Selection Tool', category: 'tools' },
  { id: 'tool-perspective-grid', key: 'Shift+P', description: 'Perspective Grid Tool', category: 'tools' },
  { id: 'tool-perspective-select', key: 'Shift+V', description: 'Perspective Selection Tool', category: 'tools' },
  { id: 'tool-mesh', key: 'U', description: 'Mesh Tool', category: 'tools' },
  { id: 'tool-gradient', key: 'G', description: 'Gradient Tool', category: 'tools' },
  { id: 'tool-eyedropper', key: 'I', description: 'Eyedropper Tool', category: 'tools' },
  { id: 'tool-blend', key: 'W', description: 'Blend Tool', category: 'tools' },
  { id: 'tool-symbol-sprayer', key: 'Shift+S', description: 'Symbol Sprayer Tool', category: 'tools' },
  { id: 'tool-column-graph', key: 'J', description: 'Column Graph Tool', category: 'tools' },
  { id: 'tool-artboard', key: 'Shift+O', description: 'Artboard Tool', category: 'tools' },
  { id: 'tool-slice', key: 'Shift+K', description: 'Slice Tool', category: 'tools' },
  { id: 'tool-hand', key: 'H', description: 'Hand Tool', category: 'tools' },
  { id: 'tool-zoom', key: 'Z', description: 'Zoom Tool', category: 'tools' },

  // Proxy & Modes
  { id: 'proxy-toggle', key: 'X', description: 'Toggle Fill / Stroke Focus', category: 'proxy-modes' },
  { id: 'proxy-swap', key: 'Shift+X', description: 'Swap Fill and Stroke Colors', category: 'proxy-modes' },
  { id: 'proxy-default', key: 'D', description: 'Default Fill (White) & Stroke (Black 1pt)', category: 'proxy-modes' },
  { id: 'proxy-solid', key: '<', description: 'Apply Solid Color to Active Proxy', category: 'proxy-modes' },
  { id: 'proxy-gradient', key: '>', description: 'Apply Gradient to Active Proxy', category: 'proxy-modes' },
  { id: 'proxy-none', key: '/', description: 'Apply None (Transparent) to Active Proxy', category: 'proxy-modes' },
  { id: 'mode-drawing', key: 'Shift+D', description: 'Cycle Drawing Modes (Normal / Behind / Inside)', category: 'proxy-modes' },
  { id: 'mode-screen', key: 'F', description: 'Cycle Screen Modes', category: 'proxy-modes' },
];

/**
 * Checks whether the event originated inside an interactive text input, textarea,
 * select, or contentEditable element where single-key shortcuts should be suppressed.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as HTMLElement;
  const tagName = el.tagName ? el.tagName.toUpperCase() : '';
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    const inputEl = el as HTMLInputElement;
    if (tagName === 'INPUT') {
      const type = (inputEl.type || 'text').toLowerCase();
      // Color, checkbox, radio, range, button inputs don't take freeform text typing,
      // but text, number, search, password, email, url, tel do.
      if (['button', 'checkbox', 'radio', 'color', 'file', 'range', 'submit', 'reset'].includes(type)) {
        return false;
      }
    }
    return true;
  }
  if (el.isContentEditable) return true;
  if (typeof el.closest === 'function' && el.closest('[contenteditable="true"]')) {
    return true;
  }
  return false;
}

const SINGLE_KEY_TOOL_MAP: Record<string, ToolId> = {
  v: 'select',
  a: 'direct-select',
  y: 'magic-wand',
  q: 'lasso',
  p: 'pen',
  t: 'type',
  '\\': 'line',
  m: 'rectangle',
  l: 'ellipse',
  b: 'paintbrush',
  n: 'pencil',
  c: 'scissors',
  r: 'rotate',
  o: 'reflect',
  s: 'scale',
  e: 'free-transform',
  k: 'live-paint-bucket',
  u: 'mesh',
  g: 'gradient',
  i: 'eyedropper',
  w: 'blend',
  j: 'column-graph',
  h: 'hand',
  z: 'zoom',
};

const SHIFT_KEY_TOOL_MAP: Record<string, ToolId> = {
  a: 'group-select',
  c: 'anchor-point',
  t: 'touch-type',
  b: 'blob-brush',
  e: 'eraser',
  w: 'width',
  r: 'warp',
  m: 'shape-builder',
  l: 'live-paint-select',
  p: 'perspective-grid',
  v: 'perspective-select',
  s: 'symbol-sprayer',
  o: 'artboard',
  k: 'slice',
};

/**
 * Processes a KeyboardEvent against the full Adobe Illustrator CC shortcut table.
 * Returns true if a shortcut was matched and handled.
 */
export function handleIllustratorShortcutKeyDown(
  e: KeyboardEvent,
  storeOverride?: StudioStoreState
): boolean {
  if (isEditableTarget(e.target)) {
    // Allow Escape to blur active input
    if (e.key === 'Escape' && e.target && typeof (e.target as HTMLElement).blur === 'function') {
      (e.target as HTMLElement).blur();
      return true;
    }
    return false;
  }

  const store = storeOverride ?? useStudioStore.getState();
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt = e.altKey;
  const key = e.key;
  const lower = key.toLowerCase();
  const code = e.code || '';

  // =========================================================================
  // 1. ESCAPE & DELETE / BACKSPACE & TAB
  // =========================================================================
  if (key === 'Escape') {
    e.preventDefault();
    if (store.activeModal) {
      store.setActiveModal(null);
      return true;
    }
    if (store.patternEditId) {
      store.exitPatternEditMode(true);
      return true;
    }
    if (store.isolationGroupId || store.isolatedGroupId) {
      store.exitIsolationMode();
      return true;
    }
    window.dispatchEvent(new CustomEvent('ai-cancel-active-path'));
    store.clearSelection();
    return true;
  }

  if (!ctrl && !alt && (key === 'Delete' || key === 'Backspace')) {
    if (store.selectedNodeIds.length > 0) {
      e.preventDefault();
      store.deleteSelectedNodes();
      return true;
    }
    return false;
  }

  if (!ctrl && !alt && key === 'Tab') {
    e.preventDefault();
    if (shift) {
      // Shift+Tab: Hide/Show Dock Panels only
      window.dispatchEvent(new CustomEvent('ai-toggle-dock-panels'));
      store.setStatusMessage('Toggled Dock Panels (Shift+Tab)');
    } else {
      // Tab: Hide/Show All Panels & Toolbars
      store.toggleHideAllPanels();
    }
    return true;
  }

  // =========================================================================
  // 2. CTRL / CMD SHORTCUTS (WITH OPTIONAL SHIFT / ALT)
  // =========================================================================
  if (ctrl) {
    // Undo / Redo: Ctrl+Z / Shift+Ctrl+Z
    if (!alt && lower === 'z') {
      e.preventDefault();
      if (shift) {
        store.redo();
      } else {
        store.undo();
      }
      return true;
    }

    // Outline / Preview Toggle: Ctrl+Y
    if (!alt && !shift && lower === 'y') {
      e.preventDefault();
      store.toggleOutlineMode();
      return true;
    }

    // Group / Ungroup: Ctrl+G / Shift+Ctrl+G
    if (!alt && lower === 'g') {
      e.preventDefault();
      if (shift) {
        store.ungroupSelection();
      } else {
        store.groupSelection();
      }
      return true;
    }

    // Lock / Unlock All: Ctrl+2 / Alt+Ctrl+2
    if (!shift && (key === '2' || code === 'Digit2')) {
      e.preventDefault();
      if (alt) {
        store.unlockAll();
      } else {
        store.lockSelection();
      }
      return true;
    }

    // Hide / Show All: Ctrl+3 / Alt+Ctrl+3
    if (!shift && (key === '3' || code === 'Digit3')) {
      e.preventDefault();
      if (alt) {
        store.showAll();
      } else {
        store.hideSelection();
      }
      return true;
    }

    // Make / Release Guides: Ctrl+5 / Alt+Ctrl+5
    if (!shift && (key === '5' || code === 'Digit5')) {
      e.preventDefault();
      if (alt) {
        store.releaseGuides();
      } else {
        store.makeGuidesFromSelection();
      }
      return true;
    }

    // Reselect: Ctrl+6
    if (!shift && !alt && (key === '6' || code === 'Digit6')) {
      e.preventDefault();
      store.reselect();
      return true;
    }

    // Clipping Mask Make / Release: Ctrl+7 / Alt+Ctrl+7
    if (!shift && (key === '7' || code === 'Digit7')) {
      e.preventDefault();
      if (alt) {
        store.releaseClippingMask();
      } else {
        store.makeClippingMask();
      }
      return true;
    }

    // Compound Path Make / Release: Ctrl+8 / Alt+Shift+Ctrl+8 (or Alt+Ctrl+8)
    if (key === '8' || code === 'Digit8' || (shift && key === '*')) {
      e.preventDefault();
      if (alt) {
        store.releaseCompoundPath();
      } else if (!shift) {
        store.makeCompoundPath();
      }
      return true;
    }

    // Fit Artboard / Fit All Artboards: Ctrl+0 / Alt+Ctrl+0
    if (!shift && (key === '0' || code === 'Digit0')) {
      e.preventDefault();
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      if (alt) {
        store.fitAllArtboardsInWindow(vw, vh);
      } else {
        store.fitArtboardInWindow(vw, vh);
      }
      return true;
    }

    // Actual Size 100%: Ctrl+1
    if (!shift && !alt && (key === '1' || code === 'Digit1')) {
      e.preventDefault();
      store.actualSize();
      return true;
    }

    // Zoom In / Out: Ctrl++ / Ctrl+= / Ctrl+-
    if (!alt && (key === '+' || key === '=' || code === 'Equal')) {
      e.preventDefault();
      store.zoomIn();
      return true;
    }
    if (!alt && (key === '-' || key === '_' || code === 'Minus')) {
      e.preventDefault();
      store.zoomOut();
      return true;
    }

    // Transform Again / Transparency Grid / Transform Each: Ctrl+D / Shift+Ctrl+D / Alt+Shift+Ctrl+D
    if (lower === 'd') {
      e.preventDefault();
      if (alt && shift) {
        store.setActiveModal('transform-each');
      } else if (shift && !alt) {
        store.toggleTransparencyGrid();
      } else if (!shift && !alt) {
        store.transformAgain();
      }
      return true;
    }

    // Join / Average: Ctrl+J / Alt+Ctrl+J / Shift+Alt+Ctrl+J
    if (lower === 'j') {
      e.preventDefault();
      if (alt && shift) {
        store.joinSelectedPaths(true);
      } else if (alt) {
        store.averageSelectedAnchors('both');
      } else if (!shift) {
        store.joinSelectedPaths(false);
      }
      return true;
    }

    // Create Outlines / Open File: Shift+Ctrl+O / Ctrl+O
    if (!alt && lower === 'o') {
      e.preventDefault();
      if (shift) {
        store.createOutlinesFromSelection();
      } else {
        window.dispatchEvent(new CustomEvent('ai-trigger-open-file'));
      }
      return true;
    }

    // New Document: Ctrl+N
    if (!alt && !shift && lower === 'n') {
      e.preventDefault();
      store.setActiveModal('new-document');
      return true;
    }

    // Save Project / Save for Web: Ctrl+S / Alt+Shift+Ctrl+S
    if (lower === 's') {
      e.preventDefault();
      if (alt && shift) {
        store.setActiveModal('save-for-web');
      } else if (!alt && !shift) {
        const doc = store.getActiveDocument();
        saveProjectToDb(doc).catch(() => {});
        exportDocumentAsAdlozeFile(doc);
        store.setStatusMessage(`Saved "${doc.name}"`);
      }
      return true;
    }

    // Export for Screens: Alt+Ctrl+E
    if (alt && !shift && lower === 'e') {
      e.preventDefault();
      store.setActiveModal('export-screens');
      return true;
    }

    // Select All / All on Active Artboard / Deselect: Ctrl+A / Alt+Ctrl+A / Shift+Ctrl+A
    if (lower === 'a') {
      e.preventDefault();
      if (shift && !alt) {
        store.clearSelection();
      } else if (alt && !shift) {
        store.selectAllOnActiveArtboard();
      } else if (!shift && !alt) {
        store.selectAll();
      }
      return true;
    }

    // Copy: Ctrl+C / Make Envelope Top Object: Alt+Ctrl+C
    if (!shift && lower === 'c') {
      e.preventDefault();
      if (alt) {
        store.makeEnvelopeTopObject();
      } else {
        store.copySelection();
      }
      return true;
    }

    // Cut / Make Live Paint Group: Ctrl+X / Alt+Ctrl+X
    if (!shift && lower === 'x') {
      e.preventDefault();
      if (alt) {
        store.makeLivePaintGroup();
      } else {
        store.cutSelection();
      }
      return true;
    }

    // Paste / Paste in Place / Paste on All Artboards: Ctrl+V / Shift+Ctrl+V / Alt+Shift+Ctrl+V
    if (lower === 'v') {
      e.preventDefault();
      if (alt && shift) {
        store.pasteClipboard('all-artboards');
      } else if (shift && !alt) {
        store.pasteClipboard('in-place');
      } else if (!shift && !alt) {
        store.pasteClipboard('normal');
      }
      return true;
    }

    // Paste in Front: Ctrl+F
    if (!alt && !shift && lower === 'f') {
      e.preventDefault();
      store.pasteClipboard('in-front');
      return true;
    }

    // Paste in Back / Bounding Box / Make Blend: Ctrl+B / Shift+Ctrl+B / Alt+Ctrl+B
    if (lower === 'b') {
      e.preventDefault();
      if (shift && !alt) {
        store.toggleBoundingBox();
      } else if (alt && !shift) {
        store.makeBlend();
      } else if (!shift && !alt) {
        store.pasteClipboard('in-back');
      }
      return true;
    }

    // Arrange: Ctrl+] / Ctrl+[ / Shift+Ctrl+] / Shift+Ctrl+[
    if (!alt && (key === ']' || key === '}' || code === 'BracketRight')) {
      e.preventDefault();
      if (shift) {
        store.bringToFront();
      } else {
        store.bringForward();
      }
      return true;
    }
    if (!alt && (key === '[' || key === '{' || code === 'BracketLeft')) {
      e.preventDefault();
      if (shift) {
        store.sendToBack();
      } else {
        store.sendBackward();
      }
      return true;
    }

    // Rulers: Ctrl+R
    if (!alt && !shift && lower === 'r') {
      e.preventDefault();
      store.toggleRulers();
      return true;
    }

    // Smart Guides: Ctrl+U
    if (!alt && !shift && lower === 'u') {
      e.preventDefault();
      store.toggleSmartGuides();
      return true;
    }

    // Grid / Snap to Grid: Ctrl+' / Shift+Ctrl+'
    if (!alt && (key === "'" || key === '"' || code === 'Quote')) {
      e.preventDefault();
      if (shift) {
        store.toggleSnapToGrid();
      } else {
        store.toggleGrid();
      }
      return true;
    }

    // Guides / Lock Guides: Ctrl+; / Alt+Ctrl+;
    if (!shift && (key === ';' || key === ':' || code === 'Semicolon')) {
      e.preventDefault();
      if (alt) {
        store.toggleLockGuides();
      } else {
        store.toggleGuides();
      }
      return true;
    }

    // Hide/Show Edges: Ctrl+H
    if (!alt && !shift && lower === 'h') {
      e.preventDefault();
      store.toggleEdges();
      return true;
    }

    // Perspective Grid Toggle: Shift+Ctrl+I
    if (!alt && shift && lower === 'i') {
      e.preventDefault();
      store.togglePerspectiveGrid();
      return true;
    }

    // Preferences / Keyboard Shortcuts: Ctrl+K / Alt+Shift+Ctrl+K
    if (lower === 'k') {
      e.preventDefault();
      if (alt && shift) {
        store.setActiveModal('keyboard-shortcuts');
      } else if (!alt && !shift) {
        store.setActiveModal('preferences');
      }
      return true;
    }

    // Envelope Warp: Alt+Shift+Ctrl+W
    if (alt && shift && lower === 'w') {
      e.preventDefault();
      store.setActiveModal('envelope-warp');
      return true;
    }

    // Envelope Mesh: Alt+Ctrl+M
    if (alt && !shift && lower === 'm') {
      e.preventDefault();
      store.setActiveModal('envelope-mesh');
      return true;
    }

    // Character Panel: Ctrl+T
    if (!alt && !shift && lower === 't') {
      e.preventDefault();
      store.togglePanelVisibility('character');
      window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId: 'character' } }));
      return true;
    }

    // Place Artwork: Shift+Ctrl+P
    if (!alt && shift && lower === 'p') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('ai-trigger-place-file'));
      return true;
    }

    return false;
  }

  // Ignore Alt-only combinations for single-key shortcuts
  if (alt) return false;

  // =========================================================================
  // 3. FUNCTION KEYS (PANELS)
  // =========================================================================
  if (key === 'F5') {
    e.preventDefault();
    const panelId = shift ? 'graphic-styles' : 'brushes';
    store.togglePanelVisibility(panelId);
    window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId } }));
    return true;
  }
  if (key === 'F6') {
    e.preventDefault();
    const panelId = shift ? 'appearance' : 'color';
    store.togglePanelVisibility(panelId);
    window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId } }));
    return true;
  }
  if (key === 'F7') {
    e.preventDefault();
    const panelId = shift ? 'align' : 'layers';
    store.togglePanelVisibility(panelId);
    window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId } }));
    return true;
  }
  if (key === 'F8') {
    e.preventDefault();
    if (shift) {
      store.togglePanelVisibility('transform');
      window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId: 'transform' } }));
    } else {
      store.addSymbolFromSelection();
    }
    return true;
  }

  // =========================================================================
  // 4. ARROW KEYS (PRECISION NUDGE)
  // =========================================================================
  if (
    key === 'ArrowUp' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowRight'
  ) {
    if (store.selectedNodeIds.length > 0) {
      e.preventDefault();
      const step = shift ? 10 : 1;
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
      store.updateNodes(
        store.selectedNodeIds,
        (n) => {
          n.x += dx;
          n.y += dy;
          n.points = (n.points || []).map((pt) => ({
            ...pt,
            x: pt.x + dx,
            y: pt.y + dy,
            handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
            handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
          }));
        },
        `Nudge (${dx}, ${dy})`
      );
      return true;
    }
    return false;
  }

  // =========================================================================
  // 5. FILL / STROKE PROXY & DRAWING / SCREEN MODES
  // =========================================================================
  // X / Shift+X: Toggle Proxy Focus / Swap Fill & Stroke
  if (lower === 'x') {
    e.preventDefault();
    if (shift) {
      store.swapFillAndStroke();
    } else {
      store.toggleActiveProxy();
    }
    return true;
  }

  // D / Shift+D: Default Fill & Stroke / Cycle Drawing Modes
  if (lower === 'd') {
    e.preventDefault();
    if (shift) {
      store.cycleDrawingMode();
    } else {
      store.resetDefaultFillAndStroke();
    }
    return true;
  }

  // F: Cycle Screen Modes
  if (!shift && lower === 'f') {
    e.preventDefault();
    store.cycleScreenMode();
    return true;
  }

  // < or , : Apply Solid Color to Active Proxy
  if (key === '<' || (!shift && key === ',')) {
    e.preventDefault();
    if (store.activeProxy === 'fill') {
      const solidColor =
        store.currentFillColor && store.currentFillColor !== 'none'
          ? store.currentFillColor
          : '#ff9a00';
      store.setCurrentFillColor(solidColor);
    } else {
      const solidStroke =
        store.currentStrokeColor && store.currentStrokeColor !== 'none'
          ? store.currentStrokeColor
          : '#1e1b4b';
      store.setCurrentStrokeColor(solidStroke);
    }
    return true;
  }

  // > or . : Apply Gradient to Active Proxy
  if (key === '>' || (!shift && key === '.')) {
    e.preventDefault();
    store.applyGradientToProxy();
    return true;
  }

  // / or ? : Set Active Proxy to None
  if (key === '/' || key === '?') {
    e.preventDefault();
    store.setProxyNone();
    return true;
  }

  // [ and ] : Decrease / Increase Stroke Weight
  if (!shift && key === '[') {
    e.preventDefault();
    store.setCurrentStrokeWeight(Math.max(0, (store.currentStrokeWeight || 1) - 1));
    return true;
  }
  if (!shift && key === ']') {
    e.preventDefault();
    store.setCurrentStrokeWeight((store.currentStrokeWeight || 1) + 1);
    return true;
  }

  // =========================================================================
  // 6. TOOL ACTIVATION SHORTCUTS (SECTION 15)
  // =========================================================================
  // Curvature Tool: Shift+~ or Shift+`
  if (shift && (key === '~' || key === '`' || code === 'Backquote')) {
    e.preventDefault();
    store.setActiveTool('curvature');
    return true;
  }

  // Add Anchor Point Tool: + or =
  if (key === '+' || (!shift && key === '=')) {
    e.preventDefault();
    store.setActiveTool('add-anchor');
    return true;
  }

  // Delete Anchor Point Tool: -
  if (!shift && key === '-') {
    e.preventDefault();
    store.setActiveTool('delete-anchor');
    return true;
  }

  // Shift + Letter Tool Shortcuts
  if (shift && SHIFT_KEY_TOOL_MAP[lower]) {
    e.preventDefault();
    store.setActiveTool(SHIFT_KEY_TOOL_MAP[lower]);
    return true;
  }

  // Single Letter / Symbol Tool Shortcuts
  if (!shift && SINGLE_KEY_TOOL_MAP[lower]) {
    e.preventDefault();
    store.setActiveTool(SINGLE_KEY_TOOL_MAP[lower]);
    return true;
  }

  return false;
}

/**
 * React hook that binds the global Adobe Illustrator CC keyboard shortcut listener
 * to `window`. Automatically ignores keystrokes inside `<input>`, `<textarea>`, or
 * `contentEditable` elements.
 */
export function useKeyboardShortcuts(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      handleIllustratorShortcutKeyDown(e);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}

export default useKeyboardShortcuts;
