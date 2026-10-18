import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CommandPaletteProps } from './types.js';
import { fuzzySearchCommands } from './fuzzy.js';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  commands,
  onClose,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = fuzzySearchCommands(commands, query);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeSelected = useCallback(() => {
    if (filteredCommands.length > 0 && selectedIndex < filteredCommands.length) {
      const selected = filteredCommands[selectedIndex];
      if (!selected.disabled) {
        onClose();
        selected.execute();
      }
    }
  }, [filteredCommands, selectedIndex, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredCommands.length > 0 ? (prev + 1) % filteredCommands.length : 0
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredCommands.length > 0
            ? (prev - 1 + filteredCommands.length) % filteredCommands.length
            : 0
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      }
    },
    [filteredCommands, executeSelected, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className={`lb-palette-backdrop ${className}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      data-testid="command-palette-modal"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 2000,
        userSelect: 'none',
      }}
    >
      <div
        className="lb-palette-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '90vw',
          backgroundColor: 'var(--lb-surface-raised, #232736)',
          border: '1px solid var(--lb-border, #2E3347)',
          borderRadius: 'var(--lb-radius-panel, 12px)',
          boxShadow: 'var(--lb-shadow-floating, 0 16px 40px rgba(0, 0, 0, 0.36))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--lb-border, #2E3347)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: 'var(--lb-text-muted, #A3A9BD)', fontSize: '14px' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search boards..."
            aria-label="Search commands"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'var(--lb-text, #E8EAF2)',
              fontSize: '14px',
              fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
              outline: 'none',
            }}
          />
          <kbd
            style={{
              fontSize: '11px',
              color: 'var(--lb-text-muted, #A3A9BD)',
              backgroundColor: 'var(--lb-surface, #1A1D28)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--lb-border, #2E3347)',
            }}
          >
            ESC
          </kbd>
        </div>

        <div
          className="lb-palette-list"
          role="listbox"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px',
          }}
        >
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--lb-text-muted, #A3A9BD)',
                fontSize: '13px',
              }}
            >
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!cmd.disabled) {
                      onClose();
                      cmd.execute();
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: isSelected
                      ? 'var(--lb-surface, #1A1D28)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--lb-accent, #7C8CFF)'
                      : 'var(--lb-text, #E8EAF2)',
                    cursor: cmd.disabled ? 'not-allowed' : 'pointer',
                    opacity: cmd.disabled ? 0.5 : 1,
                    fontSize: '13px',
                    fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
                    transition: 'background-color 100ms ease-out',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cmd.starred && <span>★</span>}
                    <span>{cmd.title}</span>
                  </div>

                  {cmd.shortcut && (
                    <kbd
                      style={{
                        fontSize: '11px',
                        color: 'var(--lb-text-muted, #A3A9BD)',
                        backgroundColor: 'var(--lb-surface-raised, #232736)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--lb-border, #2E3347)',
                      }}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
