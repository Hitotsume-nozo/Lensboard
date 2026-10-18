/**
 * LENSBoard 2.0 — Comprehensive E2E Test Suite Orchestrator & Runner
 * Usage:
 *   node tests/e2e/runner.ts
 *   node tests/e2e/runner.ts --tier=1
 *   node tests/e2e/runner.ts --milestone=M1
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith('--tier='))?.split('=')[1];
const milestoneArg = args.find((a) => a.startsWith('--milestone='))?.split('=')[1];

console.log('================================================================');
console.log('  LENSBoard 2.0 — End-to-End Test Suite Execution  ');
console.log('================================================================');
console.log(`Node Version: ${process.version}`);
console.log(`Working Directory: ${process.cwd()}`);
if (tierArg) console.log(`Filter Tier: Tier ${tierArg}`);
if (milestoneArg) console.log(`Filter Milestone: ${milestoneArg}`);
console.log('----------------------------------------------------------------\n');

// Discover test files
function getTestFiles(): string[] {
  const root = path.resolve(process.cwd(), 'tests/e2e');
  const files: string[] = [];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scan(full);
      } else if (e.name.endsWith('.test.ts')) {
        files.push(path.relative(process.cwd(), full));
      }
    }
  }

  scan(root);
  return files;
}

let allFiles = getTestFiles();

// Apply filtering
if (tierArg) {
  if (tierArg === '1') allFiles = allFiles.filter((f) => f.includes('tier1-features'));
  else if (tierArg === '2') allFiles = allFiles.filter((f) => f.includes('tier2-boundaries'));
  else if (tierArg === '3') allFiles = allFiles.filter((f) => f.includes('tier3-cross-feature'));
  else if (tierArg === '4') allFiles = allFiles.filter((f) => f.includes('tier4-scenarios'));
}

if (milestoneArg) {
  const m = milestoneArg.toUpperCase();
  if (m === 'M1') {
    allFiles = allFiles.filter((f) => f.includes('f01') || f.includes('f02') || f.includes('f03'));
  } else if (m === 'M2') {
    allFiles = allFiles.filter((f) => f.includes('f04') || f.includes('f05') || f.includes('f06') || f.includes('f07') || f.includes('f08'));
  } else if (m === 'M3') {
    allFiles = allFiles.filter((f) => /f(09|10|11|12|13|14|15|16|17)/.test(f));
  } else if (m === 'M4') {
    allFiles = allFiles.filter((f) => /f(18|19|20|21|22|23)/.test(f));
  } else if (m === 'M5') {
    allFiles = allFiles.filter((f) => /f(24|25|26|27|28|29)/.test(f));
  } else if (m === 'M6') {
    allFiles = allFiles.filter((f) => f.includes('f30') || f.includes('tier3') || f.includes('tier4'));
  }
}

console.log(`Executing ${allFiles.length} test suite files...\n`);

const child = spawn('node', ['--test', ...allFiles], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('close', (code) => {
  console.log('\n================================================================');
  console.log(`  Execution Complete (Exit Code: ${code})  `);
  console.log('================================================================');
  process.exit(code ?? 0);
});
