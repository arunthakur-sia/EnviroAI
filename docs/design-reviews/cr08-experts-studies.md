# Design review: CR08 Experts (internal and external) and Studies

Reviewed: `src/app/[locale]/(app)/experts/` (page, ExpertsSegments, ExpertsToolbar, InternalBoard, loading, `[id]/page`, `[id]/ExpertActions`, `new/NewExpertForm`), `src/components/nexus/ExpertCard.tsx`, `src/components/nexus/RequestExpertDialog.tsx`, `src/app/[locale]/(app)/studies/` (page, StudiesView, loading), the expert groups in `search/SearchResults.tsx` and `components/nexus/AnswerStream.tsx`, against the CR08 build brief's design rules and the earlier `docs/design-reviews/experts.md`. Screenshots reviewed as images: `data/screenshots/cr08/experts-*.png`, `studies-*.png`, `search-experts-*.png` in both locales at 1440x900. Contrast figures are the token pairs from `scripts/contrast-audit.mjs`.

## Summary

The Expert Network now reads as two registers rather than one blended list: a two-segment control carries the title, the count and a one-line description of each register, the active segment carries the register's colour (maroon for NPC staff, gulf for externals), and the same stripe runs down the start edge of every card, every profile header, every search group and every Ask NPC suggestion group, so the register is legible before a word is read. Internal experts sit under their unit in organisation order with the sector as an eyebrow, their domains, badges and the projects they carry; externals carry organisation, type, availability, the last engagement year and the number of engagements, with "Request this expert" as the one primary action. Studies is a filtered view of Institutional Memory with a featured cover, four chip rows and a shelf of books per year. The findings below were all fixed in the capture pass.

## Findings

### [High] Type and availability filters were silently ignored on the page (fixed)

- What: the page loads one unfiltered set per view and filters it in memory, but the in-memory filter only knew domain, unit, level, projects, organisation, country and worked-with; `type=academic` returned all 45 externals. Caught by the Playwright probe (41 cards for "academic and worked with NPC").
- Fix: `applyCardFilters` now applies `type` and `availability` too; the probe reads 11 cards for the same URL and the smoke check "external type filter narrows to academia" guards it.

### [High] A button nested inside a link (fixed)

- What: the earlier review flagged `<a><button>` for "Add external expert"; the first draft of this page repeated it, and the external card would have put "Request this expert" inside the card's link.
- Fix: links that read as buttons carry the button classes directly (`LINK_PRIMARY`, `LINK_SECONDARY`); the card is an `<article>` whose name is one stretched link (`after:absolute after:inset-0`) with an `aria-label` of name and position, and the request button sits above it at `z-10` as a real button that opens the shared dialog. One tab stop per action, no nested interactive content.

### [High] Client components importing runtime values from a server module (fixed)

- What: the toolbar imported the type, level and availability vocabularies from `src/server/services/experts.ts`, which imports the database client; the bundle would have pulled server code into the browser.
- Fix: the vocabularies live in `src/lib/experts-constants.ts` with no server imports; the service imports the same file, and the client components import only types from the service.

### [Medium] Metadata text in `ink-400` (fixed)

- What: the earlier review measured `ink-400` on white at 3.31:1 and found it carrying availability, organisation and counts. This pass keeps every text that carries information in `ink-600` (6.98:1 on white): the unit breadcrumb, the organisation line, the footer facts, the year and rating cells on the profile, the facet counts of inactive chips. `ink-400` is reserved for decorative strokes and the eyebrow labels of the segments' inactive state and the sector eyebrow, which the unit name repeats in `ink-900` beneath.

### [Medium] The verified badge had no text alternative (fixed)

- What: the `BadgeCheck` icon was the only carrier of "verified".
- Fix: `role="img"` with `aria-label={t("verified")}` on the card and the profile header; the search rows keep the shared renderer's icon.

### [Medium] Hidden domains gave no signal (fixed)

- Fix: a ghost `+n` chip follows the third domain when more exist (`moreDomains`).

### [Medium] Cards in the same row ended at different heights (fixed)

- Fix: the card is `h-full` inside the grid item, the footer is `mt-auto`, so a card with no domains stretches to its neighbours (visible on the Office of the Secretary General row of the internal view).

### [Medium] The engagements list on the profile was an HTML table (fixed)

- What: CR08 forbids `<table>` in new UI; the profile is now owned by this work.
- Fix: a CSS grid with `role="table"`, `role="row"`, `role="columnheader"` and `role="cell"`, inside its own horizontal scroll container so narrow screens scroll the grid and not the page.

### [Low] The segmented control needed keyboard semantics (fixed)

- Fix: `role="tablist"` with `role="tab"`, `aria-selected`, roving `tabIndex`, Arrow, Home and End keys, `focus-visible:outline-gold-500`, and a `layoutId` accent bar that slides between segments under framer-motion with the `useReducedMotion` guard.

### [Low] The unit breadcrumb chevron mirrored the wrong way in Arabic (fixed)

- Fix: `ChevronRight` carries `flip-rtl`; the Arabic capture shows "مركز الإحصاء الوطني ‹ إدارة ..." reading from the start edge.

### [Low] The search field lacked its standard anatomy (fixed)

- Fix: `type="search"` with an `aria-label`, the cheap name match while typing for single words (350ms) and the semantic pass on Enter for phrases, plus a "Clear filters" control that appears only when a filter is active and an empty state whose actions are "Clear filters" and, in the external view, "Add external expert".

### [Low] Illustrative content must say so (fixed)

- Fix: the eight seeded studies carry `source_ref = cr08-illustrative`, which the featured hero renders as a sand "Illustrative" chip and the Ask NPC tool spells out as "ILLUSTRATIVE seeded content"; the fourteen seeded external experts say "Illustrative profile for the SiaNexus prototype" in both bios. The one pre-existing study (the CR01 Confidential working paper) carries no chip because it is not seeded by this work; it becomes the featured study for readers cleared to see it.

### [Low] Console: a transient 500 on the search page during the first capture (verified, not a defect)

- What: the full Playwright run captured a `search_log` insert failure on the search page while the smoke runner was writing to the same SQLite file from another process; the same URL passed the smoke check moments later and a focused re-run with no concurrent writer answers 200 with both expert groups rendered. Recorded here so the next reviewer does not chase it.

## What works

- The register is legible before a word is read: the maroon and gulf accents run through the segmented control, the cards, the profile header, the search groups and the Ask NPC suggestion groups.
- The two groups never blend: the search results insert one labelled block where the first expert ranked, internal first; the Ask NPC footer renders two labelled groups from `suggestedExpertGroups` and falls back to the `kind` field on older payloads; the grouped tool answer tells the model to keep the headings apart.
- Every list has its three states: `loading.tsx` skeletons for both pages, designed empty states with actions, and error handling on every fetch in the dialog and the toolbar.
- Filters live in the URL, so a view is shareable and the back button works; the view and the collapse state are the only things remembered per user (`prefsJson.expertsView`, `prefsJson.expertsGroups`).
- RTL by construction: logical properties only, `mx-` never needed because no element carries `dir="auto"`, chevrons flip, the Arabic captures mirror cleanly including the facet rows and the year shelves.
- Motion discipline: one 260ms height animation per group, one 240ms accent slide, 280ms shelf reveal, every one behind `useReducedMotion`.
- Studies keeps the library's language: the same `Shelf` and books, the type cloth carried into the featured cover, chip rows in the vocabulary of the Vault toolbar.

## Deliberate limitations

- Every internal expert in the seed is involved in at least one project, so the "Involved in projects" toggle does not visibly narrow the seeded set; it is exercised by the smoke check on the API and will matter on real data.
- The "Illustrative" chip is not shown on external expert cards (the marker lives in the bio only), because the cards have no room for a fifth chip and the existing thirty-one seeded externals of CR01 carry no marker either; the profile bio names it.
- The vault's shelf order does not know the two new knowledge types (`research`, `evaluation`); they fall onto the "Other" shelf of Institutional Memory until `SHELF_ORDER` in `vault/page.tsx` (not owned by this work) lists them next to `study`.

Closing: no High or Critical HIG findings remain.
