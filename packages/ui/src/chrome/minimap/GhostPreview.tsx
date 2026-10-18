import React from 'react';
import type { GhostPreviewProps } from './types.js';

export function canRenderGhost(candidate?: {
  bounds?: { w: number; h: number };
}): boolean {
  return !!candidate?.bounds && candidate.bounds.w > 0 && candidate.bounds.h > 0;
}

export const GhostPreview: React.FC<GhostPreviewProps> = ({
  visible,
  candidate,
  opacity = 0.35,
  className = '',
}) => {
  if (!visible || !canRenderGhost(candidate)) {
    return null;
  }

  const { x, y, w, h } = candidate!.bounds!;
  const isDiamond = candidate?.kind === 'diamond';
  const isCircle = candidate?.kind === 'circle';

  return (
    <div
      className={`lb-ghost-preview ${className}`}
      data-testid="ghost-preview"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
        border: isDiamond ? 'none' : '1.5px dashed var(--lb-accent, #7C8CFF)',
        borderRadius: isCircle ? '50%' : candidate?.kind === 'rect' ? '8px' : '4px',
        backgroundColor: 'var(--lb-accent, #7C8CFF)',
        clipPath: isDiamond ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' : undefined,
        opacity: Math.min(0.49, opacity),
        pointerEvents: 'none',
        zIndex: 900,
        transition: 'all 150ms ease-out',
      }}
    />
  );
};
