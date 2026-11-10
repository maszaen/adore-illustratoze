import React, { useRef } from 'react';

export interface ColorSwatchButtonProps {
  color: string; // Hex color, 'none', or CSS gradient
  onChange?: (newColor: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  size?: number;
  isStroke?: boolean;
  isGlobal?: boolean;
  isSpot?: boolean;
  selected?: boolean;
  title?: string;
  allowColorPicker?: boolean;
  disabled?: boolean;
}

export const ColorSwatchButton: React.FC<ColorSwatchButtonProps> = ({
  color,
  onChange,
  onClick,
  onDoubleClick,
  size = 18,
  isStroke = false,
  isGlobal = false,
  isSpot = false,
  selected = false,
  title,
  allowColorPicker = false,
  disabled = false,
}) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const isNone = !color || color === 'none' || color === 'transparent';
  const isGradient = color?.startsWith('linear-gradient') || color?.startsWith('radial-gradient');
  const hexValue = !isNone && !isGradient && color.startsWith('#') ? color.slice(0, 7) : '#000000';

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (onClick) {
      onClick(e);
    } else if (allowColorPicker && pickerRef.current) {
      pickerRef.current.click();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (onDoubleClick) {
      onDoubleClick(e);
    } else if (onChange && pickerRef.current) {
      pickerRef.current.click();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      disabled={disabled}
      title={title ?? (isNone ? 'None' : color)}
      style={{
        width: size,
        height: size,
        padding: 0,
        position: 'relative',
        background: isNone ? '#ffffff' : color,
        border: selected
          ? '1.5px solid var(--ai-accent-blue)'
          : '1px solid var(--ai-border-strong)',
        boxShadow: selected ? '0 0 0 1px #ffffff inset' : '0 0 0 1px rgba(255,255,255,0.18) inset',
        borderRadius: 1,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {isStroke && !isNone && (
        <span
          style={{
            width: Math.max(4, size - 8),
            height: Math.max(4, size - 8),
            backgroundColor: 'var(--ai-bg-panel)',
            border: '1px solid rgba(0,0,0,0.45)',
            display: 'block',
          }}
        />
      )}

      {isNone && (
        <svg
          width={size}
          height={size}
          viewBox="0 0 18 18"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {isStroke && (
            <rect
              x="4"
              y="4"
              width="10"
              height="10"
              fill="var(--ai-bg-panel)"
              stroke="#888888"
              strokeWidth="0.8"
            />
          )}
          <line x1="1" y1="17" x2="17" y2="1" stroke="#e3242b" strokeWidth="1.8" />
        </svg>
      )}

      {isGlobal && (
        <svg
          width={7}
          height={7}
          viewBox="0 0 7 7"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
          }}
        >
          <polygon points="7,0 7,7 0,7" fill="#ffffff" stroke="#1a1a1a" strokeWidth="0.5" />
          {isSpot && <circle cx="5" cy="5" r="1.2" fill="#1a1a1a" />}
        </svg>
      )}

      {(allowColorPicker || onChange) && (
        <input
          ref={pickerRef}
          type="color"
          value={hexValue}
          onChange={(e) => onChange?.(e.target.value)}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
          tabIndex={-1}
        />
      )}
    </button>
  );
};

export default ColorSwatchButton;
