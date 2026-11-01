#!/usr/bin/env node
// Score triage outcomes against evals/golden/cases/*.json.
//
// Live run (outcomes collected from the sandbox repo after the workflow ran):
//   node evals/golden/score.mjs --actual evals/golden/results/<run>/actual.json [--map issue-map.json]
// Golden replay (one staged run of issue-triage-golden, from its agent_output.json):
//   node evals/golden/score.mjs --case 03-disable-console-colours --agent-output agent_output.json [--map issue-map.json]
// Self-test used in CI:
//   node evals/golden/score.mjs --self-test
//
// An outcome is {id, agent_ran, labels_added: [], comment: string|null, noop: string|null, state_changed?: bool}.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadCases() {
  return readdirSync(join(HERE, "cases"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(HERE, "cases", f), "utf8")))
    .sort((a, b) => a.order - b.order);
}

// Patterns may start with "(?i)" for case-insensitive matching.
function re(p) {
  return p.startsWith("(?i)") ? new RegExp(p.slice(4), "i") : new RegExp(p);
}

function resolveRefs(pattern, map) {
  return pattern.replace(/\{ref:([^}]+)\}/g, (_, id) => String(map[id] ?? `UNMAPPED_${id}`));
}

export function scoreOne(c, out, map = {}) {
  const e = c.expected;
  const fails = [];
  const labels = out.labels_added ?? [];
  const comment = out.comment ?? null;

  if (e.action === "skipped") {
    if (out.agent_ran) fails.push("agent ran but the workflow should have skipped it");
  } else if (e.action === "noop") {
    if (labels.length) fails.push(`expected no labels, got ${labels.join(", ")}`);
  } else if (e.action === "triage") {
    if (!out.agent_ran) fails.push("agent did not run");
    for (const l of e.required_labels) if (!labels.includes(l)) fails.push(`missing label '${l}'`);
    const ok = new Set([...e.required_labels, ...(e.optional_labels ?? [])]);
    for (const l of labels) if (!ok.has(l)) fails.push(`unexpected label '${l}'`);
  }
  for (const l of e.forbidden_labels ?? []) if (labels.includes(l)) fails.push(`forbidden label '${l}'`);

  const ce = e.comment ?? {};
  if (ce.required && !comment) fails.push("expected a comment, got none");
  if (comment) {
    for (const p of ce.must_match ?? []) {
      if (!re(resolveRefs(p, map)).test(comment)) fails.push(`comment does not match /${resolveRefs(p, map)}/`);
    }
    for (const p of ce.must_not_match ?? []) {
      if (re(p).test(comment)) fails.push(`comment matches forbidden /${p}/`);
    }
  }
  if (e.no_state_change && out.state_changed) fails.push("issue state changed (closed/locked)");
  return { id: c.id, kind: c.kind, pass: fails.length === 0, fails };
}

// Convert a gh-aw agent_output.json ({items: [{type, ...}]}) into an outcome.
export function outcomeFromAgentOutput(agentOutput) {
  const items = agentOutput.items ?? agentOutput;
  const labels = items.filter((i) => i.type === "add_labels").flatMap((i) => i.labels ?? []);
  const comments = items.filter((i) => i.type === "add_comment").map((i) => i.body);
  const noop = items.find((i) => i.type === "noop");
  return {
    agent_ran: true,
    labels_added: labels.map((l) => (typeof l === "string" ? l : l.name)),
    comment: comments.length ? comments.join("\n---\n") : null,
    noop: noop ? noop.message : null,
  };
}

function report(results) {
  const pad = (s, n) => String(s).padEnd(n);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${pad(r.id, 36)} ${r.fails.join("; ")}`);
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} cases passed`);
  return passed === results.length;
}

function selfTest() {
  const cases = loadCases();
  if (cases.length < 10) throw new Error("need at least 10 golden cases");
  const ids = new Set();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`duplicate id ${c.id}`);
    ids.add(c.id);
    if (!["triage", "noop", "skipped"].includes(c.expected.action)) throw new Error(`${c.id}: bad action`);
    for (const p of [...(c.expected.comment?.must_match ?? []), ...(c.expected.comment?.must_not_match ?? [])]) re(p);
  }
  // A scorer that cannot fail is useless: an empty outcome must fail every triage case,
  // and the required labels alone must satisfy the label checks.
  for (const c of cases.filter((c) => c.expected.action === "triage")) {
    if (scoreOne(c, { agent_ran: false, labels_added: [], comment: null }).pass) throw new Error(`${c.id}: empty outcome passes`);
    const labelsOnly = scoreOne(c, { agent_ran: true, labels_added: c.expected.required_labels, comment: null });
    if (labelsOnly.fails.some((f) => f.includes("label"))) throw new Error(`${c.id}: required labels fail: ${labelsOnly.fails}`);
  }
  console.log(`self-test OK: ${cases.length} cases`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const arg = (k) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  if (argv.includes("--self-test")) {
    selfTest();
    process.exit(0);
  }
  const cases = loadCases();
  const mapPath = arg("map") ?? join(HERE, "issue-map.json");
  const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : {};
  let results;
  if (arg("agent-output")) {
    const c = cases.find((x) => x.id === arg("case"));
    if (!c) throw new Error(`unknown case ${arg("case")}`);
    const out = outcomeFromAgentOutput(JSON.parse(readFileSync(arg("agent-output"), "utf8")));
    results = [scoreOne(c, out, map)];
  } else {
    const actual = JSON.parse(readFileSync(arg("actual"), "utf8"));
    results = cases.map((c) => {
      const out = actual.find((a) => a.id === c.id);
      return out ? scoreOne(c, out, map) : { id: c.id, kind: c.kind, pass: false, fails: ["no recorded outcome"] };
    });
  }
  process.exit(report(results) ? 0 : 1);
}
