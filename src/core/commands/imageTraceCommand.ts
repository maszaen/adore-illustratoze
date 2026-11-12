import { traceImageNodeToVectorNodes, type ImageTraceOptions, type ImageTraceResult } from '../io/imageTrace';
import type { StudioDocument, VectorNode } from '../types';
import { useStudioStore } from '../../state/useStudioStore';

const inFlight = new Set<string>();

/** Validate the complete ancestry and identify the one authoritative stacking list. */
function sourceSlot(doc: StudioDocument, nodeId: string): {node: VectorNode; ids: string[]} {
  const node = doc.nodes[nodeId];
  if (!node || node.type !== 'image' || !node.imageUrl) throw new Error('Select one placed image before tracing.');
  const layer = doc.layers.find(item => item.id === node.layerId);
  if (!layer || layer.locked || !layer.visible || node.locked || !node.visible) throw new Error('Image or layer is locked or hidden.');
  let parent = node.parentId; let childId = node.id; const seen = new Set([node.id]);
  while (parent) {
    if (seen.has(parent)) throw new Error('Invalid image hierarchy.');
    seen.add(parent);
    const ancestor = doc.nodes[parent];
    if (!ancestor || ancestor.layerId !== layer.id || ancestor.locked || !ancestor.visible) throw new Error('Image ancestor is missing, locked or hidden.');
    if (ancestor.type !== 'group') throw new Error('Tracing inside a special group is not supported.');
    if (ancestor.children?.filter(id => id === childId).length !== 1) throw new Error('Invalid image hierarchy.');
    childId = ancestor.id; parent = ancestor.parentId;
  }
  if (layer.nodeIds.filter(id => id === childId).length !== 1) throw new Error('Invalid image hierarchy.');
  const ids = node.parentId ? doc.nodes[node.parentId].children : layer.nodeIds;
  if (!ids || ids.filter(id => id === node.id).length !== 1 || (node.parentId && layer.nodeIds.includes(node.id))) throw new Error('Invalid image hierarchy.');
  return {node, ids};
}

function validateResult(doc: StudioDocument, source: VectorNode, result: ImageTraceResult) {
  const group = result.groupNode, paths = result.pathNodes;
  if (!group || group.type !== 'group' || group.layerId !== source.layerId || !Array.isArray(paths) || !paths.length || !Array.isArray(group.children)) throw new Error('Image Trace returned an invalid result.');
  const ids = [group.id, ...paths.map(path => path.id)];
  if (ids.some(id => typeof id !== 'string' || !id || Object.prototype.hasOwnProperty.call(doc.nodes, id)) || new Set(ids).size !== ids.length) throw new Error('Image Trace returned conflicting IDs.');
  if (group.children.length !== paths.length || group.children.some((id, i) => id !== paths[i].id) || paths.some(path => path.type !== 'path' || path.parentId !== group.id || path.layerId !== source.layerId)) throw new Error('Image Trace returned an invalid hierarchy.');
}

/** Trace is a visible copy; expand replaces the original in place. Both are one undo step. */
export async function runImageTraceCommand(options: ImageTraceOptions, mode: 'copy' | 'replace', signal?: AbortSignal): Promise<ImageTraceResult> {
  const start = useStudioStore.getState();
  if (start.showHomeScreen || start.selectedNodeIds.length !== 1) throw new Error('Select exactly one placed image before tracing.');
  if (start.isTransactionActive) throw new Error('Finish the current edit before tracing.');
  if (!options.fills && !options.strokes) throw new Error('Enable fills or strokes before tracing.');
  const doc = start.getActiveDocument();
  const { node } = sourceSlot(doc, start.selectedNodeIds[0]);
  const docId = doc.id, nodeId = node.id, jobKey = `${docId}\0${nodeId}`;
  if (signal?.aborted) throw new Error('Image Trace cancelled.');
  if (inFlight.has(jobKey)) throw new Error('Image Trace is already running for this image.');
  inFlight.add(jobKey);
  let invalidated = false;
  const jobAbort = new AbortController();
  const cancel = () => jobAbort.abort();
  signal?.addEventListener('abort', cancel, {once:true});
  const unsubscribe = useStudioStore.subscribe(state => {
    if (state.showHomeScreen || state.activeDocumentId !== docId || state.getActiveDocument() !== doc || state.isTransactionActive || state.selectedNodeIds.length !== 1 || state.selectedNodeIds[0] !== nodeId) { invalidated = true; jobAbort.abort(); }
  });
  try {
    let result: ImageTraceResult;
    try { result = await traceImageNodeToVectorNodes(structuredClone(node), options, jobAbort.signal); }
    catch (error) {
      if (invalidated) throw new Error('Document or selection changed during Image Trace. Try again.');
      if (signal?.aborted) throw new Error('Image Trace cancelled.');
      throw error;
    }
    const current = useStudioStore.getState();
    if (signal?.aborted) throw new Error('Image Trace cancelled.');
    if (invalidated || current.showHomeScreen || current.activeDocumentId !== docId || current.getActiveDocument() !== doc || current.isTransactionActive || current.selectedNodeIds.length !== 1 || current.selectedNodeIds[0] !== nodeId) throw new Error('Document or selection changed during Image Trace. Try again.');
    const {node: source} = sourceSlot(doc, nodeId);
    validateResult(doc, source, result);
    current.updateDocument(draft => {
      const {node: target, ids} = sourceSlot(draft, nodeId);
      const group = structuredClone(result.groupNode);
      group.parentId = target.parentId;
      draft.nodes[group.id] = group;
      for (const path of result.pathNodes) draft.nodes[path.id] = structuredClone(path);
      const position = ids.indexOf(nodeId);
      if (mode === 'replace') {
        ids.splice(position, 1, group.id);
        for (const asset of draft.exportAssets) if (asset.sourceNodeId === nodeId) asset.sourceNodeId = group.id;
        for (const selection of draft.savedSelections) selection.nodeIds = [...new Set(selection.nodeIds.map(id => id === nodeId ? group.id : id))];
        delete draft.nodes[nodeId];
      }
      else ids.splice(position + 1, 0, group.id);
    }, mode === 'replace' ? 'Trace and Replace Image' : 'Create Trace Copy', {coalesce:false});
    useStudioStore.getState().selectNodes([result.groupNode.id]);
    return result;
  } finally { signal?.removeEventListener('abort', cancel); unsubscribe(); inFlight.delete(jobKey); }
}
