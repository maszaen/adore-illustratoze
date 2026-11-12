// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { useStudioStore } from '../state/useStudioStore';

vi.mock('../core/io/db', () => ({
  listProjectsFromDb: vi.fn(async () => []), listCustomPresetsFromDb: vi.fn(async () => []),
  getCrashRecoverySnapshot: vi.fn(async () => null), saveProjectToDb: vi.fn(async () => {}),
  clearCrashRecoverySnapshot: vi.fn(async () => {}), deleteProjectFromDb: vi.fn(async () => {}),
  duplicateProjectInDb: vi.fn(async () => {}), renameProjectInDb: vi.fn(async () => {}),
  saveCustomPresetToDb: vi.fn(async () => {}),
}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => { useStudioStore.setState({language:'en', showHomeScreen:true, activeModal:null}); });
describe('home and panel forms', () => {
  it('prioritizes recent work, offers accessible navigation and a truthful empty/search state', async () => {
    const { HomeDashboard } = await import('../components/home/HomeDashboard');
    const host=document.createElement('div'); document.body.appendChild(host); const root=createRoot(host);
    await act(async()=>root.render(<HomeDashboard/>));
    expect(host.querySelector('h1')?.textContent).toBe('Make something meaningful.');
    expect(host.textContent).toContain('No local projects yet');
    const projects=host.querySelector('.ai-home-projects')!;
    const templateHeading=Array.from(host.querySelectorAll('h3')).find(h=>h.textContent?.includes('Starter templates'))!;
    expect(projects.compareDocumentPosition(templateHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(host.querySelector('[aria-current="page"]')?.textContent).toContain('Home');
    expect(host.querySelector('[role="button"][tabindex="0"].ai-home-card')).not.toBeNull();
    const nav=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('My Projects'))!;
    act(()=>nav.click()); expect(host.querySelector('[aria-current="page"]')?.textContent).toContain('My Projects');
    expect(host.querySelector('[aria-label="Search projects"]')).not.toBeNull();
    act(()=>root.unmount());host.remove();
  });
  it('opens preset cards by keyboard', async () => {
    const { HomeDashboard } = await import('../components/home/HomeDashboard');
    const { saveProjectToDb } = await import('../core/io/db');
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    await act(async()=>root.render(<HomeDashboard/>));
    const card=host.querySelector<HTMLElement>('.ai-home-presets [role="button"]')!;
    await act(async()=>card.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    expect(saveProjectToDb).toHaveBeenCalled(); expect(useStudioStore.getState().showHomeScreen).toBe(false);
    act(()=>root.unmount());host.remove();
  });
  it('labels and aligns artboard controls and keeps orientation changes functional', async () => {
    const { ArtboardsAssetHistoryInfoPanel } = await import('../components/panels/ArtboardsAssetHistoryInfoPanel');
    const doc=createDefaultDocument({id:'artboard-form',width:600,height:400,includeSampleArtwork:false});
    useStudioStore.getState().openDocument(doc);
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    act(()=>root.render(<div className="ai-panel-body"><ArtboardsAssetHistoryInfoPanel showTabs={false} initialTab="artboards" /></div>));
    expect(host.querySelector('label[for="artboard-preset"]')).not.toBeNull();
    expect(host.querySelector('.ai-artboard-size-grid [aria-label="Width"]')).not.toBeNull();
    expect(host.querySelector('.ai-artboard-size-grid [aria-label="Height"]')).not.toBeNull();
    const before=useStudioStore.getState().getActiveDocument().artboards[0];
    const oldWidth=before.width, oldHeight=before.height;
    act(()=>host.querySelector<HTMLButtonElement>('[title="Toggle Portrait / Landscape Orientation"]')!.click());
    const after=useStudioStore.getState().getActiveDocument().artboards[0];
    expect(after.width).toBe(oldHeight);expect(after.height).toBe(oldWidth);
    act(()=>root.unmount());host.remove();
  });
});
