/**
 * Overlays: Pie Menu & Toasts Types (Feature 28 & §13)
 */

export type PieSlotName =
  | 'Colour'
  | 'Tool'
  | 'Undo'
  | 'Redo'
  | 'Convert'
  | 'Tidy'
  | 'Duplicate'
  | 'Delete';

export interface PieMenuProps {
  isOpen: boolean;
  center: { x: number; y: number };
  onSelectSlot: (slot: PieSlotName, slotIndex: number) => void;
  onClose: () => void;
  radius?: number;
  deadZone?: number;
  className?: string;
}

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  durationMs?: number; // default 4000
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  className?: string;
}
