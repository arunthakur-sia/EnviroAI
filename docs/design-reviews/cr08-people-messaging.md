# CR08 Section 9 design review: OwnerControl, the person card, messaging and the Inbox

Self-critique of the screens built for CR08 9.1 to 9.4 against the design rules in force (CR03 to CR07, `docs/cr08-agent-brief.md`), from the Playwright screenshots in `data/screenshots/cr08/` (`people-*.png`, `inbox-*.png`, both locales, 1440x900 and 390x844). Severity follows the HIG review scale: Critical, High, Medium, Low.

## Screens reviewed

- OwnerControl in six roles and two sizes, the compact variant, an unassigned owner, joint leads (`people-demo-en/ar.png`, `people-joint-leads-*.png`)
- The person card popover with expertise, availability, the HR backup owner, the delegate and the five actions (`people-card-en/ar.png`)
- Compose from the card with an attachment, the sent state (`people-compose-*.png`, `people-compose-attachment-en.png`, `people-compose-sent-en.png`)
- The card stepped into the backup owner, with the way back (`people-card-backup-en/ar.png`)
- The Teams placeholder dialog (`people-teams-*.png`)
- The Inbox list, thread, deep link with attachment, filters, reply, done, convert, new message with people search (`inbox-*.png`)
- The delegate's own Inbox with the "as delegate" chips (`inbox-delegate-*.png`)
- The profile delegate block (`people-delegate-*.png`)
- 390px single pane with back (`inbox-390-*.png`)

## Findings

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | High | The Inbox list rendered "N seconds ago" on the server and a different value a second later on the client, so React reported a hydration mismatch and regenerated the tree; the regenerated list dropped keyboard focus, which broke arrow-key navigation on first load. | `RelativeTime` paints the short date on the server and switches to the relative form after mount. Verified: no hydration error in the rerun, ArrowDown then Enter opens the second thread. |
| 2 | Medium | Compact owner names in the thread header truncated by two characters ("Maha Al-M...") although space was available: `max-w-full` on a button whose negative margins cancel its padding shrank the label by the padding width inside an inline wrapper. | The trigger uses `min-w-0` instead of `max-w-full`; truncation now happens only when a parent really constrains it. |
| 3 | Medium | At 390px the thread pane in its loading state had no way back to the list (the back action lived only in the loaded header and the error state). | The loading skeleton carries the same "Back to conversations" action. |
| 4 | Medium | Filter clicks could apply out of order while the API route compiled on the shared dev server: an earlier "unread" response could overwrite a later "done" list. | A request sequence guard in `loadList` lets only the newest request write the list; the probe waits for each filter's response and asserts the done filter narrows the list. |
| 5 | Low | The "As delegate" filter tab wrapped onto two lines in the 360px list pane. | Tabs are `whitespace-nowrap` with tighter padding; all four fit on one line in both locales. |
| 6 | Low | The delegate range on the person card read "9/1/26 to 9/30/26", too terse for a government register. | Medium date style ("Sep 1, 2026 to Sep 30, 2026", "من 2026/09/01 إلى 2026/09/30"). |
| 7 | Low | English subjects inside the Arabic list truncated at their start because the RTL span clipped LTR text at the logical end. | Subject and snippet spans carry `dir="auto"`, so each truncates at its own end; the "+N" joint-leads chip is pinned `dir="ltr"` so it never reads "3+". |
| 8 | Low | The demo board repeated "Not assigned" as a caption under the unassigned control. | Replaced by a second unassigned variant (custodian, small) so the board shows both sizes of the empty state. |
| 9 | Low | Hovering a participant chip after a thread loads under a resting mouse opens the person card; expected hover behaviour, but noted because it showed a skeleton in one screenshot. | Left as designed: the 200ms intent timer applies, touch pointers never hover, Escape closes. |

## Second pass (screenshots reread after the module was finished)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 10 | High | At 390px the Inbox card ran past the right edge of the viewport and the page scrolled sideways: the card is a CSS grid whose single phone column had no explicit track, so it was sized to its content instead of to the card. The filter tabs and every row were clipped (`inbox-390-en.png`). | `grid-cols-1` (`minmax(0, 1fr)`) on the card, plus `min-w-0` on the list pane and on the thread pane. All four filter tabs now sit on one line at 390px and nothing overflows. Verified by rerunning the 390 probe. |
| 11 | Medium | In an Arabic thread the clock on each bubble used Arabic-Indic digits while the date divider above it used Latin digits, because the bubble time went straight to `Intl.DateTimeFormat("ar-QA")` while the divider went through `formatDate`, which pins the numbering system. Two numeral systems inside one conversation (`inbox-390-thread-ar.png`). | `timeOf` pins `-u-nu-latn` the way `formatDate` does. Times and dividers now agree in both locales. |
| 12 | Medium | In the Arabic list an English snippet was clipped at its start ("...the bulletin, then I can sign it off tomor"), because the participants and the snippet shared one truncating parent whose direction is RTL. Finding 7 had fixed the subject this way but not the snippet, which is nested one level deeper. | The secondary line is a flex row of two spans, each truncating on its own, the snippet carrying `dir="auto"`. Snippets now read from their first word in both locales. |
| 13 | Medium | Change Request 9.2 asks for "filters (unread, by item type, by person)"; the list pane had the unread, done and as-delegate tabs and one free-text box, so an item kind or a colleague could only be reached by typing. | Two compact selects under the search box, "All item types" and "Everyone", filled from the conversations in hand and hidden when there is only one of each, with a "Clear filters" action next to the count. They fit on one line beside each other at 390px. |
| 14 | Medium | Change Request 9.1 gives the backup owner on the person card "the same actions"; the card offered only a Message shortcut next to the name. | The backup owner's name (and the delegate's) steps the card into that person inside the same popover, with a "Back to the owner" control at the top, so all five actions, the expertise and the availability are theirs. A card opened by hover stays put once the viewer steps in. |
| 15 | Medium | Stepping into the backup owner kept painting the previous person's position, unit, expertise and availability until the new card landed, under the new person's name. | `PersonCard` drops the card in hand whenever the person id changes, so the skeleton covers the gap; the fetch is cached for a minute per person, so the swap is usually instant. |
| 16 | Low | The Playwright probe timed out on its own waits rather than on the product: the shared dev server answers an API between 3 and 60 seconds under several agents, and its login form can be clicked before hydration (a native submit then lands back on /login). | Probe waits raised to 120s with one retry, and the probe now signs in over the login API and injects the session cookies instead of driving the form. The probe also takes its own reply line back out of the seeded conversation so reruns do not stack copies. |

Two console entries seen during the probe are not defects of this module and were traced before being dismissed:

- A React hydration warning on the notifications dropdown trigger (`id="radix-_R_2dqmbn9etb_"` server, `id="radix-_R_9naqbn9etb_"` client). `scripts/dev-probes/cr08-messaging-console.ts` shows it on `/en/home` and `/en/profile` as well, so it belongs to the shared shell's radix menu, not to Section 9. It is an attribute-only mismatch.
- `404` and `500` on `_rsc` payloads for `/en/inbox`, and `ERR_CONNECTION_REFUSED`, seen while the shared dev server was restarting. `scripts/dev-probes/cr08-messaging-api.ts` asks for the same RSC payloads three times each afterwards and gets `200` every time.

## Rules checklist

- Tokens only: maroon, sand, ink, gulf, gold and the semantic tints; the paper and pop shadows through `var(--shadow-paper)` and `var(--shadow-pop)`; no raw hex.
- Cards: `.card` for the Inbox frame and the profile block; the popover is a 320px paper card with the pop shadow and a radix arrow.
- Eyebrows: `text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400`, `rtl:tracking-normal` in Arabic (roles on OwnerControl, section labels on the card).
- Display serif: the person's name on the card and the thread subject (`font-display`).
- Motion: 200ms popover entrance through framer-motion with `useReducedMotion`; scrolling to the newest message respects reduced motion; no bounce.
- Focus: gold `focus-visible` rings on every trigger, tab, row, action and picker option; the popover is focus-managed by radix (click and keyboard opening move focus in, hover opening does not steal it), Escape closes, outside click closes.
- RTL: logical utilities only (`ps-`, `pe-`, `ms-`, `start`, `end`, `border-s`, `rounded-ss`, `rounded-ee`); icons that point (`ArrowLeft`, `ChevronRight`, `Send`) carry `flip-rtl`; the popover is placed with logical alignment so it mirrors; `dir="auto"` on user-written text (subjects, bodies, snippets) with `mx-` free layouts.
- No HTML tables; the list is `role="list"` rows; the filter bar is a `role="tablist"`.
- Loading, empty and error states: list skeleton, "Nothing in your Inbox yet" with a New message action, "No conversations match", thread skeleton, "This conversation is not available to you", "could not be loaded"; the person card has a skeleton and an error state with retry.
- Keyboard: arrow keys, Home and End move between rows (roving tabindex), Enter opens, Ctrl+Enter sends a reply or a message, the people and document pickers are comboboxes with arrow selection.
- `data-testid` on every element the smoke and the probe need; `aria-label` on icon buttons; `aria-current` on the selected row; `aria-busy` on skeletons.
- Contrast: only token pairs already audited (`node scripts/contrast-audit.mjs`), the gold unread dot sits on white with a white ring.
- Privacy by design: an admin's Inbox never lists other people's threads, a foreign thread id answers 404, and message bodies are never indexed (asserted by the smoke module against the index tables and the search service).

## Both locales

English and Arabic screenshots were compared side by side: the two-pane Inbox mirrors (list on the start side, thread on the end side), the bubbles swap sides, the Arabic thread from head.stats to the Knowledge Admin renders right-to-left inside an English list without breaking alignment, the person card and the compose dialog mirror, the plural counts use the Arabic categories. No raw i18n key appeared on any screen (the probe scans the page text for `people.*`, `inbox.*`, `profile.*`).

## Verification run behind this review

- `npx tsx scripts/cr08-messaging-seed.ts` from an emptied state builds six conversations, and a second run creates none.
- `npx tsc --noEmit` clean for the whole repository; `npx next lint --file` clean for every file of this section.
- `npx tsx scripts/dev-probes/cr08-messaging-smoke-run.ts`: 32 checks, 32 passing (the four privacy ones among them: an admin reading another pair's thread gets a 404, an admin's own list never carries it, a message body reaches neither the index tables nor the search service nor the search page, and `get_owner` never carries one).
- `npx tsx scripts/dev-probes/cr08-messaging-probe.ts` through system Edge (`chromium.launch({ channel: "msedge" })`) against the shared dev server, in `en` and `ar`, at 1440x900 and 390x844: the list, a thread opened by keyboard, a deep link with an attachment, the four state tabs, the item type and person filters (each asserted to narrow the list), a reply, mark done and reopen, convert to question, the new-message dialog with people search, the OwnerControl demo in six roles and two sizes, the person card by hover and by tap, stepping into the backup owner and back, compose with an attachment, the Teams dialog, Escape closing the card, joint leads expanding, the profile delegate block, the delegate's own Inbox with the "as delegate" chips, and the 390px single pane with its back action.

Closing: no High or Critical HIG findings remain.
