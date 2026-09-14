# SiaNexus Change Request 06
## Outcome stakeholders in the Living Strategy panel

Applies after Change Request 05. Small, focused change. Everything else stays as it is.

## 0. Run rules
Read `DECISIONS.md` and the Strategy Canvas components first. Run unattended. Keep tokens, motion, and the panel layout. Bilingual, RTL, screenshots into `data/screenshots/cr06/`. Typecheck, lint, build, smoke.

## 1. What changes
In the outcome panel (the panel that opens beneath the medallion arc), remove the single expert chip that currently sits at the bottom next to "N signals for this outcome". Replace it with an **Outcome stakeholders** section placed after the targets and the outcome-level initiatives, before the signals link.

## 2. Content and order
1. **Department owner**: the NPC department that owns the outcome (from `strategy_nodes.owner` at the outcome level; if the outcome has no department owner, show "No department owner set" with an inline "Set owner" action for editors). Rendered as a card row: department name (both languages), the head's monogram and name, a link to the department page.
2. **Lead entities**: the external entities and departments recorded as `lead` on the outcome's initiatives and projects (from `node_leads`), deduplicated, ordered by number of nodes led, shown as chips with the kind glyph and a count ("MOF, 4"). Clicking a chip filters the panel's lanes to that lead.
3. **Experts**: the experts recorded as stakeholders with role `expert` on the outcome itself and on its targets, initiatives, and projects (from `node_stakeholders`), deduplicated, ordered by number of nodes involved. Each as a compact row: monogram or portrait, name, organisation or department, the domain chip(s), and "involved in N items" with a hover list of the items. A link to the Expert Network profile and a contact action. Show the first six, "Show all" expands in place.
4. **Sponsors, owners, and managers**: a single collapsed row "People leading the work under this outcome" that expands in place to a grouped list (Sponsors, Project owners, Project managers) aggregated from the nodes beneath, deduplicated, each with a count and links.

Direct assignments to the outcome always appear first within their group, marked with a small "Outcome" chip, followed by the aggregated ones.

## 3. Data
No new tables. Add an aggregation query in the strategy service: `getOutcomeStakeholders(outcomeId)` returning the four groups, cached per request, with counts. Allow `node_stakeholders` rows with the outcome as `node_id` (they may already be allowed; if the editor blocks it, enable it) so an outcome can have directly assigned experts and a department owner.

## 4. Editing
Editors see "Add stakeholder" on the outcome section (same control as on project pages) and "Set department owner". Seed one department owner per outcome (from the existing department seeds) and two directly assigned experts per outcome.

## 5. Design
Same card and row language as the project Stakeholders section from Change Request 05, in the panel's existing width, with the section eyebrow style. Hover on an expert row highlights the items they are involved in within the lanes above (reuse the connection pub-sub if present). No table.

## 6. Ask NPC
`get_node(outcome)` returns the stakeholder groups, so "who are the experts on fiscal sustainability?" answers from this data with the counts.

## 7. Acceptance
1. The old single expert chip is gone from every outcome panel.
2. The section shows the four groups in order, with direct assignments first, deduplicated and counted; empty groups show a one-line empty state.
3. Lead entity chips filter the lanes; expert rows link to profiles and highlight their items on hover.
4. Editing and seeding work; RTL mirrors; typecheck, lint, build, and smoke pass.
