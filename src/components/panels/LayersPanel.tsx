import React, { useState, useMemo } from 'react';
import {
  Eye,
  Lock,
  Plus,
  FolderPlus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Crosshair,
  Scissors,
  MoreHorizontal,
  Layers as LayersIcon,
  ArrowUp,
  ArrowDown,
  FileImage,
} from 'lucide-react';
import { useStudioStore } from '../../state/useStudioStore';
import type { LayerItem, VectorNode } from '../../core/types';

export const LAYER_SELECTION_COLORS: { name: string; hex: string }[] = [
  { name: 'Light Blue', hex: '#4f9eff' },
  { name: 'Red', hex: '#ff4f4f' },
  { name: 'Green', hex: '#4fcf5f' },
  { name: 'Medium Blue', hex: '#2b6cb0' },
  { name: 'Magenta', hex: '#ff4fcf' },
  { name: 'Cyan', hex: '#00d9ff' },
  { name: 'Orange', hex: '#ff9a00' },
  { name: 'Gray', hex: '#9e9e9e' },
  { name: 'Violet', hex: '#9b59b6' },
  { name: 'Gold', hex: '#f1c40f' },
  { name: 'Teal', hex: '#1abc9c' },
  { name: 'Peach', hex: '#ff8a65' },
];

function getNodeTypeLabel(node: VectorNode): string {
  const t = (node.type || 'path').toLowerCase();
  if ((node as any).isClippingMask || t === 'clipping-group') return '<Clipping Group>';
  if (t === 'group') return '<Group>';
  if (t === 'compound-path') return '<Compound Path>';
  if (t === 'compound-shape') return '<Compound Shape>';
  if (t === 'live-paint-group') return '<Live Paint Group>';
  if (t === 'rectangle') return '<Rectangle>';
  if (t === 'ellipse') return '<Ellipse>';
  if (t === 'polygon') return '<Polygon>';
  if (t === 'star') return '<Star>';
  if (t === 'line') return '<Line>';
  if (t === 'text') return '<Type>';
  if (t === 'mesh') return '<Mesh>';
  if (t === 'symbol-instance') return '<Symbol>';
  if (t === 'blend') return '<Blend>';
  if (t === 'envelope') return '<Envelope>';
  if (t === 'graph') return '<Graph>';
  if (t === 'image') return '<Image>';
  return '<Path>';
}

export const LayersPanel: React.FC = () => {
  const store = useStudioStore() as any;
  const doc = store.document || store.activeDocument || { layers: [], nodes: {} };
  const layers: LayerItem[] = doc.layers || store.layers || [];

  const nodesMap: Record<string, VectorNode> = useMemo(() => {
    if (doc.nodes && typeof doc.nodes === 'object' && !Array.isArray(doc.nodes)) {
      return doc.nodes;
    }
    if (Array.isArray(doc.objects)) {
      const m: Record<string, VectorNode> = {};
      doc.objects.forEach((o: any) => {
        m[o.id] = o;
      });
      return m;
    }
    if (doc.objects && typeof doc.objects === 'object') {
      return doc.objects;
    }
    return {};
  }, [doc.nodes, doc.objects]);

  const allNodes: VectorNode[] = useMemo(() => Object.values(nodesMap), [nodesMap]);

  const selectedIds: string[] = store.selectedIds || store.selectedNodeIds || store.selectedObjectIds || [];
  const activeLayerId: string = doc.activeLayerId || store.activeLayerId || (layers[0]?.id ?? '');
  const isolatedGroupId: string | null = store.isolatedGroupId || store.isolationModeGroupId || null;
  const targetedAppearanceId: string | null = store.targetedAppearanceId || null;

  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [localTargetId, setLocalTargetId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [layerOptionsModal, setLayerOptionsModal] = useState<LayerItem | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const activeTargetId = targetedAppearanceId ?? localTargetId;

  const updateDocument = (updater: (draftDoc: any, draftStore: any) => void, historyLabel = 'Update Layers') => {
    const storePatch: Record<string, any> = {};
    if (typeof store.updateDocument === 'function') {
      store.updateDocument((d: any) => {
        updater(d, storePatch);
      }, historyLabel);
      if (Object.keys(storePatch).length > 0) {
        if (storePatch.selectedIds && !storePatch.selectedNodeIds) {
          storePatch.selectedNodeIds = storePatch.selectedIds;
        }
        useStudioStore.setState(storePatch as any);
      }
      return;
    }
    useStudioStore.setState((state: any) => {
      const currentDoc = state.documents?.[state.activeDocumentId] || state.document || state.activeDocument || state;
      const nextDoc = JSON.parse(JSON.stringify(currentDoc));
      updater(nextDoc, storePatch);
      if (storePatch.selectedIds && !storePatch.selectedNodeIds) {
        storePatch.selectedNodeIds = storePatch.selectedIds;
      }
      return {
        ...storePatch,
        document: nextDoc,
        activeDocument: nextDoc,
        documents: state.documents ? { ...state.documents, [nextDoc.id]: nextDoc } : undefined,
      };
    });
  };

  const setSelection = (ids: string[]) => {
    if (typeof store.setSelectedIds === 'function') {
      store.setSelectedIds(ids);
    } else if (typeof store.setSelectedNodeIds === 'function') {
      store.setSelectedNodeIds(ids);
    } else if (typeof store.selectNodes === 'function') {
      store.selectNodes(ids);
    } else if (typeof store.selectObjects === 'function') {
      store.selectObjects(ids);
    } else {
      useStudioStore.setState({
        selectedIds: ids,
        selectedNodeIds: ids,
        selectedObjectIds: ids,
      } as any);
    }
  };

  const setActiveLayer = (layerId: string) => {
    if (typeof store.setActiveLayer === 'function') {
      store.setActiveLayer(layerId);
    } else if (typeof store.setActiveLayerId === 'function') {
      store.setActiveLayerId(layerId);
    } else {
      updateDocument((d, s) => {
        d.activeLayerId = layerId;
        s.activeLayerId = layerId;
      });
    }
  };

  const toggleLayerVisibility = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click toggles Outline View (hollow eye) for this layer only!
      if (typeof store.toggleLayerOutline === 'function') {
        store.toggleLayerOutline(layer.id);
      } else {
        updateDocument((d) => {
          const target = (d.layers || []).find((l: LayerItem) => l.id === layer.id);
          if (target) target.outlineMode = !target.outlineMode;
        }, 'Toggle Layer Outline View');
      }
      return;
    }
    if (typeof store.toggleLayerVisibility === 'function') {
      store.toggleLayerVisibility(layer.id);
    } else {
      updateDocument((d) => {
        const target = (d.layers || []).find((l: LayerItem) => l.id === layer.id);
        if (target) target.visible = !target.visible;
      }, 'Toggle Layer Visibility');
    }
  };

  const toggleLayerLock = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof store.toggleLayerLock === 'function') {
      store.toggleLayerLock(layer.id);
    } else {
      updateDocument((d) => {
        const target = (d.layers || []).find((l: LayerItem) => l.id === layer.id);
        if (target) target.locked = !target.locked;
      }, 'Toggle Layer Lock');
    }
  };

  const toggleLayerTemplate = (layer: LayerItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof store.toggleLayerTemplate === 'function') {
      store.toggleLayerTemplate(layer.id);
    } else {
      updateDocument((d) => {
        const target = (d.layers || []).find((l: LayerItem) => l.id === layer.id);
        if (target) {
          target.templateMode = !target.templateMode;
          target.opacity = target.templateMode ? 0.5 : 1;
        }
      }, 'Toggle Template Layer Mode');
    }
  };

  const toggleNodeVisibility = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof store.toggleNodeVisibility === 'function') {
      store.toggleNodeVisibility(nodeId);
    } else if (typeof store.updateNode === 'function') {
      const current = nodesMap[nodeId];
      if (current) store.updateNode(nodeId, { visible: !current.visible });
    } else {
      updateDocument((d) => {
        if (d.nodes && d.nodes[nodeId]) {
          d.nodes[nodeId].visible = !d.nodes[nodeId].visible;
        }
      }, 'Toggle Object Visibility');
    }
  };

  const toggleNodeLock = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof store.toggleNodeLock === 'function') {
      store.toggleNodeLock(nodeId);
    } else if (typeof store.updateNode === 'function') {
      const current = nodesMap[nodeId];
      if (current) store.updateNode(nodeId, { locked: !current.locked });
    } else {
      updateDocument((d) => {
        if (d.nodes && d.nodes[nodeId]) {
          d.nodes[nodeId].locked = !d.nodes[nodeId].locked;
        }
      }, 'Toggle Object Lock');
    }
  };

  const handleAddLayer = () => {
    if (typeof store.addLayer === 'function') {
      store.addLayer();
      return;
    }
    const nextIdx = layers.length + 1;
    const color = LAYER_SELECTION_COLORS[(nextIdx - 1) % LAYER_SELECTION_COLORS.length].hex;
    const newId = `layer-${Date.now()}`;
    updateDocument((d, s) => {
      if (!d.layers) d.layers = [];
      const newLayer: LayerItem = {
        id: newId,
        name: `Layer ${nextIdx}`,
        color,
        visible: true,
        locked: false,
        outlineMode: false,
        templateMode: false,
        expanded: true,
        nodeIds: [],
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      };
      d.layers.unshift(newLayer);
      d.activeLayerId = newId;
      s.activeLayerId = newId;
    }, 'Create New Layer');
    setExpandedLayers((prev) => ({ ...prev, [newId]: true }));
  };

  const handleAddSublayer = () => {
    if (typeof store.addSublayer === 'function') {
      store.addSublayer(activeLayerId);
      return;
    }
    const targetLayerId = activeLayerId || layers[0]?.id;
    if (!targetLayerId) return;
    const newGroupId = `sublayer-${Date.now()}`;
    updateDocument((d) => {
      const parentLayer = (d.layers || []).find((l: LayerItem) => l.id === targetLayerId);
      const subNode: VectorNode = {
        id: newGroupId,
        name: `<Sublayer ${(parentLayer?.nodeIds?.length || 0) + 1}>`,
        type: 'group',
        layerId: targetLayerId,
        visible: true,
        locked: false,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        points: [],
        closed: false,
        fills: [],
        strokes: [],
        effects: [],
        opacity: 1,
        blendMode: 'normal',
        children: [],
      };
      if (!d.nodes) d.nodes = {};
      d.nodes[newGroupId] = subNode;
      if (parentLayer) {
        if (!parentLayer.nodeIds) parentLayer.nodeIds = [];
        parentLayer.nodeIds.unshift(newGroupId);
      }
    }, 'Create New Sublayer');
    setExpandedLayers((prev) => ({ ...prev, [targetLayerId]: true }));
  };

  const handleDeleteSelectionOrLayer = () => {
    if (selectedIds.length > 0) {
      if (typeof store.deleteSelected === 'function') {
        store.deleteSelected();
      } else if (typeof store.deleteSelectedNodes === 'function') {
        store.deleteSelectedNodes();
      } else if (typeof store.deleteNodes === 'function') {
        store.deleteNodes(selectedIds);
      } else {
        updateDocument((d, s) => {
          selectedIds.forEach((id) => {
            if (d.nodes) delete d.nodes[id];
            (d.layers || []).forEach((l: LayerItem) => {
              if (l.nodeIds) {
                l.nodeIds = l.nodeIds.filter((nid) => nid !== id);
              }
            });
          });
          s.selectedIds = [];
          s.selectedNodeIds = [];
        }, 'Delete Selection');
      }
      return;
    }
    if (layers.length <= 1) return;
    if (typeof store.deleteLayer === 'function') {
      store.deleteLayer(activeLayerId);
    } else {
      updateDocument((d, s) => {
        const target = (d.layers || []).find((l: LayerItem) => l.id === activeLayerId);
        if (target?.nodeIds && d.nodes) {
          target.nodeIds.forEach((nid: string) => delete d.nodes[nid]);
        }
        d.layers = (d.layers || []).filter((l: LayerItem) => l.id !== activeLayerId);
        const fallback = d.layers[0]?.id || '';
        d.activeLayerId = fallback;
        s.activeLayerId = fallback;
      }, 'Delete Layer');
    }
  };

  const handleLocateObject = () => {
    if (selectedIds.length === 0) return;
    const targetObjId = selectedIds[0];
    const node = nodesMap[targetObjId];
    if (node) {
      setExpandedLayers((prev) => ({ ...prev, [node.layerId]: true }));
      if (node.parentId) {
        setExpandedGroups((prev) => ({ ...prev, [node.parentId!]: true }));
      }
      setHighlightedId(node.id);
      setTimeout(() => setHighlightedId(null), 1400);
    }
  };

  const handleMakeReleaseClippingMask = () => {
    if (typeof store.toggleClippingMask === 'function') {
      store.toggleClippingMask();
      return;
    }
    if (typeof store.makeClippingMask === 'function') {
      store.makeClippingMask();
      return;
    }
    updateDocument((d, s) => {
      if (selectedIds.length === 0) return;
      const firstNode = d.nodes?.[selectedIds[0]];
      if (selectedIds.length === 1 && firstNode?.type === 'clipping-group') {
        firstNode.type = 'group';
        firstNode.name = '<Group>';
        return;
      }
      if (selectedIds.length >= 2) {
        const maskGroupId = `clip-${Date.now()}`;
        const layerId = firstNode?.layerId || activeLayerId;
        const clipGroup: VectorNode = {
          id: maskGroupId,
          name: '<Clipping Group>',
          type: 'clipping-group',
          layerId,
          visible: true,
          locked: false,
          x: firstNode?.x ?? 0,
          y: firstNode?.y ?? 0,
          width: firstNode?.width ?? 100,
          height: firstNode?.height ?? 100,
          rotation: 0,
          points: [],
          closed: true,
          fills: [],
          strokes: [],
          effects: [],
          opacity: 1,
          blendMode: 'normal',
          children: [...selectedIds],
        };
        d.nodes[maskGroupId] = clipGroup;
        selectedIds.forEach((cid) => {
          if (d.nodes[cid]) d.nodes[cid].parentId = maskGroupId;
        });
        const layer = (d.layers || []).find((l: LayerItem) => l.id === layerId);
        if (layer) {
          layer.nodeIds = [maskGroupId, ...(layer.nodeIds || []).filter((id: string) => !selectedIds.includes(id))];
        }
        s.selectedIds = [maskGroupId];
      }
    }, 'Make/Release Clipping Mask');
  };

  const handleCollectInNewLayer = () => {
    if (selectedIds.length === 0) return;
    if (typeof store.collectInNewLayer === 'function') {
      store.collectInNewLayer();
      setMenuOpen(false);
      return;
    }
    const newId = `layer-${Date.now()}`;
    const nextIdx = layers.length + 1;
    const color = LAYER_SELECTION_COLORS[(nextIdx - 1) % LAYER_SELECTION_COLORS.length].hex;
    updateDocument((d, s) => {
      const newLayer: LayerItem = {
        id: newId,
        name: `Collected Layer ${nextIdx}`,
        color,
        visible: true,
        locked: false,
        outlineMode: false,
        templateMode: false,
        expanded: true,
        nodeIds: [...selectedIds],
        effects: [],
        opacity: 1,
        blendMode: 'normal',
      };
      (d.layers || []).forEach((l: LayerItem) => {
        if (l.nodeIds) {
          l.nodeIds = l.nodeIds.filter((id) => !selectedIds.includes(id));
        }
      });
      selectedIds.forEach((id) => {
        if (d.nodes?.[id]) {
          d.nodes[id].layerId = newId;
          delete d.nodes[id].parentId;
        }
      });
      d.layers.unshift(newLayer);
      d.activeLayerId = newId;
      s.activeLayerId = newId;
    }, 'Collect in New Layer');
    setExpandedLayers((prev) => ({ ...prev, [newId]: true }));
    setMenuOpen(false);
  };

  const handleReleaseToLayersSequence = () => {
    if (typeof store.releaseToLayersSequence === 'function') {
      store.releaseToLayersSequence(activeLayerId);
      setMenuOpen(false);
      return;
    }
    updateDocument((d) => {
      const activeL = (d.layers || []).find((l: LayerItem) => l.id === activeLayerId);
      const layerNodes = allNodes.filter((n) => n.layerId === activeLayerId && !n.parentId);
      if (layerNodes.length === 0) return;
      layerNodes.forEach((node, idx) => {
        const seqLayerId = `layer-seq-${Date.now()}-${idx}`;
        const color = LAYER_SELECTION_COLORS[(d.layers.length + idx) % LAYER_SELECTION_COLORS.length].hex;
        const seqLayer: LayerItem = {
          id: seqLayerId,
          name: `${node.name || 'Item'} Layer ${idx + 1}`,
          color,
          visible: true,
          locked: false,
          outlineMode: false,
          templateMode: false,
          expanded: true,
          nodeIds: [node.id],
          effects: [],
          opacity: 1,
          blendMode: 'normal',
        };
        if (d.nodes?.[node.id]) {
          d.nodes[node.id].layerId = seqLayerId;
        }
        d.layers.push(seqLayer);
      });
      if (activeL) {
        activeL.nodeIds = [];
      }
    }, 'Release to Layers (Sequence)');
    setMenuOpen(false);
  };

  const handleMoveLayer = (layerId: string, dir: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    updateDocument((d) => {
      const idx = (d.layers || []).findIndex((l: LayerItem) => l.id === layerId);
      if (idx === -1) return;
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= d.layers.length) return;
      const [item] = d.layers.splice(idx, 1);
      d.layers.splice(targetIdx, 0, item);
    }, 'Reorder Layers');
  };

  const handleTargetAppearance = (id: string, isLayer: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalTargetId(id);
    if (isLayer) {
      setActiveLayer(id);
      const layerNodeIds = allNodes.filter((n) => n.layerId === id && !n.locked).map((n) => n.id);
      if (layerNodeIds.length > 0) setSelection(layerNodeIds);
    } else {
      setSelection([id]);
    }
    if (typeof store.setTargetedAppearanceId === 'function') {
      store.setTargetedAppearanceId(id);
    } else {
      useStudioStore.setState({ targetedAppearanceId: id } as any);
    }
  };

  const handleSelectLayerAll = (layer: LayerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (layer.locked) return;
    const layerNodeIds = allNodes
      .filter((n) => n.layerId === layer.id && !n.locked && n.visible !== false)
      .map((n) => n.id);
    if (e.shiftKey) {
      const combined = Array.from(new Set([...selectedIds, ...layerNodeIds]));
      setSelection(combined);
    } else {
      setSelection(layerNodeIds);
    }
  };

  const handleEnterIsolation = (nodeId: string) => {
    const nextIso = isolatedGroupId === nodeId ? null : nodeId;
    if (typeof store.setIsolatedGroupId === 'function') {
      store.setIsolatedGroupId(nextIso);
    } else {
      useStudioStore.setState({ isolatedGroupId: nextIso, isolationModeGroupId: nextIso } as any);
    }
  };

  const commitRename = (id: string, isLayer: boolean) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    updateDocument((d) => {
      if (isLayer) {
        const l = (d.layers || []).find((x: LayerItem) => x.id === id);
        if (l) l.name = trimmed;
      } else if (d.nodes?.[id]) {
        d.nodes[id].name = trimmed;
      }
    }, 'Rename Item');
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#323232] text-[#e8e8e8] select-none text-[11px] font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-1.5">
          <LayersIcon size={12} className="text-[#9e9e9e]" />
          <span className="font-semibold tracking-wide text-[11px]">
            Layers ({layers.length})
          </span>
          {isolatedGroupId && (
            <button
              onClick={() => handleEnterIsolation(isolatedGroupId)}
              className="ml-1 px-1.5 py-0.5 rounded bg-[#1473e6] text-white text-[10px]"
              title="Click to Exit Isolation Mode"
            >
              Exit Isolation
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded hover:bg-[#3f3f3f] text-[#9e9e9e] hover:text-white"
            title="Layers Panel Options Menu"
          >
            <MoreHorizontal size={13} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-50 w-52 bg-[#2a2a2a] border border-[#1a1a1a] shadow-xl rounded py-1 text-[11px]">
              <button
                onClick={() => {
                  handleAddLayer();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1 hover:bg-[#1473e6] hover:text-white"
              >
                New Layer...
              </button>
              <button
                onClick={() => {
                  handleAddSublayer();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1 hover:bg-[#1473e6] hover:text-white"
              >
                New Sublayer...
              </button>
              <div className="my-1 border-t border-[#3d3d3d]" />
              <button
                onClick={handleCollectInNewLayer}
                disabled={selectedIds.length === 0}
                className="w-full text-left px-3 py-1 hover:bg-[#1473e6] hover:text-white disabled:opacity-40"
              >
                Collect in New Layer
              </button>
              <button
                onClick={handleReleaseToLayersSequence}
                className="w-full text-left px-3 py-1 hover:bg-[#1473e6] hover:text-white"
              >
                Release to Layers (Sequence)
              </button>
              <div className="my-1 border-t border-[#3d3d3d]" />
              <button
                onClick={() => {
                  handleMakeReleaseClippingMask();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1 hover:bg-[#1473e6] hover:text-white"
              >
                Make/Release Clipping Mask
              </button>
              <button
                onClick={() => {
                  const activeL = layers.find((l) => l.id === activeLayerId);
                  if (activeL) toggleLayerTemplate(activeL);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1 hover:bg-[#1473e6] hover:text-white"
              >
                Template Layer Mode
              </button>
              <button
                onClick={() => {
                  const activeL = layers.find((l) => l.id === activeLayerId);
                  if (activeL) setLayerOptionsModal(activeL);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-1 hover:bg-[#1473e6] hover:text-white"
              >
                Layer Options...
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[20px_20px_1fr_40px] items-center px-1 py-0.5 bg-[#292929] border-b border-[#1a1a1a] text-[10px] text-[#9e9e9e]">
        <span className="text-center" title="Visibility (Ctrl+Click for Outline View)">👁</span>
        <span className="text-center" title="Lock / Unlock">🔒</span>
        <span className="pl-2">Hierarchy</span>
        <span className="text-right pr-1" title="Target Appearance (◎) & Selection (■)">◎ ■</span>
      </div>

      {/* Layers & Sublayers Tree */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#222222]">
        {layers.map((layer) => {
          const isExpanded = expandedLayers[layer.id] ?? layer.expanded ?? true;
          const isActive = layer.id === activeLayerId;
          const layerColor = layer.color || '#4f9eff';
          const isVisible = layer.visible !== false;
          const isLocked = !!layer.locked;
          const isOutline = !!layer.outlineMode;
          const isTemplate = !!layer.templateMode;

          const layerNodes = useMemo(() => {
            if (Array.isArray(layer.nodeIds) && layer.nodeIds.length > 0) {
              return layer.nodeIds
                .map((id) => nodesMap[id])
                .filter((n): n is VectorNode => Boolean(n && !n.parentId));
            }
            return allNodes.filter((n) => n.layerId === layer.id && !n.parentId);
          }, [layer.nodeIds, layer.id, nodesMap, allNodes]);

          const selectedInLayer = layerNodes.filter((n) => selectedIds.includes(n.id));
          const allSelectedInLayer =
            layerNodes.length > 0 && selectedInLayer.length === layerNodes.length;
          const someSelectedInLayer = selectedInLayer.length > 0;

          return (
            <div key={layer.id} className="bg-[#323232]">
              {/* Layer Row */}
              <div
                onClick={() => setActiveLayer(layer.id)}
                onDoubleClick={() => setLayerOptionsModal(layer)}
                className={`group flex items-center h-7 px-1 cursor-pointer transition-colors ${
                  isActive ? 'bg-[#3d4752]' : 'hover:bg-[#3a3a3a]'
                }`}
              >
                {/* Eye / Outline / Template Column */}
                <button
                  onClick={(e) => toggleLayerVisibility(layer, e)}
                  title="Click: Toggle Visibility | Ctrl+Click: Toggle Layer Outline View"
                  className="w-5 h-5 flex items-center justify-center text-[#cfcfcf] hover:text-white"
                >
                  {!isVisible ? (
                    <span className="w-2.5 h-0.5 bg-[#666]" />
                  ) : isTemplate ? (
                    <FileImage size={12} className="text-[#ff9a00]" />
                  ) : isOutline ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    </svg>
                  ) : (
                    <Eye size={12} />
                  )}
                </button>

                {/* Lock Column */}
                <button
                  onClick={(e) => toggleLayerLock(layer, e)}
                  title="Toggle Layer Lock"
                  className="w-5 h-5 flex items-center justify-center text-[#cfcfcf] hover:text-white"
                >
                  {isLocked ? (
                    <Lock size={11} className="text-[#ff9a00]" />
                  ) : (
                    <span className="w-2.5 h-2.5 border border-transparent group-hover:border-[#555] rounded-[2px]" />
                  )}
                </button>

                {/* Layer Selection Color Swatch Bar */}
                <span
                  className="w-1.5 h-4 rounded-sm mx-1 shrink-0"
                  style={{ backgroundColor: layerColor }}
                  title={`Selection Color: ${layerColor}`}
                />

                {/* Expand Chevron */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedLayers((prev) => ({ ...prev, [layer.id]: !isExpanded }));
                  }}
                  className="w-4 h-4 flex items-center justify-center text-[#9e9e9e] hover:text-white"
                >
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>

                {/* Layer Name */}
                <div
                  className="flex-1 truncate pl-1 flex items-center gap-1"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingId(layer.id);
                    setEditingName(layer.name);
                  }}
                >
                  {editingId === layer.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitRename(layer.id, true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(layer.id, true);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full bg-[#1e1e1e] text-white px-1 py-0.5 rounded border border-[#1473e6] text-[11px] outline-none"
                    />
                  ) : (
                    <>
                      <span className={`truncate ${isTemplate ? 'italic text-[#b0b0b0]' : 'font-medium'}`}>
                        {layer.name}
                      </span>
                      {isOutline && (
                        <span className="text-[9px] px-1 rounded bg-[#222] text-[#9e9e9e] border border-[#444]">
                          Outline
                        </span>
                      )}
                      {isTemplate && (
                        <span className="text-[9px] px-1 rounded bg-[#332200] text-[#ff9a00] border border-[#664400]">
                          Template
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Reorder Layer Up/Down */}
                <div className="hidden group-hover:flex items-center gap-0.5 mr-1">
                  <button
                    onClick={(e) => handleMoveLayer(layer.id, -1, e)}
                    className="p-0.5 hover:bg-[#4f4f4f] rounded text-[#aaa]"
                    title="Move Layer Up"
                  >
                    <ArrowUp size={10} />
                  </button>
                  <button
                    onClick={(e) => handleMoveLayer(layer.id, 1, e)}
                    className="p-0.5 hover:bg-[#4f4f4f] rounded text-[#aaa]"
                    title="Move Layer Down"
                  >
                    <ArrowDown size={10} />
                  </button>
                </div>

                {/* Target Icon (Meatball / Bullseye double-circle) */}
                <button
                  onClick={(e) => handleTargetAppearance(layer.id, true, e)}
                  title="Target Layer Appearance & Effects"
                  className="w-5 h-5 flex items-center justify-center"
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      activeTargetId === layer.id || (layer.effects && layer.effects.length > 0)
                        ? 'border-white bg-[#1473e6]'
                        : 'border-[#9e9e9e] hover:border-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full border border-current" />
                  </span>
                </button>

                {/* Selection Square */}
                <button
                  onClick={(e) => handleSelectLayerAll(layer, e)}
                  title="Click to Select All Objects in Layer"
                  className="w-4 h-5 flex items-center justify-center"
                >
                  {someSelectedInLayer ? (
                    <span
                      className={allSelectedInLayer ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'}
                      style={{ backgroundColor: layerColor }}
                    />
                  ) : (
                    <span className="w-2 h-2 border border-transparent group-hover:border-[#666]" />
                  )}
                </button>
              </div>

              {/* Sublayers & Objects inside Layer */}
              {isExpanded && (
                <div className="bg-[#2c2c2c] divide-y divide-[#252525]">
                  {layerNodes.map((node) => {
                    const isNodeSelected = selectedIds.includes(node.id);
                    const isNodeVisible = node.visible !== false;
                    const isNodeLocked = !!node.locked;
                    const typeBadge = getNodeTypeLabel(node);
                    const isContainer =
                      node.type === 'group' ||
                      node.type === 'compound-path' ||
                      node.type === 'compound-shape' ||
                      node.type === 'clipping-group';
                    const isGroupExpanded = expandedGroups[node.id] ?? false;
                    const childNodes = (node.children || [])
                      .map((cid) => nodesMap[cid])
                      .filter((c): c is VectorNode => Boolean(c));

                    const primaryFill = node.fills?.find((f) => f.visible && f.type !== 'none')?.color || 'transparent';
                    const primaryStroke = node.strokes?.find((s) => s.visible)?.color || '#666';
                    const hasComplexAppearance =
                      (node.fills?.length || 0) > 1 ||
                      (node.strokes?.length || 0) > 1 ||
                      (node.effects?.length || 0) > 0;

                    return (
                      <React.Fragment key={node.id}>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isNodeLocked || isLocked) return;
                            if (e.shiftKey) {
                              const next = isNodeSelected
                                ? selectedIds.filter((id) => id !== node.id)
                                : [...selectedIds, node.id];
                              setSelection(next);
                            } else {
                              setSelection([node.id]);
                            }
                            setActiveLayer(layer.id);
                          }}
                          onDoubleClick={() => {
                            if (isContainer) handleEnterIsolation(node.id);
                          }}
                          className={`group flex items-center h-6 px-1 cursor-pointer transition-colors ${
                            highlightedId === node.id
                              ? 'bg-[#1473e6]/40'
                              : isNodeSelected
                              ? 'bg-[#384656]'
                              : 'hover:bg-[#353535]'
                          }`}
                        >
                          {/* Object Eye */}
                          <button
                            onClick={(e) => toggleNodeVisibility(node.id, e)}
                            className="w-5 h-5 flex items-center justify-center text-[#b8b8b8] hover:text-white"
                          >
                            {isNodeVisible ? <Eye size={11} /> : <span className="w-2 h-0.5 bg-[#666]" />}
                          </button>

                          {/* Object Lock */}
                          <button
                            onClick={(e) => toggleNodeLock(node.id, e)}
                            className="w-5 h-5 flex items-center justify-center text-[#b8b8b8] hover:text-white"
                          >
                            {isNodeLocked ? (
                              <Lock size={10} className="text-[#ff9a00]" />
                            ) : (
                              <span className="w-2 h-2 border border-transparent group-hover:border-[#555]" />
                            )}
                          </button>

                          {/* Indent + Color Marker */}
                          <span
                            className="w-0.5 h-3.5 ml-3 mr-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: layerColor }}
                          />

                          {isContainer ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedGroups((p) => ({ ...p, [node.id]: !isGroupExpanded }));
                              }}
                              className="w-3.5 h-3.5 flex items-center justify-center text-[#9e9e9e]"
                            >
                              {isGroupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                            </button>
                          ) : (
                            <span className="w-3.5" />
                          )}

                          {/* Mini Shape Swatch Preview */}
                          <span
                            className="w-3 h-3 rounded-[2px] border mx-1 shrink-0"
                            style={{
                              backgroundColor: primaryFill,
                              borderColor: primaryStroke,
                            }}
                          />

                          {/* Object Name / Type */}
                          <div
                            className="flex-1 truncate flex items-center gap-1"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setEditingId(node.id);
                              setEditingName(node.name || typeBadge);
                            }}
                          >
                            {editingId === node.id ? (
                              <input
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => commitRename(node.id, false)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename(node.id, false);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="w-full bg-[#1e1e1e] text-white px-1 py-0.2 rounded border border-[#1473e6] text-[10px] outline-none"
                              />
                            ) : (
                              <>
                                <span
                                  className={`truncate ${
                                    node.type === 'clipping-group' ? 'underline decoration-dotted' : ''
                                  }`}
                                >
                                  {node.name || typeBadge}
                                </span>
                                {node.name && node.name !== typeBadge && (
                                  <span className="text-[9px] text-[#888] shrink-0">{typeBadge}</span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Target Meatball Icon */}
                          <button
                            onClick={(e) => handleTargetAppearance(node.id, false, e)}
                            title="Target Appearance (Double-ring indicates active effects or multiple fills/strokes)"
                            className="w-5 h-5 flex items-center justify-center"
                          >
                            <span
                              className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                                activeTargetId === node.id || hasComplexAppearance
                                  ? 'border-white bg-[#777]'
                                  : 'border-[#888] hover:border-white'
                              }`}
                            >
                              <span className="w-1 h-1 rounded-full bg-current" />
                            </span>
                          </button>

                          {/* Selection Indicator Square */}
                          <div className="w-4 h-5 flex items-center justify-center">
                            {isNodeSelected && (
                              <span className="w-2 h-2" style={{ backgroundColor: layerColor }} />
                            )}
                          </div>
                        </div>

                        {/* Nested Group Children */}
                        {isContainer &&
                          isGroupExpanded &&
                          childNodes.map((child) => {
                            const isChildSel = selectedIds.includes(child.id);
                            return (
                              <div
                                key={child.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelection([child.id]);
                                }}
                                className={`flex items-center h-5 pl-8 pr-1 cursor-pointer text-[10px] ${
                                  isChildSel ? 'bg-[#384656]' : 'hover:bg-[#353535]'
                                }`}
                              >
                                <span className="flex-1 truncate text-[#ccc]">
                                  {child.name || getNodeTypeLabel(child)}
                                </span>
                                {isChildSel && (
                                  <span className="w-2 h-2 mr-1" style={{ backgroundColor: layerColor }} />
                                )}
                              </div>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                  {layerNodes.length === 0 && (
                    <div className="pl-9 py-1 text-[10px] text-[#777] italic">Empty layer</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer Options Modal */}
      {layerOptionsModal && (
        <div className="p-2.5 bg-[#262626] border-t border-[#1a1a1a] space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[11px]">Layer Options</span>
            <button
              onClick={() => setLayerOptionsModal(null)}
              className="text-[#9e9e9e] hover:text-white text-[10px]"
            >
              Done
            </button>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] text-[#9e9e9e]">Name</label>
            <input
              value={layerOptionsModal.name}
              onChange={(e) => {
                const val = e.target.value;
                setLayerOptionsModal({ ...layerOptionsModal, name: val });
                updateDocument((d) => {
                  const t = (d.layers || []).find((l: LayerItem) => l.id === layerOptionsModal.id);
                  if (t) t.name = val;
                });
              }}
              className="w-full bg-[#3f3f3f] border border-[#1a1a1a] rounded px-1.5 py-1 text-[11px]"
            />
            <label className="block text-[10px] text-[#9e9e9e]">Selection Color Swatch</label>
            <div className="flex flex-wrap gap-1">
              {LAYER_SELECTION_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => {
                    setLayerOptionsModal({ ...layerOptionsModal, color: c.hex });
                    updateDocument((d) => {
                      const t = (d.layers || []).find((l: LayerItem) => l.id === layerOptionsModal.id);
                      if (t) t.color = c.hex;
                    });
                  }}
                  title={c.name}
                  className={`w-4 h-4 rounded-sm border ${
                    layerOptionsModal.color === c.hex ? 'border-white scale-110' : 'border-[#1a1a1a]'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!layerOptionsModal.templateMode}
                  onChange={() => {
                    toggleLayerTemplate(layerOptionsModal);
                    setLayerOptionsModal((prev) =>
                      prev ? { ...prev, templateMode: !prev.templateMode } : null
                    );
                  }}
                />
                Template (Dim 50%)
              </label>
              <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!layerOptionsModal.outlineMode}
                  onChange={(e) => {
                    const preview = e.target.checked;
                    updateDocument((d) => {
                      const t = (d.layers || []).find((l: LayerItem) => l.id === layerOptionsModal.id);
                      if (t) t.outlineMode = !preview;
                    });
                    setLayerOptionsModal((prev) =>
                      prev ? { ...prev, outlineMode: !preview } : null
                    );
                  }}
                />
                Preview
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#262626] border-t border-[#1a1a1a]">
        <div className="flex items-center gap-1">
          <button
            onClick={handleLocateObject}
            title="Locate Object in Layers Tree"
            className="p-1 rounded hover:bg-[#3f3f3f] text-[#cfcfcf] hover:text-white"
          >
            <Crosshair size={13} />
          </button>
          <button
            onClick={handleMakeReleaseClippingMask}
            title="Make/Release Clipping Mask (Ctrl+7)"
            className="p-1 rounded hover:bg-[#3f3f3f] text-[#cfcfcf] hover:text-white"
          >
            <Scissors size={13} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddSublayer}
            title="Create New Sublayer"
            className="p-1 rounded hover:bg-[#3f3f3f] text-[#cfcfcf] hover:text-white"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={handleAddLayer}
            title="Create New Layer"
            className="p-1 rounded hover:bg-[#3f3f3f] text-[#cfcfcf] hover:text-white"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={handleDeleteSelectionOrLayer}
            title="Delete Selection or Active Layer"
            className="p-1 rounded hover:bg-[#3f3f3f] text-[#cfcfcf] hover:text-[#ff6b6b]"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayersPanel;
