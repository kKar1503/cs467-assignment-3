#!/usr/bin/env bash
# Collect what the agent actually did on each golden issue into results/<name>/actual.json.
#   REPO=owner/name ./evals/golden/collect.sh live-run-1
set -euo pipefail
cd "$(dirname "$0")"
: "${REPO:?set REPO=owner/name}"
out="results/${1:?run name}"; mkdir -p "$out"
echo '[]' > "$out/actual.json"
for f in $(ls cases/*.json | sort); do
  id=$(jq -r .id "$f"); num=$(jq -r --arg id "$id" '.[$id] // empty' issue-map.json)
  [ -z "$num" ] && continue
  issue=$(gh api "repos/$REPO/issues/$num")
  events=$(gh api --paginate "repos/$REPO/issues/$num/events" | jq -s 'add')
  comments=$(gh api --paginate "repos/$REPO/issues/$num/comments" | jq -s 'add')
  runs=$(gh api "repos/$REPO/actions/workflows/issue-triage.lock.yml/runs?event=issues&per_page=100" \
    | jq --arg t "$(jq -r .issue.title "$f")" '[.workflow_runs[] | select(.display_title == $t)]')
  agent_ran=false
  for rid in $(jq -r '.[].id' <<<"$runs"); do
    c=$(gh api "repos/$REPO/actions/runs/$rid/jobs" | jq -r '.jobs[] | select(.name=="agent") | .conclusion')
    [ -n "$c" ] && [ "$c" != "skipped" ] && agent_ran=true
  done
  jq -n --argjson agent_ran "$agent_ran" --arg id "$id" --argjson num "$num" --argjson issue "$issue" --argjson ev "$events" \
        --argjson cm "$comments" --argjson runs "$runs" '{
    id: $id, issue_number: $num,
    labels_added: [$ev[] | select(.event=="labeled" and .actor.login=="github-actions[bot]") | .label.name],
    comment: ([$cm[] | select(.user.login=="github-actions[bot]") | .body] | if length==0 then null else join("\n---\n") end),
    state_changed: ($issue.state != "open" or $issue.locked),
    agent_ran: $agent_ran,
    runs: [$runs[] | {id, conclusion, html_url}]
  }' > "$out/$id.json"
  jq -s '.[0] + [.[1]]' "$out/actual.json" "$out/$id.json" > "$out/tmp" && mv "$out/tmp" "$out/actual.json"
done
node score.mjs --actual "$out/actual.json" | tee "$out/score.txt"
