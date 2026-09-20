# CR08 9.1 design review: the owner control on the data, organisation and answer surfaces

Self critique against the CR08 brief's design rules (tokens only, the `.card` language, logical
properties, no raw message keys, focus rings, keyboard reachability, designed empty states, no
placeholder where there is no fact) after driving every surface in system Edge against the shared
dev server in both locales at 1440x900 and reading every screenshot back.

Scope of this pass: the organisation unit panel (header and People tab), the policy and SOP rows
(the Organisation's Policies tab and the Processes page's by-policy view and mini shelf), the Level 1
processes, the Statistics Hub indicator, the international index that mirrors a national series, the
search results, and the Ask NPC citation cards. `OwnerControl`, `OwnerControlCompact`, the person
card and `getOwnerRefs` were used as they are and not modified.

Evidence: `scripts/dev-probes/cr08-owners-data-probe.ts` (43 checks, every one passing; the only
entries in the last run's problem list were `ERR_CONNECTION_REFUSED` console lines from the shared
dev server rebuilding mid run, and the run before it was clean) and
`data/screenshots/cr08/owners-data-*.png` (organisation panel, person card, People tab, unit
policies, Level 1 panel with a second card open, by-policy view, statistics indicator, index,
search results with a card open, Ask conversation with a card open, in `en` and `ar`), plus
`scripts/smoke-cr08-owners-data.ts` (19 checks, all passing).

## High

**H1. A person card cannot live inside a link or a button, and three of these surfaces were exactly
that.** The search result row, the Ask citation card and the policy row all wrapped their whole
content in a `<Link>` (or, for a Level 1 process, in a `<button>`), so dropping the control inside
them would have nested interactive elements: invalid HTML, an unreachable card, and a click that
navigates instead of opening the person. Fixed by restructuring each row so the link and the control
are siblings: the row is a plain `div` that keeps the `.card` classes and the `data-testid`, the
title carries a stretched link (`after:absolute after:inset-0`, the pattern `ExpertCard` already
uses) so the whole row still opens the item, and the control sits after it with `relative z-[1]` so
it takes its own clicks. The Level 1 process keeps its button row untouched and gains a bordered
footer strip beneath it. Verified by clicking, not by eye: the chip opens the card and the URL does
not change; the row still opens `/vault/...` (`owners-data-search-card-*.png`,
`owners-data-ask-card-*.png`).

**H2. The person card had to paint above the unit panel and the Level 1 panel.** Both are surfaces
with their own stacking context. The card is portalled at `z-[80]`, above the drawers (`z-60`) and
the dialogs they open (`z-75`), so no shim was added anywhere in this pass. Verified by hit testing
the popover's centre with `document.elementFromPoint` on the organisation panel and on the processes
page in both locales, not by looking at the screenshot.

## Medium

**M1. The unit head lost its position line.** The header block showed the head's name and their
position; `OwnerControl` shows the name and the unit, and the unit is the panel itself, so the
position had nowhere to go. Rather than misuse the unit slot, the position stays as its own line
under the control, indented by `ps-[46px]` (the 36px monogram plus its gap) so it lines up with the
name instead of with the avatar. Same in the People tab's head row.

**M2. The indicator header wrapped and pushed "Brief me" off the end side.** Adding the department
owner made the header's end group wider than the space left by the title block, so the group wrapped
to a second line and started at the *start* side, moving an existing action. Fixed with `ms-auto` on
the group: it stays at the end side whether it sits on the first line (Arabic) or the second
(English). `owners-data-statistics-en.png` and `-ar.png`.

**M3. Nothing, not a placeholder, where nobody is recorded.** `OwnerControl` has an "unassigned"
state with a dashed monogram; on these surfaces an unknown owner is the normal case (no indicator
carries a department in the seed, the Level 0 processes are owned by a unit with no head account,
most search results are not documents), and a page full of dashed question marks would be noise
pretending to be data. Every placement is therefore conditional, and the smoke checks assert the
absence of `data-empty` on the pages where nobody is recorded.

**M4. An index is published by an entity, and an entity is not a person.** The responsible entity
chip (MOF, O1) stays exactly as it was; a person appears only when the index mirrors a Statistics Hub
series, and then it is that series' department owner, with the indicator (not the index) as the item
the card acts on, so "Copy link" and a message subject name the thing the person actually owns.

## Low

**L1. The custodian label beside the compact chip.** `OwnerControlCompact` carries no eyebrow, so a
policy row would have shown a bare monogram and name among version and visibility chips. A small
`text-[11px] text-ink-400` label reading the role from the shared `people.roles.custodian` key sits
before it, so the chip reads as a role and not as an author byline. No new i18n keys were added
anywhere in this pass.

**L2. The Ask sources sit under the floating composer.** The last citation rows of a conversation are
covered by the follow-up composer until the reader scrolls. That is the conversation page's existing
layout and not a consequence of this pass; the probe scrolls the last row into view before the
screenshot so the chips can be seen. Left alone rather than changing another module's page.

**L3. RTL.** Every placement uses logical properties only (`ps-`, `ms-`, `end`, `start`); the chips,
the eyebrows and the popover mirror correctly, and the Arabic role names come from the existing
`people.roles` namespace (`رئيس الوحدة`, `الأمين على المحتوى`, `الإدارة المالكة`). The probe asserts
no horizontal growth on every surface in both locales, and the smoke asserts that no raw
`people.roles.*` key reaches the Arabic page.

## Deliberate limitations

- The Statistics Hub indicators carry no `department_id` in the seed, so the department-head fallback
  shows nothing on `/statistics/<id>` and on the national index pages today. The probe sets one
  indicator's department for the length of its run (and restores it in a `finally`) so the surface
  could be built, photographed and read back. Filling that column permanently is a product decision,
  because `canReadResource` scopes a departmented row away from a Department Head of another
  department; it is named in the report for the coordinator.
- The Ask citation chip lights up for answers that come through `askStream` (`/api/v1/ai/ask`). The
  analyst pipeline builds its own `SourceRef` list, which has no owner yet; the renderer already
  handles both, because `owner` is optional. The one-line wiring is named in the report.

Closing: no High or Critical HIG findings remain.
