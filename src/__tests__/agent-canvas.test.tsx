// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyOperations } from '../agent/design';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { StudioCanvas } from '../components/canvas/StudioCanvas';
import { useStudioStore } from '../state/useStudioStore';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it('renders agent gradient text and fractional gradient stops on the editor canvas', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const doc=applyOperations(createDefaultDocument({includeSampleArtwork:false}),[
    {op:'text',id:'gradient-title',layer:'layer-artwork',x:10,y:20,text:'Hello',fontSize:30,fill:{type:'linear',angle:20,stops:[{offset:0.1234,color:'#123456'},{offset:1,color:'#abcdef'}]}}
  ]);
  useStudioStore.getState().openDocument(doc);
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  act(()=>root.render(<StudioCanvas/>));
  const text=host.querySelector('[data-vector-node-id="gradient-title"] text');
  expect(text?.getAttribute('fill')).toBe('url(#grad-gradient-title-gradient-title-fill)');
  const gradient=host.querySelector('[id="grad-gradient-title-gradient-title-fill"]');
  expect(gradient?.querySelector('stop')?.getAttribute('offset')).toBe('12.34%');
  act(()=>root.unmount());host.remove();vi.unstubAllGlobals();
});
