import { useState } from 'react';
import type { CanvasObject } from '@lensboard/core';
import type { LeftDrawerSection } from '@lensboard/ui';
import type { StoredInboxItem } from './storage.js';

export interface LeftDrawerTabsProps {
  activeSection: LeftDrawerSection;
  objectCount: number;
  objects?: Record<string, CanvasObject>;
  selectedId?: string | null;
  onSelectObject?: (id: string) => void;
  onFocusObject?: (id: string) => void;
  onToggleHidden?: (id: string) => void;
  onToggleLocked?: (id: string) => void;
  onDeleteObject?: (id: string) => void;
  onInsertLibraryItem?: (item: string) => void;
  inboxItems: StoredInboxItem[];
  onAddInboxItem?: (text: string) => void;
  onPlaceInboxItem?: (item: StoredInboxItem) => void;
  onClearInbox?: () => void;
}

export function LeftDrawerTabs({
  activeSection,
  objectCount,
  objects,
  selectedId,
  onSelectObject,
  onFocusObject,
  onToggleHidden,
  onToggleLocked,
  onDeleteObject,
  onInsertLibraryItem,
  inboxItems,
  onAddInboxItem,
  onPlaceInboxItem,
  onClearInbox,
}: LeftDrawerTabsProps) {
  const [outlineFilter, setOutlineFilter] = useState('');
  const [newInboxText, setNewInboxText] = useState('');

  const objectList = objects ? Object.values(objects) : [];
  const filteredObjects = outlineFilter.trim()
    ? objectList.filter((obj) => {
        const query = outlineFilter.toLowerCase();
        const label = String(obj.label || '').toLowerCase();
        const type = String(obj.type || '').toLowerCase();
        const tags = (obj.tags || []).join(' ').toLowerCase();
        return label.includes(query) || type.includes(query) || tags.includes(query);
      })
    : objectList;

  if (activeSection === 'Outline') {
    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--lb-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Canvas Outline ({objectCount})
          </span>
          {outlineFilter && (
            <span style={{ fontSize: '10px', color: 'var(--lb-accent)' }}>
              {filteredObjects.length} matched
            </span>
          )}
        </div>

        {/* Outline Search Filter */}
        <input
          type="text"
          placeholder="Filter objects by label, type, tag..."
          value={outlineFilter}
          onChange={(e) => setOutlineFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--lb-border)',
            backgroundColor: 'var(--lb-surface)',
            color: 'var(--lb-text)',
            fontSize: '12px',
            outline: 'none',
          }}
        />

        {/* Objects List */}
        <div
          style={{
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            marginTop: '4px',
          }}
        >
          {filteredObjects.map((obj) => {
            const isSelected = selectedId === obj.id;
            return (
              <div
                key={obj.id}
                onClick={() => onSelectObject?.(obj.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: isSelected
                    ? 'var(--lb-surface-raised, #2C3040)'
                    : 'var(--lb-surface)',
                  border: isSelected
                    ? '1px solid var(--lb-accent)'
                    : '1px solid var(--lb-border)',
                  fontSize: '12px',
                  color: 'var(--lb-text)',
                  cursor: 'pointer',
                  opacity: obj.hidden ? 0.45 : 1,
                  transition: 'background-color 120ms ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '14px' }}>
                    {obj.type === 'ink'
                      ? '✏️'
                      : obj.type === 'line'
                        ? '➔'
                        : obj.type === 'code'
                          ? '💻'
                          : obj.type === 'equation'
                            ? '∑'
                            : obj.type === 'grid' || obj.type === 'table' || obj.type === 'dpTable'
                              ? '▦'
                              : obj.type === 'ruler'
                                ? '📏'
                                : obj.type === 'text'
                                  ? '📝'
                                  : obj.type === 'frame'
                                    ? '🏷️'
                                    : '⬡'}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '120px',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    title={String(obj.label || obj.type)}
                  >
                    {String(obj.label || `${obj.type} (${obj.id.slice(0, 6)})`)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHidden?.(obj.id);
                    }}
                    title={obj.hidden ? 'Show object' : 'Hide object'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 4px',
                      opacity: obj.hidden ? 0.5 : 0.85,
                    }}
                  >
                    {obj.hidden ? '👁️‍🗨️' : '👁️'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusObject?.(obj.id);
                    }}
                    title="Center camera on object"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 4px',
                      opacity: 0.8,
                    }}
                  >
                    🎯
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLocked?.(obj.id);
                    }}
                    title={obj.locked ? 'Unlock object' : 'Lock object'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 4px',
                      opacity: obj.locked ? 1 : 0.4,
                    }}
                  >
                    {obj.locked ? '🔒' : '🔓'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteObject?.(obj.id);
                    }}
                    title="Delete object"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 4px',
                      color: 'var(--lb-danger, #FF6B7A)',
                      opacity: 0.8,
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}

          {filteredObjects.length === 0 && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--lb-text-muted)',
                textAlign: 'center',
                padding: '24px 0',
              }}
            >
              {objectList.length === 0 ? 'No objects on canvas yet' : 'No matching objects found'}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeSection === 'Library') {
    const dsaCatalog = [
      { id: 'Binary Tree', title: 'Binary Search Tree', icon: '🌳', desc: 'Root node + left/right child nodes and arrows' },
      { id: 'Red-Black Tree', title: 'Red-Black Tree', icon: '🔴', desc: 'Balanced BST with red/black color rules' },
      { id: 'Linked List', title: 'Linked List', icon: '🔗', desc: 'Chained node sequence with next pointers' },
      { id: 'Doubly Linked List', title: 'Doubly Linked List', icon: '↔️', desc: 'Nodes with forward & backward pointers' },
      { id: 'Hash Table', title: 'Hash Bucket Table', icon: '▦', desc: 'Key-value index table with 4 buckets' },
      { id: 'Graph Node', title: 'Graph Component', icon: '🕸️', desc: 'Vertices u, v connected by weighted directed edge' },
      { id: 'Binary Heap', title: 'Binary Min-Heap', icon: '⛰️', desc: 'Priority queue complete binary tree' },
      { id: '2D DP Table', title: '2D DP State Table', icon: '📊', desc: 'Dynamic programming recurrence grid' },
      { id: 'Flowchart Decision', title: 'Flowchart Decision', icon: '💎', desc: 'Conditional diamond branch with Yes/No' },
      { id: 'Problem Frame', title: 'DSA Problem Frame', icon: '📋', desc: 'Structured analysis frame (spec §11)' },
    ];

    const mlCatalog = [
      { id: 'Transformer Block', title: 'Transformer Block', icon: '⚡', desc: 'MHA + Add & Norm + Feed-Forward block' },
      { id: 'Multi-Head Attention', title: 'Multi-Head Attention', icon: '🎯', desc: 'Query, Key, Value attention module' },
      { id: 'Residual Stream Block', title: 'Residual Skip Connection', icon: '↪️', desc: 'Identity shortcut connection with (+) Add node' },
      { id: 'Linear Layer', title: 'Linear Layer (FC)', icon: '📐', desc: 'in=784 -> out=128 (100k parameters)' },
      { id: 'Conv2D Layer', title: 'Conv2D Feature Map', icon: '🖼️', desc: 'cin=3, cout=64, 3x3 kernel block' },
      { id: 'LayerNorm Layer', title: 'LayerNorm Block', icon: '⚖️', desc: 'd=512 normalization layer' },
      { id: 'Activation Heatmap', title: 'Activation Heatmap', icon: '🔥', desc: 'Token attention matrix heatmap' },
      { id: 'Derivation Card', title: 'Derivation Step Card', icon: '📝', desc: 'Numbered LaTeX proof with status' },
    ];

    const devCatalog = [
      { id: 'Custom Code Block (Empty)', title: 'Empty Code Block', icon: '💻', desc: 'Empty custom code runner with line editor & output' },
      { id: 'Custom Code Block', title: 'Sample Code Script', icon: '📜', desc: 'Pre-populated algorithm runner with execution output' },
      { id: 'Import Image', title: 'Import Image File', icon: '🖼️', desc: 'Import local image or paste image onto canvas' },
    ];

    return (
      <div
        style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--lb-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Algorithmic & Data Structures (DSA)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {dsaCatalog.map((item) => (
              <div
                key={item.id}
                onClick={() => onInsertLibraryItem?.(item.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--lb-surface)',
                  border: '1px solid var(--lb-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background-color 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lb-surface-raised)';
                  e.currentTarget.style.borderColor = 'var(--lb-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lb-surface)';
                  e.currentTarget.style.borderColor = 'var(--lb-border)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lb-text)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--lb-accent)', fontWeight: 700 }}>
                  +
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--lb-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Deep Learning & Mech-Interp (Spec §11)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mlCatalog.map((item) => (
              <div
                key={item.id}
                onClick={() => onInsertLibraryItem?.(item.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--lb-surface)',
                  border: '1px solid var(--lb-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background-color 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lb-surface-raised)';
                  e.currentTarget.style.borderColor = 'var(--lb-accent-2, #3DD6C6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lb-surface)';
                  e.currentTarget.style.borderColor = 'var(--lb-border)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lb-text)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--lb-accent-2, #3DD6C6)', fontWeight: 700 }}>
                  +
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--lb-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            Code & Custom Media
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {devCatalog.map((item) => (
              <div
                key={item.id}
                onClick={() => onInsertLibraryItem?.(item.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--lb-surface)',
                  border: '1px solid var(--lb-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background-color 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lb-surface-raised)';
                  e.currentTarget.style.borderColor = 'var(--lb-accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--lb-surface)';
                  e.currentTarget.style.borderColor = 'var(--lb-border)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lb-text)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--lb-accent)', fontWeight: 700 }}>
                  +
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // activeSection === 'Inbox'
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--lb-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Fast Capture Spool ({inboxItems.length})
        </span>
        {inboxItems.length > 0 && (
          <button
            type="button"
            onClick={onClearInbox}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--lb-danger, #FF6B7A)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          placeholder="Type quick thought, theorem, or idea..."
          value={newInboxText}
          onChange={(e) => setNewInboxText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newInboxText.trim()) {
              onAddInboxItem?.(newInboxText.trim());
              setNewInboxText('');
            }
          }}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid var(--lb-border)',
            backgroundColor: 'var(--lb-surface)',
            color: 'var(--lb-text)',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (newInboxText.trim()) {
              onAddInboxItem?.(newInboxText.trim());
              setNewInboxText('');
            }
          }}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'var(--lb-accent)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Add
        </button>
      </div>

      <div
        style={{
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '6px',
        }}
      >
        {inboxItems.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: 'var(--lb-surface)',
              border: '1px solid var(--lb-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--lb-text)', lineHeight: 1.4 }}>
              {item.text}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: 'var(--lb-text-muted)',
              }}
            >
              <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <button
                type="button"
                onClick={() => onPlaceInboxItem?.(item)}
                style={{
                  background: 'var(--lb-surface-raised)',
                  border: '1px solid var(--lb-border)',
                  color: 'var(--lb-accent)',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + Place on Canvas
              </button>
            </div>
          </div>
        ))}

        {inboxItems.length === 0 && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--lb-text-muted)',
              textAlign: 'center',
              padding: '30px 0',
            }}
          >
            No captured notes in inbox spool.
            <div style={{ marginTop: '4px', fontSize: '10px' }}>
              Type above to capture fast ideas without interrupting your canvas flow.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
