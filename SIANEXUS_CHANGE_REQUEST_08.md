# SiaNexus Change Request 08
## Organisation rebuild, naming and rail, Experts split, Indices groups, Reports, Handover, Leaderboard and levels, Knowledge of the Week, Owner and messaging, Operating Model and Processes, then Cleaning, Performance, and Final QC

Applies to the SiaNexus codebase after Change Requests 01 to 07. Everything not mentioned here stays as it is. One unattended run in two halves: the feature sections (1 to 11) first, then the three engineering phases (12 to 14) only after every feature section is complete and its checks pass.

---

## 0. How to run this change request

1. Read this file fully, then `DECISIONS.md`, `PROGRESS.md`, the component tree, the route map, and the latest screenshots. Map paths named here to the real ones and record the mapping in `DECISIONS.md`.
2. Run unattended. Never stop to ask. Decide, record, continue. Retry failed external calls twice, then fall back as specified.
3. Order: Sections 1 to 11 in the order written, then 12, 13, 14. Do not start Section 12 before Sections 1 to 11 pass their checks in Section 15. After each section: typecheck, lint, build, the section's checks, EN and AR screenshots into `data/screenshots/cr08/`, the self-critique loop from Change Request 03 Section 7 for new or redesigned screens, and a `PROGRESS.md` entry.
4. Design rules from Change Requests 03 to 07 stay in force (tokens, colour scheme, anti-patterns, hover states, motion, performance). New screens must match the Strategy Canvas, the Learning Room, and the Council Strategy in quality.
5. AI Mock Mode must keep working for every new AI function (report sections, learning path generation, filing classification, capture interview, operating model narratives).
6. Bilingual as always: new strings in both message files, Arabic native, RTL mirrored, screenshots in both.
7. When finished: README updated, smoke suite extended and green, and the three phase reports from Sections 12 to 14 written. Then stop.

---

## 1. Organisation page: clean rebuild and the structure editor

### 1.1 Chart rebuild
1. Fixed viewport: the chart lives in a container of fixed height (70vh, min 480px, resizable by dragging its bottom edge; the height is remembered per user). The SVG fills the container; pan and zoom are one transform on a root group driven by `d3-zoom`, with translate extents so the chart cannot be panned out of view, a scale range of 0.4 to 2.0, fit-to-width on load and on resize, and controls for fit, zoom in, zoom out, reset, and a mini-map at the corner for trees wider than the viewport.
2. Layout: `d3-hierarchy` tree layout, top-down, fixed node sizes (220 by 88 px), orthogonal smooth connectors in the `--connection` token. Expanding or collapsing a branch recomputes the layout and animates node and link positions over 260ms; the container height never changes because of layout.
3. Input: drag pans; wheel scrolls the page unless Ctrl or Cmd is held (then zooms); trackpad pinch zooms; touch drag pans and pinch zooms. No scroll trap.
4. The unit panel opens below the viewport, never inside it, with the pointer tail pointing to the viewport edge under the selected node's x position; the page scrolls to the panel; a sticky "Back to chart" chip returns to the top.
5. Keyboard: arrow keys move between siblings and parent or child, Enter opens the panel, Escape closes it.
6. List view: the indented list toggle stays and is the default under 768px.
7. Level labels: read from an editable `org_levels` table (Section 1.2), shown as row labels at the start side of the viewport.

### 1.2 Structure editor (Settings > Organisation), Super Admin only
- `org_levels`: id, code, name_en, name_ar, sort; seeded from the levels found on the website. The Super Admin can rename, add, reorder, and remove empty levels.
- Editor view: the same tree in an edit mode with drag and drop to move a unit under another (live preview, confirm dialog with the count of people, sub-units, documents, and owned items that move with it), a plus on every unit to add a child at any level, inline rename in both languages, and a kebab menu with edit (code, level, head by user or by name and title, mandate, responsibilities, sort), deactivate, and delete.
- Delete or deactivate opens a risk dialog listing everything beneath the unit (sub-units, people, documents, policies, owned strategy items, indicators, lessons, open handovers) and requires a choice: reassign all to a chosen unit, or cancel. Nothing is orphaned.
- Undo for the last ten actions in the session; structure snapshots (`org_snapshots`: id, taken_at, taken_by, tree_json, note) on every save, with restore.
- Bulk: CSV import of units (code, parent_code, level, name_en, name_ar, head_name, head_title); the website re-sync with a diff (existing).
- Department heads see a "Request change" action on their unit that opens a form (what to change, why) and creates a notification and a message to the Super Admin (Section 9), tracked in `org_change_requests` (id, unit_id, requested_by, text, status, resolved_by, resolved_at).

---

## 2. Naming and the rail

### 2.1 Renames
- The library (Knowledge Vault, later shown as Knowledge Hub) becomes **Institutional Memory** / **مكتبة المعرفة** everywhere: rail, page titles, breadcrumbs, empty states, i18n keys and values, seed strings, README, notifications. Remove every remaining use of "Knowledge Vault" and "Knowledge Hub" as the library's name (grep and fix). Route may stay `/vault` with a redirect from `/memory` if you add it.
- "Knowledge Hub" is now the name of a rail group (Section 2.2), never of a page.
- The Policies page becomes **Processes, Policies, and SOPs** / العمليات والسياسات والإجراءات (Section 10).

### 2.2 The rail: groups with sub-menus
Structure and order (fixed):
1. Home
2. **Strategy Hub** / بوابة الاستراتيجية: Council Strategy, Living Strategy
3. **Data and Insights** / البيانات والرؤى: Statistics, Indices, Trends and Signals
4. **Knowledge Hub** / بوابة المعرفة: Institutional Memory, Processes Policies and SOPs, Studies, Lessons Learned, NPC Knowledge Cast, Reports
5. **People and Organisation** / الأفراد والمنظمة: Experts, Organisation, Operating Model, HR Knowledge, Leaderboard
6. Settings (pinned at the bottom)
- Group headers are eyebrow labels with a chevron; groups collapse and expand with a height animation; the group containing the active page is always open; state remembered per user; in the collapsed 72px rail, hovering a group icon shows its items in a flyout.
- Ask NPC is removed from the rail (Section 2.3). Portal visibility (access model) works per page and per group: hiding every page of a group hides the group.
- Studies: a page in the Knowledge Hub group that shows documents of knowledge types study, research, and evaluation from Institutional Memory in a designed listing (featured studies, by topic, by outcome, by year, a shelf per year), with an "Add study" action that opens the upload flow with the type pre-set. Content was not specified in detail; keep it a well-designed filtered view and record this in `DECISIONS.md`.

### 2.3 Ask NPC everywhere
- Top bar: a solid "Ask NPC" button in `--bar-ink` on the maroon bar, right after the search field, the most prominent control after search.
- Floating launcher: a pill at the bottom end-side corner of every page ("Ask NPC" with the glyph), always on screen, above the mini-player when open, with a slow breathing halo; a round button on small screens; it never overlaps content that needs a click. On opening a project, document, indicator, council node, or unit, the launcher shows a one-line suggestion ("Ask about this project") for three seconds, then returns to the pill.
- Panel: opens from the end side, 480px, over the current page; context-aware (the current item attached as a removable chip; the first suggestion chips are about it); the same answer workspace in a narrow layout; the conversation persists while navigating; "Expand" opens the full page `/ask/c/[id]`; "Recent conversations" inside the panel; Escape closes and keeps the thread. Keyboard: Ctrl or Cmd plus K.
- The Home hero Ask box stays and opens the full page on submit.

---

## 3. Experts: Internal and External

- Segmented control at the top: **Internal Experts** (NPC staff) and **External Experts** (other government entities, academia, consultants, international advisors), with counts and a one-line description under each view title. Default: Internal. Deep links `/experts?view=internal|external`; last view remembered per user.
- Internal: grouped by organisation unit by default (toggle to flat), filters by unit, domain, level, projects; cards with unit breadcrumb, domains, badges, "involved in N projects", a maroon accent.
- External: filters by type, organisation, domain, availability, worked with NPC, country; cards with organisation, type, availability, last engagement year, number of engagements, a gulf accent; "Add external expert" only here; "Request this expert" as primary action.
- Natural-language search and Ask NPC expert suggestions return two labelled groups (internal first), never blended.

---

## 4. Indices: groups

### 4.1 Groups (data: `index_groups`: id, code, name_en, name_ar, description_en, description_ar, colour_token, sort, is_active; `index_group_members`: group_id, index_id; an index may belong to several groups)
1. SDGs / أهداف التنمية المستدامة: the 17 SDG goal scores from the Sustainable Development Report (SDSN) for Qatar and the benchmark countries, with Qatar's overall SDG Index score and rank as the headline. Each goal is an index record with the goal number, title, and colour from the official SDG palette used only as a small chip.
2. National Indicators / المؤشرات الوطنية: the main QNV 2030 and NDS3 headline indicators, linked to Statistics Hub series (values read from there), with targets.
3. Competitiveness / التنافسية: IMD World Competitiveness, Global Innovation Index, Logistics Performance Index, Network Readiness Index, Travel and Tourism Development Index, Global Talent Competitiveness Index, Index of Economic Freedom, Global Financial Centres Index.
4. Gallup / مؤشرات غالوب: Gallup World Poll measures for Qatar from public reports (Life Evaluation, Law and Order Index, Global Emotions, Global Safety, wellbeing), with years as published.
5. Governance and Institutions / الحوكمة والمؤسسات: Corruption Perceptions Index, Rule of Law Index, E-Government Development Index, Worldwide Governance Indicators.
6. Human Development and Society / التنمية البشرية والمجتمع: HDI, Gender Inequality Index, Global Gender Gap, World Happiness Report, Social Progress Index.
7. Environment and Climate / البيئة والمناخ: Environmental Performance Index, Climate Change Performance Index.
8. Peace and Security / السلام والأمن: Global Peace Index, Global Terrorism Index, Safe Cities Index.
9. Digital and AI / الرقمنة والذكاء الاصطناعي: Government AI Readiness Index, IMD World Digital Competitiveness, GovTech Maturity Index.
Extend `fetch-indices.ts` to cover the new indices with the same rules (publisher sources, source URLs, never invent). Forecasting and benchmarking apply to every group: rank-based where ranks exist, score-based where only scores exist, and target-gap forecasting for national indicators (target versus trajectory).

### 4.2 Board
- Group switcher at the top (All, then each group with count); the board renders one section per group with its colour cue, summary strip per group (improving, stable, declining, GCC leads), and the cards; an index in several groups appears in each; the table toggle stays per group.
- Edit mode (Super Admin): drag indices between groups, reorder groups.

### 4.3 Settings > Indices
- Group manager: add, rename (both languages), reorder, colour, description, archive.
- Add index in three steps: basics (name, publisher, scale, direction, frequency, groups, linked targets, responsible entity, category), data (paste or upload CSV with country, year, rank, score; or a publisher page URL for the fetcher; or manual entry), forecasting settings (on or off, assumptions). Validation and a preview before saving.

---

## 5. Reports module

### 5.1 Placement and roles
- Page **Reports** / التقارير in the Knowledge Hub group after NPC Knowledge Cast. Route `/reports`.
- Everyone with the portal can request a nominated report type for their scope; the Super Admin approves and publishes all reports and can build custom reports; the existing "Extract report" stays as the lightweight path.

### 5.2 Report types (seed; `report_types`: id, code, family (`public|internal`), name_en, name_ar, description_en, description_ar, default_sections_json, optional_sections_json, scope_kind (`npc|outcome|department|project|period`), classification_default, audience_default)
Public: NPC Annual Report; NDS3 Progress Report (public edition); Qatar in International Indices (annual); Statistical Highlights (quarterly).
Internal: Council Strategy Performance Report (quarterly); NDS3 Delivery Report (monthly); Leadership Briefing Pack; Signals and Foresight Brief (monthly); Lessons Learned Digest (quarterly); Index Forecast Report; Department Knowledge and Continuity Report; Project Closure Report.
Custom (Super Admin): any selection of sections from the section library.

### 5.3 Section library (`src/server/reports/sections/*.ts`, each with a data loader, an AI writer prompt, a mock writer, and a renderer)
Cover; Contents; Foreword (AI drafted for the Secretary General, marked for editing); Year at a glance (infographic tiles); Mandate and governance; NDS3 outcomes overview; Outcome deep-dive (per outcome); Targets scorecard; Initiatives and projects progress; Deliverables received; Council Strategy scorecard; Outputs behind and decisions needed; Statistics highlights (population, economy, labour, prices, trade); International indices (movements, GCC benchmark); Index forecasts (with method note); Signals and implications; Lessons and themes; Knowledge and continuity (HR); Project closure (deliverables, results, lessons, stakeholders); Events and partnerships; Outlook; Sources appendix; Closing page.

### 5.4 Builder and lifecycle
- Builder: type, period, scope, audience, language (Arabic, English, Both), sections (defaults ticked, optional available; custom for Super Admin), a live structure preview with page estimates, "Generate" as a job with per-section progress.
- `reports`: id, type_id, title_en, title_ar, period_json, scope_json, language_mode, sections_json, status (`draft|in_review|approved|published`), requested_by, approved_by, published_document_id, docx_path, preview_images_json, version, created_at; `report_sections`: report_id, section_code, sort, content_json (AI output with citations), status, comments_json; `report_versions`.
- Review: section-level comments, "Regenerate section" (keeps the rest), manual edits to the AI text inside the tool, approval by the Super Admin, publish to Institutional Memory as a report document (type `report`, classification per family) and download.

### 5.5 Design system for the docx (the part that must be beautiful)
Build `src/server/reports/template/` as reusable page components on top of the `docx` library, with these page types, all in both languages (Arabic pages fully RTL with Arabic typography):
1. **Cover**: full-bleed maroon band on the upper 55 percent with a subtle geometric pattern rendered as an image (a Sadu-inspired repeating line pattern at 8 percent opacity), the NPC white logo top start, the report title in large white serif (rendered as an image for exact typography if Word fonts cannot be guaranteed), the subtitle and period, the year as a very large numeral at the band's bottom edge, the lower 45 percent white with the classification chip, the SiaNexus wordmark small, and "Generated by SiaNexus, date".
2. **Contents**: a designed contents page with section numbers in maroon and dotted leaders (docx TOC field updated on open, plus a rendered static list for readers who do not update fields).
3. **Section opener**: a full page with a large section numeral in `--maroon-100`, the section title, a one-paragraph lead in serif, and a maroon vertical rule; optional key figure.
4. **At a glance**: a grid of infographic KPI tiles (value, label, delta arrow, sparkline) rendered as PNG images from the same SVG tile design used in the app, four per row, with a short narrative under them.
5. **Body**: two-column layout for narrative (implemented with a two-cell borderless table with column widths and gutter), maroon run-in headings, pull quotes in a sand box with a gold rule, callout boxes for key findings (maroon-100 background, bold lead), figures with captions and source lines, and tables with a maroon header row, sand banding, and no vertical lines.
6. **Chart page**: a full-width chart image with title, caption, and source; charts rendered from the app's chart style (maroon primary, gulf comparison, gold target) via SVG to PNG at 2x.
7. **Scorecard**: a matrix rendered as a table with RAG cells (coloured shading, not text), trend glyphs as small images.
8. **Closing page**: maroon band with the NPC logo, contact line, and the classification.
9. Running header (report title, section) and footer (page number, classification, "SiaNexus") on every page except cover and closing; Arabic headers mirrored.
- Typography: headings in a bold sans available on Windows (Calibri), body Calibri 11; Arabic in Sakkal Majalla or Arial with RTL paragraphs; where exact typography matters (cover title, section numerals), render as images with the app's fonts.
- Visual QA: after generating, render the docx to page images (LibreOffice headless if present on the machine; otherwise `docx` to PDF via a Node converter if available; otherwise skip with a note), save thumbnails to the report record for the in-app preview, and run a checklist per page (no overflow, no orphan headings, images present, header and footer present). Record the method used in `DECISIONS.md`.
- Seed: one generated example per report type (mock or real AI) so the Reports page shows a gallery of covers on first open.

---

## 6. Handover process, rebuilt

### 6.1 Start
- Who can start: Super Admin, HR Admin, Department Heads for their unit, project owners for external handovers on their projects.
- Kinds: **Internal** (leaving, transferring, long leave) for NPC employees; **External** (engagement ending) for consultants, contractors, seconded experts picked from External Experts or added on the spot.
- Start form: person, kind, reason, last working day, due date, recipient decision (Section 6.3, can be set later), notes. "Start" creates the handover, the inventory (6.2), the workspace for the leaving person, and notifications.

### 6.2 Scope and the leaving person's workspace
- Inventory built automatically: documents and reports owned, deliverables on their projects, lessons authored, project and stakeholder roles, indicators and council indicators owned, policies owned, open expert requests, communities led, org roles. The admin ticks the scope, adds categories or items, and can add "tacit topics" (things only this person knows) as checklist items.
- **My Handover** (`/handover/mine`): the checklist by item kind with status, an "Add to handover" action that accepts everything Add Knowledge accepts (documents, reports, deliverables, lessons, contacts, links, voice notes) and files it into the handover, a required handover note per item (what it is, status, where the rest lives, tips), and the **AI knowledge capture interview**: the AI runs a structured interview per project or topic (voice or text, both languages), asking what a successor would ask (status, decisions, contacts, pitfalls, where things are), and turns answers into Expert Insights and item notes linked to the handover; mandatory for internal handovers, optional for external. Progress bars per section; the admin sees the same view read-only.
- External people without an account: a time-limited **handover access link** (token, scoped to the handover, expires on the last working day) opening a minimal workspace with the checklist, uploads, and the interview; or the NPC counterpart uploads on their behalf.

### 6.3 Recipient decision, per item
- **To a person** (one or several; items split by project or kind): recipients see a banner on login ("A handover has started for you") and a persistent **Handover** page with their progress; the AI generates a **Handover Learning Path**: modules per project or topic, each with a summary, the documents to read, the lessons, the handover notes, a short NPC Knowledge Cast episode, and a check question; "Mark as understood" per item; questions to the leaving person (in-app message thread, Section 9) while they still have access; module progress and an overall percentage; sign-off at the end. Recipients use the rest of the system freely meanwhile.
- **To the system** (Institutional Memory): the AI classifies every item and proposes where it belongs (shelf and unit for documents, project for deliverables, Learning Room and category for lessons, unit for policies, External Experts for contacts), proposes a custodian (unit head by default), and produces a filing report; the admin reviews and approves, then the filing is applied and ownership reassigned.
- Mixed allowed per item. External handovers default to the project owner as recipient when none is chosen.

### 6.4 Close and cut-off
- Closing requires: every in-scope item reassigned, learned, or filed; the capture interview complete where mandatory; every recipient signed off. Admin override with a reason is logged.
- Cut-off: the admin ends the leaving person's access explicitly ("Perform cut-off"); no automatic grace. For external links, the token is revoked.
- A handover report (docx, Section 5 design) is archived to Institutional Memory; the HR dashboard readiness and risk rules read these records; points as already defined plus `learning_path_completed` 40 for the recipient.

### 6.5 Data
Extend `handovers` with kind, person_kind, expert_id, reason, last_working_day, access_token_hash, access_expires_at, cut_off_at, cut_off_by, report_document_id; `handover_items` with recipient_kind (`person|system`), recipient_user_id, note, filing_proposal_json, filing_status; `handover_interviews` (id, handover_id, topic, transcript, structured_json, status); `handover_learning_paths` (id, handover_id, recipient_user_id, modules_json, progress_json, signed_off_at).

---

## 7. Gamification: levels and the Leaderboard

### 7.1 Levels
- Ten levels named **Level 1** to **Level 10** only (Arabic: المستوى 1 to المستوى 10), thresholds 0, 100, 300, 700, 1300, 2200, 3500, 5500, 8500, 13000. A short descriptor per level appears only on hover and on the profile. Remove every old level name from UI, seeds, notifications, i18n, and code comments (grep for Explorer, Contributor, Curator, Keeper, Sage and any others). Unlocks re-mapped to the numeric levels and recorded in `DECISIONS.md`.

### 7.2 Leaderboard (`/leaderboard`, People and Organisation group)
- Two boards with a switch: **People** and **Departments**. Time windows: this week, this month, this quarter, this year, all time (default this month). Categories: Overall, Contributors, Guardians, Learners.
- People board: top 10 visible to everyone; the full list (all ranks) visible to Super Admin, Knowledge Admin, HR Admin, and Department Heads for their own unit's members; the viewer's own row pinned at the bottom always. Row: rank, monogram, name, unit, level, points in the period, trend arrow versus the previous period.
- Departments board: rank, unit, points per member, total points, share of active members, trend; all units listed.
- Super Admin and Knowledge Admin accounts excluded from the People board by default (`settings`); any point rule can be flagged "excluded from boards" (admin-duty actions), configurable in Settings > Gamification.
- Top three on each board get gold, silver, bronze marks on their monograms for the period; a period-close notification with the winners.
- Home progress panel gets a compact "Top 5 this month" block with the user's own rank.
- Quiet mode hides the leaderboard from the user's own view only; their points still count.
- Implementation: a materialised `leaderboard_periods` table refreshed by a job every 10 minutes and on demand, never computed live from the events ledger on page load.

---

## 8. Knowledge of the Week

- Data: `knowledge_of_week` (id, week_start, resource_type (`document|lesson|study|report`), resource_id, contributor_user_id, unit_id, note_en, note_ar, set_by, set_at, status (`scheduled|active|archived`), read_count); `knowledge_of_week_reads` (kow_id, user_id, read_at); `knowledge_of_week_seen` (kow_id, user_id, seen_at).
- Admin flow: on any verified or approved document, lesson, study, or report page, "Set as Knowledge of the Week" (Super Admin and Knowledge Admin) with week selection (this week or a future week), the note in both languages, and a preview of the reveal; one pick per week; replacing an existing pick asks for confirmation. A job activates picks at the start of the week and archives at the end.
- Reveal: on the first open of SiaNexus after activation, once per user per week, a light full-screen overlay slides in over Home: eyebrow "Knowledge of the Week" / معرفة الأسبوع, the title in Fraunces, a two-line summary, the contributor (monogram, name, position, unit), the admin's note, "Read now" and "Later"; dismiss with one click or Escape; never shown again that week (`knowledge_of_week_seen`).
- Home strip all week: a full-width band under the greeting and above the Ask hero with the compact content, the contributor's monogram, a "Read" action, and the count of colleagues who have read it.
- Elsewhere: a gold star on the Knowledge Hub group in the rail for the week; a "Knowledge of the Week" ribbon on the item in Institutional Memory, the Learning Room, and search results; the award permanently on the contributor's profile; a **Hall of Knowledge** page listing past picks by week.
- Points: 150 to the contributor and a permanent badge, 100 to the unit on the Departments board, 10 to each reader who reads it in full during the week (once); notifications to the contributor and the unit head.
- Kept separate from the Learning Room's Lesson of the week.

---

## 9. Owners, person cards, and in-app messaging

### 9.1 Owner control
- One component, `OwnerControl`, placed at the end side of the header of every outcome, target, initiative, project, council node, indicator, document, policy, study, lesson, report, and organisation unit, and on their cards, panels, and drawers: monogram or portrait, name, unit, with the role as an eyebrow (Owner, Department Owner, Project Owner, Unit Head); joint leads show the primary and a "+N" that expands.
- Hover or tap opens the **person card**: position, unit breadcrumb, expertise chips, availability, the backup owner when set (HR module) with the same actions, the delegate when set (9.3), and four actions: Message, Ask a question, Email, Copy link, plus "Chat in Teams" (9.4).
- Search results and Ask NPC answer cards carry the same control.

### 9.2 In-app messaging
- Data: `message_threads` (id, subject, resource_type, resource_id, created_by, created_at, last_message_at), `thread_participants` (thread_id, user_id, last_read_at, is_delegate_for_user_id), `messages` (id, thread_id, sender_id, body, attachments_json, created_at).
- Compose: from the person card, a compact compose box on the spot (subject prefilled with the item title and its deep link, body, optional attachment from Institutional Memory); send creates the thread, a notification, and an unread count.
- **Inbox** (`/inbox`): a new icon in the top bar next to notifications with an unread badge; threads grouped by item, filters (unread, by item type, by person), the thread view with replies, "Convert to question" (creates a routed question in Ask NPC from the thread and links it), and "Mark done".
- Messages are private to participants (and delegates); admins do not read them; they are excluded from search and Ask NPC.

### 9.3 Delegates
- On the profile: "Delegate my messages to" (one person, optional date range). Messages to the person also land in the delegate's inbox (marked "as delegate"), and the person card shows "Delegate: name". Everyone is reachable; delegation only adds a recipient.

### 9.4 Teams action
- "Chat in Teams" on the person card opens a small dialog: "Chat in Microsoft Teams will be activated after deployment and integration" (both languages) with a close action. No deep link yet; keep the button so the client sees where it will live.

---

## 10. Operating Model and the Processes page

### 10.1 Processes, Policies, and SOPs (`/processes`, Knowledge Hub group)
- The single home for the process architecture and the rules: Level 0 value chain (the eight core processes: national strategy development, sector strategy support, monitoring and evaluation, statistics production and dissemination, data governance, foresight and risk, international index monitoring, institutional development), Level 1 processes under each, Level 2 procedures and SOPs, plus policies and forms. Data: `processes` (id, parent_id, level (0, 1, 2), code, name_en, name_ar, purpose_en, purpose_ar, owner_unit_id, inputs_json, outputs_json, steps_json, systems_json, kpis_json, policy_document_ids_json, sop_document_ids_json, status, is_illustrative).
- Page: the Level 0 chain as a horizontal process map (cards in a chain with connectors); clicking a process expands it in place to its Level 1 processes; each opens a panel with purpose, owner unit (OwnerControl), steps (numbered, designed), inputs and outputs, governing policies and SOPs as a mini shelf, KPIs, interfaces (10.2) that belong to it, and "Ask about this process". Views: by process (default), by unit (what each unit runs), by policy type (policies, procedures, forms across units, reusing the unit tabs' data). Editing: Strategy Office and Super Admin for processes; unit heads for their unit's policies and SOPs as already built.
- The Organisation unit panel's Policies and Procedures tabs read from and write to the same documents, and the unit panel gains a "Processes this unit owns" list.

### 10.2 Operating Model (`/operating-model`, People and Organisation group)
Sections on one page with in-place expansion, editable by the Super Admin and the Strategy Office:
1. **Operating principles**: five to seven principles as an editorial band, each with a one-line explanation.
2. **Governance and decision rights**: bodies from the Council Strategy governance table plus the Council and the Secretary General; a governance map (bodies as cards, decision flows as connectors), each body's decisions, cadence, members, escalation path.
3. **Process landscape**: the Level 0 chain embedded from the Processes page (same component), every card opening the process there.
4. **RACI**: a matrix of Level 1 processes against units with R, A, C, I cells as coloured chips, filters by process or unit, inline editing, built from `process_raci` (process_id, unit_id, role).
5. **Planning and reporting calendar**: an annual ring calendar with strategy review windows, budget cycle, statistical release calendar, NDS3 reviews, Council meetings, report deadlines (from the Reports module), Doha Data Forum; hover shows what is due, click opens the item; data in `calendar_events` (id, kind, title_en, title_ar, date_from, date_to, owner_unit_id, linked_resource, recurrence).
6. **Interfaces**: **External**: entity cards (from the entities register) with what NPC provides and receives, focal points on both sides, legal basis, cadence, linked processes. **Internal**: a unit-to-unit interface map as a matrix (units by units, cells listing flows) and a chord diagram overview; each interface (`unit_interfaces`: id, from_unit_id, to_unit_id, flow_kind (`data|input|approval|review|deliverable`), description_en, description_ar, trigger, cadence, service_level, process_id, focal_from_user_id, focal_to_user_id, status) with the focal persons as OwnerControls; clicking a unit highlights everything it gives and needs; unit heads can propose changes (`interface_change_requests`), the Strategy Office approves.
7. **Operational KPIs**: a small scorecard (release timeliness, data request turnaround, strategy review completion, handover completion, policy review currency) fed from existing data where available, manual entry otherwise (`ops_kpis`, `ops_kpi_values`).
- Ask NPC: `get_operating_model(section)`, `get_process(code)`, `get_interfaces(unit)`.
- Seed (illustrative, marked): principles, governance bodies, the eight Level 0 processes with two or three Level 1 each and a sample of procedures with steps, a RACI for all Level 1 processes, a full annual calendar, ten external interfaces, twenty internal interfaces, and five operational KPIs with values.

---

## 11. Housekeeping for the feature half
- Migrations and seeds for every new table; Ask NPC tools and prompts updated for all new modules; README updated with every new page and flow; `DECISIONS.md` and `PROGRESS.md` updated; dead code and dead i18n keys removed (old level names, old library names, old rail, old handover UI, old index tracker leftovers).

---

## 12. Phase A: System cleaning (full QC of the codebase)
Only after Sections 1 to 11 pass. Produce `docs/qc/phase-a-cleaning.md` with findings and fixes.
1. **Static analysis**: TypeScript strict with no `any` except in typed boundaries (count and remove), ESLint with `react-hooks`, `jsx-a11y`, `import/no-cycle`, unused imports and exports (`ts-prune` or equivalent), dead files, duplicate components (merge), duplicate utilities (merge), circular imports (break).
2. **Runtime hygiene**: run every page in both locales with the browser console captured; zero errors, zero warnings (hydration mismatches, key warnings, act warnings, missing alt, unknown props); fix all.
3. **Data layer**: every query goes through the service layer; no raw SQL in components; N+1 queries found with query logging and replaced by joins or batched loads; missing indexes added (foreign keys, `created_at`, `status`, `classification_level`, unit and node ids, period columns, unique constraints); SQLite pragmas set (`journal_mode = WAL`, `synchronous = NORMAL`, `cache_size`, `temp_store = MEMORY`, `mmap_size`); a single shared connection per process; migrations idempotent from a clean database.
4. **Permissions**: an automated test that hits every API route and every page as each role (and as an anonymous user) and asserts allow or deny per the matrix; every mutation checks `can()`; hidden portals return 404; classification and visibility filters proven on search, Ask NPC, previews, and reports.
5. **AI layer**: prompts deduplicated and versioned; every AI call has a timeout, a retry policy, a token cap, and a mock; citation validator covers all answer paths; no AI call on hover or on page load (only on explicit action or scheduled jobs).
6. **Jobs**: the worker cannot block the request path; failed jobs retry with backoff and surface in Settings; no job runs at startup unless due.
7. **Consistency**: i18n key parity test; no hardcoded strings; every page has loading, empty, and error states; every list paginates; every form validates with Zod on both sides; dates and numbers localised everywhere; RTL screenshots of every page compared against LTR for mirrored layout.
8. **Security**: session cookie flags, CSRF on mutations, rate limits on login and AI endpoints, file upload validation (type, size, content sniffing), path traversal checks on storage, secrets only from env, no secrets in logs, security headers.
9. **Seeds**: rebuild from clean; the seed report has no errors; all illustrative flags present; no orphan references.
10. **Dependencies**: remove unused packages; pin versions; audit for known vulnerabilities; no native modules that require a build toolchain.

## 13. Phase B: Performance (the system must feel instant)
Only after Phase A. Produce `docs/qc/phase-b-performance.md` with measurements before and after.
Targets, measured with Lighthouse and Web Vitals in Chromium on the client's class of laptop, for every page in both locales: first load of the app under 2.0s to interactive from a cold start of the server, every route transition under 300ms, LCP under 1.5s, INP under 200ms, zero layout shift, server response for data pages under 200ms on warm cache. Record per page.
1. **Production mode for the demo**: add `npm run start:demo` that runs `next build` once and serves the production build (`next start`) with the job worker; the README makes this the way to run for the client, with `npm run dev` for development only. First-visit compilation delays disappear in production. If the dev server must be used, enable Turbopack and add a warm-up script that requests every route once after start.
2. **Bundles**: analyse with `@next/bundle-analyzer`; dynamic-import heavy libraries only on the pages that use them (pdfjs, d3 modules, Recharts, TipTap, the radar and chart components, the org chart, the constellation, transformers.js); no library loaded on Home that Home does not draw; tree-shake lodash-style imports; check that the AI SDK and parsers are server-only (`server-only` package) and never reach the client bundle; target under 250 kB gzipped JS for Home.
3. **Rendering**: server components for data pages; client components only for interactivity; streaming with `loading.tsx` skeletons that match final shapes; no client-side waterfalls (fetch in parallel, `Promise.all`); memoise expensive computations; virtualise long lists and shelves beyond 60 items; avoid re-rendering the whole shelf on hover (hover state local to the book, as specified).
4. **Data**: a request-scoped cache and a short server cache (30 to 120 seconds) for expensive aggregations (scorecards, at-a-glance numbers, leaderboards, radar, org tree, indices board); materialised tables for anything that aggregates the events ledger or the whole index history; precomputed search snippets; indexes verified with `EXPLAIN QUERY PLAN` on the top 30 queries.
5. **Search and embeddings**: keep embeddings in memory as `Float32Array` blocks loaded once per process (with an invalidation on ingest), normalised at load so similarity is a dot product; batch scoring; a cap on candidate chunks by metadata filters before scoring; FTS5 queries with `bm25()` ranking and prefix indexes; measure a search under 150ms at the seeded size and a hybrid Ask retrieval under 400ms.
6. **Assets**: fonts self-hosted with `font-display: swap` and preload for the two primary faces; images sized and lazy-loaded with `next/image` where local; SVG icons inlined once as a sprite; the constellation limited to 60 nodes and paused when off-screen or when the tab is hidden.
7. **AI latency**: stream every answer; Haiku for intent and reranking; prompt caching verified; the local embedding model loaded lazily on first use and kept warm; a "first token under 1.5s" check on Ask in real mode.
8. **Navigation**: prefetch on hover for cards and rail items; shared layout transitions light; the shell (rail, bar, launcher) never re-mounts between routes; the mini-player and the Ask panel persist across navigation without re-fetching.
9. **Cold start**: database opened once; migrations checked, not re-run; seeds never run at start; the job worker starts after the server is listening; measure cold start of `start:demo` under 3s to first request.
10. **Perceived speed**: skeletons identical to final layouts on every page; optimistic updates on every mutation; toasts non-blocking; no spinner anywhere a skeleton can exist.

## 14. Phase C: Final QC and client readiness
Only after Phase B. Produce `docs/qc/phase-c-final.md` and a `CLIENT_DEMO_GUIDE.md`.
1. **Line-by-line review**: review every file under `src/` for clarity, naming, dead branches, TODOs (resolve or record), duplicated logic, magic numbers (move to constants), and comments that no longer match the code; delete unused components, hooks, styles, routes, seeds, and assets.
2. **Every page, both locales, three widths (1440, 1024, 390)**: open each page as Super Admin, Knowledge Admin, HR Admin, Department Head, Contributor, and Reader; take screenshots; verify hover states, empty states, error states, RTL mirroring, focus rings, keyboard navigation; verify the top bar, launcher, mini-player, and Ask panel on every page; check no page shows illustrative data without its chip.
3. **End-to-end scenarios** (Playwright, all must pass): the ten Ask NPC reference cases plus council and organisation questions; upload to Institutional Memory through verification; Add Knowledge by text, upload, and voice (mock recognition); a full internal handover to a person with a learning path and sign-off, and an external handover to the system with filing approval; setting Knowledge of the Week and the first-open reveal; a message to an owner and the reply in the Inbox; Learn mode session; a podcast episode; a report generated, reviewed, approved, and published; an index added to a group with data; a structure edit with move, delete with reassignment, undo, and snapshot restore; the leaderboard periods; permissions per role; invitation and first login.
4. **Zero-defect gates**: no console errors or warnings on any page; no failed network requests; no 404 assets; no missing translations; no broken deep links; no unhandled promise rejections in the server log during the scenarios; no job failures during the scenarios; Lighthouse performance, accessibility, and best practices above 90 on every page.
5. **Demo readiness**: `npm run setup` from a clean clone completes without errors in under 15 minutes on the client's class of laptop (record the time); `npm run start:demo` serves the app; the seeded accounts work; `CLIENT_DEMO_GUIDE.md` walks the presenter through a 30-minute demo path across all modules with the exact clicks, the accounts to use, and what to say about illustrative data; a "reset demo data" script restores the seed state in under two minutes.
6. **Sign-off**: `PROGRESS.md` states every section of this change request as done, lists any deliberate limitation with its reason, and confirms the three phase reports. Nothing is left "partially done" without being named.

---

## 15. Acceptance checks (feature half)
1. Organisation: chart on a fixed viewport with correct pan and zoom, no page growth, panel below the viewport, keyboard navigation, list view; Settings editor with drag to move (confirm dialog with counts), add child at any level, inline rename, edit, deactivate and delete with the risk dialog and reassignment, undo, snapshots with restore, CSV import, level editing; department heads' "Request change" reaches the Super Admin.
2. Naming and rail: no "Knowledge Vault" or "Knowledge Hub" as the library's name anywhere; the rail shows the five groups in the fixed order with collapsible sub-menus, flyouts in the compact rail, Settings pinned; Studies page renders; Ask NPC removed from the rail, present as the top bar button, the floating launcher with the context nudge, the panel with context chip and persistence, Ctrl or Cmd plus K, and expand to the full page.
3. Experts: two views with counts and descriptions, Internal default, grouped by unit, separate filters, Add external only in External, search results in two groups.
4. Indices: nine groups seeded with the listed indices and fetched data where public, multi-group membership, per-group sections and summaries, edit mode drag between groups, forecasting and benchmarking for all groups including SDG goal scores and national indicators; Settings group manager and the three-step Add index.
5. Reports: the Reports page with the type gallery and example covers; the builder generates a report of each type in mock mode and, with a key, in real mode; review, section regeneration, approval, and publish to Institutional Memory work; the docx opens in Word with the cover, contents, section openers, at-a-glance tiles, two-column body, charts, scorecards, headers and footers; Arabic reports are RTL; Both produces two parts; page thumbnails exist when rendering was possible; custom reports available only to the Super Admin.
6. Handover: internal and external handovers start with the inventory; the leaving person's workspace with Add to handover, notes, and the capture interview (voice or text); external access link with expiry; per-item recipient decision; recipients get the banner, the persistent Handover page, and the generated learning path with progress and sign-off; system filing with proposal, approval, and reassignment; close blocked until complete with logged override; explicit cut-off; handover report archived; HR dashboard reads the records.
7. Gamification: levels shown as Level 1 to 10 only, old names absent; Leaderboard with the two boards, periods, categories, top 10 for everyone and full lists for the allowed roles, own row pinned, exclusions applied, materialised refresh; Home top 5 block.
8. Knowledge of the Week: admin sets a pick with note and week; first-open reveal once per user per week; Home strip with read count; ribbon, rail star, profile award, Hall of Knowledge; points awarded; separate from Lesson of the week.
9. Owners and messaging: OwnerControl on every listed page type, card, panel, and drawer; person card with the actions, backup, and delegate; in-app messaging with Inbox, unread badge, threads, convert to question, mark done; delegate routing; Teams dialog text.
10. Operating Model and Processes: the Processes page with the Level 0 chain, Level 1 and 2 expansion, panels, three views, and shared data with unit tabs; the Operating Model with principles, governance map, embedded landscape, RACI, ring calendar, external and internal interfaces (matrix and chord) with change requests, and operational KPIs; Ask NPC answers the process and interface questions.
11. Typecheck, lint, build, unit tests, and the smoke suite pass before Phase A begins.
