import React from 'react';
import type { SaveIndicatorDotProps, SaveState } from './types.js';

export const SAVE_STATE_COLORS: Record<SaveState, string> = {
  saved: 'var(--lb-accent-2, #3DD6C6)',
  saving: 'var(--lb-warning, #FFC857)',
  dirty: 'var(--lb-warning, #FFC857)',
  error: 'var(--lb-danger, #FF6B7A)',
};

export const SAVE_STATE_TOOLTIPS: Record<SaveState, string> = {
  saved: 'All changes saved to disk',
  saving: 'Saving changes...',
  dirty: 'Unsaved changes in buffer',
  error: 'Save failed. Check disk storage',
};

export const SaveIndicatorDot: React.FC<SaveIndicatorDotProps> = ({
  state,
  size = 8,
  className = '',
}) => {
  const color = SAVE_STATE_COLORS[state] || SAVE_STATE_COLORS.saved;
  const tooltip = SAVE_STATE_TOOLTIPS[state] || 'Disk state';

  return (
    <span
      className={`lb-save-dot lb-save-dot--${state} ${className}`}
      role="status"
      aria-label={tooltip}
      title={tooltip}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: color,
        transition: 'background-color 150ms ease-out',
        animation: state === 'saving' ? 'lb-pulse 1000ms infinite ease-in-out' : 'none',
        flexShrink: 0,
      }}
    />
  );
};
