# SiaNexus Change Request 04
## Book hover done right, the Strategy Canvas, the Learning Room, NPC Knowledge Cast

Applies to the SiaNexus codebase after Change Requests 01 to 03. Everything not mentioned here stays as it is. The client approved the current Vault books, the outcome medallions, the Signals page, and the Home direction; this change request refines four things.

---

## 0. How to run this change request

1. Read this file fully, then `DECISIONS.md`, `PROGRESS.md`, the component tree, and the latest screenshots. Map paths to the real ones and record the mapping in `DECISIONS.md`.
2. Run unattended. Never stop to ask. Decide, record, continue.
3. Order: Section 1 (Book hover), Section 2 (Strategy Canvas), Section 3 (Learning Room), Section 4 (Podcast name). After each: typecheck, lint, build, checks from Section 6, EN and AR screenshots (rest and hover) into `data/screenshots/cr04/`, the self-critique loop from Change Request 03 Section 7, and a `PROGRESS.md` entry.
4. Keep all tokens, fonts, palettes (including the Library palette), and motion primitives. The anti-patterns list in Change Request 03 Section 6 still applies to every screen touched here.
5. Performance is a requirement in this change request, not a wish: every hover and expansion described here uses only `transform` and `opacity`, never layout properties; nothing on hover waits on the network; `prefers-reduced-motion` gives instant state changes with no transforms.
6. Bilingual as always: new strings in both message files, Arabic native, RTL mirrored, screenshots in both.
7. When finished: README updated, smoke script extended and green, then stop.

---

## 1. Knowledge Vault: the book hover, done right

### 1.1 Diagnosis of the current state (from the client's screenshot)
The cover appears as a flat pale slab beside the spine at the same depth, overlapping the neighbour, with unreadable rotated text, no hinge, no shadow change, and no reaction from neighbours. It reads as a mirrored ghost rather than a book being pulled off a shelf.

### 1.2 The new interaction: pull, turn, preview (all instant)
Component: rewrite `Book` with a proper 3D structure. Each book is a `div.book` with `transform-style: preserve-3d` inside a shelf container with `perspective: 1100px` and `perspective-origin: 50% 40%`. Children: `.spine` (front-facing at rest), `.cover` (rotated 90 degrees around the Y axis, attached along the spine's fore-edge with `transform-origin` at that edge, hidden at rest by `backface-visibility` and the angle), `.pages` (a 4px paper-coloured slab between spine and cover, giving thickness), and `.shadow` (a separate blurred ellipse under the book, animated independently).

Rest state: spine visible as today (cloth, headbands, gold rules, title, seal). Cover and pages pre-rendered in the DOM, never created on hover.

Hover or focus state (desktop), all transitions 160ms with the existing ease, starting on the same frame as pointer enter:
1. Pull: the book translates forward and up, `translate3d(0, -12px, 28px)`.
2. Turn: the book rotates around its spine edge, `rotateY(-22deg)` in LTR (`+22deg` in RTL), so the front cover turns into view while the spine stays readable. The cover is hinged to the spine, so the two faces meet at a real edge.
3. Rise: `z-index` above neighbours during the interaction (set on enter, cleared 160ms after leave).
4. Shadow: the ellipse widens and softens (`scaleX(1.35)`, opacity 0.45 to 0.6), so the book visibly leaves the plank.
5. Neighbours part: the immediate previous and next books get `translate3d(-6px, 0, 0)` and `translate3d(6px, 0, 0)` respectively (mirrored in RTL) and opacity 0.85; back on leave.
6. Preview card: fades in (120ms, opacity and a 6px upward drift) above the shelf, anchored to the book, no delay. Position flips to below the plank when there is no room above; it never covers the pulled book.

Leave: everything returns over 140ms. Rapid pointer sweeps across a shelf must not flicker: apply the hover state only after 40ms of continuous hover (pointer intent), and cancel the pending state if the pointer leaves within that window.

### 1.3 The cover face
Same cloth colour as the spine (same lightness variance), same headbands and gold rules, so both faces belong to one object. On it, a paper title plate (`--sand-50`, 1px `--sand-300` border, 2px inset shadow) occupying the upper two thirds, containing: the knowledge type eyebrow, the title in Fraunces 600 at 15px (three lines max), a two-line summary in Inter 11px `--ink-600`, and the year. Below the plate: the NPC mark and the verification seal if verified. Text is horizontal, in the reading direction, never rotated; Arabic covers are RTL.

### 1.4 The preview card
The existing `KnowledgeCard` styling, 320px wide: cover thumbnail on the start side (a 48 by 64 miniature of the cover face), title, full summary (five lines max), owner with initials monogram, pages, classification chip, verification mark, last updated, and two actions: Open (primary) and Save to collection. All data comes from the shelf payload already in memory; the reader route is prefetched on hover.

### 1.5 Click and touch
- Desktop: click opens the reader directly.
- Touch: first tap applies the pulled state and shows the preview card with the Open button; a second tap on the book or on Open goes to the reader; tapping elsewhere returns the book. Only one book can be pulled at a time.
- Keyboard: Tab focuses books in shelf order and applies the pulled state; Enter opens; Escape returns the book.

### 1.6 Performance rules for the shelf
- `will-change: transform` only on the hovered book and its two neighbours (added on enter, removed on leave), not on every book.
- Cover and preview content are rendered once with the shelf; no state-driven re-rendering of the shelf on hover (hover state is local to the book component).
- A shelf of 60 books must hold 60fps during a pointer sweep on a mid-range laptop; measure with the Performance panel during the self-critique and record the result in `docs/design-reviews/cr04-vault.md`.

---

## 2. Living Strategy: the Strategy Canvas (one page, everything in place)

### 2.1 Principle
One page, one URL, no navigation for reading. Outcomes open beneath the arc, targets expand inside the outcome, initiatives and projects open in a drawer. The page reads as the plan of a nation.

### 2.2 The national frame (top of the page)
Directly under the edition switch and above the arc:
1. **QNV 2030 pillars strip**: four labels (Human Development, Social Development, Economic Development, Environmental Development, with Arabic) in the eyebrow style on a single row, and thin connector lines (the `--connection` token) from each pillar down to the medallions of the outcomes it drives. Mapping (seed, editable in Settings): Economic: outcomes 1 and 2; Human: outcome 3; Social: outcomes 4 and 5; Environmental: outcome 6; all four: outcome 7. Hovering a pillar brightens its lines and its medallions.
2. **At-a-glance numbers**: keep the existing band (targets on track, initiatives, projects, sparkline).
3. **2024 to 2030 timeline strip**: a full-width horizontal line with year ticks, a "today" marker (maroon dot with the date), the mid-term review milestone (2027) and the 2030 horizon as labelled ticks, and a thin progress fill from 2024 to today. Below the ticks, small counts of projects starting and ending per year rendered as faint bars (no axis). Hovering a year shows the projects starting or ending that year in a tooltip list.

### 2.3 The outcome panel (opens beneath the arc)
- Clicking a medallion opens the outcome panel below the arc with a height animation (300ms). A tapered pointer (a 24px triangle in the panel's background colour with a hairline border) connects the panel to the selected medallion; it slides horizontally when another medallion is chosen while the panel content crossfades (180ms). Clicking the selected medallion again closes the panel.
- The full arc stays at the top when a panel is open. When the user scrolls so that the arc leaves the viewport, a **sticky rail** appears at the top: seven 40px rings with numbers, the selected one filled, plus a small edition chip. Clicking a ring switches the panel and scrolls to its top. The rail hides when the arc is back in view.
- Panel content, in order:
  1. Header: outcome number as a watermark, title, one-paragraph description, owner, progress ring (120px), the QNV pillar chips, and three count chips.
  2. **Read the chapter**: a toggle that first reveals the AI summary of the outcome chapter (four to six sentences with page citations), with a second control "Show the full text" that expands the chapter text extracted from the NDS3 document for that outcome (paginated by source page, each page block showing "p. 41" and a citation chip that opens the reader at that page), and a link "Open in the Vault". Text is served from the existing document chunks; no new storage.
  3. Headline KPIs as tiles (existing `IndicatorTile`), two to four per outcome.
  4. **Targets**: the target cards from Change Request 03 (progress figure, bar with gold tick, RAG, counts). Clicking a target expands it in place to show the Initiatives and Projects lanes. One target open at a time.
  5. Related: a compact row of chips for linked experts and a "Signals for this outcome" count that opens Trends filtered.
- Loading: the panel skeleton mirrors the final shape; outcome payloads are prefetched when a medallion is hovered so opening feels instant.

### 2.4 The drawer for initiatives and projects
- Clicking an initiative or project card in a lane opens a slide-over drawer from the end side, 520px wide (100 percent on small screens), with a scrim at 20 percent over the page; the page keeps its scroll position and state.
- Drawer content: header (type, code, title, owner entity, status), timeline bar with milestones, KPIs, Deliverables as a mini shelf of books (CR03 variant), Lessons (linked), Experts, Signals, Status updates, Lineage, and the actions Brief me, Ask about this, Extract report. A small secondary link "Open full page" at the end.
- Previous and Next controls in the drawer header move between siblings in the same lane (initiatives or projects of the same target), with a 160ms crossfade; keyboard left and right arrows do the same; Escape closes.
- The drawer content is loaded on open with a skeleton; sibling payloads are prefetched so Next feels instant.

### 2.5 URL state and history
- State in the query string: `?o=<outcomeCode>&t=<targetCode>&i=<initiativeCode>` or `&p=<projectCode>`, plus `edition` as today. A deep link opens the page with the panel, the target, and the drawer already open and scrolled into view.
- History entries: opening a panel, a target, and a drawer each push a history state; the browser back button closes the drawer, then collapses the target, then closes the panel, then returns to the previous page.
- Share: every panel, target, and drawer has a copy-link action that copies the deep link.

### 2.6 Map view
Stays as the alternative overview. Clicking a node in the map switches back to the canvas with the matching panel, target, or drawer open.

### 2.7 Detail pages
The full pages for outcomes, targets, initiatives, and projects remain reachable through "Open full page" and through direct links from Ask NPC citations; their content is unchanged.

---

## 3. Lessons Learned: the Learning Room

### 3.1 Purpose
A page people open to learn, not a list they search when they need something. Structure mirrors the Signals page logic: featured first, organised by meaning, then browsing tools, with a guided mode on top.

### 3.2 Page composition (top to bottom)
1. **Header**: title, a one-line invitation under it ("Back from a conference? Add what you learned in 60 seconds" / Arabic equivalent), the Add Knowledge button (primary), and the **Learn mode** toggle (Section 3.5).
2. **Lesson of the week**: one editorial feature card, full width, 240px minimum: the category eyebrow, the title in Fraunces 26px, the learning in one sentence (Inter 16px), the source (project or event) with its outcome chip, the contributor as an initials monogram with name and department, the reuse count with the gold mark if it is among the most reused, and two actions: Read (expands the full lesson inline beneath the card with a height animation) and Listen (plays the lesson's episode from NPC Knowledge Cast, generating it the first time and reusing it afterwards). Selection: the Knowledge Admin sets it in Settings > Lessons > Lesson of the week (with a scheduled list); if none is set for the current week, the AI suggestion is used (highest "worth reading" score among lessons not featured in the last 12 weeks) and the card shows a quiet "Suggested" chip.
3. **Themes**: a row of theme cards from the AI clusters (existing `lesson_clusters`, re-run nightly and on demand from Settings). Each card: theme title, a one-line synthesis written by the AI from all lessons in the theme, lesson count, the outcome chips it touches, and a small sparkline of lessons per month. Clicking a theme expands it in place into a lane of its lessons sorted by "worth reading" with a "Listen to this theme" action (theme episode). Themes are ordered by a relevance score (lesson count, recency, reuse). Show eight, "All themes" opens the rest.
4. **Category lanes**: four horizontally scrolling lanes in this order: Delivery Lessons, External Learning, Expert Insights, Institutional Knowledge. Each lane header: label, count, average reuse, a "See all" link. Cards sorted by the "worth reading" score. Top two lanes expanded, the other two collapsed with counts; collapse state persisted per user.
5. **Browse tools**: three tabs with in-place content: By project (nodes with lesson counts, expandable, ordered by count), By outcome (seven small medallion-style chips filtering the list beneath), By contributor (people with counts and monograms). Plus search within lessons with instant results.
6. **All lessons**: the existing feed as the last section, filterable, for completeness.

### 3.3 The "worth reading" score
`score = 3 x verified + 2 x log(1 + reuse_count) + 1.5 x endorsements + recency_boost` where `recency_boost = 2` for lessons under 30 days, `1` under 90 days, else 0. Computed in SQL or in the service layer, cached per request. Used by lanes, themes, and Learn mode.

### 3.4 Lesson cards and connections
- Card: category chip (colour-filled on hover), title, the learning sentence, source chip (project or event), outcome dot, reuse count with the gold mark for the top 10 percent, contributor monogram. Hover: lift, warm shadow, and the card's project and outcome chips brighten; if the Home constellation pub-sub exists on this page, register the card's outcome and topic ids so hovering shows connections.
- Reading a lesson expands it inline (never a new page from this page); the expanded lesson shows the full text in both languages on toggle, links (project, documents, experts), "Ask about this", "Listen", "Save", and "Applied in" (the places that cite it).

### 3.5 Learn mode
- The toggle turns the page into a guided session: the page content fades out and a session view fades in (no navigation).
- Session: five lessons selected for the user: two from the outcomes they follow or their department's nodes, two from the highest "worth reading" lessons they have not read, one from a theme they have not touched. Presented one at a time as a full-width reading card with progress dots (1 of 5), the full lesson, its source and links, and three actions: Got it (next), Save, Ask about this. Left and right arrow keys move between lessons.
- After the fifth lesson: a reflection prompt ("Which of your projects could this apply to?" and two alternates, in both languages) with a text box that saves as a private note linked to the lesson (`notes` table: id, user_id, lesson_id, text, created_at) and a "Finish session" button.
- Points: `learn_session_completed` 25 (once per day), `lesson_read_fully` 3 (existing cap applies), `reflection_saved` 10. A completed session counts toward the daily streak. Track sessions in `learn_sessions` (id, user_id, lesson_ids_json, completed_at).
- Exit at any point with "Leave session"; progress is kept for the day so the user can resume.

### 3.6 Listen actions and episodes
- Short episodes per lesson (target 2 minutes, cap 3): generated on first Listen through the existing podcast pipeline with a "single lesson" script template (Hamad introduces the lesson and its source, Dr. Mariam explains it and the recommendation, Hamad closes with where it applies). Stored in the podcast library with `source_scope = lesson`, visible to everyone at clearance, reused on later plays.
- Theme episodes (target 4 minutes, cap 5) and project episodes use the existing templates.
- All use the official name from Section 4.

### 3.7 Settings
Settings > Lessons: Lesson of the week schedule, theme re-clustering (run now, nightly on or off), Learn mode on or off globally, reflection prompts editor.

---

## 4. NPC Knowledge Cast: the official podcast name

### 4.1 Names
- English: **NPC Knowledge Cast**
- Arabic: **بودكاست المعرفة**
These are the only names for the podcast anywhere in the product. Replace every occurrence of "NPC Nexus Podcast", "صوت المعرفة", "Voice of Knowledge", "Podcast" used as a brand, and any variant in: rail label, Home card, library and episode pages, composer, mini-player, notifications, emails or toasts, i18n keys and values, seed data, settings labels, README, DECISIONS, and code comments that name the product. Route slugs may stay as `/podcast`.

### 4.2 Scripts
- Hamad opens every episode with the name: EN "Welcome to NPC Knowledge Cast, from the National Planning Council." AR "أهلاً بكم في بودكاست المعرفة من المجلس الوطني للتخطيط." and signs off with it: EN "That was NPC Knowledge Cast. Until next time." AR "كان هذا بودكاست المعرفة. إلى اللقاء."
- Dr. Mariam refers to the show as "the Cast" in English and "البودكاست" in Arabic when she mentions it.
- Update the script system prompts and the mock scripts accordingly; regenerate the seeded episode scripts so they carry the name; audio files for seeded episodes are re-rendered only if an ElevenLabs key exists, otherwise they keep the browser provider.

### 4.3 Visual
The podcast mark (waveform glyph) is unchanged. Add the wordmark text "NPC Knowledge Cast" in Fraunces 600 beside the glyph on the library page header and the Home card; Arabic "بودكاست المعرفة" in Noto Kufi.

---

## 5. Housekeeping
- Seed: QNV pillar mapping, chapter summaries for the seven outcomes, six themes with syntheses if clusters do not exist, a Lesson of the week schedule for four weeks, three reflection prompts, and two seeded Learn sessions for the analyst user.
- Ask NPC: add `get_lesson_themes()` tool and index theme syntheses; citations to a lesson from the Learning Room open the lesson inline on that page when the user is already there, otherwise the lesson page.
- README: book interaction, Strategy Canvas with deep links, Learning Room and Learn mode, podcast name.
- `DECISIONS.md` and `PROGRESS.md` updated; dead code from the previous strategy page navigation removed.

---

## 6. Acceptance checks
1. Vault: hovering a book pulls it forward and up, turns it about its spine edge to reveal a hinged cover with a readable title plate and two-line summary, deepens the shadow, parts the neighbours, and shows the preview card with no delay and no network request; leave returns everything; rapid sweeps do not flicker; touch uses the two-tap model; keyboard works; a 60-book shelf holds 60fps on sweep (result recorded); Arabic covers are RTL and unrotated.
2. Strategy: the national frame shows the QNV pillars strip with connector lines, the numbers band, and the 2024 to 2030 timeline with today and milestones; clicking a medallion opens the panel beneath the arc with the pointer; switching medallions crossfades; the sticky ring rail appears only after the arc scrolls out of view; Read the chapter shows the summary and then the page-cited full text; targets expand in place; initiatives and projects open in the drawer with Previous and Next; deep links restore the exact state; back button unwinds drawer, target, panel; map clicks open the same panel; RTL mirrors all of it.
3. Lessons: Lesson of the week renders with Read (inline) and Listen (episode generated once, reused); themes row with syntheses expands in place; four category lanes ordered by the score with persisted collapse state; browse tabs work in place; Learn mode runs a five-lesson session with reflection, note saving, points, and streak credit, and resumes within the day; lesson reading never leaves the page.
4. Podcast: no occurrence of the old names anywhere (grep across `src/`, `messages/`, `scripts/`, `docs/`, `README.md`); the script generator and mock scripts open and close with the official name in both languages; the Home card and library header show the new wordmark.
5. `docs/design-reviews/cr04-*.md` exist for Vault, Strategy, and Lessons with the self-critique and HIG review; no high or critical findings.
6. Typecheck, lint, build, unit tests, and the smoke script pass; Lighthouse performance and accessibility above 90 on Vault, Strategy, Lessons, and Home at 1440.
