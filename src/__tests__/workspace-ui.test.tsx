// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPresetLayout } from '../components/workspace/DockManager';
import { renderStudioPanel } from '../components/panels/PanelRegistry';
import { TopMenuBar } from '../components/workspace/TopMenuBar';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { useStudioStore } from '../state/useStudioStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Workspace UI', () => {
  afterEach(() => vi.restoreAllMocks());

  it('selects a valid tab in every group for each workspace preset', () => {
    for (const preset of ['essentials', 'essentials-classic', 'illustration', 'typography', 'layout-print', 'tracing', 'web']) {
      const layout = createPresetLayout(preset);
      for (const group of [...layout.leftColumn, ...layout.rightInnerColumn, ...layout.rightOuterColumn, ...layout.bottomRow]) {
        expect(group.tabs).toContain(group.activeTab);
      }
    }
  });

  it('renders docked panels without a second navigation bar', () => {
    const color = renderToStaticMarkup(<>{renderStudioPanel('color')}</>);
    expect(color).not.toContain('Color Guide</button>');
    useStudioStore.setState({ selectedNodeIds: [], selectedIds: [] });
    const properties = renderToStaticMarkup(<>{renderStudioPanel('properties')}</>);
    expect(properties).toContain('ai-properties-panel');
    expect(properties).not.toContain('>Info</button>');
  });

  it('shows document names without an extra extension and closes the requested tab', () => {
    const first = createDefaultDocument({ name: 'First.adloze' });
    const second = createDefaultDocument({ name: 'Second.adloze' });
    first.id = 'test-first';
    second.id = 'test-second';
    useStudioStore.setState({ documents: { [first.id]: first, [second.id]: second }, activeDocumentId: first.id, document: first, activeDocument: first });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<TopMenuBar />));
    expect(host.textContent).toContain('First.adloze');
    expect(host.textContent).not.toContain('.adloze.adloze');
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const closeButtons = host.querySelectorAll<HTMLButtonElement>('button[title="Close Document Tab"]');
    act(() => closeButtons[1].click());
    expect(useStudioStore.getState().documents[second.id]).toBeUndefined();
    expect(useStudioStore.getState().documents[first.id]).toBeDefined();
    act(() => root.unmount());
    host.remove();
  });
});

describe('Persisted workspace layout', () => {
  it('round-trips layouts per preset and rejects malformed or duplicated panels', async () => {
    const { readDockWorkspace, saveDockWorkspace } = await import('../components/workspace/workspaceStorage');
    localStorage.clear();
    const layout = createPresetLayout('typography');
    saveDockWorkspace('typography', { version: 1, layout, rightInnerWidth: 320, rightOuterWidth: 300 });
    expect(readDockWorkspace('typography')?.rightInnerWidth).toBe(320);
    expect(readDockWorkspace('essentials')).toBeNull();
    layout.rightOuterColumn[0].tabs.push(layout.rightInnerColumn[0].tabs[0]);
    saveDockWorkspace('typography', { version: 1, layout, rightInnerWidth: 320, rightOuterWidth: 300 });
    expect(readDockWorkspace('typography')).toBeNull();
    localStorage.setItem('adore.workspace.v1.typography', '{broken');
    expect(readDockWorkspace('typography')).toBeNull();
  });

  it('restores a customized toolbar order and resets it with the workspace', async () => {
    const { LeftToolbar } = await import('../components/workspace/LeftToolbar');
    localStorage.clear();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<LeftToolbar />));
    const edit = host.querySelector<HTMLButtonElement>('.ai-toolbar-customize')!;
    act(() => edit.click());
    const first = host.querySelector<HTMLButtonElement>('.ai-tool-grid button')!;
    const firstLabel = first.getAttribute('aria-label');
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(host.querySelectorAll('.ai-tool-grid button')[1].getAttribute('aria-label')).toBe(firstLabel);
    act(() => root.unmount());
    const restored = createRoot(host);
    act(() => restored.render(<LeftToolbar />));
    expect(host.querySelectorAll('.ai-tool-grid button')[1].getAttribute('aria-label')).toBe(firstLabel);
    act(() => window.dispatchEvent(new CustomEvent('ai-workspace-preset', { detail: { preset: 'essentials-classic', reset: true } })));
    expect(host.querySelector('.ai-tool-grid button')?.getAttribute('aria-label')).toBe(firstLabel);
    act(() => restored.unmount());
    host.remove();
  });
});

it('restores the dock after remount and resets to the preset', async () => {
  const { DockManager } = await import('../components/workspace/DockManager');
  localStorage.clear();
  useStudioStore.setState({ activeWorkspace: 'essentials', hideAllPanels: false, screenMode: 'normal' });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const panel = (id: string) => <span>Panel: {id}</span>;
  act(() => root.render(<DockManager renderPanel={panel} />));
  act(() => window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId: 'swatches' } })));
  expect(host.textContent).toContain('Panel: swatches');
  act(() => root.unmount());
  const restored = createRoot(host);
  act(() => restored.render(<DockManager renderPanel={panel} />));
  expect(host.textContent).toContain('Panel: swatches');
  act(() => window.dispatchEvent(new CustomEvent('ai-workspace-preset', { detail: { preset: 'essentials', reset: true } })));
  expect(host.textContent).not.toContain('Panel: swatches');
  expect(host.textContent).toContain('Panel: properties');
  act(() => restored.unmount());
  host.remove();
});

it('moves panels to left and bottom, restores them, and opens them without duplicates', async () => {
  const { DockManager } = await import('../components/workspace/DockManager');
  localStorage.clear();
  useStudioStore.setState({ activeWorkspace: 'essentials', hideAllPanels: false, screenMode: 'normal' });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const panel = (id: string) => <span>Panel: {id}</span>;
  let root = createRoot(host);
  act(() => root.render(<DockManager renderPanel={panel}><div>Canvas</div></DockManager>));
  const move = (label: string, destination: string) => {
    const select = host.querySelector<HTMLSelectElement>(`select[aria-label="Move ${label} panel"]`);
    expect(select).not.toBeNull();
    act(() => { select!.value = destination; select!.dispatchEvent(new Event('change', { bubbles: true })); });
  };
  move('Properties', 'leftColumn');
  expect(host.querySelector('[aria-label="Left dock"]')?.textContent).toContain('Panel: properties');
  move('Layers', 'bottomRow');
  expect(host.querySelector('[aria-label="Bottom dock"]')?.textContent).toContain('Panel: layers');
  act(() => window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId: 'properties' } })));
  expect(host.querySelectorAll('[data-dock-tab="properties"]')).toHaveLength(1);
  act(() => root.unmount());
  root = createRoot(host);
  act(() => root.render(<DockManager renderPanel={panel}><div>Canvas</div></DockManager>));
  expect(host.querySelector('[aria-label="Left dock"]')?.textContent).toContain('Panel: properties');
  expect(host.querySelector('[aria-label="Bottom dock"]')?.textContent).toContain('Panel: layers');
  move('Properties', 'rightOuterColumn');
  expect(host.querySelector('[aria-label="Left dock"]')).toBeNull();
  act(() => root.unmount());
  host.remove();
});

it('floats a panel then docks it on the left without duplicating it', async () => {
  const { DockManager } = await import('../components/workspace/DockManager');
  localStorage.clear();
  useStudioStore.setState({ activeWorkspace: 'essentials', hideAllPanels: false, screenMode: 'normal' });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<DockManager renderPanel={id => <span>Panel: {id}</span>}><div>Canvas</div></DockManager>));
  const floatButton = host.querySelector<HTMLButtonElement>('button[title="Tear Off Active Tab into Floating Palette"]')!;
  act(() => floatButton.click());
  const dockSelect = host.querySelector<HTMLSelectElement>('select[aria-label="Dock Properties panel"]')!;
  expect(dockSelect).not.toBeNull();
  act(() => { dockSelect.value = 'leftColumn'; dockSelect.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.querySelector('[aria-label="Left dock"]')?.textContent).toContain('Panel: properties');
  expect(host.querySelectorAll('[data-dock-tab="properties"]')).toHaveLength(1);
  act(() => root.unmount()); host.remove();
});

it('moves a dock tab between groups by pointer drag', async () => {
  const { DockManager } = await import('../components/workspace/DockManager');
  localStorage.clear();
  useStudioStore.setState({ activeWorkspace: 'essentials', hideAllPanels: false, screenMode: 'normal' });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<DockManager renderPanel={id => <span>Panel: {id}</span>}><div>Canvas</div></DockManager>));
  const source = host.querySelector<HTMLElement>('[data-dock-tab="properties"]')!;
  const target = host.querySelector<HTMLElement>('[data-dock-tab="layers"]')!;
  const original = document.elementFromPoint;
  document.elementFromPoint = () => target;
  try {
    act(() => {
      source.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 50, clientY: 50 }));
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 50, clientY: 50 }));
    });
    const group = target.closest('[data-dock-group]')!;
    expect(group.querySelector('[data-dock-tab="properties"]')).not.toBeNull();
    expect(group.textContent).toContain('Panel: properties');
    expect(host.querySelectorAll('[data-dock-tab="properties"]')).toHaveLength(1);
  } finally {
    document.elementFromPoint = original;
    act(() => root.unmount()); host.remove();
  }
});

it('keeps editor keyboard shortcuts from firing behind a modal and closes with Escape', async () => {
  const { StudioModals } = await import('../components/modals/StudioModals');
  useStudioStore.setState({ activeModal: 'new-document' });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<StudioModals />));
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog?.getAttribute('aria-modal')).toBe('true');
  const outside = vi.fn(); window.addEventListener('keydown', outside);
  act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true })));
  expect(outside).not.toHaveBeenCalled();
  act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(useStudioStore.getState().activeModal).toBeNull();
  window.removeEventListener('keydown', outside);
  act(() => root.unmount()); host.remove();
});

it('uses workspace-specific Control bar settings and resets the selected workspace', async () => {
  const { isControlBarVisible, setControlBarVisible, resetWorkspaceChrome } = await import('../components/workspace/workspaceChrome');
  localStorage.clear();
  expect(isControlBarVisible('essentials')).toBe(false);
  expect(isControlBarVisible('essentials-classic')).toBe(true);
  setControlBarVisible('essentials', true);
  setControlBarVisible('essentials-classic', false);
  resetWorkspaceChrome('essentials');
  expect(isControlBarVisible('essentials')).toBe(false);
  expect(isControlBarVisible('essentials-classic')).toBe(false);
});

it('shows a pointer-following preview and cancels a tab drag with Escape', async () => {
  const { DockManager } = await import('../components/workspace/DockManager');
  localStorage.clear(); useStudioStore.setState({ activeWorkspace: 'essentials', hideAllPanels: false, screenMode: 'normal' });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<DockManager renderPanel={id => <span>{id}</span>}><div>Canvas</div></DockManager>));
  const source = host.querySelector<HTMLElement>('[data-dock-tab="properties"]')!;
  const original = document.elementFromPoint; document.elementFromPoint = () => null;
  try {
    act(() => source.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })));
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 120 })));
    expect(host.querySelector<HTMLElement>('.ai-panel-drag-preview')?.style.left).toBe('112px');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('.ai-panel-drag-preview')).toBeNull();
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 100, clientY: 120 })));
    expect(host.querySelectorAll('[data-dock-tab="properties"]')).toHaveLength(1);
    expect(host.querySelector('[aria-label="Dock Properties panel"]')).toBeNull();
  } finally { document.elementFromPoint = original; act(() => root.unmount()); host.remove(); }
});

it('opens the canvas context menu for the existing selection and closes it with Escape', async () => {
  const { CanvasContextMenu } = await import('../components/workspace/CanvasContextMenu');
  useStudioStore.setState({ selectedIds: ['selected-test'], clipboardNodes: [] });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<CanvasContextMenu><div>Canvas</div></CanvasContextMenu>));
  const surface = host.querySelector('.ai-canvas-context-surface')!;
  act(() => surface.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2, clientX: 50, clientY: 50 })));
  expect(host.querySelector('[aria-label="Canvas context menu"]')?.textContent).toContain('1 selected');
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Paste'))?.disabled).toBe(true);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(host.querySelector('[aria-label="Canvas context menu"]')).toBeNull();
  act(() => root.unmount()); host.remove();
});

it('renders true nested menus and runs the original submenu action', () => {
  useStudioStore.setState({ screenMode: 'normal', activeWorkspace: 'essentials-classic' });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<TopMenuBar />));
  const windowButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Window')!;
  act(() => windowButton.click());
  const menu = host.querySelector('[aria-label="Window menu"]')!;
  const workspace = Array.from(menu.querySelectorAll('button')).find(button => button.textContent?.includes('Workspace'))!;
  expect(menu.textContent).not.toContain('Workspace: Essentials');
  act(() => workspace.click());
  const sub = document.querySelector('[aria-label="Workspace submenu"]')!;
  expect(sub).not.toBeNull();
  const essentials = Array.from(sub.querySelectorAll('button')).find(button => button.textContent === 'Essentials')!;
  act(() => essentials.click());
  expect(useStudioStore.getState().activeWorkspace).toBe('essentials');
  expect(document.querySelector('[aria-label="Workspace submenu"]')).toBeNull();
  act(() => root.unmount()); host.remove();
});

it('moves a complete group into a floating palette and back into an existing group', async () => {
  const { DockManager } = await import('../components/workspace/DockManager');
  localStorage.clear(); useStudioStore.setState({ activeWorkspace: 'essentials', hideAllPanels: false, screenMode: 'normal' });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<DockManager renderPanel={id => <span>{id}</span>}><div>Canvas</div></DockManager>));
  const grip = host.querySelector<HTMLElement>('[aria-label="Drag Layers panel group"]')!;
  const original = document.elementFromPoint; const originals = document.elementsFromPoint;
  document.elementFromPoint = () => null;
  try {
    act(() => grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })));
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 120 })));
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 100, clientY: 120 })));
    expect(host.querySelectorAll('[data-floating-id] .ai-panel-tab')).toHaveLength(2);
    const target = host.querySelector<HTMLElement>('[data-dock-tab="properties"]')!;
    document.elementsFromPoint = () => [target];
    const floatGrip = host.querySelector<HTMLElement>('.ai-floating-grip')!;
    act(() => floatGrip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 })));
    act(() => window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 100, clientY: 120 })));
    act(() => window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 100, clientY: 120 })));
    expect(host.querySelector('[data-floating-id]')).toBeNull();
    expect(target.closest('[data-dock-group]')?.querySelectorAll('[data-dock-tab]')).toHaveLength(3);
  } finally { document.elementFromPoint = original; document.elementsFromPoint = originals; act(() => root.unmount()); host.remove(); }
});

it('selects an unselected artwork hit before opening the canvas context menu', async () => {
  const { CanvasContextMenu } = await import('../components/workspace/CanvasContextMenu');
  const doc = createDefaultDocument({ name: 'Context test' });
  const id = Object.keys(doc.nodes)[0];
  useStudioStore.setState({ documents: { [doc.id]: doc }, activeDocumentId: doc.id, document: doc, activeDocument: doc, selectedIds: [], selectedNodeIds: [] });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<CanvasContextMenu><div data-vector-node-id={id}>Artwork</div></CanvasContextMenu>));
  const hit = host.querySelector<HTMLElement>('[data-vector-node-id]')!;
  const original = document.elementsFromPoint; document.elementsFromPoint = () => [hit];
  try {
    act(() => hit.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2, clientX: 60, clientY: 60 })));
    expect(useStudioStore.getState().selectedIds).toContain(id);
    expect(host.querySelector('.ai-context-caption')?.textContent).toContain('1 selected');
  } finally { document.elementsFromPoint = original; act(() => root.unmount()); host.remove(); }
});

it('keeps toolbar ordering separate across workspaces', async () => {
  const { LeftToolbar } = await import('../components/workspace/LeftToolbar');
  localStorage.clear(); useStudioStore.setState({ activeWorkspace: 'essentials', hideAllPanels: false, screenMode: 'normal' });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<LeftToolbar />));
  act(() => host.querySelector<HTMLButtonElement>('.ai-toolbar-customize')!.click());
  const first = host.querySelector<HTMLButtonElement>('.ai-tool-grid button')!; const label = first.getAttribute('aria-label');
  act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
  act(() => window.dispatchEvent(new CustomEvent('ai-workspace-preset', { detail: { preset: 'typography' } })));
  expect(host.querySelector('.ai-tool-grid button')?.getAttribute('aria-label')).toBe(label);
  act(() => window.dispatchEvent(new CustomEvent('ai-workspace-preset', { detail: { preset: 'essentials' } })));
  expect(host.querySelectorAll('.ai-tool-grid button')[1].getAttribute('aria-label')).toBe(label);
  act(() => root.unmount()); host.remove();
});
