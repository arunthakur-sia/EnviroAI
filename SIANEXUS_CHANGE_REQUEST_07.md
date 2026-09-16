# SiaNexus Change Request 07
## Lessons linked to projects, the Council Strategy, and the Organisation module

Applies to the SiaNexus codebase after Change Requests 01 to 06. Everything not mentioned here stays as it is. One unattended run.

---

## 0. How to run this change request

1. Read this file fully, then `DECISIONS.md`, `PROGRESS.md`, the component tree, and the latest screenshots. Map paths to the real ones and record the mapping in `DECISIONS.md`.
2. Run unattended. Never stop to ask. Decide, record, continue.
3. Two external sources must be downloaded at the start (Section 0.1). They live on npc.qa, which blocks generic crawlers but serves normal browser requests. Download them with a browser-like user agent through `curl` or Node `fetch`, and if that fails, use Playwright (already installed) to open the page and save the content. If both fail, look for a copy in `sources/manual/` placed by the user, and if that is also absent, continue with the fallback structure in Section 2.2 and record it in `DECISIONS.md`. Never stop.
4. Order: Section 1 (lesson linking), Section 3 (Organisation, because the Council Strategy owners depend on it), Section 2 (Council Strategy), Section 4 (housekeeping). After each: typecheck, lint, build, checks from Section 5, EN and AR screenshots into `data/screenshots/cr07/`, the self-critique loop from Change Request 03 Section 7 for new screens, `PROGRESS.md` entry.
5. Design rules from Change Requests 03 to 05 stay in force (tokens, colour scheme, anti-patterns, hover states, motion, performance). New screens must match the Strategy Canvas and the Learning Room in quality.
6. AI Mock Mode must keep working for every new AI function.
7. Bilingual as always: new strings in both message files, Arabic native, RTL mirrored, screenshots in both.
8. When finished: README updated, smoke script extended and green, then stop.

### 0.1 Sources to fetch first (`scripts/fetch-cr07-sources.ts`)
1. The results-based strategic planning manual (Arabic): `https://www.npc.qa/en/media/Doc/Documents/NDS2_Manual_Mar_2018_AR.pdf` (mirror: `https://psa.gov.qa/en/knowledge/Doc/Documents/NDS2_Manual_Mar_2018_AR.pdf`). Save to `sources/manual/NDS2_Manual_Mar_2018_AR.pdf`, extract the text with the existing PDF parser, and write `sources/manual/manual-structure.md`: the table of contents, the names of the results-chain levels exactly as the manual writes them in Arabic (and any English equivalents it gives), the indicator card fields, the implementation plan fields, the M&E and risk sections, and the prioritisation matrix. Section 2 uses this file as the authority for labels.
2. The organisational structure page: `https://www.npc.qa/en/aboutus/Pages/OrganizationalStructure.aspx` and its Arabic counterpart (`/ar/aboutus/Pages/OrganizationalStructure.aspx`), plus every department page linked from them. Save the HTML and extracted text under `sources/org/`, and write `sources/org/org-structure.json`: the hierarchy exactly as published (every level between the Secretary General and the departments, then departments, then sections if listed), and for each unit: name_en, name_ar, level, parent, head_name_en, head_name_ar, head_title, mandate_en, mandate_ar (verbatim), source_url, fetched_at. Also ingest the two pages and the department pages into the Vault as documents of type "reference" so Ask NPC can cite them.

---

## 1. Lessons learned linked to projects and initiatives

### 1.1 Rules (final)
1. Any lesson, in any of the four categories, may link to one or more strategy nodes (projects and initiatives under NDS3, NDS2, NDS1, and, after Section 2, Council Strategy projects and outputs). The link is optional; Delivery Lessons are expected to have one but are valid without it.
2. When several nodes are linked, one is marked primary and shown on the card; the others appear in the expanded lesson.
3. Lessons roll up: a target, an outcome, a council goal, or a council intermediate outcome lists and counts the lessons of everything beneath it, marked "inherited" with the originating node.
4. Who may link or unlink: the lesson's author, the owner of the project (stakeholder role `owner` or node owner), and users with verify rights in the lesson's domain. Others see the links read-only.

### 1.2 Data
- Replace the single `node_id` on `lessons` with `lesson_node_links` (id, lesson_id, node_id, is_primary, linked_by, linked_at). Migrate existing links as primary. Keep `lessons.node_id` as a computed alias of the primary link for backward compatibility in queries, or update all queries.
- Add `lesson_node_links.node_kind` (`nds|council`) so both strategy stores can be linked without a join across stores.

### 1.3 UI
- **Project and initiative pages and drawers**: the Lessons tab lists direct lessons first, then inherited ones from child nodes (for initiatives, the lessons of their projects), with counts in the tab label and an "Add lesson" action that pre-fills the node and the Delivery category.
- **Target and outcome levels** in the Strategy Canvas: a "Lessons" count chip and, on expansion, the rolled-up list grouped by originating project.
- **Lesson card and expanded lesson**: primary node chip; expanded view shows all links with the "Link to project" control (search by name or code, or drill Outcome > Target > Project); "Not linked to a project yet" state with the same control.
- **Learning Room, By project tab**: a proper picker with search and the drill-down, counts at every level, a "Not linked" group at the end; selecting a project shows its lessons and the inherited lessons of its parent initiative marked as such; a strategy store switch (NDS3 and archives, Council Strategy).
- **Add Knowledge**: the structurer suggests one or more nodes with reasons; the user accepts, and the first accepted becomes primary.
- **Ask NPC**: `get_lessons(node_id)` returns direct and inherited lessons with the originating node.

---

## 2. Council Strategy (الاستراتيجية المؤسسية للمجلس)

### 2.1 Placement and access
- New rail item "Council Strategy" / "الاستراتيجية المؤسسية" directly under "Living Strategy". Route `/council-strategy`. This is NPC's internal strategy; every screen carries an "Internal" chip in the header, and all council content defaults to classification Internal.
- Visible to all NPC staff. Editing rights: Knowledge Admin, Super Admin, and members of the Strategy Office, which is a configurable department in Settings > Council Strategy, seeded as the Department of Planning and Development Policies for Institutional Development and Modernization.

### 2.2 The results-based structure
Use the labels from `sources/manual/manual-structure.md`. If the manual could not be fetched, use this structure and mark the labels "to verify against the manual" in `DECISIONS.md`:
1. Strategic direction: Vision (الرؤية), Mission (الرسالة), Values (القيم).
2. Situation analysis: SWOT (نقاط القوة والضعف والفرص والتهديدات), stakeholder analysis (تحليل أصحاب المصلحة), challenges (التحديات), baseline (خط الأساس).
3. Results chain: Strategic goals / final outcomes (الأهداف الاستراتيجية / النتائج النهائية) > Intermediate outcomes (النتائج الوسيطة) > Outputs (المخرجات) > Projects and programmes (المشاريع والبرامج) > Activities (الأنشطة); Inputs (المدخلات) recorded on projects (budget, people, systems).
4. Indicators at every level with an indicator card (بطاقة المؤشر): code, name, definition, formula, unit, direction, baseline year and value, targets per year, frequency (monthly, quarterly, yearly, set per indicator), data source, responsible person, means of verification, notes.
5. Implementation plan (الخطة التنفيذية): projects with owner, department, start and end, budget, milestones, dependencies, status, deliverables, stakeholders.
6. Monitoring and evaluation framework, risk register (السجل المخاطر: risk, likelihood, impact, owner, mitigation, status, linked node), governance model (roles and meeting cadence), and the impact-versus-feasibility prioritisation matrix for projects.

### 2.3 Data model
- `council_strategies`: id, name_en, name_ar, period_from, period_to, vision_en, vision_ar, mission_en, mission_ar, values_json (list of {name_en, name_ar, description_en, description_ar}), status (`live|archived`), is_default, approved_on, source_document_id.
- `council_analysis`: id, strategy_id, kind (`swot|stakeholder|challenge|baseline`), payload_json (structured per kind: SWOT quadrants; stakeholders with interest and influence; challenges with description and linked goal; baseline statements), sort.
- `council_nodes`: id, strategy_id, parent_id, level (`goal|intermediate_outcome|output|project|activity`), code, title_en, title_ar, description_en, description_ar, owner_department_id (goals, intermediate outcomes, outputs), owner_user_id (projects, activities), status, start_date, end_date, budget_qar, inputs_json, priority_impact (1..5), priority_feasibility (1..5), sort, source_ref, is_illustrative.
- `council_indicators`: id, node_id, code, name_en, name_ar, definition_en, definition_ar, formula_en, formula_ar, unit, direction, baseline_year, baseline_value, frequency (`monthly|quarterly|yearly`), data_source_en, data_source_ar, means_of_verification_en, means_of_verification_ar, responsible_user_id, linked_statistics_indicator_id (optional link to the Statistics Hub), notes.
- `council_indicator_targets`: indicator_id, period (year, or year-quarter, or year-month), target_value.
- `council_indicator_values`: indicator_id, period, actual_value, status (`provisional|final`), source_document_id, entered_by, created_at.
- `council_milestones`: id, node_id, title_en, title_ar, due_date, done_date, status.
- `council_dependencies`: node_id, depends_on_node_id, note.
- `council_risks`: id, strategy_id, node_id, title_en, title_ar, description_en, description_ar, likelihood (1..5), impact (1..5), owner_user_id, mitigation_en, mitigation_ar, status, updated_at.
- `council_governance`: id, strategy_id, body_name_en, body_name_ar, role_en, role_ar, cadence, members_json.
- `council_alignment`: id, council_node_id, target_kind (`nds_node|nds_kpi|data_strategy_initiative`), target_id, note_en, note_ar. Maps council goals and outputs to the NDS3 outcomes, targets, and KPIs they support.
- Reuse existing cross-module tables with a `node_kind = council` discriminator: `node_leads`, `node_stakeholders`, `deliverable_meta`, `relations` (documents to council nodes), `lesson_node_links`, `signal_links`, and `podcast_episodes.source_scope_json`.

### 2.4 Page design (`/council-strategy`), one page, everything in place
1. **Header**: strategy name and period, the "Internal" chip, approval date, the Strategy Office owner, edition switch if more than one strategy exists (archives later), and the actions Brief me, Extract report, Listen (podcast from a goal or the whole strategy).
2. **Strategic direction band**: vision and mission as two editorial blocks in Fraunces (Arabic in Noto Kufi), the values as five chips that expand to their descriptions on click.
3. **Scorecard strip**: goals as a row of five medallion-style rings (share of indicators on target), with counts of intermediate outcomes, outputs, projects; a period switch (this month, this quarter, this year) that recalculates the rings for indicators of the matching cadence and shows the others as "reported yearly" or "reported quarterly" rather than blank.
4. **Results chain navigator**: clicking a goal opens its panel beneath the strip with a pointer tail (same pattern as the Strategy Canvas). Inside: description, owner department (linked to the Organisation module), the alignment chips to NDS3 (click opens the NDS3 outcome in the Living Strategy), the goal's indicator tiles, then intermediate outcomes as cards with their own indicators and a progress figure; clicking an intermediate outcome expands it in place to show its outputs as a lane of cards; clicking an output expands to show its projects and programmes as a lane. One item open per level; keyboard navigation as in the Canvas; sticky rail of the five goal rings on scroll.
5. **Project drawer** (end side, 520px): code, title, owner, department, status, timeline with milestones, budget and inputs, indicators with target versus actual charts, activities as a checklist with status, dependencies, deliverables as a mini shelf, stakeholders (six roles), lessons (direct), risks, signals, updates; Previous and Next between siblings; "Open full page" secondary.
6. **Results view** (toggle in the header, in place): the scorecard as a matrix of goals by period (months, quarters, or years according to a cadence selector) with RAG cells, trend arrows, and a click that opens the indicator card and its chart; a "Results narrative" written by the AI for the selected period from the data only (mock: templated).
7. **Reference sections** (collapsed accordions below the chain): Situation analysis (SWOT as four quadrants, stakeholder map as an interest-versus-influence grid, challenges list, baseline), Implementation plan (a timeline of all projects by department, with a filter), Monitoring and evaluation framework (indicator cadence table rendered as cards, reporting calendar), Risk register (5 by 5 heat map plus list), Governance (bodies and cadence), Prioritisation matrix (impact versus feasibility scatter of projects, draggable by editors, which updates the two priority fields).
8. **Editing**: inline editors for every level and for indicator cards, target and actual entry per period with a period picker matching the indicator's cadence, bulk import of actuals from xlsx through the existing import flow, and a change log.
9. URL state and history as in the Strategy Canvas: `?g=<goal>&io=<intermediate>&o=<output>&p=<project>`.

### 2.5 Integration across modules
- Vault: documents link to council nodes; a "Council Strategy" collection is seeded; deliverables on council projects follow the normal rules.
- Statistics: a council indicator may link to a Statistics Hub indicator; when linked, actuals are read from there.
- Experts and stakeholders: council projects use the same stakeholder section; expert profiles list council projects under "Projects" with an "Internal" chip.
- Lessons: linkable to council projects and outputs (Section 1); the Learning Room By project tab has the strategy store switch.
- Trends and Signals: signals may link to council goals; the radar gains a "Council" filter.
- Organisation: department pages show the council goals, outputs, and projects the department owns.
- HR dashboard: knowledge ownership counts include council nodes and indicators; missing-knowledge rules apply to council projects.
- Podcast: episodes from a council goal, output, or project.
- Reports: Extract report on any council level produces the docx with the Internal classification in the footer.
- Ask NPC: tools `query_council_strategy(level?, goal?, text?, status?, count_by?)`, `get_council_node(id)`, `get_council_indicator(id, period?)`, `get_council_scorecard(period)`, `get_council_alignment(node_id)`; every citation from council data carries an "Internal" chip and the source ("SiaNexus Council Strategy, illustrative data" while `is_illustrative` is true). The analyst prompt learns the results-chain vocabulary and answers questions such as "which outputs under goal 2 are behind this quarter?" and "how does the council strategy support NDS3 outcome 7?".

### 2.6 Illustrative content to seed (both languages, marked `is_illustrative = true`, with an "Illustrative" chip in the header until the real strategy replaces it)
- Strategy: "NPC Institutional Strategy 2025 to 2030" / "الاستراتيجية المؤسسية للمجلس الوطني للتخطيط 2025 - 2030", approved in 2025, owned by the Strategy Office.
- Vision, mission, five values, SWOT with four to six items per quadrant, eight stakeholders on the grid, six challenges, ten baseline statements.
- Five strategic goals aligned to NPC's mandate: national planning excellence, official statistics and data trust, foresight and risk readiness, institutional and digital excellence, partnerships and communication; each aligned to NDS3 outcomes (mainly outcome 7 and the data and statistics enabler) and to the National Data and Statistics Strategy.
- Twelve intermediate outcomes, thirty outputs, forty-five projects and programmes with owners across the real departments from the Organisation module, two to four activities each with statuses, milestones, budgets, and inputs.
- Eighty indicators with full cards, mixed cadences (about 25 monthly, 35 quarterly, 20 yearly), baselines, targets to 2030, and actuals for 2025 and the first three quarters of 2026 showing a realistic spread (most on target, some at risk, a few behind).
- Twenty risks, governance bodies (steering committee, strategy office, department focal points), priorities on the matrix, three deliverables per project for 15 projects, stakeholders for all projects, ten Delivery Lessons linked to council projects, eight signals linked to council goals, and two podcast episodes.

---

## 3. Organisation module (الهيكل التنظيمي)

### 3.1 Placement and scope
- New rail item "Organisation" / "الهيكل التنظيمي" under "Experts". Route `/organisation`.
- One organisation structure for the whole product: the existing `departments` table becomes the organisation units table (rename to `org_units` with a compatibility view, or extend it with the fields below); Department Spaces and the HR dashboard's department cards read from it; Strategy, Council Strategy, Experts, HR, and Ask NPC all reference the same units.
- Visible to all NPC staff. Editing of the structure: Super Admin and Knowledge Admin, in Settings > Organisation; unit heads edit their own unit's Policies and Procedures and visibility (3.5).

### 3.2 Data
- `org_units`: id, parent_id, level (`secretary_general|sector|office|department|section`, extend if the website shows other levels), code, name_en, name_ar, mandate_en, mandate_ar, mandate_source_url, mandate_fetched_at, head_user_id (when the head is a user), head_name_en, head_name_ar, head_title_en, head_title_ar, responsibilities_en, responsibilities_ar (from the HR module; shown together with the mandate), sort, is_active.
- `org_unit_members`: unit_id, user_id, role_in_unit (`head|deputy|member`), since.
- `org_sync_runs`: id, fetched_at, diff_json, applied_by, applied_at (for the "Re-sync from website" action).
- Policies and Procedures items are Vault documents with new knowledge types `policy_internal`, `procedure`, `form_template`, `service`, plus `document_unit_links` (document_id, unit_id) and, on `documents`, `visibility_scope` (`all_staff|unit_only|restricted`) and `effective_from`, `version_label`, `review_cycle_months`.

### 3.3 Seeding from the website
Seed `org_units` from `sources/org/org-structure.json` exactly as published, every level included (Section 0.1). Match head names to seeded users where they exist (the four known directors) and store the others as names with titles. Replace the placeholder departments from the original seed with the real structure; migrate all references (users, nodes, leads, stakeholders, indicators, lessons, HR data) to the matching real units by name, and record the mapping in `DECISIONS.md`. Ingest the mandate text into the Vault reference documents so Ask NPC can cite the website.

### 3.4 Org chart page
- **Chart**: a top-down tree, the Secretary General at the top, then each level as a row, drawn with SVG connectors in the `--connection` token, nodes as cards (unit name in the current locale with the other language beneath in `--ink-400`, head's monogram and name, headcount from members, a small chip for the number of policies and procedures published). Same visual language as the Strategy Canvas medallions and cards. Zoom and pan with the mouse or trackpad, fit-to-width on load, a mini-map at the corner for large trees, collapse and expand of branches, and a list view toggle (indented list with the same information) for accessibility and small screens. Search by unit or head highlights the matches and dims the rest.
- **Unit panel** (opens in place beneath the chart with the pointer tail, like the outcome panel): 
  1. Header: unit name, level, parent breadcrumb, head (name, title, monogram, link to profile), headcount, "Copy link".
  2. **Mandate**: the verbatim mandate from the website in both languages with the source link and fetch date, plus the HR responsibilities beneath it under "Responsibilities in SiaNexus" when they exist.
  3. **People**: the head first, then all employees in the unit as compact rows (monogram, name, position, expertise chips, link to profile), sorted by role then name; sub-unit staff grouped under their sub-units.
  4. **What this unit owns**: council goals, outputs, and projects; NDS3 initiatives and projects led; documents by type; indicators; lessons; experts; open handovers (HR, visible to HR Admin and the unit head only).
  5. **Policies and Procedures** (3.5).
  6. Sub-units as cards that open their own panel.
- URL state: `?unit=<code>` and history entries as in the Canvas.

### 3.5 Policies and Procedures (empty structure, ready for content)
- Four tabs in every unit panel and on the unit's full page: Policies, Procedures, Forms and templates, Service catalogue. Each tab lists its documents as a shelf of books (existing `Book` component, short height) with a designed empty state ("No policies added yet for this unit" and an "Add" button) shown to users who can add; others see "No policies published yet".
- Add: opens the Vault upload flow with the knowledge type, the unit link, `effective_from`, `version_label`, and `review_cycle_months` pre-set on the form, and the **visibility** control (below). Documents follow the normal Vault pipeline (parsing, AI enrichment, classification suggestion, verification).
- **Visibility, decided by the unit head**: a segmented control on every item with three options, "All employees" (`all_staff`), "This unit only" (`unit_only`), and "Confidential" (`restricted`, visible to the head, the Super Admin, and the named people or roles chosen in a picker). The head can change it in one click per item and in bulk (select several, apply). The classification level still applies on top (a document set to "All employees" but classified Confidential is still limited by clearance). Visibility is enforced in the database through the existing `can()` function and the search and Ask NPC filters, so hidden items never appear in results, previews, or answers for people outside the scope.
- Versioning: a new version of a policy supersedes the previous one; the panel shows the current version with a "History" link; review reminders to the head when the review cycle elapses.
- Ask NPC: `get_unit_policies(unit, kind?)` respecting visibility; answers cite the policy with its version and effective date.

### 3.6 Settings > Organisation
The structure editor (add, rename, move, deactivate units; set level; set head by user or by name), member assignment (bulk from a CSV of emails), the "Re-sync from website" action that fetches the pages again, shows the diff (new units, renamed units, changed mandates, changed heads) and applies only what the admin ticks, and the Policies and Procedures knowledge types list.

### 3.7 Integration
- User profiles and Expert Network profiles show the unit and its breadcrumb; the HR dashboard's Departments page reads from `org_units` and links to the unit panel; Council Strategy owners are units; NDS3 leads of kind `department` are units; Ask NPC gets `get_org_unit(name_or_code)` and `query_org(level?, text?)` and can answer "who heads the Statistical Operations department and what is its mandate?" citing the website document.

---

## 4. Housekeeping
- Migrations for all new tables and the departments to `org_units` change; a data migration report in `DECISIONS.md`.
- Seeds for Sections 1 to 3; the `fetch-cr07-sources.ts` script wired into `npm run setup` (skippable with `SKIP_CR07_FETCH=1`).
- Ask NPC system prompt and tools updated (lessons roll-up, council strategy vocabulary and tools, organisation tools); the "Internal" citation chip.
- README: lessons linking, Council Strategy (with the manual-derived structure and the illustrative data note), Organisation module (with the website source and the visibility model), new env notes.
- `DECISIONS.md` and `PROGRESS.md` updated; dead code from the old department seeds and the single `node_id` on lessons removed once queries are migrated.

---

## 5. Acceptance checks
1. Lessons: a lesson links to several nodes with one primary; links are optional for all categories; project and initiative pages and drawers show direct then inherited lessons with counts; target and outcome levels roll up; the Learning Room By project picker searches, drills, shows "Not linked", and switches between NDS and Council stores; linking and unlinking are limited to the author, the project owner, and verifiers; Ask NPC returns direct and inherited lessons.
2. Council Strategy: the manual was fetched and `manual-structure.md` exists (or the fallback is recorded); the page shows the Internal chip, the strategic direction band, the scorecard rings with the period switch handling mixed cadences, the results chain opening in place down to projects, the project drawer, the results matrix, the reference sections including the draggable prioritisation matrix, editing with cadence-aware period pickers, URL state and history; the illustrative data is seeded at the stated volumes in both languages; alignment chips open the NDS3 outcome; all cross-module integrations listed in 2.5 work; Ask NPC answers the two example questions with Internal citations.
3. Organisation: the website structure was fetched and seeded with every published level, mandates verbatim in both languages with source links, and heads; the chart zooms, pans, collapses, searches, and has a list view; the unit panel shows the mandate, the head, all employees on open (sub-unit staff grouped), what the unit owns, sub-units, and the four Policies and Procedures tabs with designed empty states; adding a policy pre-fills the form and the visibility control; a unit head can change visibility per item and in bulk; visibility is enforced in search, previews, and Ask NPC; Re-sync shows a diff before applying; every other module references the same units.
4. `docs/design-reviews/cr07-*.md` exist for Council Strategy and Organisation with no high or critical findings.
5. Typecheck, lint, build, unit tests, and the smoke script pass; Lighthouse performance and accessibility above 90 on Council Strategy, Organisation, and Lessons at 1440.
