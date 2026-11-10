import React, { useRef } from 'react';
import { useStudioStore } from '../../state/useStudioStore';

export interface FillStrokeProxyProps {
  compact?: boolean;
  fillColor?: string;
  strokeColor?: string;
  activeTarget?: 'fill' | 'stroke';
  onTargetChange?: (target: 'fill' | 'stroke') => void;
  onFillChange?: (color: string) => void;
  onStrokeChange?: (color: string) => void;
  onSwap?: () => void;
  onResetDefault?: () => void;
  onApplyMode?: (mode: 'solid' | 'gradient' | 'none') => void;
}

export const FillStrokeProxy: React.FC<FillStrokeProxyProps> = ({
  compact = false,
  fillColor: propFill,
  strokeColor: propStroke,
  activeTarget: propTarget,
  onTargetChange,
  onFillChange,
  onStrokeChange,
  onSwap,
  onResetDefault,
  onApplyMode,
}) => {
  const store = useStudioStore() as any;
  const fillInputRef = useRef<HTMLInputElement>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);

  const activeTarget: 'fill' | 'stroke' =
    propTarget ?? store.activeProxy ?? store.activePaintTarget ?? 'fill';

  const fillColor: string =
    propFill ?? store.currentFillColor ?? store.activeFillColor ?? '#ffffff';
  const strokeColor: string =
    propStroke ?? store.currentStrokeColor ?? store.activeStrokeColor ?? '#000000';

  const isFillNone = !fillColor || fillColor === 'none' || fillColor === 'transparent';
  const isStrokeNone = !strokeColor || strokeColor === 'none' || strokeColor === 'transparent';
  const isFillGradient =
    fillColor?.startsWith('linear-gradient') || fillColor?.startsWith('radial-gradient');

  const handleSetTarget = (target: 'fill' | 'stroke') => {
    if (onTargetChange) {
      onTargetChange(target);
      return;
    }
    if (typeof store.setActiveProxy === 'function') {
      store.setActiveProxy(target);
    } else if (typeof store.setActivePaintTarget === 'function') {
      store.setActivePaintTarget(target);
    } else {
      useStudioStore.setState({ activeProxy: target } as any);
    }
  };

  const handleFillColorChange = (color: string) => {
    if (onFillChange) {
      onFillChange(color);
      return;
    }
    if (typeof store.setCurrentFillColor === 'function') {
      store.setCurrentFillColor(color);
    } else if (typeof store.setFillColor === 'function') {
      store.setFillColor(color);
    }
  };

  const handleStrokeColorChange = (color: string) => {
    if (onStrokeChange) {
      onStrokeChange(color);
      return;
    }
    if (typeof store.setCurrentStrokeColor === 'function') {
      store.setCurrentStrokeColor(color);
    } else if (typeof store.setStrokeColor === 'function') {
      store.setStrokeColor(color);
    }
  };

  const handleSwapColors = () => {
    if (onSwap) {
      onSwap();
      return;
    }
    if (typeof store.swapFillAndStroke === 'function') {
      store.swapFillAndStroke();
    } else {
      const f = fillColor;
      const s = strokeColor;
      handleFillColorChange(s);
      handleStrokeColorChange(f);
    }
  };

  const handleDefaultColors = () => {
    if (onResetDefault) {
      onResetDefault();
      return;
    }
    if (typeof store.resetDefaultFillAndStroke === 'function') {
      store.resetDefaultFillAndStroke();
    } else {
      handleFillColorChange('#ffffff');
      handleStrokeColorChange('#000000');
    }
  };

  const handleSubMode = (mode: 'solid' | 'gradient' | 'none') => {
    if (onApplyMode) {
      onApplyMode(mode);
      return;
    }
    if (mode === 'none') {
      if (typeof store.setProxyNone === 'function') {
        store.setProxyNone();
      } else if (activeTarget === 'fill') {
        handleFillColorChange('none');
      } else {
        handleStrokeColorChange('none');
      }
    } else if (mode === 'solid') {
      const fallback = activeTarget === 'fill' ? '#1473e6' : '#000000';
      const current = activeTarget === 'fill' ? fillColor : strokeColor;
      const next =
        !current || current === 'none' || current.startsWith('linear-')
          ? fallback
          : current;
      if (activeTarget === 'fill') handleFillColorChange(next);
      else handleStrokeColorChange(next);
    } else if (mode === 'gradient') {
      if (typeof store.applyGradientToProxy === 'function') {
        store.applyGradientToProxy();
      } else {
        const gradCss = 'linear-gradient(90deg, #ffffff 0%, #000000 100%)';
        if (activeTarget === 'fill') handleFillColorChange(gradCss);
        else handleStrokeColorChange(gradCss);
      }
    }
  };

  const boxSize = compact ? 18 : 22;
  const containerSize = compact ? 30 : 36;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        userSelect: 'none',
      }}
    >
      {/* Overlapping Fill & Stroke Squares */}
      <div
        style={{
          position: 'relative',
          width: containerSize,
          height: containerSize,
        }}
      >
        {/* Fill Box (Top-Left) */}
        <button
          type="button"
          onClick={() => handleSetTarget('fill')}
          onDoubleClick={() => fillInputRef.current?.click()}
          title="Fill (Click to focus 'X', Double-click for Color Picker)"
          style={{
            position: 'absolute',
            top: 1,
            left: 1,
            width: boxSize,
            height: boxSize,
            padding: 0,
            background: isFillNone ? '#ffffff' : fillColor,
            border:
              activeTarget === 'fill'
                ? '1.5px solid #ffffff'
                : '1px solid var(--ai-border-strong)',
            boxShadow:
              activeTarget === 'fill'
                ? '0 0 0 1px #000000, 0 2px 5px rgba(0,0,0,0.5)'
                : '0 0 0 1px rgba(255,255,255,0.2) inset',
            zIndex: activeTarget === 'fill' ? 3 : 1,
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          {isFillNone && (
            <svg
              width={boxSize}
              height={boxSize}
              viewBox="0 0 22 22"
              style={{ position: 'absolute', inset: 0 }}
            >
              <line x1="1" y1="21" x2="21" y2="1" stroke="#e3242b" strokeWidth="2.2" />
            </svg>
          )}
        </button>

        {/* Stroke Hollow Box (Bottom-Right) */}
        <button
          type="button"
          onClick={() => handleSetTarget('stroke')}
          onDoubleClick={() => strokeInputRef.current?.click()}
          title="Stroke (Click to focus 'X', Double-click for Color Picker)"
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: boxSize,
            height: boxSize,
            padding: 0,
            background: isStrokeNone ? '#ffffff' : strokeColor,
            border:
              activeTarget === 'stroke'
                ? '1.5px solid #ffffff'
                : '1px solid var(--ai-border-strong)',
            boxShadow:
              activeTarget === 'stroke'
                ? '0 0 0 1px #000000, 0 2px 5px rgba(0,0,0,0.5)'
                : '0 0 0 1px rgba(255,255,255,0.2) inset',
            zIndex: activeTarget === 'stroke' ? 3 : 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              width: boxSize - 8,
              height: boxSize - 8,
              backgroundColor: 'var(--ai-bg-toolbar)',
              border: '1px solid rgba(0,0,0,0.55)',
              display: 'block',
              zIndex: 1,
            }}
          />
          {isStrokeNone && (
            <svg
              width={boxSize}
              height={boxSize}
              viewBox="0 0 22 22"
              style={{ position: 'absolute', inset: 0, zIndex: 2 }}
            >
              <line x1="1" y1="21" x2="21" y2="1" stroke="#e3242b" strokeWidth="2.2" />
            </svg>
          )}
        </button>

        {/* Swap Fill & Stroke Button (Top-Right) */}
        <button
          type="button"
          onClick={handleSwapColors}
          title="Swap Fill and Stroke (Shift+X)"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 11,
            height: 11,
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--ai-text-secondary)',
            cursor: 'pointer',
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 2.5H7.5V8M2 2.5L4 0.8M2 2.5L4 4.2M7.5 8L5.8 6M7.5 8L9.2 6"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Default Fill & Stroke Button (Bottom-Left) */}
        <button
          type="button"
          onClick={handleDefaultColors}
          title="Default Fill and Stroke (D)"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 11,
            height: 11,
            padding: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            zIndex: 4,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11">
            <rect x="0.5" y="0.5" width="6.5" height="6.5" fill="#ffffff" stroke="#1a1a1a" strokeWidth="0.9" />
            <rect x="3.5" y="3.5" width="6.5" height="6.5" fill="none" stroke="#000000" strokeWidth="1.4" />
          </svg>
        </button>

        {/* Hidden Native Color Pickers */}
        <input
          ref={fillInputRef}
          type="color"
          value={!isFillNone && !isFillGradient && fillColor.startsWith('#') ? fillColor.slice(0, 7) : '#ffffff'}
          onChange={(e) => handleFillColorChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
        <input
          ref={strokeInputRef}
          type="color"
          value={!isStrokeNone && strokeColor.startsWith('#') ? strokeColor.slice(0, 7) : '#000000'}
          onChange={(e) => handleStrokeColorChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
      </div>

      {/* 3 Mini Sub-Buttons Underneath: Color (<), Gradient (>), None (/) */}
      {!compact && (
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            type="button"
            onClick={() => handleSubMode('solid')}
            title="Color (<)"
            style={{
              width: 11,
              height: 11,
              padding: 0,
              background:
                activeTarget === 'fill'
                  ? !isFillNone && !isFillGradient
                    ? fillColor
                    : '#888888'
                  : !isStrokeNone
                  ? strokeColor
                  : '#888888',
              border: '1px solid var(--ai-border-strong)',
              cursor: 'pointer',
            }}
          />
          <button
            type="button"
            onClick={() => handleSubMode('gradient')}
            title="Gradient (>)"
            style={{
              width: 11,
              height: 11,
              padding: 0,
              background: 'linear-gradient(90deg, #ffffff 0%, #1a1a1a 100%)',
              border: '1px solid var(--ai-border-strong)',
              cursor: 'pointer',
            }}
          />
          <button
            type="button"
            onClick={() => handleSubMode('none')}
            title="None (/)"
            style={{
              width: 11,
              height: 11,
              padding: 0,
              background: '#ffffff',
              border: '1px solid var(--ai-border-strong)',
              position: 'relative',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" style={{ position: 'absolute', inset: 0 }}>
              <line x1="0" y1="9" x2="9" y2="0" stroke="#e3242b" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default FillStrokeProxy;
