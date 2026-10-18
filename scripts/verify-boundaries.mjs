#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Verifying ESLint downward boundary enforcement...');

const violationFileCore = path.resolve('packages/core/src/__boundary_test_violation__.ts');
const violationFileRender = path.resolve('packages/render/src/__boundary_test_violation__.ts');

let allPassed = true;

// Test 1: Core importing Render (upward)
try {
  fs.mkdirSync(path.dirname(violationFileCore), { recursive: true });
  fs.writeFileSync(
    violationFileCore,
    "import { CanvasRenderer } from '@lensboard/render';\nexport const bad = 1;\n"
  );

  let caught = false;
  try {
    execSync(`npx eslint "${violationFileCore}"`, { stdio: 'pipe' });
  } catch (err) {
    caught = true;
    console.log('✅ PASS: ESLint correctly rejected upward import (core -> render).');
  }

  if (!caught) {
    console.error('❌ CRITICAL FAILURE: ESLint permitted upward import (core -> render)!');
    allPassed = false;
  }
} finally {
  if (fs.existsSync(violationFileCore)) {
    fs.unlinkSync(violationFileCore);
  }
}

// Test 2: Render importing UI (upward)
try {
  fs.mkdirSync(path.dirname(violationFileRender), { recursive: true });
  fs.writeFileSync(
    violationFileRender,
    "import { ThemeTokens } from '@lensboard/ui';\nexport const bad = 2;\n"
  );

  let caught = false;
  try {
    execSync(`npx eslint "${violationFileRender}"`, { stdio: 'pipe' });
  } catch (err) {
    caught = true;
    console.log('✅ PASS: ESLint correctly rejected upward import (render -> ui).');
  }

  if (!caught) {
    console.error('❌ CRITICAL FAILURE: ESLint permitted upward import (render -> ui)!');
    allPassed = false;
  }
} finally {
  if (fs.existsSync(violationFileRender)) {
    fs.unlinkSync(violationFileRender);
  }
}

if (!allPassed) {
  process.exit(1);
}

console.log('🎉 All boundary enforcement checks passed cleanly.');
