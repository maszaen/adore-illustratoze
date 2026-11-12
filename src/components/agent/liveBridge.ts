import { applyOperations, inspectDesign, measureTexts, previewDesign } from '../../agent/design';
import { useStudioStore } from '../../state/useStudioStore';
import { fontRequestsFor, fontRequestsInOperations, fontStatus, waitForFonts } from './fontReadiness';

export type BridgeRequest = { id: string; type: 'inspect' | 'preview' | 'apply' | 'measure'; documentId?: string; revision?: string; operations?: unknown; artboardId?: string; items?: unknown };
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
  const doc = activeDocument();
  const requests = fontRequestsFor(doc);
  await waitForFonts(requests);
  const revision = await revisionOf(doc);
  const summary = inspectDesign(doc);
  return { document: { ...summary, measurement: { ...summary.measurement, fonts: requests.map(fontStatus) } }, selectedNodeIds: [...useStudioStore.getState().selectedNodeIds], revision };
}
/** Measure text with the browser's real fonts. Read-only; needs no open document. */
export async function measureActive(items: unknown) {
  const raw = Array.isArray(items) ? items : [];
  const requests = raw.filter(i => i && typeof i === 'object').map((i: any) => ({ family: typeof i.fontFamily === 'string' ? i.fontFamily : 'Arial, sans-serif', style: typeof i.fontStyle === 'string' ? i.fontStyle : 'Regular' }));
  await waitForFonts(requests);
  const result = measureTexts(items);
  return { ...result, items: result.items.map(item => ({ ...item, font: fontStatus({ family: item.fontFamily, style: item.fontStyle }) })) };
}
export function previewActive(artboardId?: string) { return { svg: previewDesign(activeDocument(), artboardId), note:'SVG preview may differ from the canvas for complex effects and fonts.' }; }
export async function prepareChange(request: BridgeRequest) {
  const doc = activeDocument();
  if (!request.documentId || request.documentId !== doc.id || !request.revision || await revisionOf(doc) !== request.revision) throw new Error('Document changed or is no longer active. Inspect it again before applying.');
  // New text frames are sized from canvas metrics, so the fonts must be loaded before applying.
  await waitForFonts(fontRequestsFor(doc, fontRequestsInOperations(request.operations)));
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
