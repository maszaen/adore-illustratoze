import type { ToolId } from '../types';

export type ControlBarMode =
  | 'default'
  | 'anchor'
  | 'text'
  | 'image'
  | 'artboard'
  | 'shape-builder'
  | 'live-paint'
  | 'mesh'
  | 'gradient'
  | 'symbol'
  | 'graph'
  | 'slice'
  | 'perspective'
  | 'transform'
  | 'brush';

export interface ToolPointerEvent {
  canvasX: number;
  canvasY: number;
  screenX: number;
  screenY: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  button: number;
  targetNodeId?: string | null;
  targetAnchorIndex?: number | null;
}

export interface BaseTool {
  id: ToolId;
  name: string;
  nameId: string;
  shortcut: string;
  category:
    | 'selection'
    | 'drawing'
    | 'type'
    | 'painting'
    | 'reshape'
    | 'symbol-graph'
    | 'navigation';
  controlBarMode: ControlBarMode;
  cursor: string;
  description: string;
  onPointerDown?: (evt: ToolPointerEvent) => void;
  onPointerMove?: (evt: ToolPointerEvent) => void;
  onPointerUp?: (evt: ToolPointerEvent) => void;
  onKeyDown?: (key: string, modifiers: { shift: boolean; alt: boolean; ctrl: boolean }) => void;
  getCursor?: (modifiers?: { shift?: boolean; alt?: boolean; space?: boolean }) => string;
  getControlBarConfig?: () => ControlBarMode;
}

export interface ToolDefinition extends BaseTool {
  groupId: string;
  iconName: string;
  badge?: string;
}

export interface ToolGroup {
  id: string;
  label: string;
  defaultToolId: ToolId;
  tools: ToolDefinition[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'selection-group',
    label: 'Selection Tools',
    defaultToolId: 'select',
    tools: [
      {
        id: 'select',
        groupId: 'selection-group',
        name: 'Selection Tool',
        nameId: 'Alat Seleksi',
        shortcut: 'V',
        category: 'selection',
        controlBarMode: 'default',
        cursor: 'default',
        iconName: 'MousePointer',
        description: 'Select, move, scale, rotate entire objects or groups (V)',
      },
    ],
  },
  {
    id: 'direct-select-group',
    label: 'Direct Selection Tools',
    defaultToolId: 'direct-select',
    tools: [
      {
        id: 'direct-select',
        groupId: 'direct-select-group',
        name: 'Direct Selection Tool',
        nameId: 'Seleksi Langsung',
        shortcut: 'A',
        category: 'selection',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'MousePointerClick',
        description: 'Select and edit individual anchor points, Bezier handles, and path segments (A)',
      },
      {
        id: 'group-select',
        groupId: 'direct-select-group',
        name: 'Group Selection Tool',
        nameId: 'Seleksi Grup Bertingkat',
        shortcut: 'Shift+A',
        category: 'selection',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'MousePointer2',
        badge: '+',
        description: 'Click once to select object in group, click again to select parent group hierarchy',
      },
    ],
  },
  {
    id: 'magic-wand-group',
    label: 'Magic Wand',
    defaultToolId: 'magic-wand',
    tools: [
      {
        id: 'magic-wand',
        groupId: 'magic-wand-group',
        name: 'Magic Wand Tool',
        nameId: 'Tongkat Sihir',
        shortcut: 'Y',
        category: 'selection',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Wand2',
        description: 'Select all objects with matching Fill Color, Stroke Color, Stroke Weight, Opacity, or Blend Mode (Y)',
      },
    ],
  },
  {
    id: 'lasso-group',
    label: 'Lasso Tool',
    defaultToolId: 'lasso',
    tools: [
      {
        id: 'lasso',
        groupId: 'lasso-group',
        name: 'Lasso Tool',
        nameId: 'Alat Laso',
        shortcut: 'Q',
        category: 'selection',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'Lasso',
        description: 'Draw a freehand marquee to select anchor points or path segments (Q)',
      },
    ],
  },
  {
    id: 'pen-group',
    label: 'Pen Tools',
    defaultToolId: 'pen',
    tools: [
      {
        id: 'pen',
        groupId: 'pen-group',
        name: 'Pen Tool',
        nameId: 'Alat Pena Bezier',
        shortcut: 'P',
        category: 'drawing',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'PenTool',
        description: 'Draw precision Bezier paths: click for corner point, drag for smooth handles (P)',
      },
      {
        id: 'add-anchor',
        groupId: 'pen-group',
        name: 'Add Anchor Point Tool',
        nameId: 'Tambah Titik Anchor',
        shortcut: '+',
        category: 'drawing',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'PenTool',
        badge: '+',
        description: 'Click on a path segment to insert a new Bezier anchor point (+)',
      },
      {
        id: 'delete-anchor',
        groupId: 'pen-group',
        name: 'Delete Anchor Point Tool',
        nameId: 'Hapus Titik Anchor',
        shortcut: '-',
        category: 'drawing',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'PenTool',
        badge: '-',
        description: 'Click on an existing anchor point to remove it while keeping the path connected (-)',
      },
      {
        id: 'anchor-point',
        groupId: 'pen-group',
        name: 'Anchor Point Tool',
        nameId: 'Konversi Titik Anchor',
        shortcut: 'Shift+C',
        category: 'drawing',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'Navigation2',
        badge: '^',
        description: 'Convert between smooth points and corner points, or break Bezier handle symmetry (Shift+C)',
      },
    ],
  },
  {
    id: 'curvature-group',
    label: 'Curvature Tool',
    defaultToolId: 'curvature',
    tools: [
      {
        id: 'curvature',
        groupId: 'curvature-group',
        name: 'Curvature Tool',
        nameId: 'Alat Kelengkungan',
        shortcut: 'Shift+~',
        category: 'drawing',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'Spline',
        description: 'Draw intuitive smooth curves by placing points; double-click or Alt-click for corner points (Shift+~)',
      },
    ],
  },
  {
    id: 'type-group',
    label: 'Type Tools',
    defaultToolId: 'type',
    tools: [
      {
        id: 'type',
        groupId: 'type-group',
        name: 'Type Tool',
        nameId: 'Alat Teks',
        shortcut: 'T',
        category: 'type',
        controlBarMode: 'text',
        cursor: 'text',
        iconName: 'Type',
        description: 'Click for Point Type or drag a frame for Area Type paragraphs (T)',
      },
      {
        id: 'area-type',
        groupId: 'type-group',
        name: 'Area Type Tool',
        nameId: 'Teks Dalam Area',
        shortcut: '',
        category: 'type',
        controlBarMode: 'text',
        cursor: 'text',
        iconName: 'AlignLeft',
        description: 'Click on a closed vector path to fill its interior with flowing paragraph text',
      },
      {
        id: 'type-on-path',
        groupId: 'type-group',
        name: 'Type on a Path Tool',
        nameId: 'Teks Pada Jalur',
        shortcut: '',
        category: 'type',
        controlBarMode: 'text',
        cursor: 'text',
        iconName: ' Baseline',
        description: 'Click any curve or circle to flow typography along its vector contour',
      },
      {
        id: 'vertical-type',
        groupId: 'type-group',
        name: 'Vertical Type Tool',
        nameId: 'Teks Vertikal',
        shortcut: '',
        category: 'type',
        controlBarMode: 'text',
        cursor: 'vertical-text',
        iconName: 'ArrowDownUp',
        description: 'Create vertical typography columns',
      },
      {
        id: 'touch-type',
        groupId: 'type-group',
        name: 'Touch Type Tool',
        nameId: 'Alat Sentuh Karakter',
        shortcut: 'Shift+T',
        category: 'type',
        controlBarMode: 'text',
        cursor: 'pointer',
        iconName: 'CaseSensitive',
        description: 'Visually move, scale, and rotate individual characters while keeping live editable text (Shift+T)',
      },
    ],
  },
  {
    id: 'line-group',
    label: 'Line & Grid Tools',
    defaultToolId: 'line',
    tools: [
      {
        id: 'line',
        groupId: 'line-group',
        name: 'Line Segment Tool',
        nameId: 'Segmen Garis',
        shortcut: '\\',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Minus',
        description: 'Draw straight line segments; click once for exact length and angle dialog (\\)',
      },
      {
        id: 'arc',
        groupId: 'line-group',
        name: 'Arc Tool',
        nameId: 'Alat Busur',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'CornerUpRight',
        description: 'Draw concave or convex elliptical arc curves; press Up/Down arrows while dragging to adjust slope',
      },
      {
        id: 'spiral',
        groupId: 'line-group',
        name: 'Spiral Tool',
        nameId: 'Alat Spiral',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Shell',
        description: 'Draw logarithmic spirals; press Up/Down arrows while dragging to add/remove winds',
      },
      {
        id: 'rect-grid',
        groupId: 'line-group',
        name: 'Rectangular Grid Tool',
        nameId: 'Grid Persegi',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Grid',
        description: 'Draw rectangular tables/grids; use arrow keys while dragging to change row/column dividers',
      },
      {
        id: 'polar-grid',
        groupId: 'line-group',
        name: 'Polar Grid Tool',
        nameId: 'Grid Polar Konsentris',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Target',
        description: 'Draw concentric circles and radial spokes; use arrow keys while dragging to adjust rings and rays',
      },
    ],
  },
  {
    id: 'shape-group',
    label: 'Geometric Shape Tools',
    defaultToolId: 'rectangle',
    tools: [
      {
        id: 'rectangle',
        groupId: 'shape-group',
        name: 'Rectangle Tool',
        nameId: 'Persegi Panjang',
        shortcut: 'M',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Square',
        description: 'Draw live rectangles and squares (Shift) with interactive Live Corner Widgets (M)',
      },
      {
        id: 'rounded-rectangle',
        groupId: 'shape-group',
        name: 'Rounded Rectangle Tool',
        nameId: 'Persegi Sudut Bulat',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Squircle',
        description: 'Draw rectangles with customizable corner radii; press Left/Right arrows while dragging',
      },
      {
        id: 'ellipse',
        groupId: 'shape-group',
        name: 'Ellipse Tool',
        nameId: 'Lingkaran / Elips',
        shortcut: 'L',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Circle',
        description: 'Draw ellipses and perfect circles (Shift) or draw from center (Alt) (L)',
      },
      {
        id: 'polygon',
        groupId: 'shape-group',
        name: 'Polygon Tool',
        nameId: 'Poligon',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Hexagon',
        description: 'Draw regular polygons; press Up/Down arrows while dragging to change side count',
      },
      {
        id: 'star',
        groupId: 'shape-group',
        name: 'Star Tool',
        nameId: 'Bintang',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Star',
        description: 'Draw multi-pointed stars; press Up/Down arrows while dragging to change point count',
      },
      {
        id: 'flare',
        groupId: 'shape-group',
        name: 'Flare Tool',
        nameId: 'Kilau Lensa (Flare)',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Sparkles',
        description: 'Create vector optical lens flare with center glow, halo, rays, and rings',
      },
    ],
  },
  {
    id: 'brush-group',
    label: 'Brush Tools',
    defaultToolId: 'paintbrush',
    tools: [
      {
        id: 'paintbrush',
        groupId: 'brush-group',
        name: 'Paintbrush Tool',
        nameId: 'Kuas Lukis Vektor',
        shortcut: 'B',
        category: 'painting',
        controlBarMode: 'brush',
        cursor: 'crosshair',
        iconName: 'Paintbrush',
        description: 'Draw freehand vector paths styled with Calligraphic, Scatter, Art, or Pattern Brushes (B)',
      },
      {
        id: 'blob-brush',
        groupId: 'brush-group',
        name: 'Blob Brush Tool',
        nameId: 'Kuas Blob (Closed Fill)',
        shortcut: 'Shift+B',
        category: 'painting',
        controlBarMode: 'brush',
        cursor: 'crosshair',
        iconName: 'Brush',
        description: 'Paint filled closed compound shapes that automatically unite with matching paths (Shift+B)',
      },
    ],
  },
  {
    id: 'pencil-group',
    label: 'Pencil & Smooth Tools',
    defaultToolId: 'pencil',
    tools: [
      {
        id: 'pencil',
        groupId: 'pencil-group',
        name: 'Pencil Tool',
        nameId: 'Alat Pensil',
        shortcut: 'N',
        category: 'drawing',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Pencil',
        description: 'Draw and reshape freehand open or closed vector paths with fidelity smoothing (N)',
      },
      {
        id: 'smooth',
        groupId: 'pencil-group',
        name: 'Smooth Tool',
        nameId: 'Alat Penghalus Kurva',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'Waves',
        description: 'Drag along a selected path to smooth jagged segments and reduce excess anchor points',
      },
      {
        id: 'path-eraser',
        groupId: 'pencil-group',
        name: 'Path Eraser Tool',
        nameId: 'Penghapus Segmen Path',
        shortcut: '',
        category: 'drawing',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'Eraser',
        description: 'Drag along a selected path segment to erase parts of the path spine',
      },
    ],
  },
  {
    id: 'eraser-group',
    label: 'Eraser, Scissors & Knife',
    defaultToolId: 'eraser',
    tools: [
      {
        id: 'eraser',
        groupId: 'eraser-group',
        name: 'Eraser Tool',
        nameId: 'Alat Penghapus',
        shortcut: 'Shift+E',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Eraser',
        description: 'Carve through closed vector shapes and automatically seal sliced edges (Shift+E)',
      },
      {
        id: 'scissors',
        groupId: 'eraser-group',
        name: 'Scissors Tool',
        nameId: 'Alat Gunting',
        shortcut: 'C',
        category: 'reshape',
        controlBarMode: 'anchor',
        cursor: 'crosshair',
        iconName: 'Scissors',
        description: 'Split a vector path at any anchor point or curve location into open endpoints (C)',
      },
      {
        id: 'knife',
        groupId: 'eraser-group',
        name: 'Knife Tool',
        nameId: 'Alat Pisau Pemotong',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Slice',
        description: 'Slice closed objects into separate closed vector pieces along a freehand or straight cut',
      },
    ],
  },
  {
    id: 'rotate-group',
    label: 'Rotate & Reflect',
    defaultToolId: 'rotate',
    tools: [
      {
        id: 'rotate',
        groupId: 'rotate-group',
        name: 'Rotate Tool',
        nameId: 'Alat Putar',
        shortcut: 'R',
        category: 'reshape',
        controlBarMode: 'transform',
        cursor: 'crosshair',
        iconName: 'RotateCw',
        description: 'Click to place Transform Origin pin, drag to rotate; Alt+click for numeric dialog (R)',
      },
      {
        id: 'reflect',
        groupId: 'rotate-group',
        name: 'Reflect Tool',
        nameId: 'Alat Cermin',
        shortcut: 'O',
        category: 'reshape',
        controlBarMode: 'transform',
        cursor: 'crosshair',
        iconName: 'FlipHorizontal2',
        description: 'Flip objects across a custom axis or Transform Origin pin; Alt+click for dialog (O)',
      },
    ],
  },
  {
    id: 'scale-group',
    label: 'Scale & Shear',
    defaultToolId: 'scale',
    tools: [
      {
        id: 'scale',
        groupId: 'scale-group',
        name: 'Scale Tool',
        nameId: 'Alat Skala',
        shortcut: 'S',
        category: 'reshape',
        controlBarMode: 'transform',
        cursor: 'crosshair',
        iconName: 'Maximize2',
        description: 'Scale objects relative to Transform Origin pin; Hold Shift for uniform scaling (S)',
      },
      {
        id: 'shear',
        groupId: 'scale-group',
        name: 'Shear Tool',
        nameId: 'Alat Miring (Skew)',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'transform',
        cursor: 'crosshair',
        iconName: 'Italic',
        description: 'Slant and skew objects along horizontal or vertical axes relative to origin pin',
      },
    ],
  },
  {
    id: 'width-liquify-group',
    label: 'Width & Liquify Tools',
    defaultToolId: 'width',
    tools: [
      {
        id: 'width',
        groupId: 'width-liquify-group',
        name: 'Width Tool',
        nameId: 'Alat Lebar Garis Variabel',
        shortcut: 'Shift+W',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'MoveHorizontal',
        description: 'Drag on any stroke to create non-linear Variable Width stroke profiles (Shift+W)',
      },
      {
        id: 'warp',
        groupId: 'width-liquify-group',
        name: 'Warp Tool',
        nameId: 'Alat Lengkungan Liquify',
        shortcut: 'Shift+R',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Wind',
        description: 'Push and mold vector paths like clay using an adjustable brush radius (Shift+R)',
      },
      {
        id: 'twirl',
        groupId: 'width-liquify-group',
        name: 'Twirl Tool',
        nameId: 'Alat Pusaran (Twirl)',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'RefreshCw',
        description: 'Swirl anchor points within the brush radius into spiral vortices',
      },
      {
        id: 'pucker',
        groupId: 'width-liquify-group',
        name: 'Pucker Tool',
        nameId: 'Alat Kerut (Pucker)',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Minimize2',
        description: 'Pull path geometry inward toward the brush center',
      },
      {
        id: 'bloat',
        groupId: 'width-liquify-group',
        name: 'Bloat Tool',
        nameId: 'Alat Gembung (Bloat)',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Maximize',
        description: 'Push path geometry outward away from the brush center',
      },
      {
        id: 'scallop',
        groupId: 'width-liquify-group',
        name: 'Scallop Tool',
        nameId: 'Alat Gerigi Kerang (Scallop)',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Waves',
        description: 'Add random curved scallop projections to path outlines',
      },
      {
        id: 'crystallize',
        groupId: 'width-liquify-group',
        name: 'Crystallize Tool',
        nameId: 'Alat Kristal Lancip',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Sparkles',
        description: 'Add sharp crystal-like spikes to path outlines',
      },
      {
        id: 'wrinkle',
        groupId: 'width-liquify-group',
        name: 'Wrinkle Tool',
        nameId: 'Alat Kerutan (Wrinkle)',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Activity',
        description: 'Add organic wrinkle details along path segments',
      },
    ],
  },
  {
    id: 'free-transform-group',
    label: 'Free Transform & Puppet Warp',
    defaultToolId: 'free-transform',
    tools: [
      {
        id: 'free-transform',
        groupId: 'free-transform-group',
        name: 'Free Transform Tool',
        nameId: 'Transformasi Bebas',
        shortcut: 'E',
        category: 'reshape',
        controlBarMode: 'transform',
        cursor: 'move',
        iconName: 'BoxSelect',
        description: 'Constrain, Free Transform, Perspective Distort, and Free Distort widget (E)',
      },
      {
        id: 'puppet-warp',
        groupId: 'free-transform-group',
        name: 'Puppet Warp Tool',
        nameId: 'Pin Jaring (Puppet Warp)',
        shortcut: '',
        category: 'reshape',
        controlBarMode: 'transform',
        cursor: 'pointer',
        iconName: 'Pin',
        description: 'Place mesh pins on artwork and drag or rotate pins to deform shapes elastically',
      },
    ],
  },
  {
    id: 'shape-builder-group',
    label: 'Shape Builder & Live Paint',
    defaultToolId: 'shape-builder',
    tools: [
      {
        id: 'shape-builder',
        groupId: 'shape-builder-group',
        name: 'Shape Builder Tool',
        nameId: 'Pembangun Bentuk',
        shortcut: 'Shift+M',
        category: 'painting',
        controlBarMode: 'shape-builder',
        cursor: 'crosshair',
        iconName: 'Combine',
        description: 'Drag across overlapping regions to merge, or Alt+drag to subtract regions interactively (Shift+M)',
      },
      {
        id: 'live-paint-bucket',
        groupId: 'shape-builder-group',
        name: 'Live Paint Bucket',
        nameId: 'Ember Cat Live Paint',
        shortcut: 'K',
        category: 'painting',
        controlBarMode: 'live-paint',
        cursor: 'pointer',
        iconName: 'PaintBucket',
        description: 'Click enclosed regions or edges of intersecting paths to fill with active swatch color (K)',
      },
      {
        id: 'live-paint-select',
        groupId: 'shape-builder-group',
        name: 'Live Paint Selection Tool',
        nameId: 'Seleksi Bidang Live Paint',
        shortcut: 'Shift+L',
        category: 'painting',
        controlBarMode: 'live-paint',
        cursor: 'pointer',
        iconName: 'MousePointerSquareDashed',
        description: 'Select individual faces and edges inside a Live Paint Group (Shift+L)',
      },
    ],
  },
  {
    id: 'perspective-group',
    label: 'Perspective Grid Tools',
    defaultToolId: 'perspective-grid',
    tools: [
      {
        id: 'perspective-grid',
        groupId: 'perspective-group',
        name: 'Perspective Grid Tool',
        nameId: 'Jaring Perspektif',
        shortcut: 'Shift+P',
        category: 'drawing',
        controlBarMode: 'perspective',
        cursor: 'crosshair',
        iconName: 'Boxes',
        description: 'Toggle and configure 1-Point, 2-Point, or 3-Point Perspective Grid planes (Shift+P)',
      },
      {
        id: 'perspective-select',
        groupId: 'perspective-group',
        name: 'Perspective Selection Tool',
        nameId: 'Seleksi Perspektif',
        shortcut: 'Shift+V',
        category: 'drawing',
        controlBarMode: 'perspective',
        cursor: 'move',
        iconName: 'Move3d',
        description: 'Snap and project objects onto the active Left, Right, or Horizontal perspective plane (Shift+V)',
      },
    ],
  },
  {
    id: 'mesh-group',
    label: 'Gradient Mesh Tool',
    defaultToolId: 'mesh',
    tools: [
      {
        id: 'mesh',
        groupId: 'mesh-group',
        name: 'Mesh Tool',
        nameId: 'Jaring Gradasi (Mesh)',
        shortcut: 'U',
        category: 'painting',
        controlBarMode: 'mesh',
        cursor: 'crosshair',
        iconName: 'Grid3x3',
        description: 'Create and color photorealistic multi-point gradient meshes inside objects (U)',
      },
    ],
  },
  {
    id: 'gradient-group',
    label: 'Gradient Tool',
    defaultToolId: 'gradient',
    tools: [
      {
        id: 'gradient',
        groupId: 'gradient-group',
        name: 'Gradient Tool',
        nameId: 'Alat Gradasi (Annotator)',
        shortcut: 'G',
        category: 'painting',
        controlBarMode: 'gradient',
        cursor: 'crosshair',
        iconName: 'Blend',
        description: 'Adjust Linear, Radial, and Freeform gradient stops and angles via On-Canvas Annotator (G)',
      },
    ],
  },
  {
    id: 'eyedropper-group',
    label: 'Eyedropper & Measure',
    defaultToolId: 'eyedropper',
    tools: [
      {
        id: 'eyedropper',
        groupId: 'eyedropper-group',
        name: 'Eyedropper Tool',
        nameId: 'Pipet Warna & Atribut',
        shortcut: 'I',
        category: 'painting',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Pipette',
        description: 'Copy full Appearance or Shift+click to sample color into active Fill/Stroke (I)',
      },
      {
        id: 'measure',
        groupId: 'eyedropper-group',
        name: 'Measure Tool',
        nameId: 'Alat Ukur Jarak & Sudut',
        shortcut: '',
        category: 'navigation',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Ruler',
        description: 'Drag between any two points on canvas to measure distance, delta X/Y, and angle',
      },
    ],
  },
  {
    id: 'blend-group',
    label: 'Blend Tool',
    defaultToolId: 'blend',
    tools: [
      {
        id: 'blend',
        groupId: 'blend-group',
        name: 'Blend Tool',
        nameId: 'Alat Blend Morfologi',
        shortcut: 'W',
        category: 'reshape',
        controlBarMode: 'default',
        cursor: 'crosshair',
        iconName: 'Layers',
        description: 'Click two objects sequentially to create smooth shape and color morph steps along a spine (W)',
      },
    ],
  },
  {
    id: 'symbol-group',
    label: 'Symbolism Tools',
    defaultToolId: 'symbol-sprayer',
    tools: [
      {
        id: 'symbol-sprayer',
        groupId: 'symbol-group',
        name: 'Symbol Sprayer Tool',
        nameId: 'Penyemprot Simbol',
        shortcut: 'Shift+S',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'Sparkle',
        description: 'Spray instances of the active Symbol onto the canvas (Shift+S)',
      },
      {
        id: 'symbol-shifter',
        groupId: 'symbol-group',
        name: 'Symbol Shifter Tool',
        nameId: 'Penggeser Simbol',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'Move',
        description: 'Nudge symbol instances in the direction of brush drag',
      },
      {
        id: 'symbol-scruncher',
        groupId: 'symbol-group',
        name: 'Symbol Scruncher Tool',
        nameId: 'Perapat Simbol',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'Shrink',
        description: 'Pull symbol instances closer together (or Alt+drag to push apart)',
      },
      {
        id: 'symbol-sizer',
        groupId: 'symbol-group',
        name: 'Symbol Sizer Tool',
        nameId: 'Pengubah Ukuran Simbol',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'ZoomIn',
        description: 'Enlarge symbol instances (or Alt+drag to shrink)',
      },
      {
        id: 'symbol-spinner',
        groupId: 'symbol-group',
        name: 'Symbol Spinner Tool',
        nameId: 'Pemutar Simbol',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'RotateCcw',
        description: 'Rotate symbol instances toward the cursor drag direction',
      },
      {
        id: 'symbol-stainer',
        groupId: 'symbol-group',
        name: 'Symbol Stainer Tool',
        nameId: 'Pewarna Simbol',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'Palette',
        description: 'Tint symbol instances toward the active Fill color',
      },
      {
        id: 'symbol-screener',
        groupId: 'symbol-group',
        name: 'Symbol Screener Tool',
        nameId: 'Transparansi Simbol',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'SunDim',
        description: 'Adjust opacity of symbol instances under the brush',
      },
      {
        id: 'symbol-styler',
        groupId: 'symbol-group',
        name: 'Symbol Styler Tool',
        nameId: 'Gaya Grafik Simbol',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'symbol',
        cursor: 'crosshair',
        iconName: 'Wand',
        description: 'Apply the active Graphic Style to symbol instances',
      },
    ],
  },
  {
    id: 'graph-group',
    label: 'Data-Driven Graph Tools',
    defaultToolId: 'column-graph',
    tools: [
      {
        id: 'column-graph',
        groupId: 'graph-group',
        name: 'Column Graph Tool',
        nameId: 'Grafik Batang Vertikal',
        shortcut: 'J',
        category: 'symbol-graph',
        controlBarMode: 'graph',
        cursor: 'crosshair',
        iconName: 'BarChart3',
        description: 'Draw a live data-driven vector Column Graph and open the Graph Data spreadsheet (J)',
      },
      {
        id: 'stacked-column-graph',
        groupId: 'graph-group',
        name: 'Stacked Column Graph Tool',
        nameId: 'Grafik Batang Bertumpuk',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'graph',
        cursor: 'crosshair',
        iconName: 'BarChart4',
        description: 'Draw a live vector Stacked Column Graph',
      },
      {
        id: 'bar-graph',
        groupId: 'graph-group',
        name: 'Bar Graph Tool',
        nameId: 'Grafik Batang Horizontal',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'graph',
        cursor: 'crosshair',
        iconName: 'BarChartHorizontal',
        description: 'Draw a live vector Horizontal Bar Graph',
      },
      {
        id: 'line-graph',
        groupId: 'graph-group',
        name: 'Line Graph Tool',
        nameId: 'Grafik Garis',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'graph',
        cursor: 'crosshair',
        iconName: 'LineChart',
        description: 'Draw a live vector Line Trend Graph',
      },
      {
        id: 'pie-graph',
        groupId: 'graph-group',
        name: 'Pie Graph Tool',
        nameId: 'Grafik Lingkaran (Pie)',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'graph',
        cursor: 'crosshair',
        iconName: 'PieChart',
        description: 'Draw a live vector proportional Pie Chart',
      },
      {
        id: 'radar-graph',
        groupId: 'graph-group',
        name: 'Radar Graph Tool',
        nameId: 'Grafik Radar (Spider)',
        shortcut: '',
        category: 'symbol-graph',
        controlBarMode: 'graph',
        cursor: 'crosshair',
        iconName: 'Radar',
        description: 'Draw a multi-axis vector Radar Chart',
      },
    ],
  },
  {
    id: 'artboard-group',
    label: 'Artboard Tool',
    defaultToolId: 'artboard',
    tools: [
      {
        id: 'artboard',
        groupId: 'artboard-group',
        name: 'Artboard Tool',
        nameId: 'Alat Artboard',
        shortcut: 'Shift+O',
        category: 'navigation',
        controlBarMode: 'artboard',
        cursor: 'crosshair',
        iconName: 'LayoutTemplate',
        description: 'Resize, create, duplicate (Alt+drag), and rearrange Artboards (Shift+O)',
      },
    ],
  },
  {
    id: 'slice-group',
    label: 'Slice Tools',
    defaultToolId: 'slice',
    tools: [
      {
        id: 'slice',
        groupId: 'slice-group',
        name: 'Slice Tool',
        nameId: 'Alat Pemotong Slice Web',
        shortcut: 'Shift+K',
        category: 'navigation',
        controlBarMode: 'slice',
        cursor: 'crosshair',
        iconName: 'Crop',
        description: 'Define export slice regions on the canvas for Save for Web / Export for Screens (Shift+K)',
      },
      {
        id: 'slice-select',
        groupId: 'slice-group',
        name: 'Slice Selection Tool',
        nameId: 'Seleksi Slice',
        shortcut: '',
        category: 'navigation',
        controlBarMode: 'slice',
        cursor: 'default',
        iconName: 'Scan',
        description: 'Select, resize, or delete existing User Slices',
      },
    ],
  },
  {
    id: 'hand-group',
    label: 'Hand & Navigation',
    defaultToolId: 'hand',
    tools: [
      {
        id: 'hand',
        groupId: 'hand-group',
        name: 'Hand Tool',
        nameId: 'Alat Geser Kanvas (Pan)',
        shortcut: 'H',
        category: 'navigation',
        controlBarMode: 'default',
        cursor: 'grab',
        iconName: 'Hand',
        description: 'Pan across the multi-artboard pasteboard (H or hold Spacebar)',
      },
    ],
  },
  {
    id: 'zoom-group',
    label: 'Zoom Tool',
    defaultToolId: 'zoom',
    tools: [
      {
        id: 'zoom',
        groupId: 'zoom-group',
        name: 'Zoom Tool',
        nameId: 'Alat Kaca Pembesar (Zoom)',
        shortcut: 'Z',
        category: 'navigation',
        controlBarMode: 'default',
        cursor: 'zoom-in',
        iconName: 'Search',
        description: 'Click or scrub to zoom in (3.13% to 64000%); Hold Alt to zoom out (Z)',
      },
    ],
  },
];

export const ALL_TOOLS: ToolDefinition[] = TOOL_GROUPS.flatMap((group) => group.tools);

export const TOOL_MAP: Record<string, ToolDefinition> = Object.fromEntries(
  ALL_TOOLS.map((tool) => [tool.id, tool])
);

export function getToolDefinition(toolId: string): ToolDefinition {
  return TOOL_MAP[toolId] ?? TOOL_GROUPS[0].tools[0];
}

export function getToolByShortcut(
  key: string,
  shiftKey = false,
  altKey = false,
  ctrlKey = false
): ToolDefinition | undefined {
  if (ctrlKey || altKey) return undefined;
  const upper = key.toUpperCase();

  // Handle Shift+~ / Shift+`
  if (shiftKey && (key === '~' || key === '`')) {
    return TOOL_MAP['curvature'];
  }

  // Handle + / = and -
  if (!shiftKey && (key === '+' || key === '=')) {
    return TOOL_MAP['add-anchor'];
  }
  if (!shiftKey && key === '-') {
    return TOOL_MAP['delete-anchor'];
  }
  if (!shiftKey && key === '\\') {
    return TOOL_MAP['line'];
  }

  const targetShortcut = shiftKey ? `Shift+${upper}` : upper;
  return ALL_TOOLS.find((t) => t.shortcut.toUpperCase() === targetShortcut.toUpperCase());
}

export function getToolCursor(
  toolId: string,
  modifiers?: { shift?: boolean; alt?: boolean; space?: boolean }
): string {
  if (modifiers?.space) return 'grab';
  if (toolId === 'zoom') {
    return modifiers?.alt ? 'zoom-out' : 'zoom-in';
  }
  if (toolId === 'hand') {
    return 'grab';
  }
  const def = getToolDefinition(toolId);
  return def.cursor || 'default';
}

export class ToolPluginRegistry {
  private plugins = new Map<string, BaseTool>();

  constructor(initialTools: BaseTool[]) {
    for (const tool of initialTools) {
      this.plugins.set(tool.id, tool);
    }
  }

  register(tool: BaseTool): void {
    this.plugins.set(tool.id, tool);
  }

  get(id: string): BaseTool | undefined {
    return this.plugins.get(id);
  }

  getAll(): BaseTool[] {
    return Array.from(this.plugins.values());
  }
}

export const toolRegistry = new ToolPluginRegistry(ALL_TOOLS);
