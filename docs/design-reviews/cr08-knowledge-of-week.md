# CR08 8: Knowledge of the Week, design review

A self-critique of the reveal, the Home strip, the set dialog, the Hall of Knowledge, the ribbons
and the profile award against the CR08 design rules (tokens only, logical properties, motion with a
reduced-motion guard, no HTML tables, loading and empty states, AA contrast, bilingual copy in
formal Modern Standard Arabic). Evidence: `data/screenshots/cr08/kow-*.png`, both locales, 1440x900,
captured with `scripts/dev-probes/cr08-kow-probe.ts` against the shared dev server, signed in as
`reader@npc.qa`, `knowledge@npc.qa` (the contributor of this week's pick) and `admin@npc.qa`. The
last run of that probe ends "no problems found": no raw message key on any screen, no horizontal
scroll at 1440x900, no console error and no page error from this module, the reveal is a focus
trapped modal that Escape closes, and the ribbon is present on a shelf book, on a lesson card and
on the search row of the pick in both locales.

## What was reviewed

| Surface | Screenshots |
| --- | --- |
| The first-open reveal | `kow-reveal-en.png`, `kow-reveal-ar.png` |
| The Home strip | `kow-strip-en.png`, `kow-strip-ar.png` |
| The set dialog with its live preview | `kow-set-dialog-en.png`, `kow-set-dialog-ar.png` |
| The replace confirmation | `kow-set-conflict-en.png`, `kow-set-conflict-ar.png` |
| The Hall of Knowledge | `kow-hall-en.png`, `kow-hall-ar.png` |
| The ribbon on a shelf book | `kow-shelf-ribbon-en.png`, `kow-shelf-ribbon-ar.png` |
| The ribbon on a lesson card | `kow-lesson-ribbon-en.png`, `kow-lesson-ribbon-ar.png` |
| The ribbon in search results | `kow-search-ribbon-en.png` |
| The award on the profile | `kow-profile-award-en.png`, `kow-profile-award-ar.png` |

## Findings

### 1. The reveal covered the page beneath it and nothing could be clicked (Critical, fixed in the probe, correct in the product)

`kow-set-dialog-failed-en.png` from the first pass shows the reveal open over the administrator's
page: the "Set as Knowledge of the Week" button under it never became clickable and the click timed
out. That is the reveal doing exactly what it is meant to do (a modal overlay with `aria-modal`, a
focus trap and a scroll lock), so the product is right and the probe was wrong. The probe now
dismisses the reveal before it uses the page beneath, and it does so again between hydration and the
click because the reveal mounts through a portal after hydration. No product change.

### 2. Two calendar glyphs side by side on the week field in Arabic (Medium, fixed)

`kow-set-dialog-ar.png` (first pass) showed a decorative `CalendarDays` icon next to the native date
input. In Arabic the browser's own calendar indicator moves to the start edge and landed right
beside it: two calendars, a hand's width apart. The decorative icon is gone; the native control
keeps its own indicator and the field now runs the full width of the column, aligned with the two
note fields under it.

### 3. The week choice did not say which weeks were already taken (Medium, fixed)

An administrator chose a week, wrote both notes, pressed Set and only then learned the week was
taken. The dialog now loads the schedule when it opens (`GET ?view=schedule`, administrators only)
and marks a taken week on its chip and under the custom date, in `text-warn` (5.8:1 on white,
5.1:1 on `maroon-100`). The replace confirmation is unchanged: the CR asks for confirmation before
replacing, and that is still where a replacement is agreed.

### 4. The title truncates on the Home strip (Low, accepted)

`kow-strip-en.png` shows "Labour Market Transitions of Qatari Graduates, 2019 to 2..." on one line.
The strip is a band, not a card: one line of title, the contributor under it, the read count and the
actions at the end. The full title is one click away and is spelled out in full in the reveal, in
the Hall and on the item. Truncation is `truncate` on a `min-w-0 flex-1` column, so it degrades
cleanly at every width instead of pushing the actions off the end.

### 5. The unit breadcrumb truncates in the reveal (Low, accepted)

"National Statistics Center / National Data Affair..." in `kow-reveal-en.png`. The breadcrumb is cut
to the last two levels by `unitPath()` and then truncated by CSS. Wrapping it would push the note
and the two actions below the fold at 900px, which matters more: the reveal must be readable and
dismissible without scrolling.

### 6. The Arabic date reads year first when scanned left to right (Low, correct)

`أسبوع 2026/09/14`. ICU's Arabic medium date pattern separates the fields with RIGHT-TO-LEFT MARKs,
so an Arabic reader reading right to left meets the day, then the month, then the year. It is the
shared `formatDate` from `@/lib/format` and the same shape as every other date in the app.

### 7. The native date input keeps the browser's own format (Low, accepted)

`09/28/2026` in both locales. `<input type="date">` renders its value in the browser's format, not
the page locale, and there is no way to change that without replacing it with a custom calendar.
The two week chips beside it carry the localised date, and the submit button repeats the chosen week
in full ("Set for the week of Sep 14, 2026" / "تعيين لأسبوع 2026/09/14"), so the localised form is
always on screen next to the raw one.

### 8. The third line of a lesson card's recommendation bleeds into its padding (Low, not this module's to fix)

Visible in `kow-lesson-ribbon-en.png` and `-ar.png`. `line-clamp-2` clips at the padding box, so a
sliver of the third line shows under the two clamped ones. It is in the shared `LessonCard` (CR02
3.1) and predates the ribbon this module added to the card's footer row. Reported to the
coordinator rather than fixed here, with the one-line change, so the lessons module keeps its file.

### 9. Ten points reached only the colleague who pressed "Read now" (Medium, component added, wiring left to the coordinator)

The change request pays ten points to "each reader who reads it in full during the week". Before
this pass that could only be earned by pressing "Read now" on the strip, in the reveal or in the
Hall: a colleague who found the pick on a shelf, in search or through a shared link read it and
earned nothing. `KowReadMarker` closes that: mounted on the item page, it asks the API whether this
item is the active pick, and when it is, counts a minute of attention with the tab in front (time
spent hidden does not count) or a scroll to the end of the page, then records the read once. It
draws nothing, so it changes no layout; the server still counts one read and one payment per person
per pick. The coordinator mounts it, as described in the report.

### 10. Console noise from other modules on the shared dev server (Low, not this module's)

The probe records to `data/screenshots/cr08/kow-console.log` but does not count:
`UnhandledSchemeError` for `node:worker_threads`, `node:zlib`
and friends, from a handover client component that pulls `undici` into the browser bundle through
`services/signals`; and a Radix `id="radix-_R_..."` hydration attribute mismatch on the top bar's
Notifications and Account menus, present on every page of the app. Both are in the report for the
coordinator. No Knowledge of the Week page produced a console error or a page error of its own.

## Against the rules, point by point

- **Tokens only.** No raw hex anywhere in the module. The gold family carries the honour
  (`gold-500` on the ribbon, the star and the rules, `gold-300` borders, `gold-100` fills), maroon
  the actions, `warn` the two cautions. The contrast audit passes on every pair it checks, and the
  one new pair this module introduces, `warn` on white, measures 5.80:1.
- **RTL.** Logical properties throughout (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`,
  `inset-inline-*` in the shelf ribbon's inline style, `border-s` on the Hall's note rule). The two
  arrows carry `flip-rtl`. Every screenshot has an Arabic twin and the layouts mirror: the strip's
  gold rail, the shelf ribbon, the reveal's close button, the dialog's two columns, the Hall's
  featured card and its month rows.
- **Motion.** The reveal fades the ground in 220ms and lifts the panel 28px in 280ms with an ease
  out and no bounce; `useReducedMotion()` drops both. The Hall staggers its month grids at 0.04s a
  card through the shared `Stagger`.
- **No HTML tables.** The Hall is a CSS grid of cards, the schedule a list of links.
- **States.** The set dialog's preview has a Skeleton while it loads and a line of copy when the
  item cannot be prepared; the Hall has an EmptyState with a designed line for a Council that has
  never picked, and a quieter line for the first week; the strip and the reveal render nothing at
  all when there is no active pick or the viewer may not read the item.
- **Keyboard and assistive technology.** The reveal is `role="dialog" aria-modal="true"` with a
  labelled title, focus moved to "Read now" on open, Tab and Shift+Tab trapped inside, Escape and a
  click on the ground both dismissing, focus returned to where it came from, and the page behind
  locked from scrolling. The ribbon is a labelled chip; on a shelf book it is decorative and the
  honour is spoken through the book link's `aria-label`. Every icon button has an `aria-label`,
  every clickable non-button has `cursor-pointer`, and focus rings are the gold outline.
- **Illustrative content.** Seeded picks carry the `Illustrative` chip in the reveal, in the Hall's
  featured card and on every archive card, read from the `kow_seeded` setting the seed writes.
- **No em dashes or en dashes** in the code, the comments, the copy or this document.

Closing: no High or Critical HIG findings remain.
