// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { exportDocumentToBlob, exportDocumentToDataUrl } from '../core/io/rasterExport';
import { packDocumentToAdlozeBytes, unpackAdlozeBytesToDocument } from '../core/io/adlozeIo';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { StudioModals } from '../components/modals/StudioModals';
import { useStudioStore } from '../state/useStudioStore';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it('fails explicitly on null context and preserves a native archive without a preview',()=>{
  const doc=createDefaultDocument({includeSampleArtwork:false});
  const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  try {
    expect(()=>exportDocumentToDataUrl(doc)).toThrow(/canvas is unavailable/);
    expect(unpackAdlozeBytesToDocument(packDocumentToAdlozeBytes(doc)).document.id).toBe(doc.id);
  } finally {spy.mockRestore();}
});

it('rejects unsupported encodings and empty blobs',async()=>{
  const doc=createDefaultDocument({includeSampleArtwork:false});
  const ctx=new Proxy({globalAlpha:1},{get:(target:any,p:string)=>p in target?target[p]:()=>{},set:(target:any,p:string,v)=>{target[p]=v;return true;}});
  const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx as any);
  const data=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,AA==');
  const blob=vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(null));
  try {
    expect(()=>exportDocumentToDataUrl(doc,{format:'jpg'})).toThrow(/encoding/);
    await expect(exportDocumentToBlob(doc,{format:'jpg'})).rejects.toThrow(/encoding/);
  } finally {spy.mockRestore();data.mockRestore();blob.mockRestore();}
});

it('shows unavailable previews and an export error instead of crashing the dialog',async()=>{
  const spy=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  const doc=createDefaultDocument({includeSampleArtwork:false});useStudioStore.getState().openDocument(doc);useStudioStore.getState().setActiveModal('save-for-web');
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  try {
    act(()=>root.render(<StudioModals/>));
    expect(host.textContent).toContain('Preview unavailable');
    await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Save...')!.click();});
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Export failed');
    expect(useStudioStore.getState().activeModal).toBe('save-for-web');
  } finally {act(()=>root.unmount());host.remove();spy.mockRestore();useStudioStore.getState().setActiveModal(null);}
});

it('rejects an entire SVG import if a later path is malformed',async()=>{
  const {parseSvgStringToVectorNodes}=await import('../core/io/svgIo');
  expect(()=>parseSvgStringToVectorNodes('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/><path d="M0 0Z 5"/></svg>')).toThrow(/SVG import failed/);
});
