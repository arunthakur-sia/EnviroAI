# SiaNexus Change Request 05
## Responsible entities, project stakeholders, International Indices module, HR Knowledge Dashboard, access control, and the new colour scheme

Applies to the SiaNexus codebase after Change Requests 01 to 04. Everything not mentioned here stays as it is. This is one unattended run covering all sections.

---

## 0. How to run this change request

1. Read this file fully, then `DECISIONS.md`, `PROGRESS.md`, the component tree, and the latest screenshots. Map paths to the real ones and record the mapping in `DECISIONS.md`.
2. Run unattended. Never stop to ask. Decide, record, continue. Retry failed external fetches twice, then fall back as specified.
3. Order: Section 1 (colour scheme first, because every later screenshot must show it), Section 2 (entities), Section 3 (stakeholders), Section 4 (Indices module), Section 5 (HR Knowledge Dashboard), Section 6 (access and configuration), Section 7 (housekeeping). After each: typecheck, lint, build, checks from Section 8, EN and AR screenshots into `data/screenshots/cr05/`, the self-critique loop from Change Request 03 Section 7 for new screens, and a `PROGRESS.md` entry.
4. Design rules from Change Requests 03 and 04 stay in force (anti-patterns, hover states, motion, performance). New screens must match the quality of the Strategy Canvas and the Learning Room.
5. AI Mock Mode must keep working for every new AI function (forecast explanations, benchmark narratives, handover checklists, risk narratives).
6. Bilingual as always: new strings in both message files, Arabic native, RTL mirrored, screenshots in both.
7. When finished: README updated, smoke script extended and green, then stop.

---

## 1. Colour scheme: Maroon Authority on a bright neutral ground

### 1.1 Decision
The client wants NPC colours with a bright, clean ground. The warm sand "paper" background is retired. The top bar becomes NPC maroon. Everything else stays light, white, and precise.

### 1.2 Token changes (keep the variable names to avoid churn; change the values; add a comment block explaining the new meaning)
- `--sand-50: #F6F7F9` (page background; bright neutral with a slight cool cast; was warm paper)
- `--sand-100: #EEF0F3` (secondary surfaces, rail background, bands)
- `--sand-300: #DDE1E6` (borders, dividers, ring tracks)
- `--ink-900: #1F2328` (body text, cool charcoal)
- `--ink-600: #5B6470`
- `--ink-400: #8A93A0`
- Maroon scale unchanged: `--maroon-900 #5A0E24`, `--maroon-700 #8A1538`, `--maroon-500 #A8325A`, `--maroon-100 #F6E7EC`.
- `--gulf-600 #0F6E76` and `--gulf-100 #DFF1F2` unchanged (data accent).
- `--gold-500 #C9A24D` and `--gold-100 #F8F0DA` unchanged (recognition only).
- Semantic colours unchanged.
- New: `--bar: #8A1538` (top bar), `--bar-ink: #FFFFFF` (text and icons on the bar), `--bar-muted: rgba(255,255,255,0.72)`, `--bar-field: rgba(255,255,255,0.14)` (search field on the bar), `--bar-field-focus: #FFFFFF`.
- New: `--plank: #E3E6EA` and `--plank-edge: #CBD1D8` for the library shelf boards (a physical object colour, not a UI surface). The Library cloth palette is unchanged, including `--cloth-sand` (a book colour, not a background).
- Shadows: keep the maroon-tinted warm shadow for hover; the resting card shadow becomes `0 1px 2px rgba(31,35,40,0.06), 0 1px 1px rgba(31,35,40,0.04)`.
- Cards: white `#FFFFFF` on `--sand-50`, 1px border `--sand-300` at 60 percent opacity where a border exists today.

### 1.3 Top bar
- Background `--bar`, height unchanged. All bar text and icons in `--bar-ink`; secondary text in `--bar-muted`.
- Search field: `--bar-field` background with `--bar-ink` text and placeholder at 72 percent; on focus the field becomes white with `--ink-900` text and a 2px gold focus ring (gold reads well on maroon and does not clash).
- NPC logo at the end side: use the new white monochrome file `brand/NPC_logo_white_mono.png` (copy to `public/brand/`), same height and position as today. Do not put the coloured logo on a white plate.
- Notifications icon, language switch, and avatar in `--bar-ink`; the avatar level ring uses gold on the bar.
- The mini-player (podcast) stays light; it docks under the content, not on the bar.

### 1.4 Rail, cards, bands, charts
- Left rail: `--sand-100` background, icons in `--ink-600`, active item in `--maroon-700` with a `--maroon-100` pill. The SiaNexus wordmark stays where it is.
- Bands (at-a-glance, outcome hero, quote band): `--sand-100`; the quote band's maroon wash stays.
- Charts: unchanged (maroon primary line, gulf comparison, gold target line); axis and grid hairlines move to `--sand-300`.
- Home constellation lines keep the `--connection` token.
- Shelf plank uses `--plank` with a `--plank-edge` bottom line; shelf background `--sand-100`.
- Login page: white card on `--sand-50`, the SiaNexus wordmark, a maroon primary button; the reveal animation stays.

### 1.5 Contrast audit
Run an automated contrast check (existing Lighthouse accessibility plus a script over the token pairs used for text) and fix any pair below WCAG AA. Take before and after screenshots of Home, Vault, Strategy, Ask, Trends, Lessons, Settings in both languages.

---

## 2. Responsible entities on initiatives and projects

### 2.1 Data
- `entities`: id, name_en, name_ar, short_name_en, short_name_ar, kind (`ministry|agency|authority|company|international|other`), logo_path (optional), website, contact_name, contact_email, is_active.
- `departments` (existing, NPC internal) stays a separate list.
- `node_leads`: id, node_id, lead_kind (`department|entity`), department_id or entity_id, role (`lead|supporting`), sort. Joint leads are allowed (several `lead` rows). Replace the free-text `owner_entity_name` by migrating its values into `entities` (deduplicated, Arabic names generated and flagged for review) and `node_leads`.
- Seed: the ministries and agencies named in NDS3 and NPC announcements as entities (at least 25, with real names in both languages), and lead assignments for every initiative and project (real where the sources say so, otherwise plausible and marked `verified = false`).

### 2.2 UI
- Initiative and project cards in the Strategy Canvas lanes and in the drawer header show the lead chip(s): the department or entity short name with a small kind glyph (building for ministries, NPC mark for departments); joint leads show as two chips; supporting entities appear in the drawer under "Supporting".
- Editing: in the node editor, two pickers, "Lead department(s)" and "Lead entity(ies)", plus "Supporting", with search and create-new for entities.
- Filters: the Canvas filter row and the map get "Lead" filters (department or entity).
- New view in the Canvas toolbar, "By lead": a grouped list of leads (departments first, then entities) with counts and a completion ring each, expanding in place to their initiatives and projects.
- Settings > Entities: the register with create, edit, merge duplicates, deactivate.
- Ask NPC: `get_node` and `query_strategy` return leads; answers name them ("led jointly by the Ministry of Finance and the Ministry of Commerce and Industry").

---

## 3. Stakeholders on projects and initiatives

### 3.1 Data
- `node_stakeholders`: id, node_id, person_kind (`employee|expert|external_contact`), user_id or expert_id or contact fields (name_en, name_ar, organisation, email), role (`sponsor|owner|manager|team|expert|external_partner`), role_note_en, role_note_ar (for experts: what they contributed, for example "methodology advisor"), domain_term_id (for experts), since_date, until_date, sort. A person may hold several roles on one node.
- Seed: sponsor, owner, and manager for every project, two to five team members, one to three experts with domains, and one external partner for projects led by entities; drawn from seeded users and experts.

### 3.2 UI
- A "Stakeholders" section at the bottom of project and initiative pages and at the end of the drawer, before the actions. Order: Sponsor, Project Owner, Project Manager, Team, Experts involved, External partners. Each row: monogram or portrait, name (both languages), department or organisation, the role chip, and for experts the domain chip and the role note; a contact action (email) and a link to the Expert Network profile. A person with two roles appears twice with distinct chips (the client wants it clear who is what).
- Editing: an inline "Add stakeholder" with role, person search (users and experts), and the note.
- Expert Network profiles gain a "Projects" section listing the nodes and roles.
- HR dashboard reads this table for project involvement (Section 5).

---

## 4. International Indices: a separate module with forecasting and benchmarking

### 4.1 Placement
- New rail item "Indices" / "المؤشرات الدولية" between Statistics and Trends and Signals. Route `/indices`.
- Remove the index tracker from the Trends and Signals page; leave a small "See international indices" link where it was.

### 4.2 Data model
- `indices`: id, code, name_en, name_ar, publisher, publisher_url, methodology_summary_en, methodology_summary_ar, scale (`rank|score|both`), score_min, score_max, higher_is_better (score direction), frequency, latest_year, responsible_entity_id, linked_node_ids_json (NDS3 targets), category (`economy|governance|society|environment|technology|human`), is_active, source_notes.
- `index_observations`: id, index_id, country_code (ISO3), year, rank, score, total_countries, source_url, fetched_at, status (`fetched|manual|verified`). Unique on (index_id, country_code, year).
- `index_pillars`: id, index_id, pillar_code, name_en, name_ar; `index_pillar_values`: index_id, pillar_code, country_code, year, rank, score.
- `countries`: iso3, name_en, name_ar, region (`GCC|MENA|G20|OECD|other`), flag_emoji is not used (no emoji); use ISO codes as text chips.
- `peer_groups`: id, name_en, name_ar, country_codes_json, is_default, owner_user_id (null for shared presets).
- `index_forecasts`: id, index_id, generated_at, horizon_years (1, 3, 5), central_rank, central_score, low, high, direction (`up|down|stable`), method_version, assumptions_json, inputs_json (signal ids, target ids, history window), simulation_summary_json, explanation_en, explanation_ar, status (`current|superseded`).
- `index_forecast_assumptions`: index_id, key, value, min, max, step, label_en, label_ar, editable_by (`admin|user_whatif`).

### 4.3 Scope and data fetching (mandatory, real data)
- The 12 indices in scope, with the ability to add more in Settings > Indices: Human Development Index (UNDP), Global Innovation Index (WIPO), Corruption Perceptions Index (Transparency International), E-Government Development Index (UN DESA), Global Peace Index (IEP), IMD World Competitiveness Ranking (IMD), Logistics Performance Index (World Bank), Network Readiness Index (Portulans Institute), Travel and Tourism Development Index (WEF), Environmental Performance Index (Yale), Global Talent Competitiveness Index (INSEAD), Rule of Law Index (World Justice Project). If the existing seed lists different indices, keep any of those that are still published and swap discontinued ones (for example the Global Competitiveness Index and Doing Business are discontinued; note this in the index record).
- `scripts/fetch-indices.ts`: for each index, fetch the publisher's public data (CSV, Excel, or web tables) for Qatar, the GCC countries (SAU, ARE, KWT, BHR, OMN), and a benchmark set (USA, GBR, SGP, KOR, TUR, EGY, JOR, MAR, DEU, FRA, JPN, CHN, IND) for all available years from 2010. Use direct downloads where the publisher offers files, otherwise use the Claude web search and web fetch tools to locate and read the latest reports and extract the tables with a strict JSON schema, and record every observation with its `source_url` and `fetched_at`. Where a value cannot be found, leave it missing; never invent. Save raw files under `sources/indices/` with a manifest. Produce `data/indices-report.md` with coverage per index and country. Re-run is available from Settings > Indices ("Refresh data") as a job.
- Pillar-level data: fetch where the publisher provides it (GII, EGDI, EPI, WJP, GTCI, NRI); otherwise skip pillars.

### 4.4 Index board (`/indices`)
- Header: title, last data refresh, "Refresh data" (permissioned), the category filter chips, and a toggle Cards or Table.
- Cards (default): one per index, ranked by Qatar's latest rank, showing name and publisher, Qatar's latest rank ("31 of 133") and score, change vs previous year with an arrow, GCC position ("2nd in GCC"), a 10-year rank sparkline (inverted so up means better), the forecast direction chip for 3 years, the responsible entity chip, and the linked NDS3 target chip. Hover: lift, warm shadow, and the sparkline highlights the last point. Click opens the index page.
- Table toggle: a compact table (name, publisher, year, rank, score, change, GCC rank, 1y, 3y, 5y forecast arrows, entity), sortable, exportable to CSV and to the Extract report.
- Summary strip above the cards: number of indices improving, stable, declining (based on the last observed change), and the count where Qatar leads the GCC.

### 4.5 Index page (`/indices/[code]`)
Sections, all on one page with in-place expansion (no tables except the history table):
1. Header: name, publisher, methodology summary (expandable), responsible entity, linked targets, category, latest rank and score with year.
2. History: rank and score over time (dual view toggle), with the GCC leader's line as a faint comparison and the NDS3 target as a gold marker if any; the history table beneath (collapsible).
3. Pillars: a horizontal bar chart of the latest pillar scores against the GCC average, when pillar data exists.
4. Related signals: accepted signals linked to the index or its outcome (last 12 months) as compact cards.
5. Forecast (Section 4.6) with the summary and the expandable analysis.
6. Benchmark (Section 4.7).
7. Actions: Brief me, Ask about this index, Extract report.

### 4.6 Forecasting
Engine `src/server/indices/forecast.ts` (TypeScript, no external services; deterministic given inputs; unit tested):
1. **Baseline**: Holt linear exponential smoothing on the score series (fallback to rank when no score exists), with parameters fitted by minimising one-step-ahead squared error over the history window (default: all years since 2010, at least 5 points; with fewer than 5 points, use a damped linear trend and widen uncertainty). Produce point forecasts for years +1, +3, +5 (relative to `latest_year`).
2. **Signal adjustment**: for accepted signals linked to the index or to its outcome within the last 18 months, compute a weighted sentiment sum: weight = impact weight (high 1.0, medium 0.5, low 0.25) x horizon relevance (signal horizon matching the forecast horizon 1.0, adjacent 0.5, else 0.25) x age decay (exp(-age_months / 12)). Map the sum through a bounded function to an adjustment of at most plus or minus 4 percent of the score range for +1, 8 percent for +3, and 10 percent for +5. Store the contribution of each signal.
3. **Target pull**: if a linked NDS3 target states a rank or score for a year, blend the baseline toward the target with weight 0.3 at +1, 0.5 at +3, and 0.6 at +5, scaled by the target's current status (on track 1.0, at risk 0.6, delayed 0.3). Store the pull.
4. **Simulation**: Monte Carlo with 5,000 runs: resample residuals from the fitted baseline (bootstrap), perturb each signal's weight by a uniform factor between 0.5 and 1.5, perturb the target pull weight by plus or minus 0.15, and compute the distribution of the score at each horizon; report the 10th, 50th, and 90th percentiles as low, central, high.
5. **Rank derivation**: convert scores to ranks using the latest year's distribution of other countries' scores (assume other countries drift by their own Holt trend), and report the rank range.
6. **Direction**: up if central at +3 is better than the latest value by more than the residual standard deviation, down if worse by more, otherwise stable.
7. **Explanation**: Claude writes a bilingual explanation from the stored inputs only (history trend, the top three signals with their contribution, the target pull, the simulation range), separating evidence from assessment; the mock produces a templated explanation from the same numbers.
8. **Summary table** on the Indices board and at the top of the forecast section: index, latest, +1, +3, +5 (central with arrows), range, confidence (narrow, medium, wide from the range width), each row expanding to the supporting analysis.
9. **Forecasting method section** (per index, expandable): the method described in plain language in both languages, the assumptions with their current values, the calculation steps with the actual numbers (fitted parameters, each signal's weight and contribution, the target pull), a simulation chart (histogram of outcomes per horizon as a light area chart) and a fan chart (history plus the low, central, high bands), and a sensitivity list (the three inputs that move the forecast most).
10. **What-if simulator**: sliders for the editable assumptions (signal adjustment strength, target pull weight, history window, and an optional manual shock in score points) that re-run the simulation in the browser (port the engine to a shared module usable client-side, or call a fast server endpoint with a 1,000-run mode) and update the fan chart and table live; a "Reset to official" control; what-if results are never stored as official.
11. Recompute: on data refresh, on signal acceptance linked to the index, on target status change, and nightly. Store as a new `index_forecasts` row and supersede the previous one; keep history so changes in the forecast can be shown ("forecast moved from 28 to 26 after two signals").

### 4.7 Benchmarking
- Default peer group: GCC (SAU, ARE, KWT, BHR, OMN). Presets: GCC, MENA sample, G20 sample, Top 10 of the index. Users can create and save custom groups from the country picker (search by name in both languages).
- Views (in place, toggle): rank over time for the group (lines, Qatar in maroon, others in muted greys with the leader in gulf), latest score comparison as a horizontal bar chart sorted best to worst, gap to the group leader as a single number with the pillars where the gap is largest (when pillar data exists), and a "Where Qatar leads and lags" narrative written by the AI from the data (mock: templated).
- Cross-index benchmark on the board: "Qatar vs GCC" mode shows, for every index, Qatar's position within the GCC as a small 1 to 6 scale with the leader named.
- Export: the benchmark view to the Extract report (docx) with the charts.

### 4.8 Settings > Indices
Index register (add index with publisher, scale, direction, category, entity, linked targets), data refresh, manual observation entry and correction (with a `manual` status), forecast assumptions defaults, peer group presets, forecast recompute now.

### 4.9 Ask NPC
Tools: `get_index(code)`, `query_indices(filters)`, `get_index_forecast(code)`, `benchmark_index(code, countries[])`. The Indices are a source type with a chip; forecasts are cited as "SiaNexus forecast, method v1, generated on date", never as facts.

---

## 5. HR Knowledge Dashboard

### 5.1 Roles and access
- New system role **HR Admin**: full read across the HR dashboard for all departments, edit of employee status and handovers.
- **Department Heads** see the dashboard scoped to their own department.
- Nobody else sees the module; it is a portal in the access model (Section 6).
- Privacy: the dashboard shows knowledge ownership, project involvement, expertise, and handover state. It never shows gamification points, badges, streaks, Learn sessions, or private notes.

### 5.2 Data model
- `departments` gains: responsibilities_en, responsibilities_ar (rich text), key_projects_note.
- `employee_status`: user_id, status (`active|leaving|transferring|long_leave`), effective_date, target_department_id (for transfers), note, set_by, set_at.
- `ownership_backups`: resource_type, resource_id, backup_user_id, set_by, set_at (a named backup owner for any owned item: document, node, indicator, lesson, expert profile ownership, collection).
- `handovers`: id, user_id, kind (`leaving|transferring|leave`), created_by, created_at, due_date (defaults to effective_date), successor_default_user_id, status (`open|in_progress|complete|overdue`), completion_pct, completed_at.
- `handover_items`: id, handover_id, item_kind (`document|node_owner|node_role|indicator|lesson|expert_request|collection|community_lead|tacit_topic`), resource_type, resource_id, title, successor_user_id, status (`pending|reassigned|captured|not_needed`), note, done_at.
- `knowledge_captures`: id, handover_id, lesson_id or document_id (created through Add Knowledge, voice or text), topic, created_at.
- `hr_risks` (materialised nightly and on demand): id, kind (`incomplete_handover|outdated_content|missing_knowledge|overdue_update|single_point_of_failure|no_backup`), severity (`low|medium|high|critical`), department_id, user_id, resource_type, resource_id, title, detail_en, detail_ar, owner_user_id (who should act), detected_at, resolved_at.

### 5.3 Handover readiness score (per person, 0 to 100)
`readiness = 0.4 x share of owned items with a named backup + 0.3 x share of owned items that are verified and not past review + 0.2 x share of active project roles with a named deputy or successor + 0.1 x (1 if the person has at least one Expert Insights lesson or knowledge capture in the last 12 months else 0)`. Department readiness is the ownership-weighted average. Shown as a ring with the four components on hover.

### 5.4 Business-continuity score (per department, 0 to 100)
Start at 100 and subtract: 15 per critical risk, 8 per high, 3 per medium, 1 per low, floor 0. Shown as a ring with the risk breakdown.

### 5.5 Risk detection rules (nightly job and "Recompute" button)
- Incomplete handover: handover past due_date with status not complete: high; more than 30 days past: critical.
- Outdated content: verified document past review date: medium; more than 12 months past: high. Indicator with no value for two periods beyond its frequency: medium.
- Missing knowledge: active project with no deliverables and no lessons after its start date plus 6 months: medium; initiative or project with no lead: high; node with no linked documents: low.
- Overdue update: project with no status update in 90 days: medium; 180 days: high.
- Single point of failure: a person who is sole owner of 10 or more verified items or of 3 or more critical items (documents linked to targets, indicator ownership) with no backups: high; if that person's status is leaving: critical.
- No backup: any critical item without a backup owner: medium.
Each risk names the person who should act (the owner, the department head, or HR) and links to the fix (assign backup, reassign, update, create handover).

### 5.6 Pages (`/hr`, portal "HR Knowledge")
1. **Overview**: three rings (organisation readiness, business-continuity, handovers complete), risk counts by severity, a department heat strip (seven to ten department cells coloured by continuity score), the top 10 risks (ordered by severity then age) with the act-on link, and a "Recompute" button. Department Heads see their department only.
2. **Departments**: cards with responsibilities, head, headcount, key projects (from leads and stakeholders), knowledge repository summary (documents by type, verified share, stale share, lessons, deliverables), readiness and continuity rings, open handovers count; clicking expands in place to people, projects, and risks for that department. Edit responsibilities inline (HR Admin and the department head).
3. **People**: a searchable, filterable list (department, role, status, readiness band, expertise); each person row expands in place to: role and department, expertise domains, projects with stakeholder roles, knowledge owned (grouped by type with counts and the verified share), backups set, readiness ring, handover status, and the actions: set status, start handover, assign backup, request knowledge capture.
4. **Handovers**: list by status with due dates and completion bars; a handover page with the generated checklist grouped by item kind, successor pickers (bulk assign to the default successor, then adjust), item status, knowledge capture sessions (opens Add Knowledge in Speak mode with the handover pre-linked; the resulting lessons are Expert Insights linked to the handover), and completion. Notifications to the successor and the department head on creation, on each reassignment, and at due date minus 14, 7, and 1 days.
5. **Risks and delays**: the full risk register with filters (kind, severity, department, owner), grouped views, resolve action with note, and the trend of open risks over 12 weeks.
6. Extract report is available on every HR page (department or organisation continuity report).

### 5.7 Points
`handover_item_completed` 5 per item to the successor (cap 50 per day), `handover_completed` 60 to the successor and 40 to the leaving person if completed before the due date, `backup_assigned` 5 to the owner (cap 25 per day), `knowledge_capture_recorded` uses the existing Add Knowledge rules plus 20 bonus when linked to a handover. Points never appear on the HR dashboard.

### 5.8 Seed
Employee statuses (two leaving, one transferring, one on long leave), backups for about 60 percent of items, three handovers in different states, department responsibilities for all departments, and the risk register computed by the job at seed time.

---

## 6. User access and configuration

### 6.1 Portals and visibility
- Define portals as the top-level modules in the rail: Home, Knowledge Vault, Living Strategy, Statistics, Indices, Trends and Signals, Ask NPC, Lessons Learned, NPC Knowledge Cast, Experts, HR Knowledge, Settings.
- Each role has a portal visibility set; each user can have per-user overrides. A hidden portal is removed from the rail, from search results and Ask NPC sources of that portal, and its routes return a friendly 404 page for that user (not 403, so the existence of hidden portals is not revealed).
- Within a visible portal, the existing module permissions (read, create, edit, verify, manage), clearance levels, and department scope keep applying.

### 6.2 Per-user overrides
- `user_permission_overrides`: user_id, permission_key (portal visibility or module action), effect (`grant|deny`), reason, set_by, set_at, expires_at (optional).
- Effective permissions = role permissions + grants - denies, evaluated in the single `can()` function (extend it; do not add parallel checks).
- Settings > Users > user page: an "Access" tab showing the effective permission matrix with the source of each cell (role, grant, deny), toggles to add overrides with a reason, an expiry, and an audit trail. The Super Admin can also change the user's role, clearance, department scope, and portal set here.

### 6.3 Official email enforcement, invite-only
- Allowed domain: `npc.qa` only (Settings > Access > Allowed domains, editable by the Super Admin, seeded with `npc.qa`).
- Remove self-registration. The Super Admin invites users (single or CSV) with name, email, role, department, clearance, and portals; an invitation email (or, since there is no mail server locally, an invitation link shown to the admin and logged) carries a token valid for 7 days.
- First login: the user sets a password meeting the policy (minimum 12 characters, at least one letter and one digit, not in a small common-password list), confirms the email by the token, and accepts a short acceptable-use notice.
- Passwords are stored with bcrypt as today; sessions expire after 12 hours of inactivity and 7 days absolute; "sign out of all devices" on the profile.
- Login rejects any address outside the allowed domains with a neutral message; five failed attempts lock the account for 15 minutes; all events go to the audit log.
- Two-factor authentication is not included in this phase (record in DECISIONS).

### 6.4 Roles page update
Roles page adds portal visibility columns, the new HR Admin system role, and a "Preview as" action that lets the Super Admin see the rail and Home as a chosen role or user (read-only preview banner).

---

## 7. Housekeeping
- Seed and migrations for all new tables; `scripts/fetch-indices.ts` wired into `npm run setup` (skippable with `SKIP_INDICES_FETCH=1`).
- Ask NPC tools and system prompt updated for entities, stakeholders, indices, forecasts, benchmarks, and HR (HR data is available to Ask NPC only for users who can see the HR portal).
- Trends and Signals page: index tracker removed, link added; signals gain optional `index_id` links (extraction prompt updated so signals about a ranking link to the index).
- README: new colour scheme, entities, stakeholders, Indices module with the forecasting method, HR Knowledge Dashboard, access model (invite-only, domain, overrides, portals), env notes.
- `DECISIONS.md` and `PROGRESS.md` updated; dead code from the old owner field and the old index tracker removed.

---

## 8. Acceptance checks
1. Colours: the page background, surfaces, borders, and text use the new values; the top bar is maroon with white text, the white NPC logo, the translucent search field that turns white on focus; no beige or warm sand surface remains anywhere except book cloth colours; contrast audit passes; before and after screenshots exist for the seven listed pages in both languages.
2. Entities: register seeded; every initiative and project shows lead chips (joint leads render as two chips); supporting entities appear in the drawer; filters and the By lead view work; Ask NPC names the lead.
3. Stakeholders: every project shows the section in the specified order with role chips, expert domains and notes, contact and profile links; a person with two roles appears twice; inline add works; expert profiles list projects.
4. Indices: 12 indices seeded with real observations for Qatar and the GCC from the fetch script, sources recorded, coverage report produced; the board renders cards and table; each index page shows history, pillars where available, signals, the forecast summary, the method section with actual numbers and charts, the what-if sliders updating live, and the benchmark views with the GCC default and custom groups; forecasts recompute on signal acceptance; unit tests cover the engine (baseline fit, adjustment bounds, target pull, simulation percentiles, rank derivation, direction).
5. HR: HR Admin sees the overview, departments, people, handovers, and risks for all departments; a department head sees only their department; readiness and continuity scores compute as specified; starting a handover generates the checklist; reassignments, captures, and completion update the percentage and award points; risks materialise by the rules; no points or badges appear on any HR page.
6. Access: only `npc.qa` addresses can log in; self-registration is gone; invitations work end to end; password policy and lockout enforced; per-user overrides change effective permissions and appear in the audit; a hidden portal disappears from the rail, search, Ask sources, and returns 404; "Preview as" works.
7. Typecheck, lint, build, unit tests, and the smoke script pass; Lighthouse performance and accessibility above 90 on Home, Indices, HR overview, and Strategy at 1440.
