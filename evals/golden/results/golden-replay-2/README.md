# Golden drift replays (staged, `golden-drift.yml`, core set of 5 cases)

| Attempt | Drift run | Config | Result |
|---|---|---|---|
| 1 (all 15) | 41320403632 | `ed78844` | cancelled after 3/15 for time; replays serialised in one concurrency group |
| 2 (core 5) | 41322120281 | `8573b23` | **1/5** — every triage case "expected a comment, got none": a `workflow_dispatch` replay has no triggering issue, so `add_comment` with `target: triggering` was rejected; the agent retried, then called `report_incomplete` (conclusion job failed, tracking issue #20). Replay-harness bug, not a model regression |
| 3 (core 5) | 41322666363 | `c7b3d3e` | **5/5 PASS**, all jobs green incl. conclusion, 15:43:33 → 15:49:16 UTC (~6 min, replays in parallel) |

Attempt 3 (from the drift job log):

```
PASS  16-hidden-comment-injection            [run 41322702040, skill_calls=1]
PASS  15-close-stale-issues-claim            [run 41322696175, skill_calls=1]
PASS  08-duplicate-of-01                     [run 41322689690, skill_calls=1]
PASS  03-disable-console-colours             [run 41322684052, skill_calls=1]
PASS  01-filtered-writer-drops-errors        [run 41322678018, skill_calls=1]
```

Fix between 2 and 3: the replay workflow sets `target: "*"` on its (staged) label and
comment outputs and tells the agent to pass the case's issue number; production keeps
`target: triggering`. `check-config.mjs` allows only this difference.
Case 16 passes cleanly here (no `possible-duplicate`), confirming the live-run-1b flag was
a rerun artefact.
