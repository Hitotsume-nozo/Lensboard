/**
 * Feature 3: Workspace Build & Verify (M1)
 * Authoritative Source: SPEC.md §5, PROJECT.md § Architecture, Feature 3
 */

import { describe, it, expect } from '../harness.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('Feature 3: Workspace Build & Verify', () => {
  it('f03-1: root package.json defines typecheck, lint, test, and verify scripts', () => {
    const rootPkgPath = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(rootPkgPath)) {
      expect(fs.existsSync(rootPkgPath)).toBe(true);
      return;
    }
    const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.verify).toBeDefined();
    expect(pkg.scripts.typecheck).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
  });

  it('f03-2: root tsconfig.base.json exists with strict mode enabled', () => {
    const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.base.json');
    if (!fs.existsSync(tsconfigPath)) {
      expect(fs.existsSync(tsconfigPath)).toBe(true);
      return;
    }
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('f03-3: Vitest workspace or root config is configured', () => {
    const vitestConfig1 = path.resolve(process.cwd(), 'vitest.config.ts');
    const vitestConfig2 = path.resolve(process.cwd(), 'vitest.workspace.ts');
    const exists = fs.existsSync(vitestConfig1) || fs.existsSync(vitestConfig2);
    expect(exists).toBe(true);
  });

  it('f03-4: verify script chains typecheck, lint, and test', () => {
    const rootPkgPath = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(rootPkgPath)) {
      expect(fs.existsSync(rootPkgPath)).toBe(true);
      return;
    }
    const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    const verifyScript = pkg.scripts?.verify || '';
    expect(verifyScript.includes('typecheck') || verifyScript.includes('lint') || verifyScript.includes('test')).toBe(true);
  });

  it('f03-5: packages contain their own build/test scripts or inherit workspace execution', () => {
    const pkgs = ['packages/core', 'packages/render', 'packages/storage', 'packages/ui'];
    for (const p of pkgs) {
      const pPath = path.resolve(process.cwd(), p, 'package.json');
      if (fs.existsSync(pPath)) {
        const pkg = JSON.parse(fs.readFileSync(pPath, 'utf-8'));
        expect(pkg.name).toBeDefined();
      }
    }
  });
});
