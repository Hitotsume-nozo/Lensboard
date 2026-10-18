import React, { useEffect, useRef } from 'react';
import type { ToastItem } from './types.js';

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = toast.durationMs ?? 4000;

  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss(toast.id);
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.id, duration, onDismiss]);

  const borderColor =
    toast.type === 'error'
      ? 'var(--lb-danger, #FF6B7A)'
      : toast.type === 'warning'
        ? 'var(--lb-warning, #FFC857)'
        : toast.type === 'success'
          ? 'var(--lb-accent-2, #3DD6C6)'
          : 'var(--lb-border, #2E3347)';

  return (
    <div
      className={`lb-toast lb-toast--${toast.type || 'info'}`}
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minWidth: '240px',
        maxWidth: '400px',
        padding: '10px 14px',
        backgroundColor: 'var(--lb-surface-raised, #232736)',
        borderLeft: `3px solid ${borderColor}`,
        borderTop: '1px solid var(--lb-border, #2E3347)',
        borderRight: '1px solid var(--lb-border, #2E3347)',
        borderBottom: '1px solid var(--lb-border, #2E3347)',
        borderRadius: 'var(--lb-radius-control, 8px)',
        boxShadow: 'var(--lb-shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.28))',
        color: 'var(--lb-text, #E8EAF2)',
        fontSize: '13px',
        fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
        pointerEvents: 'auto',
        transition: 'all 160ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>

      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction!();
            onDismiss(toast.id);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--lb-accent, #7C8CFF)',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: '12px',
          }}
        >
          {toast.actionLabel}
        </button>
      )}

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss toast"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--lb-text-muted, #A3A9BD)',
          cursor: 'pointer',
          padding: '2px',
          lineHeight: 1,
          fontSize: '14px',
        }}
      >
        ✕
      </button>
    </div>
  );
};
