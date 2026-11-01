#!/usr/bin/env bash
# Open every golden case as a real issue in the sandbox repo, in case order, and record
# case-id -> issue-number in issue-map.json. Waits between issues so each triage run
# sees the previous issues in its snapshot (as in real life).
#   REPO=owner/name ./evals/golden/open-issues.sh [first-case-order] [last-case-order]
set -euo pipefail
cd "$(dirname "$0")"
: "${REPO:?set REPO=owner/name}"
from=${1:-1}; to=${2:-99}
[ -f issue-map.json ] || echo '{}' > issue-map.json
for f in $(ls cases/*.json | sort); do
  order=$(jq -r .order "$f"); id=$(jq -r .id "$f")
  { [ "$order" -lt "$from" ] || [ "$order" -gt "$to" ]; } && continue
  labels=$(jq -r '.issue.labels | join(",")' "$f")
  url=$(gh issue create -R "$REPO" --title "$(jq -r .issue.title "$f")" --body "$(jq -r .issue.body "$f")" ${labels:+--label "$labels"})
  num=${url##*/}
  jq --arg id "$id" --argjson n "$num" '. + {($id): $n}' issue-map.json > issue-map.tmp && mv issue-map.tmp issue-map.json
  echo "$id -> #$num"
  sleep "${DELAY:-90}"
done
