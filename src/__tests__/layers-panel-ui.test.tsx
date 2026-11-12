// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { DockManager } from '../components/workspace/DockManager';
import { LayersPanel } from '../components/panels/LayersPanel';
import { PanelIcon } from '../components/panels/PanelIcons';
import { STUDIO_PANEL_REGISTRY } from '../components/panels/PanelRegistry';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { useStudioStore } from '../state/useStudioStore';
import type { VectorNode } from '../core/types';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('layers panel and dock icons', () => {
  it('provides SVG icons for every registered dock panel', () => {
    for (const panel of STUDIO_PANEL_REGISTRY) {
      const markup = renderToStaticMarkup(<PanelIcon panelId={panel.id} />);
      expect(markup).toContain('<svg');
      expect(markup).toContain(`data-panel-icon="${panel.id}"`);
      expect(markup).not.toContain(`>${panel.shortIcon}</`);
    }
  });
  it('renders recognizable icons and accessible labels in the collapsed dock', () => {
    localStorage.clear(); useStudioStore.setState({activeWorkspace:'essentials-classic', hideAllPanels:false, screenMode:'normal'});
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    act(()=>root.render(<DockManager renderPanel={id => <span>{id}</span>}><div>Canvas</div></DockManager>));
    const pathfinder=host.querySelector<HTMLButtonElement>('[data-dock-tab="pathfinder"]')!;
    expect(pathfinder.getAttribute('aria-label')).toBe('Pathfinder');
    expect(pathfinder.querySelector('svg[data-panel-icon="pathfinder"]')).not.toBeNull();
    expect(pathfinder.textContent).toBe('');
    act(()=>root.unmount());host.remove();
  });
  it('keeps aligned markers and controls at every nested depth and handles layer changes', () => {
    const doc = createDefaultDocument({ id:'layers-nested-ui', includeSampleArtwork:false });
    const layer=doc.layers[0];layer.color='#ff0000';
    const node=(id:string,type:VectorNode['type'],parentId?:string):VectorNode=>({id,name:id,type,layerId:layer.id,parentId,visible:true,locked:false,x:0,y:0,width:20,height:20,rotation:0,points:createRectangleAnchors(0,0,20,20),closed:true,fills:[],strokes:[],effects:[],opacity:1,blendMode:'normal'});
    const group=node('Parent','group'), inner=node('Inner','group','Parent'), shape=node('Child','rectangle','Inner');
    group.children=['Inner'];inner.children=['Child'];doc.nodes={Parent:group,Inner:inner,Child:shape};layer.nodeIds=['Parent','Inner','Child'];
    useStudioStore.getState().openDocument(doc);
    const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
    act(()=>root.render(<LayersPanel/>));
    expect(host.textContent).not.toMatch(/[👁🔒]/u);
    act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Expand Parent"]')!.click());
    act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Expand Inner"]')!.click());
    const row=host.querySelector<HTMLElement>('[data-layer-node="Child"]')!;
    expect(row.dataset.depth).toBe('3');
    expect(row.querySelector<HTMLElement>('.ai-layer-color')!.style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(host.querySelector<HTMLElement>('[data-layer-id] .ai-layer-color')!.className).toBe('ai-layer-color');
    act(()=>row.querySelector<HTMLButtonElement>('[aria-label="Hide Child"]')!.click());
    expect(useStudioStore.getState().getActiveDocument().nodes.Child.visible).toBe(false);
    act(()=>row.querySelector<HTMLButtonElement>('[aria-label="Lock Child"]')!.click());
    expect(useStudioStore.getState().getActiveDocument().nodes.Child.locked).toBe(true);
    const previousCount = useStudioStore.getState().getActiveDocument().layers.length;
    act(()=>host.querySelector<HTMLButtonElement>('[title="Create New Layer"]')!.click());
    expect(useStudioStore.getState().getActiveDocument().layers).toHaveLength(previousCount + 1);
    act(()=>root.unmount());host.remove();
  });
});
