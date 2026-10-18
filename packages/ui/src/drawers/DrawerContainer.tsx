import React from 'react';
import type { DrawerContainerProps } from './types.js';
import { clampDrawerWidth } from './useDrawerState.js';

export const DrawerContainer: React.FC<DrawerContainerProps> = ({
  side,
  isOpen,
  width,
  onClose,
  reducedMotion = false,
  children,
  className = '',
}) => {
  const clampedW = clampDrawerWidth(width);
  const transitionDuration = reducedMotion ? '0ms' : '160ms';

  const transform =
    side === 'left'
      ? isOpen
        ? 'translateX(0)'
        : 'translateX(-100%)'
      : isOpen
        ? 'translateX(0)'
        : 'translateX(100%)';

  return (
    <aside
      className={`lb-drawer lb-drawer--${side} ${isOpen ? 'lb-drawer--open' : ''} ${className}`}
      role="complementary"
      aria-label={`${side} drawer`}
      aria-hidden={!isOpen}
      data-testid={`${side}-drawer`}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: `${clampedW}px`,
        backgroundColor: 'var(--lb-surface, #1A1D28)',
        borderRight: side === 'left' ? '1px solid var(--lb-border, #2E3347)' : 'none',
        borderLeft: side === 'right' ? '1px solid var(--lb-border, #2E3347)' : 'none',
        boxShadow: isOpen
          ? side === 'left'
            ? '4px 0 24px rgba(0, 0, 0, 0.28)'
            : '-4px 0 24px rgba(0, 0, 0, 0.28)'
          : 'none',
        transform,
        transition: `transform ${transitionDuration} cubic-bezier(0.2, 0, 0, 1)`,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      <div
        className="lb-drawer__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '44px',
          padding: '0 12px',
          borderBottom: '1px solid var(--lb-border, #2E3347)',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--lb-text, #E8EAF2)',
            fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
          }}
        >
          {side === 'left' ? 'Workspace' : 'Inspector'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${side} drawer (${side === 'left' ? '[' : ']'})`}
          title={`Close (${side === 'left' ? '[' : ']'})`}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--lb-text-muted, #A3A9BD)',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      <div
        className="lb-drawer__body"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </aside>
  );
};
