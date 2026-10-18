import React, { useEffect, useCallback } from 'react';
import type { ContextualPropertiesBarProps, PropertyItemKey } from './types.js';
import {
  CONTEXT_BAR_HEIGHT,
  useContextBarPlacement,
} from './useContextBarPlacement.js';

export function getPropertiesForType(type: string | string[]): string[] {
  if (Array.isArray(type)) {
    if (type.length === 0) return [];
    if (type.length === 1) return getPropertiesForType(type[0]);

    // Multi-selection with heterogeneous entity types displays common styling properties (f26-b3)
    return ['color', 'align', 'delete'];
  }

  switch (type) {
    case 'ink':
      return ['color', 'strokeWidth', 'renderMode', 'convert'];
    case 'shape':
      return ['color', 'strokeWidth', 'fill', 'renderMode', 'align', 'note'];
    case 'code':
      return ['language', 'run', 'testTable', 'note'];
    case 'text':
      return ['color', 'font', 'align', 'delete', 'note'];
    default:
      return ['color', 'note'];
  }
}

export const ContextualPropertiesBar: React.FC<ContextualPropertiesBarProps> = ({
  selectedIds,
  selectionBounds,
  entityType = 'shape',
  viewportWidth = 1920,
  viewportHeight = 1080,
  onDeselectAll,
  onPropertyChange,
  className = '',
}) => {
  const isVisible = selectedIds.length > 0 && selectionBounds !== null;
  const { position } = useContextBarPlacement(
    selectionBounds,
    viewportWidth,
    viewportHeight
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onDeselectAll) {
          onDeselectAll();
        }
      }
    },
    [onDeselectAll]
  );

  useEffect(() => {
    if (!isVisible) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, handleKeyDown]);

  if (!isVisible) {
    return null;
  }

  const properties = getPropertiesForType(entityType);

  return (
    <div
      className={`lb-context-bar ${className}`}
      role="toolbar"
      aria-label="Contextual properties"
      data-testid="contextual-properties-bar"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
        height: `${CONTEXT_BAR_HEIGHT}px`,
        backgroundColor: 'var(--lb-surface-raised, #232736)',
        border: '1px solid var(--lb-border, #2E3347)',
        borderRadius: 'var(--lb-radius-control, 8px)',
        boxShadow: 'var(--lb-shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.28))',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '6px',
        zIndex: 1100,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {properties.map((propKey) => (
        <button
          key={propKey}
          type="button"
          className={`lb-context-bar__btn lb-context-bar__btn--${propKey}`}
          onClick={() => {
            if (onPropertyChange) {
              onPropertyChange(propKey as PropertyItemKey, true);
            }
          }}
          style={{
            height: '28px',
            padding: '0 8px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--lb-text, #E8EAF2)',
            fontSize: '12px',
            fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'background-color 150ms ease-out',
          }}
          title={propKey}
        >
          {propKey}
        </button>
      ))}

      {onDeselectAll && (
        <button
          type="button"
          onClick={onDeselectAll}
          aria-label="Deselect (Escape)"
          title="Deselect (Escape)"
          style={{
            height: '28px',
            padding: '0 6px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: 'var(--lb-text-muted, #A3A9BD)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
};
