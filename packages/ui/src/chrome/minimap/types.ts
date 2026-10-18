/**
 * Suggestion Chips, Ghost Preview, Minimap & Zoom Controls Types (Feature 29)
 */

export interface SuggestionCandidate {
  key: string; // '1' | '2' | '3'
  kind: string; // 'rect', 'diamond', 'table', etc.
  label: string;
  confidence?: number;
  bounds?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface SuggestionChipsProps {
  candidates: SuggestionCandidate[];
  onSelectCandidate: (candidate: SuggestionCandidate) => void;
  onDismiss: () => void;
  autoFadeMs?: number;
  className?: string;
}

export interface GhostPreviewProps {
  visible: boolean;
  candidate?: SuggestionCandidate;
  opacity?: number;
  className?: string;
}

export interface MinimapBounds {
  w: number; // default 160
  h: number; // default 100
  worldW: number;
  worldH: number;
  worldMinX?: number;
  worldMinY?: number;
}

export interface MinimapProps {
  objectCount: number;
  minimapBounds?: MinimapBounds;
  cameraX?: number;
  cameraY?: number;
  zoom?: number;
  onJumpCamera: (worldX: number, worldY: number) => void;
  className?: string;
}

export interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onFitAll?: () => void;
  onResetZoom?: () => void;
  onZoomToSelection?: () => void;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}
