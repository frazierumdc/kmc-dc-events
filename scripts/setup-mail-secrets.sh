#!/usr/bin/env bash
# Sets up one environment's Gmail sign-in in its own Google project's Secret Manager (D60), so
# the send-email job reads it there as mail-sender@, and no file holds it. See
# docs/architecture/email.md §Setup.
#
#   scripts/setup-mail-secrets.sh your-project-id-dev
#   scripts/setup-mail-secrets.sh your-project-id-test
#   scripts/setup-mail-secrets.sh your-project-id
#
# Needs gcloud signed in with Owner on the project. Safe to rerun. Stores no secret: the
# secrets start empty, and `pnpm mail:authorize <project-id>` fills them. Nothing is read from
# or written to GitHub (D57). Not run since that change: untested until its first real use.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project-id>" >&2
  exit 2
fi

PROJECT="$1"
SENDER="mail-sender@$PROJECT.iam.gserviceaccount.com"
SECRETS=(GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET GMAIL_REFRESH_TOKEN)

echo "Project $PROJECT"

echo "1/3 APIs: Gmail, Cloud Identity (groups), Secret Manager"
gcloud services enable gmail.googleapis.com cloudidentity.googleapis.com \
  secretmanager.googleapis.com --project "$PROJECT"

echo "2/3 $SENDER reads the Gmail sign-in, nothing else"
if ! gcloud iam service-accounts describe "$SENDER" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create mail-sender --project "$PROJECT" \
    --display-name "Send email: reads the Gmail sign-in"
fi

echo "3/3 The secrets ${SECRETS[*]}, empty until signed in"
for name in "${SECRETS[@]}"; do
  if ! gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$name" --project "$PROJECT" --replication-policy automatic >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$name" --project "$PROJECT" --quiet \
    --member "serviceAccount:$SENDER" --role roles/secretmanager.secretAccessor >/dev/null
done

echo
echo "Next, in zsh, sign the sending account in (the send-email job does not exist yet, so name it):"
echo "  pnpm mail:authorize $PROJECT --from <sending address> --new-client"
echo "Then make the jobs, giving the same account as the send-email job's own setting:"
echo "  PUBLIC_BASE_URL=<the site's public address> MAIL_FROM='<name> <sending address>' \\"
echo "    scripts/setup-update-job.sh $PROJECT <branch>"
echo "The send-email job runs as $SENDER."
