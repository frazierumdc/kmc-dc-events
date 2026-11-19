#!/usr/bin/env bash
# Sets up the deploy identity in one Google project, so GitHub Actions can deploy from one
# branch without stored keys. See docs/architecture/infrastructure.md §Google Cloud / Firebase setup.
#
#   scripts/setup-deploy-identity.sh your-project-id-dev dev
#   scripts/setup-deploy-identity.sh your-project-id main
#
# Needs gcloud signed in with Owner on the project, and gh signed in to GitHub.
# Safe to rerun: anything that already exists is left as it is.
# Prints WIF_PROVIDER and DEPLOY_SERVICE_ACCOUNT for the GitHub environment.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <project-id> <branch>" >&2
  exit 2
fi

PROJECT="$1"
BRANCH="$2"
POOL="github-actions"
PROVIDER="github"
SA_NAME="deployer"
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"

# The repository's numeric id stays the same if the repository is renamed or moved (D9).
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
REPO_ID="$(gh api "repos/$REPO" --jq .id)"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
POOL_NAME="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL"

echo "Project $PROJECT ($PROJECT_NUMBER), branch $BRANCH, repository $REPO ($REPO_ID)"

echo "1/5 APIs"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT"

echo "2/5 Service account $SA"
if ! gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" \
    --display-name "GitHub Actions deploy ($BRANCH)"
fi
for role in roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --condition=None --quiet \
    --member "serviceAccount:$SA" --role "$role" >/dev/null
done

echo "3/5 Workload Identity pool $POOL"
if ! gcloud iam workload-identity-pools describe "$POOL" --project "$PROJECT" \
  --location global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" --location global \
    --display-name "GitHub Actions"
fi

echo "4/5 Provider $PROVIDER (repository $REPO_ID, refs/heads/$BRANCH only)"
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --project "$PROJECT" \
  --location global --workload-identity-pool "$POOL" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" \
    --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository_id == '$REPO_ID' && assertion.ref == 'refs/heads/$BRANCH'"
fi

echo "5/5 Let the provider act as $SA"
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" --quiet \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/$POOL_NAME/attribute.repository_id/$REPO_ID" \
  >/dev/null

echo
echo "GitHub environment variables for $BRANCH:"
echo "WIF_PROVIDER=$POOL_NAME/providers/$PROVIDER"
echo "DEPLOY_SERVICE_ACCOUNT=$SA"
