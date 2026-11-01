#!/usr/bin/env node
// Validate a proposed label set before the agent calls add_labels.
//
//   node validate-labels.mjs --labels "bug,area/writers" [--existing "needs-info"]
//
// Prints {"ok": bool, "labels": [...], "errors": [...]} and exits 1 when the
// set breaks a rule. This is a pre-check only: the hard limit is the
// safe-outputs.add-labels allowlist in .github/workflows/issue-triage.md.
import { loadLabelConfig, agentMayApply, parseArgs, emit } from "./lib.mjs";

export function validateLabels(proposed, existing = [], cfg = loadLabelConfig()) {
  const errors = [];
  const allowed = new Set(agentMayApply(cfg));
  const labels = [...new Set(proposed.map((l) => l.trim()).filter(Boolean))];

  for (const l of labels) {
    if (cfg.maintainerOnly.includes(l)) {
      errors.push(`'${l}' is maintainer-only`);
    } else if (!allowed.has(l)) {
      errors.push(`'${l}' is not a triage label (see labels.json)`);
    }
  }

  const final = [...new Set([...existing, ...labels])];
  const types = final.filter((l) => l in cfg.type);
  const areas = final.filter((l) => l in cfg.area);
  if (types.length > cfg.limits.maxTypeLabels) {
    errors.push(`at most ${cfg.limits.maxTypeLabels} type label allowed, got ${types.join(", ")}`);
  }
  if (areas.length > cfg.limits.maxAreaLabels) {
    errors.push(`at most ${cfg.limits.maxAreaLabels} area labels allowed, got ${areas.join(", ")}`);
  }
  if (labels.length > cfg.limits.maxLabelsPerIssue) {
    errors.push(`at most ${cfg.limits.maxLabelsPerIssue} labels per run, got ${labels.length}`);
  }
  if (labels.includes("possible-duplicate") && labels.includes("needs-info")) {
    errors.push("use either possible-duplicate or needs-info, not both");
  }

  return { ok: errors.length === 0, labels, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.labels !== "string") {
    emit({ ok: false, labels: [], errors: ["--labels is required"] });
    process.exit(2);
  }
  const split = (s) => (typeof s === "string" ? s.split(",") : []);
  const result = validateLabels(split(args.labels), split(args.existing).map((s) => s.trim()));
  emit(result);
  process.exit(result.ok ? 0 : 1);
}
