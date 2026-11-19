#!/usr/bin/env bash
# Sets up what the Wix signal (D28, slice 1.9) needs in one Google project: its own account,
# its secret, Cloud Tasks for its checks, and what Deploy functions needs to deploy it. See
# docs/architecture/infrastructure.md §The Wix signal.
#
#   scripts/setup-wix-signal.sh your-project-id-dev
#   scripts/setup-wix-signal.sh your-project-id-test
#   scripts/setup-wix-signal.sh your-project-id
#
# Run after scripts/setup-functions-deploy.sh and scripts/setup-feed-secret.sh (they make
# functions-deployer@ and WIX_FEED_TOKEN). Needs gcloud signed in with
# Owner on the project. Safe to rerun. Makes the signal secret once, from random bytes, and
# never prints it: copy it into Wix Secrets Manager with
#   gcloud secrets versions access latest --secret WIX_SIGNAL_SECRET --project <project> | pbcopy

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project-id>" >&2
  exit 2
fi

PROJECT="$1"
SIGNAL="wix-signal@$PROJECT.iam.gserviceaccount.com"
DEPLOYER="functions-deployer@$PROJECT.iam.gserviceaccount.com"
SECRET="WIX_SIGNAL_SECRET"

echo "Project $PROJECT"

echo "1/5 API: Cloud Tasks"
gcloud services enable cloudtasks.googleapis.com --project "$PROJECT"

echo "2/5 $SIGNAL runs the Wix signal's two functions"
if ! gcloud iam service-accounts describe "$SIGNAL" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create wix-signal --project "$PROJECT" \
    --display-name "Wix signal: reads its two secrets, enqueues its checks"
fi

echo "3/5 The secret $SECRET, made once, never printed"
if ! gcloud secrets describe "$SECRET" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud secrets create "$SECRET" --project "$PROJECT" --replication-policy automatic >/dev/null
  openssl rand -hex 32 | tr -d '\n' |
    gcloud secrets versions add "$SECRET" --data-file=- --project "$PROJECT" >/dev/null
fi

echo "4/5 $SIGNAL reads only its two secrets and enqueues its own checks"
for secret in "$SECRET" WIX_FEED_TOKEN; do
  gcloud secrets add-iam-policy-binding "$secret" --project "$PROJECT" --quiet \
    --member "serviceAccount:$SIGNAL" --role roles/secretmanager.secretAccessor >/dev/null
done
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
  --member "serviceAccount:$SIGNAL" --role roles/cloudtasks.enqueuer >/dev/null
# A check is sent as a task signed as wix-signal@ itself.
gcloud iam service-accounts add-iam-policy-binding "$SIGNAL" --project "$PROJECT" --quiet \
  --member "serviceAccount:$SIGNAL" --role roles/iam.serviceAccountUser >/dev/null

echo "5/5 $DEPLOYER may make the task queue and run functions as $SIGNAL"
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
  --member "serviceAccount:$DEPLOYER" --role roles/cloudtasks.queueAdmin >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$SIGNAL" --project "$PROJECT" --quiet \
  --member "serviceAccount:$DEPLOYER" --role roles/iam.serviceAccountUser >/dev/null

echo
echo "Done. Next: Deploy functions on the project's branch; the signal's address is then"
echo "  https://us-east4-$PROJECT.cloudfunctions.net/wixSignal"
