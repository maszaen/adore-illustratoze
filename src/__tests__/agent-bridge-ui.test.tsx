// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentBridge } from '../components/agent/AgentBridge';
import { useStudioStore } from '../state/useStudioStore';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { revisionOf } from '../components/agent/liveBridge';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
afterEach(()=>vi.restoreAllMocks());

it('requires pairing and explicit approval before applying a proposal', async () => {
  const doc=createDefaultDocument({id:'ui-live',width:300,height:300,includeSampleArtwork:false});
  useStudioStore.getState().openDocument(doc);
  const request={id:'req-1',type:'apply',documentId:doc.id,revision:await revisionOf(doc),operations:[{op:'rectangle',id:'agent-box',layer:'layer-artwork',x:20,y:30,width:50,height:60,fill:'#ff0000'}]};
  const replies:any[]=[]; let delivered=false;
  vi.stubGlobal('fetch',vi.fn(async (url:string,options:any) => ({ ok:true,status:200,json:async()=>{
    if (url.endsWith('/next')) { if (delivered) return {request:null}; delivered=true; return {request}; }
    if (url.endsWith('/pending')) return {id:request.id,expiresAt:Date.now()+100000};
    if (url.endsWith('/reply')) { replies.push(JSON.parse(options.body)); return {ok:true}; }
    return {ok:true};
  } })));
  const host=document.createElement('div'); document.body.appendChild(host); const root=createRoot(host);
  await act(async()=>root.render(<AgentBridge/>));
  act(()=>host.querySelector<HTMLButtonElement>('.ai-agent-trigger')!.click());
  const setInput=(input:HTMLInputElement,value:string)=>{ const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!; setter.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); };
  const inputs=host.querySelectorAll<HTMLInputElement>('input');
  act(()=>{setInput(inputs[0],'http://127.0.0.1:12345');setInput(inputs[1],'a'.repeat(64));});
  await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent==='Connect')!.click(); await new Promise(r=>setTimeout(r,30));});
  await act(async()=>{ await new Promise(r=>setTimeout(r,60)); });
  expect(host.textContent).toContain('Review proposed changes');
  expect(useStudioStore.getState().getActiveDocument().nodes['agent-box']).toBeUndefined();
  await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent==='Apply changes')!.click(); await new Promise(r=>setTimeout(r,30));});
  expect(useStudioStore.getState().getActiveDocument().nodes['agent-box']).toBeDefined();
  expect(replies[0].ok).toBe(true);
  await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();
});
