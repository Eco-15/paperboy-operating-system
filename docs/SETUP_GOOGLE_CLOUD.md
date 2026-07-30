# Google Cloud Setup — Paperboy OS

This is your click-by-click checklist to stand up everything on Google Cloud. Do these
in order. Anything marked **📋 SEND ME** is a value to copy and hand back to Claude (put
secrets in Secret Manager — see Step 9 — rather than pasting them in plain text).

You do **not** need to be technical. Most of this is clicking in the
[Google Cloud Console](https://console.cloud.google.com). Where a command is faster,
it's shown too — you can paste those into **Cloud Shell** (the `>_` icon at the top-right
of the console).

> **Region:** we'll use **`us-central1`** everywhere. If you prefer another region, pick
> one and use it consistently for every step.

---

## Step 1 — Create the project + turn on billing

1. Go to the [Console](https://console.cloud.google.com). Top bar → project dropdown →
   **New Project**.
2. Name it **`Paperboy OS`**. After it's created, select it (project dropdown).
3. Left menu → **Billing** → link a billing account (add a card if you don't have one).
   Nothing here costs money until resources run; the database is the main ongoing cost
   (~$10–25/mo on the smallest tier).

**📋 SEND ME:** the **Project ID** (looks like `paperboy-os-123456`, shown under the
project name — note it can differ from the project *name*).

---

## Step 2 — Enable the APIs we need

Left menu → **APIs & Services → Enable APIs and Services**, then search for and enable
each of these (or paste the one command below into Cloud Shell):

- Cloud SQL Admin API
- Cloud Run Admin API
- Artifact Registry API
- Secret Manager API
- Vertex AI API
- Google Drive API
- IAM Service Account Credentials API

```bash
gcloud services enable \
  sqladmin.googleapis.com run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com aiplatform.googleapis.com drive.googleapis.com \
  iamcredentials.googleapis.com
```

---

## Step 3 — Create the database (Cloud SQL for PostgreSQL)

1. Left menu → **SQL → Create Instance → PostgreSQL**.
2. Settings:
   - **Instance ID:** `paperboy-db`
   - **Password:** click **Generate** and **save it** — this is the `postgres` admin
     password.
   - **Database version:** PostgreSQL 16
   - **Region:** `us-central1`
   - **Edition:** Enterprise; **Preset:** *Sandbox* / smallest (we can scale up later).
3. Create it (takes a few minutes).
4. Once it's up, open the instance → **Databases → Create database** → name it
   **`paperboy`**.
5. **Users → Add user account** → username **`paperboy_app`**, generate a password, save it.
6. We'll enable the `pgvector` extension from the app later — nothing to do here for that.

**📋 SEND ME:** the **Instance connection name** (instance page → *Connect* tab, looks like
`paperboy-os-123456:us-central1:paperboy-db`).
**Into Secret Manager (Step 9):** the `paperboy_app` **password**.

---

## Step 4 — Create the app's service account

This identity is what the app runs as on Cloud Run, and what reads your Shared Drive.

1. Left menu → **IAM & Admin → Service Accounts → Create Service Account**.
2. Name: **`paperboy-app`**. Create.
3. Grant it these roles (on the *Grant access* step, or later under IAM):
   - **Cloud SQL Client**
   - **Secret Manager Secret Accessor**
   - **Vertex AI User**
4. Done. Note its email (looks like
   `paperboy-app@paperboy-os-123456.iam.gserviceaccount.com`).

**📋 SEND ME:** the **service-account email**.

> We will **not** download a JSON key file (Cloud Run uses the identity directly, which
> is safer). For local development I'll generate a short-lived key only if needed.

---

## Step 5 — Add the service account to your Shared Drive

So Paperboy can read the reference documents:

1. Open **Google Drive → Shared drives →** your reference drive.
2. Click the drive name → **Manage members**.
3. Add the **service-account email** from Step 4 as a member with **Viewer** (read-only).

**📋 SEND ME:** the **Shared Drive name** (and its ID if you have it — it's the long code
in the URL when the drive is open: `drive.google.com/drive/folders/<THIS-PART>`).

---

## Step 6 — Set up Google sign-in for staff (OAuth)

1. Left menu → **APIs & Services → OAuth consent screen**.
   - **User type:** Internal (if your staff are all on the same Google Workspace) —
     simplest and safest. Choose External only if some staff use non-Workspace Gmail.
   - App name: **Paperboy OS**. Add your support email. Save through the steps.
2. Left menu → **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - **Application type:** Web application
   - **Name:** `Paperboy OS Web`
   - **Authorized redirect URIs** — this one client is used for BOTH staff sign-in
     AND the dashboard "Connect Google" flow (Calendar/Inbox), which use *different*
     callback paths. Add **all four** (fill in the real domain after Step 8):
     - `http://localhost:3000/api/auth/callback/google`   ← sign-in (local)
     - `https://YOUR-CLOUD-RUN-URL/api/auth/callback/google`   ← sign-in (prod)
     - `http://localhost:3000/api/google/callback`   ← Calendar/Inbox connect (local)
     - `https://YOUR-CLOUD-RUN-URL/api/google/callback`   ← Calendar/Inbox connect (prod)
     > ⚠️ Missing the `/api/google/callback` entries is what causes
     > **Error 400: redirect_uri_mismatch** when a user clicks "Connect Google".
3. Create. A dialog shows the **Client ID** and **Client Secret**.

> **Note on personal Gmail:** if staff connect Calendar/Inbox with a **personal**
> `@gmail.com` account (not a Workspace one), the consent screen must be **External**
> and that address added under **OAuth consent screen → Test users**. An **Internal**
> consent screen only allows accounts on your Workspace domain.

**📋 SEND ME:** the **OAuth Client ID** and your **Workspace domain** (e.g. `paperboy.com`,
used to restrict staff logins).
**Into Secret Manager (Step 9):** the **OAuth Client Secret**.

---

## Step 7 — Gather the AI model credentials

The three chat models. The Drive embeddings use Vertex AI (already enabled in Step 2),
so no separate key for those.

- **Claude (Anthropic):** an API key from <https://console.anthropic.com> → API Keys.
- **Exia.ai:** API key **+ the base URL/endpoint + the exact model name(s)** you want.
  (These aren't standard, so I need the specifics to wire it.)
- **GLM (Zhipu):** API key **+ the exact model name(s)**.

**Into Secret Manager (Step 9):** all three API keys.
**📋 SEND ME:** the **Exia base URL + model name(s)** and the **GLM model name(s)**.

---

## Step 8 — Artifact Registry (where the app's container lives)

1. Left menu → **Artifact Registry → Create Repository**.
   - **Name:** `paperboy`
   - **Format:** Docker
   - **Region:** `us-central1`
2. Create. (Cloud Run itself I'll set up from the app side once the foundation is built —
   that's where the real Cloud Run URL comes from, which you then paste back into Step 6.)

---

## Step 9 — Put the secrets in Secret Manager

Rather than emailing me keys, create these secrets and grant the `paperboy-app` service
account access — the app reads them at runtime. Left menu → **Security → Secret Manager →
Create Secret**, one per row:

| Secret name | Value |
|---|---|
| `DATABASE_PASSWORD` | the `paperboy_app` password (Step 3) |
| `AUTH_SECRET` | a random string — generate with `openssl rand -base64 32` in Cloud Shell |
| `GOOGLE_OAUTH_SECRET` | the OAuth Client Secret (Step 6) |
| `ANTHROPIC_API_KEY` | your Claude key (Step 7) |
| `EXIA_API_KEY` | your Exia key (Step 7) |
| `GLM_API_KEY` | your GLM key (Step 7) |

For each secret, after creating it: open it → **Permissions / Principals → Grant access**
→ add the `paperboy-app` service-account email with role **Secret Manager Secret
Accessor** (if you didn't already grant it project-wide in Step 4).

---

## The short list to send me

When you've finished, reply with these (the non-secret ones — secrets stay in Secret
Manager):

1. **Project ID** (Step 1)
2. **Cloud SQL instance connection name** (Step 3)
3. **`paperboy-app` service-account email** (Step 4)
4. **Shared Drive name / ID** (Step 5) — and confirm the service account was added
5. **OAuth Client ID** + **Workspace domain** (Step 6)
6. **Exia base URL + model name(s)**, **GLM model name(s)** (Step 7)
7. Confirm the six **Secret Manager** secrets exist (Step 9)

With those, I can connect the app I'm building to your real Google Cloud project and we
go live phase by phase. While you work through this, I'm building the database schema,
logins, and the five tools so they're ready to plug in.
