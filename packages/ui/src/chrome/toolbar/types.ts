/**
 * Floating Pill Toolbar Types (Feature 25)
 */

export type ToolKey = 'V' | 'P' | 'L' | 'S' | 'T' | 'E' | 'C' | 'G' | 'X' | 'R' | 'H';

export interface ToolDefinition {
  key: ToolKey;
  name: string;
  description: string;
}

export interface FloatingPillToolbarProps {
  activeTool: ToolKey;
  onSelectTool: (tool: ToolKey) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  reducedMotion?: boolean;
  viewportWidth?: number;
  className?: string;
}

export interface ToolButtonProps {
  tool: ToolDefinition;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}
