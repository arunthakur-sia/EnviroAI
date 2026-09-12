# SiaNexus Change Request 01
## Branding, Trends and Signals, Home, Ask NPC 2.0, Add Knowledge

Applies to the existing SiaNexus codebase built from `NPC_KMS_BLUEPRINT.md`. This file changes specific behaviours; everything not mentioned here stays exactly as it is.

---

## 0. How to run this change request

1. Read this file fully. Then open the codebase and read `DECISIONS.md`, `PROGRESS.md`, and the route and component tree, so you apply changes to the real file names, not the ones assumed here. Where a path in this document does not match the codebase, find the equivalent and record the mapping in `DECISIONS.md`.
2. **Do not change the visual design system.** No new colours, no new fonts, no new spacing scale, no layout rewrites, no motion changes. The client loves the current look. New screens and components must be built from the existing tokens and components so they are indistinguishable in style from what exists. If you need a new component, copy the style of the closest existing one.
3. Work through Sections 1 to 6 in order. After each section: `npm run typecheck`, `npm run lint`, `npm run build`, run the relevant checks from Section 7, take EN and AR screenshots into `data/screenshots/cr01/`, and append to `PROGRESS.md`.
4. Never stop to ask. Decide, record in `DECISIONS.md`, continue. If an external call fails, retry twice, fall back as specified, continue.
5. Keep AI Mock Mode working for every new feature: every new AI function needs a deterministic mock in `src/server/ai/mock.ts`.
6. No em dashes in UI copy, comments, or docs. Bilingual everywhere: every new string in `messages/en.json` and `messages/ar.json`, Arabic written natively.
7. When finished, update `README.md` (tour and screenshots), run the full smoke script, and stop.

---

## 1. Branding

### 1.1 Product name
Replace every remaining user-facing occurrence of "NEXUS" or "Nexus" with "SiaNexus" (English) and "سيا نكسس" (Arabic): app title, `<title>` tags, login page, footer, emails or notifications copy, README, i18n message files, seed data strings (word of the day tips, onboarding copy, spotlight blurbs). Search the whole repo, including `messages/*.json` and `scripts/seed.ts`. Internal identifiers (folder names, component names, database name) may stay; only user-visible text changes.

### 1.2 SiaNexus wordmark
Files are in `brand/` next to this document: `SiaNexus_logo.svg`, `SiaNexus_logo_transparent.png`, `SiaNexus_logo_white.png`. Copy to `public/brand/`.
- Replace the current logo component output with the wordmark: `full` variant uses the SVG; `compact` variant crops to the Sia part with the slash (viewBox `0 0 1032 400` of the same SVG); `mark` variant is the teal slash alone on a square canvas.
- Placement: keep the logo exactly where the current logo sits (rail top, login page, footer). Do not move it. Match the current rendered height; do not enlarge.
- Do not recolour or restyle the wordmark. Sia ink `#0A151E` and teal `#00DECC` exist only inside the wordmark.

### 1.3 NPC logo at the top right
Files: `brand/NPC_logo_transparent.png` and `brand/NPC_logo_white.png` (the official NPC lockup: Arabic name, English name, "State of Qatar", and the maroon emblem). Copy to `public/brand/`.
- Add the NPC logo to the top bar at the end side (top right in English, top left in Arabic, because the top bar mirrors in RTL; "top right" in the client's words means the end side of the bar). Height matches the top bar content height, roughly 32 to 36px rendered, vertically centred, with a `me-4`/`ms-4` margin consistent with the bar's existing spacing. On widths below 1024px show only the emblem part by cropping the image with `object-fit` and a fixed width, or hide it below 768px.
- The logo is a static image, not a link, with `alt="National Planning Council"` / `alt="المجلس الوطني للتخطيط"`.
- The existing top bar controls (search, notifications, language switch, avatar) keep their positions; the logo sits after them at the very end of the bar, separated by the bar's existing divider style if one exists. If the bar becomes too crowded at 1280px, reduce the search input width by up to 80px rather than moving anything.

---

## 2. Trends and Signals (replaces the Foresight preview)

### 2.1 Rename
- Rename the module everywhere: route `/foresight` becomes `/trends` (keep a redirect), rail label "Trends and Signals" / "الاتجاهات والإشارات", page title, i18n keys, settings references, DECISIONS entry. Database tables keep their names.
- Remove the "Preview" label and the placeholder explanation block. This is now a real module.

### 2.2 What it does
Continuously scans the internet for news, reports, announcements, and research related to NDS3 (and NDS2/NDS1 themes as archive context), turns what it finds into structured signal cards linked to NDS3 outcomes, targets, initiatives, and indicators, and lets NPC staff triage them into the knowledge base. It also keeps the risk heat map and the international index tracker from the current page, now fed by the same scanning.

### 2.3 Scanning mechanism (decided, do not ask)
Three sources, all through `src/server/scan/`:
1. **Claude web search** (primary). Use the Anthropic Messages API server-side web search tool (`type: "web_search_20250305"`) with `claude-sonnet-4-6`. Each scan runs a set of "scan briefs" (Section 2.5): for each brief, Claude searches the web, reads the results, and returns a strict JSON array of candidate signals with url, publisher, published date, title, summary in EN and AR, signal type, related NDS3 node codes, related indicator codes, impact, horizon, sentiment for Qatar, confidence, and a short "why it matters for NDS3" line. Cap 10 candidates per brief per run. If the web search tool is not available on the account, fall back to source 2 and log it.
2. **RSS and Atom feeds** (secondary, always on). A seeded, editable feed list in Settings > Trends and Signals: Qatar News Agency, Gulf Times, The Peninsula, Qatar Tribune, Doha News, Hukoomi news, GCO news, npc.qa news, IMF Qatar, World Bank MENA, OECD, UN ESCWA, WEF, Brookings Doha, plus Google News RSS queries (`https://news.google.com/rss/search?q=<query>`) generated from the scan briefs. Parse with `rss-parser` (pure JS). New items are stored raw, then a Claude Haiku pass classifies relevance to NDS3 (relevant or not, with node codes) and a Sonnet pass writes the bilingual card for relevant ones. Respect one request per feed per run and a 15-minute minimum interval.
3. **Manual**: paste a URL or upload a PDF report (uses the existing Vault parser). The same extraction turns it into signals.
Deduplication: normalise URL, hash title plus publisher plus date, and reject candidates whose embedding similarity to an existing signal exceeds 0.9 (reuse the embeddings provider). Store everything with `source_kind` (`web_search|rss|manual`), `raw_json`, `fetched_at`.
Scheduling: a job type `scan_run` queued every 6 hours by the existing worker (configurable in Settings), plus a "Scan now" button on the page (Knowledge Admin and Department Head). Each run writes a `scan_runs` row with counts, duration, tokens, and errors, visible in Settings.
Mock mode: `mock.ts` returns 12 seeded plausible signals per run from a static fixture with rotating dates so the UI always has data.

### 2.4 Data model additions
- `scan_briefs`: id, name_en, name_ar, query_en, query_ar, node_ids_json, indicator_ids_json, is_active, last_run_at, created_by.
- `feeds`: id, name, url, kind (`rss|atom|google_news`), is_active, last_fetched_at, last_error.
- `scan_runs`: id, started_at, finished_at, status, briefs_run, candidates, accepted_new, duplicates, errors_json, tokens_in, tokens_out.
- Extend `signals` with: source_kind, url, publisher, published_at, signal_type (`policy|market|technology|social|environment|geopolitical|index|research`), sentiment (`positive|neutral|negative|mixed`), confidence, why_it_matters_en, why_it_matters_ar, triage_status (`new|accepted|dismissed|converted`), triaged_by, triaged_at, converted_resource_type, converted_resource_id, scan_run_id, raw_json, embedding.
- `signal_links`: id, signal_id, resource_type (`node|indicator|document|risk|ranking`), resource_id, relation, source (`ai|human`).

### 2.5 Seeded scan briefs (bilingual queries; create 20)
One per NDS3 national outcome (7), one per priority cluster (5), and eight thematic: Qatarization and labour market; foreign direct investment in Qatar; Qatar fiscal policy and non-hydrocarbon revenue; Qatar renewable energy and emissions; Qatar digital government and AI; Qatar international index rankings; Qatar education and skills; Qatar population and census. Each brief carries its linked node and indicator codes so extracted signals inherit links.

### 2.6 Page design (`/trends`), using only existing components and tokens
Top: title, last scan time, "Scan now" button (permissioned), a slim filter row (outcome, signal type, impact, horizon, source, triage status, date range).
Section 1, **Signal stream**: a two-column masonry of signal cards in the style of the existing `LessonCard` and `KnowledgeCard`. Each card: publisher and date, title (current locale), two-line summary, "why it matters" line, linked NDS3 node chips (click opens the node), linked indicator chips, impact and horizon marks, confidence, and a triage strip: Accept, Dismiss, Convert to (Lesson, Risk, Vault document from source URL). Accepting awards points (Section 5.1 rules). Hover opens the source URL preview; click on title opens the full signal page.
Section 2, **Radar by outcome**: seven columns (one per outcome), each showing its accepted signal count for 30 days with a sparkline of daily volume and the top three signals. Built from the existing chart components.
Section 3, **Risk heat map** and Section 4, **International index tracker**: keep exactly as they are today, but each risk and ranking row gains a "Related signals" count that opens a filtered stream.
Signal page (`/trends/[id]`): full card, source excerpt (first 600 characters of the fetched page text, with a link), all links with edit controls, comments (reuse the answers component if a comment component does not exist), history, "Ask about this signal" (opens Ask NPC with the signal as context), "Brief me".
Empty state: "No signals yet. Run a scan or paste a link."

### 2.7 Settings
Settings > Trends and Signals: briefs editor (add, edit, activate), feeds editor, schedule interval, run history with per-run counts and errors, web search on/off toggle, daily token budget for scanning.

### 2.8 Where signals show up elsewhere
- Node pages in Living Strategy: a "Signals" section listing accepted signals linked to that node (last 90 days).
- Indicator pages: same.
- Home: a compact "This week in Qatar's signals" block is not added (Home changes are limited to Section 3). Instead, the "For you" list may include one accepted signal from the user's followed outcomes as one of its three items.
- Ask NPC: accepted signals are indexed for retrieval and appear as a source type (Section 4).

---

## 3. Home screen changes

### 3.1 Remove "Your first week"
Delete the onboarding quest card from Home and the quest logic behind it (the seven-step checklist, its state, the Welcome badge trigger). Remove related i18n keys and seed data. Nothing else on Home moves; close the gap so the layout stays balanced (the "For you" column and the hero card keep their positions).

### 3.2 Add the Ask NPC box
Place an `AskComposer` on Home directly under the greeting and word-of-the-day strip, full content width, before the "Did you know Qatar" hero. Same component and style as on `/ask`. Placeholder text (EN): "Ask anything about NDS3, statistics, documents, or people". (AR): "اسأل عن أي شيء في الاستراتيجية أو الإحصاءات أو الوثائق أو الخبراء". Submitting navigates to `/ask/c/[conversationId]` (Section 4) with the answer already streaming. Below the input, show three rotating example questions as quiet chips (from a seeded list of 15; clicking fills the box). If the user has an unfinished conversation from today, show a small "Continue: <title>" link at the end of the box.

---

## 4. Ask NPC 2.0: from search to a conversational analyst

### 4.1 Problem to fix
Today Ask NPC behaves like a literal search with a text answer. It must become a conversational analyst that plans, reasons over structured data, combines the library with the numbers, and returns a rich answer workspace with everything the person needs to act, then keeps the conversation open.

### 4.2 Reference behaviour (these are acceptance cases; write them as tests where possible)
1. "How are we doing in Qatarization?" → The engine (a) finds the NDS3 target(s) and initiatives about Qatari participation in the workforce from Living Strategy and the Vault, (b) finds the relevant indicators and KPI values from Statistics (Qatari share of employment, Qatari participation in the private sector, labour force participation), (c) computes the gap to target and the trend, (d) answers in three to five sentences with citations, then (e) shows below: the strategy target cards, the indicator tiles with charts, the source documents, related lessons, matching experts, and recent accepted signals, (f) ends with two or three context-aware follow-ups such as "Do you want the breakdown by sector?", "Should I brief this for leadership?", "Want to ask the labour statistics owner?".
2. "How many targets are in NDS3?" → The engine counts targets in the strategy tables (grouped by outcome) and answers with the number and the breakdown, noting the source is the SiaNexus strategy structure seeded from the NDS3 document, and offers "Show me the list" and "How many are on track?".
3. "Which outcomes are at risk?" → Uses KPI trajectories and status updates; lists at-risk nodes with reasons and evidence.
4. "What changed in fiscal sustainability this quarter?" → Combines status updates, KPI deltas, new documents, and accepted signals for that outcome in the period.
5. "Who should I talk to about census methodology?" → Expert matching with reasons, plus their recent contributions, plus "Send them this question".
6. "Compare NDS2 and NDS3 on labour market targets" → Reads both editions, aligns via lineage links, tabulates differences.
7. "What did we learn from the data policy rollout?" → Lessons plus decisions plus documents.
8. "ما هو معدل التضخم الحالي؟" → Answers in Arabic with the CPI indicator tile, latest value, delta, the release document, and the indicator owner.
9. "Is the FDI target realistic?" → Presents target, trajectory, gap, signals about FDI, and clearly separates evidence from judgement; it does not invent facts beyond NPC sources but may reason arithmetically over them.
10. Follow-up in the same conversation: "and by sector?" → resolves the reference to the previous topic and drills down without the user repeating context.

### 4.3 Architecture: an agent with tools, not a single retrieval call
Implement `src/server/ai/analyst/` as a tool-using loop on Claude (Sonnet by default; Opus for questions the planner classifies as complex, fallback Sonnet). The system prompt carries the NPC context, the glossary, the grounding rules (facts only from tool results; arithmetic and aggregation over tool results are allowed and encouraged; say clearly when something is not in SiaNexus), the bilingual rule, and the output contract (Section 4.5). Tools (all permission-filtered by the calling user's clearance and department scope, all logged):
- `search_knowledge(query, types[], filters)`: hybrid search over documents, lessons, decisions, verified answers, and accepted signals; returns chunks with ids, titles, pages, edition and classification chips.
- `get_document(id, pages?)`: summary, key facts, and optionally page text.
- `query_strategy(edition, node_type?, outcome_code?, text?, status?)`: returns nodes with counts; supports aggregation (`count_by: outcome|node_type|status`). This is what makes "how many targets" answerable.
- `get_node(id)`: node with KPIs, latest values, status updates, links, lineage.
- `query_indicators(text?, category?, codes[]?)`: indicator catalog search.
- `get_indicator_series(indicator_id, from?, to?, dimension?)`: values, target if linked to a KPI, computed latest, delta, CAGR, gap to target.
- `compute(expression, inputs)`: safe arithmetic over numbers returned by other tools (percent change, gap, average), so numbers are computed in code, not in the model's head.
- `find_experts(question_or_domain, limit)`: matching with reasons.
- `get_lessons(node_id?, text?)` and `get_signals(node_id?, text?, days?)`.
- `what_changed(node_id|outcome_code, period)`: status updates, KPI deltas, new documents, signals.
- `compare_editions(theme)`: nodes across NDS1/2/3 aligned by lineage and text similarity.
Loop: planner step (Haiku) classifies intent, language, complexity, and whether the question refers to the conversation history; then the analyst runs up to 8 tool calls; then it produces the structured answer. Stream progress to the client as "thinking chips" ("Searching the Vault", "Reading labour indicators", "Counting NDS3 targets") using the existing streaming infrastructure, then stream the answer text. Total budget per turn: 8 tool calls, 60 seconds, then answer with what was gathered.

### 4.4 Conversations
- Every question starts or continues a conversation (`ai_conversations` already exists). Routes: `/ask` (composer plus recent conversations), `/ask/c/[id]` (the conversation workspace). Conversations are private to the user, titled automatically from the first question, resumable, deletable, and can be shared as a read-only link to other NPC users at their clearance (shared views re-run permission filtering; sources the viewer cannot see are hidden with a count "2 sources hidden by clearance").
- The model receives the last 12 turns plus a running summary of older turns (generated by Haiku when a conversation exceeds 12 turns).
- Each assistant turn ends with two to three follow-up suggestions derived from the answer content (never generic). They render as chips; clicking sends them as the next user message.
- The user can pin any answer to a collection, export the answer workspace as a .docx brief, or send it to an expert as a routed question (existing routing flow).

### 4.5 The answer workspace (rich, not a text block)
The assistant returns a structured object streamed in parts, rendered as stacked sections built from existing components; sections appear only when they have content:
1. **Answer**: the prose answer with numbered citation chips (existing `CitationChip`), confidence meter, and the language toggle.
2. **Strategy**: cards for each referenced NDS3 node (type, code, title, status, owner, headline KPI with actual vs target), each opening the node page. Edition chip when not NDS3.
3. **Numbers**: `IndicatorTile` for each referenced indicator with sparkline, latest value, delta, gap to target, and an "Open in Statistics" link; if two or more indicators are compared, one combined chart.
4. **Documents**: `KnowledgeCard` list of cited documents with page references ("p. 42") that open the reader at that page.
5. **Lessons and decisions**: `LessonCard` list.
6. **Signals**: accepted signals relevant to the question (last 90 days).
7. **People**: `ExpertCard` list with reasons and "Ask them" buttons.
8. **Follow-ups**: the suggestion chips.
9. **Sources footer**: full source list with type, edition, classification, and verification marks, plus "Was this helpful".
The workspace is the same component on `/ask/c/[id]` and inside the reading panels ("Ask about this document" and "Ask about this signal" open the same workspace with the context pre-attached).

### 4.6 Smartness rules (write into the system prompt and cover with tests)
- Never say "not mentioned" without first checking whether the answer can be derived by counting, filtering, or computing over SiaNexus data; use `query_strategy` aggregations and `compute`.
- Distinguish three kinds of statements in the answer: facts from sources (cited), computations over sources (marked "calculated from" with the inputs), and judgement (clearly labelled as assessment). Never present judgement as a fact.
- Resolve pronouns and elliptical follow-ups from the conversation history.
- When the question is broad, answer the most likely meaning first, then offer the alternatives as follow-ups instead of asking a clarifying question.
- When data is incomplete (for example an indicator missing recent periods), say what is missing, show what exists, and suggest the owner who can update it.
- Keep the prose answer under 180 words; details live in the sections.
- Answer in the language of the question unless the user has set a preference.

### 4.7 Indexing additions
Add accepted signals, decisions, and strategy nodes (title plus description plus KPI names) to the unified index if not already there; add `edition` and `resource_type` to every index row so the chips render.

### 4.8 Mock mode
The analyst loop must run in mock mode with the same tools (the tools are real, only the model is mocked): the mock planner picks tools by keyword rules (numbers words → indicators; "how many" → `query_strategy` with count; "who" → experts; otherwise search), and the mock writer composes an extractive answer plus deterministic follow-ups. All ten reference cases must render a non-empty workspace in mock mode.

---

## 5. Add Knowledge: rough notes in, structured knowledge out

### 5.1 Entry point
Rename the lessons capture into a universal entry point. A primary button "Add knowledge" / "أضف معرفة" appears in the rail (below Home) and on the Lessons page. Route `/add`. Keep the existing lessons feed and pages; this replaces `/lessons/new` (redirect it).

### 5.2 Input
One screen, one big paste area, and one drop zone. Accepts any combination of: typed or pasted notes (any quality, any language, mixed languages), files (docx, pdf, pptx, xlsx, txt, md, images and photos of handwritten notes or slides), and links (URLs). Images and photos are read by Claude vision (`image` content blocks); pdf and office files use the existing Vault parsers. The user does not fill any form field before pressing "Structure with AI". Optional: a one-line "Where is this from?" field (conference name, meeting, site visit) that becomes the context.

### 5.3 What the AI does (`src/server/ai/knowledge_structurer.ts`, Sonnet; vision for images)
From the raw material it produces, in both languages:
1. A cleaned, well-written version of the notes (faithful to content, no invention; anything uncertain is marked "[unclear in notes]").
2. A classification of what this is, choosing one or more knowledge types: Lesson learned, Insight, Signal (trend or technology), Decision, Document for the Vault, Expert contact, Indicator observation. It can produce several items from one input (a conference summary can yield two signals, one lesson, and one expert contact).
3. For each item: title, structured fields per type (lessons: context, learning, recommendation; signals: publisher, type, impact, horizon, why it matters; experts: name, organisation, domains; documents: summary and key facts), suggested taxonomy tags, links to NDS3 outcomes, targets, initiatives, and projects (with a one-line reason each), links to indicators, links to existing documents and lessons (by similarity), suggested classification level, and confidence.
4. A short "what to do next" suggestion (for example "share with the Data Governance community" or "route to the Statistical Systems head").

### 5.4 Review screen
The results render as a stack of proposed items, each an editable card in the existing card styles: the improved text (side by side with the original on demand), the type selector, the tag chips (accept, remove, add), the NDS3 link chips with reasons (accept or remove; add via a search box), the classification chip, and attachments. The user can split, merge, or delete items, then presses "Publish" (all items) or publishes one by one. Published items go to their modules (lessons feed, signals stream with `triage_status = accepted`, Vault, expert profiles as drafts owned by the user) with the machine-generated language flagged as AI translation until reviewed, status `published` for lessons and `draft` for Vault documents (which then follow the existing verification flow).

### 5.5 Points (add to `game_rules`, editable)
- `knowledge_submitted`: 15 per published item (cap 90 per day).
- `knowledge_verified`: 25 per item when a verifier approves it (author).
- `knowledge_linked_to_nds`: 5 per accepted NDS3 link (cap 25 per item).
- `knowledge_from_event`: 20 bonus once per submission when the "Where is this from?" field names a conference, forum, or external meeting.
- Gap multiplier from the existing rules applies. Builder and Connector badge criteria count these events.

### 5.6 Mock mode
The structurer mock splits text by paragraphs, uses the first sentence as title, keyword-matches tags and NDS3 nodes, and returns one Lesson item per paragraph with "AI translation unavailable" flags.

---

## 6. Housekeeping
- Update `README.md`: new name, new logos, Trends and Signals, Ask NPC 2.0 workspace, Add Knowledge, removed onboarding quest, new settings, new env note (web search tool availability).
- Update `DECISIONS.md` and `PROGRESS.md`.
- Update seed: 20 scan briefs, 15 feeds, 30 accepted signals across outcomes (bilingual, realistic, with real public URLs where you can verify them during the build, otherwise mark `url` empty and `publisher` "seeded"), 15 example questions for the Home box, 5 seeded conversations for the analyst user that demonstrate the reference cases, 6 "Add knowledge" sample inputs in `sources/samples/` (a messy conference note in English, one in Arabic, a photo of handwritten notes generated as an image with rendered text, a slide PDF, a mixed-language email text, a URL list) used by the smoke test.
- Remove dead code and i18n keys from the onboarding quest and the Foresight preview.

---

## 7. Acceptance checks for this change request
1. Login page and rail show the SiaNexus wordmark at the previous size and position; top bar shows the NPC logo at the end side in EN and at the start side in AR; no visual token changed (diff `globals.css` and the Tailwind config: only additions for the two logo classes are allowed).
2. No user-visible "NEXUS" string remains (grep across `src/`, `messages/`, `scripts/`, `README.md`, excluding brand asset filenames and internal identifiers).
3. `/foresight` redirects to `/trends`; the page shows the signal stream, radar by outcome, risk heat map, index tracker; "Scan now" creates a `scan_runs` row and new signal cards (mock or real); Accept, Dismiss, and Convert work and log points; a node page shows its signals.
4. Home has no onboarding card; the Ask box sits under the word of the day; submitting a question lands on `/ask/c/[id]` with a streaming workspace.
5. The ten reference questions in Section 4.2 each render a non-empty workspace with at least two section types, citations, and follow-up chips, in mock mode and, if a key exists, with the real model. Case 2 returns a numeric count equal to the number of `target` nodes in the NDS3 edition. Case 10 resolves "and by sector?" against the previous turn.
6. Conversations persist, resume, share with clearance filtering, export to .docx, and route to an expert.
7. `/add` accepts the six sample inputs, produces at least one structured item each (the photo sample must produce readable text through vision or a clear mock), publishes them to the correct modules, and awards the new points.
8. Typecheck, lint, build, existing smoke script, and the new tests all pass; Lighthouse accessibility stays above 90 on Home, Ask, and Trends.
