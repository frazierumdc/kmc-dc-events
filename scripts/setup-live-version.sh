#!/usr/bin/env bash
# Sets up the live record open apps listen to (NT-1, D64) in one Google project: a Realtime
# Database that holds one value, the version of the schedule last published. Anyone may read
# /live; only the site's deployer may write. See docs/architecture/infrastructure.md §The
# live version.
#
#   scripts/setup-live-version.sh your-project-id-dev
#
# Run after scripts/setup-deploy-identity.sh (it makes deployer@). Needs gcloud signed in
# with Owner on the project. Safe to rerun. At the end it prints the
# GitHub setting that switches the listener on for that stage.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project-id>" >&2
  exit 2
fi

PROJECT="$1"
DEPLOYER="deployer@$PROJECT.iam.gserviceaccount.com"
LOCATION="us-central1"
INSTANCE="$PROJECT-default-rtdb"
API="https://firebasedatabase.googleapis.com/v1beta/projects/$PROJECT/locations/$LOCATION/instances"
cd "$(dirname "$0")/.."

echo "Project $PROJECT"

echo "1/4 API: Firebase Realtime Database"
gcloud services enable firebasedatabase.googleapis.com --project "$PROJECT"

echo "2/4 The database $INSTANCE"
call() { # method, url, [body]
  curl -sS -X "$1" "$2" -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "x-goog-user-project: $PROJECT" -H "Content-Type: application/json" ${3:+-d "$3"}
}
# A newly switched-on API takes a minute or two to answer.
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  call GET "$API" | grep -q SERVICE_DISABLED || break
  sleep 15
done
if ! call GET "$API/$INSTANCE" | grep -q '"databaseUrl"'; then
  call POST "$API?databaseId=$INSTANCE" '{"type":"DEFAULT_DATABASE"}' >/dev/null
fi
URL="$(call GET "$API/$INSTANCE" | sed -n 's/.*"databaseUrl": *"\([^"]*\)".*/\1/p')"
if [[ -z "$URL" ]]; then
  echo "The database wasn't made. Make it in the Firebase console (Build → Realtime Database, locked mode) and run this again." >&2
  exit 1
fi

echo "3/4 Its rules: anyone reads /live, nobody else writes (database.rules.json)"
curl -fsS -X PUT "$URL/.settings/rules.json" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  --data-binary @database.rules.json >/dev/null

echo "4/4 $DEPLOYER may write the record"
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
  --member "serviceAccount:$DEPLOYER" --role roles/firebasedatabase.admin >/dev/null

echo "Done. To switch the listener on, set this in the stage's GitHub environment (dev, test or prod):"
echo "  LIVE_URL=$URL/live/version.json"
