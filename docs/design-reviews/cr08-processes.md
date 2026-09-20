# CR08 10.1 design review: Processes, Policies, and SOPs (`/processes`)

Self critique against the CR08 brief's design rules (tokens only, the `.card` language, logical
properties, ICU plurals, reduced motion, designed loading, empty and error states, keyboard and
focus, no HTML tables, no raw message keys) after driving the page in system Edge against the
shared dev server: both locales at 1440x900 and 390x844, every screenshot read back.

Evidence: `scripts/dev-probes/cr08-processes-probe.ts` (57 checks, 0 problems in the last run) and
`data/screenshots/cr08/processes-*.png` (map, Level 0 expanded, panel, mini shelf, RACI editor, add
dialog, edit dialog, by unit, by policy, plus the 390 map and panel, in `en` and `ar`).

## High

**H1. The add and edit dialog opened behind the process panel.** The shared `DialogContent` sits at
`z-50`; the process panel is a `fixed inset-0 z-[60]` drawer, like the Council's project drawer. A
dialog opened from the panel was therefore covered by it: the parent picker, the owner unit, the
Arabic name and the systems column were hidden and unclickable (visible in the first
`processes-edit-dialog-en.png`). Fixed in `ProcessEditor.tsx` and the delete dialog in
`ProcessesPage.tsx` by raising both to `z-[75]`, and in `ProcessPanel.tsx` by dimming the panel with
its own overlay while a dialog is open, so the dialog floats over a dimmed panel exactly as a radix
overlay does elsewhere. Verified by hit testing the dialog's centre (`elementFromPoint`), not by eye.

**H2. One Escape closed the dialog and the panel beneath it.** The panel's `keydown` listener guarded
on a `keyboardLocked` prop, but the dialog's own dismissal re-rendered the panel and re-subscribed
the listener with `keyboardLocked` already false, inside the same keystroke's dispatch, so the fresh
listener saw the event at the `window` stage and closed the panel too. The reader lost their place
on every cancel. Fixed by making Escape explicit: each dialog claims it
(`onEscapeKeyDown` calls `preventDefault` and closes itself) and the panel ignores a keystroke that
is already handled (`e.defaultPrevented`), keeping the prop as a second guard. Escape now closes the
dialog and keeps the panel; a second Escape closes the panel.

**H3. The unit head's person card opened invisibly behind the panel.** `OwnerControl`'s radix popover
is portalled to the body at `z-50`, under the panel's `z-[60]`, so clicking the head in the owner
block appeared to do nothing. Fixed inside the panel: while it is mounted it carries a scoped style
rule that lifts `[data-testid=person-card-popover]` to `z-index: 80` (radix copies the content's
computed z-index onto its positioning wrapper, so the rule reaches the wrapper too). The permanent
fix belongs in the shared component and is named in the report for the coordinator.

**H4. The page scrolled sideways at 390.** The document reached 1439px wide on the map views. Each
connector carries a screen reader word ("then", "ثم") as an `sr-only` span, and `sr-only` is
`position: absolute`: the map's scroll container was `static`, so those spans took their containing
block from an ancestor of the scroller, escaped its clip and stretched the page. Fixed by making the
scroller `relative`. (The defect had been masked: the 390 probe ran with `isMobile: true`, whose
emulation sizes `position: fixed` against the window rather than the 390px layout viewport, so both
the overflow check and the drawer measurement were meaningless. The probe now uses `hasTouch`
alone.)

**H5. A React error on every write.** `navigatePanel` wrote the URL (`history.replaceState`, which
the Next router listens to) inside a `setState` updater, which is a render. The console carried
"Cannot update a component (`Router`) while rendering a different component (`ProcessesPage`)" after
saving the add dialog. Fixed: the state is set, then the URL is written.

**H6. Level 0 titles were chopped mid word.** At 1440 the eight cards share one row, about 117px
each, and "National strategy development" and "International index monitoring" were cut to
"developmen" and "Internationa" by the clamp's `overflow: hidden`. Fixed by tightening the card
padding at `xl`, setting the display face to 13px there, clamping to four lines rather than three,
and allowing hyphenation and word breaking; a `title` attribute carries the full name on hover and
the `aria-label` already carried it for screen readers. Every seeded name now reads whole in both
languages.

## Medium

**M1. Deleting a process left a 404 in the console.** The panel was still mounted when the refresh
key bumped, so it refetched the code that had just gone, and the deleted process stayed in history.
Fixed: the delete closes the panel in the same commit as the refresh and replaces the URL.

**M2. The Arabic page printed English data tokens.** The KPI units and the interface cadences are
free text in the operating model data and were rendered as recorded: "95 percent", "per release".
Fixed with a small closed vocabulary in `shared.tsx` (16 cadences, 6 units) named in the reader's
language, falling back to the raw value for anything unknown, so the Arabic panel now reads
"المستهدف 95 بالمئة" and "مع كل إصدار". The steps' system names (Statistics Hub, npc.qa) are product
names and stay as they are.

**M3. Separators wrapped to the end of a line.** The Level 1 rows separated their counts with middots
inside a wrapping flex row, so a line could end on a lone "·". Fixed by spacing the counts instead.
The Level 0 card had the same problem in its document and interface counts, which also truncated to
"no docume..." at 176px: they now sit on two lines with no separator.

**M4. The editor's actions sat at the end of a 90vh scroll.** Save and Cancel are now a sticky bar at
the foot of the dialog, carrying any error message beside them, flush with the dialog's bottom edge
so no field peeks out beneath it.

**M5. Process names were squeezed by their own metadata.** In the by-unit column and in the unit
panel tab the rows are narrow, and the child count plus the document chip left a few characters for
the name ("Statistical rele..."). Only the document count travels with a row now.

**M6. The map rested on an empty half page.** Before a process is opened, the chain left about 380px
of nothing beneath it. A designed resting band now fills the place where the Level 1 panel opens
("Open a core process", with a line about what will appear), built from the `EmptyState` primitive.

**M7. The floating Ask NPC pill covered the panel's last lines.** The panel's scroll body carries
`pb-16` so the tail of the content can always be read past the launcher.

**M8. The panel fetched a process twice after a write.** React's development double effect plus the
forced reload both bypassed the in flight map. `fetchProcess` now shares one request per code,
forced or not.

## Low

**L1.** An orphan `sr-only` "Close" at the end of the panel body was read out after the last line;
removed (the close button carries its own `aria-label`).

**L2.** The purpose in the other language is an island: it must run in its own direction with its
label at its own start. Both locales are now asserted by the probe
(`direction`, `text-align`, and the label's measured position), and `text-start` is explicit so no
inherited alignment can turn the label around.

**L3.** A by-policy group holding a single document occupies half the row at `lg`. Left as it is: the
grid fills as units publish more, and a full width row for one book looks emptier still.

**L4.** The Level 1 grid leaves a gap beside a tall card that carries nested procedures. Left as it
is: a two column grid keeps the reading order, which a masonry layout would break.

## Checked and correct

- **Tokens only.** No raw hex anywhere in the module: maroon, sand, ink, gulf and gold tokens, the
  `.card` shadows and `--radius-card`, `--ease-paper` for motion.
- **RTL.** The chain mirrors, the connector heads flip (`flip-rtl`), the panel slides in from the
  start side, breadcrumb and row chevrons flip, the eyebrow letter spacing drops in Arabic, the map
  keyboard model swaps its forward key. Only logical properties are used (`ps`, `pe`, `ms`, `me`,
  `start`, `end`, `border-s`).
- **Keyboard.** Arrow keys move along the chain and within the Level 1 panel, Home and End jump,
  Enter expands, Escape unwinds one layer at a time (dialog, then panel, then the expanded chain),
  every interactive element has a gold focus ring, and the hint line states the model.
- **States.** Skeletons in the panel and the unit tab, designed empty states for the map, the Level 1
  list, the by-policy tabs and the unit tab, and a retry for a failed load.
- **Plurals and numbers.** Every count is an ICU plural with the six Arabic categories;
  `tnum` on every numeric line; dates through `formatDate`.
- **Motion.** 180 to 300ms, `--ease-paper` or the drawer's cubic bezier, every animation guarded by
  `useReducedMotion`, no bounce.
- **No HTML table.** The RACI row and the document lists are flex and grid with list semantics.
- **No raw message keys** on screen in either locale (asserted in the smoke suite), and no em dashes
  in the code, the copy or this file.

Closing: no High or Critical HIG findings remain.
