#!/usr/bin/env python3
"""
Step 4: Upload the generated PDF to Airtable and write its URL to the record's
AI One-Pager field (a URL text field).

Strategy:
  1. POST the PDF bytes to Airtable's Content API (uploadAttachment) on a
     temporary attachment field to get an Airtable-hosted signed URL.
  2. PATCH the AI One-Pager text field with that URL.

  If step 1 fails (no attachment field exists / Content API not available),
  the script exits with a clear error — no third-party file hosting is used.

Note: Airtable signed URLs from the Content API are time-limited (~hours).
For permanent storage, upload the PDF to Google Drive / S3 manually and update
the field, or add a dedicated Attachment-type field to the Airtable table.

Usage:
    python3 upload_to_airtable.py \
      --pdf .tmp/Acme_one_pager.pdf \
      --record-id recXXXXXXXXX
"""

import argparse
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

_REQUIRED_ENV = ["AIRTABLE_API_KEY", "AIRTABLE_BASE_ID", "AIRTABLE_TABLE_NAME", "AIRTABLE_PDF_FIELD"]
_missing = [k for k in _REQUIRED_ENV if not os.environ.get(k)]
if _missing:
    print(f"ERROR: Missing required environment variables: {', '.join(_missing)}", file=sys.stderr)
    sys.exit(1)

AIRTABLE_API_KEY = os.environ["AIRTABLE_API_KEY"]
AIRTABLE_BASE_ID = os.environ["AIRTABLE_BASE_ID"]
AIRTABLE_TABLE_NAME = os.environ["AIRTABLE_TABLE_NAME"]
AIRTABLE_PDF_FIELD = os.environ["AIRTABLE_PDF_FIELD"]

AIRTABLE_BASE_URL = "https://api.airtable.com/v0"
AIRTABLE_CONTENT_URL = "https://content.airtable.com/v0"


def upload_to_airtable_content_api(record_id: str, pdf_path: Path) -> str:
    """
    Upload PDF bytes to Airtable's Content API for a specific record.
    Returns the signed URL of the uploaded file.

    Endpoint: POST /v0/{baseId}/{recordId}/uploadAttachment
    This works even for URL/text fields — Airtable hosts the file and returns a URL.
    """
    url = f"{AIRTABLE_CONTENT_URL}/{AIRTABLE_BASE_ID}/{record_id}/uploadAttachment"
    headers = {
        "Authorization": f"Bearer {AIRTABLE_API_KEY}",
        "Content-Type": "application/octet-stream",
        "x-airtable-application-id": AIRTABLE_BASE_ID,
    }

    try:
        pdf_bytes = pdf_path.read_bytes()
    except OSError as e:
        raise RuntimeError(f"Could not read PDF: {e}") from e

    params = {
        "filename": pdf_path.name,
        "contentType": "application/pdf",
    }

    resp = requests.post(url, headers=headers, data=pdf_bytes, params=params, timeout=60)

    if resp.status_code in (200, 201):
        data = resp.json()
        # Response may be an attachment object or wrapped in a field
        if isinstance(data, list) and data:
            return data[0].get("url", "")
        if isinstance(data, dict):
            return data.get("url", data.get("uploadUrl", ""))

    print(f"  Content API response {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
    raise RuntimeError(
        f"Airtable Content API upload failed ({resp.status_code}). "
        "Ensure AIRTABLE_API_KEY has 'data.records:write' scope."
    )


def patch_url_field(record_id: str, url_value: str) -> None:
    """PATCH the URL text field on the Airtable record with the PDF URL."""
    endpoint = f"{AIRTABLE_BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_NAME}/{record_id}"
    headers = {
        "Authorization": f"Bearer {AIRTABLE_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {"fields": {AIRTABLE_PDF_FIELD: url_value}}

    resp = requests.patch(endpoint, headers=headers, json=body, timeout=30)
    if resp.status_code != 200:
        print(f"  PATCH response {resp.status_code}: {resp.text[:500]}", file=sys.stderr)
        raise RuntimeError(f"Airtable PATCH failed ({resp.status_code}): {resp.text[:200]}")


def main():
    parser = argparse.ArgumentParser(description="Upload PDF URL to Airtable record")
    parser.add_argument("--pdf", required=True, help="Path to the PDF file")
    parser.add_argument("--record-id", required=True, help="Airtable record ID (recXXX...)")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"ERROR: PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    record_id = args.record_id
    print(f"Uploading {pdf_path.name} → Airtable record {record_id}")

    try:
        print("  Uploading to Airtable Content API...")
        hosted_url = upload_to_airtable_content_api(record_id, pdf_path)
        if not hosted_url:
            raise RuntimeError("Content API returned no URL in response.")
        print(f"  Hosted URL: {hosted_url}")

        print(f"  Updating field '{AIRTABLE_PDF_FIELD}'...")
        patch_url_field(record_id, hosted_url)

    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Done — record {record_id} field '{AIRTABLE_PDF_FIELD}' updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
