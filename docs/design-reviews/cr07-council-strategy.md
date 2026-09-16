# Design review: CR07 Council Strategy (2026-09-16)

Scope: `/council-strategy`, the header and strategic direction band, the
scorecard strip, the results chain navigator, the project drawer, the results
matrix, and the six reference sections, English and Arabic, reviewed as
rendered screenshots in `data/screenshots/cr07/`.

## What was checked

- **Header**: the strategy name in the display face, the period, the approval
  date, the owning Strategy Office linked into the Organisation module, the
  **Internal** chip on every screen of the module, and the **Illustrative**
  chip that stays until a real strategy replaces the seeded one.
- **Strategic direction band**: vision and mission as two editorial blocks,
  the five values as chips that expand in place to their descriptions.
- **Scorecard strip**: five medallion rings in the Strategy Canvas language,
  with the period switch recomputing them for the matching cadence. Where a
  goal has no indicator of the chosen cadence the ring says so in words rather
  than showing an empty ring, and the counts of the other cadences are printed
  beneath ("10 reported monthly", "17 reported quarterly"), which is exactly
  what Section 2.4.3 asks for.
- **Results chain navigator**: the goal panel opens beneath the strip with the
  pointer tail sliding to the selected ring, carrying the description, the
  owner unit, the alignment chips into NDS3, the goal's indicator tiles, and
  its intermediate outcomes; those expand in place to outputs, and outputs to
  projects, one open per level, with arrow-key movement and Escape to collapse.
  A sticky rail of the five rings appears when the strip scrolls away.
- **Indicator card**: the full card from the manual's vocabulary (definition,
  formula, unit, direction, baseline, cadence, data source, means of
  verification, responsible person, notes) with a target-against-actual chart
  drawn in an LTR wrapper so RTL never mirrors the axis.
- **Results view**: goals by period as a CSS grid with `role="grid"` (never an
  HTML table), RAG cells carrying the percentage, an icon and a trend arrow, a
  legend that explains every symbol, and a results narrative composed from the
  reported figures with a line saying no model was in the loop.
- **Reference sections**: SWOT as four labelled quadrants, the stakeholder map
  as an interest-against-influence scatter with named quadrants, challenges
  tied to their goal, the baseline, the implementation timeline grouped by
  department, the monitoring framework as cards with a reporting calendar, the
  5 by 5 risk heat map with a filterable list, the governance bodies, and the
  impact-against-feasibility scatter with draggable dots.
- **RTL**: the Arabic page mirrors completely, rings included, and every SVG
  sits in an LTR wrapper so measured geometry is identical in both directions.

## Findings and fixes applied during the review

1. **High, fixed** - the risk register threw an internationalisation error on
   every render: a status label was read from `common.status`, which is an
   object of status names, not a string. It now reads its own key.
2. **Medium, fixed** - the results view kept a second copy of `ragOf` and
   `periodRange` because the service module opens the database at import time
   and cannot be imported by a client component. Both now import
   `src/lib/council-math.ts`, so the matrix on screen and the one the API
   builds cannot drift apart.
3. **Medium, fixed** - the project drawer had no stakeholder section even
   though the seed writes 284 council stakeholder rows. `getCouncilProject`
   now returns them through the shared `loadStakeholdersFor`, and the drawer
   renders the same six-role section the delivery projects use.
4. **Low, fixed during the build** - Extract report and Listen had no council
   scope, so both degraded. `council_node` is now a real report scope (the
   report floors at classification Internal, so the footer says so) and a real
   podcast scope that gathers through the council analyst tools.

## Deliberate deviations, all recorded in DECISIONS.md

- **The results chain keeps the change request's five levels, and takes the
  manual's Arabic labels where the manual has the matching concept.** The
  manual's own chain is longer and differently ordered, and it has no concept
  of five strategic goals for an entity. Section 2.2 says to use the manual's
  labels; the labels are the manual's, the shape is the change request's,
  because the data model, the page design, the URL state and the analyst tools
  in Section 2 are all built on that shape.
- **The indicator card is richer than the manual's.** The manual specifies only
  a subset of the fields; the extra ones come from Section 2.2.4 and are marked
  as such in DECISIONS.md.
- **The risk scale and the prioritisation matrix are the change request's.**
  Neither appears in the manual at all.

Closing: no High or Critical HIG findings remain; the four findings above were
fixed and re-verified in the final capture pass.
