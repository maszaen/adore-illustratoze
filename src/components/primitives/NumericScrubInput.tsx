import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '../../state/useStudioStore';
import {
  UnitType,
  evaluateNumericExpression,
  formatUnitValue,
  toPoints,
  fromPoints,
} from '../../core/math/units';

const VALID_UNITS = new Set<string>(['px', 'pt', 'pc', 'mm', 'cm', 'in']);

export interface NumericScrubInputProps {
  label?: React.ReactNode;
  value: number;
  onChange: (newValue: number) => void;
  unit?: UnitType | string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  width?: number | string;
  disabled?: boolean;
  title?: string;
  className?: string;
  compact?: boolean;
}

export const NumericScrubInput: React.FC<NumericScrubInputProps> = ({
  label,
  value,
  onChange,
  unit,
  suffix,
  min = -Infinity,
  max = Infinity,
  step = 1,
  decimals = 2,
  width = 62,
  disabled = false,
  title,
  className = '',
  compact = false,
}) => {
  const isPhysicalUnit = Boolean(unit && VALID_UNITS.has(unit));
  const docUnit: UnitType = isPhysicalUnit ? (unit as UnitType) : 'pt';
  const displaySuffix = suffix !== undefined ? suffix : unit ? ` ${unit}` : '';

  const formatDisplay = (valInPoints: number): string => {
    const safeVal = Number.isFinite(valInPoints) ? valInPoints : 0;
    const formatted = isPhysicalUnit
      ? formatUnitValue(safeVal, docUnit, decimals)
      : `${Math.round(safeVal * Math.pow(10, decimals)) / Math.pow(10, decimals)}`;
    return `${formatted}${displaySuffix}`;
  };

  const [text, setText] = useState<string>(() => formatDisplay(value));
  const [focused, setFocused] = useState(false);
  const scrubRef = useRef<{ startX: number; startVal: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setText(formatDisplay(value));
    }
  }, [value, unit, suffix, decimals, focused]);

  const clampVal = (v: number): number => Math.max(min, Math.min(max, v));

  const commitText = (raw: string) => {
    const cleaned = displaySuffix && raw.endsWith(displaySuffix)
      ? raw.slice(0, raw.length - displaySuffix.length).trim()
      : raw.trim();

    if (!cleaned) {
      setText(formatDisplay(value));
      return;
    }

    const evaluated = evaluateNumericExpression(cleaned, docUnit, value);
    if (evaluated !== null && Number.isFinite(evaluated)) {
      const clamped = clampVal(evaluated);
      onChange(clamped);
      setText(formatDisplay(clamped));
    } else {
      setText(formatDisplay(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitText(text);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setText(formatDisplay(value));
      inputRef.current?.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
      const dir = e.key === 'ArrowUp' ? 1 : -1;
      const currentInUnit = isPhysicalUnit ? fromPoints(value, docUnit) : value;
      const nextInUnit = currentInUnit + dir * step * mult;
      const nextPoints = isPhysicalUnit ? toPoints(nextInUnit, docUnit) : nextInUnit;
      const clamped = clampVal(nextPoints);
      onChange(clamped);
      setText(formatDisplay(clamped));
    }
  };

  const handleLabelPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    scrubRef.current = { startX: e.clientX, startVal: value };
    let hasMoved = false;

    const handleMove = (moveEvent: PointerEvent) => {
      if (!scrubRef.current) return;
      const dx = moveEvent.clientX - scrubRef.current.startX;
      if (Math.abs(dx) < 1) return;
      if (!hasMoved) {
        hasMoved = true;
        useStudioStore.getState().beginTransaction('Adjust Value');
      }
      const mult = moveEvent.shiftKey ? 10 : moveEvent.altKey ? 0.1 : 1;
      const startInUnit = isPhysicalUnit
        ? fromPoints(scrubRef.current.startVal, docUnit)
        : scrubRef.current.startVal;
      const nextInUnit = startInUnit + Math.round(dx / 2) * step * mult;
      const nextPoints = isPhysicalUnit ? toPoints(nextInUnit, docUnit) : nextInUnit;
      const clamped = clampVal(nextPoints);
      onChange(clamped);
    };

    const handleUp = () => {
      scrubRef.current = null;
      if (hasMoved) {
        useStudioStore.getState().commitTransaction('Adjust Value');
      }
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      className={`ai-scrub-input ${className}`}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 3 : 4,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label !== undefined && (
        <span
          onPointerDown={handleLabelPointerDown}
          style={{
            cursor: disabled ? 'default' : 'ew-resize',
            color: 'var(--ai-text-secondary)',
            fontSize: 11,
            fontWeight: 500,
            userSelect: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {label}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        className="ai-input"
        disabled={disabled}
        value={text}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          commitText(text);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: compact ? 19 : 21,
          padding: '0 4px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  );
};

export default NumericScrubInput;
