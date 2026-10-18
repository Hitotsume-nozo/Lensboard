/**
 * Command Palette & Insert Menu Types (Feature 28)
 */

export interface CommandItem {
  id: string;
  title: string;
  category?: 'command' | 'tool' | 'board' | 'view';
  shortcut?: string;
  recent?: boolean;
  starred?: boolean;
  disabled?: boolean;
  execute: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  commands: CommandItem[];
  onClose: () => void;
  className?: string;
}

export interface SmartEntityOption {
  type: string;
  label: string;
  category: string;
  description: string;
  defaultPayload?: Record<string, unknown>;
}

export interface InsertMenuProps {
  isOpen: boolean;
  position?: { x: number; y: number };
  onSelectEntity: (entity: SmartEntityOption) => void;
  onClose: () => void;
  className?: string;
}
