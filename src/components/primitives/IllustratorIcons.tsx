import React from 'react';
import { Move, Shrink, ZoomIn, RotateCw, Palette, Sun, Wand2, BarChart3, BarChart4, BarChartHorizontal, LineChart, PieChart, Radar, MousePointer2 } from 'lucide-react';

export interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Authentic Adobe Illustrator CC Vector Tool & Action Icons (1px - 1.5px crisp strokes)
 */
export const ToolIcon: React.FC<{
  toolId?: string;
  iconName?: string;
  badge?: string;
  size?: number;
}> = ({ toolId, iconName, badge, size = 15 }) => {
  const id = toolId || iconName || 'select';
  const distinctIcons: Record<string, React.ElementType> = {
    'symbol-shifter': Move, 'symbol-scruncher': Shrink, 'symbol-sizer': ZoomIn,
    'symbol-spinner': RotateCw, 'symbol-stainer': Palette, 'symbol-screener': Sun,
    'symbol-styler': Wand2,
    'column-graph': BarChart3, 'stacked-column-graph': BarChart4,
    'bar-graph': BarChartHorizontal, 'line-graph': LineChart,
    'pie-graph': PieChart, 'radar-graph': Radar, 'perspective-select': MousePointer2,
  };
  const DistinctIcon = distinctIcons[id];
  if (DistinctIcon) return <DistinctIcon size={size} strokeWidth={1.5} aria-hidden="true" />;

  const renderSvg = () => {
    switch (id) {
      case 'select':
      case 'MousePointer':
        // Authentic Illustrator Black Selection Arrow (filled dark w/ crisp white/currentColor outline)
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path
              d="M3 1.5L3 13L6.2 9.9L8.3 14.2L10.1 13.3L8 9L12.2 9L3 1.5Z"
              fill="#1a1a1a"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'direct-select':
      case 'MousePointerClick':
        // Authentic Illustrator White Direct Selection Arrow (filled white/currentColor)
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path
              d="M3 1.5L3 13L6.2 9.9L8.3 14.2L10.1 13.3L8 9L12.2 9L3 1.5Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'group-select':
      case 'MousePointer2':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path
              d="M2.5 1.5L2.5 12L5.4 9.2L7.3 13.2L8.9 12.4L7 8.4L10.8 8.4L2.5 1.5Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            <path d="M12.5 3V8M10 5.5H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        );

      case 'magic-wand':
      case 'Wand2':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2.5 13.5L10.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M10.5 5.5L12.5 3.5" stroke="var(--ai-accent-blue)" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 2V4M14 8H12M12.5 2.5L11.2 3.8M13.5 5.5L12 5.5M5.5 4.5L6.5 5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        );

      case 'lasso':
      case 'Lasso':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="6.5" rx="5.5" ry="4" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="5.5" cy="10.2" r="1.4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.5 11.6C5.5 13.2 3.5 14 2.5 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );

      case 'pen':
      case 'add-anchor':
      case 'delete-anchor':
      case 'PenTool':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path
              d="M11.5 2L14 4.5L7.5 12L2 14L4 8.5L11.5 2Z"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
            <path d="M2 14L6 10" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="6.3" cy="9.7" r="1" fill="currentColor" />
          </svg>
        );

      case 'anchor-point':
      case 'Navigation2':
        // Convert Anchor Point V-angle tool
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M3 13L4.5 3L14 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="3.2" y="1.8" width="2.5" height="2.5" fill="currentColor" />
          </svg>
        );

      case 'curvature':
      case 'Spline':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M10.5 2L13 4.5L8.5 10L4 12L6 7.5L10.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M2 13.5C3.5 10 6.5 14 13.5 11.5" stroke="var(--ai-accent-blue)" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" />
          </svg>
        );

      case 'type':
      case 'area-type':
      case 'type-on-path':
      case 'vertical-type':
      case 'touch-type':
      case 'Type':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M3 3.5V2.5H13V3.5M8 2.5V13.5M5.5 13.5H10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {id === 'area-type' && <rect x="1.5" y="1.5" width="13" height="13" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 1.5" />}
            {id === 'type-on-path' && <path d="M1.5 14C5 11 11 15 14.5 11.5" stroke="var(--ai-accent-blue)" strokeWidth="1.2" />}
            {id === 'touch-type' && <rect x="2" y="2" width="12" height="12" stroke="var(--ai-accent-blue)" strokeWidth="1" />}
          </svg>
        );

      case 'line':
      case 'Minus':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <line x1="2.5" y1="13.5" x2="13.5" y2="2.5" stroke="currentColor" strokeWidth="1.4" />
            <rect x="1.5" y="12.5" width="2.2" height="2.2" fill="currentColor" />
            <rect x="12.3" y="1.5" width="2.2" height="2.2" fill="currentColor" />
          </svg>
        );

      case 'arc':
      case 'CornerUpRight':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2.5 13.5C2.5 6 6 2.5 13.5 2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <rect x="1.5" y="12.5" width="2.2" height="2.2" fill="currentColor" />
            <rect x="12.3" y="1.5" width="2.2" height="2.2" fill="currentColor" />
          </svg>
        );

      case 'spiral':
      case 'Shell':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path
              d="M8 8C8 7 9.2 6.8 9.5 7.8C9.9 9.2 8.2 10.5 6.8 10C4.8 9.2 4.5 6.5 6 4.8C8 2.8 11.5 3.5 12.8 6.2C14 9 12 13 8.5 13.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
          </svg>
        );

      case 'rect-grid':
      case 'Grid':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 2V14M10 2V14M2 6H14M2 10H14" stroke="currentColor" strokeWidth="0.9" />
          </svg>
        );

      case 'polar-grid':
      case 'Target':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="0.9" />
            <path d="M8 2V14M2 8H14M3.8 3.8L12.2 12.2M12.2 3.8L3.8 12.2" stroke="currentColor" strokeWidth="0.8" />
          </svg>
        );

      case 'rectangle':
      case 'Square':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="10" stroke="currentColor" strokeWidth="1.35" />
          </svg>
        );

      case 'rounded-rectangle':
      case 'Squircle':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="10" rx="3" stroke="currentColor" strokeWidth="1.35" />
          </svg>
        );

      case 'ellipse':
      case 'Circle':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <ellipse cx="8" cy="8" rx="6" ry="5" stroke="currentColor" strokeWidth="1.35" />
          </svg>
        );

      case 'polygon':
      case 'Hexagon':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <polygon points="8,1.8 13.8,5.2 13.8,10.8 8,14.2 2.2,10.8 2.2,5.2" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        );

      case 'star':
      case 'Star':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <polygon
              points="8,1.5 9.9,5.8 14.5,6.2 11,9.3 12,13.9 8,11.4 4,13.9 5,9.3 1.5,6.2 6.1,5.8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'flare':
      case 'Sparkles':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1" />
            <path d="M6.5 1V12M1 6.5H12M3 3L10 10M10 3L3 10" stroke="currentColor" strokeWidth="0.9" />
          </svg>
        );

      case 'paintbrush':
      case 'Paintbrush':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M13.5 2.5L7.5 8.5L6.5 7.5L12.5 1.5L13.5 2.5Z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6.5 8.5C5 8.5 3.8 9.8 3.8 11.2C3.8 12.2 2.8 13 2 13.2C3.2 14 5.2 14 6.5 12.8C7.5 11.8 7.5 9.5 6.5 8.5Z" fill="currentColor" />
          </svg>
        );

      case 'blob-brush':
      case 'Brush':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M13.5 2L8 7.5L6.5 6L12 0.5L13.5 2Z" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="5.2" cy="10.8" r="3.2" fill="currentColor" />
          </svg>
        );

      case 'pencil':
      case 'Pencil':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2L14 4.5L5.5 13L2 14L3 10.5L11.5 2Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M9.8 3.7L12.3 6.2" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        );

      case 'smooth':
      case 'Waves':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2 11C4.5 6 7 13 10 8C11.5 5.5 13 7 14 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M2 13.5H14" stroke="var(--ai-accent-blue)" strokeWidth="1" strokeDasharray="2 2" />
          </svg>
        );

      case 'eraser':
      case 'path-eraser':
      case 'Eraser':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M9.5 2.5L14 7L7.5 13.5H3.5L1.8 11.8L9.5 2.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M6 6L10.5 10.5M2 13.5H13.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            {id === 'path-eraser' && <path d="M1 3C4 1 6 4 8 3" stroke="var(--ai-accent-blue)" strokeWidth="1.2" strokeDasharray="2 1" />}
          </svg>
        );

      case 'scissors':
      case 'Scissors':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="4" cy="11.5" r="2.2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5.8 5.8L14 12.5M5.8 10.2L14 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        );

      case 'knife':
      case 'Slice':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M13 2L14.5 3.5L9.5 8.5L8 7L13 2Z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 7L2 13.5C4.5 13.5 7.5 11.8 9.5 8.5" fill="currentColor" />
          </svg>
        );

      case 'rotate':
      case 'RotateCw':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M13 8A5 5 0 1 1 11.2 4.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
            <polyline points="11.5,1.5 11.8,4.6 8.7,4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8" cy="8" r="1.3" fill="var(--ai-guide-cyan)" />
          </svg>
        );

      case 'reflect':
      case 'FlipHorizontal2':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <polygon points="2,12 6.5,3.5 6.5,12" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="14,12 9.5,3.5 9.5,12" fill="currentColor" />
            <line x1="8" y1="1.5" x2="8" y2="14.5" stroke="var(--ai-accent-blue)" strokeWidth="1.1" strokeDasharray="1.5 1.5" />
          </svg>
        );

      case 'scale':
      case 'Maximize2':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="7" width="6" height="6" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.5 1.5" />
            <rect x="4" y="2.5" width="9.5" height="9.5" stroke="currentColor" strokeWidth="1.25" />
            <path d="M7 9L12.5 3.5M9.5 3.5H12.5V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        );

      case 'shear':
      case 'Italic':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <polygon points="4.5,3 13.5,3 11.5,13 2.5,13" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        );

      case 'width':
      case 'MoveHorizontal':
        // Authentic Variable Width Tool Icon (curved stroke flaring wider with handles)
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2.5 13C4.5 9.5 6 5.5 13.5 3C9.5 7.5 8 11 2.5 13Z" fill="currentColor" />
            <line x1="4.5" y1="4.5" x2="11.5" y2="11.5" stroke="var(--ai-accent-blue)" strokeWidth="1.2" />
            <circle cx="4.5" cy="4.5" r="1.4" fill="#ffffff" stroke="var(--ai-accent-blue)" strokeWidth="1" />
            <circle cx="11.5" cy="11.5" r="1.4" fill="#ffffff" stroke="var(--ai-accent-blue)" strokeWidth="1" />
          </svg>
        );

      case 'warp':
      case 'twirl':
      case 'pucker':
      case 'bloat':
      case 'scallop':
      case 'crystallize':
      case 'wrinkle':
      case 'Wind':
      case 'RefreshCw':
      case 'Minimize2':
      case 'Maximize':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2.5 12C5 12 5.5 4 8.5 4C11.5 4 11 12 13.5 12" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 1.5" />
          </svg>
        );

      case 'free-transform':
      case 'BoxSelect':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="3" y="3" width="10" height="10" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 1.5" />
            <rect x="1.8" y="1.8" width="2.4" height="2.4" fill="currentColor" />
            <rect x="11.8" y="1.8" width="2.4" height="2.4" fill="currentColor" />
            <rect x="1.8" y="11.8" width="2.4" height="2.4" fill="currentColor" />
            <rect x="11.8" y="11.8" width="2.4" height="2.4" fill="currentColor" />
          </svg>
        );

      case 'puppet-warp':
      case 'Pin':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <circle cx="9.5" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="9.5" cy="5.5" r="1" fill="var(--ai-accent-blue)" />
            <line x1="7.3" y1="7.7" x2="2.5" y2="12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        );

      case 'shape-builder':
      case 'Combine':
        // Authentic Shape Builder Tool: overlapping circle + square with cursor arrow
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.2" />
            <rect x="6.5" y="6.5" width="7.2" height="7.2" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 1" />
            <path d="M3 12L5.5 9.5M4.5 13L7 10.5" stroke="var(--ai-accent-blue)" strokeWidth="1.2" />
          </svg>
        );

      case 'live-paint-bucket':
      case 'PaintBucket':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M6.5 2.5L12.5 8.5L7.5 13.5L1.5 7.5L6.5 2.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M13.2 10.2C14.2 11.5 14.5 13.2 13.2 13.8C12 14.2 11.5 12.2 13.2 10.2Z" fill="var(--ai-accent-blue)" />
          </svg>
        );

      case 'live-paint-select':
      case 'MousePointerSquareDashed':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.1" strokeDasharray="1.5 1.5" />
            <path d="M8 7L8 14.5L10.3 12.2L12 15L13.3 14.2L11.6 11.4L14.5 11.4L8 7Z" fill="currentColor" />
          </svg>
        );

      case 'perspective-grid':
      case 'perspective-select':
      case 'Boxes':
      case 'Move3d':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <polygon points="8,2 14.5,5.5 14.5,11.5 8,14.5 1.5,11.5 1.5,5.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 2V14.5M1.5 5.5L8 8.5L14.5 5.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        );

      case 'mesh':
      case 'Grid3x3':
        // Authentic Gradient Mesh Tool Icon (curved lattice grid with anchor nodes)
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2 3C6 4.5 10 1.5 14 3C12.5 7 15 10 13.5 13.5C9.5 12 6 14.5 2 13C3.5 9 1 6.5 2 3Z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2.5 8C6.5 9.2 10 6.8 13.8 8M8 2.8C6.8 6.8 9.2 10 8 13.2" stroke="currentColor" strokeWidth="0.95" />
            <rect x="7" y="7" width="2" height="2" fill="var(--ai-accent-blue)" />
          </svg>
        );

      case 'gradient':
      case 'Blend':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <defs>
              <linearGradient id="aiGradToolIcon" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <rect x="2" y="3" width="12" height="10" fill="url(#aiGradToolIcon)" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );

      case 'eyedropper':
      case 'Pipette':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M10.5 2.5L13.5 5.5L11.5 7.5L8.5 4.5L10.5 2.5Z" fill="currentColor" />
            <path d="M8.5 5.5L3 11L2 14L5 13L10.5 7.5" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
          </svg>
        );

      case 'measure':
      case 'Ruler':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="5.5" width="13" height="5" transform="rotate(-35 8 8)" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 7.5L6 9M7.5 5.8L8.8 7.5M10 4L11 5.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        );

      case 'blend':
      case 'Layers':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="1.5" width="5" height="5" stroke="currentColor" strokeWidth="1.15" />
            <rect x="5.2" y="5.2" width="5" height="5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1" />
            <circle cx="11.5" cy="11.5" r="2.8" fill="currentColor" />
          </svg>
        );

      case 'symbol-sprayer':
      case 'symbol-shifter':
      case 'symbol-scruncher':
      case 'symbol-sizer':
      case 'symbol-spinner':
      case 'symbol-stainer':
      case 'symbol-screener':
      case 'symbol-styler':
      case 'Sparkle':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="7.5" y="7" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 7V5.2H11.5V7" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="3" cy="3.5" r="1" fill="currentColor" />
            <circle cx="5.5" cy="2.5" r="0.9" fill="currentColor" />
            <circle cx="4.8" cy="5.5" r="1" fill="currentColor" />
            <circle cx="2.2" cy="6.8" r="0.8" fill="currentColor" />
          </svg>
        );

      case 'column-graph':
      case 'graph-column':
      case 'stacked-column-graph':
      case 'bar-graph':
      case 'graph-bar':
      case 'line-graph':
      case 'graph-line':
      case 'pie-graph':
      case 'graph-pie':
      case 'radar-graph':
      case 'graph-radar':
      case 'BarChart3':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2 2V14H14" stroke="currentColor" strokeWidth="1.2" />
            <rect x="4" y="8" width="2.2" height="5.5" fill="currentColor" />
            <rect x="7.4" y="4.5" width="2.2" height="9" fill="currentColor" />
            <rect x="10.8" y="6.5" width="2.2" height="7" fill="currentColor" />
          </svg>
        );

      case 'artboard':
      case 'LayoutTemplate':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="3.5" y="3.5" width="9" height="9" stroke="currentColor" strokeWidth="1.25" />
            <path d="M1.5 3.5H3.5V1.5M12.5 1.5V3.5H14.5M1.5 12.5H3.5V14.5M12.5 14.5V12.5H14.5" stroke="currentColor" strokeWidth="1.15" />
          </svg>
        );

      case 'slice':
      case 'slice-select':
      case 'Crop':
      case 'Scan':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2L14 4.5L6.5 12H3V8.5L11.5 2Z" stroke="currentColor" strokeWidth="1.2" />
            <rect x="2" y="2" width="6" height="5" stroke="var(--ai-brand-fg)" strokeWidth="1" strokeDasharray="1.5 1" />
          </svg>
        );

      case 'hand':
      case 'Hand':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path
              d="M6 8V3.2C6 2.7 6.4 2.3 6.9 2.3C7.4 2.3 7.8 2.7 7.8 3.2V7.2M7.8 6.5V2.4C7.8 1.9 8.2 1.5 8.7 1.5C9.2 1.5 9.6 1.9 9.6 2.4V7.2M9.6 6.8V3.2C9.6 2.7 10 2.3 10.5 2.3C11 2.3 11.4 2.7 11.4 3.2V8.2M11.4 6.5C11.4 6 11.8 5.6 12.3 5.6C12.8 5.6 13.2 6 13.2 6.5V10.2C13.2 12.8 11.2 14.5 8.6 14.5H7.2C5.2 14.5 3.8 13.2 3 11.3L2.1 9.2C1.9 8.6 2.2 8 2.8 7.8C3.3 7.6 3.9 7.9 4.2 8.4L4.8 9.5V4.5C4.8 4 5.2 3.6 5.7 3.6"
              stroke="currentColor"
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      case 'zoom':
      case 'Search':
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <circle cx="6.8" cy="6.8" r="4.5" stroke="currentColor" strokeWidth="1.35" />
            <line x1="10.2" y1="10.2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M6.8 4.6V9M4.6 6.8H9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        );

      default:
        return (
          <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {renderSvg()}
      {badge && (
        <span
          style={{
            position: 'absolute',
            right: -2,
            top: -3,
            fontSize: 8.5,
            fontWeight: 800,
            color: 'var(--ai-brand-fg)',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {badge}
        </span>
      )}
    </span>
  );
};

/**
 * Alignment Action Icons for ControlBar and AlignPanel
 */
export const AlignIcon: React.FC<{ op: string; size?: number }> = ({ op, size = 14 }) => {
  switch (op) {
    case 'left':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <line x1="2" y1="1.5" x2="2" y2="12.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="3.5" y="3" width="8" height="3" fill="currentColor" />
          <rect x="3.5" y="8" width="5.5" height="3" fill="currentColor" />
        </svg>
      );
    case 'center-h':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <line x1="7" y1="1.5" x2="7" y2="12.5" stroke="currentColor" strokeWidth="1.2" />
          <rect x="2.5" y="3" width="9" height="3" fill="currentColor" />
          <rect x="4" y="8" width="6" height="3" fill="currentColor" />
        </svg>
      );
    case 'right':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <line x1="12" y1="1.5" x2="12" y2="12.5" stroke="currentColor" strokeWidth="1.3" />
          <rect x="2.5" y="3" width="8" height="3" fill="currentColor" />
          <rect x="5" y="8" width="5.5" height="3" fill="currentColor" />
        </svg>
      );
    case 'top':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <line x1="1.5" y1="2" x2="12.5" y2="2" stroke="currentColor" strokeWidth="1.3" />
          <rect x="3" y="3.5" width="3" height="8" fill="currentColor" />
          <rect x="8" y="3.5" width="3" height="5.5" fill="currentColor" />
        </svg>
      );
    case 'center-v':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <line x1="1.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1.2" />
          <rect x="3" y="2.5" width="3" height="9" fill="currentColor" />
          <rect x="8" y="4" width="3" height="6" fill="currentColor" />
        </svg>
      );
    case 'bottom':
      return (
        <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
          <line x1="1.5" y1="12" x2="12.5" y2="12" stroke="currentColor" strokeWidth="1.3" />
          <rect x="3" y="2.5" width="3" height="8" fill="currentColor" />
          <rect x="8" y="5" width="3" height="5.5" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
};

export default ToolIcon;
