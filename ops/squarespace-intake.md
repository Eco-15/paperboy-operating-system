# Squarespace brand-application → CRM wiring

> ## ⚠️ DEPRECATED (2026-07-29) — do not wire this up
>
> This document describes the **Jul 9** decision: Squarespace forms POST straight
> into the OS *instead of* a Google Sheet. That has been **reversed**.
>
> The system of record for the Investment CRM is now the Google Sheet
> **`paperboyventures_DEALS_brandapps_szn4`**
> (`1G-cBFNaeK1flvKicfJZNWWQ1wlrijWkiN-u2a1O9Bk4`). Squarespace writes to it through
> its own native Google Sheet storage, and `/api/crm` pulls from it on read — see
> `lib/crm/sheet-sync.ts`.
>
> **Why this path must stay off:** the webhook writes to `inquiry` while the sync
> writes to `brand_app`. Both surface in the CRM as deals, so running both means every
> new application appears **twice**, under two different origins.
>
> **If the code-injection snippet below is currently live on the Squarespace
> application page, remove it.** The endpoint itself is left in place so nothing
> 404s mid-transition, but nothing should be pointed at it.
>
> The rest of this file is kept as a record of how the webhook works, in case the
> decision reverses again.

The endpoint is live at:

```
POST https://paperboy-os-978447873549.us-central1.run.app/api/intake/brand-application?token=<INTAKE_WEBHOOK_SECRET>
```

`INTAKE_WEBHOOK_SECRET` is already set on the Cloud Run service and matches the
value in `.env.local` (verified 2026-07-27 — an empty-body POST with that token
returns 400 "Need at least a company or email", not 401).

Rows land in `inquiries` (type `founder`) and surface in the Investment CRM as
`origin: form` deals with a NEW badge — same path as the native /apply form.
It accepts JSON, form-encoded, or text/plain-JSON bodies, tolerates Squarespace's
`SQF_FIELD_NAME` convention (keys are normalized: `SQF_BRAND_NAME` ≡ `brand_name`
≡ `brandName`), and appends any unmapped field to the deal's message as
`Label: value` so nothing on the form is dropped.

## Setup

Squarespace has no native "post to a URL" option on form blocks, so pick ONE of
the two relays below. Option A is free and instant; Option B costs a paid Zapier
plan (Webhooks is a premium Zapier app) and lags by minutes.

## Option A — Squarespace code injection (recommended)

Requires the Squarespace **Business** plan or higher (code injection).
Put this on the application page only — **Page Settings → Advanced → Code
Injection**, not the site-wide footer, or every newsletter signup on the site
also lands in the CRM.

```html
<script>
(function () {
  var ENDPOINT = "https://paperboy-os-978447873549.us-central1.run.app/api/intake/brand-application?token=TOKEN_HERE";

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.nodeName !== "FORM") return;
    // Mirror only real form blocks — skip search, login and newsletter blocks.
    if (!form.closest(".sqs-block-form")) return;
    if (form.querySelectorAll("input, textarea, select").length < 3) return;

    var data = {};
    new FormData(form).forEach(function (v, k) {
      if (typeof v === "string" && v.trim()) data[k] = v;
    });
    if (!Object.keys(data).length) return;

    // text/plain keeps this a CORS-simple request: an application/json beacon
    // needs a preflight that never completes as the page navigates away.
    navigator.sendBeacon(
      ENDPOINT,
      new Blob([JSON.stringify(data)], { type: "text/plain" })
    );
  }, true);
})();
</script>
```

Replace `TOKEN_HERE`. This *mirrors* the submission — Squarespace's own storage
(email / Google Sheet) keeps working as a belt-and-suspenders copy, so nothing
is lost if the beacon fails.

## Option B — Zapier / Make (no code on the site)

Squarespace form block → Edit → **Storage → Zapier → Connect** (needs a
Squarespace API key with Forms permission, Business plan or higher) → Zap
trigger "New Form Submission" → action **Webhooks by Zapier → POST** to the URL
above, payload type JSON, fields mapped through as-is.

Same wiring works from Make (HTTP module) or from the existing Google Sheet
(new-row trigger) if the Zapier form storage isn't available.

## Test

```bash
TOKEN=$(grep '^INTAKE_WEBHOOK_SECRET=' .env.local | cut -d= -f2-)
curl -s -X POST "https://paperboy-os-978447873549.us-central1.run.app/api/intake/brand-application?token=$TOKEN" \
  -H 'content-type: application/json' \
  -d '{"SQF_BRAND_NAME":"Test Sauce Co","fname":"Jane","lname":"Doe","email":"jane@testsauce.co","SQF_WEBSITE":"https://testsauce.co","SQF_RAISING":"$1.5M seed","message":"Testing the intake wire."}'
```

Then open /crm — "Test Sauce Co" sits at the top with a NEW badge, and the
"Raising" answer shows in the deal's message. Archive the test deal afterwards.

## Note

The route changes above (key normalization, unmapped-field capture, text/plain
body support, CORS preflight) ship on the **next Cloud Run deploy** — the live
revision still has the original strict-alias version, which will silently drop
`SQF_*` fields. Deploy before pasting the snippet into Squarespace.
