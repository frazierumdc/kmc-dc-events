#!/usr/bin/env bash
# Sets up what the Update schedule timer (D54) needs in one Google project, so GitHub Actions
# deploys it from one branch and nothing is deployed from a Mac. See
# docs/architecture/infrastructure.md §The Update schedule timer.
#
#   scripts/setup-functions-deploy.sh your-project-id-dev dev
#   scripts/setup-functions-deploy.sh your-project-id-test test
#   scripts/setup-functions-deploy.sh your-project-id main
#
# Run after scripts/setup-deploy-identity.sh (it creates the Workload Identity pool). Needs
# gcloud signed in with Owner on the project, and gh signed in to GitHub. Safe to rerun.
# Prints the variables for the GitHub environment functions-<dev|test|prod>.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <project-id> <branch>" >&2
  exit 2
fi

PROJECT="$1"
BRANCH="$2"
POOL="github-actions"
PROVIDER="github"
RUNTIME="schedule-timer@$PROJECT.iam.gserviceaccount.com"
DEPLOYER="functions-deployer@$PROJECT.iam.gserviceaccount.com"
WORKFLOW="deploy-functions.yml"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
POOL_NAME="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL"

echo "Project $PROJECT ($PROJECT_NUMBER), branch $BRANCH"

echo "1/5 APIs"
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com run.googleapis.com eventarc.googleapis.com \
  pubsub.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com \
  cloudbilling.googleapis.com firebaseextensions.googleapis.com \
  --project "$PROJECT"

account() { # <name> <display name>
  if ! gcloud iam service-accounts describe "$1@$PROJECT.iam.gserviceaccount.com" \
    --project "$PROJECT" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$1" --project "$PROJECT" --display-name "$2"
  fi
}

# What it may start, the stage's two jobs, is granted by scripts/setup-update-job.sh.
echo "2/5 $RUNTIME runs the timer and reads no secret"
account schedule-timer "Update schedule timer (runs the function)"

echo "3/5 $DEPLOYER deploys the function"
account functions-deployer "GitHub Actions deploy of functions ($BRANCH)"
for role in roles/cloudfunctions.developer roles/cloudscheduler.admin \
  roles/secretmanager.viewer roles/artifactregistry.reader \
  roles/serviceusage.serviceUsageConsumer roles/serviceusage.serviceUsageViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
    --member "serviceAccount:$DEPLOYER" --role "$role" >/dev/null
done
# What the Firebase CLI also reads or sets: the project's settings, and who may call each function
# (the Wix signal's address is public, D28).
ROLE="projects/$PROJECT/roles/timerDeployExtras"
PERMISSIONS="firebase.projects.get,run.services.getIamPolicy,run.services.setIamPolicy,cloudfunctions.functions.getIamPolicy,cloudfunctions.functions.setIamPolicy"
if gcloud iam roles describe timerDeployExtras --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam roles update timerDeployExtras --project "$PROJECT" --quiet \
    --permissions "$PERMISSIONS" >/dev/null
else
  gcloud iam roles create timerDeployExtras --project "$PROJECT" --stage GA --quiet \
    --title "Timer deploy: Firebase CLI checks" --permissions "$PERMISSIONS" >/dev/null
fi
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
  --member "serviceAccount:$DEPLOYER" --role "$ROLE" >/dev/null

# Google's default accounts: Cloud Functions builds run as the compute account, and the
# Firebase CLI checks the App Engine one. The deployer may act as them, so neither keeps
# Editor: the compute account gets only what a build needs, the App Engine one nothing.
COMPUTE="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
APPENGINE="$PROJECT@appspot.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
  --member "serviceAccount:$COMPUTE" --role roles/cloudbuild.builds.builder >/dev/null
for sa in "$COMPUTE" "$APPENGINE"; do
  gcloud projects remove-iam-policy-binding "$PROJECT" --condition=None --quiet \
    --member "serviceAccount:$sa" --role roles/editor >/dev/null 2>&1 || true
done

# It may run the function as the timer's account, and use the two default accounts above.
for sa in "$RUNTIME" "$COMPUTE" "$APPENGINE"; do
  gcloud iam service-accounts add-iam-policy-binding "$sa" --project "$PROJECT" --quiet \
    --member "serviceAccount:$DEPLOYER" --role roles/iam.serviceAccountUser >/dev/null
done

echo "4/5 Provider $PROVIDER names the workflow file of each GitHub job"
gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" --project "$PROJECT" \
  --location global --workload-identity-pool "$POOL" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref,attribute.workflow=assertion.job_workflow_ref.extract('/.github/workflows/{file}@')" \
  >/dev/null

echo "5/5 Only $WORKFLOW (on $BRANCH, the provider's condition) may act as $DEPLOYER"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --project "$PROJECT" --quiet \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/$POOL_NAME/attribute.workflow/$WORKFLOW" \
  >/dev/null

echo
echo "GitHub environment functions-${BRANCH/main/prod} (deployable from $BRANCH only):"
echo "FIREBASE_PROJECT=$PROJECT"
echo "WIF_PROVIDER=$POOL_NAME/providers/$PROVIDER"
echo "FUNCTIONS_SERVICE_ACCOUNT=$DEPLOYER"
