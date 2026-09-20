# Design review: CR08 Section 6, the rebuilt handover (2026-09-20)

Scope: the HR handover list and the Start a handover dialog
(`/hr/handovers`), the administrator's detail with its six tabs
(`/hr/handovers/[id]`: Inventory, Filing report, Interviews, Learning paths,
Access link, Close), the leaving person's workspace (`/handover/mine`) with
Add to handover and the knowledge capture interview, the recipient's
persistent page with the Handover Learning Path and the sign-off
(`/handover/[id]`), the recipient banner, and the external access workspace
outside the shell (`/handover/access/[token]`). English and Arabic, reviewed
as rendered screenshots in `data/screenshots/cr08/handover-*.png` at 1440 by
900 through system Edge, plus a text dump of every screen in both locales
(`scripts/dev-probes/cr08-handover-text.ts`) so a raw key or an untranslated
string cannot hide inside an image.

## What was checked

- **List**: kind chips per handover kind (leaving maroon, transferring gulf,
  long leave gold, engagement ending info), the person with unit or
  organisation, stacked recipient monograms or a "To the system" chip, two
  progress bars (items and interviews), the countdown with its last working
  day and the due date, the status chip and a readiness glyph. A CSS grid
  with `role="table"`, `role="row"`, `role="columnheader"` and `role="cell"`,
  never an HTML table. Filters for kind, status and unit; an EmptyState with
  its own Start action when nothing matches; a Skeleton page through
  `hr/handovers/loading.tsx`.
- **Start a handover**: three person modes (NPC employee through the people
  picker, External expert from the register, Add on the spot), the kind, the
  reason, the last working day and the due date, the three recipient
  decisions with a hint line each, notes, and the mandatory-interview switch
  that defaults on for employees and off for external people, as Section 6.2
  requires.
- **Administrator detail**: the header with every chip the record carries
  (kind, person kind, status, Mandatory, Cut off on DATE, Illustrative), the
  person line, four facts, the reason, a readiness ring with three progress
  bars, and a "Still required" strip that names each open duty as a chip.
  The Inventory ticks scope per item, sets the recipient per item (a person
  or the system) and takes the note; the Filing report shows the AI proposal,
  the custodian, the rationale with its AI marker and the status, with
  Propose all, Approve selected and Apply approved filing; Interviews show
  the transcript with the AI questions and the person's answers and a link to
  the Expert Insights lesson; Learning paths show each recipient's modules and
  percentage with a Build action; Access link creates, shows once, and revokes
  the external token; Close carries the four readiness checks, the override
  reason, the cut-off card and the archived report with both downloads.
- **My Handover**: the hero with the workspace eyebrow, the countdown panel
  and the two bars, a strip that says either what is still required of this
  person or that nothing is, the checklist grouped by inventory category with
  a note editor per item, Add to handover (write, upload, speak) and the
  interview panel with its topic list, the AI question, the answer field, the
  voice option and the transcript.
- **Recipient**: the hero with the overall ring, the learning path as cards
  with the module number or a check, the counts line, the summary, the
  documents and lessons to read, the handover notes quoted, the episode link,
  the check question with a hint that unfolds, and "Mark as understood"; then
  "Ask the leaving person" and the sign-off card, which stays disabled with
  its reason until every module is understood.
- **Home banner**: "A handover has started for you" as a gold-edged status
  strip above the greeting, with the person's monogram, the kind, the item
  count, the last working day, the learning-path percentage, an Open action
  and a dismiss. Verified on Home in both locales as the recipient, and
  `/handover` sends that recipient straight to their learning path.
- **Token workspace**: outside the app shell like the invitation page, with
  the logo, a locale switch, the countdown and expiry, the checklist, the add
  panel and the optional interview, and a calm "link is not valid" card when
  the token is unknown, revoked or past the last working day.
- **RTL**: every screen mirrors completely in Arabic. Logical properties only
  (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `border-s`), `flip-rtl` on the arrow
  glyphs, `dir="auto"` on every free-text field and every quoted note, no
  letter-spacing on Arabic eyebrows, and `tnum` on every figure.
- **Tokens and contrast**: no raw hex in any handover file (grep), no
  `left/right/ml-/mr-` (grep), `node scripts/contrast-audit.mjs` passes every
  pair, `node scripts/dev-probes/emdash-sweep.mjs` reports nothing in this
  module.

## Findings and fixes applied during the review

1. **Medium, fixed**: in Start a handover, External expert, the magnifier was
   positioned against a `relative` box that wrapped the field *and* the
   results list, so `top-1/2` centred it on the pair and it floated over the
   first result instead of sitting in the field. The field now owns its own
   positioning context.
2. **Medium, fixed**: the external register list had no loading state, so the
   dialog opened on "No external expert matches" for as long as the request
   took and read as an empty register. Three skeleton rows now hold the space
   with `aria-busy`, and a stale response can no longer overwrite a newer one.
3. **Medium, fixed**: with the list at full height the dialog grew past 900px
   and Cancel and Start fell below the fold of the scrolling dialog. The
   action row is now a sticky footer inside the dialog, so the primary action
   is always on screen.
4. **Medium, fixed**: three count strings interpolated a raw number beside an
   Arabic plural noun, so the recipient's module card read "1 دروس" instead of
   "درس واحد". `recipient.moduleCounts`, `recipient.modulesDone` and
   `admin.paths.itemsUnderstood` are now ICU plurals with the Arabic zero,
   one, two, few, many and other forms, and the English forms gained "no
   documents" and "no lessons" for the zero case.
5. **Medium, fixed**: the Arabic label for the "Decide per item later"
   recipient mode read "التقرير لكل عنصر لاحقًا" (the report), a typo for
   "القرار" (the decision).
6. **Medium, fixed**: every stakeholder role item carried the raw database
   enum in the title the successor reads, in both languages: "team: PRJ-01a
   One-Stop Business Registration Portal". Inventory titles now use a
   bilingual role label (Team member, Owner, Manager, Sponsor, Expert,
   External partner), and the seed relabels, once and idempotently, the rows
   written before the labels existed.
7. **Medium, fixed**: the Arabic summary of a learning-path module framed an
   English list of item titles in Arabic prose. Each item is now resolved to
   the Arabic title of its document, lesson or node, the role or deliverable
   prefix is translated, and the list is joined with the Arabic semicolon.
   Notes and interview quotes stay in the language the person wrote them, as
   the data holds one string.
8. **Medium, fixed**: stored module summaries written before the text clipper
   existed quoted the capture interview twice, the first time cut mid-word
   ("70 percent comp"). The generator was already correct; a `textVersion`
   stamp now marks each module, and the seed rebuilds a path whose stored
   modules are older than the current text, once.
9. **Low, fixed**: the access link expires at the end of the last working
   day, and the card formatted that UTC instant in the reader's time zone, so
   Doha read "Expires: Oct 2, 2026" beside "Last working day Oct 1, 2026".
   Both the administrator's card and the token workspace now format the date
   part.
10. **Low, fixed**: in the administrator header's four-column facts grid the
    countdown broke between "22 days to" and "go". The countdown now wraps
    only between the count and the date, never inside either.
11. **Low, fixed**: `/handover`, `/handover/mine` and `/handover/[id]` had no
    streaming skeleton. `handover/loading.tsx` now matches the final shape
    (hero with side panel, then checklist rows).
12. **Low, accepted**: the Home banner mounts on the client, because a
    dismissal is remembered per browser in `localStorage` and the server
    cannot know it. The strip therefore appears a moment after Home paints,
    which shifts the page down once. Rendering it on the server instead would
    flash a banner at everyone who has already dismissed it, which is the
    worse of the two, so the client mount stays and the strip keeps a fixed
    height.
13. **Low, fixed in the probe**: the Knowledge of the Week reveal (Section 8)
    opens over Home once a week and hid the banner in the first capture. The
    probe now closes the reveal with Escape before it screenshots, which also
    proves the two overlays do not fight.
14. **Low, not a product defect**: the first Arabic sweep timed out waiting
    for the list to finish its entrance. The shared dev server was hydrating
    a cold Arabic route under the load of a dozen agents and took longer than
    120 seconds; the same page painted in about 14 seconds on a warm server,
    and the page is server rendered and readable before hydration. Recorded
    so the next reviewer does not chase it.

## Known limitation, left deliberately

- **A React hydration attribute warning appears on one page per sweep**, in
  both locales, and also on control pages outside this module (`/en/lessons`,
  `/ar/lessons`) when the browser asks for reduced motion. It comes from the
  shared `Reveal` entrance: the server renders `style="opacity:0"` because
  `useReducedMotion()` is null on the server, while a reduced-motion client
  renders no style at all. It is not a handover component, it changes
  nothing visually, and the fix belongs to `src/components/motion/index.tsx`,
  which this task does not own. Reported to the coordinator.
- **Handover notes, the reason and inventory titles are one string.** A note
  is free text the leaving person writes for their successor, so it is shown
  as written with `dir="auto"` rather than translated; the same holds for the
  reason and for item titles that come from a single-language record. Only
  the labels around them are bilingual.
- **A "Smoke Deliverable" document from earlier smoke runs** sits in the
  seeded inventory of the internal handover. It is not written by this seed
  and it disappears on a clean rebuild.

## Deliberate choices

- **The administrator sees My Handover read-only through the same
  components**, not a separate view, so there is one checklist and one
  interview panel in the product rather than two that drift apart.
- **"Still required" is filtered per viewer.** The leaving person sees only
  the three duties they can act on (decide recipients, write notes, complete
  the interview); the filing and sign-off duties belong to the administrator
  and would otherwise read as a demand the person cannot satisfy. When
  nothing is left the strip turns calm and says so rather than disappearing,
  which keeps the hero height stable.
- **The sign-off button stays visible and disabled** with the rule written
  beside it, instead of appearing only once the path is complete, so a
  recipient can see what they are working towards.
- **The access token is shown once and only its SHA-256 hash is stored.** The
  card says so, regenerating replaces the hash, and revoking is one click
  beside it.
- **Closing is refused, not warned about.** The four checks are listed with
  their counts, and the override needs a written reason that is stamped into
  the audit log and printed on the closed panel for everyone who opens it
  afterwards.
- **The "Illustrative" chip** sits in the header of every seeded handover on
  every surface (list row, administrator detail, My Handover, recipient
  page), as the Council Strategy does.

Closing: no High or Critical HIG findings remain.
