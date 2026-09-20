# Design review: CR08 Section 10.2, the Operating Model (2026-09-20)

Scope: `/operating-model` end to end, the hero and the sticky section nav plus
the seven sections (operating principles, governance and decision rights, the
Level 0 process landscape, the RACI matrix, the planning and reporting ring
calendar, the external and internal interfaces with the chord diagram, and the
operational KPI scorecard), in English and Arabic at 1440 by 900 and at 390 by
844, as the Super Admin and as a department head (`head.stats@npc.qa`).
Reviewed as rendered screenshots in `data/screenshots/cr08/operating-model-*.png`
captured by `scripts/dev-probes/cr08-operating-model-probe.ts` against the
shared dev server, with the browser console and page errors collected on every
pass.

## What was checked

- **Hero**: eyebrow, the title in the display face (Fraunces in English, Noto
  Kufi in Arabic), the **Internal** and **Illustrative** chips with their
  explanations on hover, one paragraph that says what the page is, a line that
  tells the reader whether they may edit it, and the **Ask about the operating
  model** link. The section nav sticks under the top bar, numbers the seven
  sections, moves focus to the heading it jumps to, writes the hash, and marks
  the current section with `aria-current="location"`.
- **Principles**: six cards in an editorial band with the ordinal in the
  display face, the statement, and the reason under it; Edit and Delete for
  editors only; the Illustrative line closes the band.
- **Governance**: the bodies laid out in tiers (the Council, the Secretary
  General, then the committees), the decision flows drawn as SVG connectors
  over positions measured from the DOM after layout, so the map is correct in
  both directions without mirroring anything by hand. A card expands in place
  with its decisions, cadence, members and escalation path; the connectors
  re-measure when it does. The legend names the five connector kinds.
- **Process landscape**: the eight Level 0 processes as a chain of cards with
  owner unit, counts and the first Level 1 processes, each linking to
  `/processes?p=CODE`.
- **RACI**: a CSS grid with `role="table"`, `role="row"`, `role="rowheader"`,
  `role="columnheader"` and `role="cell"` (no HTML `<table>`), the process
  column and the header row sticky inside one scroller, rows grouped under
  their Level 0 parent, filters by Level 0 group and by unit, roving focus with
  the arrow keys, Home and End, Enter to cycle and Delete to clear, and the
  409 `accountable_exists` answered by a toast that names the unit that already
  holds the A.
- **Calendar**: the year as a ring, twelve month arcs with the count of events
  in each, one lane per event kind, single days as dots and windows as arcs,
  today marked, a hover tooltip and a click popover with Escape and focus
  handling, the month list beside it, the year switcher that fetches without a
  page reload and writes `?year=`, and the add, edit and delete dialogs for
  editors.
- **Interfaces**: ten entity cards (what NPC provides and receives, both focal
  points, legal basis, cadence, linked processes), the unit-to-unit matrix as a
  CSS grid with ARIA roles, the chord diagram beside it, the interface list
  with both focal people as OwnerControls, **Propose a change** for the heads of
  either unit, and the change request panel for the Strategy Office.
- **KPIs**: five tiles with the value and unit, the target, a RAG ring of
  attainment, a trend read in the KPI's good direction, a twelve point
  sparkline, and **Enter value** for editors.
- **Permissions**: a Contributor reads the page and sees no editing affordance,
  a department head sees **Propose a change** on the interfaces of their own
  unit only, a reader whose `portal:operating_model` is denied gets the
  friendly 404.
- **Contrast**: `node scripts/contrast-audit.mjs` passes on every token pair;
  the page uses tokens only, no raw hex except `#ffffff` as an SVG stroke
  against coloured marks.

## Findings and fixes applied during the review

1. **High, fixed**: React reported a hydration mismatch on the ring calendar.
   Node and the browser can differ in the last bit of `Math.sin` and
   `Math.cos`, so a server rendered `y="449.1416131783132"` met a client
   `y={449.14161317831326}`, React discarded the server tree, and every
   `useId` below it (the governance cards' `aria-controls`, a Radix id in the
   shell) was reported as a mismatch too. Every coordinate that reaches the
   markup in `CalendarRing` and `ChordDiagram` is now rounded to two decimals,
   including the numbers inside the generated arc and ribbon path strings. The
   page is clean in the console afterwards.
2. **High, fixed**: in Arabic the chord's centre caption sat outside the
   circle. The caption is positioned inside the LTR locked wrapper with
   `start-1/2` plus `-translate-x-1/2`, but it also carried `dir="rtl"`, so its
   own `inset-inline-start` resolved to the right edge while the transform
   still moved it left. The reader's direction now lives on an inner element
   and the positioned box keeps the wrapper's direction.
3. **High, fixed**: at 390 the hero's paragraph collapsed into a column about
   one word wide. The text block was `flex-1` (flex-basis 0) beside the Ask
   link, which keeps its width, so the row never wrapped and the text took
   whatever was left. The hero is a column below `sm` and a row above it.
4. **Medium, fixed**: the page scrolled horizontally by 37 pixels at 1440. The
   focal person placeholder on the entity cards was an `inline-flex` sized to
   its content, so its `truncate` child never truncated. It is now a
   `flex max-w-full` with `min-w-0` on the name, which also gained a `title`.
5. **Medium, fixed**: at 390 the calendar popover hung off the start edge of
   the screen when the event it belonged to sat on the left of the ring. Its
   anchor is now `clamp(8.25rem, x%, calc(100% - 8.25rem))`, so the box stays
   inside the ring on a phone and still points at its mark on a desktop.
6. **Medium, fixed**: the section nav never highlighted the last section. An
   IntersectionObserver picked the visible section nearest the top, and the KPI
   section is shorter than the viewport, so it can never reach the top. A
   scroll reader now takes the last section whose heading has passed under the
   top bar, and the last section once the page is scrolled to the end.
7. **Medium, fixed**: a RACI cell was `disabled` while its write was in
   flight, which dropped the keyboard focus in the middle of an edit, so the
   next Delete or arrow key went nowhere. The cell now carries `aria-busy`
   and stays focusable; a ref guard (not the state flag) keeps two fast clicks
   from starting two writes.
8. **Medium, fixed**: the KPI tiles read "Target 10days" and "Up from
   9.6days". A unit that is a word now takes a space and a unit that is a
   symbol stays against the number, in both languages. The trend line wraps to
   two lines instead of truncating, so "Unchanged from 94%" is readable.
9. **Medium, fixed**: the Arabic page showed English cadences ("monthly",
   "per survey") and English service levels ("Within two working days"). The
   change request gives `unit_interfaces` one `cadence` column and one
   `service_level` column rather than a language pair, so the seeded
   vocabulary is now translated in the component through `cadenceWords` and
   `serviceLevelWords` in the message fragment, and anything an editor types by
   hand reads exactly as written. Adding a phrase is one entry in each
   fragment plus its key in `shared.tsx`.
10. **Low, fixed**: the chord's centre caption and its hint were drawn straight
    onto the ribbons and were hard to read. Both now sit on a translucent
    plate with a hairline.
11. **Low, fixed**: at 390 the RACI process column took 248 of 390 pixels. It
    is now `clamp(9.5rem, 42vw, 248px)`, so a phone shows three or four unit
    columns instead of one.
12. **Low, fixed (probe, recorded so the next reviewer does not chase it)**:
    the probe drove the RACI with a locator that meant "the first blank cell in
    the first row", which moves as soon as a write lands, so it clicked three
    different cells and left rows behind. It now addresses the cell by its
    coordinates, waits for `aria-busy` to clear between steps, and
    `PROBE_CLEAN=raci` on the diagnostics script removes any cell a crashed run
    left, restoring the seeded 182.

## Conditions seen but not defects of this page

- The shared dev server restarts and recompiles under the other agents. A pass
  that lands in the middle of one reports `ERR_CONNECTION_RESET`, a
  `ChunkLoadError`, or a hydration warning caused by the message files being
  rebuilt; the same pass on a warm server is clean in both locales at both
  widths. The probe records these as notes rather than problems and names them.
- The browser logs the deliberate 409 from the second accountable unit as a
  failed resource. The page handles it with a toast; the probe records it as an
  expected refusal.
- The coordinator's sweep reported an HTML `<table>` in `RaciMatrix.tsx`. There
  is none: the matrix has always been a CSS grid with ARIA table roles, and the
  only matches for "table" in the file are `role="table"` and the comment that
  says no `<table>` is used. Nothing was changed for it.

## Deliberate choices

- **The ring calendar stays LTR in Arabic**, like every chart in the product:
  January sits at twelve o'clock and the year runs clockwise. Only the labels,
  the list and the popover mirror.
- **Section 3 draws its own Level 0 chain** rather than importing the Processes
  page's component. The two were built in parallel; the chain here is small,
  reads the same data and links to the same `/processes?p=CODE`, so the
  coordinator can swap one import when the sibling component settles.
- **One write at a time in the RACI**. A cell being written blocks the next
  write instead of queueing it, so the optimistic state can never overtake the
  server's answer. The cell shows the busy state and the click is simply
  ignored, which on a fast server is invisible.
- **The empty RACI cell shows a faint plus for an editor and a dot for a
  reader**, so the grid says at a glance whether it can be edited without
  adding a row of controls.
- **Governance tiers are computed, not stored**: a body sits one tier under the
  body it reports or escalates to. Adding a body to the settings row places it
  in the map without anyone drawing coordinates.

Closing: no High or Critical HIG findings remain.
