/**
 * Contextual Properties Bar Types (Feature 26)
 */

export interface RectBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PropertyItemKey =
  | 'color'
  | 'strokeWidth'
  | 'fill'
  | 'renderMode'
  | 'convert'
  | 'revert'
  | 'align'
  | 'note'
  | 'font'
  | 'language'
  | 'run'
  | 'testTable'
  | 'delete';

export interface ContextualPropertiesBarProps {
  selectedIds: string[];
  selectionBounds: RectBounds | null;
  entityType?: string | string[];
  viewportWidth?: number;
  viewportHeight?: number;
  onDeselectAll?: () => void;
  onPropertyChange?: (property: PropertyItemKey, value: unknown) => void;
  className?: string;
}
