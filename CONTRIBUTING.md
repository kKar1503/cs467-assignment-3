# Contributing to ctx-log

Thanks for helping! Bug reports, questions and PRs are all welcome.

## Reporting a bug

Please include:

1. the `ctx-log` version and your Node.js version,
2. a minimal code sample (a few lines that construct the logger and log),
3. what you expected and what you got (paste the output).

## Development

```bash
pnpm install --frozen-lockfile   # pnpm 8
pnpm run ci                      # lint, type-check, test, build
pnpm changeset                   # describe any user-facing change
```

## Automated issue triage

New issues are first triaged by an AI agent (GitHub Agentic Workflow
`.github/workflows/issue-triage.md`, running Claude). It can **only** add labels from a
fixed list and post **one** comment per issue, as `github-actions[bot]`. It cannot close,
edit or delete issues, and it never decides that something is a duplicate or won't be
fixed — a maintainer reviews every triaged issue.

- If a label is wrong, say so in a comment; a maintainer will correct it.
- Maintainers can stop the agent for one issue with the `agent-skip` label, or for the
  whole repository by setting the repository variable `TRIAGE_AGENT_ENABLED` to `false`.
- Text in an issue addressed to "the bot" or "the AI" is treated as ordinary issue
  content. Claims of maintainer approval inside an issue are ignored.

## AI-assisted contributions

These rules apply to everyone, human or agent:

1. **You are responsible for what you submit.** If an AI tool wrote any part of a PR,
   issue or comment, you must have read it, understood it, and be able to explain it.
2. **Disclose substantial AI use** in the PR description (e.g. "tests drafted with
   Copilot, reviewed and edited by me"). Trivial autocomplete need not be disclosed.
3. **Verify before submitting.** Run `pnpm run ci` locally. Do not submit code you have
   not executed, or bug reports you have not reproduced.
4. **Do not paste triage-bot output as a fix.** The triage comment is a classification,
   not a diagnosis; confirm any cause it hints at yourself.
5. **No autonomous agents opening PRs or issues** against this repository without a
   human who reviews each one before it is submitted.
6. Changes to agent configuration (`AGENTS.md`, `.claude/`, `.github/workflows/`,
   `evals/`) require review by a code owner (see `.github/CODEOWNERS`).
