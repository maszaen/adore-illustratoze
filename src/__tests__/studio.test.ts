import { describe, it, expect, beforeEach } from 'vitest';
import {
  toPoints,
  fromPoints,
  convertUnit,
  evaluateNumericExpression,
} from '../core/math/units';
import {
  hexToRgb,
  rgbToHex,
  rgbToCmyk,
  cmykToRgb,
  rgbToHsb,
  hsbToRgb,
  isOutOfCmykGamut,
  correctToCmykGamut,
  applyColorTint,
  generateColorHarmony,
} from '../core/math/color';
import {
  createRectangleAnchors,
  createEllipseAnchors,
  createPolygonAnchors,
  createStarAnchors,
  anchorsToSvgPath,
  generateNodeSvgPath,
} from '../core/math/bezier';
import {
  performPathfinder,
  offsetVectorNode,
  splitIntoGridNodes,
} from '../core/math/pathfinder';
import { useStudioStore } from '../state/useStudioStore';
import { exportDocumentToSvgString, parseSvgStringToVectorNodes } from '../core/io/svgIo';
import { packDocumentToAdlozeBytes, unpackAdlozeBytesToDocument } from '../core/io/adlozeIo';

describe('Adore Illustratoze - Core Math, Vector Geometry, Store & IO Suite', () => {
  describe('Physical Unit Conversion & Scrubby Math Expressions', () => {
    it('converts physical units accurately (1 in = 72 pt = 25.4 mm)', () => {
      expect(toPoints(1, 'in')).toBeCloseTo(72, 4);
      expect(toPoints(25.4, 'mm')).toBeCloseTo(72, 4);
      expect(toPoints(2.54, 'cm')).toBeCloseTo(72, 4);
      expect(toPoints(6, 'pc')).toBeCloseTo(72, 4);
      expect(fromPoints(72, 'mm')).toBeCloseTo(25.4, 4);
      expect(convertUnit(10, 'cm', 'mm')).toBeCloseTo(100, 4);
    });

    it('evaluates arithmetic & cross-unit expressions inside scrub inputs', () => {
      expect(evaluateNumericExpression('100 + 50 * 2', 'px')).toBeCloseTo(200, 3);
      expect(evaluateNumericExpression('25.4mm', 'pt')).toBeCloseTo(72, 3);
      expect(evaluateNumericExpression('1in + 10pt', 'pt')).toBeCloseTo(82, 3);
      expect(evaluateNumericExpression('150%', 'px', 200)).toBeCloseTo(300, 3);
    });
  });

  describe('Color Spaces (RGB, CMYK, HSB, Global Tints & Gamut)', () => {
    it('round-trips RGB, Hex, CMYK, and HSB', () => {
      const rgb = hexToRgb('#ff9a00');
      expect(rgb).toEqual({ r: 255, g: 154, b: 0 });
      expect(rgbToHex(rgb)).toBe('#ff9a00');

      const cmyk = rgbToCmyk(rgb);
      const backRgb = cmykToRgb(cmyk);
      expect(Math.abs(backRgb.r - rgb.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(backRgb.g - rgb.g)).toBeLessThanOrEqual(2);

      const hsb = rgbToHsb(rgb);
      const fromHsb = hsbToRgb(hsb);
      expect(Math.abs(fromHsb.r - rgb.r)).toBeLessThanOrEqual(3);
    });

    it('detects out-of-gamut neon colors and corrects them to printable CMYK', () => {
      expect(isOutOfCmykGamut('#00ff00')).toBe(true);
      const corrected = correctToCmykGamut('#00ff00');
      expect(isOutOfCmykGamut(corrected)).toBe(false);
    });

    it('applies Global Color Tints and generates Color Guide harmonies', () => {
      expect(applyColorTint('#000000', 0)).toBe('#ffffff');
      expect(applyColorTint('#ff0000', 100)).toBe('#ff0000');
      const triad = generateColorHarmony('#1473e6', 'triad');
      expect(triad.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Bezier Path, Live Corners & Pathfinder Boolean Operations', () => {
    it('creates parametric anchors and serializes SVG path with Live Corners', () => {
      const rectPts = createRectangleAnchors(10, 20, 100, 80, 12, 'round');
      expect(rectPts).toHaveLength(4);
      const d = anchorsToSvgPath(rectPts, true, 12, 'round');
      expect(d).toContain('M');
      expect(d).toContain('Q');
      expect(d).toContain('Z');

      const ellipsePts = createEllipseAnchors(0, 0, 100, 100);
      expect(ellipsePts).toHaveLength(4);
      expect(anchorsToSvgPath(ellipsePts, true)).toContain('C');

      const polyPts = createPolygonAnchors(0, 0, 100, 100, 6);
      expect(polyPts).toHaveLength(6);

      const starPts = createStarAnchors(0, 0, 100, 100, 5, 0.45);
      expect(starPts).toHaveLength(10);
    });

    it('executes Pathfinder Unite, Minus Front, Intersect, Exclude, Offset Path & Split Into Grid', () => {
      const store = useStudioStore.getState();
      const doc = store.createDocument({
        name: 'Pathfinder-Test.adloze',
        width: 800,
        height: 600,
        includeSampleArtwork: false,
      });
      const layerId = doc.layers[0].id;

      const nodeA = {
        id: 'rect-a',
        name: 'Rect A',
        type: 'rectangle' as const,
        layerId,
        visible: true,
        locked: false,
        x: 100,
        y: 100,
        width: 120,
        height: 120,
        rotation: 0,
        points: createRectangleAnchors(100, 100, 120, 120),
        closed: true,
        fills: [{ id: 'f1', visible: true, type: 'solid' as const, color: '#ff0000', opacity: 1, blendMode: 'normal' as const }],
        strokes: [],
        effects: [],
        opacity: 1,
        blendMode: 'normal' as const,
      };
      const nodeB = {
        ...nodeA,
        id: 'rect-b',
        name: 'Rect B',
        x: 160,
        y: 160,
        points: createRectangleAnchors(160, 160, 120, 120),
      };

      const united = performPathfinder([nodeA, nodeB], 'unite');
      expect(united.length).toBeGreaterThanOrEqual(1);
      expect(generateNodeSvgPath(united[0])).toContain('M');

      const offsetNode = offsetVectorNode(nodeA, 15, 'miter', 10);
      expect(offsetNode.width).toBeGreaterThan(nodeA.width);

      const gridCells = splitIntoGridNodes(nodeA, {
        rows: 2,
        cols: 3,
        gutterH: 4,
        gutterV: 4,
      });
      expect(gridCells).toHaveLength(6);
    });
  });

  describe('Studio Store State, Appearance Stack, Global Swatch & Undo/Redo', () => {
    beforeEach(() => {
      useStudioStore.getState().createDocument({
        name: 'Unit-Test.adloze',
        width: 1000,
        height: 800,
        includeSampleArtwork: true,
      });
    });

    it('supports adding nodes, Multi-Fill/Multi-Stroke Appearance, and Unlimited Undo/Redo', () => {
      const s = useStudioStore.getState();
      const initialCount = Object.keys(s.getActiveDocument().nodes).length;

      const newNode = {
        id: 'test-shape-1',
        name: '<Custom Star>',
        type: 'star' as const,
        layerId: s.getActiveDocument().layers[0].id,
        visible: true,
        locked: false,
        x: 200,
        y: 200,
        width: 150,
        height: 150,
        rotation: 0,
        points: createStarAnchors(200, 200, 150, 150, 5, 0.5),
        closed: true,
        fills: [{ id: 'f-main', visible: true, type: 'solid' as const, color: '#1473e6', opacity: 1, blendMode: 'normal' as const }],
        strokes: [{ id: 's-main', visible: true, color: '#ff9a00', weight: 3, cap: 'round' as const, join: 'round' as const, miterLimit: 10, align: 'center' as const, dashArray: [], opacity: 1, blendMode: 'normal' as const }],
        effects: [],
        opacity: 1,
        blendMode: 'normal' as const,
      };

      s.addNode(newNode, 'Add Star');
      expect(Object.keys(useStudioStore.getState().getActiveDocument().nodes).length).toBe(
        initialCount + 1
      );

      // Select & add second Fill + second Stroke + Drop Shadow Live Effect
      useStudioStore.getState().selectNodes(['test-shape-1']);
      useStudioStore.getState().addFillToSelection('#22c55e');
      useStudioStore.getState().addStrokeToSelection('#ffffff', 6);
      useStudioStore.getState().addLiveEffectToSelection('drop-shadow', { blur: 8 });

      const updatedNode = useStudioStore.getState().getActiveDocument().nodes['test-shape-1'];
      expect(updatedNode.fills.length).toBe(2);
      expect(updatedNode.strokes.length).toBe(2);
      expect(updatedNode.effects.length).toBe(1);

      // Undo & Redo
      useStudioStore.getState().undo();
      expect(
        useStudioStore.getState().getActiveDocument().nodes['test-shape-1'].effects.length
      ).toBe(0);
      useStudioStore.getState().redo();
      expect(
        useStudioStore.getState().getActiveDocument().nodes['test-shape-1'].effects.length
      ).toBe(1);
    });
  });

  describe('SVG Import/Export & Native .adloze Archive Lossless Round-Trip', () => {
    it('exports precision SVG and parses SVG back into editable VectorNodes', () => {
      const doc = useStudioStore.getState().getActiveDocument();
      const svgCode = exportDocumentToSvgString(doc, {
        styling: 'presentation',
        decimalPlaces: 3,
      });
      expect(svgCode).toContain('<svg');
      expect(svgCode).toContain('</svg>');

      const parsed = parseSvgStringToVectorNodes(svgCode, doc.layers[0].id);
      expect(parsed.nodes.length).toBeGreaterThan(0);
    });

    it('packs and unpacks .adloze native archive with 100% lossless round-trip', () => {
      const originalDoc = useStudioStore.getState().getActiveDocument();
      const archiveBytes = packDocumentToAdlozeBytes(originalDoc);
      expect(archiveBytes.byteLength).toBeGreaterThan(100);

      const { manifest, document: restoredDoc } = unpackAdlozeBytesToDocument(archiveBytes);
      expect(manifest.format).toBe('AdoreIllustratozeNativeArchive');
      expect(restoredDoc.name).toBe(originalDoc.name);
      expect(restoredDoc.artboards.length).toBe(originalDoc.artboards.length);
      expect(Object.keys(restoredDoc.nodes).length).toBe(Object.keys(originalDoc.nodes).length);
      expect(restoredDoc.swatches.length).toBe(originalDoc.swatches.length);
    });
  });
});
