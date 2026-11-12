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
  it('clips the project thumbnail corners without clipping its action menu', async () => {
    const { listProjectsFromDb } = await import('../core/io/db');
    const doc = createDefaultDocument({ id: 'thumb-project', includeSampleArtwork: false });
    vi.mocked(listProjectsFromDb).mockResolvedValueOnce([{ id: doc.id, name: doc.name, createdAt: 1, updatedAt: 1, width: 1200, height: 800, unit: 'px', colorMode: 'RGB', artboardCount: 1, document: doc, thumbnailDataUrl: 'data:image/svg+xml,test' }]);
    const { HomeDashboard } = await import('../components/home/HomeDashboard');
    const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
    await act(async () => root.render(<HomeDashboard />));
    const preview = host.querySelector<HTMLElement>(`[aria-label="Open ${doc.name}"]`)!;
    expect(preview.style.overflow).toBe('hidden');
    expect(preview.style.borderTopRightRadius).toBe('7px');
    expect(preview.style.borderTopLeftRadius).toBe('7px');
    expect(preview.parentElement!.style.overflow).toBe('visible');
    act(() => host.querySelector<HTMLButtonElement>(`[aria-label="Actions for ${doc.name}"]`)!.click());
    expect(host.textContent).toContain('Duplicate');
    act(() => root.unmount()); host.remove();
  });
  it('opens document creation from the sidebar without a duplicate preset section', async () => {
    const { HomeDashboard } = await import('../components/home/HomeDashboard');
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    await act(async()=>root.render(<HomeDashboard/>));
    expect(host.querySelector('.ai-home-presets')).toBeNull();
    const create=host.querySelector<HTMLButtonElement>('.ai-home-primary')!;
    act(()=>create.click());
    expect(useStudioStore.getState().activeModal).toBe('new-document');
    act(()=>root.unmount());host.remove();
  });
  it('shows real template previews and opens an editable poster', async () => {
    const { HomeDashboard } = await import('../components/home/HomeDashboard');
    const host=document.createElement('div'); document.body.appendChild(host); const root=createRoot(host);
    await act(async()=>root.render(<HomeDashboard/>));
    const previews = Array.from(host.querySelectorAll<HTMLImageElement>('.ai-home-template-preview'));
    expect(previews).toHaveLength(4);
    expect(new Set(previews.map(image => image.src)).size).toBe(4);
    expect(decodeURIComponent(previews[1].src)).toContain('Cube_top');
    const poster = previews[1].closest<HTMLElement>('[role="button"]')!;
    await act(async()=>poster.click());
    const doc = useStudioStore.getState().getActiveDocument();
    expect(doc.name).toBe('Isometric-Poster-Art.adloze');
    expect(Object.values(doc.nodes).some(node => node.name === 'Cube top')).toBe(true);
    expect(useStudioStore.getState().showHomeScreen).toBe(false);
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
