#!/usr/bin/env bash
# Sets up one environment's Wix feed token in its own Google project's Secret Manager (D61), so
# the update job and the check read it there, and no GitHub secret or file holds it. See
# docs/runbooks.md §Rotate the feed token.
#
#   scripts/setup-feed-secret.sh your-project-id-dev
#   scripts/setup-feed-secret.sh your-project-id-test
#   scripts/setup-feed-secret.sh your-project-id
#
# Needs gcloud signed in with Owner on the project. Safe to rerun. Stores no token: the secret starts empty, and the owner adds the token
# with `pbpaste | gcloud secrets versions add WIX_FEED_TOKEN --data-file=- --project <project>`.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project-id>" >&2
  exit 2
fi

PROJECT="$1"
READER="feed-reader@$PROJECT.iam.gserviceaccount.com"
SECRET="WIX_FEED_TOKEN"

echo "Project $PROJECT"

echo "1/3 API: Secret Manager"
gcloud services enable secretmanager.googleapis.com --project "$PROJECT"

echo "2/3 $READER reads the feed token, nothing else"
if ! gcloud iam service-accounts describe "$READER" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create feed-reader --project "$PROJECT" \
    --display-name "Update schedule: reads the Wix feed token"
fi

echo "3/3 The secret $SECRET, empty until the owner adds the token"
if ! gcloud secrets describe "$SECRET" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET" --project "$PROJECT" --replication-policy automatic >/dev/null
fi
gcloud secrets add-iam-policy-binding "$SECRET" --project "$PROJECT" --quiet \
  --member "serviceAccount:$READER" --role roles/secretmanager.secretAccessor >/dev/null

echo
echo "Next: the owner adds the token (in zsh, the token on the clipboard):"
echo "  pbpaste | gcloud secrets versions add $SECRET --data-file=- --project $PROJECT"
echo "Then scripts/setup-update-job.sh: the update job runs as $READER."
