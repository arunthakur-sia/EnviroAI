# Design review: CR06 Outcome stakeholders (2026-09-14)

Scope: the Outcome stakeholders section in the Living Strategy outcome panel
(department owner card, lead-entity chips, expert rows, the collapsed
sponsors/owners/managers row), EN and AR, reviewed as rendered screenshots in
`data/screenshots/cr06/`.

## What was checked

- Placement and rhythm: the section sits after the targets and the
  outcome-level initiatives, before the signals link, inside the panel's sand
  surface; the four groups reuse the CR05 eyebrow style
  (`text-[11px] uppercase tracking-[0.1em]`) and the project pages' row
  language (36/30px monograms, name + secondary-language name, organisation
  line, chip cluster at the end). No tables anywhere.
- Department owner: card row with the NPC emblem, both language names, the
  head's monogram and name, a "Department page" link, and "Set owner" for
  editors; the empty state is one line with the inline action.
- Lead entities: kind glyph + "MOF, 4" chips ordered by nodes led; the active
  chip inverts to maroon with a Clear-filter link, and the lanes, target
  counts, and the toolbar's lead select all follow the same `l=` state.
- Experts: direct assignments first with the gold "Outcome" chip, domain
  chips, "involved in N items" with the hover list, profile links and mail
  actions; first six with "Show all 37" expanding in place.
- Leaders: one collapsed row with a total, expanding to three columns
  (Sponsors, Project owners, Project managers) with per-person counts and
  contact links.
- RTL: the Arabic panel mirrors fully; Arabic plural categories render
  correctly (`مشارك في عنصر واحد` / `عنصرين` / `4 عناصر`); chips and rows flow
  right-to-left with logical margins.
- Hover affordances: an expert row's hover outlines the lane cards of their
  items in gold (`.lane-hl`, `outline` so layout never shifts); the
  involvement figure raises the item list.

## Findings and fixes applied during the review

1. **Medium, fixed** - the secondary-language name in the owner card hugged
   the primary name: `dir="auto"` flips the logical `ms-2` to the far side of
   an RTL span inside an LTR line. Replaced with symmetric `mx-2`.
2. **Medium, fixed** - six of ten departments had no head, so the owner card
   lost its monogram row on most outcomes. The CR06 seed now fills missing
   `head_user_id` deterministically from that department's own people
   (named accounts preferred over shared role logins).
3. **Low, fixed** - the first screenshot of the hover highlight targeted a
   direct-only expert whose single item is the outcome itself, so no lane
   card lit; the capture script now hovers an aggregated expert with several
   lane items.

Closing: no High or Critical HIG findings; the two Medium findings above were
fixed and re-verified in the final capture pass.
