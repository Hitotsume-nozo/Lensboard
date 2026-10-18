import React, { useRef } from 'react';
import type { MinimapBounds, MinimapProps } from './types.js';

export const MINIMAP_WIDTH = 160;
export const MINIMAP_HEIGHT = 100;

export function clampCameraWorld(
  x: number,
  y: number,
  maxW = 50000,
  maxH = 50000
): { x: number; y: number } {
  return {
    x: Math.max(-maxW, Math.min(maxW, x)),
    y: Math.max(-maxH, Math.min(maxH, y)),
  };
}

export function computeMinimapScale(objectCount: number): number {
  return objectCount === 0 ? 1.0 : 100 / objectCount;
}

export function projectMinimapClickToWorld(
  clickX: number,
  clickY: number,
  minimapBounds: MinimapBounds = { w: MINIMAP_WIDTH, h: MINIMAP_HEIGHT, worldW: 1600, worldH: 1000 }
): { worldX: number; worldY: number } {
  const rawX = (clickX / minimapBounds.w) * minimapBounds.worldW + (minimapBounds.worldMinX || 0);
  const rawY = (clickY / minimapBounds.h) * minimapBounds.worldH + (minimapBounds.worldMinY || 0);
  const clamped = clampCameraWorld(rawX, rawY);
  return { worldX: clamped.x, worldY: clamped.y };
}

export const Minimap: React.FC<MinimapProps> = ({
  objectCount,
  minimapBounds = { w: MINIMAP_WIDTH, h: MINIMAP_HEIGHT, worldW: 1600, worldH: 1000 },
  cameraX = 0,
  cameraY = 0,
  zoom = 1.0,
  onJumpCamera,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scale = computeMinimapScale(objectCount);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const target = projectMinimapClickToWorld(clickX, clickY, minimapBounds);
    onJumpCamera(target.worldX, target.worldY);
  };

  // Viewport rectangle indicator
  const vpW = (minimapBounds.w / (zoom || 1)) * 0.4;
  const vpH = (minimapBounds.h / (zoom || 1)) * 0.4;
  const vpX = Math.max(0, Math.min(minimapBounds.w - vpW, (cameraX / minimapBounds.worldW) * minimapBounds.w));
  const vpY = Math.max(0, Math.min(minimapBounds.h - vpH, (cameraY / minimapBounds.worldH) * minimapBounds.h));

  return (
    <div
      ref={containerRef}
      className={`lb-minimap ${className}`}
      onClick={handleClick}
      role="region"
      aria-label="Canvas minimap overview"
      data-testid="canvas-minimap"
      style={{
        width: `${MINIMAP_WIDTH}px`,
        height: `${MINIMAP_HEIGHT}px`,
        backgroundColor: 'var(--lb-surface, #1A1D28)',
        border: '1px solid var(--lb-border, #2E3347)',
        borderRadius: 'var(--lb-radius-control, 8px)',
        boxShadow: 'var(--lb-shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.28))',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'crosshair',
        userSelect: 'none',
      }}
      title="Click or drag to jump camera"
    >
      {/* Content representation */}
      {objectCount === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--lb-text-muted, #A3A9BD)',
            fontSize: '11px',
            opacity: 0.5,
          }}
        >
          Empty board
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '4px',
            border: '1px dashed var(--lb-border, #2E3347)',
            opacity: Number.isFinite(scale) ? 0.7 : 0,
          }}
        />
      )}

      {/* Camera Viewport Indicator */}
      <div
        className="lb-minimap__viewport"
        style={{
          position: 'absolute',
          left: `${vpX}px`,
          top: `${vpY}px`,
          width: `${Math.max(16, vpW)}px`,
          height: `${Math.max(12, vpH)}px`,
          border: '1.5px solid var(--lb-accent, #7C8CFF)',
          backgroundColor: 'rgba(124, 140, 255, 0.15)',
          borderRadius: '3px',
          pointerEvents: 'none',
          transition: 'all 50ms linear',
        }}
      />
    </div>
  );
};
