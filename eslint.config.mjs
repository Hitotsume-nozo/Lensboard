// @ts-check
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import boundaries from "eslint-plugin-boundaries";

export default [
  // 1. Global Ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.agents/**",
      "**/*.d.ts",
    ],
  },

  // 2. Base Configuration for all TypeScript & JavaScript files
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      boundaries,
    },
    settings: {
      "boundaries/root-path": process.cwd(),
      "boundaries/elements": [
        {
          type: "core",
          pattern: "packages/core/**",
          partialMatch: false,
        },
        {
          type: "render",
          pattern: "packages/render/**",
          partialMatch: false,
        },
        {
          type: "storage",
          pattern: "packages/storage/**",
          partialMatch: false,
        },
        {
          type: "ui",
          pattern: "packages/ui/**",
          partialMatch: false,
        },
        {
          type: "desktop",
          pattern: "apps/desktop/**",
          partialMatch: false,
        },
        {
          type: "recognizers",
          pattern: "packages/recognizers/**",
          partialMatch: false,
        },
        {
          type: "runner",
          pattern: "packages/runner/**",
          partialMatch: false,
        },
        {
          type: "cli",
          pattern: "apps/cli/**",
          partialMatch: false,
        },
      ],
      "boundaries/ignore": [
        "**/node_modules/**",
        "**/dist/**",
      ],
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: [
            "tsconfig.base.json",
            "packages/*/tsconfig.json",
            "apps/*/tsconfig.json",
          ],
        },
        node: true,
      },
    },
    rules: {
      // Core boundaries dependency rule (Layer 1)
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Architectural layering violation: {{from.element.type}} is not permitted to import {{to.element.type}} (downward-only layering per §5).",
          policies: [
            // packages/core: strictly pure, imports NOTHING else in repo
            {
              from: { element: { type: "core" } },
              allow: { to: { element: { type: "core" } } },
            },
            // packages/render: can only import packages/core
            {
              from: { element: { type: "render" } },
              allow: { to: { element: { type: ["render", "core"] } } },
            },
            // packages/storage: can only import packages/core
            {
              from: { element: { type: "storage" } },
              allow: { to: { element: { type: ["storage", "core"] } } },
            },
            // packages/recognizers: can only import packages/core
            {
              from: { element: { type: "recognizers" } },
              allow: { to: { element: { type: ["recognizers", "core"] } } },
            },
            // packages/runner: standalone
            {
              from: { element: { type: "runner" } },
              allow: { to: { element: { type: "runner" } } },
            },
            // packages/ui: can only import packages/render and packages/core
            {
              from: { element: { type: "ui" } },
              allow: { to: { element: { type: ["ui", "render", "core"] } } },
            },
            // apps/desktop: wires all packages
            {
              from: { element: { type: "desktop" } },
              allow: {
                to: {
                  element: {
                    type: [
                      "desktop",
                      "ui",
                      "render",
                      "storage",
                      "core",
                      "recognizers",
                      "runner",
                    ],
                  },
                },
              },
            },
            // apps/cli: wires storage and core
            {
              from: { element: { type: "cli" } },
              allow: {
                to: {
                  element: {
                    type: ["cli", "storage", "core"],
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },

  // 3. Layer 2 AST Enforcement: packages/core
  {
    files: ["packages/core/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@lensboard/render",
              message:
                "Layering violation: @lensboard/core must not import @lensboard/render (§5 pure model).",
            },
            {
              name: "@lensboard/storage",
              message:
                "Layering violation: @lensboard/core must not import @lensboard/storage (§5 pure model).",
            },
            {
              name: "@lensboard/ui",
              message:
                "Layering violation: @lensboard/core must not import @lensboard/ui (§5 pure model).",
            },
            {
              name: "@lensboard/desktop",
              message:
                "Layering violation: @lensboard/core must not import @lensboard/desktop.",
            },
            {
              name: "@lensboard/recognizers",
              message:
                "Layering violation: @lensboard/core must not import @lensboard/recognizers.",
            },
            {
              name: "@lensboard/runner",
              message:
                "Layering violation: @lensboard/core must not import @lensboard/runner.",
            },
            {
              name: "@lensboard/cli",
              message:
                "Layering violation: @lensboard/core must not import @lensboard/cli.",
            },
            {
              name: "fs",
              message:
                "Layering violation: @lensboard/core is pure TypeScript and must not import Node 'fs'.",
            },
            {
              name: "node:fs",
              message:
                "Layering violation: @lensboard/core is pure TypeScript and must not import Node 'node:fs'.",
            },
            {
              name: "path",
              message:
                "Layering violation: @lensboard/core is pure TypeScript and must not import Node 'path'.",
            },
            {
              name: "node:path",
              message:
                "Layering violation: @lensboard/core is pure TypeScript and must not import Node 'node:path'.",
            },
            {
              name: "child_process",
              message:
                "Layering violation: @lensboard/core is pure TypeScript and must not import Node 'child_process'.",
            },
            {
              name: "node:child_process",
              message:
                "Layering violation: @lensboard/core is pure TypeScript and must not import Node 'node:child_process'.",
            },
          ],
          patterns: [
            {
              group: [
                "node:*",
                "@lensboard/render*",
                "@lensboard/storage*",
                "@lensboard/ui*",
                "@lensboard/desktop*",
                "@lensboard/recognizers*",
                "@lensboard/runner*",
                "@lensboard/cli*",
                "*packages/render*",
                "**/packages/render/**",
                "**/packages/render*",
                "*packages/storage*",
                "**/packages/storage/**",
                "**/packages/storage*",
                "*packages/ui*",
                "**/packages/ui/**",
                "**/packages/ui*",
                "*packages/recognizers*",
                "**/packages/recognizers/**",
                "**/packages/recognizers*",
                "*packages/runner*",
                "**/packages/runner/**",
                "**/packages/runner*",
                "*apps/*",
                "**/apps/**",
                "**/apps/*",
              ],
              message:
                "Layering violation: packages/core must not import upward or sideways from other packages or apps, nor import Node built-in modules.",
            },
          ],
        },
      ],
    },
  },

  // 4. Layer 2 AST Enforcement: packages/render
  {
    files: ["packages/render/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@lensboard/storage",
              message:
                "Layering violation: packages/render cannot import @lensboard/storage.",
            },
            {
              name: "@lensboard/ui",
              message:
                "Layering violation: packages/render cannot import @lensboard/ui (downward only: ui -> render).",
            },
            {
              name: "@lensboard/desktop",
              message:
                "Layering violation: packages/render cannot import @lensboard/desktop.",
            },
            {
              name: "@lensboard/recognizers",
              message:
                "Layering violation: packages/render cannot import @lensboard/recognizers.",
            },
            {
              name: "@lensboard/runner",
              message:
                "Layering violation: packages/render cannot import @lensboard/runner.",
            },
            {
              name: "@lensboard/cli",
              message:
                "Layering violation: packages/render cannot import @lensboard/cli.",
            },
          ],
          patterns: [
            {
              group: [
                "@lensboard/storage*",
                "@lensboard/ui*",
                "@lensboard/desktop*",
                "@lensboard/recognizers*",
                "@lensboard/runner*",
                "@lensboard/cli*",
                "*packages/storage*",
                "**/packages/storage/**",
                "**/packages/storage*",
                "*packages/ui*",
                "**/packages/ui/**",
                "**/packages/ui*",
                "*packages/recognizers*",
                "**/packages/recognizers/**",
                "**/packages/recognizers*",
                "*packages/runner*",
                "**/packages/runner/**",
                "**/packages/runner*",
                "*apps/*",
                "**/apps/**",
                "**/apps/*",
              ],
              message:
                "Layering violation: packages/render can only import packages/core.",
            },
          ],
        },
      ],
    },
  },

  // 5. Layer 2 AST Enforcement: packages/storage
  {
    files: ["packages/storage/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@lensboard/render",
              message:
                "Layering violation: packages/storage cannot import @lensboard/render.",
            },
            {
              name: "@lensboard/ui",
              message:
                "Layering violation: packages/storage cannot import @lensboard/ui.",
            },
            {
              name: "@lensboard/desktop",
              message:
                "Layering violation: packages/storage cannot import @lensboard/desktop.",
            },
            {
              name: "@lensboard/recognizers",
              message:
                "Layering violation: packages/storage cannot import @lensboard/recognizers.",
            },
            {
              name: "@lensboard/runner",
              message:
                "Layering violation: packages/storage cannot import @lensboard/runner.",
            },
            {
              name: "@lensboard/cli",
              message:
                "Layering violation: packages/storage cannot import @lensboard/cli.",
            },
          ],
          patterns: [
            {
              group: [
                "@lensboard/render*",
                "@lensboard/ui*",
                "@lensboard/desktop*",
                "@lensboard/recognizers*",
                "@lensboard/runner*",
                "@lensboard/cli*",
                "*packages/render*",
                "**/packages/render/**",
                "**/packages/render*",
                "*packages/ui*",
                "**/packages/ui/**",
                "**/packages/ui*",
                "*packages/recognizers*",
                "**/packages/recognizers/**",
                "**/packages/recognizers*",
                "*packages/runner*",
                "**/packages/runner/**",
                "**/packages/runner*",
                "*apps/*",
                "**/apps/**",
                "**/apps/*",
              ],
              message:
                "Layering violation: packages/storage can only import packages/core.",
            },
          ],
        },
      ],
    },
  },

  // 6. Layer 2 AST Enforcement: packages/ui
  {
    files: ["packages/ui/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@lensboard/storage",
              message:
                "Layering violation: packages/ui cannot import @lensboard/storage.",
            },
            {
              name: "@lensboard/desktop",
              message:
                "Layering violation: packages/ui cannot import @lensboard/desktop.",
            },
            {
              name: "@lensboard/runner",
              message:
                "Layering violation: packages/ui cannot import @lensboard/runner.",
            },
            {
              name: "@lensboard/cli",
              message:
                "Layering violation: packages/ui cannot import @lensboard/cli.",
            },
          ],
          patterns: [
            {
              group: [
                "@lensboard/storage*",
                "@lensboard/desktop*",
                "@lensboard/runner*",
                "@lensboard/cli*",
                "*packages/storage*",
                "**/packages/storage/**",
                "**/packages/storage*",
                "*packages/runner*",
                "**/packages/runner/**",
                "**/packages/runner*",
                "*apps/*",
                "**/apps/**",
                "**/apps/*",
              ],
              message:
                "Layering violation: packages/ui can only import packages/render and packages/core.",
            },
          ],
        },
      ],
    },
  },
];
