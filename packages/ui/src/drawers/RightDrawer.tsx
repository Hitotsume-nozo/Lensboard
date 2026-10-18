import React, { useRef, useEffect } from 'react';
import type { RightDrawerProps, RightDrawerSection } from './types.js';
import { RIGHT_DRAWER_SECTIONS, DRAWER_WIDTH } from './useDrawerState.js';
import { DrawerContainer } from './DrawerContainer.js';

export const RightDrawer: React.FC<RightDrawerProps> = ({
  isOpen,
  width = DRAWER_WIDTH,
  activeSection = 'Inspector',
  onSelectSection,
  onClose,
  onResizeWidth,
  reducedMotion = false,
  scrollPositions = {},
  onScrollChange,
  children,
  className = '',
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevSectionRef = useRef<RightDrawerSection>(activeSection);

  // Restore scroll position when active section changes
  useEffect(() => {
    if (contentRef.current) {
      const prevSection = prevSectionRef.current;
      if (prevSection !== activeSection && onScrollChange) {
        onScrollChange(prevSection, contentRef.current.scrollTop);
      }
      const savedOffset = scrollPositions[activeSection] || 0;
      contentRef.current.scrollTop = savedOffset;
      prevSectionRef.current = activeSection;
    }
  }, [activeSection, scrollPositions, onScrollChange]);

  const handleScroll = () => {
    if (contentRef.current && onScrollChange) {
      onScrollChange(activeSection, contentRef.current.scrollTop);
    }
  };

  return (
    <DrawerContainer
      side="right"
      isOpen={isOpen}
      width={width}
      onClose={onClose}
      onResizeWidth={onResizeWidth}
      reducedMotion={reducedMotion}
      className={className}
    >
      {/* Section Tab Bar */}
      <div
        role="tablist"
        aria-label="Right drawer sections"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--lb-border, #2E3347)',
          backgroundColor: 'var(--lb-surface-raised, #232736)',
        }}
      >
        {RIGHT_DRAWER_SECTIONS.map((sec) => {
          const isActive = sec === activeSection;
          return (
            <button
              key={sec}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectSection && onSelectSection(sec)}
              style={{
                flex: 1,
                padding: '8px 2px',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid var(--lb-accent, #7C8CFF)'
                  : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive
                  ? 'var(--lb-text, #E8EAF2)'
                  : 'var(--lb-text-muted, #A3A9BD)',
                fontSize: '11px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
                transition: 'all 150ms ease-out',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={sec}
            >
              {sec}
            </button>
          );
        })}
      </div>

      {/* Content Body with scroll retention */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          color: 'var(--lb-text, #E8EAF2)',
          fontSize: '13px',
        }}
      >
        {children || (
          <div>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>{activeSection}</div>
            <div style={{ color: 'var(--lb-text-muted, #A3A9BD)', fontSize: '12px' }}>
              {activeSection === 'Inspector' && 'Deep property inspection (ULID, z-index, geometry, tags).'}
              {activeSection === 'Lenses' && 'Active lenses and filtering rules.'}
              {activeSection === 'Backlinks' && 'Bi-directional references to other boards.'}
              {activeSection === 'History' && 'Op-log timeline and snapshot rollbacks.'}
            </div>
          </div>
        )}
      </div>
    </DrawerContainer>
  );
};
