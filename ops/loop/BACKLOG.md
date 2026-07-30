# Paperboy OS — Improvement Backlog

The loop's persistent queue. Highest-leverage at top. The loop pulls from here,
may add newly-discovered items, and re-prioritizes each cycle. Keep it honest:
close what's done, mark what's blocked.

**Fields:** `id · title` — Dimension(s) [R/C/K/P/U/M] · Size S/M/L · Risk low/med/high · Status
Then: **Why** (leverage) and **Done when** (acceptance criteria).

**Status legend:** `todo` · `in-progress` · `blocked` · `done` (move done items to the bottom section).

---

## P1 — do first (high leverage, mostly low/med risk)

### L-008 · Remove dead shell CSS + tidy the `.tool-badge--done` chip
Dimensions: M · Size: S · Risk: low · Status: todo
**Why:** `AssistantBar`/`Header` were retired but their `.ask-float*` / `.assistant-*` CSS lingers in `globals.css` (dead). `.tool-badge--done` is still a pure-black chip that could become an SLDS neutral badge. Maintainability + a small cohesion nudge.
**Done when:** dead selectors removed, `.tool-badge--done` mapped to `.slds-badge--neutral` styling, build green.

### L-009 · Decide chat's accent language (dark vs SLDS palette)
Dimensions: C · Size: M · Risk: med · Status: todo (needs owner taste call)
**Why:** `/chat` deliberately uses a dark-accent language (black user bubbles, black send, dark tooltip). It's internally coherent but diverges from the bronze/tan console. Either is defensible — needs an owner decision before touching.
**Done when:** owner picks a direction; if "join the palette," chat primaries move to `--accent` and bubbles to a tinted surface.

### L-002 · Visually verify the authenticated shell (login → dashboard → tools)
Dimensions: R, U · Size: S · Risk: low · Status: todo
**Why:** The redesign's one unverified claim — the shell/rail/collapse/active-highlight were never seen logged-in. Cheap, high-confidence.
**Done when:** signed-in walkthrough confirms top bar + rail render, active-route highlight tracks, collapse persists across navigation, `/chat` scrolls full-height; screenshots or notes in the journal.

### L-011 · Verify remaining ontology-plan items (DriveFile columns + agent cross-ref prompt)
Dimensions: K · Size: S · Risk: low · Status: todo
**Why:** Cycle 2 confirmed most of `refactored-dreaming-manatee.md` is implemented, but did **not** check item #4 (`DriveFile` exposing `modifiedTime`/`accessors` in `lib/ontology/objects/drive-file.ts`) or #5 (cross-referencing instructions in `lib/ontology/agent/prompt.ts`).
**Done when:** both confirmed present (or added), build green.

## Feature push (autonomous, owner-requested 2026-07-10) — "add a ton of helpful features"
High-value, self-contained features (no DB schema migration — that's a gate). In project context: an internal OS for a CPG investment firm, so features that speed daily deal/investor work win.

- **L-020 · ⌘K command palette + wire the global search** — C/U/K · M · low. The top-bar search is currently dead. Make it a real palette: jump to any module, search investors + deals (deep-link deals to `/crm/[id]`), keyboard-driven. Flagship "operating system" feature.
- **L-021 · Reusable CSV export on data tables** — K/U · S · low. `lib/export/csv.ts` util + an "Export CSV" button on Investors, CRM, Brands. Getting data out is daily-work gold for an investment team.
- **L-022 · CRM pipeline summary bar** — K/U · S · low. At-a-glance deal counts by stage (+ new-lead count) atop `/crm`, reusing `/api/crm`.
- **L-023 · Investor outreach tools** — K/U · M · low. Result count, "copy all emails/websites", quick type filters on `/investors`; `?q=` deep-link support (pairs with L-020).
- **L-024 · Keyboard shortcuts + a11y** — U · S · low. ⌘K global, focus/aria on the rail + palette, skip-to-content.
- **L-025 · Empty/loading skeletons across panels** — U · S · low. Replace bare "—"/spinners with consistent skeletons.

## L-030 · EPIC (standing, owner-requested) — high-tech visual overhaul of the front end
Dimensions: C, U · Size: XL · Risk: med · Status: ongoing (tackle after the feature push)
**Directive:** "How can I make this look like the most modern, most graphics-oriented, super high-tech looking website?" Applies to the public marketing site + OS surfaces. When the feature backlog is exhausted, keep generating cycles here: motion, depth, gradients/glass, animated hero, data-viz flourishes, micro-interactions — while keeping it fast and accessible. Do it as reversible slices (snapshot each file); this supersedes the earlier `.site` freeze for the marketing site specifically (freeze was to protect it during the OS reskin; owner now wants it modernized). Flag big look changes in the journal for owner eyeball.

## P2 — next (bigger or needs product shaping)

### L-004 · Turn a `/coming-soon` tile into a real module (start: Content Studio)
Dimensions: K · Size: L · Risk: med · Status: todo
**Why:** The 3 vision tiles (`lib/tiles.ts`) are the only deliberately-unbuilt modules; "completeness" means no dead ends. Content Studio pairs naturally with the existing blog + newsletter + RAG.
**Done when:** an MVP route + component + API exist behind the tile (draft posts in-voice from recent activity), following the module-per-tool + migration pattern; gated to internal staff.

### L-005 · Ask-Paperboy RAG / output polish
Dimensions: U, K · Size: M · Risk: med · Status: todo
**Why:** Tracked in `~/.claude/plans/linear-moseying-valiant.md` — Claude-style markdown output, hybrid+rerank retrieval, document generation. The chat is the flagship surface.
**Done when:** a concrete slice from that plan ships (e.g. improved answer formatting or a retrieval-quality fix), verified end-to-end in `/chat`.

## P3 — later / stretch

### L-006 · Owner marketing TODOs
Dimensions: K · Size: S · Risk: low · Status: todo
**Why:** Real `// TODO (owner)` markers in `app/(site)/{page,contact,for-founders}.tsx` (real thesis stats, real contact inbox, real sample address). Small, honest completeness wins — but need owner-supplied real values (approval gate).
**Done when:** owner provides the real values and they're wired in.

### L-007 · Performance & a11y pass on the dashboard
Dimensions: U · Size: M · Risk: low · Status: todo
**Why:** The dashboard fires several client fetches (stats, calendar, gmail, news); check for waterfalls, add skeletons, keyboard/focus order, aria on the rail.
**Done when:** measurable first-paint/interaction improvement or concrete a11y fixes, no regressions.

---

## LOOP PAUSED 2026-07-10 (cycle 16) — feature backlog exhausted
Next work needs owner direction: (a) confirm the high-tech dark-glass direction (see `/login`) → then rebrand the marketing site + more OS surfaces under L-030; (b) L-009 chat-palette decision; (c) deploy the Cycle-2 security fix. Resume with "run the loop".

## Done
- **L-025 (panels)** · Dashboard Calendar/Inbox/News loading skeletons — _Cycle 16._
- **L-024 (help)** · "?" keyboard-shortcuts overlay — _Cycle 15._
- **L-022** · CRM pipeline summary strip (totals + stacked stage bar) — _Cycle 14._
- **L-024** · Keyboard/a11y: skip-to-content, aria-current on rail, aria-modal palette — _Cycle 13._
- **L-030 (tool pages)** · Gradient tool titles + accent header rule + table row-hover — _Cycle 12._
- **L-025** · Loading skeletons (`.skel` shimmer) on the KPI row — _Cycle 11._
- **L-030 (login)** · High-tech dark/glass animated `/login` — _Cycle 10._ Owner eyeball requested; sets the tone for the modern look.
- **L-023** · Investor "⧉ Copy" contacts to clipboard — _Cycle 9._
- **L-031** · Personalized dashboard hero (greeting + date) — _Cycle 8._
- **L-030 (started)** · High-tech visual pass — _Cycle 7._ Glass shell, gradient canvas, animated KPI tiles, glow, glassy palette. Ongoing epic — owner eyeball requested.
- **L-021** · Reusable CSV export on Investors + CRM + Brands — _Cycles 5–6._ `lib/export/csv.ts`.
- **L-020** · ⌘K command palette + wired global search — _Cycle 4._ `components/os/CommandPalette.tsx`.
- **L-011** · Verified remaining ontology-plan items (all present) — _Cycle 3, no diff._
- **L-003 / L-010** · Ontology data-integrity — _Cycle 2, 2026-07-10._ Tracked plan already implemented; **found + fixed 2 cross-user leaks it missed** in `lib/ontology/query.ts`: IDOR in `getObjectById` (any staff could read another user's Gmail/Calendar/Chat by ID) + a fail-open list filter. Now fails closed via shared `OWNER_SCOPED`. Build green. Spawned L-011. **Security change — owner review + priority deploy flagged.**
- **L-001** · Audit the Salesforce reskin across tool pages — _Cycle 1, 2026-07-10._ Unified the black/tan accent language onto accent tokens (active tabs, primary buttons, poker vote bar, CRM drag-over, blog cover). Build green. Spawned L-008, L-009. Owner eyeball pending.
