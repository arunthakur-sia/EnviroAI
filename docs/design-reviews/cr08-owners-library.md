# CR08 9.1 design review: the owner chip on the library surfaces

Self-critique of the owner placement pass over Institutional Memory, Studies, the Learning Room, lessons, Reports and Ask NPC answers, against the design rules in force (CR03 to CR07, `docs/cr08-agent-brief.md`). `OwnerControl`, `OwnerControlCompact`, the person card and `getOwnerRefs` were finished by the Section 9 agent and are not changed here: this pass only places them and widens the projections that were dropping the person's id.

Evidence: `data/screenshots/cr08/owners-library-*.png`, both locales at 1440x900, taken by `scripts/dev-probes/cr08-owners-library-probe.ts` (system Edge, admin@npc.qa) with the console and page errors captured in `owners-library-console.log`. Severity follows the HIG review scale: Critical, High, Medium, Low.

## Screens reviewed

- Institutional Memory shelves, the owner on the hover preview of a book, and the person card opened from it (`owners-library-shelf-preview-*.png`, `owners-library-person-card-shelf-*.png`)
- Institutional Memory list view, 120 rows each with a chip (`owners-library-list-*.png`)
- Institutional Memory grid view, the cover gallery left as painted artwork (`owners-library-grid-*.png`)
- A document page header with the owner and its person card (`owners-library-document-*.png`, `owners-library-person-card-document-*.png`)
- A collection with its custodian (`owners-library-collection-*.png`)
- The Studies hero byline (`owners-library-studies-*.png`)
- The Learning Room: the lesson of the week band, the lane cards, the inline reader (`owners-library-learning-room-*.png`, `owners-library-room-card-*.png`, `owners-library-reader-*.png`)
- A lesson page (`owners-library-lesson-*.png`)
- The Reports hub rows and a report's metadata list (`owners-library-reports-row1-*.png`, `owners-library-report-*.png`)
- An Ask conversation with a human answer (`owners-library-ask-*.png`)

## Findings

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | High | A person card opened from a book's hover preview would have destroyed the preview it was opened from: the card and the dialogs it opens are portalled to the body, so the pointer moving onto them fires the preview's pointer leave, the book returns to the shelf 120ms later and the card, the compose box and a half-typed message go with it. | The book's leave timer looks for an open person card or dialog and re-arms itself instead of releasing while one is up, and the outside-pointer-down handler treats the card and its dialogs as part of the preview. The probe asserts the preview is still mounted after the card opens. |
| 2 | High | The chip renders a `<button>`, so three surfaces would have produced a button inside a link or inside another button, which is invalid markup and swallows the inner control's clicks: the Institutional Memory list row (one `<Link>` around everything), the Learning Room lane card (one `<button>`), and the Reports hub row (one `<Link role="row">`). | All three are restructured: the row or card is a plain container, the title carries the link or the open action and stretches over it with `after:absolute after:inset-0`, and the chip sits beside it with `relative z-[1]`. The probe fails if any chip has an `a` or `button` ancestor, and it clicks a list row and a report row afterwards to prove the whole row still opens the item. |
| 3 | Medium | A book spine is 40 to 64px of cloth with the title running vertically up it, the verification seal and the Knowledge of the Week ribbon already on it; no name fits, and a monogram alone would give nothing to read. | The owner goes on the hover preview card, where the name has room next to the page count and the classification, and the person card opens from there. The same reasoning keeps the 160x220 grid covers as artwork with their painted monogram: a chip would either cover the cover or add a caption row the CR03 gallery does not have. Both are recorded as deliberate limitations. |
| 4 | Medium | On the report page the requester is a definition list value under a "Requested by" term; the full control would have printed its own "Owner" eyebrow under that term, saying the same thing twice in two different words. | The compact variant sits inside the `<dd>`, so the definition term stays the only label. |
| 5 | Medium | The document page header is a `justify-between` row; adding the owner as a third child would have pushed it into the middle of the header. | The owner and the action buttons are one end-side group, so the title keeps the start side and the owner reads as the last fact before the actions. |
| 6 | Low | `LearningRoom.tsx` imported `RagDot` and `ThreadAnswers.tsx` bound a `locale` that nothing used; both were dead before this pass and both files are touched by it. | Removed, so `next lint --file` is clean on every file this pass touches. |
| 7 | Low | An owner whose account has been retired has no person card to open, so a chip there would be a dead control. | The name and the colour still print where they printed before, but no id is emitted, so no chip is offered. Nothing anywhere renders a placeholder for a missing person (CR08 rule). |

No console error, page error, raw translation key or horizontal overflow was seen on any of the ten surfaces in either locale; the probe checks all four on every page and exits non-zero on any of them.

## Rules checklist

- Tokens only: the chip and the card are the Section 9 component's own tokens; the surfaces around them are unchanged. No raw hex added.
- Eyebrows: the role eyebrow is the component's (`text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400`, `rtl:tracking-normal`), used at the document, collection, lesson and question headers; suppressed (compact variant) wherever the surface already labels the person: the report definition list, the answer header, the lane cards, the shelf preview.
- Roles: owner for a document, custodian for a collection, author for a lesson, a study, a question and an answer, so the eyebrow says what the person is to that item rather than "Owner" everywhere.
- RTL: verified in Arabic on all ten surfaces. The chips mirror with the rows, the card opens on the logical side, Arabic names render in the Arabic column, and nothing scrolls sideways.
- Motion: none added; the card's own 200ms entrance and 200ms hover intent apply.
- Focus and keyboard: every chip is a real button with the gold focus ring, reachable by Tab; the stretched links keep their own focus ring (`focus-visible:-outline-offset-2`) so the outline is drawn inside the row rather than around the whole card.
- Loading, empty and error states: unchanged on every surface; where no person is recorded, nothing renders.
- `data-testid`: the component's own ids are used; `doc-list-row` and `room-lesson-open` were added so a smoke test can reach the restructured row and the card's open action.
- Verification, classification and Knowledge of the Week ribbons are exactly where they were: the shelf ribbon, the spine seal, the classification chips on the list rows and the document header, and the verified chips on lessons and answers are untouched.

## Deliberate limitations

- The owner is not painted on a book spine or on a grid cover (finding 3). It is one hover away on the shelves and one row away in the list view.
- Surfaces that build a `ShelfDoc` by hand rather than through `toShelfDocs` (the Council project drawer's deliverables, the Processes policy mini shelf) carry a name or nothing at all, so their previews keep the plain monogram until their own services pass an owner id. Named for the coordinator in the final report.
- The Institutional Memory list hides the chip below the `sm` breakpoint, as the bare avatar did before, so a phone row keeps the title and the classification.

Closing: no High or Critical HIG findings remain.
