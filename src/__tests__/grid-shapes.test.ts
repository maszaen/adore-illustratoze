import { expect, it } from 'vitest';
import { createGridAnchors } from '../core/math/gridShapes';
import { anchorsToSvgPath } from '../core/math/bezier';

it('builds independent rectangular and polar grid subpaths', () => {
  const rect = anchorsToSvgPath(createGridAnchors('rect-grid', 0, 0, 100, 80), false);
  const polar = anchorsToSvgPath(createGridAnchors('polar-grid', 0, 0, 100, 80), false);
  expect((rect.match(/M /g) || []).length).toBe(12);
  expect((polar.match(/M /g) || []).length).toBe(17);
  expect((polar.match(/C /g) || []).length).toBe(20);
});
