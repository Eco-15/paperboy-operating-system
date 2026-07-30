#!/usr/bin/env python3
"""
FastAPI server for the Paperboy Ventures one-pager dashboard.

Serves the frontend, proxies Airtable API calls (keeping the API key server-side),
streams pipeline execution output, and listens for Airtable webhooks to auto-generate
one-pagers on new submissions.

Run with:
    cd .claude/skills/paperboy-ventures-one-pager/scripts
    pip install fastapi uvicorn python-dotenv requests
    uvicorn server:app --reload --port 8080
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import AsyncGenerator

import requests
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPTS_DIR = Path(__file__).resolve().parent
# Repo root is 4 levels up: scripts → paperboy-ventures-one-pager → skills → .claude → repo root
REPO_ROOT = SCRIPTS_DIR.parent.parent.parent.parent
ENV_FILE = REPO_ROOT / ".env"
TMP_DIR = REPO_ROOT / ".tmp"

load_dotenv(ENV_FILE)

AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY", "")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "")
AIRTABLE_TABLE_NAME = os.environ.get("AIRTABLE_TABLE_NAME", "")
AIRTABLE_PDF_FIELD = os.environ.get("AIRTABLE_PDF_FIELD", "AI One-Pager")
AIRTABLE_BASE_URL = "https://api.airtable.com/v0"

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Paperboy Ventures Dashboard")

# Queues for pushing events to connected frontend clients
_event_queues: list[asyncio.Queue] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _airtable_headers() -> dict:
    return {"Authorization": f"Bearer {AIRTABLE_API_KEY}"}


def _normalize_record(r: dict) -> dict:
    """Map raw Airtable fields to a clean dict."""
    fields = r.get("fields", {})
    contact_name = fields.get("Contact Name", "").strip()
    parts = contact_name.split(" ", 1)
    return {
        "id": r["id"],
        "company": fields.get("Company", "").strip(),
        "first_name": parts[0] if parts else "",
        "last_name": parts[1] if len(parts) > 1 else "",
        "email": fields.get("Contact Email", "").strip(),
        "website": fields.get("Website", "").strip(),
        "message": fields.get("message", "").strip(),
        "linkedin": "",
        "one_pager_url": fields.get(AIRTABLE_PDF_FIELD, "").strip(),
    }


def _fetch_all_records() -> list[dict]:
    """Fetch every record from Airtable (no filter)."""
    url = f"{AIRTABLE_BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_NAME}"
    headers = _airtable_headers()
    records: list[dict] = []
    params: dict = {"pageSize": 100}

    while True:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
        params["offset"] = offset

    return [_normalize_record(r) for r in records]


def _fetch_record_by_id(record_id: str) -> dict:
    """Fetch a single Airtable record by ID."""
    url = f"{AIRTABLE_BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_NAME}/{record_id}"
    resp = requests.get(url, headers=_airtable_headers(), timeout=30)
    resp.raise_for_status()
    return _normalize_record(resp.json())


def _fetch_unprocessed_records() -> list[dict]:
    """Fetch records where the PDF field is empty."""
    url = f"{AIRTABLE_BASE_URL}/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE_NAME}"
    params = {
        "pageSize": 100,
        "filterByFormula": f"({{{AIRTABLE_PDF_FIELD}}} = '')",
    }
    resp = requests.get(url, headers=_airtable_headers(), params=params, timeout=30)
    if resp.status_code != 200:
        return []
    data = resp.json()
    return [_normalize_record(r) for r in data.get("records", [])]


# ---------------------------------------------------------------------------
# Pipeline runner (async generator — yields SSE-formatted lines)
# ---------------------------------------------------------------------------

async def _run_pipeline(record: dict) -> AsyncGenerator[str, None]:
    """Run the 4-step one-pager pipeline for a single record.

    Yields server-sent event strings. Sends DONE_SUCCESS or DONE_ERROR as the
    final event so the frontend knows when to stop listening.
    """
    company = record.get("company", "company")
    slug = company.lower().replace(" ", "-").replace("/", "-") or "company"
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    research_path = TMP_DIR / f"{slug}_research.json"
    pdf_path = TMP_DIR / f"{company}_one_pager.pdf"
    record_json = json.dumps(record)

    steps = [
        {
            "label": f"[2/3] Researching {company}...",
            "cmd": [
                sys.executable,
                str(SCRIPTS_DIR / "research_company.py"),
                "--record", record_json,
                "--output", str(research_path),
            ],
        },
        {
            "label": f"[3/3] Generating PDF...",
            "cmd": [
                sys.executable,
                str(SCRIPTS_DIR / "generate_one_pager.py"),
                "--research", str(research_path),
                "--output", str(pdf_path),
            ],
        },
        {
            "label": f"[4/3] Uploading to Airtable...",
            "cmd": [
                sys.executable,
                str(SCRIPTS_DIR / "upload_to_airtable.py"),
                "--pdf", str(pdf_path),
                "--record-id", record["id"],
            ],
        },
    ]

    yield f"data: Starting pipeline for {company}...\n\n"

    for step in steps:
        yield f"data: {step['label']}\n\n"

        env = {**os.environ, "PYTHONUNBUFFERED": "1"}
        proc = await asyncio.create_subprocess_exec(
            *step["cmd"],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
        )

        assert proc.stdout is not None
        async for raw_line in proc.stdout:
            line = raw_line.decode().rstrip()
            if line:
                yield f"data: {line}\n\n"

        await proc.wait()
        if proc.returncode != 0:
            yield f"data: ERROR: step exited with code {proc.returncode}\n\n"
            yield "data: DONE_ERROR\n\n"
            return

    yield f"data: Done! One-pager generated for {company}.\n\n"
    yield "data: DONE_SUCCESS\n\n"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index():
    html = (SCRIPTS_DIR / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html)


@app.get("/api/records")
async def get_records():
    """Return all Airtable records as JSON."""
    try:
        records = _fetch_all_records()
        return {"records": records}
    except requests.HTTPError as e:
        return JSONResponse({"error": str(e)}, status_code=502)


@app.get("/api/generate/{record_id}")
async def generate(record_id: str):
    """Stream the pipeline for a single record as Server-Sent Events."""
    try:
        record = _fetch_record_by_id(record_id)
    except requests.HTTPError as e:
        return JSONResponse({"error": str(e)}, status_code=404)

    return StreamingResponse(
        _run_pipeline(record),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/webhook")
async def airtable_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive Airtable webhook on new submission.

    Set this URL as an Airtable Automation trigger → "Send a web request" action,
    or register it via the Airtable Webhooks API.

    On receipt:
    1. Notifies all connected frontend clients to refresh the table.
    2. Auto-generates one-pagers for every unprocessed record in the background.
    """
    # Notify all connected SSE clients to refresh
    for q in _event_queues:
        await q.put("refresh")

    background_tasks.add_task(_auto_process_new_records)
    return {"ok": True}


async def _auto_process_new_records():
    """Background task: run the pipeline for every unprocessed record."""
    try:
        records = _fetch_unprocessed_records()
    except Exception:
        return

    for record in records:
        async for _ in _run_pipeline(record):
            pass  # fire and forget — output discarded

    # After processing, notify frontend to refresh
    for q in _event_queues:
        await q.put("refresh")


@app.get("/api/events")
async def events():
    """SSE stream for push notifications to the frontend.

    The frontend subscribes to this endpoint and refreshes the table whenever
    it receives a 'refresh' event (e.g. after the Airtable webhook fires).
    """
    q: asyncio.Queue = asyncio.Queue()
    _event_queues.append(q)

    async def generator():
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=30)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive ping
                    yield "data: ping\n\n"
        finally:
            if q in _event_queues:
                _event_queues.remove(q)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
