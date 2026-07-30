#!/usr/bin/env python3
"""
Step 3: Fill the HTML template with research data and render to PDF via Playwright.

Usage:
    python3 generate_one_pager.py \
      --research .tmp/acme_research.json \
      --output .tmp/Acme_one_pager.pdf
"""

import argparse
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


def get_domain(url: str) -> str:
    """Extract domain from a URL, e.g. https://acme.com → acme.com"""
    if not url:
        return ""
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        return parsed.netloc or url
    except Exception:
        return url


def safe_url(url: str) -> str:
    """Allow only http/https URLs to prevent javascript: injection in hrefs."""
    u = str(url or "").strip()
    if u.startswith(("http://", "https://")):
        return html.escape(u, quote=True)
    return "#"


def inject_citation_superscripts(text: str) -> str:
    """Convert [N] markers in plain text into superscript anchor HTML.

    e.g. "...grew 40% YoY [3]..." →
         "...grew 40% YoY <sup class='cite'><a href='#ref-3'>[3]</a></sup>..."
    """
    def replace_marker(m: re.Match) -> str:
        n = m.group(1)
        return f"<sup class='cite'><a href='#ref-{n}'>[{n}]</a></sup>"
    return re.sub(r'\[(\d+)\]', replace_marker, text)


def build_citations_html(citations: list[dict]) -> str:
    """Build the <li> items for the sources-list from the citations array."""
    if not citations:
        return "<li>No citations available.</li>"

    items = []
    for c in sorted(citations, key=lambda x: int(x.get("id", 0))):
        cid = c.get("id", "")
        title = html.escape(str(c.get("title", "Untitled")))
        url = c.get("url") or ""
        desc = html.escape(str(c.get("description", "")))

        if url and url.startswith(("http://", "https://")):
            safe_u = html.escape(url, quote=True)
            title_part = f'<span class="source-title"><a href="{safe_u}" target="_blank">{title}</a></span>'
        else:
            title_part = f'<span class="source-title">{title}</span>'

        items.append(
            f'<li id="ref-{cid}">{title_part} — {desc}</li>'
        )

    return "\n".join(items)


def fill_template(template: str, record: dict, sections: dict, citations: list[dict]) -> str:
    """Replace all placeholder tokens in the HTML template.

    All values are HTML-escaped before substitution to prevent XSS from
    malicious content in the public-facing investment application form.
    URLs used in href attributes are additionally validated to only allow
    http/https schemes. Citation [N] markers are converted to superscript links.
    """
    def safe(text: str) -> str:
        return html.escape(str(text or ""), quote=True)

    def safe_with_cites(text: str) -> str:
        """Escape text then convert [N] markers to superscript HTML."""
        return inject_citation_superscripts(html.escape(str(text or ""), quote=False))

    first = record.get("first_name", "")
    last = record.get("last_name", "")
    founder_name = safe(f"{first} {last}".strip() or "Founder")
    company = safe(record.get("company", "Company"))
    website = record.get("website", "")
    domain = safe(get_domain(website))
    website_href = safe_url(website)
    linkedin_href = safe_url(record.get("linkedin", ""))
    message = safe(record.get("message", ""))

    replacements = {
        "[COMPANY NAME]": company,
        "[Company Name]": company,
        "[URL]": website_href,
        "[company.com]": domain,
        "[Founder Name]": founder_name,
        "[LinkedIn URL]": linkedin_href,
        "[Founders Message]": message,
        "[About The Brand Paragraph]": safe_with_cites(sections.get("about_brand", "")),
        "[Market Analysis Paragraph]": safe_with_cites(sections.get("market_size", "")),
        "[Competitive Landscape Paragraph]": safe_with_cites(sections.get("competitive_landscape", "")),
        "[Founder Background Paragraph]": safe_with_cites(sections.get("founder_background", "")),
        "[Current Traction Paragraph]": safe_with_cites(sections.get("current_traction", "")),
        "[Citations Section]": build_citations_html(citations),
    }

    result = template
    for placeholder, value in replacements.items():
        result = result.replace(placeholder, value)
    return result


def render_pdf(html_path: str, pdf_path: str) -> None:
    """Use Playwright to render the filled HTML to a PDF."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: Playwright not installed. Run: pip install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page()
            page.goto(f"file://{html_path}", wait_until="networkidle")
            page.pdf(
                path=pdf_path,
                format="A4",
                print_background=True,
                margin={"top": "0mm", "bottom": "0mm", "left": "0mm", "right": "0mm"},
            )
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(description="Generate one-pager PDF from research JSON")
    parser.add_argument("--research", required=True, help="Path to research JSON file")
    parser.add_argument("--output", required=True, help="Path to write output PDF")
    args = parser.parse_args()

    research_path = Path(args.research)
    if not research_path.exists():
        print(f"ERROR: Research file not found: {research_path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(research_path.read_text())
    record = data["record"]
    sections = data["sections"]
    company = record.get("company", "Company")

    # Load template from the same directory as this script
    template_path = Path(__file__).parent / "template.html"
    if not template_path.exists():
        print(f"ERROR: Template not found: {template_path}", file=sys.stderr)
        print("Ensure template.html is in the same directory as this script.", file=sys.stderr)
        sys.exit(1)
    template = template_path.read_text(encoding="utf-8")

    citations = sections.get("citations", [])

    print(f"Filling template for: {company}")
    filled_html = fill_template(template, record, sections, citations)

    # Write filled HTML to .tmp for debugging
    slug = data.get("slug", company.lower().replace(" ", "_"))
    tmp_dir = Path(args.output).parent
    tmp_dir.mkdir(parents=True, exist_ok=True)
    html_out = tmp_dir / f"{slug}_filled.html"
    html_out.write_text(filled_html, encoding="utf-8")
    print(f"Filled HTML written → {html_out}")

    print("Rendering PDF via Playwright...")
    render_pdf(str(html_out.resolve()), args.output)

    print(f"PDF generated → {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
