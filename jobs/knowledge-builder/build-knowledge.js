/**
 * Paperboy knowledge-builder — scheduled Cloud Run Job.
 * Runs as the paperboy-app service account: reads the Shared-Drive folder,
 * clusters brands, and (re)generates brand cards + playbook templates with
 * Claude, embeds them with Vertex, and stores them in the RAG index
 * (drive_file / doc_chunk). Idempotent — re-runnable on a schedule.
 *
 * Env: GOOGLE_CLOUD_PROJECT, VERTEX_LOCATION, DRIVE_ROOT_ID, ANTHROPIC_API_KEY,
 *      and a DB connection (INSTANCE_CONNECTION_NAME + DATABASE_USER/NAME/PASSWORD
 *      on Cloud Run, or DATABASE_URL locally).
 */
const crypto = require("crypto");
const { Pool } = require("pg");
const { GoogleAuth } = require("google-auth-library");

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const LOC = process.env.VERTEX_LOCATION || "us-central1";
const ROOT = process.env.DRIVE_ROOT_ID;
const KEY = process.env.ANTHROPIC_API_KEY;
const EMBED_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-005";

const auth = new GoogleAuth({
  scopes: [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/cloud-platform",
  ],
});
async function token() {
  // Delegate to GoogleAuth, which caches and refreshes the access token as it
  // nears expiry. (A manual long-lived cache caused mid-run Vertex 401s on long
  // batches once the underlying token expired.)
  const t = await auth.getAccessToken();
  if (!t) throw new Error("no access token from ADC");
  return t;
}

function makePool() {
  const inst = process.env.INSTANCE_CONNECTION_NAME;
  if (inst) {
    return new Pool({
      host: `/cloudsql/${inst}`,
      user: process.env.DATABASE_USER || "postgres",
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME || "postgres",
      max: 4,
    });
  }
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
}
const pool = makePool();

const DOC = "application/vnd.google-apps.document";
const SHEET = "application/vnd.google-apps.spreadsheet";
const FOLDER = "application/vnd.google-apps.folder";

async function driveList(folderId) {
  const out = [];
  let pageToken = "";
  do {
    const u = new URL("https://www.googleapis.com/drive/v3/files");
    u.searchParams.set("corpora", "allDrives");
    u.searchParams.set("includeItemsFromAllDrives", "true");
    u.searchParams.set("supportsAllDrives", "true");
    u.searchParams.set("pageSize", "1000");
    u.searchParams.set("q", `'${folderId}' in parents and trashed=false`);
    u.searchParams.set("fields", "nextPageToken, files(id,name,mimeType,size)");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const r = await fetch(u, { headers: { Authorization: "Bearer " + (await token()) } });
    const j = await r.json();
    if (!r.ok) throw new Error("drive.list " + r.status + " " + JSON.stringify(j).slice(0, 150));
    out.push(...(j.files || []));
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return out;
}

async function walk(folderId, path, depth, acc) {
  for (const f of await driveList(folderId)) {
    const node = { id: f.id, name: f.name, path: path + "/" + f.name, mime: f.mimeType, size: f.size ? Number(f.size) : null };
    if (f.mimeType === FOLDER) {
      if (depth < 6) await walk(f.id, node.path, depth + 1, acc);
    } else acc.push(node);
  }
  return acc;
}

async function exportText(id, to) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(to)}`, { headers: { Authorization: "Bearer " + (await token()) } });
  return r.ok ? await r.text() : null;
}
async function downloadB64(id) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: "Bearer " + (await token()) } });
  if (!r.ok) return null;
  const b = Buffer.from(await r.arrayBuffer());
  return b.length > 24 * 1024 * 1024 ? null : b.toString("base64");
}
async function embed(texts) {
  const r = await fetch(`https://${LOC}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOC}/publishers/google/models/${EMBED_MODEL}:predict`, {
    method: "POST",
    headers: { Authorization: "Bearer " + (await token()), "Content-Type": "application/json" },
    body: JSON.stringify({ instances: texts.map((content) => ({ content, task_type: "RETRIEVAL_DOCUMENT" })) }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("vertex " + r.status + " " + JSON.stringify(j).slice(0, 150));
  return j.predictions.map((p) => p.embeddings.values);
}
async function claude(system, content, maxTokens = 4000) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-opus-4-8", max_tokens: maxTokens, system, messages: [{ role: "user", content }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("anthropic " + r.status + " " + JSON.stringify(j).slice(0, 150));
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function chunk(t, size = 1200, overlap = 150) {
  t = (t || "").trim();
  if (t.length <= size) return t ? [t] : [];
  const out = [];
  let s = 0;
  while (s < t.length) { let e = Math.min(s + size, t.length); out.push(t.slice(s, e).trim()); if (e >= t.length) break; s = e - overlap; }
  return out.filter(Boolean);
}
const vec = (a) => "[" + a.join(",") + "]";

// Synthesized cards/templates are firm-wide internal knowledge — visible to all
// staff in the Workspace domain (matches each staff user's `domain:<d>` principal).
// Retrieval is FAIL-CLOSED: `accessors` lists who may read a doc, so an empty array
// means "nobody". This used to fall back to "[]" when ALLOWED_STAFF_DOMAIN was unset
// — which silently wrote a deny-all ACL onto all 78 cards and made the entire brand
// knowledge base invisible to every user, indistinguishable from an empty index.
// A missing ACL config is a bug, not a default. Refuse to write rather than write
// something unreadable.
const STAFF_DOMAIN = (process.env.ALLOWED_STAFF_DOMAIN || "").toLowerCase();
if (!STAFF_DOMAIN) {
  throw new Error(
    "ALLOWED_STAFF_DOMAIN is not set. Cards would be written with an empty `accessors` " +
      "array, which fail-closed retrieval treats as 'readable by nobody' — the whole " +
      "knowledge base would silently disappear. Set it (e.g. paperboyventures.com) and re-run.",
  );
}
const CARD_ACCESSORS = JSON.stringify(["domain:" + STAFF_DOMAIN]);

async function storeDoc(fid, name, title, body, source) {
  const chunks = chunk(body);
  if (!chunks.length) return 0;
  // Embed BEFORE touching the DB, so a failed embed never wipes an existing
  // good card. Then swap the doc + its chunks atomically in one transaction.
  const embs = await embed(chunks.map((c) => `${title}\n\n${c}`));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("delete from drive_file where drive_file_id=$1", [fid]);
    await client.query("insert into drive_file (id,drive_file_id,name,title,accessors,source,last_synced_at) values ($1,$2,$3,$4,$5::jsonb,$6,now())", [crypto.randomUUID(), fid, name, title, CARD_ACCESSORS, source || "brand_card"]);
    for (let i = 0; i < chunks.length; i++) {
      await client.query("insert into doc_chunk (id,drive_file_id,chunk_index,content,embedding) values ($1,$2,$3,$4,$5::vector)", [crypto.randomUUID(), fid, i, chunks[i], vec(embs[i])]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return chunks.length;
}

// Anthropic caps a document block at 32MB; downloadB64 refuses anything over 24MB.
// Check the size from the Drive listing FIRST, so we don't pull a 204MB deck (the FON
// Series A overview is exactly that) across the wire only to throw it away.
const MAX_PDF_B64 = 24 * 1024 * 1024;

// The RAG ingest (lib/rag/ingest.ts) already pulled every readable file's text into
// doc_chunk. For a file too large to hand Claude as a PDF, that extracted text is
// exactly what we want — and it's sitting in the same database this job is connected to.
async function indexedText(driveFileId, name) {
  const { rows } = await pool.query(
    "select content from doc_chunk where drive_file_id=$1 order by chunk_index",
    [driveFileId],
  );
  if (rows.length) return rows.map((r) => r.content).join("\n");

  // Drive holds five copies of the FON deck; the ingest dedupes and indexes only ONE,
  // so the copy we happened to pick here may have no chunks under its own id. Fall back
  // to the text indexed under the same FILE NAME. Without this, the deck template
  // silently got no deck content at all and learned "deck structure" from a stray
  // fundraising letter — the model itself flagged that it had never seen a slide.
  if (!name) return null;
  const alt = await pool.query(
    `select dc.content from doc_chunk dc
       join drive_file df on df.drive_file_id = dc.drive_file_id
      where df.name = $1
      order by dc.chunk_index`,
    [name],
  );
  if (!alt.rows.length) return null;
  return alt.rows.map((r) => r.content).join("\n");
}

async function gatherContent(files, maxPdfs = 3) {
  const content = [];
  let pdfs = 0;

  // Feed the model the PDFs it can actually read, smallest first — otherwise one
  // oversized deck consumes a slot and the template learns from nothing.
  const ordered = [
    ...files.filter((f) => f.mime !== "application/pdf"),
    ...files
      .filter((f) => f.mime === "application/pdf")
      .sort((a, b) => (a.size ?? Infinity) - (b.size ?? Infinity)),
  ];

  for (const f of ordered) {
    const base = f.path.split("/").pop();
    if (f.mime === DOC) { const t = await exportText(f.id, "text/plain"); if (t) content.push({ type: "text", text: `### ${base}\n${t.slice(0, 16000)}` }); }
    else if (f.mime === SHEET) { const t = await exportText(f.id, "text/csv"); if (t) content.push({ type: "text", text: `### ${base} (sheet)\n${t.slice(0, 8000)}` }); }
    else if (f.mime === "application/pdf" && pdfs < maxPdfs) {
      // Prefer the TEXT the RAG ingest already extracted, over re-sending the PDF as
      // base64. Several real decks as document blocks blow Anthropic's request-size
      // limit (413) and the retry then drops them ALL — which is how the deck template
      // ended up learning from a fundraising letter with no slides in it. Text is also
      // the only way in for the 204MB FON deck, the firm's best Series A example.
      const t = await indexedText(f.id, base);
      if (t && t.trim().length > 400) {
        console.log(`    "${base}" — using indexed text (${t.length} chars)`);
        content.push({ type: "text", text: `### ${base} (deck/PDF, text extracted in slide order)\n${t.slice(0, 12000)}` });
        pdfs++;
        continue;
      }
      // No indexed text (e.g. a scanned deck) — fall back to the PDF itself, if it fits.
      if (f.size && f.size > MAX_PDF_B64) {
        console.log(`    skip "${base}" — ${(f.size / 1048576).toFixed(0)}MB and no extracted text in the index`);
        continue;
      }
      const b = await downloadB64(f.id);
      if (b) { content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b } }); pdfs++; }
    }
  }
  return content;
}

const CARD_SYSTEM =
  "You are building a knowledge-base card for Paperboy Ventures' (a consumer-brand investment firm) internal AI assistant. " +
  "From the provided source documents about a SINGLE brand/company, write a concise, factual Markdown card. First line MUST be `# {Brand} — Brand Card`. " +
  "Sections (omit any with no info — never invent): What they do; Category & stage; Deal / investment; Traction & financials; DEALS episode / content; Key people & contacts; Status & next steps. " +
  "Pull REAL figures. ~600 words. End with a 'Sources' bullet list.";

// A DECK is not prose — capturing "tone and section headings" would be useless. It
// needs slide-by-slide structure: what each slide asserts, in what order, with what
// evidence. So templates carry their own system prompt.
const PROSE_GUIDE = (t) =>
  `You are creating a reusable TEMPLATE & STYLE GUIDE for ${t.focus} at Paperboy Ventures, from the firm's past examples. Capture how THEY write: purpose/audience/tone/length, section-by-section outline, formatting conventions, and a copy-paste SKELETON with [bracketed prompts]. First line MUST be \`# ${t.title}\`. ~700-1000 words.`;

const DECK_GUIDE = (t) =>
  `You are reverse-engineering the STRUCTURE of ${t.focus} at Paperboy Ventures from the firm's real decks, so an AI can build a new one that looks like theirs.\n\n` +
  `The decks are supplied as TEXT EXTRACTED FROM THE PDFs, in slide order — you will see each slide's headline and body copy run together, often with page markers like "-- 4 of 25 --". That is the deck; read the slide breaks out of it. Do not complain that you cannot see images or layout; describe the structure the words reveal.\n\n` +
  `Work slide by slide. For EACH slide in the canonical running order, give:\n` +
  `- the slide's job (the one claim it must land)\n` +
  `- its headline pattern, as actually written in these decks (quote real examples)\n` +
  `- the supporting evidence it carries: metric / chart / logo wall / product shot / quote / table\n` +
  `- approximate word count, and how many bullets or stats\n\n` +
  `Then give: the typical deck LENGTH; which slides are mandatory vs optional; the house conventions for numbers (units, sourcing footnotes, how they cite research); and any recurring visual motifs.\n\n` +
  `Finish with a copy-paste SLIDE SKELETON — one numbered heading per slide with [bracketed prompts] for the content, ready to hand to a deck builder.\n\n` +
  `Ground everything in the supplied decks. Do NOT invent slides they don't use. First line MUST be \`# ${t.title}\`. ~900-1300 words.`;

const TEMPLATES = [
  { key: "investment-memo", title: "Investment Memo — Template & Style Guide", name: "Investment Memo Template", match: /deal memo|invest(ment|or) memo|investmentmemo|IC template/i, focus: "investment / deal memos", usePdf: true, guide: PROSE_GUIDE },
  { key: "advisory-agreement", title: "Advisory / Recruiting Agreement — Template & Style Guide", name: "Advisory Agreement Template", match: /advisory|advisor agreement|recruiting placement|business advisory|recruitment services/i, focus: "advisory & recruiting-placement agreements", usePdf: false, guide: PROSE_GUIDE },
  { key: "deals-episode", title: "DEALS Episode / Brand Write-up — Template & Style Guide", name: "DEALS Episode Template", match: /\bep\.?\s?\d|episode|deals draft|newsletter format|- draft/i, focus: "DEALS newsletter brand write-ups / episodes", usePdf: false, guide: PROSE_GUIDE },
  // The gap. Paperboy's decks were never read at all: gatherContent ignored .pptx and
  // decks aren't Google Docs, so no template ever matched them.
  {
    key: "investor-deck",
    title: "Investor Deck — Structure & Style Guide",
    name: "Investor Deck Template",
    // Matched on the FILE NAME, not the whole path — a folder called "Investors"
    // otherwise drags in every file beneath it. No \b anchors: real filenames are
    // `Toto_FinalInvestorDeck.pdf` and `Mooski_Sales Deck_Jan24.pdf`, where "Deck" sits
    // against camelCase and underscores (both word characters), so \bdeck\b matches
    // NEITHER. The exclusion list above, not word boundaries, is what keeps paperwork out.
    match: /deck|pitch|investment overview|investor overview/i,
    focus: "investor decks / pitch decks",
    usePdf: true,
    guide: DECK_GUIDE,
  },
];

// Paperboy's Drive is full of investor PAPERWORK whose names look deck-ish to a loose
// regex — accreditation letters, subscription docs, KYC scans. The first run of this
// template happily started learning "deck structure" from
// `NIKOLAS_JAMES_PEARMINE_accredited_investor_verification.pdf`. A style guide built
// from ID documents is worse than no style guide, because nobody would notice.
const NOT_A_TEMPLATE_SOURCE =
  /accredit|verification|subscription|signature|signed|executed|w-?9\b|passport|driver|license|kyc|consent|closing|nda\b|invoice|receipt/i;

async function run() {
  console.log("Listing Drive…");
  const files = await walk(ROOT, "", 0, []);
  const readable = files.filter((f) => f.mime === DOC || f.mime === SHEET || f.mime === "application/pdf");
  console.log(`Drive: ${files.length} files (${readable.length} readable).`);

  // Rebuilding all ~60 brand cards costs a Claude call each and takes half an hour, so
  // iterating on a TEMPLATE meant waiting through all of it. ONLY_TEMPLATES=1 skips
  // straight to the style guides.
  const onlyTemplates = process.env.ONLY_TEMPLATES === "1";
  if (onlyTemplates) console.log("ONLY_TEMPLATES=1 — skipping brand cards.");

  // 1) Cluster brands
  const names = [...new Set(readable.map((f) => f.path.split("/").pop()))];
  const clusterPrompt =
    "These are file names from a CPG investment firm's (Paperboy Ventures) Google Drive:\n\n" + names.join("\n") +
    "\n\nIdentify the distinct consumer BRANDS / portfolio companies that appear. EXCLUDE internal/operational items (the fund 'PFI/Paperboy Fund', hiring/JOBS, events/Invitational, generic trackers, the firm itself, investor databases). " +
    "For each brand return a short display name and a lowercase regex 'match'. Return ONLY a JSON array like [{\"name\":\"Toto\",\"match\":\"toto\"}]. Be thorough.";
  const clusterText = await claude("", [{ type: "text", text: clusterPrompt }], 8000);
  const brands = JSON.parse(clusterText.match(/\[[\s\S]*\]/)[0]);
  console.log(`Identified ${brands.length} brands.`);

  let cards = 0;
  for (const b of onlyTemplates ? [] : brands) {
    try {
      const re = new RegExp(b.match, "i");
      const bf = readable.filter((f) => re.test(f.path)).slice(0, 8);
      if (!bf.length) continue;
      const content = await gatherContent(bf);
      if (!content.length) continue;
      content.push({ type: "text", text: `Write the brand card for "${b.name}".` });
      const card = await claude(CARD_SYSTEM, content);
      const title = (card.split("\n").find((l) => l.replace(/^#+\s*/, "").trim()) || b.name).replace(/^#+\s*/, "").trim();
      await storeDoc("card:" + b.name, b.name, title, card, "brand_card");
      cards++;
    } catch (e) { console.log(`  card ${b.name} failed: ${e.message}`); }
  }
  console.log(`Stored ${cards} brand cards.`);

  // 2) Templates
  let tpls = 0;
  for (const t of TEMPLATES) {
    try {
      // Drive holds FIVE identical copies of the FON deck. Without dedup the "8
      // examples" were five copies of ONE deck — the template would learn a single
      // document's quirks as if they were the house pattern, and the payload blew
      // Anthropic's request-size limit (413).
      const byName = new Map();
      for (const f of readable) {
        const base = f.path.split("/").pop() || "";
        if (NOT_A_TEMPLATE_SOURCE.test(base)) continue; // paperwork, not an example
        if (!t.match.test(base)) continue;
        if (!(f.mime === DOC || (t.usePdf && f.mime === "application/pdf"))) continue;
        const key = base.toLowerCase().replace(/\s*\(\d+\)/, "").trim(); // "deck (2).pdf" → "deck.pdf"
        if (!byName.has(key)) byName.set(key, f);
      }
      const tf = [...byName.values()].slice(0, 6);

      // A template with no examples used to `continue` in silence, so a style guide
      // could quietly stop existing and nobody would know until the agent wrote
      // something off-brand. Say it out loud.
      if (!tf.length) {
        console.log(`  ⚠️  ${t.key}: NO matching source files — style guide NOT built. Widen its \`match\` regex.`);
        continue;
      }
      console.log(`  ${t.key}: learning from ${tf.length} file(s) — ${tf.map((f) => f.path.split("/").pop()).slice(0, 3).join(", ")}${tf.length > 3 ? "…" : ""}`);

      const content = await gatherContent(tf, t.usePdf ? 3 : 0);
      if (!content.length) {
        console.log(`  ⚠️  ${t.key}: matched ${tf.length} file(s) but extracted NO content — style guide NOT built.`);
        continue;
      }
      content.push({ type: "text", text: `Produce the template & style guide for ${t.focus}.` });

      let body;
      try {
        body = await claude(t.guide(t), content, 8000);
      } catch (e) {
        // One corrupt/encrypted PDF ("The PDF specified was not valid") or an oversized
        // payload (413) used to take the ENTIRE template down with it. Drop the document
        // blocks and retry on the text — better a text-derived style guide than none.
        const textOnly = content.filter((c) => c.type !== "document");
        const recoverable = /not valid|invalid_request|request_too_large|413/i.test(e.message);
        if (!recoverable || textOnly.length < 2) throw e;
        console.log(`  ${t.key}: ${/413|too_large/.test(e.message) ? "payload too large" : "a source PDF was unreadable"} — retrying with text only.`);
        body = await claude(t.guide(t), textOnly, 8000);
      }

      await storeDoc("card:_template:" + t.key, t.name, t.title, body, "template");
      tpls++;
    } catch (e) { console.log(`  template ${t.key} failed: ${e.message}`); }
  }
  console.log(`Stored ${tpls}/${TEMPLATES.length} templates. Done.`);
  await pool.end();
}

run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
