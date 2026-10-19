import { useState } from 'react';
import type { CanvasObject, PenColorSlot } from '@lensboard/core';
import type { ToolKey, RightDrawerSection } from '@lensboard/ui';
import { OKABE_ITO_PALETTE, DSA_STATE_DEFINITIONS } from '@lensboard/ui';
import type { StoredSnapshot } from './storage.js';

export interface RightDrawerTabsProps {
  activeSection: RightDrawerSection;
  activeTool: ToolKey;
  selectedObject?: CanvasObject | null;
  onUpdateSelectedObject?: (patch: Partial<CanvasObject>) => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  onAlignSelected?: () => void;
  activeLens: string;
  onSelectLens?: (lensKey: string) => void;
  lensTagFilter: string;
  onSetLensTagFilter?: (tag: string) => void;
  onResetLens?: () => void;
  openTabs: Array<{ id: string; title: string }>;
  activeTabId: string;
  onSelectTab?: (id: string) => void;
  onInsertBacklink?: (boardTitle: string) => void;
  snapshots: StoredSnapshot[];
  onStarSnapshot?: (label?: string) => void;
  onRestoreSnapshot?: (snapshot: StoredSnapshot) => void;
  onRunQuickCheck?: () => void;
  undoStepsCount: number;
  redoStepsCount: number;
  zoom: number;
  camera: { x: number; y: number };
  objectCount: number;
}

export function RightDrawerTabs({
  activeSection,
  activeTool,
  selectedObject,
  onUpdateSelectedObject,
  onDuplicateSelected,
  onDeleteSelected,
  onAlignSelected,
  activeLens,
  onSelectLens,
  lensTagFilter,
  onSetLensTagFilter,
  onResetLens,
  openTabs,
  activeTabId,
  onSelectTab,
  onInsertBacklink,
  snapshots,
  onStarSnapshot,
  onRestoreSnapshot,
  onRunQuickCheck,
  undoStepsCount,
  redoStepsCount,
  zoom,
  camera,
  objectCount,
}: RightDrawerTabsProps) {
  const [snapshotLabel, setSnapshotLabel] = useState('');

  const toolDescriptions: Record<ToolKey, string> = {
    V: 'Select & Transform canvas entities. Click to select, drag to move, drag handles to resize, and delete.',
    P: 'Freehand Ink pen with One-Euro stabilization and velocity dynamics.',
    L: 'Draw lines and directional arrows with real-time vector preview.',
    S: 'Stamp or drag geometric shapes (rectangles, nodes, containers).',
    T: 'Place typeset text labels with font styling.',
    E: 'Insert KaTeX mathematical formulas and algorithmic asymptotic bounds.',
    C: 'Place algorithm code blocks with syntax cards and window controls.',
    G: 'Create 2D Dynamic Programming state tables and matrix grids.',
    X: 'Whole-stroke eraser removes intersected strokes and clicked objects.',
    R: 'Interactive calibrated ruler guide with real-time pixel measurement.',
    H: 'Pan viewport smoothly across canvas (or hold middle mouse / Space).',
  };

  if (activeSection === 'Inspector') {
    if (selectedObject) {
      const strokeWidth = selectedObject.style?.strokeWidth || 2;
      const curColor = String(selectedObject.style?.colorId || '#7C8CFF');
      const curFill = String(selectedObject.style?.fill || 'transparent');
      const renderMode = selectedObject.style?.renderMode || 'crisp';
      const dsaState = (selectedObject.data?.dsaState as string) || '';

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
          {/* Header */}
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
              Entity Inspector
            </span>
            <span
              style={{
                fontSize: '10px',
                backgroundColor: 'var(--lb-surface-raised)',
                border: '1px solid var(--lb-border)',
                color: 'var(--lb-accent)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {selectedObject.type.toUpperCase()}
            </span>
          </div>

          {/* Label / Title */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
              Label / Title
            </label>
            <input
              type="text"
              value={selectedObject.label != null ? String(selectedObject.label) : ''}
              onChange={(e) => onUpdateSelectedObject?.({ label: e.target.value })}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface)',
                color: 'var(--lb-text)',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          {/* Geometry Position & Dimensions */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
              Geometry Bounds
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>X (px)</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.x)}
                  onChange={(e) => onUpdateSelectedObject?.({ x: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--lb-border)',
                    backgroundColor: 'var(--lb-surface)',
                    color: 'var(--lb-text)',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>Y (px)</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.y)}
                  onChange={(e) => onUpdateSelectedObject?.({ y: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--lb-border)',
                    backgroundColor: 'var(--lb-surface)',
                    color: 'var(--lb-text)',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>Width</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.w || 100)}
                  onChange={(e) => onUpdateSelectedObject?.({ w: Math.max(10, Number(e.target.value)) })}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--lb-border)',
                    backgroundColor: 'var(--lb-surface)',
                    color: 'var(--lb-text)',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>Height</span>
                <input
                  type="number"
                  value={Math.round(selectedObject.h || 50)}
                  onChange={(e) => onUpdateSelectedObject?.({ h: Math.max(10, Number(e.target.value)) })}
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--lb-border)',
                    backgroundColor: 'var(--lb-surface)',
                    color: 'var(--lb-text)',
                    fontSize: '11px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stroke Width Selector */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
              Stroke Width
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 4, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() =>
                    onUpdateSelectedObject?.({
                      style: {
                        ...selectedObject.style,
                        strokeWidth: w,
                        renderMode: selectedObject.style?.renderMode || 'crisp',
                        colorId: selectedObject.style?.colorId || ('#7C8CFF' as any),
                      },
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '4px',
                    borderRadius: '6px',
                    border: strokeWidth === w ? '2px solid var(--lb-accent)' : '1px solid var(--lb-border)',
                    backgroundColor: strokeWidth === w ? 'var(--lb-surface-raised)' : 'var(--lb-surface)',
                    color: 'var(--lb-text)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          {/* Color Chips (Okabe-Ito + Ink) */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
              Pen Palette Color
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(OKABE_ITO_PALETTE).map(([slot, hex]) => {
                const isSelected = curColor === slot || curColor.toLowerCase() === String(hex).toLowerCase();
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      onUpdateSelectedObject?.({
                        style: {
                          ...selectedObject.style,
                          colorId: slot as PenColorSlot,
                          renderMode: selectedObject.style?.renderMode || 'crisp',
                          strokeWidth: selectedObject.style?.strokeWidth || 2,
                        },
                      })
                    }
                    title={`${slot} (${hex})`}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: hex,
                      border: isSelected ? '2px solid #FFFFFF' : '1px solid var(--lb-border)',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                      transition: 'transform 120ms ease',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Fill Style */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
              Fill Style
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: 'None', val: 'transparent' },
                { label: 'Tinted', val: 'rgba(124, 140, 255, 0.2)' },
                { label: 'Surface', val: 'var(--lb-surface)' },
              ].map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() =>
                    onUpdateSelectedObject?.({
                      style: {
                        ...selectedObject.style,
                        fill: f.val,
                        strokeWidth: selectedObject.style?.strokeWidth || 2,
                        renderMode: selectedObject.style?.renderMode || 'crisp',
                        colorId: selectedObject.style?.colorId || ('#7C8CFF' as any),
                      },
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '4px',
                    borderRadius: '6px',
                    border: curFill === f.val ? '2px solid var(--lb-accent)' : '1px solid var(--lb-border)',
                    backgroundColor: curFill === f.val ? 'var(--lb-surface-raised)' : 'var(--lb-surface)',
                    color: 'var(--lb-text)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Render Mode: Crisp vs Sketch */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
              Render Mode (Spec §9)
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['crisp', 'sketch'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    onUpdateSelectedObject?.({
                      style: {
                        ...selectedObject.style,
                        renderMode: mode,
                        strokeWidth: selectedObject.style?.strokeWidth || 2,
                        colorId: selectedObject.style?.colorId || ('#7C8CFF' as any),
                      },
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    border: renderMode === mode ? '2px solid var(--lb-accent)' : '1px solid var(--lb-border)',
                    backgroundColor: renderMode === mode ? 'var(--lb-surface-raised)' : 'var(--lb-surface)',
                    color: 'var(--lb-text)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {mode === 'crisp' ? 'Crisp 2D' : 'Sketch (rough.js)'}
                </button>
              ))}
            </div>
          </div>

          {/* DSA State Coding */}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
              DSA State Coding (Spec §13)
            </label>
            <select
              value={dsaState}
              onChange={(e) => {
                const nextState = e.target.value;
                onUpdateSelectedObject?.({
                  data: { ...selectedObject.data, dsaState: nextState || undefined },
                });
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                outline: 'none',
              }}
            >
              <option value="">None (Standard)</option>
              {Object.entries(DSA_STATE_DEFINITIONS).map(([key, def]) => (
                <option key={key} value={key}>
                  {def.state.toUpperCase()} ({def.colorName} + {def.shapeCue})
                </option>
              ))}
            </select>
          </div>

          {/* Content Editor for Text / Note / Code / Equation */}
          {(selectedObject.type === 'text' ||
            selectedObject.type === 'note' ||
            selectedObject.type === 'code' ||
            selectedObject.type === 'equation') && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
                Content ({selectedObject.type})
              </label>
              <textarea
                rows={4}
                value={
                  selectedObject.type === 'code'
                    ? (selectedObject.data?.code as string) || ''
                    : selectedObject.type === 'equation'
                      ? (selectedObject.data?.equation as string) || ''
                      : (selectedObject.data?.text as string) || (selectedObject.label != null ? String(selectedObject.label) : '')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (selectedObject.type === 'code') {
                    onUpdateSelectedObject?.({ data: { ...selectedObject.data, code: val } });
                  } else if (selectedObject.type === 'equation') {
                    onUpdateSelectedObject?.({ data: { ...selectedObject.data, equation: val }, label: val });
                  } else {
                    onUpdateSelectedObject?.({ data: { ...selectedObject.data, text: val }, label: val });
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--lb-border)',
                  backgroundColor: 'var(--lb-surface)',
                  color: 'var(--lb-text)',
                  fontSize: '11px',
                  fontFamily: selectedObject.type === 'code' ? 'monospace' : 'inherit',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onDuplicateSelected}
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface-raised)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📋 Duplicate
            </button>
            <button
              type="button"
              onClick={onAlignSelected}
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface-raised)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📐 Align to Grid
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              style={{
                gridColumn: '1 / -1',
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid var(--lb-danger, #FF6B7A)',
                backgroundColor: 'rgba(255, 107, 122, 0.1)',
                color: 'var(--lb-danger, #FF6B7A)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🗑️ Delete Object
            </button>
          </div>
        </div>
      );
    }

    // No object selected -> Tool Inspector & Canvas Stats
    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--lb-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Active Tool Inspector
        </div>
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'var(--lb-surface)',
            border: '1px solid var(--lb-border)',
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--lb-accent)' }}>
            Tool: {activeTool}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--lb-text-muted)', marginTop: '6px', lineHeight: 1.45 }}>
            {toolDescriptions[activeTool] || 'Click or drag on the canvas to use this tool.'}
          </div>
        </div>

        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--lb-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Whiteboard Statistics
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { label: 'Total Entities', val: `${objectCount} objects` },
            { label: 'Active Zoom', val: `${Math.round(zoom * 100)}%` },
            { label: 'Camera Viewport', val: `(${Math.round(camera.x)}, ${Math.round(camera.y)})` },
            { label: 'Undo / Redo Buffer', val: `${undoStepsCount} / ${redoStepsCount}` },
            { label: 'Hit Tolerance', val: '6.0 screen px' },
            { label: 'Handle Hit Size', val: '24 screen px' },
          ].map((prop, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: 'var(--lb-surface)',
                border: '1px solid var(--lb-border)',
                fontSize: '11px',
              }}
            >
              <span style={{ color: 'var(--lb-text-muted)' }}>{prop.label}</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--lb-text)' }}>{prop.val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSection === 'Lenses') {
    const lensPresets = [
      { id: 'all', title: 'All Objects', desc: 'Full transparent view without filtering' },
      { id: 'dsa', title: 'DSA Algorithms Lens', desc: 'Focus on trees, grids, tables, and graphs' },
      { id: 'dl', title: 'Deep Learning Lens', desc: 'Focus on NN blocks, code blocks, and math' },
      { id: 'ink', title: 'Handwritten Ink Lens', desc: 'Focus on raw and converted stroke ink' },
      { id: 'frames', title: 'Problem Frames & Notes', desc: 'Focus on frames, derivations, and notes' },
    ];

    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            Viewport Lenses (Spec §12)
          </div>
          <div style={{ fontSize: '11px', color: 'var(--lb-text-muted)', lineHeight: 1.4, marginBottom: '10px' }}>
            A lens isolates relevant layers by dimming non-matching objects to 30% or hiding them.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {lensPresets.map((preset) => {
              const isActive = activeLens === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => onSelectLens?.(preset.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'var(--lb-surface-raised)' : 'var(--lb-surface)',
                    border: isActive ? '2px solid var(--lb-accent)' : '1px solid var(--lb-border)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? 'var(--lb-accent)' : 'var(--lb-text)' }}>
                    {preset.title}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>
                    {preset.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '11px', color: 'var(--lb-text-muted)', display: 'block', marginBottom: '4px' }}>
            Custom Tag Filter
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="e.g. bst, root, math"
              value={lensTagFilter}
              onChange={(e) => onSetLensTagFilter?.(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                outline: 'none',
              }}
            />
            {activeLens !== 'all' && (
              <button
                type="button"
                onClick={onResetLens}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--lb-border)',
                  backgroundColor: 'var(--lb-surface-raised)',
                  color: 'var(--lb-text)',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'Backlinks') {
    return (
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--lb-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            Board Backlinks (Spec §12)
          </div>
          <div style={{ fontSize: '11px', color: 'var(--lb-text-muted)', lineHeight: 1.4 }}>
            Mentions formatted as [[Board Title]] in notes and labels resolve into cross-board links.
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--lb-text)', marginBottom: '6px' }}>
            Open Workspace Boards
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {openTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => onSelectTab?.(tab.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: isActive ? 'var(--lb-surface-raised)' : 'var(--lb-surface)',
                    border: isActive ? '1px solid var(--lb-accent)' : '1px solid var(--lb-border)',
                    fontSize: '12px',
                    color: isActive ? 'var(--lb-accent)' : 'var(--lb-text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>📄 {tab.title}</span>
                  {isActive ? (
                    <span style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>current</span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInsertBacklink?.(tab.title);
                      }}
                      title="Insert [[Link]] card on canvas"
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--lb-border)',
                        backgroundColor: 'var(--lb-surface-raised)',
                        color: 'var(--lb-accent)',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      + Link
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // activeSection === 'History'
  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--lb-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}
        >
          Timeline & Snapshots (Spec §7, §12)
        </div>
        <div style={{ fontSize: '11px', color: 'var(--lb-text-muted)', lineHeight: 1.4 }}>
          {undoStepsCount} undo states available. Starred snapshots are preserved across sessions.
        </div>
      </div>

      {/* Star snapshot form */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          placeholder="Snapshot label (e.g. Milestone 1)..."
          value={snapshotLabel}
          onChange={(e) => setSnapshotLabel(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: '6px',
            border: '1px solid var(--lb-border)',
            backgroundColor: 'var(--lb-surface)',
            color: 'var(--lb-text)',
            fontSize: '11px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => {
            onStarSnapshot?.(snapshotLabel.trim() || undefined);
            setSnapshotLabel('');
          }}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'var(--lb-accent)',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ⭐ Star
        </button>
      </div>

      {/* Stored Snapshots List */}
      <div
        style={{
          maxHeight: 'calc(100vh - 280px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--lb-surface)',
              border: '1px solid var(--lb-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--lb-text)' }}>
                {snap.starred ? '⭐ ' : '📌 '}
                {snap.label || 'Checkpoint'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--lb-text-muted)' }}>
                {new Date(snap.timestamp).toLocaleString()} ({snap.doc.rootIds.length} objects)
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRestoreSnapshot?.(snap)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface-raised)',
                color: 'var(--lb-accent)',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Revert
            </button>
          </div>
        ))}

        {snapshots.length === 0 && (
          <div style={{ fontSize: '11px', color: 'var(--lb-text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No saved snapshots yet. Press Ctrl+S or click "Star" to bookmark a version.
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--lb-border)' }}>
        <button
          type="button"
          onClick={onRunQuickCheck}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '6px',
            border: '1px solid var(--lb-border)',
            backgroundColor: 'var(--lb-surface-raised)',
            color: 'var(--lb-text)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🛡️ Run Storage Integrity Quick-Check
        </button>
      </div>
    </div>
  );
}
