# CR08 9.1 owner placement: the strategy and council surfaces

Self-critique of the placement pass that puts `OwnerControl` and `OwnerControlCompact` on
every strategy and council item that records a person. The component itself, its types and the
bulk loader were finished by the People and messaging agent and are untouched here.

Surfaces covered: the strategy node detail page (outcomes, targets, initiatives, projects), the
Strategy Canvas (outcome panel header, target lanes, outcome-level lane, Outcome stakeholders),
the outcome slug page, the node drawer and its payload route, the strategy KPI cards, the
Council Strategy chain (project cards), the council project drawer and the council indicator
dialog, plus the shared Stakeholders section that all of them render.

## Findings and how they were fixed

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | Critical | A person card opened from inside the node drawer or the council project drawer was dismissed by Escape together with the drawer itself, because both drawers closed on a window `keydown` without asking whether an overlay above them owned the key. | Both drawers now ignore a keystroke that is already handled or that lands while a person card (or any Radix dialog) is open, which is the DECISIONS 117 rule applied to the new layer. A probe check asserts Escape closes the card and leaves the drawer open, in both locales. |
| 2 | High | The council indicator dialog, opened from inside the project drawer, painted at z-50 under the drawer at z-60: half of it was hidden, and the custodian chip this pass adds to it sat behind the drawer. | The dialog rises to z-75 when it is opened over a drawer and the drawer dims itself, so the page still reads as one stack (the ProcessEditor precedent). |
| 3 | High | The control renders a `<button>`, so putting it inside the lane cards, the outcome-level cards and the council project cards would have nested a button in a button. | Each card was restructured: the card frame is a `div`, the clickable area keeps its `<button>` and its testid, and the person chip is its sibling inside the frame. Nothing about the click target, the keyboard path or the existing testids changed. |
| 4 | Medium | In the shared Stakeholders section, a row with an account lost its column: the organisation line started under the monogram rather than under the name, and the monogram was 36px against the chip's 28px, so a mixed roster read ragged. | The organisation line is indented by the chip's monogram and gap, and the fallback monogram takes the chip's size, so rows of both kinds keep one column. The same fix was applied to the Outcome stakeholders expert rows. |
| 5 | Medium | The department owner card in the Outcome stakeholders section printed the department name twice: once as the card's title and again as the head's unit line. | The unit is blanked on the chip only when it is exactly the department already named above it; a head recorded in another unit still shows it. |
| 6 | Low | In a row of cards, the chips sat at different heights because the titles wrap to a different number of lines. | The chip is pushed to the bottom of the card (`mt-auto`), so a row of cards keeps one line of people. |
| 7 | Low | The KPI custodian would have had nothing to show: `kpis.owner_user_id` has existed since CR02 and was never filled. | A small idempotent seed (`scripts/cr08-owners-strategy-seed.ts`) records the head of the department that leads the KPI's node as its custodian, only where no custodian is set. No column, no migration. |

## Not fixed, and why

- **The canvas grows 37px sideways in both locales.** The last medallion's hover card
  (`w-72`, centred on the medallion, CR04) reaches past the viewport; in Arabic this shows as a
  clipped rail. It is unrelated to this pass (the width probe names only that element and the
  off-screen Ask panel), it sits in another agent's feature, and a correct fix needs collision
  aware placement rather than a clamp. Reported to the coordinator instead. Every person chip
  this pass adds is inside the viewport, which the probe asserts separately.
- **`LeadChips` stays where it is.** It names organisations, not people; the CR asks for both,
  side by side, and that is what the header now shows.
- **Items with no recorded person show nothing.** Never the component's own "Not assigned"
  state: a probe check asserts `data-empty` never reaches those pages (DECISIONS 121).

## Rules checked

- Tokens only, no raw hex; the eyebrow, the card and the chip come from the finished component.
- Full RTL: logical properties only (`ps-`, `ms-auto`, `align="end"`), verified in the Arabic
  screenshots of every surface; the person card mirrors and the eyebrow drops its tracking.
- No new user-visible string: every label comes from the existing `people` namespace, so there
  is no i18n fragment and no parity risk.
- No HTML table added; the rosters stay lists.
- Keyboard: the chip is a real button with the gold focus ring, reachable in the cards, the
  drawers and the dialog; Escape order is now correct across the three layers.
- Loading, empty and error states are unchanged; the chip is additive on every surface.
- 54 probe checks in both locales, 0 problems, no console or page errors; 19 smoke checks.

Closing: no High or Critical HIG findings remain.
