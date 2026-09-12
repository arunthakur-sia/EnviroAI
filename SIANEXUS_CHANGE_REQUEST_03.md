# SiaNexus Change Request 03
## Vault as a real library, Living Strategy redesign, Signals Radar, Home that earns a "wow"

Applies to the SiaNexus codebase after Change Requests 01 and 02. Everything not mentioned here stays as it is.

---

## 0. How to run this change request

1. Read this file fully, then `DECISIONS.md`, `PROGRESS.md`, the component tree, and the latest screenshots in `data/screenshots/`. Map paths named here to the real ones and record the mapping in `DECISIONS.md`.
2. Run unattended. Never stop to ask. Decide, record, continue.
3. This change request is about design quality. The client's verdict on the current Home, Strategy, and Signals pages is that they look basic and, for Strategy, worse than before. The bar is: a person choosing between SiaNexus and the best branded knowledge products should pick SiaNexus because of how it feels. Read Section 6 (the anti-patterns) before writing any UI code, and run the Section 7 self-critique on every screen you touch, with screenshots, before moving on.
4. Order: Section 1 (Vault), Section 2 (Living Strategy), Section 3 (Trends and Signals), Section 4 (Home). After each: typecheck, lint, build, checks from Section 8, EN and AR screenshots into `data/screenshots/cr03/`, and a `PROGRESS.md` entry.
5. Design tokens: keep the existing palette, fonts, and spacing scale. Two additions are allowed and required: the Library palette in Section 1.3 and the connection-line style in Section 4.2. Everything else must be composed from what exists.
6. Motion: `framer-motion` is already installed. Every hover, expand, and entrance described here is required, at 60fps, with `prefers-reduced-motion` respected (instant states, no transforms).
7. Bilingual as always: new strings in both message files; Arabic native; RTL mirrored; screenshots in both.
8. When finished: README updated (new screenshots), smoke script extended and green, then stop.

---

## 1. Knowledge Vault: a library, not a row of tabs

### 1.1 Shelf order and collapsing
- Shelves are grouped by knowledge type in this fixed order, top to bottom: Strategies, Policies and Standards, Reports and Studies, Statistical Releases, Guidebooks and Templates, Presentations and Speeches, Minutes and Circulars, then **Projects** as the lowest shelf.
- The Projects shelf holds deliverables grouped by project: one sub-shelf per project (project code and title as the shelf label), sorted by outcome then code.
- Every shelf header is a clickable row (label, count, chevron) that collapses or expands the shelf with a height animation (260ms, existing ease). All shelves are expanded by default except Projects, which is **collapsed by default** and shows "Projects: 64 deliverables across 21 projects" in its collapsed header. Collapse state is remembered per user in preferences.
- "Expand all" and "Collapse all" appear at the end of the shelf toolbar.

### 1.2 Books, not boxes
Replace the current `Spine` with a `Book` component. Each document renders as a physical book standing on the shelf. Keep the current rhythm of alternating tall and short books.

Book geometry (CSS, per book):
- Spine width: 40px for documents under 30 pages, 52px for 30 to 150 pages, 64px above 150. Height: tall 216px, short 184px, alternating along the shelf; one book per shelf (the last) leans 4 degrees against the shelf end.
- Spine surface: base colour from the Library palette (1.3) chosen by knowledge type; a vertical cloth texture from `repeating-linear-gradient` at 4 percent opacity; a 6px darker band across the top and bottom (headbands); two 1px gold (`--gold-500` at 70 percent opacity) rules 14px from the top and bottom; a 3px lighter "page block" strip on the fore-edge side (end side in RTL) with a hairline shadow so the pages read as paper; an inset shadow on the spine's outer edge for curvature (`inset 3px 0 6px rgba(0,0,0,0.18)`); a drop shadow that lands on the shelf plank (`0 10px 14px -10px rgba(30,27,31,0.45)`).
- Spine text: the title in Fraunces 600 at 13px, running along the spine (rotated 90 degrees in LTR, stacked vertically for Arabic script; never rotate Arabic glyphs), clamped to two lines with an ellipsis, in a paper-white ink (`#FBF9F5`) with a subtle 1px emboss (`text-shadow: 0 1px 0 rgba(0,0,0,0.25)`). A small "NPC" mark in Inter 10px near the bottom headband and the year above it. The verification seal is a 14px gold circle with a check, positioned near the bottom, only for verified documents.
- Hover: the book pulls off the shelf: `translateY(-10px) rotateY(-14deg)` with `perspective: 900px` on the shelf container, revealing the front cover face (a `div` on the side, 120px wide) that shows the cover design: knowledge type label, title, one-line summary, owner initials, and page count, on a lighter tint of the spine colour with the same headbands and gold rules. Shadow deepens. Transition 220ms out, 160ms back. In RTL the rotation direction mirrors so the cover reveals toward the reader.
- Focus (keyboard) shows the same pulled-out state. Click opens the reader.
- Processing state (embedding not finished): the spine shows a slow shimmer along the cloth; no spinner.

### 1.3 Library palette (new tokens, book cloth colours only; never used elsewhere)
`--cloth-maroon: #7A1533`, `--cloth-ink: #23303F`, `--cloth-gulf: #145C63`, `--cloth-olive: #4F5A3A`, `--cloth-plum: #4E2A4C`, `--cloth-umber: #6B4A2E`, `--cloth-slate: #4A5563`, `--cloth-sand: #B9A57F` (with dark text for this one only). Mapping by knowledge type: Strategies maroon, Policies and Standards ink, Reports and Studies gulf, Statistical Releases slate, Guidebooks and Templates olive, Presentations and Speeches plum, Minutes and Circulars umber, Deliverables sand. Within a shelf, vary lightness by plus or minus 6 percent per book based on the document id hash so a shelf never looks flat.

### 1.4 The shelf itself
- Plank: a 12px board in `--sand-300` with a top highlight line in `--sand-100` and a gradient to `--sand-300` darkened 8 percent at the bottom, plus a soft shadow beneath (`0 6px 12px -6px rgba(30,27,31,0.35)`). Books stand on the plank with no gap beneath them. The shelf background behind the books is `--sand-100` with a very faint vertical grain.
- Shelf ends: a 10px bracket in `--sand-300` at each end of the plank.
- Shelf labels sit above the plank as the collapsible header row (1.1) in the existing eyebrow style, count in `--ink-400`.
- Horizontal overflow scrolls with momentum and shows fade masks at both ends; arrow buttons appear on hover of the shelf.
- Grid view keeps the front-cover design at 160 by 220px; list view unchanged.

---

## 2. Living Strategy: bring back the beauty, keep the hierarchy

### 2.1 Verdict and direction
The three-pane column navigator reads like a spreadsheet. Replace it. The content order stays exactly: Strategy > Outcomes > Targets > Initiatives and Projects, but presented as a designed journey with cards, rings, and in-place expansion. No `<table>` elements anywhere in the Strategy module except the KPI values table inside a detail page. No cell borders, no zebra rows, no dense grids.

### 2.2 Level 1: `/strategy` (the seven outcomes)
- Edition switch (NDS3, NDS2, NDS1) as the existing segmented control at the top end side.
- "Strategy at a glance" band: three large count-up numbers in Fraunces (targets on track of total, initiatives, projects) with a 220px sparkline of status updates per month beside them. Sand-100 band, no card border.
- The seven outcomes as large **outcome medallions** arranged in a gentle arc across the width (like the original blueprint): each medallion is a 176px circle with the progress ring (share of targets on track) in maroon on sand-300 track, the outcome number in Fraunces 600 at 40px inside, the title beneath the circle, and under it three small counts (targets, initiatives, projects). RAG dot at the ring's end point. Hover lifts the medallion 6px, brightens the ring, and shows a one-line description in a tooltip card. The ring draws in on first load (700ms, staggered 60ms per outcome), once.
- Map toggle stays (radial partition), redesigned to use the outcome medallion colours and the same hover card.

### 2.3 Level 2: `/strategy/[edition]/[outcome]` (targets of one outcome)
- Outcome hero: a full-width sand-100 band with the outcome number at 96px Fraunces in maroon-100 as a watermark behind, the title at 40px, the description, the owner, the progress ring at 120px, and three count chips. A back link to Strategy above it.
- Targets as a two-column grid of **target cards** (one column below 1024px). Each card: code eyebrow, title, then a "progress figure" block: actual value in tabular Inter 32px, target value beside it in `--ink-400`, a slim 6px progress bar with a gold tick at the target and a maroon fill for actual (down-good targets invert), the period label, the RAG dot, and two chips (N initiatives, N projects). No border; the card is white on sand with the warm shadow on hover and a maroon-100 left edge on the selected state.
- Clicking a target expands it **in place**: the card grows (height animation) to reveal two lanes side by side, "Initiatives" and "Projects", each a horizontally scrolling row of compact cards (title, owner entity, status dot, a thin timeline bar from start to end with today marked, deliverables count). Lane headers show counts. Only one target is expanded at a time; expanding another collapses the previous one with a smooth transition. An "Open target" link at the end of the expanded area goes to the detail page.
- Keyboard: arrow keys move between target cards; Enter expands; Escape collapses.

### 2.4 Level 3 and detail pages
- Target detail `/strategy/[edition]/[outcome]/[target]`: same hero style as the outcome (smaller), KPI charts (existing components), then the Initiatives and Projects lanes as full-width card grids grouped by status, then lessons tab, documents, experts, signals, updates, lineage, Brief me.
- Initiative and project detail pages keep their content and order from Change Request 02, restyled with the same card language: header band, status and timeline as a horizontal bar with milestones as dots, Deliverables as a mini-shelf of books (reuse `Book` in a 140px height variant), KPIs as tiles.

### 2.5 Breadcrumb and path
The breadcrumb (Strategy > Outcome > Target) stays above every level in the existing style, with the edition chip. URLs stay as introduced in Change Request 02.

---

## 3. Trends and Signals: a radar first, then a briefing

### 3.1 Page order
1. Signals Radar (new, 3.2)
2. Signal Briefing (redesigned stream, 3.3)
3. Risk heat map and International index tracker (unchanged, moved below)

### 3.2 Signals Radar
A real radar, not boxes. Component `SignalRadar` (SVG, responsive, 100 percent width, 420px tall on desktop):
- Geometry: a semicircle (flat side at the bottom) with three concentric bands for horizons: inner band Short (0 to 12 months), middle band Medium (1 to 3 years), outer band Long (3 years and beyond). Band labels sit along the flat base. Bands are filled with `--sand-100`, `--sand-50`, and white, separated by hairline rings in `--sand-300`.
- Sectors: the semicircle is divided into wedges, one per signal type (policy, market, technology, social, environment, geopolitical, index, research), with the type label on the outer arc in the eyebrow style. Wedge dividers are hairlines.
- Blips: each accepted signal from the last 180 days is a dot placed in its horizon band and type wedge (position jittered deterministically by id so dots never overlap exactly). Dot radius by impact (high 9px, medium 6px, low 4px); fill by sentiment for Qatar (positive `--gulf-600`, negative `--danger` at 80 percent, neutral `--ink-400`, mixed `--warn`); high-impact dots have a slow 2.4s pulse halo in the same colour at 25 percent opacity.
- Sweep: on first load a radar sweep (a translucent maroon wedge, 12 degrees wide) rotates once across the semicircle over 1.6s and blips appear as the sweep passes them. Once only; static afterwards.
- Interaction: hovering a blip shows a card (title, publisher, date, impact, why it matters, linked outcome chips); clicking a blip scrolls to and highlights its card in the briefing. Clicking a band label filters the briefing by horizon; clicking a wedge label filters by type; active filters render as chips above the briefing with a clear action. Keyboard users can tab through blips in impact order.
- Legend: a compact legend at the end side with impact sizes and sentiment colours.
- Small screens: the radar becomes a full circle at 320px with labels in a list beneath it.
- Empty state: rings with no blips and the message "No accepted signals in this period. Refresh signals to scan."

### 3.3 Signal Briefing (replaces the flat masonry)
Structure:
1. **Highest impact this month**: three large feature cards in a row (one column on small screens). Each: publisher and date eyebrow, title at 20px Fraunces, the "why it matters" line, impact meter (three bars), horizon chip, linked outcome chips, and the triage strip. The first card is visually primary (a maroon-100 top rule).
2. **By category**: one lane per signal type that has signals, ordered by the sum of impact scores (most important category first). Each lane: header with the type icon, label, count, and average impact; a horizontally scrolling row of compact signal cards sorted by impact then date; lanes are collapsible, top three expanded by default.
3. **By outcome** toggle: the same lanes regrouped by NDS3 outcome, ordered by signal volume, for people who think in outcomes.
4. Filters (type, horizon, impact, sentiment, outcome, source, triage status, date range) sit in a single row of chips above section 1 and drive both the radar and the briefing.
5. Card hover: lift and warm shadow; the matching radar blip enlarges and gains a ring while the card is hovered (the connection between radar and list must be visible).
6. Refresh signals button, progress card, and Last refreshed stamp from Change Request 02 stay at the top.

---

## 4. Home: the page that wins the decision

### 4.1 Composition (bento, disciplined)
Keep the content set from Change Request 02 (Ask, daily knowledge, what changed, podcast, lessons, shelf, progress, leadership quote) but recompose it as a bento grid with intentional sizes, on a 12-column grid, 24px gutters, content max width 1240px:

```
Row A  [ greeting + date (4 cols) ][ Ask SiaNexus hero (8 cols), example chips cycle inside the placeholder ]
Row B  [ Words that guide us: leadership quote band, full width, 160px tall ]
Row C  [ Qatar in numbers (5 cols, tall) ][ Daily challenge quiz (3 cols) ][ NPC Nexus Podcast (4 cols) ]
       [                                 ][ What changed in NDS3 (7 cols, sits under quiz and podcast) ]
Row D  [ Lessons learned: four cards (12 cols) with Add knowledge in the header ]
Row E  [ Newest on the shelves: mini library (8 cols) ][ Your progress (4 cols) ]
```

### 4.2 The connected canvas (everything is connected)
- Behind the whole Home content sits a **knowledge constellation**: an SVG layer of 40 to 60 small nodes and thin curved lines in `--sand-300` (lines at 60 percent opacity, nodes 3px), generated from real relations in the database (documents, outcomes, indicators, experts), drifting very slowly (a 40s loop of 6px amplitude), never distracting. Add one new token for its lines: `--connection: rgba(138, 21, 56, 0.18)`.
- Connection behaviour: when the pointer hovers any card, the constellation lines connected to that card's outcome or topic brighten to maroon at 60 percent and the related nodes grow; the matching outcome dot in Your progress lights up; if the hovered item is a lesson linked to a project, the What changed row for that outcome gets a maroon-100 highlight. All highlights fade over 300ms when the pointer leaves. This is the feature that shows the system knows how things relate; implement it with a small pub-sub (`useConnections()`) that cards register into with their outcome and topic ids.
- The Ask hero, when focused, dims the constellation to 40 percent and draws a soft radial glow in `--maroon-100` behind the input.

### 4.3 Hover and motion rules for every Home element
- Cards: lift 4px, warm maroon-tinted shadow, border colour from transparent to `--maroon-100`, 180ms. The card's primary action (play, open, start) slides in 4px from the end side.
- Numbers: count up on first view (existing `CountUp`), then a light tick on hover (the digits nudge 1px up and back).
- Chips and links: underline draws from the start side on hover.
- Lesson cards: the category chip fills with its colour on hover; the card's outcome dot pulses once.
- Podcast: the waveform glyph animates when an episode is playing; the play button has a slow breathing halo when an unplayed episode exists.
- Books in the mini library: the pull-off-shelf hover from Section 1.2.
- Entrance: one staggered choreography on load (existing `Stagger`, 40ms per element) with the constellation fading in last. No looping motion except the constellation drift, the podcast halo, and the radar-style pulse on the Qatar number's sparkline end dot.

### 4.4 Rewrites of the weak elements
1. **Words that guide us** (the leadership quote): a full-width band with a maroon-100 background wash on the start side fading to sand, a gold hairline rule, the quote in Fraunces 26px italic (Arabic in Noto Kufi 24px), the speaker's name and title in Inter 13px, a small maroon monogram circle with the speaker's initials (no photos), and a "Source" link to the speech or news item in the Vault. The quote crossfades to the next one at midnight and on click of a subtle arrow. Minimum height 160px. It must look like a considered editorial element, not a caption.
2. **Qatar in numbers** (replaces "Did you know Qatar"): a tall feature card with one headline indicator per day: a 64px tabular count-up number, unit and period in `--ink-400`, a one-line hook written by the AI, a 100px sparkline of the last 24 periods with the end dot pulsing, a "compared to last period" delta chip, and an "Explore the indicator" link that opens Statistics. A small "Tomorrow: another number" caption at the bottom. No quiz inside.
3. **Daily challenge** (the quiz, now separate): a compact card with the question in Fraunces 18px, three answer chips, and, on answer, a flip of the card (Y-axis, 500ms) to reveal the answer with the explanation, the points earned in gold, and a link to the source indicator. Answered state persists for the day with a small tick. Streak counter in the corner.
4. **What changed in NDS3**: rows become a compact timeline: a vertical maroon hairline with dots, each change as a short line with the outcome chip and a delta or status change, hover shows the full update card. Three items, "See all changes" at the end.
5. **NPC Nexus Podcast**: a card with a soft maroon-100 corner wash, the waveform glyph (animated when playing), the latest episode title, hosts line ("Dr. Mariam and Hamad"), duration, a large circular play button, and "Make an episode" as a secondary link.
6. **Your progress**: keep the ring design from Change Request 02 but make the ring draw in on first view and glow briefly (once) when points change during the session; the seven outcome dots respond to the connection hovers (4.2).
7. **Newest on the shelves**: a single shelf of eight books using the Section 1 `Book` component in the 184px height, with the plank.
8. **Greeting**: Fraunces 36px, first name; the date beneath with the Hijri date as a second quiet line in Arabic locale.

### 4.5 Ask hero
- The input is 64px tall with a maroon focus ring; the placeholder types out an example question letter by letter (35ms per character), pauses 2.5s, deletes, and types the next one from the 15 seeded examples; typing by the user stops the cycle.
- Two quiet suggestion chips under the input rotate with the placeholder.
- On submit the input smoothly expands into the answer workspace on `/ask/c/[id]` (shared layout transition on the input element).

---

## 5. Bilingual and RTL for the new components
- `Book` spine text: Latin rotated, Arabic stacked per glyph with `writing-mode: vertical-rl` and `text-orientation: upright` (verify rendering of Arabic upright; if glyphs disconnect, fall back to rotated Arabic text at 90 degrees clockwise, which is the convention on Arabic book spines). Record the choice in `DECISIONS.md`.
- Radar: wedge order runs counterclockwise in RTL so the first type appears on the reader's start side; labels stay upright.
- Constellation and connection highlights are direction-neutral.
- Strategy medallions arc mirrors in RTL; the target progress bars fill from the start side.

---

## 6. Anti-patterns (if any of these appear, the screen is not done)
1. Equal rectangles in a grid with the same padding and a 1px grey border.
2. Default Tailwind shadows; any pure grey shadow (shadows here are maroon-tinted and warm).
3. Any HTML table in Strategy, Signals, or Home.
4. Text-only "cards" that could be a paragraph.
5. Elements with no hover state.
6. Section headings larger than the greeting.
7. Emoji anywhere. Icons only from the existing icon set.
8. Progress shown as plain text when a ring or bar exists.
9. A page that looks the same at rest and under the pointer.
10. Any animation that loops visibly other than the four allowed (constellation drift, podcast halo, sparkline end dot, high-impact radar pulse).

---

## 7. Self-critique loop (mandatory per screen)
1. Take EN and AR screenshots at 1440 and 390 at rest.
2. Take a screenshot with the pointer hovering the most important element (Playwright `hover`).
3. Write three sentences in `docs/design-reviews/cr03-<screen>.md`: what the eye lands on first, what looks generic, what would make a Sia designer proud. If the second sentence names anything, fix it and repeat.
4. Run the Apple HIG skill review on the screen; no high or critical findings may remain.
5. Only then move to the next screen.

---

## 8. Acceptance checks
1. Vault: shelves in the fixed order; Projects is the lowest shelf, collapsed by default with counts in its header, expands with animation and groups deliverables by project; collapse state persists per user; every document renders as a book with spine width by page count, alternating heights, cloth colour by type with per-book lightness variance, headbands, gold rules, page block, verification seal, the pull-off-shelf hover revealing the cover, and the plank beneath; Arabic spines render correctly; grid view uses the cover design.
2. Strategy: no table elements outside KPI values on detail pages; Level 1 shows the at-a-glance band and the seven medallions in an arc with rings drawing in once; Level 2 shows the outcome hero and target cards with progress figures; clicking a target expands it in place with Initiatives and Projects lanes; keyboard navigation works; RTL mirrors; project pages show deliverables as a mini shelf of books.
3. Signals: the radar renders three horizon bands and type wedges with blips sized by impact and coloured by sentiment, the one-time sweep, hover cards, and click-to-filter; the briefing shows the highest-impact feature row and category lanes ordered by impact with a by-outcome toggle; hovering a card highlights its blip; Refresh signals still works.
4. Home: bento composition as specified; the constellation renders from real relations and highlights on hover with the outcome dots and What changed rows responding; the Ask placeholder types example questions; the quote band, Qatar in numbers, Daily challenge flip, podcast card, timeline, mini shelf, and progress ring all behave as described; every card has a hover state; entrance choreography runs once; reduced motion disables transforms.
5. `docs/design-reviews/cr03-*.md` exist for Vault, Strategy (levels 1 and 2), Signals, and Home with no remaining "generic" item; Apple HIG reviews show no high or critical findings.
6. Typecheck, lint, build, unit tests, and the smoke script pass; Lighthouse performance and accessibility above 90 on Home, Vault, Strategy, and Trends at 1440.
