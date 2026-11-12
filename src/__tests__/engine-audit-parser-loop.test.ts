import { it, expect } from 'vitest';
import { parseSvgPathDToAnchorPoints } from '../core/io/svgIo';
it('rejects malformed paths without hanging while accepting valid subpaths', () => {
  for (const d of ['M0 0 L10 0 Z 1', 'M0 0 L10', 'M0 0 L10 Z', 'M0 0 X 1 2', 'M0 0 L1e999 2', 'M0 0 @ L1 2']) {
    expect(() => parseSvgPathDToAnchorPoints(d)).toThrow(/SVG path/);
  }
  const valid=parseSvgPathDToAnchorPoints('M0 0L10 0L10 10Z M2 2L4 2L4 4Z');
  expect(valid.points.some(p=>p.moveTo)).toBe(true);
});
