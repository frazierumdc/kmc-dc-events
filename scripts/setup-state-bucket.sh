#!/usr/bin/env bash
# Makes the environment's memory bucket (D63) in one Google project: private, a folder per
# job, each written only by that job's account. See docs/architecture/storage.md.
#
#   scripts/setup-state-bucket.sh your-project-id-dev     # your-project-id-dev-state
#   scripts/setup-state-bucket.sh your-project-id-test    # your-project-id-test-state
#   scripts/setup-state-bucket.sh your-project-id         # your-project-id-prod-state
#
# Run after scripts/setup-mail-secrets.sh and scripts/setup-feed-secret.sh (they make
# mail-sender@ and feed-reader@). Needs gcloud signed in with Owner on the project. Safe to
# rerun. At the end it prints the GitHub setting that moves Send email's memory there.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project-id>" >&2
  exit 2
fi

PROJECT="$1"
case "$PROJECT" in
  *-dev) ENVIRONMENT=dev ;;
  *-test) ENVIRONMENT=test ;;
  *) ENVIRONMENT=prod ;;
esac
BUCKET="your-project-id-$ENVIRONMENT-state"
MAIL="serviceAccount:mail-sender@$PROJECT.iam.gserviceaccount.com"
FEED="serviceAccount:feed-reader@$PROJECT.iam.gserviceaccount.com"
OBJECTS="projects/_/buckets/$BUCKET/objects"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Project $PROJECT, bucket $BUCKET"

echo "1/4 The bucket: private, in us-east4, one set of permissions for all of it"
if ! gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location us-east4 \
    --uniform-bucket-level-access --public-access-prevention
fi

echo "2/4 Older versions kept: state.json's for 30 days"
gcloud storage buckets update "gs://$BUCKET" --versioning >/dev/null

echo "3/4 What is deleted by itself: a copy's hand-over after 7 days, older versions after 30"
cat >"$WORK/lifecycle.json" <<JSON
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 7, "matchesPrefix": ["update-schedule/runs/"] }
    },
    {
      "action": { "type": "Delete" },
      "condition": { "daysSinceNoncurrentTime": 30 }
    }
  ]
}
JSON
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file "$WORK/lifecycle.json" >/dev/null

echo "4/4 Who may do what: each job writes only its own folder"
grant() { # member, role, folder, title
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "$1" --role "$2" \
    --condition "expression=resource.name.startsWith(\"$OBJECTS/$3\"),title=$4" >/dev/null
}
# mail-sender@ reads and writes send-email/, and reads what a copy handed over.
grant "$MAIL" roles/storage.objectUser send-email/ send-email-folder
grant "$MAIL" roles/storage.objectViewer update-schedule/ read-the-copys-hand-over
# feed-reader@ reads and writes update-schedule/ only.
grant "$FEED" roles/storage.objectUser update-schedule/ update-schedule-folder

echo "Done. The jobs use it as STATE_BUCKET=$BUCKET, set by scripts/setup-update-job.sh."
