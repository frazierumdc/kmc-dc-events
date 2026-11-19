#!/usr/bin/env bash
# Sets up Google Cloud's two alerts for schedule delivery (NT-8, D64) in one Google project.
# They read the check's log, so they don't depend on GitHub or the app's own email:
#
#   1. The app is behind the website: the check logged "Behind the website since …".
#      Closes by itself, with a "resolved" email, once the site matches again.
#   2. The checks stopped: no check has finished for 20 minutes.
#
#   scripts/setup-delivery-alerts.sh your-project-id-dev admin@example.org [another@example.org …]
#
# The addresses get the alerts; they are given here, never written in the repository.
# Needs gcloud signed in with Owner on the project. Safe to rerun: it replaces the two
# alerts and reuses a channel that already has the address. See docs/runbooks.md §The app
# is behind the website.

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <project-id> <email> [<email> …]" >&2
  exit 2
fi

PROJECT="$1"
shift
CHECK='resource.type="cloud_run_revision" AND resource.labels.service_name="checkwebsite"'
BEHIND="KMC DC Events: the app is behind the website"
STOPPED="KMC DC Events: the schedule checks stopped"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Project $PROJECT"

echo "1/4 API: Cloud Monitoring"
gcloud services enable monitoring.googleapis.com --project "$PROJECT"

echo "2/4 Two counts read from the check's log"
metric() { # name, description, filter
  local verb=create
  gcloud logging metrics describe "$1" --project "$PROJECT" >/dev/null 2>&1 && verb=update
  gcloud logging metrics "$verb" "$1" --project "$PROJECT" --description "$2" --log-filter "$3"
}
metric schedule_behind "Checks that found the site behind the website for 15 minutes (NT-8)" \
  "$CHECK AND severity>=ERROR AND textPayload:\"Behind the website since\""
metric schedule_checks "Checks that finished (NT-7)" \
  "$CHECK AND textPayload:\"Check: \""

echo "3/4 Who is told: one email channel per address"
CHANNELS=()
for email in "$@"; do
  channel="$(gcloud beta monitoring channels list --project "$PROJECT" \
    --filter "type=\"email\" AND labels.email_address=\"$email\"" --format 'value(name)' | head -n 1)"
  if [[ -z "$channel" ]]; then
    channel="$(gcloud beta monitoring channels create --project "$PROJECT" --type email \
      --display-name "KMC DC Events admin" --channel-labels "email_address=$email" \
      --format 'value(name)')"
  fi
  CHANNELS+=("\"$channel\"")
done
LIST="$(IFS=,; echo "${CHANNELS[*]}")"

echo "4/4 The two alerts"
cat >"$WORK/behind.json" <<JSON
{
  "displayName": "$BEHIND",
  "combiner": "OR",
  "notificationChannels": [$LIST],
  "documentation": {
    "mimeType": "text/markdown",
    "content": "The schedule on the app's site ($PROJECT) has differed from the website for 15 minutes: a change made in Wix has not been published. People may see a cancelled event or an old time. Runbook: docs/runbooks.md, The app is behind the website. This alert closes by itself when they match again."
  },
  "alertStrategy": { "autoClose": "1800s" },
  "conditions": [
    {
      "displayName": "A check found the app behind the website",
      "conditionThreshold": {
        "filter": "metric.type=\"logging.googleapis.com/user/schedule_behind\" AND resource.type=\"cloud_run_revision\"",
        "aggregations": [
          { "alignmentPeriod": "600s", "perSeriesAligner": "ALIGN_SUM", "crossSeriesReducer": "REDUCE_SUM" }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "evaluationMissingData": "EVALUATION_MISSING_DATA_INACTIVE",
        "trigger": { "count": 1 }
      }
    }
  ]
}
JSON
cat >"$WORK/stopped.json" <<JSON
{
  "displayName": "$STOPPED",
  "combiner": "OR",
  "notificationChannels": [$LIST],
  "documentation": {
    "mimeType": "text/markdown",
    "content": "No schedule check has finished in $PROJECT for 20 minutes, so a change in Wix may not reach the app, and nothing would say so. Runbook: docs/runbooks.md, The schedule checks stopped."
  },
  "alertStrategy": { "autoClose": "1800s" },
  "conditions": [
    {
      "displayName": "No check finished for 20 minutes",
      "conditionAbsent": {
        "filter": "metric.type=\"logging.googleapis.com/user/schedule_checks\" AND resource.type=\"cloud_run_revision\"",
        "aggregations": [
          { "alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_SUM", "crossSeriesReducer": "REDUCE_SUM" }
        ],
        "duration": "1200s",
        "trigger": { "count": 1 }
      }
    }
  ]
}
JSON
for name in "$BEHIND" "$STOPPED"; do
  for old in $(gcloud monitoring policies list --project "$PROJECT" \
    --filter "displayName=\"$name\"" --format 'value(name)'); do
    gcloud monitoring policies delete "$old" --project "$PROJECT" --quiet
  done
done
gcloud monitoring policies create --project "$PROJECT" --policy-from-file "$WORK/behind.json" >/dev/null
gcloud monitoring policies create --project "$PROJECT" --policy-from-file "$WORK/stopped.json" >/dev/null

echo "Done. Each address gets Google's own email when an alert opens and when it closes."
