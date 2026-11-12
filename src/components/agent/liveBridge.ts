import { applyOperations, inspectDesign, previewDesign } from '../../agent/design';
import { useStudioStore } from '../../state/useStudioStore';

export type BridgeRequest = { id: string; type: 'inspect' | 'preview' | 'apply'; documentId?: string; revision?: string; operations?: unknown; artboardId?: string };
export function activeDocument() {
  const state = useStudioStore.getState();
  if (state.showHomeScreen) throw new Error('Open a document in the editor first.');
  return state.getActiveDocument();
}
export async function revisionOf(doc: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(doc));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function inspectActive() {
  const doc = activeDocument(); const revision = await revisionOf(doc);
  return { document: inspectDesign(doc), selectedNodeIds: [...useStudioStore.getState().selectedNodeIds], revision };
}
export function previewActive(artboardId?: string) { return { svg: previewDesign(activeDocument(), artboardId), note:'SVG preview may differ from the canvas for complex effects and fonts.' }; }
export async function prepareChange(request: BridgeRequest) {
  const doc = activeDocument();
  if (!request.documentId || request.documentId !== doc.id || !request.revision || await revisionOf(doc) !== request.revision) throw new Error('Document changed or is no longer active. Inspect it again before applying.');
  const next = applyOperations(doc, request.operations);
  return { next, svg: previewDesign(next) };
}
export async function commitChange(request: BridgeRequest, stillConnected: () => boolean = () => true) {
  // Revalidate immediately before committing; no await between the identity check and update.
  const before = activeDocument();
  if (before.id !== request.documentId || await revisionOf(before) !== request.revision) throw new Error('Document changed while awaiting approval. Inspect and propose again.');
  const after = applyOperations(before, request.operations);
  const state = useStudioStore.getState();
  if (!stillConnected() || state.showHomeScreen || state.getActiveDocument() !== before) throw new Error('Document changed while awaiting approval. Inspect and propose again.');
  state.updateDocument(draft => { Object.assign(draft, after); }, `Agent edit ${request.id}`);
  return { documentId: after.id, revision: await revisionOf(useStudioStore.getState().getActiveDocument()) };
}
