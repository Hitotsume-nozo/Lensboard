/**
 * Breadcrumbs and Tab Strip Types (Feature 24)
 */

export type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export interface BoardTabItem {
  id: string;
  title: string;
  isDirty?: boolean;
  isPinned?: boolean;
}

export interface BreadcrumbProps {
  project?: string;
  board?: string;
  saveState?: SaveState;
  onRenameBoard?: (newTitle: string) => void;
  onSelectProject?: () => void;
  className?: string;
}

export interface SaveIndicatorDotProps {
  state: SaveState;
  size?: number;
  className?: string;
}

export interface TabStripProps {
  tabs: BoardTabItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onReorderTabs?: (startIndex: number, endIndex: number) => void;
  className?: string;
}
