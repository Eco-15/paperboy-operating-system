# Paperboy OS — Quality Rubric ("definition of best")

Every improvement the loop ships is aimed at one or more of these dimensions and
scored against them. An item that advances its target dimension **without
regressing any other** is a win. Score each touched dimension −2…+2 in the
JOURNAL entry.

| # | Dimension | What "good" looks like | How to check |
|---|-----------|------------------------|--------------|
| R | **Reliability** | Build green; no runtime errors; every async/empty/error/unauth state degrades gracefully (e.g. the unconnected-Google panels). | `npm run build`; drive the feature incl. the empty/error path. |
| C | **Cohesion** | One design system across all modules — the `components/os/` shell + `globals.css` token system are the reference. No off-token colors, no orphan layouts. | Eyeball vs. the shell; grep for hardcoded hex / `var(--bg)` misuse. |
| K | **Completeness** | No dead ends. Every live module fully usable end-to-end; the 3 vision tiles (Talent CRM, Matching, Content Studio) move toward real. | Click every CTA/route in the touched module; nothing `#`/stub without reason. |
| P | **Data integrity & permissions** | Role gates via `lib/auth/guards.ts`; write endpoints 403 for clients; per-user Drive ACLs fail **closed**; no cross-user leaks. | Trace the API handler's `auth()` + role check; test as client vs staff. |
| U | **Performance & UX** | Fast first paint; responsive; keyboard-navigable; sensible loading skeletons; mobile not broken. | Dev server + narrow viewport; check no layout shift / blocking fetch. |
| M | **Maintainability** | Matches `CLAUDE.md` patterns (module-per-tool, backend-in-Next, split edge/node auth, snake_case DB → legacy UI keys); no new dependency without cause; small diffs. | Diff review vs. CLAUDE.md conventions; `/code-review`. |

## Guardrails that override "best" (never trade these away)
- Never break the **edge/node auth split** — no `lib/db` or `bcryptjs` in `auth.config.ts` / `middleware.ts`.
- Preserve the **`.site` token freeze** — any `:root` token change must be mirrored/guarded under `.site` or it reskins the marketing site.
- Preserve `CREATE EXTENSION vector` at the top of `drizzle/0000_*.sql` when regenerating.
- Don't read/rewrite the ~120k-token `lib/investors/data.ts` wholesale.
- Keep the Claude default `claude-opus-4-8`; don't downgrade models.

## Tie-breaker priority when two items score equally
Reliability > Data integrity > Completeness > Cohesion > UX > Maintainability.
(A broken/leaky thing beats a prettier thing.)
