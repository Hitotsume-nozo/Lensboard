import React, { useState, useRef, useEffect } from 'react';
import type { BreadcrumbProps } from './types.js';
import { SaveIndicatorDot } from './SaveIndicatorDot.js';

export function formatTitle(title?: string): string {
  if (!title || title.trim().length === 0) {
    return 'Untitled';
  }
  return title.trim();
}

export function formatBreadcrumb(project?: string, board?: string): string {
  return `${formatTitle(project)} / ${formatTitle(board)}`;
}

export const Breadcrumbs: React.FC<BreadcrumbProps> = ({
  project,
  board,
  saveState = 'saved',
  onRenameBoard,
  onSelectProject,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(board || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const projectTitle = formatTitle(project);
  const boardTitle = formatTitle(board);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && onRenameBoard) {
      onRenameBoard(trimmed);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(board || '');
  };

  return (
    <div
      className={`lb-breadcrumbs ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        backgroundColor: 'var(--lb-surface, #1A1D28)',
        borderRadius: 'var(--lb-radius-control, 8px)',
        border: '1px solid var(--lb-border, #2E3347)',
        color: 'var(--lb-text, #E8EAF2)',
        fontSize: '13px',
        fontFamily: 'var(--lb-font-ui, Inter, sans-serif)',
        userSelect: 'none',
      }}
    >
      <SaveIndicatorDot state={saveState} />

      <button
        type="button"
        className="lb-breadcrumbs__project"
        onClick={onSelectProject}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--lb-text-muted, #A3A9BD)',
          cursor: onSelectProject ? 'pointer' : 'default',
          padding: 0,
          font: 'inherit',
          outline: 'none',
        }}
        title="Project"
      >
        {projectTitle}
      </button>

      <span style={{ color: 'var(--lb-text-muted, #A3A9BD)' }}>/</span>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') cancelEdit();
          }}
          onBlur={commitEdit}
          style={{
            background: 'var(--lb-surface-raised, #232736)',
            border: '1px solid var(--lb-accent, #7C8CFF)',
            borderRadius: '4px',
            color: 'var(--lb-text, #E8EAF2)',
            font: 'inherit',
            padding: '2px 6px',
            outline: 'none',
            minWidth: '80px',
          }}
        />
      ) : (
        <span
          className="lb-breadcrumbs__board"
          onDoubleClick={() => {
            setEditValue(board || '');
            setIsEditing(true);
          }}
          onClick={() => {
            if (onRenameBoard && !isEditing) {
              setEditValue(board || '');
              setIsEditing(true);
            }
          }}
          style={{
            fontWeight: 500,
            cursor: onRenameBoard ? 'pointer' : 'default',
            color: 'var(--lb-text, #E8EAF2)',
          }}
          title={onRenameBoard ? 'Click or double-click to rename board' : undefined}
        >
          {boardTitle}
        </span>
      )}
    </div>
  );
};
