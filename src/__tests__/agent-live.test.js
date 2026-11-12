import { describe, it, expect, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { useStudioStore } from '../state/useStudioStore';
import { revisionOf, prepareChange, commitChange, inspectActive } from '../components/agent/liveBridge';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis,'crypto',{ value:webcrypto, configurable:true });
const operations=[{op:'rectangle',id:'live-box',layer:'layer-artwork',x:10,y:20,width:30,height:40,fill:'#112233'}];
afterEach(()=>useStudioStore.setState({showHomeScreen:false}));
describe('live external agent bridge', () => {
  it('previews safely, commits one undoable change, and rejects stale and disconnected requests', async () => {
    const doc=createDefaultDocument({id:'live-test',width:300,height:300,includeSampleArtwork:false});
    useStudioStore.getState().openDocument(doc);
    const inspected=await inspectActive();
    const request={id:'one',type:'apply',documentId:doc.id,revision:inspected.revision,operations};
    useStudioStore.getState().selectNodes([]);
    expect((await inspectActive()).revision).toBe(inspected.revision);
    useStudioStore.getState().selectNodes(['not-a-document-edit']);
    expect((await inspectActive()).revision).toBe(inspected.revision);
    expect((await prepareChange(request)).svg).toContain('live-box');
    expect(useStudioStore.getState().getActiveDocument().nodes['live-box']).toBeUndefined();
    await expect(commitChange(request,()=>false)).rejects.toThrow('changed');
    await commitChange(request);
    expect(useStudioStore.getState().getActiveDocument().nodes['live-box']).toBeDefined();
    await expect(commitChange(request)).rejects.toThrow('changed');
    useStudioStore.getState().undo();
    expect(useStudioStore.getState().getActiveDocument().nodes['live-box']).toBeUndefined();
    const current=useStudioStore.getState().getActiveDocument();
    const stale={...request,revision:await revisionOf(current)};
    useStudioStore.getState().updateDocument(d=>{d.name='User edit';},'User edit');
    await expect(prepareChange(stale)).rejects.toThrow('changed');
  });
  it('exposes MCP tools over stdio and protects the local relay by origin and secret', async () => {
    const origin='http://localhost:5173';
    const transport=new StdioClientTransport({command:process.execPath,args:['scripts/adore-mcp.mjs'],env:{...process.env,ADORE_ALLOWED_ORIGIN:origin},stderr:'pipe'});
    const client=new Client({name:'test',version:'1.0.0'});
    await client.connect(transport);
    try {
      const list=await client.listTools(); expect(list.tools.map(t=>t.name)).toContain('adore_apply'); expect(list.tools.map(t=>t.name)).toContain('adore_measure_text');
      const badMeasure=await client.callTool({name:'adore_measure_text',arguments:{items:[{text:'x',fontSize:12,color:'#000000'}]}}); expect(badMeasure.isError).toBe(true);
      const infoResult=await client.callTool({name:'adore_connection_info',arguments:{}});
      const info=JSON.parse(infoResult.content[0].text);
      const headers={Origin:origin,Authorization:`Bearer ${info.token}`};
      expect((await fetch(`${info.url}/status`,{headers:{...headers,Origin:'https://evil.example'}})).status).toBe(403);
      expect((await fetch(`${info.url}/status`,{headers:{...headers,Authorization:'Bearer wrong'}})).status).toBe(401);
      expect((await fetch(`${info.url}/status`,{headers})).status).toBe(200);
      const call=client.callTool({name:'adore_inspect',arguments:{}});
      let request=null;
      for(let i=0;i<30&&!request;i++){ await new Promise(r=>setTimeout(r,20)); request=(await (await fetch(`${info.url}/next`,{headers})).json()).request; }
      expect(request?.type).toBe('inspect');
      const result=await fetch(`${info.url}/reply`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:request.id,ok:true,result:{document:{id:'abc'},revision:'rev'}})});
      expect(result.status).toBe(200);
      expect(JSON.parse((await call).content[0].text).document.id).toBe('abc');
    } finally { await client.close(); }
  },30000);
});
