#!/usr/bin/env node
// Build the same input files the production workflow snapshots, but from a frozen
// golden case: the issue as it was opened, plus only the issues opened before it.
//   node evals/golden/replay-inputs.mjs <case-id> <out-dir>
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCases } from "./score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const [id, outDir] = process.argv.slice(2);
const cases = loadCases();
const target = cases.find((c) => c.id === id);
if (!target) throw new Error(`unknown case ${id}`);
const mapPath = join(HERE, "issue-map.json");
const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : {};

const toIssue = (c) => ({
  number: map[c.id] ?? c.order,
  title: c.issue.title,
  body: c.issue.body,
  state: "open",
  state_reason: null,
  // Synthetic, strictly increasing timestamps preserve the original opening order.
  created_at: new Date(Date.UTC(2026, 10, 1, 12, c.order)).toISOString(),
  author: "golden-replay",
  author_association: "OWNER",
  labels: c.issue.labels,
  is_pull_request: false,
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "issue.json"), JSON.stringify(toIssue(target), null, 2));
writeFileSync(
  join(outDir, "existing-issues.json"),
  JSON.stringify(cases.filter((c) => c.order < target.order).map(toIssue), null, 2),
);
console.log(`replay inputs for ${id}: ${cases.filter((c) => c.order < target.order).length} earlier issues`);
