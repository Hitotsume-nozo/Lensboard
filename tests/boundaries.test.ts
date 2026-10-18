import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Downward Dependency Boundary Enforcement', () => {
  const eslint = new ESLint({
    cwd: path.resolve(__dirname, '..'),
  });

  const lintSnippet = async (code: string, filePath: string) => {
    const results = await eslint.lintText(code, { filePath });
    return results[0];
  };

  describe('packages/core Purity', () => {
    it('MUST fail when core imports @lensboard/render', async () => {
      const res = await lintSnippet(
        "import { CanvasRenderer } from '@lensboard/render';\nexport const x = 1;",
        'packages/core/src/violation.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
      const isBoundaryError = res.messages.some(
        (m) =>
          m.ruleId === 'boundaries/dependencies' ||
          m.ruleId === 'no-restricted-imports'
      );
      expect(isBoundaryError).toBe(true);
    });

    it('MUST fail when core imports @lensboard/ui', async () => {
      const res = await lintSnippet(
        "import { ThemeTokens } from '@lensboard/ui';\nexport const x = 1;",
        'packages/core/src/violation.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail when core imports @lensboard/storage', async () => {
      const res = await lintSnippet(
        "import { StorageService } from '@lensboard/storage';\nexport const x = 1;",
        'packages/core/src/violation.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail when core imports @lensboard/desktop', async () => {
      const res = await lintSnippet(
        "import { app } from '@lensboard/desktop';\nexport const x = 1;",
        'packages/core/src/violation.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail on relative upward escape ../../packages/render', async () => {
      const res = await lintSnippet(
        "import { CanvasRenderer } from '../../packages/render/src/index';\nexport const x = 1;",
        'packages/core/src/violation.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST pass on valid internal imports within packages/core', async () => {
      const res = await lintSnippet(
        "export interface LensDoc { id: string; }\nexport const doc = 1;",
        'packages/core/src/model/document.ts'
      );
      expect(res.errorCount).toBe(0);
    });
  });

  describe('packages/render Layering', () => {
    it('MUST pass when render imports @lensboard/core (downward)', async () => {
      const res = await lintSnippet(
        "import type { LensDocument } from '@lensboard/core';\nexport const r = 1;",
        'packages/render/src/canvas.ts'
      );
      expect(res.errorCount).toBe(0);
    });

    it('MUST fail when render imports @lensboard/ui (upward)', async () => {
      const res = await lintSnippet(
        "import { ThemeTokens } from '@lensboard/ui';\nexport const r = 1;",
        'packages/render/src/canvas.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail when render imports @lensboard/storage (sideways)', async () => {
      const res = await lintSnippet(
        "import { StorageService } from '@lensboard/storage';\nexport const r = 1;",
        'packages/render/src/canvas.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail when render imports @lensboard/desktop (upward)', async () => {
      const res = await lintSnippet(
        "import { app } from '@lensboard/desktop';\nexport const r = 1;",
        'packages/render/src/canvas.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
      const isBoundaryError = res.messages.some(
        (m) =>
          m.ruleId === 'boundaries/dependencies' ||
          m.ruleId === 'no-restricted-imports'
      );
      expect(isBoundaryError).toBe(true);
    });
  });

  describe('packages/storage Layering', () => {
    it('MUST pass when storage imports @lensboard/core (downward)', async () => {
      const res = await lintSnippet(
        "import type { Command } from '@lensboard/core';\nexport const s = 1;",
        'packages/storage/src/sqlite.ts'
      );
      expect(res.errorCount).toBe(0);
    });

    it('MUST fail when storage imports @lensboard/render (sideways)', async () => {
      const res = await lintSnippet(
        "import { CanvasRenderer } from '@lensboard/render';\nexport const s = 1;",
        'packages/storage/src/sqlite.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail when storage imports @lensboard/ui (upward)', async () => {
      const res = await lintSnippet(
        "import { ThemeTokens } from '@lensboard/ui';\nexport const s = 1;",
        'packages/storage/src/sqlite.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail when storage imports @lensboard/desktop (upward)', async () => {
      const res = await lintSnippet(
        "import { app } from '@lensboard/desktop';\nexport const s = 1;",
        'packages/storage/src/sqlite.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
      const isBoundaryError = res.messages.some(
        (m) =>
          m.ruleId === 'boundaries/dependencies' ||
          m.ruleId === 'no-restricted-imports'
      );
      expect(isBoundaryError).toBe(true);
    });
  });

  describe('packages/ui Layering', () => {
    it('MUST pass when ui imports @lensboard/render and @lensboard/core (downward)', async () => {
      const res = await lintSnippet(
        "import type { LensDocument } from '@lensboard/core';\nimport type { CanvasRenderer } from '@lensboard/render';\nexport const u = 1;",
        'packages/ui/src/chrome.ts'
      );
      expect(res.errorCount).toBe(0);
    });

    it('MUST fail when ui imports @lensboard/storage (sideways)', async () => {
      const res = await lintSnippet(
        "import { StorageService } from '@lensboard/storage';\nexport const u = 1;",
        'packages/ui/src/chrome.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });

    it('MUST fail when ui imports @lensboard/desktop (upward)', async () => {
      const res = await lintSnippet(
        "import { app } from '@lensboard/desktop';\nexport const u = 1;",
        'packages/ui/src/chrome.ts'
      );
      expect(res.errorCount).toBeGreaterThan(0);
    });
  });

  describe('apps/desktop Integration Layer', () => {
    it('MUST pass when apps/desktop imports ui, render, storage, and core', async () => {
      const res = await lintSnippet(
        `import type { LensDocument } from '@lensboard/core';
         import type { StorageService } from '@lensboard/storage';
         import type { CanvasRenderer } from '@lensboard/render';
         import type { ThemeTokens } from '@lensboard/ui';
         export const desktop = 1;`,
        'apps/desktop/src/main/main.ts'
      );
      expect(res.errorCount).toBe(0);
    });
  });
});
