// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioCanvas } from '../components/canvas/StudioCanvas';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { useStudioStore } from '../state/useStudioStore';
import type { FillItem, VectorNode } from '../core/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const pointer = (element: Element, type: string, x: number, y: number, init: MouseEventInit = {}) =>
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...init }));

const solid = (color: string, opacity = 1): FillItem => ({ id: `f-${color}-${opacity}`, visible: true, type: 'solid', color, opacity, blendMode: 'normal' });
function rect(id: string, layerId: string, x: number, y: number, fills: FillItem[] = [solid('#ff0000')]): VectorNode {
  return { id, name: id, type: 'rectangle', layerId, x, y, width: 50, height: 50, rotation: 0, points: createRectangleAnchors(x, y, 50, 50), closed: true,
    visible: true, locked: false, fills, strokes: [{ id: `s-${id}`, visible: true, color: '#000000', weight: 2, cap: 'butt', join: 'miter', miterLimit: 4, align: 'center', dashArray: [], opacity: 1, blendMode: 'normal' }],
    effects: [], opacity: 1, blendMode: 'normal' };
}

function setup(tool: string, nodes: (layerId: string) => VectorNode[]) {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  (SVGElement.prototype as any).setPointerCapture = () => {};
  const doc = createDefaultDocument({ id: `iso-${Math.random()}`, width: 800, height: 600, includeSampleArtwork: false });
  const list = nodes(doc.layers[0].id);
  doc.nodes = Object.fromEntries(list.map((n) => [n.id, n]));
  doc.layers[0].nodeIds = list.map((n) => n.id);
  useStudioStore.getState().openDocument(doc);
  useStudioStore.setState({ activeTool: tool as any, selectedNodeIds: [], selectedIds: [], selectedAnchorIds: [], zoom: 1, panX: 0, panY: 0,
    snapToGrid: false, showSmartGuides: false, showEdges: true, showBoundingBox: true, activeModal: null, isolationGroupId: null, isolatedGroupId: null });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<StudioCanvas />));
  const svg = host.querySelector('.ai-canvas-container > svg')!;
  const node = (id: string) => host.querySelector(`[data-vector-node-id="${id}"]`)!;
  const state = () => useStudioStore.getState();
  const current = () => state().getActiveDocument();
  const done = () => { act(() => root.unmount()); host.remove(); };
  return { host, svg, node, state, current, done };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (SVGElement.prototype as any).setPointerCapture; });

describe('Group (Ctrl+G) and Ungroup', () => {
  it('keeps the stacking order, takes the top member\'s place, and ungroup puts everything back', () => {
    const { state, current, done } = setup('select', (l) => [rect('a', l, 0, 0), rect('mid', l, 400, 400), rect('b', l, 60, 0)]);
    act(() => { state().selectNodes(['b', 'a'], false); state().groupSelection(); });
    const groupId = state().selectedNodeIds[0];
    const group = current().nodes[groupId];
    expect(group.type).toBe('group');
    expect(group.children).toEqual(['a', 'b']); // bottom-to-top, not click order
    const roots = current().layers[0].nodeIds.filter((id) => !current().nodes[id].parentId);
    expect(roots).toEqual(['mid', groupId]); // the group sits where 'b' (the top member) was
    act(() => state().ungroupSelection());
    expect(current().nodes[groupId]).toBeUndefined();
    expect(current().layers[0].nodeIds.filter((id) => !current().nodes[id].parentId)).toEqual(['mid', 'a', 'b']);
    done();
  });

  it('groups members of a nested group inside that group', () => {
    const { state, current, done } = setup('select', (l) => [rect('a', l, 0, 0), rect('b', l, 60, 0), rect('c', l, 120, 0)]);
    act(() => { state().selectNodes(['a', 'b', 'c'], false); state().groupSelection(); });
    const outer = state().selectedNodeIds[0];
    act(() => { state().selectNodes(['b', 'c'], false); state().groupSelection(); });
    const inner = state().selectedNodeIds[0];
    expect(current().nodes[inner].parentId).toBe(outer);
    expect(current().nodes[outer].children).toEqual(['a', inner]);
    expect(current().nodes[inner].children).toEqual(['b', 'c']);
    done();
  });
});

describe('Selection tool and groups', () => {
  it('picks the whole group with the Selection tool and the object itself with Direct Selection', () => {
    const { node, state, done } = setup('select', (l) => [rect('a', l, 0, 0), rect('b', l, 60, 0)]);
    act(() => { state().selectNodes(['a', 'b'], false); state().groupSelection(); });
    const groupId = state().selectedNodeIds[0];
    act(() => state().clearSelection());
    act(() => { pointer(node('a'), 'pointerdown', 10, 10); }); act(() => { pointer(node('a'), 'pointerup', 10, 10); });
    expect(state().selectedNodeIds).toEqual([groupId]);
    act(() => state().setActiveTool('direct-select'));
    act(() => { pointer(node('a'), 'pointerdown', 10, 10); }); act(() => { pointer(node('a'), 'pointerup', 10, 10); });
    expect(state().selectedNodeIds).toEqual(['a']);
    done();
  });
});

describe('Isolation mode', () => {
  it('isolates a group on double-click: dims the rest, draws it on top, and a click outside exits', () => {
    const { host, svg, node, state, done } = setup('select', (l) => [rect('a', l, 0, 0), rect('b', l, 60, 0), rect('other', l, 300, 300)]);
    act(() => { state().selectNodes(['a', 'b'], false); state().groupSelection(); });
    const groupId = state().selectedNodeIds[0];
    act(() => { node('a').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 10, clientY: 10 })); });
    expect(state().isolationGroupId).toBe(groupId);
    expect(host.querySelector('[data-isolation-overlay]')).toBeTruthy();
    // The isolated group is drawn after (above) the overlay; the rest is view-only.
    const top = host.querySelector(`[data-isolated-content="${groupId}"]`)!;
    expect(top.querySelector('[data-vector-node-id="a"]')).toBeTruthy();
    expect(node('other').closest('g[style*="pointer-events: none"]')).toBeTruthy();
    // Inside isolation the Selection tool picks the group's children.
    act(() => { pointer(node('a'), 'pointerdown', 10, 10); }); act(() => { pointer(node('a'), 'pointerup', 10, 10); });
    expect(state().selectedNodeIds).toEqual(['a']);
    // A single click on empty space only deselects; a double-click there exits.
    act(() => { pointer(svg, 'pointerdown', 600, 500); }); act(() => { pointer(svg, 'pointerup', 600, 500); });
    expect(state().isolationGroupId).toBe(groupId);
    expect(state().selectedNodeIds).toEqual([]);
    act(() => { svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 600, clientY: 500 })); });
    expect(state().isolationGroupId).toBeNull();
    expect(host.querySelector('[data-isolation-overlay]')).toBeNull();
    done();
  });

  it('isolating one shape from inside an isolated group moves only that shape', () => {
    const { node, state, current, done } = setup('select', (l) => [rect('a', l, 0, 0), rect('b', l, 60, 0), rect('c', l, 120, 0)]);
    act(() => { state().selectNodes(['a', 'b', 'c'], false); state().groupSelection(); });
    act(() => { node('b').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 70, clientY: 10 })); }); // isolate the group
    act(() => { node('b').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 70, clientY: 10 })); }); // isolate B
    expect(state().isolationGroupId).toBe('b');
    act(() => { pointer(node('b'), 'pointerdown', 70, 10); });
    expect(state().selectedNodeIds).toEqual(['b']);
    act(() => { pointer(node('b'), 'pointermove', 110, 50); });
    act(() => { pointer(node('b'), 'pointerup', 110, 50); });
    expect([current().nodes.b.x, current().nodes.b.y]).toEqual([100, 40]);
    expect([current().nodes.a.x, current().nodes.c.x]).toEqual([0, 120]);
    done();
  });

  it('isolates a single shape without grouping it, and Escape-free exit via double-click outside', () => {
    const { svg, node, state, current, done } = setup('select', (l) => [rect('solo', l, 0, 0), rect('other', l, 300, 300)]);
    const before = Object.keys(current().nodes).sort();
    act(() => { node('solo').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 10, clientY: 10 })); });
    expect(state().isolationGroupId).toBe('solo');
    expect(Object.keys(current().nodes).sort()).toEqual(before);
    expect(current().nodes.solo.parentId).toBeUndefined();
    act(() => { svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 700, clientY: 500 })); });
    expect(state().isolationGroupId).toBeNull();
    done();
  });

  it('adds artwork drawn in an isolated group to that group', () => {
    const { svg, node, state, current, done } = setup('select', (l) => [rect('a', l, 0, 0), rect('b', l, 60, 0)]);
    act(() => { state().selectNodes(['a', 'b'], false); state().groupSelection(); });
    const groupId = state().selectedNodeIds[0];
    act(() => { node('a').dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 10, clientY: 10 })); });
    act(() => state().setActiveTool('rectangle'));
    act(() => { pointer(svg, 'pointerdown', 200, 200); }); act(() => { pointer(svg, 'pointermove', 260, 240); }); act(() => { pointer(svg, 'pointerup', 260, 240); });
    const created = state().selectedNodeIds[0];
    expect(current().nodes[created].parentId).toBe(groupId);
    expect(current().nodes[groupId].children).toContain(created);
    done();
  });
});

describe('Fill None hit-testing', () => {
  it('makes only the stroke of a no-fill shape clickable, while a 0% fill stays clickable inside', () => {
    const { node, done } = setup('select', (l) => [rect('hollow', l, 0, 0, []), rect('clear', l, 100, 0, [solid('#ff0000', 0)])]);
    const hit = node('hollow').querySelector('[data-stroke-hit]')!;
    expect(hit.getAttribute('fill')).toBe('none');
    expect(hit.getAttribute('pointer-events')).toBe('stroke');
    expect(node('hollow').querySelector('path[fill="transparent"]')).toBeNull();
    expect(node('clear').querySelector('[data-stroke-hit]')).toBeNull();
    expect(node('clear').querySelector('path[fill="#ff0000"]')).toBeTruthy();
    done();
  });

  it('highlights a no-fill shape along its outline on hover, and a filled one with its box', () => {
    const { host, node, done } = setup('select', (l) => [rect('hollow', l, 0, 0, []), rect('solid', l, 100, 0)]);
    act(() => { node('hollow').dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); });
    expect(host.querySelector('[data-hover-bounds="hollow"]')?.tagName.toLowerCase()).toBe('path');
    act(() => { node('solid').dispatchEvent(new MouseEvent('pointerover', { bubbles: true })); });
    expect(host.querySelector('[data-hover-bounds="solid"]')?.tagName.toLowerCase()).toBe('rect');
    done();
  });
});

describe('Creation tools hand back to the Selection tool', () => {
  it('switches to Selection after drawing a rectangle and after an eyedropper pick', () => {
    const { svg, node, state, done } = setup('rectangle', (l) => [rect('source', l, 400, 400)]);
    act(() => { pointer(svg, 'pointerdown', 50, 50); }); act(() => { pointer(svg, 'pointermove', 120, 110); }); act(() => { pointer(svg, 'pointerup', 120, 110); });
    expect(state().activeTool).toBe('select');
    act(() => state().setActiveTool('eyedropper'));
    act(() => { pointer(node('source'), 'pointerdown', 410, 410); }); act(() => { pointer(node('source'), 'pointerup', 410, 410); });
    expect(state().activeTool).toBe('select');
    done();
  });
});

describe('Drags that leave the canvas', () => {
  it('keeps drawing while the pointer is over a panel and finishes on a release there', () => {
    const { svg, state, current, done } = setup('rectangle', () => []);
    const panel = document.createElement('div'); document.body.appendChild(panel);
    act(() => { pointer(svg, 'pointerdown', 100, 100); });
    act(() => { pointer(panel, 'pointermove', 300, 250); });
    act(() => { pointer(panel, 'pointerup', 300, 250); });
    const created = current().nodes[state().selectedNodeIds[0]];
    expect(created?.type).toBe('rectangle');
    expect([created.width, created.height]).toEqual([200, 150]);
    panel.remove();
    done();
  });

  it('keeps a marquee going over a panel', () => {
    const { svg, state, done } = setup('select', (l) => [rect('a', l, 100, 100), rect('b', l, 400, 400)]);
    const panel = document.createElement('div'); document.body.appendChild(panel);
    act(() => { pointer(svg, 'pointerdown', 80, 80); });
    act(() => { pointer(panel, 'pointermove', 200, 200); });
    act(() => { pointer(panel, 'pointerup', 200, 200); });
    expect(state().selectedNodeIds).toEqual(['a']);
    panel.remove();
    done();
  });
});
