#!/usr/bin/env bash
# Sets up the two Cloud Run jobs, update-schedule and send-email (D63), in one Google
# project: where their image is kept, the account that deploys them, what each job's own
# account may do, the email lists as secrets, the jobs themselves with their settings, and
# the GitHub environment Deploy jobs uses. See docs/architecture/infrastructure.md §The jobs.
#
#   scripts/setup-update-job.sh your-project-id-dev dev
#   scripts/setup-update-job.sh your-project-id-test test
#   scripts/setup-update-job.sh your-project-id main
#
# A stage's settings live on its two jobs, not in GitHub (D57, D61). For a job that does not
# exist yet, give the script what it can't work out, in its own environment; the values
# become the job's settings, and from then on the job is where they are read and changed
# (Cloud Run → Jobs → the job → Edit):
#   PUBLIC_BASE_URL=https://events.dev.example.org \
#   MAIL_FROM='The Center <sender@example.org>' \
#     scripts/setup-update-job.sh <project> <branch>
#
#   PUBLIC_BASE_URL  required for a new update-schedule job: the site's public address,
#                    written into event pages and calendar files
#   MAIL_FROM        required for a new send-email job: the sending account
#   PUBLISHED_URL    optional, for both jobs: the site the schedule is published to, which
#                    the copy compares with and the emails list; unset, the project's own
#                    Hosting address, https://<project>.web.app
#   WIX_FEED_URL     optional: the feed's address, when it isn't the code's own
#   MAIL_SETTINGS    optional: the emails' switches as JSON; unset, every email is on
# MAIL_ENV is the stage's name (dev, test or prod). A required value that is missing stops
# the script, exit 2, before anything is changed.
#
# Otherwise it asks for nothing. The email lists' addresses must be in the project's Secret Manager
# first, made by hand so nobody else sees them: copy a list's address, then
#   pbpaste | tr -d '\n' | gcloud secrets create <NAME> --project <project> \
#     --replication-policy automatic --data-file=-
# for each of SCHEDULE_CHANGES_EMAILS, DUPLICATE_EVENTS_EMAILS, EVENTS_EMAILS, ADMIN_EMAILS,
# FP_EMAILS, TTP_EMAILS (each a Google Group's address, or its name alone: the part before
# the @ of the center's domain) and DEV_EMAILS (a person's, for previews, in the same form); The script stops before changing anything when
# one is missing, and never reads or prints a value.
# Run after scripts/setup-state-bucket.sh, setup-mail-secrets.sh, setup-feed-secret.sh and
# setup-functions-deploy.sh. Needs gcloud signed in with Owner on the project and gh signed
# in to the repository (only to write Deploy jobs' own environment, jobs-<stage>, at the
# end). Safe to rerun: a job that exists keeps its settings.
# Not run since the jobs' settings moved off GitHub: untested until its first real use.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <project-id> <branch: dev, test or main>" >&2
  exit 2
fi

PROJECT="$1"
BRANCH="$2"
case "$BRANCH" in
  dev) STAGE=dev ;;
  test) STAGE=test ;;
  main) STAGE=prod ;;
  *) echo "The branch must be dev, test or main." >&2; exit 2 ;;
esac
REGION="us-east4"
BUCKET="your-project-id-$STAGE-state"
DEPLOYER="jobs-deployer@$PROJECT.iam.gserviceaccount.com"
FEED="feed-reader@$PROJECT.iam.gserviceaccount.com"
MAIL="mail-sender@$PROJECT.iam.gserviceaccount.com"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
POOL_NAME="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions"
WORKFLOW="deploy-jobs.yml"
# Google's own sample job: what a new job runs until Deploy jobs gives it the real image.
PLACEHOLDER="us-docker.pkg.dev/cloudrun/container/job:latest"
LISTS=(SCHEDULE_CHANGES_EMAILS DUPLICATE_EVENTS_EMAILS EVENTS_EMAILS ADMIN_EMAILS FP_EMAILS
  TTP_EMAILS DEV_EMAILS)
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# A new account takes up to a minute to be known everywhere in Google: a grant that names
# it is tried again until it is.
retry() {
  local try
  for try in 1 2 3 4 5 6; do
    if "$@" 2>"$WORK/error"; then return 0; fi
    grep -q "does not exist" "$WORK/error" || break
    sleep 10
  done
  cat "$WORK/error" >&2
  return 1
}
project_role() { # member, role
  retry gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
    --member "serviceAccount:$1" --role "$2" >/dev/null
}

echo "Project $PROJECT, branch $BRANCH"

has_secret() {
  gcloud secrets describe "$1" --project "$PROJECT" >/dev/null 2>&1
}
MISSING=()
for name in "${LISTS[@]}"; do
  has_secret "$name" || MISSING+=("$name")
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "Nothing was changed. These email lists aren't in $PROJECT's Secret Manager yet:" >&2
  for name in "${MISSING[@]}"; do
    echo "  $name" >&2
  done
  echo "For each: copy the list's address, then run" >&2
  echo "  pbpaste | tr -d '\\n' | gcloud secrets create <NAME> --project $PROJECT --replication-policy automatic --data-file=-" >&2
  exit 1
fi

# What a job still to be made needs from the script's own environment: checked for both jobs
# before anything changes.
SITE="${PUBLISHED_URL:-https://$PROJECT.web.app}"
NEEDED=()
if ! gcloud run jobs describe update-schedule --region "$REGION" --project "$PROJECT" \
  >/dev/null 2>&1; then
  [[ -n "${PUBLIC_BASE_URL:-}" ]] ||
    NEEDED+=("PUBLIC_BASE_URL=<the site's public address>   (the job update-schedule does not exist yet)")
fi
if ! gcloud run jobs describe send-email --region "$REGION" --project "$PROJECT" \
  >/dev/null 2>&1; then
  [[ -n "${MAIL_FROM:-}" ]] ||
    NEEDED+=("MAIL_FROM='<name> <sending address>'   (the job send-email does not exist yet)")
fi
if [[ ${#NEEDED[@]} -gt 0 ]]; then
  echo "Nothing was changed. Run it again with these set in its environment:" >&2
  for line in "${NEEDED[@]}"; do
    echo "  $line" >&2
  done
  exit 2
fi
# They are written into a YAML file between quotes: a quote of the same kind would break it.
if [[ "${PUBLIC_BASE_URL:-}${MAIL_FROM:-}${SITE}${WIX_FEED_URL:-}" == *'"'* || "${MAIL_SETTINGS:-}" == *"'"* ]]; then
  echo "Nothing was changed. PUBLIC_BASE_URL, PUBLISHED_URL, WIX_FEED_URL and MAIL_FROM may hold no double quote, MAIL_SETTINGS no single quote." >&2
  exit 2
fi

echo "1/10 APIs: Cloud Run, Artifact Registry"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com --project "$PROJECT"

echo "2/10 Where the jobs' image is kept: the repository jobs, its last 10 images"
if ! gcloud artifacts repositories describe jobs --location "$REGION" --project "$PROJECT" \
  >/dev/null 2>&1; then
  gcloud artifacts repositories create jobs --repository-format docker --location "$REGION" \
    --project "$PROJECT" --description "The image of update-schedule and send-email (D63)"
fi
cat >"$WORK/cleanup.json" <<JSON
[
  { "name": "keep-the-last-10", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 10 } },
  { "name": "delete-the-rest", "action": { "type": "Delete" }, "condition": { "olderThan": "7d" } }
]
JSON
gcloud artifacts repositories set-cleanup-policies jobs --location "$REGION" \
  --project "$PROJECT" --policy "$WORK/cleanup.json" --no-dry-run >/dev/null

echo "3/10 $DEPLOYER deploys the jobs, and only $WORKFLOW may sign in as it"
if ! gcloud iam service-accounts describe "$DEPLOYER" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create jobs-deployer --project "$PROJECT" \
    --display-name "Deploys the Cloud Run jobs from GitHub"
fi
project_role "$DEPLOYER" roles/run.developer
retry gcloud artifacts repositories add-iam-policy-binding jobs --location "$REGION" \
  --project "$PROJECT" --member "serviceAccount:$DEPLOYER" \
  --role roles/artifactregistry.writer >/dev/null
for sa in "$FEED" "$MAIL"; do
  retry gcloud iam service-accounts add-iam-policy-binding "$sa" --project "$PROJECT" --quiet \
    --member "serviceAccount:$DEPLOYER" --role roles/iam.serviceAccountUser >/dev/null
done
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --project "$PROJECT" --quiet \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/$POOL_NAME/attribute.workflow/$WORKFLOW" >/dev/null

echo "4/10 feed-reader@ may publish the schedule to Firebase Hosting"
project_role "$FEED" roles/firebasehosting.admin

echo "5/10 The email lists' secrets: readable by mail-sender@"
for name in "${LISTS[@]}"; do
  gcloud secrets add-iam-policy-binding "$name" --project "$PROJECT" --quiet \
    --member "serviceAccount:$MAIL" --role roles/secretmanager.secretAccessor >/dev/null
done

echo "6/10 The job update-schedule, as feed-reader@"
if ! gcloud run jobs describe update-schedule --region "$REGION" --project "$PROJECT" \
  >/dev/null 2>&1; then
  cat >"$WORK/update-schedule.yaml" <<YAML
JOB: update-schedule
PROJECT: "$PROJECT"
REGION: "$REGION"
STATE_BUCKET: "$BUCKET"
HOSTING_SITE: "$PROJECT"
SEND_EMAIL_JOB: send-email
PUBLIC_BASE_URL: "$PUBLIC_BASE_URL"
PUBLISHED_URL: "$SITE"
YAML
  # Only when given: without it the job reads the feed at the code's own address.
  if [[ -n "${WIX_FEED_URL:-}" ]]; then
    echo "WIX_FEED_URL: \"$WIX_FEED_URL\"" >>"$WORK/update-schedule.yaml"
  fi
  gcloud run jobs create update-schedule --region "$REGION" --project "$PROJECT" \
    --image "$PLACEHOLDER" --service-account "$FEED" --max-retries 0 --task-timeout 15m \
    --memory 1Gi --cpu 1 --env-vars-file "$WORK/update-schedule.yaml" \
    --set-secrets "WIX_FEED_TOKEN=WIX_FEED_TOKEN:latest" >/dev/null
fi

echo "7/10 The job send-email, as mail-sender@; feed-reader@ may start it"
if ! gcloud run jobs describe send-email --region "$REGION" --project "$PROJECT" \
  >/dev/null 2>&1; then
  # MAIL_SETTINGS is JSON: single-quoted, so YAML keeps it as it is.
  cat >"$WORK/send-email.yaml" <<YAML
JOB: send-email
PROJECT: "$PROJECT"
REGION: "$REGION"
STATE_BUCKET: "$BUCKET"
MAIL_ENV: "$STAGE"
MAIL_FROM: "$MAIL_FROM"
MAIL_SETTINGS: '${MAIL_SETTINGS:-}'
PUBLISHED_URL: "$SITE"
YAML
  SECRETS="GMAIL_CLIENT_ID=GMAIL_CLIENT_ID:latest,GMAIL_CLIENT_SECRET=GMAIL_CLIENT_SECRET:latest,GMAIL_REFRESH_TOKEN=GMAIL_REFRESH_TOKEN:latest"
  for name in "${LISTS[@]}"; do
    SECRETS="$SECRETS,$name=$name:latest"
  done
  gcloud run jobs create send-email --region "$REGION" --project "$PROJECT" \
    --image "$PLACEHOLDER" --service-account "$MAIL" --max-retries 0 --task-timeout 10m \
    --memory 512Mi --cpu 1 --env-vars-file "$WORK/send-email.yaml" \
    --set-secrets "$SECRETS" >/dev/null
fi
gcloud run jobs add-iam-policy-binding send-email --region "$REGION" --project "$PROJECT" \
  --member "serviceAccount:$FEED" --role roles/run.jobsExecutorWithOverrides >/dev/null

echo "8/10 Who may start the jobs: the timers and the check, through Google's own API"
TIMER="schedule-timer@$PROJECT.iam.gserviceaccount.com"
SIGNAL="wix-signal@$PROJECT.iam.gserviceaccount.com"
job_role() { # job, account, role; skipped where the project has no such account yet
  gcloud iam service-accounts describe "$2" --project "$PROJECT" >/dev/null 2>&1 || return 0
  gcloud run jobs add-iam-policy-binding "$1" --region "$REGION" --project "$PROJECT" \
    --member "serviceAccount:$2" --role "$3" >/dev/null
}
# The 4:07 timers start update-schedule as it is; the 4:30 timer starts send-email for one email.
job_role update-schedule "$TIMER" roles/run.invoker
job_role send-email "$TIMER" roles/run.jobsExecutorWithOverrides
# The check starts update-schedule saying Wix started it, and send-email for its alarm; it
# reads both jobs' runs, so one state of the website never starts copies without end (D64).
for job in update-schedule send-email; do
  job_role "$job" "$SIGNAL" roles/run.jobsExecutorWithOverrides
  job_role "$job" "$SIGNAL" roles/run.viewer
done

echo "9/10 The live record: update-schedule tells open apps of each publish (NT-1)"
# Where the stage has its live record (scripts/setup-live-version.sh): feed-reader@ may write
# it, and the job is told its address. A stage without one is left as it is.
LIVE="$(curl -sS "https://firebasedatabase.googleapis.com/v1beta/projects/$PROJECT/locations/us-central1/instances/$PROJECT-default-rtdb" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "x-goog-user-project: $PROJECT" |
  sed -n 's/.*"databaseUrl": *"\([^"]*\)".*/\1/p')"
if [[ -n "$LIVE" ]]; then
  project_role "$FEED" roles/firebasedatabase.admin
  gcloud run jobs update update-schedule --region "$REGION" --project "$PROJECT" \
    --update-env-vars "LIVE_URL=$LIVE/live/version.json" >/dev/null
else
  echo "  No live record in $PROJECT yet; skipped."
fi

echo "10/10 GitHub's environment jobs-$STAGE, for Deploy jobs"
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
gh api -X PUT "repos/$REPO/environments/jobs-$STAGE" >/dev/null
gh variable set JOBS_PROJECT --env "jobs-$STAGE" --body "$PROJECT"
gh variable set JOBS_SERVICE_ACCOUNT --env "jobs-$STAGE" --body "$DEPLOYER"
gh variable set WIF_PROVIDER --env "jobs-$STAGE" --body "$POOL_NAME/providers/github"

echo "Done. Next: GitHub → Actions → Deploy jobs → Run workflow (branch $BRANCH)."
echo "Then Deploy functions: the timers and the check start these jobs (D63)."
echo "The jobs' settings are theirs now: Google Cloud console → Cloud Run → Jobs → a job → Edit."
