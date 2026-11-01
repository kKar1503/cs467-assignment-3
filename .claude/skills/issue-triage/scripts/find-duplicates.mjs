#!/usr/bin/env node
// Deterministic duplicate search over a snapshot of existing issues.
//
//   node find-duplicates.mjs --issue issue.json --corpus existing-issues.json [--top 3] [--threshold 0.15]
//
// Scores every earlier issue by TF-IDF cosine similarity of title (weighted x3)
// plus body. Only issues created BEFORE the target issue are considered, so a
// replay of a historical case never sees later reports.
//
// Output deliberately contains only number, title, state and score: the bodies
// of other issues are untrusted text and are never passed back to the model.
import { readJson, parseArgs, emit } from "./lib.mjs";

const STOP = new Set(
  (
    "a an and are as at be but by can could do does doesn't for from has have how i if in into is it its " +
    "me my not of on or so that the then there this to was we were what when where which while who why " +
    "will with would you your using use used get gets got also just still any all some only when after " +
    "before should expected actual behaviour behavior issue problem please thanks hi hello ctx log ctx-log " +
    "logger version node steps reproduce repro"
  ).split(/\s+/),
);

export function tokenize(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/<!--[\s\S]*?-->/g, " ") // hidden HTML comments are not evidence
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t));
}

function termFreq(issue) {
  const tf = new Map();
  const add = (t, w) => tf.set(t, (tf.get(t) ?? 0) + w);
  for (const t of tokenize(issue.title)) add(t, 3);
  for (const t of tokenize(issue.body)) add(t, 1);
  return tf;
}

function cosine(a, b, idf) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, w] of a) {
    const x = w * (idf.get(t) ?? 0);
    na += x * x;
    if (b.has(t)) dot += x * b.get(t) * (idf.get(t) ?? 0);
  }
  for (const [t, w] of b) {
    const y = w * (idf.get(t) ?? 0);
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function findDuplicates(issue, corpus, { top = 3, threshold = 0.15 } = {}) {
  const created = Date.parse(issue.created_at ?? "9999-01-01");
  const earlier = corpus.filter(
    (c) =>
      c.number !== issue.number &&
      !c.is_pull_request &&
      Date.parse(c.created_at ?? "0") < created,
  );
  const docs = [issue, ...earlier].map(termFreq);
  const df = new Map();
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + docs.length / n)]));

  const target = docs[0];
  return earlier
    .map((c, i) => ({
      number: c.number,
      title: String(c.title ?? "").slice(0, 120),
      state: c.state,
      score: Math.round(cosine(target, docs[i + 1], idf) * 1000) / 1000,
    }))
    .filter((r) => r.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .slice(0, top);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.issue !== "string" || typeof args.corpus !== "string") {
    emit({ error: "usage: --issue <issue.json> --corpus <existing-issues.json>" });
    process.exit(2);
  }
  const issue = readJson(args.issue);
  const corpus = readJson(args.corpus);
  const candidates = findDuplicates(issue, corpus, {
    top: Number(args.top ?? 3),
    threshold: Number(args.threshold ?? 0.15),
  });
  emit({
    issue: issue.number,
    searched: corpus.length,
    threshold: Number(args.threshold ?? 0.15),
    candidates,
    note: "Scores are lexical similarity, not proof. Read the titles and decide; never label possible-duplicate below 0.35.",
  });
}
