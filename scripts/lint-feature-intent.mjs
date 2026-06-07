#!/usr/bin/env node
// Phase 4 intent lint (docs/bdd-coverage-and-test-plan.md).
//
// Keeps feature files declarative by rejecting implementation leakage:
//   - raw measurement units (12px, 500ms, 2rem ...),
//   - project CSS selectors (.me-*, .cm-*, #id),
//   - HTML tags (<div>, <span/> ...).
//
// Raw numbers are allowed in a scenario tagged @regulatory / @a11y / @spec-*,
// where the value itself is part of the contract. Selectors and HTML tags are
// never allowed.
//
// Run: pnpm lint:features
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const featuresDir = path.join(root, 'features');

const UNIT = /\b\d+(?:\.\d+)?\s?(?:px|ms|rem|em|pt|vh|vw)\b/i;
const SELECTOR = /\.(?:me|cm)-[\w-]+|#[a-z][\w-]+/i;
const HTML_TAG = /<\/?[a-z][a-z0-9]*(?:\s[^>]*)?\/?>/i;
const NUMBER_EXEMPT = /^@(?:regulatory|a11y|spec-)/;

const problems = [];

for (const file of fs.readdirSync(featuresDir).filter((f) => f.endsWith('.feature'))) {
  const lines = fs.readFileSync(path.join(featuresDir, file), 'utf8').split(/\r?\n/);
  let featureTags = [];
  let scenarioTags = [];
  let pending = [];

  lines.forEach((raw, index) => {
    const line = raw.trim();
    const lineNo = index + 1;
    if (!line || line.startsWith('#')) return;

    if (line.startsWith('@')) {
      pending.push(...line.split(/\s+/).filter(Boolean));
      return;
    }
    if (line.startsWith('Feature:')) {
      featureTags = pending;
      pending = [];
    } else if (/^Scenario(?: Outline)?:/.test(line)) {
      scenarioTags = pending;
      pending = [];
    } else if (/^(Background:|Examples:|Rule:)/.test(line)) {
      pending = [];
    } else {
      pending = [];
    }

    const numbersExempt = [...featureTags, ...scenarioTags].some((t) => NUMBER_EXEMPT.test(t));
    if (SELECTOR.test(line)) problems.push(`${file}:${lineNo}  CSS selector — "${line}"`);
    if (HTML_TAG.test(line)) problems.push(`${file}:${lineNo}  HTML tag — "${line}"`);
    if (!numbersExempt && UNIT.test(line)) problems.push(`${file}:${lineNo}  raw unit (use the interaction contract, or tag @a11y/@regulatory) — "${line}"`);
  });
}

if (problems.length) {
  console.error(`✗ Feature intent lint failed (${problems.length} issue${problems.length === 1 ? '' : 's'}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('✓ Feature intent lint passed: no implementation leakage in features/*.feature.');
