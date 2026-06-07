#!/usr/bin/env node
// Phase 4 coverage gate (docs/bdd-coverage-and-test-plan.md).
//
// Fails the build when BDD intent and automated coverage drift apart:
//   - every Scenario in features/*.feature is listed in features/coverage.yaml
//     (and vice-versa: no stale manifest entries),
//   - every manifest entry has status `covered` or `partial` (never `none`,
//     unless the scenario is tagged @manual),
//   - meta.totals matches the real counts,
//   - every referenced unit/e2e test FILE still exists.
//
// Run: pnpm check:coverage
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const featuresDir = path.join(root, 'features');

const errors = [];
const counts = { covered: 0, partial: 0, none: 0 };
let totalScenarios = 0;

/** Parse a .feature file into its scenarios with their effective tags. */
function parseFeature(text) {
  const scenarios = [];
  let featureTags = [];
  let pending = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('@')) {
      pending.push(...line.split(/\s+/).filter(Boolean));
      continue;
    }
    if (line.startsWith('Feature:')) {
      featureTags = pending;
      pending = [];
      continue;
    }
    const m = line.match(/^Scenario(?: Outline)?:\s*(.+)$/);
    if (m) {
      scenarios.push({ title: m[1].trim(), tags: [...featureTags, ...pending] });
      pending = [];
      continue;
    }
    pending = [];
  }
  return scenarios;
}

/** Resolve a `loc::title` ref's test file (package test, or e2e spec). */
function resolveRefFile(loc) {
  if (loc.includes('/')) {
    const [pkg, name] = loc.split('/');
    const base = path.join(root, 'packages', pkg, 'test', name);
    for (const ext of ['.test.ts', '.test.tsx']) {
      if (fs.existsSync(base + ext)) return base + ext;
    }
    return base + '.test.ts';
  }
  return path.join(root, 'examples', 'dev-harness', 'e2e', `${loc}.spec.ts`);
}

const manifest = YAML.parse(fs.readFileSync(path.join(featuresDir, 'coverage.yaml'), 'utf8'));
const manifestFeatures = manifest.features ?? {};

const featureFiles = fs.readdirSync(featuresDir).filter((f) => f.endsWith('.feature'));
const tagsByScenario = new Map();

// 1) Bidirectional scenario <-> manifest consistency.
for (const file of featureFiles) {
  const key = file.replace(/\.feature$/, '');
  const scenarios = parseFeature(fs.readFileSync(path.join(featuresDir, file), 'utf8'));
  const entries = manifestFeatures[key];
  if (!entries) {
    errors.push(`coverage.yaml has no entry for feature "${key}" (${file})`);
    continue;
  }
  const entryTitles = new Set(entries.map((e) => e.scenario));
  const fileTitles = new Set(scenarios.map((s) => s.title));
  for (const s of scenarios) {
    tagsByScenario.set(`${key}::${s.title}`, s.tags);
    if (!entryTitles.has(s.title)) errors.push(`${file}: scenario "${s.title}" is missing from coverage.yaml`);
  }
  for (const e of entries) {
    if (!fileTitles.has(e.scenario)) errors.push(`coverage.yaml[${key}]: stale entry "${e.scenario}" (no such scenario in ${file})`);
  }
}

// 2) Status, totals, and ref-file existence over every manifest entry.
for (const [key, entries] of Object.entries(manifestFeatures)) {
  for (const e of entries) {
    totalScenarios += 1;
    if (!['covered', 'partial', 'none'].includes(e.status)) {
      errors.push(`${key}/"${e.scenario}": invalid status "${e.status}"`);
    } else {
      counts[e.status] += 1;
    }
    const tags = tagsByScenario.get(`${key}::${e.scenario}`) ?? [];
    if (e.status === 'none' && !tags.includes('@manual')) {
      errors.push(`${key}/"${e.scenario}": status "none" is not allowed (tag the scenario @manual if intentional)`);
    }
    for (const ref of [...(e.unit ?? []), ...(e.e2e ?? [])]) {
      const idx = ref.indexOf('::');
      if (idx === -1) continue; // descriptive ref (no test title) — skip
      const file = resolveRefFile(ref.slice(0, idx).trim());
      if (!fs.existsSync(file)) {
        errors.push(`${key}/"${e.scenario}": referenced test file is missing -> ${path.relative(root, file)} (ref: ${ref})`);
      }
    }
  }
}

// 3) meta.totals must match reality.
const meta = manifest.meta?.totals;
if (!meta) {
  errors.push('coverage.yaml: meta.totals is missing');
} else {
  if (meta.scenarios !== totalScenarios) errors.push(`meta.totals.scenarios=${meta.scenarios} but actual=${totalScenarios}`);
  for (const k of ['covered', 'partial', 'none']) {
    if (meta[k] !== counts[k]) errors.push(`meta.totals.${k}=${meta[k]} but actual=${counts[k]}`);
  }
}

const pct = totalScenarios ? Math.round((counts.covered / totalScenarios) * 100) : 0;
if (errors.length) {
  console.error(`✗ Feature coverage gate failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ Feature coverage gate passed: ${totalScenarios} scenarios, ${counts.covered} covered (${pct}%), ${counts.partial} partial, ${counts.none} none.`);
