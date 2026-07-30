# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Paperboy OS** — a Next.js 15 (App Router) / React 19 app that bundles several internal tools for Paperboy Ventures behind one shell: a Drive-grounded AI chat ("Ask Paperboy"), a poker-tournament vote tally, a blog ("The Front Page"), a CPG investor database, and a dashboard. It is mid-migration from a **frontend-only prototype** (data in `localStorage` / hardcoded files) to a **real backend on Google Cloud**. The approved build plan is at `~/.claude/plans/eager-forging-kitten.md`; the owner-facing cloud setup checklist is `docs/SETUP_GOOGLE_CLOUD.md`.

## Commands

```bash
npm run dev          # local dev server (localhost:3000)
npm run build        # production build — the best full-stack validation (compiles edge middleware + RSC + routes)
npm run typecheck    # tsc --noEmit
npm run lint         # next lint

# Database (Drizzle + Cloud SQL Postgres). Needs DATABASE_URL set in .env.local.
npm run db:generate  # generate SQL migration from lib/db/schema.ts into drizzle/
npm run db:push      # apply the schema directly to the DB (dev)
npm run db:migrate   # apply generated migrations
npm run db:seed      # load investors + blog seed data (lib/db/seed.ts)
```

There is **no test runner** configured yet. Validate changes with `npm run build` (catches server/client boundary and edge-runtime errors that `typecheck` misses).

## Architecture

**Module-per-tool layout.** Each tool is a triplet: `app/<module>/page.tsx` (route) + `components/<module>/` (UI) + `lib/<module>/` (types/state/data). Modules: `chat`, `poker`, `blog`, `investors`, `dashboard`, and `one-pager` (the last is **retired** — slated to move to `archive/`; don't build on it).

**The backend lives inside the Next app.** There is no separate server — API route handlers (`app/api/<module>/route.ts`) are the backend, the browser never touches Postgres or AI keys directly. Stack: **Drizzle ORM + node-postgres → Cloud SQL (Postgres + pgvector)**, hosted on **Cloud Run**. Single schema in `lib/db/schema.ts`; DB client in `lib/db/index.ts`.

**DB connection is dual-mode** (`lib/db/index.ts`): if `INSTANCE_CONNECTION_NAME` is set (Cloud Run) it connects over the Cloud SQL Unix socket; otherwise it uses `DATABASE_URL` (local/dev). The pool is intentionally lazy — it must not throw at import time or `next build` breaks before the DB exists.

**Auth is split for the edge runtime (important gotcha).** `auth.config.ts` is edge-safe (no DB, no bcrypt) and is what `middleware.ts` uses for route-gating. `auth.ts` is the full Node config (Drizzle adapter + Credentials provider + bcrypt + DB-touching callbacks). Never import `lib/db` or `bcryptjs` into `auth.config.ts` or `middleware.ts`. Auth.js v5, **JWT session strategy** (required to mix the adapter with the Credentials provider).

**Roles & access.** `users.role` is `admin | internal | client`. Staff sign in with Google (auto-promoted to `internal` via the `createUser` event, restricted to `ALLOWED_STAFF_DOMAIN`); clients are invited and use email+password (Credentials provider). Middleware only enforces *authentication* on protected prefixes; do **role** checks server-side with `requireRole()` / `isStaff()` in `lib/auth/guards.ts`, and gate write endpoints in the route handler (clients get 403). The session `user.role`/`user.id` augmentation lives in `types/next-auth.d.ts`.

**Module migration pattern** (localStorage/static → DB). Each migration: add `app/api/<module>/route.ts` (guard with `auth()`; map DB rows to the existing `lib/<module>/types.ts` shape so the UI barely changes), then swap the component's `localStorage`/static-import reads+writes for `fetch`. Done so far: investors, blog. The DB column names are snake_case; API responses re-map to the legacy UI keys (e.g. investors use `"Group Name"`, `Type`).

**The Investment CRM mirrors a Google Sheet.** `paperboyventures_DEALS_brandapps_szn4`
(`1G-cBFNaeK1fl…`) is the system of record for brand applications — Squarespace form
blocks write into it, and `app/api/crm/route.ts` pulls it on read via
`lib/crm/sheet-sync.ts` (throttled to one Drive fetch per 60s, skipped on `?lite=1`,
and **fail-open** so a Drive outage serves stale rows from Postgres rather than an
empty pipeline). **The sync is field-scoped, never a row mirror:** the sheet owns
company/contact/website/message/priority/category/subcategory/date; `stage`, `fund`,
`archived` and `aiOnePager` exist only in Postgres and must never appear in an update
built from the sheet, or every pull would wipe the kanban state. Adding a column to
`SHEET_OWNED` hands that field to the sheet permanently — CRM edits to it will be
reverted on the next pull. Matching is by normalized company name **then by
website/email domain**, because three of the historical sheets have no company column
and their names are derived from URLs ("Capecodr" vs the CRM's "Cape Cod'r").
`scripts/import-brand-apps.ts` is the one-shot backfill of all seven seasons; the
Squarespace webhook in `ops/squarespace-intake.md` is deprecated because it would
double-write every application into `inquiry`.

**Drive-grounded chat (Phase 3, not yet built).** "Ask Paperboy" will RAG over a Google **Shared Drive**: ingest files → Vertex AI embeddings → `pgvector` (`doc_chunks`). Chat routes to **Claude (Anthropic SDK), Exia.ai, and GLM**. The hard requirement: retrieval is **permission-aware** — filter chunks to files the signed-in staff member can open, via each file's stored `accessors` (`drive_files.accessors`). It is internal-staff-only.

## Gotchas

- **pgvector extension**: `drizzle-kit` does not emit `CREATE EXTENSION vector`. It was hand-added to the top of `drizzle/0000_*.sql`; preserve it (and re-add when regenerating) or the `doc_chunk` vector column/index fails.
- **Auth.js env names** are custom (`GOOGLE_OAUTH_ID`/`GOOGLE_OAUTH_SECRET`, `ALLOWED_STAFF_DOMAIN`) and passed explicitly in `auth.config.ts` — not the framework's auto-inferred `AUTH_GOOGLE_*`.
- **Claude model**: default `claude-opus-4-8` with `thinking: { type: "adaptive" }` and streaming (per the `claude-api` skill). Do not downgrade.
- `lib/investors/data.ts` is a ~120k-token generated file (460 records + geo pins). Don't read it whole; the DB is seeded from it. The investor map still uses its static `PINS` (no lat/lng in the DB yet).
- Secrets live in Google Secret Manager (prod) / gitignored `.env.local` (dev) — `.env.example` documents the full set.
