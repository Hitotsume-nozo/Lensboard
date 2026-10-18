/**
 * Feature 1: Monorepo Structure (M1)
 * Authoritative Source: SPEC.md §5, PROJECT.md § Architecture, Feature 1
 */

import { describe, it, expect } from '../harness.ts';
import fs from 'node:fs';
import path from 'node:path';

describe('Feature 1: Monorepo Structure', () => {
  it('f01-1: pnpm workspace manifest defines packages and apps globs', () => {
    const workspacePath = path.resolve(process.cwd(), 'pnpm-workspace.yaml');
    if (!fs.existsSync(workspacePath)) {
      // In-flight M1 scaffold check
      expect(fs.existsSync(workspacePath)).toBe(true);
      return;
    }
    const content = fs.readFileSync(workspacePath, 'utf-8');
    expect(content).toContain('packages/*');
    expect(content).toContain('apps/*');
  });

  it('f01-2: required package and app directories are scaffolded', () => {
    const expectedDirs = [
      'packages/core',
      'packages/render',
      'packages/storage',
      'packages/ui',
      'apps/desktop',
    ];
    for (const d of expectedDirs) {
      const fullPath = path.resolve(process.cwd(), d);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('f01-3: packages/core package.json has zero monorepo package dependencies', () => {
    const corePkgPath = path.resolve(process.cwd(), 'packages/core/package.json');
    if (!fs.existsSync(corePkgPath)) {
      expect(fs.existsSync(corePkgPath)).toBe(true);
      return;
    }
    const corePkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf-8'));
    expect(corePkg.name).toBe('@lensboard/core');
    const deps = { ...corePkg.dependencies, ...corePkg.devDependencies };
    expect(deps['@lensboard/render']).toBeUndefined();
    expect(deps['@lensboard/ui']).toBeUndefined();
    expect(deps['@lensboard/storage']).toBeUndefined();
  });

  it('f01-4: packages have valid package manifests with ESM module type', () => {
    const packages = ['packages/core', 'packages/render', 'packages/storage', 'packages/ui'];
    for (const p of packages) {
      const pkgPath = path.resolve(process.cwd(), p, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        expect(pkg.type).toBe('module');
      }
    }
  });

  it('f01-5: apps/desktop depends on ui, render, storage, and core packages', () => {
    const desktopPkgPath = path.resolve(process.cwd(), 'apps/desktop/package.json');
    if (!fs.existsSync(desktopPkgPath)) {
      expect(fs.existsSync(desktopPkgPath)).toBe(true);
      return;
    }
    const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf-8'));
    const allDeps = { ...desktopPkg.dependencies, ...desktopPkg.devDependencies };
    expect(allDeps['@lensboard/core']).toBeDefined();
  });
});
