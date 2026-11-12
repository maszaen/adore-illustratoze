import React, { useEffect, useId, useRef, useState } from 'react';
import { Cable, X } from 'lucide-react';
import { activeDocument, commitChange, inspectActive, measureActive, prepareChange, previewActive, type BridgeRequest } from './liveBridge';

/** Explicit opt-in local connection. The token lives only in component memory. */
export function AgentBridge() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(''); const [token, setToken] = useState('');
  const [connection, setConnection] = useState<{url:string;token:string}|null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{request:BridgeRequest;svg:string;documentName:string}|null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const panelId = useId();
  const connectAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; connectAbort.current?.abort(); connectAbort.current = null; };
  }, []);
  const closePanel = () => { setOpen(false); triggerRef.current?.focus(); };
  const connected = useRef(false);
  const activePending = useRef<BridgeRequest | null>(null);
  const call = async (c:{url:string;token:string}, path:string, options:RequestInit = {}) => {
    const response = await fetch(`${c.url}${path}`, { ...options, headers:{Authorization:`Bearer ${c.token}`, ...(options.body ? {'Content-Type':'application/json'} : {})}, cache:'no-store' });
    if (!response.ok) throw new Error(`Bridge returned ${response.status}`);
    return response.json();
  };
  const disconnect = () => {
    const request = activePending.current;
    if (connection && request) void call(connection, '/reply', { method:'POST', body:JSON.stringify({ id:request.id, ok:false, error:'User disconnected the bridge.' }) }).catch(() => {});
    connected.current=false; setConnection(null); setToken(''); setPending(null); activePending.current=null;
  };
  const connect = async () => {
    if (connecting || connectAbort.current) return;
    setError('');
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(parsed.hostname) || !parsed.port || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Use an HTTP localhost URL with a port, without a path.');
      if (!/^[0-9a-f]{64}$/.test(token.trim())) throw new Error('Pairing token must be 64 lowercase hexadecimal characters.');
      activeDocument();
      const c = { url:parsed.origin, token:token.trim() };
      const controller = new AbortController();
      connectAbort.current = controller;
      setConnecting(true);
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        await call(c, '/status', { signal: controller.signal });
        if (controller.signal.aborted) throw new Error('Connection timed out.');
        connected.current = true; setConnection(c); setToken('');
      } catch (e) {
        if (controller.signal.aborted) throw new Error('Connection timed out. Check that the bridge is running on this computer.');
        if (e instanceof TypeError) throw new Error('Could not reach the bridge. Check its URL, browser origin, and that it is running on this computer.');
        throw e;
      } finally {
        clearTimeout(timeout);
        if (connectAbort.current === controller) { connectAbort.current = null; setConnecting(false); }
      }
    } catch(e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Connection failed.'); }
  };
  useEffect(() => {
    if (!connection) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const reply = (request:BridgeRequest, ok:boolean, result?:unknown, error?:string) => call(connection,'/reply',{ method:'POST', body:JSON.stringify({id:request.id,ok,result,error}) });
    const poll = async () => {
      if (stopped || !connected.current) return;
      try {
        if (!activePending.current) {
          const {request} = await call(connection,'/next') as {request:BridgeRequest|null};
          if (stopped) return;
          if (request) {
            activePending.current = request;
            try {
              if (request.type === 'inspect') { await reply(request,true,await inspectActive()); activePending.current=null; }
              else if (request.type === 'preview') { await reply(request,true,previewActive(request.artboardId)); activePending.current=null; }
              else if (request.type === 'measure') { await reply(request,true,await measureActive(request.items)); activePending.current=null; }
              else if (request.type === 'apply') {
                const prepared = await prepareChange(request);
                if (stopped) return;
                setPending({request,svg:prepared.svg,documentName:prepared.next.name}); setOpen(true);
              } else { await reply(request,false,undefined,'Unknown request'); activePending.current=null; }
            } catch (e) { await reply(request,false,undefined,e instanceof Error ? e.message : 'Request failed'); activePending.current=null; }
          }
        } else {
          const status = await call(connection,'/pending');
          if (status.id !== activePending.current.id || status.expiresAt <= Date.now() + 3000) { activePending.current=null; setPending(null); setError('Agent request expired. Ask the agent to retry.'); }
        }
      } catch (e) { if (!stopped) { setError(`Connection lost: ${e instanceof Error ? e.message : 'network error'}`); disconnect(); } return; }
      if (!stopped) timer=setTimeout(poll,800);
    };
    void poll();
    return () => { stopped=true; connected.current=false; clearTimeout(timer); };
  },[connection]);
  const decide = async (approve:boolean) => {
    if (!connection || !pending || busy) return;
    setBusy(true); setError('');
    const request=pending.request;
    try {
      const status=await call(connection,'/pending');
      if (!connected.current || status.id !== request.id || status.expiresAt <= Date.now()+3000) throw new Error('Request expired. Ask the agent to retry.');
      if (approve) {
        const result=await commitChange(request, () => connected.current && activePending.current?.id === request.id && status.expiresAt > Date.now() + 500);
        await call(connection,'/reply',{method:'POST',body:JSON.stringify({id:request.id,ok:true,result})});
      } else await call(connection,'/reply',{method:'POST',body:JSON.stringify({id:request.id,ok:false,error:'User rejected the proposed changes.'})});
    } catch(e) {
      const message=e instanceof Error ? e.message : 'Request failed'; setError(message);
      if (connected.current) { try { await call(connection,'/reply',{method:'POST',body:JSON.stringify({id:request.id,ok:false,error:message})}); } catch { /* request may already have expired */ } }
    } finally { activePending.current=null; setPending(null); setBusy(false); }
  };
  return <>
    <button ref={triggerRef} type="button" className="ai-agent-trigger" onClick={() => setOpen(v=>!v)} aria-expanded={open} aria-controls={open ? panelId : undefined} title="Connect an external agent"><Cable size={13} aria-hidden="true" /> Agent{connection ? ' •' : ''}</button>
    {open && <section id={panelId} className="ai-agent-popover" aria-label="External agent connection" onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); closePanel(); } }}>
      <header><div><strong>External agent</strong><span className={`ai-agent-badge ${connection ? 'is-connected' : ''}`}>{connection ? 'Connected' : 'Not connected'}</span></div><button type="button" onClick={closePanel} aria-label="Close agent panel"><X size={16} /></button></header>
      {!connection ? <>
        <p>Connect only an agent you trust. While connected it can read the active document and request a preview. Edits need your approval.</p>
        <details className="ai-agent-help">
          <summary>Where do I get the URL and token?</summary>
          <p>This page’s origin is <code>{window.location.origin}</code>. It identifies where you opened Adore, not an agent or a connection address. If you host Adore elsewhere, it will show that site’s origin instead.</p>
          <ol>
            <li>On the computer running this browser, ask your trusted local agent to set up Adore MCP with this exact origin.</li>
            <li>Ask the agent to call <code>adore_connection_info</code>. Paste the local bridge URL and token it returns below. Keep the token private.</li>
            <li>Connect here with a document open. The browser talks to the local bridge on this computer; a remote agent or hosting server does not share its localhost.</li>
          </ol>
          <p>Browser or network security settings may block access to the local bridge, even when Adore is hosted online.</p>
        </details>
        <form onSubmit={event => { event.preventDefault(); void connect(); }}>
          <label>Local bridge URL<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="http://127.0.0.1:port" autoComplete="off" spellCheck={false} disabled={connecting} /></label>
          <label>Pairing token<input type="password" autoComplete="off" spellCheck={false} value={token} onChange={e=>setToken(e.target.value)} placeholder="Token from your agent" disabled={connecting} /></label>
          <button type="submit" className="ai-btn ai-agent-connect" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</button>
        </form>
      </> : <>
        <p role="status">Your agent can read the active document and request previews. Changes still require your approval.</p>
        <p className="ai-agent-connection-address">Bridge: <code>{connection.url}</code></p>
        <button type="button" className="ai-btn" disabled={busy} onClick={disconnect}>Disconnect</button>
      </>}
      {error && <p role="alert" className="ai-agent-error">{error}</p>}
      {pending && <div className="ai-agent-proposal">
        <strong>Review proposed changes</strong>
        <p>Document: {pending.documentName}. The preview is approximate; approval applies all operations as one undo step.</p>
        <div className="ai-agent-preview"><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pending.svg)}`} alt="Proposed active artboard" /></div>
        <pre>{JSON.stringify(pending.request.operations,null,2)}</pre>
        <div className="ai-agent-actions"><button type="button" className="ai-btn" disabled={busy} onClick={()=>void decide(false)}>Reject</button><button type="button" className="ai-btn ai-agent-approve" disabled={busy} onClick={()=>void decide(true)}>Apply changes</button></div>
      </div>}
    </section>}
  </>;
}
