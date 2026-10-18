/**
 * Dual Collapsible Drawers Types (Feature 27)
 */

export type LeftDrawerSection = 'Outline' | 'Library' | 'Inbox';
export type RightDrawerSection = 'Inspector' | 'Lenses' | 'Backlinks' | 'History';

export interface DrawerState {
  leftOpen: boolean;
  rightOpen: boolean;
  leftSection: LeftDrawerSection;
  rightSection: RightDrawerSection;
  leftWidth: number; // default 320, clamped [240, 480]
  rightWidth: number; // default 320, clamped [240, 480]
  pinned: boolean; // default false
  scrollPositions: Record<string, number>;
}

export interface DrawerContainerProps {
  side: 'left' | 'right';
  isOpen: boolean;
  width: number;
  onClose: () => void;
  onResizeWidth?: (newWidth: number) => void;
  reducedMotion?: boolean;
  children: React.ReactNode;
  className?: string;
}

export interface LeftDrawerProps {
  isOpen: boolean;
  width?: number;
  activeSection?: LeftDrawerSection;
  onSelectSection?: (section: LeftDrawerSection) => void;
  onClose: () => void;
  onResizeWidth?: (newWidth: number) => void;
  reducedMotion?: boolean;
  scrollPositions?: Record<string, number>;
  onScrollChange?: (section: string, offset: number) => void;
  children?: React.ReactNode;
  className?: string;
}

export interface RightDrawerProps {
  isOpen: boolean;
  width?: number;
  activeSection?: RightDrawerSection;
  onSelectSection?: (section: RightDrawerSection) => void;
  onClose: () => void;
  onResizeWidth?: (newWidth: number) => void;
  reducedMotion?: boolean;
  scrollPositions?: Record<string, number>;
  onScrollChange?: (section: string, offset: number) => void;
  children?: React.ReactNode;
  className?: string;
}
