# Paperboy OS — Self-Improvement Loop · RUNBOOK

This is the operating procedure the agent follows to run one improvement cycle.
It keeps generating creative, high-leverage improvements to Paperboy OS and
ships them **one at a time, gated on owner approval of each plan**.

**How the owner runs it:** type `run the loop` (or `continue the loop`), or reply
`approved` to a pending Run Brief. State lives in these files, so any fresh
session can pick up where the last left off.

**Inputs (read every cycle):** this file · `RUBRIC.md` · `BACKLOG.md` · top of
`JOURNAL.md` · `../../CLAUDE.md` · relevant `~/.claude/plans/*` · the memory dir.

---

## The cycle

### 0 · Load context + confirm a green baseline
- Read `RUBRIC.md`, the top of `BACKLOG.md`, and the last ~3 `JOURNAL.md` entries. Skim `CLAUDE.md` gotchas.
- `git status` + `git log --oneline -5` — know what changed recently.
- Run `npm run build && npm run typecheck` (and `npm run lint`). **If red, fixing the red IS this cycle's item** — skip item selection and go straight to a brief for the fix.

### 1 · Pick the item + write a short brief
Pick the highest-leverage `todo` item in `BACKLOG.md` (respect the rubric tie-breaker). If you spot something clearly better, add it to the backlog and pick that. Note the item + the intended slice in one or two lines.

**AUTONOMOUS MODE (owner-granted 2026-07-10):** do **not** pause for approval — go straight to implement. Only stop for the hard gates below (deploy / DB schema / destructive / secrets / merge-to-main). Report each cycle's result tersely and keep going.

### 2 · Implement (after approval)
- Branch: `loop/<YYYY-MM-DD>-<slug>` (never commit to `main`).
- Smallest slice that meets the acceptance criteria. Reuse existing patterns: `components/os/*`, the `globals.css` token system, the `CLAUDE.md` migration pattern, `lib/auth/guards.ts`. Match surrounding code style.

### 3 · Check the output (verification contract — hard gate)
- `npm run build && npm run typecheck && npm run lint` — must be green.
- **Drive the feature** end-to-end: dev server + curl/screenshot, or the `verify` skill. Exercise the empty/error/unauth path too.
- Self-review with `/code-review` (correctness + simplification).
- Score against `RUBRIC.md`: did it move the target dim without regressing others?

### 4 · If weak
Red build, real review bugs, or a rubric regression → **max 2 repair attempts**. Still weak → revert the branch (`git checkout main`, delete branch), mark the item `blocked` in `BACKLOG.md` with a one-line reason, narrow the scope or move to the next item. **Never leave a red baseline; never ship unverified.**

### 5 · Save for next run
- Append a `JOURNAL.md` entry (template in that file).
- Update `BACKLOG.md`: move the item to Done (with date), re-prioritize, add any follow-ups discovered (new `L-0xx` ids).
- Write durable gotchas to memory (`~/.claude/projects/.../memory/`).
- Leave the branch + a short diff summary for the owner to review/merge/deploy.

### 6 · Next
Present the next Run Brief (loop continues) unless a stop condition is hit — then say so and hand back to the owner.

---

## Stop conditions
- **Per-cycle:** one slice shipped + logged · OR an approval gate reached · OR no green-buildable item · OR baseline red and unfixable safely.
- **Loop-level:** no P1/P2 items left (only stretch) · OR owner pauses · OR ~3 cycles with no net rubric gain (say so, ask for direction — don't invent busywork).

## Always needs owner approval (gates — stop and ask)
- **The Run Brief, every cycle.**
- **Production deploy** — prepare it, never run `gcloud run deploy`.
- **DB schema / migrations** (`db:push`, `db:migrate`), secrets, new external integrations or anything with billing.
- **Auth / roles / permissions** changes.
- **Destructive changes** (deletes, data migrations) and anything touching real user data.
- **Merging to `main`.**
