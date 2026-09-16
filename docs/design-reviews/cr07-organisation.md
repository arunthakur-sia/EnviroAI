# Design review: CR07 Organisation module (2026-09-16)

Scope: `/organisation`, the org chart and the unit panel with its Policies and
Procedures tabs, English and Arabic, reviewed as rendered screenshots in
`data/screenshots/cr07/`.

## What was checked

- **The chart**: the Secretary General at the top, then every published level,
  cards in the Strategy Canvas language (unit name in the reading locale with
  the other language beneath in ink-400, the head's monogram and name,
  headcount, a policy chip), SVG connectors in the `--connection` token
  measured from the real DOM boxes.
- **Zoom, pan, fit, mini-map, collapse, search, list view**: wheel zoom
  anchored at the pointer and clamped, drag to pan with pointer capture,
  fit on arrival, a mini-map that tracks the viewport, per-branch collapse
  with a hidden count, search that rings matches and dims the rest, and a
  list view that carries the same information for narrow screens and for
  people who do not want a canvas.
- **The unit panel**: the same in-place pattern as the outcome panel, with the
  pointer tail, `?unit=<code>` in the URL and a history entry per selection.
  Mandate verbatim in both languages side by side with the source link and the
  fetch date, the HR responsibilities beneath it, the head and every person in
  the unit, what the unit owns across five modules, the sub-units, and the four
  policy tabs.
- **Policies and Procedures**: four tabs with counts, books for the items,
  version label, effective date, visibility chip, review-due warning, a
  designed empty state per tab that differs for people who may add and people
  who may not, the Add link that pre-sets the Vault upload form, and the
  three-way visibility control with a bulk bar.
- **RTL**: the Arabic page mirrors completely; the chart's measured geometry is
  pinned to a physical left origin so the connectors land identically in both
  directions.

## Findings and fixes applied during the review

1. **Critical, fixed** - the chart could not be read. All thirty two
   departments were laid out in one row, making the stage 2540 pixels wide, so
   fit-to-width landed on the zoom floor of 0.4 where no card is legible, and
   the tree still overflowed the frame. Two changes: children that lead nowhere
   now stack down the page in one column while children that carry their own
   branch run across it (which is how npc.qa itself draws the chart), and the
   sectors arrive collapsed so the first view is the Secretary General, the
   units reporting to them and the six sectors. The stage is now 1718 by 913
   and fits at 0.70, where every card reads.
2. **High, fixed** - the whole module 404ed for every account. The `council`
   and `organisation` portals were added to the portal list in code, but the
   roles carry a stored `portals_json` from the CR05 seed which did not include
   them, and `visiblePortals` honours the stored set. A seed step now appends
   both portals to every stored role set in rail order.
3. **Medium, fixed** - fit-to-width ran once against a stage measured before
   the fonts had settled, locking in a stale width. The fit now re-runs on
   every remeasure until the reader zooms, pans or presses a zoom control, at
   which point the framing is theirs.
4. **Low, fixed** - the policy chip read "1 policies". Both languages now use
   ICU plurals, with the full Arabic category set.

## Accessibility: what Lighthouse still reports, and why

The page scores **91 for accessibility and 100 for performance** at 1440,
above the change request's gate. Two audits still report, both deliberately:

- **target-size on the branch toggles.** The toggle is 24 by 24 CSS pixels,
  which meets WCAG 2.2, but the chart arrives fitted at 0.70 scale, so the
  rendered box measures about 17 pixels and Lighthouse measures what is
  rendered. Growing the control to 36 pixels so it survives the fit would put
  a heavy pill on the bottom edge of every card. The **list view** carries the
  same collapse control at full size and is the equivalent mechanism WCAG
  allows; it is also the default below 900 pixels wide.
- **colour-contrast on the secondary-language name.** Section 3.4 specifies
  that name "in `--ink-400`", which measures about 3.1 to 1 on white. This is
  the same deliberate deviation recorded in DECISIONS 34 and 54 for shelf
  counts, made here because the change request names the token explicitly. The
  name is always present in the reading locale at full contrast directly above
  it, so no information depends on the faint line alone.

## Deliberate deviations

- **The mandate text keeps the punctuation of its source.** Section 0.1 and 3.4
  require the mandate verbatim, and a few of the published English paragraphs
  contain em dashes. The repository's no-em-dash rule governs text we author;
  quoted source text is reproduced as published. The Arabic mandates are
  unaffected.
- **Policies and Procedures ships with seven real items across four units, not
  empty everywhere.** Section 3.5 asks for an empty structure ready for content,
  and thirty five of the thirty nine units do show their designed empty state.
  A small seeded set covering all four tabs and all three visibility scopes is
  what makes the visibility model demonstrable and testable, which acceptance
  check 3 requires.

Closing: no High or Critical HIG findings remain; the four findings above were
fixed and re-verified in the final capture pass.
