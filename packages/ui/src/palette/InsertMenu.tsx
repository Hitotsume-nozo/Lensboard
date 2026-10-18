import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { InsertMenuProps } from './types.js';
import { SMART_ENTITIES } from './smart-entities.js';
import { safeSearch } from './fuzzy.js';

export const InsertMenu: React.FC<InsertMenuProps> = ({
  isOpen,
  position,
  onSelectEntity,
  onClose,
  className = '',
}) => {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredEntities = SMART_ENTITIES.filter(
    (e) => safeSearch(filter, e.label) || safeSearch(filter, e.description)
  );

  useEffect(() => {
    if (isOpen) {
      setFilter('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  const selectCurrent = useCallback(() => {
    if (filteredEntities.length > 0 && selectedIndex < filteredEntities.length) {
      onSelectEntity(filteredEntities[selectedIndex]);
      onClose();
    }
  }, [filteredEntities, selectedIndex, onSelectEntity, onClose]);

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
          filteredEntities.length > 0 ? (prev + 1) % filteredEntities.length : 0
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredEntities.length > 0
            ? (prev - 1 + filteredEntities.length) % filteredEntities.length
            : 0
        );
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        selectCurrent();
      }
    },
    [filteredEntities, selectCurrent, onClose]
  );

  if (!isOpen) return null;

  const stylePosition: React.CSSProperties = position
    ? {
        position: 'fixed',
        left: `${Math.min(window.innerWidth - 340, Math.max(20, position.x))}px`,
        top: `${Math.min(window.innerHeight - 380, Math.max(20, position.y))}px`,
      }
    : {
        position: 'fixed',
        left: '50%',
        top: '30%',
        transform: 'translate(-50%, -30%)',
      };

  return (
    <div
      className={`lb-insert-menu-overlay ${className}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Insert smart object"
      data-testid="insert-menu"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        zIndex: 1500,
        userSelect: 'none',
      }}
    >
      <div
        className="lb-insert-menu-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...stylePosition,
          width: '320px',
          maxHeight: '360px',
          backgroundColor: 'var(--lb-surface-raised, #232736)',
          border: '1px solid var(--lb-border, #2E3347)',
          borderRadius: 'var(--lb-radius-panel, 12px)',
          boxShadow: 'var(--lb-shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.28))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--lb-border, #2E3347)' }}>
          <input
            ref={inputRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Insert smart object (/)..."
            aria-label="Filter smart objects"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: 'var(--lb-text, #E8EAF2)',
              fontSize: '13px',
              fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
              outline: 'none',
            }}
          />
        </div>

        <div
          role="listbox"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px',
          }}
        >
          {filteredEntities.map((entity, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={entity.type}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelectEntity(entity);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: isSelected
                    ? 'var(--lb-surface, #1A1D28)'
                    : 'transparent',
                  color: isSelected
                    ? 'var(--lb-accent, #7C8CFF)'
                    : 'var(--lb-text, #E8EAF2)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'background-color 100ms ease-out',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ fontWeight: 500 }}>{entity.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--lb-text-muted, #A3A9BD)' }}>
                    {entity.category}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--lb-text-muted, #A3A9BD)', opacity: 0.8 }}>
                  {entity.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
