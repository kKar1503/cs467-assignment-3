#!/usr/bin/env bash
# usage: check.sh <issue-number>  -- waits for the triage run triggered after the issue, then reports
A=https://api.github.com/repos/kKar1503/cs467-assignment-3
n=$1
created=$(curl -sS $A/issues/$n | jq -r .created_at)
rid=""
for i in $(seq 1 60); do
  rid=$(curl -sS "$A/actions/workflows/issue-triage.lock.yml/runs?per_page=30" | jq -r --arg c "$created" '[.workflow_runs[] | select(.created_at >= $c)] | sort_by(.created_at) | .[0].id // empty')
  [ -n "$rid" ] && break; sleep 10
done
until [ "$(curl -sS $A/actions/runs/$rid | jq -r .status)" = completed ]; do sleep 15; done
echo "issue #$n run $rid: $(curl -sS $A/actions/runs/$rid | jq -r .conclusion)"
curl -sS $A/actions/runs/$rid/jobs | jq -r '.jobs[] | "  \(.name)=\(.conclusion)"' | tr '\n' ' '; echo
aj=$(curl -sS $A/actions/runs/$rid/jobs | jq -r '.jobs[] | select(.name=="agent") | .id')
[ -n "$aj" ] && curl -sS "$A/check-runs/$aj/annotations" | jq -r '.[] | select(.title=="triage-audit") | .message'
echo "labels: $(curl -sS $A/issues/$n | jq -c '[.labels[].name]') state=$(curl -sS $A/issues/$n | jq -r '.state+" locked="+(.locked|tostring)')"
curl -sS $A/issues/$n/comments | jq -r '.[] | select(.user.login=="github-actions[bot]") | .body' | sed '/^> 🤖/,$d'
