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
