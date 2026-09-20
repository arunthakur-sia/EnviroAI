# Design review: CR08 Section 4, the Indices board with groups and Settings > Indices (2026-09-19)

Scope: `/indices` (the group switcher, one section per group with its colour
cue, the per-group summary strip, cards, the per-group table toggle, the SDG
headline tile, the Super Admin edit mode), `/indices/[code]` (group chips,
the SDG chip, the national target line, the Ask NPC context marker), and
Settings > Indices (the group manager and the three-step Add index wizard).
Reviewed as rendered screenshots in `data/screenshots/cr08/indices-*.png` and
`index-page-*.png` at 1440x900, English and Arabic, captured by
`scripts/dev-probes/cr08-indices-ui-probe.ts` in system Edge against the
shared dev server after the data agents' seed had landed (65 active indices
across the nine groups, the SDG Index headline at 66.4 and rank 101 of 169).
Twenty-one captures were re-taken and read one by one in the closing pass;
findings 11 to 13 below came out of that reading, and every stage of the
probe (`board`, `settings`, `index`, `ar`, `reader`) now finishes with no
console or page errors and every assertion passing. The database is left at
the seeded state: nine groups with 18, 12, 8, 5, 9, 6, 2, 3 and 5 members and
65 active indices, verified by `cr08-indices-ui-dbstate.mjs`.

## What was checked

- **The switcher**: All with the total, then every active group with its
  member count and a dot in the group's colour token; the active pill takes
  the token's wash and ring; `?group=<code>` deep links, and the row is a
  `tablist`.
- **The sections**: a 4px bar in the token, the eyebrow (the count) in the
  token's text colour, the Fraunces heading, the description, then the group's
  own strip (improving, stable, declining, GCC leads) computed from the latest
  two observations of each member, then the cards or the table. An index in
  two groups (EGDI, NRI, GTCI) appears in each. Indices in no group gather in
  an "Other indices" section so nothing vanishes.
- **Cards**: the CR05 rendering kept whole (value, sparkline, change, GCC
  chip, entity, target code), extended with the SDG goal chip on its official
  colour, the national target line ("Target 75 by 2030, 19.6 to go"), the
  Statistics Hub chip for indicators whose values come from a series, and a
  "Forecast off" chip.
- **The table**: a CSS grid with `role="table"`, sortable column headers
  carrying `aria-sort`, rows focusable and openable with Enter; no `<table>`
  anywhere new (the forecast summary and the Settings register were rebuilt
  the same way).
- **Edit mode**: a gold "Edit groups" state with a hint band; cards become
  draggable with a grip, dashed drop zones per section that light in the
  group's wash, a "Move to / Also add to" menu and a remove button on every
  card as the pointer-free path, and up/down arrows on each section to reorder
  groups. Every change is one PUT and a toast; the probe moves a card from
  Governance to Human Development by drag, reads it back through the members
  API, and returns it through the card menu.
- **The index page**: the group chips link back to the board filtered on that
  group; the SDG chip carries the goal title; the target line sits under the
  chips; the what-if simulator, the fan chart and the benchmark are untouched.
- **Settings**: the group manager (add, rename both languages, describe,
  colour from the six tokens, drag or arrow reorder, archive with a show/hide
  of archived rows) and the wizard (basics with groups, targets, entity and a
  linked series; data by paste, upload, publisher URL or manual rows with a
  server preview and its warnings; forecasting with mode and target), run
  through to a committed index that is then deactivated.
- **RTL**: logical properties throughout, the sparkline and chart wrappers
  pinned LTR, eyebrows lose their letter-spacing in Arabic, the drag handle
  and the menus mirror, numbers in the table sit in LTR isolates.

## Findings and fixes applied during the review

1. **Medium, fixed**: a target on a ranked index was compared with the score.
   The wizard's test index (rank 25, score 64, target 15) read "target met"
   because the gap used the score whenever one existed. A target on a ranked
   index is a rank ("top 15") unless the index is forecast on its score, and a
   national indicator's target is a score; `src/lib/index-targets.ts` now
   decides this once from the forecast mode and both the board card and the
   page use it, so the same index reads "10 to go" in both places.
2. **Medium, fixed**: the gold token failed AA as text. `gold-500` on white
   measures about 2.4:1, so an eyebrow in the group's colour would have been
   illegible for the Competitiveness and Digital groups. The token style map
   (`src/lib/sdg-colours.ts`) pairs the gold bar and chip with the `warn` ink
   for text (5.09:1 per `contrast-audit.mjs`); every other token uses its own
   600-weight ink, all above 5:1.
3. **Low, fixed**: the wizard's code hint contained the literal `<code>`,
   which next-intl parses as a rich-text tag; the field showed the raw key
   `settings.indicesTab.wizard.codeHint` with an IntlError in the console.
   The hint is reworded in both languages.
4. **Low, fixed**: a national indicator's page opened its History chart in
   the Rank view and drew nothing, because the series has scores only. The
   view now opens on scores when Qatar has no ranks (SDG goals and national
   indicators), on ranks otherwise.
5. **Low, fixed**: an empty group showed a strip of four zeros above its empty
   state, which read as data. The strip renders only when the group has
   members; the empty state's line says where members come from.
6. **Low, fixed**: the Latest tile said "of -" for manual rows that carry no
   field size; it now says "Rank" when the size is unknown.
7. **Low, fixed**: in the Arabic table, signed changes rendered as "3-" and
   "1+" and the rank as "213 / 38" because the digits sat in an RTL run; both
   cells wrap their numbers in an LTR isolate, so they read "-3", "+1" and
   "38 / 213" in either direction.
8. **Low, fixed**: the CR05 index page joined forecast ranges with an en dash
   in four places (the range tile, the fan chart tooltip, the histogram
   titles); they now read "0.75 to 1.00" through a translated `forecast.to`.
9. **Low, fixed (performance)**: the board shipped every index's full
   forecast simulation (histograms, residuals, contributions) into the client
   props, 1.4 MB of HTML for 65 indices. The board service now selects only
   the headline forecast columns and the +3 explanation; the same page is
   0.8 MB.
10. **Harness, recorded**: every string-based `page.evaluate("(x) => ...")`
    in the probe returned the function unserialised instead of calling it,
    so the hydration wait, the scroll into view and the dispatched drag
    events were all no-ops in the early runs, which produced false "drag did
    not register" results and two blank captures (framer's Reveal renders
    opacity 0 on the server and animates in after hydration). Page functions
    are now self-invoking expressions, and captures wait for React's fiber
    keys plus the 320 ms entrance. The lesson is written into the probe and
    the drag debug script for the next agent.

11. **Medium, fixed**: the unit was appended to the whole target sentence
    instead of to its value, so the Qatari Labour Force Participation Rate read
    "Target 75.0 by 2030 percent". `TargetLine` in `board-shared.tsx` now
    builds "75.0 percent" first and passes that as the message's `{value}`, so
    the card and the page read "Target 75.0 percent by 2030, 19.6 to go" in
    English and keep the same order in Arabic.
12. **Medium, fixed**: a forecast tile with a rank headline showed a score
    range. EGDI read "#51" over "Range: 0.75 to 1.00" and SDG 3 read "#21" over
    "Range: 91.4 to 93.5", two different quantities stacked as if they were
    one. The tile now picks the bounds that match its headline (`rankLow` and
    `rankHigh`, which every one of the seeded rank forecasts carries), orders
    them low to high, and prints them as ranks: "#21" over "Range: #20 to #29".
    A score headline is unchanged. In the what-if rank fallback the simulator
    already works in negated scores, so its own bounds are the rank bounds.
13. **Low, fixed**: a target on an index that has both ranks and scores is
    ambiguous, and the wizard gave the administrator no way to know which way
    it would be read. Nothing seeded hits this (all six seeded targets are
    national indicators on `target_gap` with scores only, confirmed by
    `cr08-indices-ui-targets.mjs`), but an administrator creating a ranked
    index with a target does. Step 3 now states the basis under the target
    field, from the same `targetIsRank` rule the board and the page use:
    "This target reads as a rank: the card and the page will show how many
    places are still to climb."
14. **Harness, fixed**: three separate probe defects were making correct
    behaviour look broken, which is worth recording because the next agent
    will meet the same shared dev server. `page.request` does not inherit
    `page.setDefaultTimeout` and kept its own 30s limit, so a cold
    force-dynamic route timed out; `waitForURL` never resolves for the group
    switcher's `router.replace`, which is a same-document navigation, so the
    deep link is now watched by polling `location.search` in the page; and a
    membership PUT is fired from the UI with nothing awaiting it, so reading
    the API once after a drag caught the state before the write committed.
    Every membership assertion now polls instead of reading once, and the
    click helper re-clicks only when `aria-selected` shows the click never
    landed (re-clicking a toggle tab otherwise switched the group back off).
15. **Harness, fixed**: rewriting the probe with PowerShell's
    `Get-Content`/`Set-Content` corrupted its two Arabic literals to mojibake,
    which then went into the group dialog and the wizard as the probe's own
    input and showed up in the screenshots as broken Arabic. The literals are
    restored and the file is only edited through tools that write UTF-8. The
    product was never at fault, but the capture was not evidence until it was.

## Known, outside this module

- Opening Settings with `?tab=indices` logs "Hydration failed because the
  server rendered HTML didn't match the client": the shared `SettingsTabs.tsx`
  reads the query string inside a `useState` initialiser behind a
  `typeof window` branch (the CR05 deep-linkable tabs), so the server renders
  the Users tab and the client the Indices tab. The probe names it rather
  than counting it, and it is reported to the coordinator.
- The shared `AppShell` top bar (the locale link, the CR08 inbox link and the
  notifications Dropdown, `AppShell.tsx` around line 484) intermittently
  hydrates with a different unread count than the server rendered, and React
  reports it as an attribute mismatch whose component stack ends in the Radix
  menu. `cr08-indices-ui-shellcheck.ts` loads `/home`, `/experts`, `/indices`
  and `/statistics` and finds them identical, so it is not this module's. The
  probe names it on the console and does not count it; it is reported to the
  coordinator. The same script showed a second, separate mismatch inside
  `HomeBoard` on `/home`, which is why the probe no longer visits `/home` at
  all: the session cookie is already in the browser context after the login
  POST, so each stage navigates straight to the page it is testing.
- `npx tsc --noEmit` is clean for every file in this module. The one error
  that remains in the tree, `src/components/nexus/processes/shared.tsx(181)`,
  belongs to the Processes agent.

## Deliberate choices

- **The whole-board strip stays in the All view** above the sections, in a
  white card rather than the sand strip the groups use, so the two levels of
  summary read as different things.
- **Empty groups are shown, not hidden.** A section with a designed empty
  line is more honest than a switcher pill that leads nowhere, and edit mode
  needs the empty zone as a drop target.
- **The SDG Index record is a headline, not a card.** The goals are the cards
  of the SDG group; the overall score and rank sit in a tile above them with
  the source link, so the group never shows eighteen cards.
- **Moving between groups is a move, adding is explicit.** A drag removes the
  card from the source group; "Also add to" in the card menu is how an index
  joins a second group, because multi-membership is the exception and a drag
  that silently copied would leave stale cards behind.
- **The wizard commits what it previewed.** The rows the administrator saw in
  the preview are the rows written, sent back as manual rows with their
  origin recorded, so a publisher URL is fetched once and never re-fetched at
  commit time.

Closing: no High or Critical HIG findings remain.
