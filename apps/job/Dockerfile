# The image of both Cloud Run jobs (D63), built from the repository root:
#   docker build -f apps/job/Dockerfile -t <image> .
# Node runs the TypeScript as it is; nothing is compiled.
FROM node:24-slim

RUN npm install --global pnpm@12.10.1
WORKDIR /app

# The workspace's package files first, so dependencies are a cached layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Every project's, so the lockfile matches the workspace; only the job's are installed.
COPY apps/functions/package.json apps/functions/
COPY apps/job/package.json apps/job/
COPY apps/web/package.json apps/web/
COPY brand/package.json brand/
COPY e2e/package.json e2e/
COPY packages/cloud/package.json packages/cloud/
COPY packages/domain/package.json packages/domain/
COPY packages/mailer/package.json packages/mailer/
COPY packages/publish/package.json packages/publish/
COPY packages/sync/package.json packages/sync/
COPY packages/ui/package.json packages/ui/
# The job and everything it depends on in the workspace: packages/publish draws the share
# pictures. The app (apps/web) and its build tools are not installed.
RUN pnpm install --frozen-lockfile --filter "@kmcdc/job..."

COPY data/site.json data/
COPY data/pictures data/pictures
COPY packages packages
COPY apps/job apps/job

ENV NODE_ENV=production
USER node
CMD ["node", "apps/job/src/main.ts"]
