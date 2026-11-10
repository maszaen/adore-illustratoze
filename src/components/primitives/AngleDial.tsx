import React, { useRef } from 'react';
import { NumericScrubInput } from './NumericScrubInput';

export interface AngleDialProps {
  angle: number;
  onChange: (angle: number) => void;
  size?: number;
  showInput?: boolean;
  label?: string;
  disabled?: boolean;
}

export const AngleDial: React.FC<AngleDialProps> = ({
  angle,
  onChange,
  size = 24,
  showInput = true,
  label,
  disabled = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const computeAngleFromEvent = (clientX: number, clientY: number, shiftKey: boolean) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
    if (shiftKey) {
      deg = Math.round(deg / 15) * 15;
    }
    if (deg <= -180) deg += 360;
    if (deg > 180) deg -= 360;
    onChange(deg);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    computeAngleFromEvent(e.clientX, e.clientY, e.shiftKey);

    const handleMove = (mv: PointerEvent) => {
      computeAngleFromEvent(mv.clientX, mv.clientY, mv.shiftKey);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const rad = (angle * Math.PI) / 180;
  const tx = cx + r * Math.cos(rad);
  const ty = cy + r * Math.sin(rad);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label && (
        <span style={{ color: 'var(--ai-text-secondary)', fontSize: 11 }}>{label}</span>
      )}
      <svg
        ref={svgRef}
        width={size}
        height={size}
        onPointerDown={handlePointerDown}
        style={{
          cursor: disabled ? 'default' : 'pointer',
          flexShrink: 0,
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--ai-bg-input)"
          stroke="var(--ai-border-input)"
          strokeWidth={1}
        />
        <line
          x1={cx - r + 2}
          y1={cy}
          x2={cx + r - 2}
          y2={cy}
          stroke="var(--ai-border-subtle)"
          strokeWidth={0.75}
          strokeDasharray="1.5 1.5"
        />
        <line
          x1={cx}
          y1={cy - r + 2}
          x2={cx}
          y2={cy + r - 2}
          stroke="var(--ai-border-subtle)"
          strokeWidth={0.75}
          strokeDasharray="1.5 1.5"
        />
        <line
          x1={cx}
          y1={cy}
          x2={tx}
          y2={ty}
          stroke="var(--ai-text-primary)"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={1.6} fill="var(--ai-text-secondary)" />
        <circle cx={tx} cy={ty} r={2.2} fill="var(--ai-accent-blue)" />
      </svg>
      {showInput && (
        <NumericScrubInput
          value={angle}
          onChange={(v) => {
            let norm = ((v + 180) % 360 + 360) % 360 - 180;
            onChange(Math.round(norm * 10) / 10);
          }}
          suffix="°"
          min={-360}
          max={360}
          step={1}
          decimals={1}
          width={50}
          disabled={disabled}
        />
      )}
    </div>
  );
};

export default AngleDial;
