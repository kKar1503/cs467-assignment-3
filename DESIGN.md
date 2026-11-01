# DESIGN — AI first-pass issue triage for ctx-log

## 1. Workflow and why an agent

Project: `ctx-log`, my zero-dependency TypeScript JSON logger (npm, MIT), copied as a
sandbox into this repo (snapshot v0.0.7, npm publishing removed). Workflow: **first-pass
triage of new issues** — one type label, ≤2 area labels, a duplicate hint, a request for
missing details, and one short reply.

**Measured need.** Over the repo's lifetime (2024-02-23 → 2024-02-26, git log + GitHub)
there are 56 commits, 1 human author, 0 issues and 6 PRs, all opened by the changeset
release bot. So time-to-first-response and backlog are **not measurable**: the metric is
undefined with n=0, and a 4-day-old library says nothing about steady-state load. I argue
the need from the workflow instead: the project has a single maintainer, so every
issue's first response waits for that one person, and triage is pure overhead before any
fix. Limitation: this is a design argument, not evidence of demand.

**Why an agent, not rules.** A path/keyword labeler cannot (a) tell a usage question from
a bug when both mention `ConsoleWriter`, (b) decide whether missing details matter for
*this* report, (c) map a symptom ("errors disappear") to `FilteredLevelWriter` by reading
the code, or (d) write a reply. Everything that does *not* need judgement is a script:
label validation, duplicate ranking, completeness checks (`.claude/skills/issue-triage/scripts/`).

## 2. Architecture (where each rule is enforced)

| Concern | Lives in | Enforced by |
|---|---|---|
| Repo facts, commands, forbidden changes | `AGENTS.md` | reviewers (advisory) |
| Triage procedure, label meanings, comment template | `.claude/skills/issue-triage/SKILL.md` | model (loaded via `Skill` tool) |
| Label allowlist / limits, one comment | `safe-outputs` in `.github/workflows/issue-triage.md` | gh-aw `safe_outputs` job |
| No close / edit / delete / merge / push | absence of those safe outputs + read-only agent token | GitHub token scopes |
| Network, tools | `network: allowed: []`, `github: false`, bash allowlist | AWF firewall, Claude `--allowed-tools` |
| Config drift between prod and replay | `scripts/check-config.mjs` | CI (`main.yml`) |
| AI-contribution rules for humans | `CONTRIBUTING.md` | CODEOWNERS review |

Flow: `issues.opened` → pre-activation (role, rate-limit, stop-after, kill switch) →
deterministic step snapshots the issue + all other issues to files → agent (Claude Code,
read-only, no GitHub tools) runs the skill → threat-detection job → `safe_outputs` job
(the only job with `issues: write`) validates and applies labels/comment.

RESULTS_PLACEHOLDER
