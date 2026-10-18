import type { PieSlotName } from './types.js';

export const PIE_SLOTS: readonly PieSlotName[] = [
  'Colour',
  'Tool',
  'Undo',
  'Redo',
  'Convert',
  'Tidy',
  'Duplicate',
  'Delete',
] as const;

export const PIE_MENU_CONFIG = {
  radius: 120,
  deadZone: 24,
};

export function resolvePieSlot(
  dx: number,
  dy: number,
  _radius = PIE_MENU_CONFIG.radius,
  deadZone = PIE_MENU_CONFIG.deadZone
): number | null {
  const dist = Math.hypot(dx, dy);
  if (dist < deadZone) return null;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += 2 * Math.PI;
  const slotIndex = Math.floor((angle / (2 * Math.PI)) * 8) % 8;
  return slotIndex;
}

export function clampPieCenter(
  clickX: number,
  radius = 120,
  screenW = 1920
): number {
  return Math.max(radius, Math.min(screenW - radius, clickX));
}

export function clampPiePosition(
  clickX: number,
  clickY: number,
  radius = 120,
  screenW = 1920,
  screenH = 1080
): { x: number; y: number } {
  return {
    x: Math.max(radius, Math.min(screenW - radius, clickX)),
    y: Math.max(radius, Math.min(screenH - radius, clickY)),
  };
}
