// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioCanvas } from '../components/canvas/StudioCanvas';
import { StudioModals } from '../components/modals/StudioModals';
import { createDefaultDocument } from '../core/presets/defaultPresets';
import { createRectangleAnchors } from '../core/math/bezier';
import { useStudioStore } from '../state/useStudioStore';
import type { VectorNode } from '../core/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const pointer = (element: Element, type: string, x: number, y: number, init: MouseEventInit = {}) =>
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...init }));

function setup(options: { tool: string; smart?: boolean; withShape?: boolean; secondArtboard?: boolean; modals?: boolean }) {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  (SVGElement.prototype as any).setPointerCapture = () => {};
  const doc = createDefaultDocument({ id: `ab-${Math.random()}`, width: 400, height: 300, includeSampleArtwork: false });
  if (options.secondArtboard) doc.artboards.push({ ...doc.artboards[0], id: 'ab-two', name: 'Two', x: 600, y: 50, width: 200, height: 200 });
  if (options.withShape) {
    const node: VectorNode = { id: 'shape', name: 'shape', type: 'rectangle', layerId: doc.layers[0].id, x: 100, y: 100, width: 100, height: 60, rotation: 0,
      points: createRectangleAnchors(100, 100, 100, 60), closed: true, visible: true, locked: false,
      fills: [{ id: 'f', visible: true, type: 'solid', color: '#ff0000', opacity: 1, blendMode: 'normal' }], strokes: [], effects: [], opacity: 1, blendMode: 'normal' };
    doc.nodes = { shape: node }; doc.layers[0].nodeIds = ['shape'];
  }
  useStudioStore.getState().openDocument(doc);
  useStudioStore.setState({ activeTool: options.tool as any, selectedNodeIds: options.withShape ? ['shape'] : [], selectedIds: options.withShape ? ['shape'] : [],
    selectedAnchorIds: [], zoom: 1, panX: 0, panY: 0, snapToGrid: false, showSmartGuides: !!options.smart, showEdges: true, showBoundingBox: true, activeModal: null, creationPoint: null });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => root.render(<>{<StudioCanvas />}{options.modals && <StudioModals />}</>));
  const svg = host.querySelector('.ai-canvas-container > svg')!;
  const container = host.querySelector('.ai-canvas-container')!;
  const current = () => useStudioStore.getState().getActiveDocument();
  const done = () => { act(() => root.unmount()); host.remove(); };
  return { host, svg, container, current, done };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete (SVGElement.prototype as any).setPointerCapture; });

describe('Artboard tool', () => {
  it('draws a new artboard that follows the drag and is only created on release', () => {
    const { host, svg, current, done } = setup({ tool: 'artboard' });
    act(() => { pointer(svg, 'pointerdown', 500, 400); });
    act(() => { pointer(svg, 'pointermove', 760, 560); });
    expect(current().artboards).toHaveLength(1);
    expect(host.querySelector('[data-artboard-preview]')?.textContent).toContain('260 × 160');
    act(() => { pointer(svg, 'pointerup', 760, 560); });
    const created = current().artboards[1];
    expect([created.x, created.y, created.width, created.height]).toEqual([500, 400, 260, 160]);
    expect(current().activeArtboardId).toBe(created.id);
    expect(host.querySelector('[data-artboard-preview]')).toBeNull();
    done();
  });

  it('draws upward and leftward, and Escape cancels a drawing', () => {
    const { svg, current, done } = setup({ tool: 'artboard' });
    act(() => { pointer(svg, 'pointerdown', 900, 700); });
    act(() => { pointer(svg, 'pointermove', 700, 600); });
    act(() => { pointer(svg, 'pointerup', 700, 600); });
    expect([current().artboards[1].x, current().artboards[1].y, current().artboards[1].width, current().artboards[1].height]).toEqual([700, 600, 200, 100]);
    act(() => { pointer(svg, 'pointerdown', 1200, 700); });
    act(() => { pointer(svg, 'pointermove', 1300, 800); });
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    act(() => { pointer(svg, 'pointerup', 1300, 800); });
    expect(current().artboards).toHaveLength(2);
    done();
  });

  it('opens a size dialog on click that defaults to the active artboard and creates it at the click point', () => {
    const { host, svg, current, done } = setup({ tool: 'artboard', modals: true });
    act(() => { pointer(svg, 'pointerdown', 520, 40); });
    act(() => { pointer(svg, 'pointerup', 521, 41); });
    expect(useStudioStore.getState().activeModal).toBe('artboard-dialog');
    expect(useStudioStore.getState().creationPoint).toEqual({ x: 520, y: 40 });
    expect(current().artboards).toHaveLength(1);
    expect(host.textContent).toContain('New Artboard');
    const ok = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'OK')!;
    act(() => { ok.click(); });
    const created = current().artboards[1];
    expect([created.x, created.y, created.width, created.height]).toEqual([520, 40, 400, 300]);
    expect(useStudioStore.getState().activeModal).toBeNull();
    done();
  });

  it('moves an artboard by dragging inside it and snaps only to other artboards', () => {
    const { svg, current, done } = setup({ tool: 'artboard', smart: true, secondArtboard: true, withShape: true });
    // Artboard "Two" (600,50 200×200): drag it left so its left edge lands 3 px from the first artboard's right edge (400).
    act(() => { pointer(svg, 'pointerdown', 700, 150); });
    act(() => { pointer(svg, 'pointermove', 503, 150); });
    act(() => { pointer(svg, 'pointerup', 503, 150); });
    const two = current().artboards.find(a => a.id === 'ab-two')!;
    expect(two.x).toBe(400);
    // Landing Two's left edge at 153 (centre 253, right 353) is 3 px from the shape's centre line (150)
    // but far from every artboard line (0, 200, 400): it must not snap to the shape.
    act(() => { pointer(svg, 'pointerdown', 500, 150); });
    act(() => { pointer(svg, 'pointermove', 253, 150); });
    act(() => { pointer(svg, 'pointerup', 253, 150); });
    expect(current().artboards.find(a => a.id === 'ab-two')!.x).toBe(153);
    done();
  });

  it('resizes from an edge handle, snapping the edge to another artboard', () => {
    const { host, svg, current, done } = setup({ tool: 'artboard', smart: true, secondArtboard: true });
    act(() => { pointer(svg, 'pointerdown', 50, 50); }); // select the first artboard (click without moving)
    act(() => { pointer(svg, 'pointerup', 50, 50); });
    const east = Array.from(host.querySelectorAll('rect')).find(r => r.getAttribute('style')?.includes('ew-resize') && Number(r.getAttribute('x')) > 390)!;
    act(() => { pointer(east, 'pointerdown', 400, 150); });
    act(() => { pointer(svg, 'pointermove', 596, 150); });
    act(() => { pointer(svg, 'pointerup', 596, 150); });
    const first = current().artboards[0];
    expect([first.x, first.width, first.height]).toEqual([0, 600, 300]);
    done();
  });

  it('Escape puts a moved artboard back', () => {
    const { svg, current, done } = setup({ tool: 'artboard' });
    act(() => { pointer(svg, 'pointerdown', 100, 100); });
    act(() => { pointer(svg, 'pointermove', 300, 200); });
    expect(current().artboards[0].x).toBe(200);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    act(() => { pointer(svg, 'pointerup', 300, 200); });
    expect([current().artboards[0].x, current().artboards[0].y]).toEqual([0, 0]);
    done();
  });
});

describe('Rectangle tool click', () => {
  it('opens the shape dialog and creates the shape with its top-left at the click point', () => {
    const { host, svg, current, done } = setup({ tool: 'rectangle', modals: true });
    act(() => { pointer(svg, 'pointerdown', 80, 90); });
    act(() => { pointer(svg, 'pointerup', 80, 90); });
    expect(useStudioStore.getState().activeModal).toBe('shape-dialog');
    const ok = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'OK')!;
    act(() => { ok.click(); });
    const shape = Object.values(current().nodes)[0];
    expect([shape.x, shape.y]).toEqual([80, 90]);
    done();
  });
});

describe('middle-button pan', () => {
  it('pans over a live-corner widget instead of changing the corner radius', () => {
    const { host, svg, current, done } = setup({ tool: 'select', withShape: true });
    const widget = host.querySelector('[data-corner-widget]')!;
    expect(widget).toBeTruthy();
    act(() => { pointer(widget, 'pointerdown', 110, 110, { button: 1 }); });
    act(() => { pointer(svg, 'pointermove', 160, 150, { button: 1 }); });
    act(() => { pointer(svg, 'pointerup', 160, 150, { button: 1 }); });
    expect(current().nodes.shape.points.every(p => !p.cornerRadius)).toBe(true);
    expect([useStudioStore.getState().panX, useStudioStore.getState().panY]).toEqual([50, 40]);
    done();
  });

  it('pans over a bounding-box resize handle with Space held', () => {
    const { host, svg, current, done } = setup({ tool: 'select', withShape: true });
    const original = structuredClone(current().nodes.shape);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })));
    const handle = host.querySelector('[data-resize-handle="se"]')!;
    act(() => { pointer(handle, 'pointerdown', 200, 160); });
    act(() => { pointer(svg, 'pointermove', 230, 170); });
    act(() => { pointer(svg, 'pointerup', 230, 170); });
    act(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true })));
    expect(current().nodes.shape).toEqual(original);
    expect([useStudioStore.getState().panX, useStudioStore.getState().panY]).toEqual([30, 10]);
    done();
  });
});
