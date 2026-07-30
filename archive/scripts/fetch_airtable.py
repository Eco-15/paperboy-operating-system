#!/usr/bin/env python3
"""
Step 1: Fetch unprocessed investment application records from Airtable.
Records where the PDF attachment field is empty are considered unprocessed.

Usage:
    python3 fetch_airtable.py --output .tmp/applications.json
"""

import argparse
import json
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
    print("Copy .env.example to .env and fill in the Airtable section.", file=sys.stderr)
    sys.exit(1)

AIRTABLE_API_KEY = os.environ["AIRTABLE_API_KEY"]
AIRTABLE_BASE_ID = os.environ["AIRTABLE_BASE_ID"]
AIRTABLE_TABLE_NAME = os.environ["AIRTABLE_TABLE_NAME"]
AIRTABLE_PDF_FIELD = os.environ["AIRTABLE_PDF_FIELD"]

AIRTABLE_BASE_URL = "https://api.airtable.com/v0"


def fetch_records() -> list[dict]:
    """Fetch unprocessed records from Airtable using server-side filterByFormula."""
    url = f"{AIRTABLE_BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_NAME}"
    headers = {"Authorization": f"Bearer {AIRTABLE_API_KEY}"}
    records = []
    # Filter server-side to only fetch records where the PDF field is empty
    params = {
        "pageSize": 100,
        "filterByFormula": f"({{{AIRTABLE_PDF_FIELD}}} = '')",
    }

    while True:
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Network error fetching Airtable records: {e}", file=sys.stderr)
            sys.exit(1)

        if resp.status_code != 200:
            print(f"ERROR: Airtable returned {resp.status_code}: {resp.text}", file=sys.stderr)
            sys.exit(1)

        data = resp.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
        params["offset"] = offset

    return records


def normalize_record(record: dict) -> dict:
    """Extract and normalize the fields we care about.

    Actual Airtable field names in DEALS_BrandApps_8.15.25:
      Company, Contact Name, Contact Email, Website, message, AI One-Pager
    Contact Name is a single full-name field (split into first/last here).
    No LinkedIn field exists in this table.
    """
    fields = record.get("fields", {})
    contact_name = fields.get("Contact Name", "").strip()
    name_parts = contact_name.split(" ", 1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    return {
        "id": record["id"],
        "first_name": first_name,
        "last_name": last_name,
        "email": fields.get("Contact Email", "").strip(),
        "company": fields.get("Company", "").strip(),
        "website": fields.get("Website", "").strip(),
        "linkedin": "",  # No LinkedIn field in this table
        "message": fields.get("message", "").strip(),
    }


def main():
    parser = argparse.ArgumentParser(description="Fetch unprocessed Airtable applications")
    parser.add_argument("--output", required=True, help="Path to write JSON output")
    args = parser.parse_args()

    print("Fetching unprocessed records from Airtable...")
    unprocessed = fetch_records()
    print(f"  Unprocessed (no PDF): {len(unprocessed)}")

    normalized = [normalize_record(r) for r in unprocessed]

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(normalized, indent=2))

    print(f"Saved {len(normalized)} records → {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
