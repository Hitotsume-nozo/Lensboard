import React, { useEffect, useCallback } from 'react';
import type { BoardTabItem, TabStripProps } from './types.js';

export function truncateTabTitle(title: string, maxLen = 24): string {
  if (title.length > maxLen) {
    return title.substring(0, maxLen - 1) + '…';
  }
  return title;
}

export function switchTabByIndex<T extends BoardTabItem | string>(
  tabs: T[],
  index: number
): T | null {
  if (index < 1 || index > tabs.length) {
    return null;
  }
  return tabs[index - 1] ?? null;
}

export function handleTabCloseWithFallback(
  tabs: BoardTabItem[],
  closingTabId: string,
  fallbackTitle = 'Inbox'
): BoardTabItem[] {
  const filtered = tabs.filter((t) => t.id !== closingTabId);
  if (filtered.length === 0) {
    return [{ id: 'inbox-default', title: fallbackTitle }];
  }
  return filtered;
}

export const TabStrip: React.FC<TabStripProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  className = '',
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Alt+1 to Alt+9
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          const targetTab = switchTabByIndex(tabs, digit);
          if (targetTab) {
            e.preventDefault();
            onSelectTab(targetTab.id);
          }
        }
      }

      // Ctrl+W: Close active tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        onCloseTab(activeTabId);
      }

      // Ctrl+T: New tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        onNewTab();
      }
    },
    [tabs, activeTabId, onSelectTab, onCloseTab, onNewTab]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={`lb-tab-strip ${className}`}
      role="tablist"
      aria-label="Board tabs"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '36px',
        backgroundColor: 'var(--lb-surface, #1A1D28)',
        borderRadius: 'var(--lb-radius-control, 8px)',
        border: '1px solid var(--lb-border, #2E3347)',
        padding: '0 4px',
        gap: '2px',
        userSelect: 'none',
        overflowX: 'auto',
      }}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTabId;
        const displayTitle = truncateTabTitle(tab.title);

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onSelectTab(tab.id);
              }
            }}
            className={`lb-board-tab ${isActive ? 'lb-board-tab--active' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '28px',
              padding: '0 10px',
              borderRadius: '6px',
              backgroundColor: isActive
                ? 'var(--lb-surface-raised, #232736)'
                : 'transparent',
              color: isActive
                ? 'var(--lb-text, #E8EAF2)'
                : 'var(--lb-text-muted, #A3A9BD)',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
              borderBottom: isActive
                ? '2px solid var(--lb-accent, #7C8CFF)'
                : '2px solid transparent',
              transition: 'all 150ms ease-out',
              whiteSpace: 'nowrap',
              gap: '6px',
            }}
            title={tab.title}
          >
            {tab.isDirty && (
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--lb-warning, #FFC857)',
                  display: 'inline-block',
                }}
                title="Unsaved changes"
              />
            )}
            <span>{displayTitle}</span>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--lb-text-muted, #A3A9BD)',
                opacity: 0.6,
                marginLeft: '2px',
              }}
            >
              {idx < 9 ? `Alt+${idx + 1}` : ''}
            </span>
            {!tab.isPinned && (
              <button
                type="button"
                className="lb-board-tab__close"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                aria-label={`Close ${tab.title}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0 2px',
                  lineHeight: 1,
                  fontSize: '14px',
                  opacity: 0.6,
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="lb-tab-strip__new"
        onClick={onNewTab}
        aria-label="New board tab (Ctrl+T)"
        title="New board tab (Ctrl+T)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: 'none',
          background: 'transparent',
          color: 'var(--lb-text-muted, #A3A9BD)',
          cursor: 'pointer',
          fontSize: '16px',
          transition: 'all 150ms ease-out',
        }}
      >
        +
      </button>
    </div>
  );
};
