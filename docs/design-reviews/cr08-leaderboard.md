# Design review: CR08 Section 7, numeric levels and the Leaderboard (2026-09-19)

Scope: `/leaderboard` (the hero strip with the period label and the podium,
the board switch, the window chips, the category tabs, the People and
Departments lists with the pinned own row), the quiet-mode state, the
`/leaderboard/settings` shortcut to the Gamification settings tab, the level
chip and level card on the profile, and the progress ring caption on Home,
English and Arabic, reviewed as rendered screenshots in
`data/screenshots/cr08/leaderboard-*.png` at 1440 by 900.

## What was checked

- **Hero strip**: eyebrow, the title in the display face, a one-line
  subtitle that says where the numbers come from and how often they refresh,
  the period chip (the ISO week with its dates, the month, the quarter, the
  year, or "All time") and the category chip, the "Refreshed 12 minutes ago"
  caption with the ten-minute rule beside it, and the **Refresh now** button
  only for administrators. The three podium cards sit to the end side with
  the first place raised and edged in gold; silver reads through `ink-400`
  and bronze through `warn`, since the token set has neither metal and no raw
  hex is allowed. An empty place says "No one yet" with a dashed trophy.
- **Controls**: the People / Departments switch is a segmented control with
  `aria-pressed`; the five windows are chips with `aria-pressed`; the four
  categories are Radix tabs; every control carries a `data-testid`, a
  `cursor-pointer` and the gold focus ring. A hint line under the tabs says
  what the category counts and how much of the list the viewer sees
  ("Top 10 shown; your own position is pinned below", "Full list, 29
  people", "Top 10 plus every member of your unit").
- **People list**: a CSS grid with `role="table"`, `role="row"`,
  `role="columnheader"` and `role="cell"`, rank in the display face,
  monogram with the gold, silver or bronze ring and numeral, name with a
  "You" chip on the viewer, unit, the **Level N** chip whose descriptor
  shows only in a tooltip (hover and keyboard focus), points, and a trend
  glyph with a tooltip ("Up from rank 3", "New this period"). The viewer's
  own row is pinned at the bottom of the card and stays visible while the
  page scrolls (`sticky bottom-0`); when the viewer has no points the row
  says so, and an administrator reads that their account is not ranked.
- **Departments list**: rank with a medal dot, unit name with its code, points
  per member (the ranking measure), total, a share-of-active-members bar with
  "4 of 4", and the trend; the viewer's own unit is marked and pinned.
- **States**: skeleton rows while a switch loads, an EmptyState when nobody
  has scored in the period, an EmptyState with Refresh now when the table has
  not been built yet, an error state with retry, and the quiet-mode state: a
  calm moon, "The board is quiet for you", the explanation that colleagues
  still see the board and points still count, and a button to the profile.
- **Deep links**: `?board=&window=&category=` read on the server for the first
  render and written back with `history.replaceState` on every switch, so the
  URL always reproduces the view.
- **RTL**: the Arabic page mirrors completely: the podium keeps second, first,
  third in reading order, the trend column sits at the start, chips and
  eyebrows drop the letter-spacing, numerals stay Latin unless the person
  prefers Eastern Arabic numerals.
- **Profile and Home**: the level chip reads "Level 3" / "المستوى 3" with the
  descriptor in a tooltip, and the profile gains a small "Your level" card
  with the descriptor and the points to the next level; the Home progress
  ring keeps "Level N" as its caption with the same tooltip.
- **Settings**: the Gamification tab keeps the engine switch and every rule
  with its points and active switch, and adds the category chip per rule, an
  "On boards" switch per rule, the roles excluded from the People board as
  toggle chips, the quiet-mode rule, and Refresh boards now.

## Findings and fixes applied during the review

1. **High, fixed**: the column headers of the People list were shifted one
   cell to the start. The monogram column's header was an `sr-only` span,
   which is absolutely positioned and therefore takes no grid cell, so
   "Person" sat over the monograms and "Trend" over the points. The header
   cell now exists in the grid with only its label visually hidden.
2. **Medium, fixed**: on the Departments board a unit that had not scored in
   the period still earned a "New this period" sparkle, a medal dot and even
   a podium card (the Information Systems Department stood third with zero
   points per member on the all-time Learners board). Units are listed even
   at zero because Section 7.2 says every unit is listed, but a zero row now
   reads "Unchanged", carries no medal and never reaches the podium.
3. **Medium, fixed during the build**: the first screenshots were blank. The
   shared dev server rebuilds continuously while other agents edit, so the
   page's client bundle hydrated seconds after the HTML arrived and the
   `Reveal` entrance was still at opacity 0. This is a probe problem, not a
   product one (the page is server rendered and readable before hydration),
   and the probe now waits for every framer-motion entrance to finish before
   it captures. Recorded here so the next reviewer does not chase it.
4. **Low, fixed**: the settings tab's error state had a nonsensical label
   expression left over from drafting; it now reads "Try again".
5. **Low, fixed**: the "Refreshed 3 minutes ago" caption is the one text in
   the hero that legitimately differs between the server render and a late
   hydration (the shared dev server can take a minute to hydrate under load),
   and React reported it as a mismatch. The caption is now its own component
   with the mismatch suppressed on that span and a one-minute ticker so the
   wording stays true while the page is open. The two remaining hydration
   warnings the probe sees are outside this module: a Radix id on the top
   bar's notifications button (the shell) and a floating-point digit in the
   Home constellation path (CR03).
6. **Low, fixed**: the Arabic title said "لوحة الصدارة" while the rail entry
   the coordinator wired says "لوحة المتصدرين"; the page, the Home block, the
   settings section and the quiet-mode copy now use the rail's term.

## Deliberate choices

- **Departments are ranked by points per member**, not by total. Section 7.2
  lists "points per member" first among the unit columns, and a total would
  hand the board to the largest unit for ever; the total, the members and the
  share of active members sit beside it so the reader can see both.
- **The own row is pinned even when the viewer is already in the visible
  list.** The change request says "always", and the pinned row doubles as the
  place where a person with no points or an excluded administrator gets an
  explanation instead of an absence.
- **The podium is part of the hero, not a fourth section.** It is the one
  thing a visitor wants first, and keeping it beside the title means the list
  below starts with the header row rather than with three repeated names.
- **No "Illustrative" chip.** The seeded points history is a plausible spread
  of real rule types rather than authored content, and every action a person
  takes today changes the board at the next refresh.

Closing: no High or Critical HIG findings remain.
