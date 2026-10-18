import type { SmartEntityOption } from './types.js';

export const SMART_ENTITIES: readonly SmartEntityOption[] = [
  {
    type: 'frame',
    label: 'Problem Frame',
    category: 'Layout',
    description: 'Structured problem template (Input, Constraints, State, Transitions)',
  },
  {
    type: 'array',
    label: 'Array / Sequence',
    category: 'Data Structures',
    description: '1D indexed array with pointer markers',
  },
  {
    type: 'dp-table',
    label: 'DP Table',
    category: 'Algorithms',
    description: 'Dynamic programming matrix with dual-channel visual state cues',
  },
  {
    type: 'tree',
    label: 'Recursion Tree',
    category: 'Algorithms',
    description: 'Hierarchical node tree with branching factors',
  },
  {
    type: 'graph',
    label: 'Graph',
    category: 'Data Structures',
    description: 'Directed or undirected graph network with adjacency visualization',
  },
  {
    type: 'nn-block',
    label: 'NN Block',
    category: 'Deep Learning',
    description: 'Neural network layer / transformer block tensor',
  },
  {
    type: 'heatmap',
    label: 'Attention Heatmap',
    category: 'Deep Learning',
    description: 'Attention weight matrix visualization',
  },
  {
    type: 'plot',
    label: 'Loss Plot',
    category: 'Analysis',
    description: '2D metric curve with axes and annotations',
  },
  {
    type: 'feature-card',
    label: 'Feature Card',
    category: 'Layout',
    description: 'Summary card with title, badge, and description',
  },
  {
    type: 'derivation',
    label: 'Derivation Step',
    category: 'Math',
    description: 'Step-by-step mathematical proof / reduction step',
  },
  {
    type: 'flowchart',
    label: 'Flowchart',
    category: 'Diagrams',
    description: 'Process decision node flowchart',
  },
  {
    type: 'note',
    label: 'Sticky Note',
    category: 'Annotations',
    description: 'Rich text sticky note with color accent',
  },
  {
    type: 'code',
    label: 'Code Block',
    category: 'Development',
    description: 'CodeMirror Python/C++ editor with test runner',
  },
  {
    type: 'code',
    label: 'Custom Code Block (Empty)',
    category: 'Development',
    description: 'Empty custom code runner with line-by-line editor & output',
  },
  {
    type: 'shape',
    label: 'Flowchart Decision (Diamond)',
    category: 'Diagrams',
    description: 'Rhombus decision node with conditional branches',
  },
  {
    type: 'image',
    label: 'Import Image',
    category: 'Media',
    description: 'Import image file or paste from clipboard onto canvas',
  },
  {
    type: 'equation',
    label: 'Math Equation',
    category: 'Math',
    description: 'KaTeX LaTeX formula block',
  },
  {
    type: 'table',
    label: 'Generic Table',
    category: 'Data',
    description: 'Tabular data grid with header rows',
  },
] as const;
