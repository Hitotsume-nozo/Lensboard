/**
 * Feature 2: Downward Dependency Rule (M1)
 * Authoritative Source: SPEC.md §5, PROJECT.md § Architecture, Feature 2
 */

import { describe, it, expect } from '../harness.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('Feature 2: Downward Dependency Rule', () => {
  it('f02-1: ESLint flat configuration exists in project root', () => {
    const eslintPath = path.resolve(process.cwd(), 'eslint.config.mjs');
    expect(fs.existsSync(eslintPath)).toBe(true);
  });

  it('f02-2: core package source directory contains no upward package import statements', () => {
    const coreSrc = path.resolve(process.cwd(), 'packages/core/src');
    if (!fs.existsSync(coreSrc)) {
      expect(fs.existsSync(coreSrc)).toBe(true);
      return;
    }
    const files = fs.readdirSync(coreSrc, { recursive: true }) as string[];
    for (const f of files) {
      if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
        const content = fs.readFileSync(path.join(coreSrc, f), 'utf-8');
        expect(content).not.toContain('@lensboard/render');
        expect(content).not.toContain('@lensboard/ui');
        expect(content).not.toContain('@lensboard/storage');
      }
    }
  });

  it('f02-3: render package imports downward only to core', () => {
    const renderSrc = path.resolve(process.cwd(), 'packages/render/src');
    if (!fs.existsSync(renderSrc)) {
      expect(fs.existsSync(renderSrc)).toBe(true);
      return;
    }
    const files = fs.readdirSync(renderSrc, { recursive: true }) as string[];
    for (const f of files) {
      if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
        const content = fs.readFileSync(path.join(renderSrc, f), 'utf-8');
        expect(content).not.toContain('@lensboard/ui');
        expect(content).not.toContain('@lensboard/storage');
      }
    }
  });

  it('f02-4: storage package imports downward only to core', () => {
    const storageSrc = path.resolve(process.cwd(), 'packages/storage/src');
    if (!fs.existsSync(storageSrc)) {
      expect(fs.existsSync(storageSrc)).toBe(true);
      return;
    }
    const files = fs.readdirSync(storageSrc, { recursive: true }) as string[];
    for (const f of files) {
      if (typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx'))) {
        const content = fs.readFileSync(path.join(storageSrc, f), 'utf-8');
        expect(content).not.toContain('@lensboard/ui');
        expect(content).not.toContain('@lensboard/render');
      }
    }
  });

  it('f02-5: ESLint boundary configuration defines downward dependency hierarchy', () => {
    const eslintPath = path.resolve(process.cwd(), 'eslint.config.mjs');
    if (!fs.existsSync(eslintPath)) {
      expect(fs.existsSync(eslintPath)).toBe(true);
      return;
    }
    const configContent = fs.readFileSync(eslintPath, 'utf-8');
    expect(configContent).toContain('core');
  });
});
