/**
 * LENSBoard 2.0 — Dynamic Module & Feature Loader
 * Bridges progressive test execution between specification contracts and live packages.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ModuleLoadResult<T> {
  loaded: boolean;
  module: T | null;
  error?: string;
}

export async function tryLoadMonorepoModule<T = unknown>(packageRelativePath: string): Promise<ModuleLoadResult<T>> {
  const fullPath = path.resolve(process.cwd(), packageRelativePath);
  if (!fs.existsSync(fullPath)) {
    return {
      loaded: false,
      module: null,
      error: `Package path does not exist: ${packageRelativePath}`,
    };
  }

  try {
    const mod = await import(fullPath);
    return {
      loaded: true,
      module: mod as T,
    };
  } catch (err) {
    return {
      loaded: false,
      module: null,
      error: (err as Error).message,
    };
  }
}

export function checkPackageJsonExists(packageRelativeDir: string): boolean {
  const p = path.resolve(process.cwd(), packageRelativeDir, 'package.json');
  return fs.existsSync(p);
}

export function readPackageJson(packageRelativeDir: string): Record<string, unknown> | null {
  const p = path.resolve(process.cwd(), packageRelativeDir, 'package.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}
