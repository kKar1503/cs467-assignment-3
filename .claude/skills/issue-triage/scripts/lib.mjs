// Shared helpers for the issue-triage skill scripts. No dependencies: the
// scripts must run inside the gh-aw sandbox with only Node.js available.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadLabelConfig() {
  return JSON.parse(readFileSync(join(SKILL_DIR, "labels.json"), "utf8"));
}

// Labels the agent is allowed to apply (type + area + status).
export function agentMayApply(cfg = loadLabelConfig()) {
  return [
    ...Object.keys(cfg.type),
    ...Object.keys(cfg.area),
    ...Object.keys(cfg.status),
  ];
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Accepts either the normalised snapshot shape written by the workflow
// ({labels: ["bug"]}) or raw GitHub REST shape ({labels: [{name: "bug"}]}).
export function labelNames(issue) {
  return (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
}

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}
