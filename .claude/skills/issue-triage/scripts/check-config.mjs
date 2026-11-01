#!/usr/bin/env node
// CI guard: the label allowlist enforced by safe-outputs must equal the labels the
// skill tells the agent to use, and maintainer-only labels must be blocked.
//
//   node .claude/skills/issue-triage/scripts/check-config.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SKILL_DIR, loadLabelConfig, agentMayApply } from "./lib.mjs";

const repoRoot = join(SKILL_DIR, "..", "..", "..");
const wf = readFileSync(join(repoRoot, ".github/workflows/issue-triage.md"), "utf8");
const cfg = loadLabelConfig();
const errors = [];

const fm = wf.split(/^---$/m)[1] ?? "";
const addLabels = fm.match(/add-labels:\n([\s\S]*?)\n  add-comment:/)?.[1] ?? "";
const allowed = [...(addLabels.match(/allowed:\n((?:\s+- .+\n)+)/)?.[1] ?? "").matchAll(/- (.+)/g)].map(
  (m) => m[1].trim(),
);
const blocked = (addLabels.match(/blocked: \[(.*)\]/)?.[1] ?? "")
  .split(",")
  .map((s) => s.trim().replace(/^"|"$/g, ""));

const expected = agentMayApply(cfg);
const missing = expected.filter((l) => !allowed.includes(l));
const extra = allowed.filter((l) => !expected.includes(l));
if (missing.length) errors.push(`workflow allowlist is missing: ${missing.join(", ")}`);
if (extra.length) errors.push(`workflow allowlist has labels not in labels.json: ${extra.join(", ")}`);

for (const l of cfg.maintainerOnly) {
  const covered = blocked.some((b) => b === l || (b.endsWith("*") && l.startsWith(b.slice(0, -1))));
  const mustBlock = ["triaged", "agent-skip", "wontfix", "invalid", "duplicate", "security"];
  if (mustBlock.includes(l) && !covered) errors.push(`maintainer-only label '${l}' is not in add-labels.blocked`);
}

for (const forbidden of ["close-issue", "update-issue", "remove-labels", "lock-issue", "create-pull-request", "push-to-pull-request-branch", "merge"]) {
  if (new RegExp(`^  ${forbidden}:`, "m").test(fm)) errors.push(`forbidden safe output '${forbidden}' is configured`);
}
if (!/^permissions:\n  contents: read\n  issues: read\n(?!  \w+: write)/m.test(fm)) {
  errors.push("agent permissions must be exactly contents: read, issues: read");
}
if (!/^  model: claude-[a-z0-9-]+$/m.test(fm) || /model: (auto|sonnet|opus|haiku)\s*$/m.test(fm)) {
  errors.push("engine.model must be an exact model ID, not an alias");
}

// The golden replay workflow must run the same configuration as production
// (only 'staged: true' and the per-user rate limit may differ), or drift checks prove nothing.
const golden = readFileSync(join(repoRoot, ".github/workflows/issue-triage-golden.md"), "utf8");
const block = (src) =>
  (src.split(/^---$/m)[1] ?? "")
    .replace(/^[\s\S]*?^engine:/m, "engine:")
    .replace(/^steps:[\s\S]*$/m, "")
    .replace(/^# Per-reporter rate limit.*\nuser-rate-limit:\n(  .*\n)+/m, "")
    .replace(/^  # Golden replay never writes.*\n  staged: true\n/m, "");
if (block(wf) !== block(golden)) errors.push("issue-triage-golden.md config differs from issue-triage.md (engine/tools/network/safe-outputs)");
if (!/^  staged: true$/m.test(golden)) errors.push("issue-triage-golden.md must stage all safe outputs");

if (errors.length) {
  console.error("issue-triage config check FAILED:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`issue-triage config OK: ${allowed.length} allowed labels, ${blocked.length} blocked patterns`);
