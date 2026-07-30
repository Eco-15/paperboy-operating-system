# Deploy & Migrate — Paperboy OS

Run these once your Google Cloud resources from `SETUP_GOOGLE_CLOUD.md` exist.
Replace `PROJECT` / `REGION` (e.g. `us-central1`) / `YOUR_URL` accordingly.

## 1. Apply the database schema + seed data

Locally, point `DATABASE_URL` at Cloud SQL through the **Auth Proxy**:

```bash
# Terminal A — open a local tunnel to the instance
cloud-sql-proxy PROJECT:REGION:paperboy-db        # listens on 127.0.0.1:5432

# Terminal B — in .env.local set:
#   DATABASE_URL=postgresql://paperboy_app:PASSWORD@127.0.0.1:5432/paperboy
npm run db:push     # create all tables (enables the pgvector extension)
npm run db:seed     # load investors + blog + poker baseline
```

## 2. Build the image and deploy to Cloud Run

```bash
# Build & push to Artifact Registry (the `paperboy` repo from setup step 8)
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT/paperboy/app

# Deploy — connects Cloud SQL over the private socket and pulls secrets
gcloud run deploy paperboy-os \
  --image REGION-docker.pkg.dev/PROJECT/paperboy/app \
  --region REGION \
  --add-cloudsql-instances PROJECT:REGION:paperboy-db \
  --service-account paperboy-app@PROJECT.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars "INSTANCE_CONNECTION_NAME=PROJECT:REGION:paperboy-db,DATABASE_USER=paperboy_app,DATABASE_NAME=paperboy,AUTH_URL=https://YOUR_URL,GOOGLE_OAUTH_ID=...,ALLOWED_STAFF_DOMAIN=yourdomain.com,GOOGLE_CLOUD_PROJECT=PROJECT,VERTEX_LOCATION=REGION,EMBEDDING_MODEL=text-embedding-005,SHARED_DRIVE_ID=...,EXIA_BASE_URL=...,EXIA_MODEL=...,GLM_MODEL=..." \
  --set-secrets "DATABASE_PASSWORD=DATABASE_PASSWORD:latest,AUTH_SECRET=AUTH_SECRET:latest,GOOGLE_OAUTH_SECRET=GOOGLE_OAUTH_SECRET:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,EXIA_API_KEY=EXIA_API_KEY:latest,GLM_API_KEY=GLM_API_KEY:latest"
```

## 3. Finish the OAuth loop

After the first deploy prints your Cloud Run URL, add
`https://YOUR_URL/api/auth/callback/google` to the OAuth client's **Authorized
redirect URIs** (setup step 6) and set `AUTH_URL` to that URL.

## Make yourself an admin

Google sign-ins land as `internal`. To become `admin` (full access), once after
your first sign-in:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@yourdomain.com';
```
