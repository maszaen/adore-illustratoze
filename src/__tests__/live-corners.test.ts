import { describe, expect, it } from 'vitest';
import { cornerDragRadius, toggleCornerSelection } from '../core/math/liveCorners';

describe('live corner gestures', () => {
  it('clamps beyond the centre without bouncing, and reverses only when dragged back', () => {
    const radius = (x: number) => cornerDragRadius(0, 40, { x: 0, y: 0 }, { x, y: 0 }, { x: 1, y: 0 });
    expect(radius(50)).toBe(40);
    expect(radius(100)).toBe(40);
    expect(radius(200)).toBe(40);
    expect(radius(20)).toBe(17);
    expect(radius(-30)).toBe(0);
  });
  it('selects a widget and shift toggles additional widgets', () => {
    expect(toggleCornerSelection([], 'a', false)).toEqual(['a']);
    expect(toggleCornerSelection(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleCornerSelection(['a', 'b'], 'a', true)).toEqual(['b']);
    expect(toggleCornerSelection(['a', 'b'], 'c', false)).toEqual(['c']);
  });
});
