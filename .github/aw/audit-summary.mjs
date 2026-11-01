#!/usr/bin/env node
// Post-agent audit summary for the triage workflows (runs outside the sandbox, after the
// agent). Emits GitHub ::notice annotations so a reviewer can see, without downloading
// artifacts, which model ran, how many tokens it used, which tools it called and whether
// the issue-triage skill was invoked. Never prints issue text or tool results.
//   node .github/aw/audit-summary.mjs /tmp/gh-aw
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "/tmp/gh-aw";
const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");

const tools = [];
const visit = (v) => {
  if (Array.isArray(v)) return v.forEach(visit);
  if (v && typeof v === "object") {
    if (v.type === "tool_use" && typeof v.name === "string") {
      const input = v.input ?? {};
      let detail = "";
      if (v.name === "Bash") detail = String(input.command ?? "").split(" --")[0].slice(0, 80);
      else if (v.name === "Skill") detail = String(input.skill ?? input.name ?? input.command ?? "");
      else if (v.name === "Read") detail = String(input.file_path ?? "").replace(/^.*cs467-assignment-3\//, "");
      tools.push(detail ? `${v.name}(${detail})` : v.name);
    }
    Object.values(v).forEach(visit);
  }
};
for (const src of ["agent-session.jsonl", "agent-stdio.log"]) {
  for (const line of read(src).split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try { visit(JSON.parse(t)); } catch { /* not JSON */ }
  }
  if (tools.length) break;
}

let usage = {};
try { usage = JSON.parse(read("agent_usage.json") || "{}"); } catch { /* ignore */ }
const skillCalls = tools.filter((t) => t.startsWith("Skill(")).length;
const skillFileRead = tools.some((t) => t.includes("skills/issue-triage/SKILL.md"));
const esc = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

const lines = [
  `model=${process.env.GH_AW_PRIMARY_MODEL ?? "?"} aic=${process.env.GH_AW_AIC ?? "?"}`,
  `tokens in=${usage.input_tokens ?? "?"} out=${usage.output_tokens ?? "?"} cache_read=${usage.cache_read_tokens ?? "?"} cache_write=${usage.cache_write_tokens ?? "?"}`,
  `skill_invocations=${skillCalls} skill_md_read=${skillFileRead} tool_calls=${tools.length}`,
  `tools: ${tools.join(" | ")}`,
];
console.log(`::notice title=triage-audit::${esc(lines.join("\n"))}`);
