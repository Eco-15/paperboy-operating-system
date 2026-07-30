# Paperboy drive-ingest — Drive → pgvector sync, as a Cloud Run Job.
#
# Why a Job and not the web app: ingest used to run inside an HTTP request on the
# 1 GB `paperboy-os` container. It buffers whole files into memory, so a 204 MB PDF
# (the FON Series A memo) OOM-killed the run — and the swallowed error made the file
# look merely "absent" from the index. A Job gets real memory and a real timeout.
#
# Build context is the REPO ROOT (see cloudbuild.yaml) so it can reuse lib/ directly.
FROM node:20-slim

WORKDIR /app

# pdf-parse/pdfjs wants these for its (optional) canvas path; without them it logs
# noisy polyfill warnings on every PDF.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# tsx is a devDependency but the entrypoint is TypeScript, so keep dev deps.
RUN npm ci

COPY tsconfig.json ./
COPY lib ./lib

# Node's default heap is too small for a 200 MB PDF's working set.
ENV NODE_OPTIONS=--max-old-space-size=3584

CMD ["npx", "tsx", "lib/rag/run-ingest.ts"]
