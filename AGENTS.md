# AGENTS.md — ctx-log

Repository facts for AI agents (and humans). Procedures live in skills under
`.claude/skills/`; hard limits live in workflow permissions and safe outputs under
`.github/workflows/`. This file does not grant or restrict anything by itself.

## What this repository is

`ctx-log` is a zero-dependency, zerolog-inspired JSON context logger for Node.js,
written in TypeScript and published to npm as `ctx-log` (MIT). This repository is a
sandbox copy (snapshot of v0.0.7) used to evaluate an issue-triage agent; npm
publishing is removed here.

## Build and test

Use **pnpm 8** (the lockfile is v6 format; pnpm 9+ refuses it) and Node 20.

| Task | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Unit tests (vitest) | `pnpm test` |
| Lint + type-check | `pnpm run lint` (eslint 8 + `tsc`) |
| Build (tsup → `dist/`, CJS + ESM + d.ts) | `pnpm run build` |
| Everything CI runs | `pnpm run ci` |
| Triage skill script tests | `node --test .claude/skills/issue-triage/scripts/*.test.mjs` |
| Triage config consistency | `node .claude/skills/issue-triage/scripts/check-config.mjs` |
| Recompile the agentic workflow | `gh aw compile issue-triage` (gh-aw v1.0.1) |

## Project structure

```
src/index.ts            public API: global-logger helpers, re-exports
src/log/logger.ts       Logger class, global logger init, level filtering, Output/With/Hooks
src/log/level.ts        TLevel type, ParseLevel, GetLevelNumber (level ordering)
src/log/event.ts        Event: typed field appenders, Msg/Send, hooks, Fatal exit
src/log/context.ts      Context builder returned by Logger.With()
src/log/writer.ts       IWriter, ILevelWriter, LevelWriterAdapter, MultiLevelWriter, FilteredLevelWriter
src/log/hook.ts         Hook, HookFunc, LevelHook
src/writers/            StdoutWriter, DiscardWriter, ConsoleWriter (pretty dev output)
src/json/append.ts      low-level JSON byte encoding (+ append.test.ts, the only test file)
src/consts/             level names, field names, ANSI colours
.changeset/             changesets config; every user-facing change needs a changeset
.claude/skills/         agent skills (issue-triage)
.github/workflows/      CI (main.yml) and agentic workflows (*.md + compiled *.lock.yml)
evals/golden/           frozen triage cases, expected outcomes, results
```

## Conventions

- TypeScript strict mode; public methods are PascalCase (Go-style API mirroring zerolog).
- Levels are strings (`"trace"` … `"fatal"`, `""`, `"disabled"`); compare them only via
  `GetLevelNumber`, never with `<`/`>` on the strings.
- Relative imports inside `src/` use the `.js` suffix for runtime imports.
- Prettier + eslint config in `.eslintrc.json`; do not reformat unrelated code.
- Conventional-commit style messages (`feat:`, `fix:`, `chore:`, `docs:`).
- Issue labels: one type (`bug`, `enhancement`, `question`, `documentation`), up to two
  `area/*`, plus status labels — defined in `.claude/skills/issue-triage/labels.json`.

## Forbidden changes (for any agent)

- Do not edit `.github/workflows/*.lock.yml` by hand; edit the `.md` and recompile.
- Do not widen permissions, safe outputs, network allowlists or the model ID in
  `.github/workflows/issue-triage.md` without a maintainer-approved PR (see CODEOWNERS).
- Do not add runtime dependencies to `package.json` (zero-dependency is a feature).
- Do not edit `CHANGELOG.md` directly; changesets generate it.
- Do not modify `evals/golden/cases/*` or `expected.json` to make a failing case pass.
- Do not close, delete, lock or transfer issues, merge PRs, or force-push. (The triage
  workflow cannot do these; this line is for interactive agents.)
