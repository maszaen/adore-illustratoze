import React from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import { fromPoints } from '../../core/math/units';

/** A compact, contextual summary. Detailed controls remain in their dedicated panels. */
export const PropertiesPanel: React.FC = () => {
  const doc = useStudioStore((state) => state.document);
  const selectedIds = useStudioStore((state) => state.selectedNodeIds);
  const openPanel = (panelId: string) => window.dispatchEvent(new CustomEvent('ai-open-panel', { detail: { panelId } }));
  const selected = selectedIds.map((id) => doc.nodes[id]).filter(Boolean);
  const format = (value: number) => Math.round(fromPoints(value, doc.unit) * 100) / 100;
  const node = selected.length === 1 ? selected[0] : null;
  const artboard = doc.artboards.find((item) => item.id === doc.activeArtboardId) || doc.artboards[0];
  return (
    <div className="ai-properties-panel">
      <div className="ai-properties-heading">{node ? (node.name || node.type) : selected.length ? `${selected.length} objects selected` : 'Document'}</div>
      {node ? (
        <>
          <div className="ai-properties-grid">
            <span>X <strong>{format(node.x)}</strong></span>
            <span>Y <strong>{format(node.y)}</strong></span>
            <span>W <strong>{format(node.width)}</strong></span>
            <span>H <strong>{format(node.height)}</strong></span>
          </div>
          <div className="ai-properties-hint">Dimensions in {doc.unit}. Use Transform for precise edits.</div>
          <button type="button" className="ai-btn" onClick={() => openPanel('transform')}>Open Transform</button>
          <div className="ai-properties-heading">Appearance</div>
          <div className="ai-properties-hint">Opacity: {Math.round((node.opacity ?? 1) * 100)}%</div>
          <div className="ai-properties-actions">
            <button type="button" className="ai-btn" onClick={() => openPanel('appearance')}>Appearance</button>
            <button type="button" className="ai-btn" onClick={() => openPanel('color')}>Color</button>
          </div>
        </>
      ) : selected.length ? (
        <div className="ai-properties-hint">Select a single object to inspect its dimensions and appearance.</div>
      ) : (
        <>
          <div className="ai-properties-hint">{doc.name} · {doc.colorMode} · {doc.unit}</div>
          {artboard && <div className="ai-properties-hint">{artboard.name}: {format(artboard.width)} × {format(artboard.height)} {doc.unit}</div>}
          <button type="button" className="ai-btn" onClick={() => openPanel('artboards')}>Open Artboards</button>
        </>
      )}
    </div>
  );
};
