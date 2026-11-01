#!/usr/bin/env node
// Check whether an issue contains the details a ctx-log bug report needs.
//
//   node check-report.mjs --issue issue.json
//
// Pure pattern matching; the model decides whether the issue is a bug report
// at all and therefore whether missing fields matter.
import { readJson, labelNames, parseArgs, emit } from "./lib.mjs";

const CHECKS = {
  ctxLogVersion: /ctx-log[^\n]{0,20}?\d+\.\d+\.\d+|"ctx-log"\s*:\s*"[^"]+"|\bversion\b[^\n]{0,20}\d+\.\d+\.\d+|\bv?0\.0\.\d+\b/i,
  nodeVersion: /\bnode(\.js)?\s*(version)?\s*[:=]?\s*v?\d+(\.\d+)*|\bv(1[4-9]|2\d)\.\d+/i,
  codeSample: /```[\s\S]+?```|^( {4}|\t)\S/m,
  expectedVsActual: /\bexpected\b[\s\S]*\b(actual|instead|but|got|only)\b|\b(actual|instead|but|only)\b[\s\S]*\bexpected\b/i,
  errorOutput: /\b(error|exception|stack|traceback|TypeError|ERR_[A-Z_]+)\b|^\s+at\s+\S+/im,
};

export function checkReport(issue) {
  const text = `${issue.title ?? ""}\n${(issue.body ?? "").replace(/<!--[\s\S]*?-->/g, "")}`;
  const present = {};
  for (const [k, re] of Object.entries(CHECKS)) present[k] = re.test(text);
  const bodyChars = (issue.body ?? "").trim().length;
  return {
    issue: issue.number,
    author: issue.author ?? issue.user?.login,
    authorAssociation: issue.author_association,
    existingLabels: labelNames(issue),
    bodyChars,
    present,
    missingForBugReport: Object.entries(present)
      .filter(([k, v]) => !v && k !== "errorOutput")
      .map(([k]) => k),
    hasHiddenHtmlComment: /<!--[\s\S]*?-->/.test(issue.body ?? ""),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.issue !== "string") {
    emit({ error: "usage: --issue <issue.json>" });
    process.exit(2);
  }
  emit(checkReport(readJson(args.issue)));
}
