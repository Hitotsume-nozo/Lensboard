import React, { useEffect, useCallback } from 'react';
import type { ZoomControlsProps } from './types.js';

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64.0;

export function clampZoomValue(
  z: number,
  min = MIN_ZOOM,
  max = MAX_ZOOM
): number {
  return Math.max(min, Math.min(max, z));
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomChange,
  onFitAll,
  onResetZoom,
  onZoomToSelection,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
  className = '',
}) => {
  const currentPercentage = Math.round(zoom * 100);

  const handleZoomIn = () => {
    onZoomChange(clampZoomValue(zoom * 1.25, minZoom, maxZoom));
  };

  const handleZoomOut = () => {
    onZoomChange(clampZoomValue(zoom / 1.25, minZoom, maxZoom));
  };

  const handleReset = () => {
    if (onResetZoom) {
      onResetZoom();
    } else {
      onZoomChange(1.0);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '0') {
          e.preventDefault();
          if (onFitAll) onFitAll();
        } else if (e.key === '1') {
          e.preventDefault();
          handleReset();
        } else if (e.key === '2') {
          e.preventDefault();
          if (onZoomToSelection) onZoomToSelection();
        }
      }
    },
    [onFitAll, onZoomToSelection]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={`lb-zoom-controls ${className}`}
      role="group"
      aria-label="Zoom controls"
      data-testid="zoom-controls"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 6px',
        backgroundColor: 'var(--lb-surface, #1A1D28)',
        border: '1px solid var(--lb-border, #2E3347)',
        borderRadius: 'var(--lb-radius-control, 8px)',
        boxShadow: 'var(--lb-shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.28))',
        fontSize: '12px',
        fontFamily: 'var(--lb-font-mono, JetBrains Mono, monospace)',
        color: 'var(--lb-text, #E8EAF2)',
        userSelect: 'none',
      }}
    >
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={zoom <= minZoom}
        aria-label="Zoom Out"
        title="Zoom Out (-)"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--lb-text-muted, #A3A9BD)',
          cursor: zoom <= minZoom ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        −
      </button>

      <button
        type="button"
        onClick={handleReset}
        aria-label="Reset zoom to 100% (Ctrl+1)"
        title="Reset zoom to 100% (Ctrl+1)"
        style={{
          minWidth: '44px',
          height: '24px',
          padding: '0 4px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--lb-text, #E8EAF2)',
          cursor: 'pointer',
          textAlign: 'center',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        {currentPercentage}%
      </button>

      <button
        type="button"
        onClick={handleZoomIn}
        disabled={zoom >= maxZoom}
        aria-label="Zoom In"
        title="Zoom In (+)"
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--lb-text-muted, #A3A9BD)',
          cursor: zoom >= maxZoom ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>

      {onFitAll && (
        <button
          type="button"
          onClick={onFitAll}
          aria-label="Fit All (Ctrl+0)"
          title="Fit All (Ctrl+0)"
          style={{
            height: '24px',
            padding: '0 6px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--lb-text-muted, #A3A9BD)',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Fit
        </button>
      )}
    </div>
  );
};
