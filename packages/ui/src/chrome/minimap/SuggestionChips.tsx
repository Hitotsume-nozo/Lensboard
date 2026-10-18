import React, { useEffect, useCallback, useRef } from 'react';
import type { SuggestionCandidate, SuggestionChipsProps } from './types.js';

export function selectCandidate(
  candidates: SuggestionCandidate[],
  key: string
): SuggestionCandidate | null {
  return candidates.find((c) => c.key === key) ?? null;
}

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({
  candidates,
  onSelectCandidate,
  onDismiss,
  autoFadeMs = 4000,
  className = '',
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fade timer: 4000ms idle
  useEffect(() => {
    if (autoFadeMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, autoFadeMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [autoFadeMs, onDismiss]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }

      if (e.key === 'Enter') {
        if (candidates.length > 0) {
          e.preventDefault();
          onSelectCandidate(candidates[0]);
        }
        return;
      }

      // Keys '1', '2', '3'
      if (['1', '2', '3'].includes(e.key)) {
        const found = selectCandidate(candidates, e.key);
        if (found) {
          e.preventDefault();
          onSelectCandidate(found);
        }
        // If not found, safe no-op per boundary f29-b1
      }
    },
    [candidates, onSelectCandidate, onDismiss]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div
      className={`lb-suggestion-chips ${className}`}
      role="group"
      aria-label="Conversion suggestions"
      data-testid="suggestion-chips"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 6px',
        backgroundColor: 'var(--lb-surface-raised, #232736)',
        border: '1px solid var(--lb-border, #2E3347)',
        borderRadius: 'var(--lb-radius-control, 8px)',
        boxShadow: 'var(--lb-shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.28))',
        zIndex: 1050,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          color: 'var(--lb-text-muted, #A3A9BD)',
          marginRight: '2px',
        }}
      >
        Convert:
      </span>

      {candidates.slice(0, 3).map((candidate) => (
        <button
          key={candidate.key}
          type="button"
          className="lb-suggestion-chip"
          onClick={() => onSelectCandidate(candidate)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            backgroundColor: 'var(--lb-surface, #1A1D28)',
            border: '1px solid var(--lb-border, #2E3347)',
            borderRadius: '6px',
            color: 'var(--lb-text, #E8EAF2)',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 150ms ease-out',
          }}
        >
          <kbd
            style={{
              fontSize: '10px',
              padding: '1px 3px',
              backgroundColor: 'var(--lb-surface-raised, #232736)',
              borderRadius: '3px',
              color: 'var(--lb-accent, #7C8CFF)',
              fontWeight: 600,
            }}
          >
            {candidate.key}
          </kbd>
          <span>{candidate.label}</span>
          {candidate.confidence !== undefined && (
            <span
              style={{
                fontSize: '10px',
                color: 'var(--lb-text-muted, #A3A9BD)',
                opacity: 0.8,
              }}
            >
              {Math.round(candidate.confidence * 100)}%
            </span>
          )}
        </button>
      ))}

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss suggestion"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--lb-text-muted, #A3A9BD)',
          cursor: 'pointer',
          padding: '0 4px',
          fontSize: '12px',
        }}
      >
        ✕
      </button>
    </div>
  );
};
