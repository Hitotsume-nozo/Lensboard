import React from 'react';
import type { ToastContainerProps } from './types.js';
import { Toast } from './Toast.js';

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  className = '',
}) => {
  return (
    <div
      className={`lb-toast-container ${className}`}
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 3000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
