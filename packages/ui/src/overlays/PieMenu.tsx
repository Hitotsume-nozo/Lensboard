import React, { useState, useEffect, useCallback } from 'react';
import type { PieMenuProps } from './types.js';
import {
  PIE_SLOTS,
  PIE_MENU_CONFIG,
  resolvePieSlot,
  clampPiePosition,
} from './pie-math.js';

export const PieMenu: React.FC<PieMenuProps> = ({
  isOpen,
  center,
  onSelectSlot,
  onClose,
  radius = PIE_MENU_CONFIG.radius,
  deadZone = PIE_MENU_CONFIG.deadZone,
  className = '',
}) => {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const clampedCenter = clampPiePosition(
    center.x,
    center.y,
    radius,
    typeof window !== 'undefined' ? window.innerWidth : 1920,
    typeof window !== 'undefined' ? window.innerHeight : 1080
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dx = e.clientX - clampedCenter.x;
      const dy = e.clientY - clampedCenter.y;
      const slot = resolvePieSlot(dx, dy, radius, deadZone);
      setActiveSlot(slot);
    },
    [clampedCenter.x, clampedCenter.y, radius, deadZone]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const dx = e.clientX - clampedCenter.x;
      const dy = e.clientY - clampedCenter.y;
      const slot = resolvePieSlot(dx, dy, radius, deadZone);
      if (slot !== null && slot >= 0 && slot < PIE_SLOTS.length) {
        onSelectSlot(PIE_SLOTS[slot], slot);
      }
      onClose();
    },
    [clampedCenter.x, clampedCenter.y, radius, deadZone, onSelectSlot, onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const diameter = radius * 2;

  return (
    <div
      className={`lb-pie-menu-overlay ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="menu"
      aria-label="Radial action menu"
      data-testid="pie-menu"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      <div
        className="lb-pie-menu"
        style={{
          position: 'absolute',
          left: `${clampedCenter.x - radius}px`,
          top: `${clampedCenter.y - radius}px`,
          width: `${diameter}px`,
          height: `${diameter}px`,
          borderRadius: '50%',
          backgroundColor: 'var(--lb-surface-raised, #232736)',
          border: '2px solid var(--lb-border, #2E3347)',
          boxShadow: 'var(--lb-shadow-floating, 0 12px 32px rgba(0, 0, 0, 0.35))',
          overflow: 'hidden',
        }}
      >
        {/* Render 8 radial sectors / labels */}
        {PIE_SLOTS.map((slotName, idx) => {
          const sliceAngle = (2 * Math.PI) / PIE_SLOTS.length;
          const midAngle = idx * sliceAngle + sliceAngle / 2;
          const labelDist = radius * 0.65;
          const labelX = radius + Math.cos(midAngle) * labelDist;
          const labelY = radius + Math.sin(midAngle) * labelDist;
          const isSelected = activeSlot === idx;

          return (
            <div
              key={slotName}
              className={`lb-pie-slot ${isSelected ? 'lb-pie-slot--active' : ''}`}
              style={{
                position: 'absolute',
                left: `${labelX}px`,
                top: `${labelY}px`,
                transform: 'translate(-50%, -50%)',
                fontSize: '11px',
                fontWeight: isSelected ? 700 : 500,
                color: isSelected
                  ? 'var(--lb-accent, #7C8CFF)'
                  : 'var(--lb-text, #E8EAF2)',
                backgroundColor: isSelected
                  ? 'var(--lb-surface, #1A1D28)'
                  : 'transparent',
                padding: '3px 6px',
                borderRadius: '4px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                transition: 'all 80ms ease-out',
              }}
            >
              {slotName}
            </div>
          );
        })}

        {/* Inner Dead Zone */}
        <div
          className="lb-pie-deadzone"
          style={{
            position: 'absolute',
            left: `${radius - deadZone}px`,
            top: `${radius - deadZone}px`,
            width: `${deadZone * 2}px`,
            height: `${deadZone * 2}px`,
            borderRadius: '50%',
            backgroundColor: 'var(--lb-surface, #1A1D28)',
            border: '1px solid var(--lb-border, #2E3347)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: 'var(--lb-text-muted, #A3A9BD)',
          }}
        >
          •
        </div>
      </div>
    </div>
  );
};
