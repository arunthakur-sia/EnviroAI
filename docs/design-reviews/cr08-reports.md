# Design review: CR08 Section 5, the Reports module pages (2026-09-20)

Scope: the three Reports screens, English and Arabic, reviewed as rendered
screenshots in `data/screenshots/cr08/reports-*.png` at 1440 by 900 and at
390 by 844.

- `/reports`, the hub: the cover gallery of published reports with its
  filters, "My requests", and "All reports" with the status tabs for the
  Super Admin (`ReportsPage.tsx`, `CoverCard.tsx`).
- `/reports/new`, the builder: type, period and scope, audience and
  language, sections, and the structure preview with page estimates
  (`ReportBuilder.tsx`, `scopes.ts`).
- `/reports/[id]`, the report and review tool: cover, metadata strip, page
  filmstrip with a lightbox, the per-section build progress, the rendered
  sections, comments, manual editing, and the lifecycle actions
  (`ReportPage.tsx`, `BlockRenderer.tsx`, `ReportChart.tsx`,
  `ProgressList.tsx`, `SectionEditor.tsx`, `Filmstrip.tsx`).

The docx template itself is reviewed separately in `cr08-report-template.md`;
this review covers only what the browser renders.

## What was checked

- **Cover gallery**: a 3:4 cover per published report, served from the
  module's own preview API, with a hover lift and a scale of 1.02 on the
  image, the family and classification chips, the type as the eyebrow, the
  title in the display face clamped to two lines, and the period and scope on
  the last line. Five columns at 1440, two at 390. A designed placeholder
  cover (maroon band, title, period in gold) stands in when a report has no
  rendered pages yet or the image fails to decode.
- **Filters**: a segmented All / Public / Internal control with `role="tab"`
  and `aria-selected`, three native selects (type, period, scope) whose
  options are built only from what is actually published, a search field with
  its icon on the start side, and a Clear filters button that appears only
  when a filter is set. The count line above the grid reads
  "12 published reports" as an ICU plural.
- **Request rows**: "My requests" and "All reports" are CSS grids with
  `role="table"`, `role="row"`, `role="columnheader"` and `role="cell"`, never
  an HTML `<table>`; the whole row is a locale-aware link with an
  `aria-label`. A build in progress carries an inline progress bar with
  `role="progressbar"` and its stage name; a failed build says so in `danger`.
- **Builder**: four steps as a reachable stepper (a step the form cannot yet
  satisfy is disabled, `aria-current="step"` on the current one), type cards
  grouped Public / Internal / Custom with the description, cadence, scope kind,
  classification and default section count, period pickers that follow the
  type's cadence, a scope picker per scope kind with a search above six
  options, audience cards, the language choice with the classification beside
  it, and the section list with defaults ticked. The structure preview is a
  sticky card: the summary, a proportional page bar, the numbered list of
  chosen sections with per-section estimates, and the total.
- **Report page**: the cover at 5:7, a metadata strip as a description list
  (type, period, scope, audience, language, classification, version, status,
  requester, approval date), the filmstrip with a lightbox (previous and next
  as buttons and as arrow keys, Escape closes), the contents rail with a
  status dot per section, then one card per section with its numeral, title,
  status chip, page estimate, comment thread and, for an editor, Edit text and
  Regenerate section. The lifecycle buttons appear only where the service says
  they may: Submit for review, Request changes, Approve, Publish, the
  Institutional Memory link, Download English and Download Arabic, and (CR08 8)
  "Set as Knowledge of the Week" for a Knowledge Admin once the report is
  approved or published.
- **Block renderer**: every `Block` kind in `src/server/reports/spec.ts`,
  rendered as the app would show it: headings, paragraphs in three styles,
  bullets and numbered lists with maroon markers, KPI tiles, tables and
  scorecards as CSS grids with ARIA table roles, charts through Recharts,
  pull quotes with a gold rule on the start edge, callouts, key figures,
  figures from `pngBase64` or inline SVG, the numbered sources list, and a
  dashed rule for a page break.
- **States**: `loading.tsx` skeletons for all three routes that match the real
  layout, EmptyStates for an empty gallery, a filtered-out gallery (with
  Clear filters), no requests yet (with Request report) and an empty status
  tab, the progress card while a build runs, and a failed-build card with the
  build's note stream.

## Findings

### High

1. **The report page scrolled sideways at 390px.** `document.scrollWidth` was
   1454 on the annual report against a 390 viewport, so the page could be
   panned and the metadata strip ran off the screen. Cause: the cover and
   metadata row used `grid md:grid-cols-[220px_minmax(0,1fr)]` with no column
   template below `md`, so the implicit `auto` track took the min-content
   width of its widest child, which is the filmstrip's flex row (fourteen
   88px pages, 1388px). Fixed by declaring `grid-cols-1` (Tailwind expands it
   to `repeat(1, minmax(0,1fr))`, so the track can shrink) on that row, on the
   sections row, and on the both-languages split, and by adding `min-w-0` to
   the metadata card and the sections column. The same latent shape was fixed
   in the builder (`md:grid-cols-2`, `sm:grid-cols-2`, `sm:grid-cols-3`,
   `lg:grid-cols-[minmax(0,1fr)_320px]`), in `ProgressList` and in the section
   editor's bilingual fieldset. Verified: `document.scrollWidth` is now 390 on
   all three routes, and the only boxes that still pass the viewport edge are
   the filmstrip pages inside their own `overflow-x-auto` scroller, which is
   what a filmstrip is for
   (`scripts/dev-probes/cr08-reports-ui-overflow.ts`).

### Medium

2. **A finished section read as an unfinished one.** The cover and the
   contents sections carry no blocks (the document template composes those
   pages), so a published report showed "This section has no content yet."
   under two sections that were in fact ready. A ready or edited section with
   no blocks now says "The document template composes this page; it appears in
   the page previews and in the download." with a quiet document icon; the
   "no content yet" line is kept for a section that genuinely has none
   (`reports.report.templatePage`, new key in both languages).
3. **Two chips saying the same word.** An Internal report at classification
   Internal would show a family chip and a classification chip with identical
   text. The family chip is suppressed when its label equals the
   classification label, which is the common case for Internal and Public, so
   a cover shows one chip; the Leadership Briefing Pack, Internal at
   Confidential, correctly shows both. Checked in English and in Arabic
   (`داخلي` against `داخلي`, `عام` against `عام`).
4. **A lifecycle action gives no ceiling on the wait.** Submit, approve and
   publish stay in the button's loading state until the server answers, with
   no client timeout: on the shared development server, which answered a
   PATCH in 26 seconds and occasionally in more than four minutes while
   another agent's edit was compiling, the button sits disabled with its
   spinner and the only feedback is that spinner. Accepted for the prototype
   (the action does land, and the page then refreshes); noted as a limitation
   rather than fixed, because a client-side abort would have to reconcile a
   request that the server may still complete.

### Low

5. **The cover in Arabic is the English cover.** Page previews are rendered
   once per report and the preview API takes no language, so the Arabic hub
   and the Arabic report page show the English cover image while every piece
   of text around it is Arabic. The download offers both languages, and the
   in-page sections render in Arabic. Left as it is: the preview API is the
   server half's contract, and a second set of previews per language belongs
   with the template agent.
6. **The chart plot stays left to right in Arabic.** `ReportChart` sets
   `dir="ltr"` on the plot box on purpose, as the Statistics Hub does, because
   a time axis reads the same way in both languages; the legend, the caption,
   the note and the source line are all in the page's direction.
7. **Two probe scripts were global scripts, not modules.** `cr08-reports-ui-err.ts`
   and `cr08-reports-ui-ping.ts` declared a top-level `BASE` with no import or
   export, so TypeScript merged them into one global scope and reported
   "Cannot redeclare block-scoped variable". Both now end with `export {}`.

## Design rules, point by point

- **Tokens only**: no raw hex anywhere in the module. The chart roles map to
  `--color-maroon-700`, `--color-gulf-600` and `--color-gold-500` through CSS
  variables; the RAG cells use `ok`/`warn`/`danger` with their `-light` washes;
  the KPI tile tone `gold` renders as `warn` ink, because `gold-500` as text
  fails AA. `node scripts/contrast-audit.mjs`: all pairs pass.
- **Cards and eyebrows**: `.card` for every panel, the eyebrow class exactly as
  the design rules give it, with `rtl:tracking-normal` so Arabic carries no
  letter-spacing. Section headings are in the display face.
- **Primitives**: Button, Input, Textarea, Label, NativeSelect, Chip,
  ClassificationChip, Avatar, Skeleton, EmptyState, ProgressRing, Dialog,
  useToast, Reveal. The one local primitive is `ButtonLink`, a link dressed as
  a button, so a primary action can be a real anchor instead of a button
  nested in one.
- **Motion**: the chart's entrance animation is guarded by
  `useReducedMotion()` and switched off after 1.2 seconds so a re-render never
  replays it; the hover lift on covers and type cards is a 200 to 300ms
  transform with the paper easing; nothing bounces.
- **No HTML `<table>`**: asserted by the Arabic probe (a grid with
  `role="table"` and no `<table>` element) and by the smoke module against the
  rendered HTML.
- **RTL**: logical properties only (`ps-`, `pe-`, `ms-`, `me-`, `start-`,
  `border-s`), `flip-rtl` on the back, next, previous and lightbox chevrons
  and on the trend glyphs, `unicodeBidi: "plaintext"` on figures that mix a
  numeral with a sign, and `dir="auto"` on comment text so a colleague's
  English note inside an Arabic page reads correctly.
- **Numbers and dates**: `tnum` on every numeral, `formatNumber`,
  `formatDate` and `formatPeriod` from `@/lib/format` so the numeral
  preference is honoured; `TimeAgo` renders the absolute date on the server
  and switches to the relative phrase after mount, so no row mismatches on
  hydration (the hydration probe reports zero mismatches on all three routes,
  against two control pages).
- **Keyboard and focus**: every clickable non-button carries `cursor-pointer`
  and the gold focus ring, icon-only buttons carry `aria-label`, the lightbox
  answers the arrow keys and Escape, the stepper is a list of buttons, and the
  scope and type pickers are proper radio groups.
- **Translations**: 248 keys in one `reports` namespace, merged with
  `node scripts/dev-probes/i18n-merge.mjs cr08`, parity clean at 4360 keys per
  language. The probe fails the run if any string matching `reports.*` or
  `common.*` appears in the rendered text: zero on all five page and locale
  combinations.
- **Illustrative content**: the gallery carries the `Illustrative` chip and a
  line saying the published examples were generated from the prototype's
  seeded data.
- **No em dashes**: `node scripts/dev-probes/emdash-sweep.mjs` reports one
  line, in `tests/i18n-parity.test.ts`, which is the regex that looks for
  them; nothing in this module.

## Verification

- `npx tsc --noEmit`: no errors in this module's files.
- `npx next lint --file ...` over all eleven page files and all nine
  components: no warnings or errors.
- Playwright through system Edge against the shared dev server, both locales,
  logged in as `admin@npc.qa` and `analyst@npc.qa`
  (`scripts/dev-probes/cr08-reports-ui-probe.ts`, stages hub, flow, ar,
  contrib, mobile, plus `cr08-reports-ui-review.ts` for the review half and
  `cr08-reports-ui-overflow.ts` for the narrow layout): the gallery and its
  filters, the builder through all four steps, Generate, the per-section
  progress until the build lands as a draft, the sections, a comment, a manual
  edit, submit, approve, publish, both downloads answering a docx, the
  filmstrip and its lightbox, the Contributor's narrower view, and the 390px
  layout. Console and page errors are captured and fail the run; the only
  errors seen were an ECONNRESET and a single 500 while the shared server was
  restarting under another agent's edit, both of which cleared on a re-run.
- Screenshots read back and acted on: `reports-hub-en`, `reports-hub-en-full`,
  `reports-hub-filtered-en`, `reports-hub-empty-en`, `reports-hub-ar`,
  `reports-builder-type-en`, `reports-builder-period-en`,
  `reports-builder-audience-en`, `reports-builder-sections-en`,
  `reports-builder-ar`, `reports-generating-en`, `reports-draft-en`,
  `reports-draft-en-full`, `reports-editor-en`, `reports-approved-en`,
  `reports-published-en`, `reports-lightbox-en`, `reports-report-ar`,
  `reports-report-ar-full`, `reports-contrib-en`,
  `reports-contrib-builder-en`, `reports-mobile-hub`,
  `reports-mobile-report`, `reports-mobile-builder`.

Closing: no High or Critical HIG findings remain.
