import type { Point2D } from '../types';

/** Signed movement along the inward widget axis; crossing the centre never reverses it. */
export function cornerDragRadius(initial: number, max: number, start: Point2D, current: Point2D, direction: Point2D): number {
  const delta = ((current.x - start.x) * direction.x + (current.y - start.y) * direction.y) * 0.85;
  return Math.round(Math.max(0, Math.min(max, initial + delta)) * 10) / 10;
}

export function toggleCornerSelection(selected: string[], id: string, additive: boolean): string[] {
  return additive ? (selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]) : [id];
}
