import React from 'react';
import type { ToolButtonProps } from './types.js';

export const ToolButton: React.FC<ToolButtonProps> = ({
  tool,
  isActive,
  onClick,
}) => {
  return (
    <button
      type="button"
      className={`lb-tool-button ${isActive ? 'lb-tool-button--active' : ''}`}
      onClick={onClick}
      aria-label={`${tool.name} (${tool.key})`}
      aria-pressed={isActive}
      title={`${tool.name} (${tool.key})`}
      style={{
        width: '40px',
        height: '40px',
        borderRadius: 'var(--lb-radius-control, 8px)',
        border: 'none',
        backgroundColor: isActive
          ? 'var(--lb-surface, #1A1D28)'
          : 'transparent',
        color: isActive
          ? 'var(--lb-accent, #7C8CFF)'
          : 'var(--lb-text-muted, #A3A9BD)',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: isActive ? 600 : 500,
        fontFamily: 'var(--lb-font-mono, JetBrains Mono, monospace)',
        transition: 'all 150ms ease-out',
        padding: 0,
        outline: 'none',
        flexShrink: 0,
        boxShadow: isActive ? 'inset 0 0 0 1px var(--lb-accent, #7C8CFF)' : 'none',
      }}
    >
      <span style={{ fontSize: '14px', lineHeight: 1 }}>{tool.key}</span>
      <span style={{ fontSize: '9px', lineHeight: 1, marginTop: '2px', opacity: 0.7 }}>
        {tool.name.substring(0, 3)}
      </span>
    </button>
  );
};
