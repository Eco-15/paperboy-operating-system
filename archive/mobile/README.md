# Retired phone tabs (Route / Network / Desk)

Archived 2026-07-31, when the mobile PWA at `/m` was cut down to the Investment
CRM and nothing else. **Hidden, not deleted** — these are kept verbatim so the
old four-tab app can come back if it's ever wanted.

Nothing here is compiled or shipped: `tsconfig.json` excludes `archive`, and
Next only bundles what a route actually reaches. The live phone app is
`components/mobile/`.

| File | What it was |
|---|---|
| `FullShell.tsx` | The four-tab `MobileShell` — tab bar, view transitions, news + person sheets |
| `RouteTab.tsx` | Landing tab: masthead, the news wire, desk rows, deal strip, pull-to-refresh |
| `NetworkTab.tsx` | Founders + investors, alphabetised with letter headers |
| `DeskTab.tsx` | Account card, links into the full OS, sign-out |
| `PipelineTab.tsx` | The pre-rework deal list (superseded by `components/mobile/CrmTab.tsx`) |

## Reviving them

These files are frozen at the moment they were pulled out, so they do **not**
compile against the current `components/mobile/`. Last commit where the
four-tab app built: **`36b48b41`**.

1. **Imports.** They still use sibling paths (`./data`, `./icons`, `./Sheet`,
   `./DealSheet`, `./mobile.module.css`) that now live one directory up in
   `components/mobile/`. Repoint or move the files back.

2. **Six `data.ts` exports were removed** with the tabs — restore from
   `git show 36b48b41:.../components/mobile/data.ts`:
   `NewsPayload`, `NewsItem`, `NetworkPayload`, `Person`, `EventsPayload`, `ts`.

3. **42 CSS classes were removed** from `mobile.module.css` — restore from
   `git show 36b48b41:.../components/mobile/mobile.module.css`:
   `tabbar`, `tabBtn`, `tabBtnActive`, `tabLabel`, `tabDot`, `masthead`,
   `brand`, `routeLine`, `dateLine`, `sectionHead`, `sectionTitle`,
   `sectionLink`, `newsCard`, `newsTitle`, `newsMeta`, `srcChip`, `catChip`,
   `deskRow`, `deskDot`, `deskLabel`, `deskChevron`, `deskPane`, `deskHeading`,
   `stripRow`, `miniCard`, `miniCo`, `miniMeta`, `miniStage`, `pipeHead`,
   `netHead`, `letterHead`, `personRow`, `personMain`, `personName`,
   `personMeta`, `kindChip`, `kindFounder`, `kindInvestor`, `tileIcon`,
   `actBtnPrimary`, `actBtnAccent`, `whyLabel`.
   Note `--pbm-tabbar` was also replaced by `--pbm-bottom`, and `.pane` no
   longer reserves room for a tab bar.

4. **`FullShell` predates the CRM rework.** It has none of: push notifications
   (`PushToggle`), the sort sheet, the "new responses" tray, scope counts, or
   `usePullToRefresh` (its pull-to-refresh is inline in `RouteTab`). Merging it
   back means reconciling with `components/mobile/MobileShell.tsx`, not
   replacing it.

5. The APIs they read — `/api/dashboard/news`, `/api/network`, `/api/events` —
   are all still live and untouched.
