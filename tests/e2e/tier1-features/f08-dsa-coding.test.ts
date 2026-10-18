/**
 * Feature 8: Dual-Channel DSA Visual Coding (M2)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 8
 * Base case, Computed, Active, To compute, Mismatch (Verify), Final answer
 * Dual cues: Color fill + Geometric shape indicators (never color alone)
 */

import { describe, it, expect } from '../harness.ts';
import { DSA_STATE_DEFINITIONS } from '../helpers/contracts.ts';

describe('Feature 8: Dual-Channel DSA Visual Coding', () => {
  it('f08-1: supports all 6 canonical DSA cell states', () => {
    const states = Object.keys(DSA_STATE_DEFINITIONS);
    expect(states).toHaveLength(6);
    expect(states).toContain('base-case');
    expect(states).toContain('computed');
    expect(states).toContain('active');
    expect(states).toContain('to-compute');
    expect(states).toContain('mismatch');
    expect(states).toContain('final-answer');
  });

  it('f08-2: base case renders teal fill with small corner triangle cue', () => {
    const def = DSA_STATE_DEFINITIONS['base-case'];
    expect(def.colorName).toBe('teal');
    expect(def.shapeCue).toBe('triangle');
  });

  it('f08-3: active cell renders amber fill with thick outline indicator', () => {
    const def = DSA_STATE_DEFINITIONS['active'];
    expect(def.colorName).toBe('amber');
    expect(def.shapeCue).toBe('thick-outline');
  });

  it('f08-4: to-compute renders transparent/no fill with dashed stroke outline', () => {
    const def = DSA_STATE_DEFINITIONS['to-compute'];
    expect(def.colorName).toBe('transparent');
    expect(def.shapeCue).toBe('dashed-outline');
  });

  it('f08-5: mismatch and final-answer states provide distinct hatch and star badge cues', () => {
    const mismatch = DSA_STATE_DEFINITIONS['mismatch'];
    const finalAns = DSA_STATE_DEFINITIONS['final-answer'];
    expect(mismatch.shapeCue).toBe('hatch');
    expect(mismatch.colorName).toBe('vermillion');
    expect(finalAns.shapeCue).toBe('star-badge');
    expect(finalAns.colorName).toBe('gold');
  });
});
