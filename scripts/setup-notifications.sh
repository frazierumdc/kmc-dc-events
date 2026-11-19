#!/usr/bin/env bash
# Sets up notifications (D65, slice 1.12) in one Google project: the messaging service's
# APIs, the app's registration as a Firebase web app, the stage's own web push key pair,
# and notify-lists@, the account the notifyLists function runs as, which may only manage the
# service's lists, and lets feed-reader@, the update job's account, send notifications. See
# docs/architecture/infrastructure.md §Notifications.
#
#   scripts/setup-notifications.sh your-project-id-dev
#
# Run after scripts/setup-functions-deploy.sh (it makes functions-deployer@) and
# scripts/setup-deploy-identity.sh (deployer@). Needs gcloud, openssl and the Firebase CLI
# signed in with Owner on the project. Safe to rerun: the key pair is made once and never
# replaced, as phones that turned notifications on are signed up with it.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project-id>" >&2
  exit 2
fi

PROJECT="$1"
ACCOUNT="notify-lists@$PROJECT.iam.gserviceaccount.com"
FUNCTIONS_DEPLOYER="functions-deployer@$PROJECT.iam.gserviceaccount.com"
DEPLOYER="deployer@$PROJECT.iam.gserviceaccount.com"
SENDER="feed-reader@$PROJECT.iam.gserviceaccount.com"
PUBLIC="PUSH_PUBLIC_KEY"
PRIVATE="PUSH_PRIVATE_KEY"
APP_NAME="KMC DC Events"
cd "$(dirname "$0")/.."
firebase() { pnpm exec firebase "$@" --project "$PROJECT"; }
has_secret() { gcloud secrets describe "$1" --project "$PROJECT" >/dev/null 2>&1; }

echo "Project $PROJECT"

echo "1/6 APIs: Firebase Cloud Messaging, its registrations, Firebase Installations"
gcloud services enable fcm.googleapis.com fcmregistrations.googleapis.com \
  firebaseinstallations.googleapis.com --project "$PROJECT"

echo "2/6 The app as a Firebase web app, \"$APP_NAME\""
app_id() { firebase apps:list WEB 2>/dev/null | grep -o '1:[0-9]*:web:[0-9a-f]*' | head -n 1 || true; }
APP_ID="$(app_id)"
if [[ -z "$APP_ID" ]]; then
  firebase apps:create WEB "$APP_NAME" >/dev/null
  APP_ID="$(app_id)"
fi
if [[ -z "$APP_ID" ]]; then
  echo "The web app wasn't made. Add one in the Firebase console (Project settings → General → Add app → Web) and run this again." >&2
  exit 1
fi
echo "  $APP_ID; the deploy reads its settings when it builds the app"

echo "3/6 The web push key pair (P-256), the stage's own, in Secret Manager; never printed"
if has_secret "$PUBLIC" && has_secret "$PRIVATE"; then
  echo "  Kept: made once, never replaced"
elif has_secret "$PUBLIC" || has_secret "$PRIVATE"; then
  echo "Only one half of the key pair is in Secret Manager. Ask before replacing it: phones signed up with the old one stop getting notifications." >&2
  exit 1
else
  KEYS="$(mktemp -d)"
  trap 'rm -rf "$KEYS"' EXIT
  b64url() { base64 | tr '+/' '-_' | tr -d '=\n'; }
  openssl ecparam -name prime256v1 -genkey -noout -out "$KEYS/key.pem"
  # The private key's DER starts 30 77 02 01 01 04 20, then its 32 bytes.
  if [[ "$(openssl ec -in "$KEYS/key.pem" -outform DER 2>/dev/null | head -c 7 | xxd -p)" != "30770201010420" ]]; then
    echo "openssl made a key of an unexpected shape; nothing was stored." >&2
    exit 1
  fi
  # Web push takes the public key as its 65 bytes (04, x, y) and the private as its 32, in
  # base64url.
  openssl ec -in "$KEYS/key.pem" -pubout -outform DER 2>/dev/null | tail -c 65 | b64url >"$KEYS/public"
  openssl ec -in "$KEYS/key.pem" -outform DER 2>/dev/null | tail -c +8 | head -c 32 | b64url >"$KEYS/private"
  for secret in "$PUBLIC" "$PRIVATE"; do
    gcloud secrets create "$secret" --project "$PROJECT" --replication-policy automatic >/dev/null
  done
  gcloud secrets versions add "$PUBLIC" --data-file="$KEYS/public" --project "$PROJECT" >/dev/null
  gcloud secrets versions add "$PRIVATE" --data-file="$KEYS/private" --project "$PROJECT" >/dev/null
  echo "  Made and stored"
fi
# The deploy builds the public half into the app; nothing reads the private half yet.
gcloud secrets add-iam-policy-binding "$PUBLIC" --project "$PROJECT" --quiet \
  --member "serviceAccount:$DEPLOYER" --role roles/secretmanager.secretAccessor >/dev/null

echo "4/6 $ACCOUNT runs notifyLists and may only manage the messaging service's lists"
if ! gcloud iam service-accounts describe "$ACCOUNT" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create notify-lists --project "$PROJECT" \
    --display-name "Notifications: joins and leaves a phone's lists"
fi
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
  --member "serviceAccount:$ACCOUNT" --role roles/firebasecloudmessaging.admin >/dev/null

echo "5/6 $FUNCTIONS_DEPLOYER may run functions as $ACCOUNT"
gcloud iam service-accounts add-iam-policy-binding "$ACCOUNT" --project "$PROJECT" --quiet \
  --member "serviceAccount:$FUNCTIONS_DEPLOYER" --role roles/iam.serviceAccountUser >/dev/null

echo "6/6 $SENDER sends the notifications after a publish, and may only send"
# A role of one permission: Google's own messaging roles also manage the lists.
PERMISSIONS="cloudmessaging.messages.create"
if gcloud iam roles describe notifySender --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam roles update notifySender --project "$PROJECT" --quiet \
    --permissions "$PERMISSIONS" >/dev/null
else
  gcloud iam roles create notifySender --project "$PROJECT" --stage GA --quiet \
    --title "Notifications: send only" --permissions "$PERMISSIONS" >/dev/null
fi
if gcloud iam service-accounts describe "$SENDER" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
    --member "serviceAccount:$SENDER" --role "projects/$PROJECT/roles/notifySender" >/dev/null
else
  echo "  $SENDER doesn't exist yet: run scripts/setup-update-job.sh first, then this again."
fi

echo
echo "Done. Next, give Firebase the key pair: in the Firebase console for $PROJECT, Project"
echo "settings → Cloud Messaging → Web Push certificates → Import an existing key pair."
echo "Copy each half to the clipboard, so it shows in no terminal or log, and paste it there:"
echo "  gcloud secrets versions access latest --secret $PUBLIC --project $PROJECT | pbcopy"
echo "  gcloud secrets versions access latest --secret $PRIVATE --project $PROJECT | pbcopy"
echo "Then run Deploy functions on the stage's branch, so notifyLists exists; the next deploy"
echo "builds the app with notifications."
