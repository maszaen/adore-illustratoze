import React from 'react';

/** A fitted, proportional representation of one artboard, independent of its units. */
export const ArtboardPreview: React.FC<{ width: number; height: number; compact?: boolean }> = ({ width, height, compact = false }) => {
  const w = Number.isFinite(width) && width > 0 ? width : 1;
  const h = Number.isFinite(height) && height > 0 ? height : 1;
  const maxW = compact ? 54 : 128;
  const maxH = compact ? 42 : 92;
  const scale = Math.min(maxW / w, maxH / h);
  return <div className={`ai-artboard-preview${compact ? ' ai-artboard-preview-compact' : ''}`} aria-hidden="true">
    <div className="ai-artboard-preview-page" style={{ width: w * scale, height: h * scale }} />
  </div>;
};
