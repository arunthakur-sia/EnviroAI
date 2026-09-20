# NEXUS: National Planning Council Knowledge Management System
## Full Build Blueprint for Claude Code (Prototype, Local, One Shot)

Version 1.0. Prepared by Sia Partners Qatar for the National Planning Council (NPC), State of Qatar.
Audience of this document: Claude Code, running unattended. Read it fully before writing a single file.

---

## 0. Read this first: how to run this build

### 0.1 Your mission
Build a complete, running, local prototype of NEXUS, the internal Knowledge Management System of the National Planning Council of Qatar. The person who started you is going to sleep. When they wake up, they expect to run two commands and see a finished, seeded, bilingual, beautiful product in the browser. Nothing less.

### 0.2 Autonomy protocol (non-negotiable)
1. Never stop to ask a question. Every ambiguity is resolved by you, using this document first, then your best judgement. Write every decision you make that is not explicitly specified here into `DECISIONS.md` at the repo root (one line each: what, why, where it can be changed later).
2. Keep a `PROGRESS.md` at the repo root. Update it at the end of every milestone with what is done, what was verified, and what is known to be incomplete. Be honest in it.
3. Work through the milestones in Section 14 in order. Do not skip. Do not start a later milestone before the current one compiles and its checks pass.
4. Verify continuously: `npm run typecheck`, `npm run lint`, `npm run build`, and the smoke script in Section 15 must pass before you declare done. If something fails, fix it. Do not disable checks to make them pass.
5. If an external download (a source PDF, a font, a dataset) fails, retry twice, then use the fallback specified in this document and record it in `DECISIONS.md`. Never let a network failure stop the build.
6. If an API key is missing from `.env.local`, the app must still fully run in "AI Mock Mode" (Section 11.9). Never let a missing key stop the build or crash a page.
7. Design quality is the single most important success criterion of this project. If a screen looks generic, ordinary, or like a template, it is wrong. Rebuild it. Time spent on design is never wasted here. Read Section 5 twice.
8. No dark backgrounds anywhere. Light, airy, professional, alive.
9. No em dashes in any UI copy, comments, or generated documentation. Use commas, colons, or separate sentences.
10. Local only. No Vercel deployment, no GitHub push, no cloud database. Everything runs from `npm run dev` on a laptop with plain Node. Assume no Docker, no Python, no admin rights, and possibly no native build toolchain: only use npm packages that ship prebuilt binaries or are pure JavaScript.
11. When done, write `README.md` with exact run instructions, seeded accounts, and a screen-by-screen tour, then stop.

### 0.3 Environment assumptions
- Windows 11, Node 20 or 22 (portable install), npm available, Git available. No Python. No Docker. No Visual Studio build tools. Treat native compilation as unavailable.
- Internet is available for npm and for fetching public NPC sources and fonts during the build.
- Runtime API keys may or may not be present in `.env.local`: `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`. Design for both cases.

---

## 1. Product vision

### 1.1 One paragraph
NEXUS is the living memory of the National Planning Council. It holds every report, strategy, statistic, expert, lesson, and answer that NPC produces, and makes all of it findable in one search, explainable by AI with citations, and rewarding to contribute to. It replaces the folder-and-email culture with a place people open every morning because it knows what changed, who knows what, and what Qatar's numbers are saying today. It is the first stage of a knowledge transformation that, if it succeeds inside NPC, will be extended to every organisation in the State of Qatar.

### 1.2 What success looks like in the prototype
1. A director opens NEXUS and in under five seconds sees: today's Qatar fact, what changed in NDS3, the newest lessons learned, and a question waiting for their expertise.
2. An analyst drags a 200-page PDF into the Vault and ten seconds later it is titled, summarised, tagged, classified, linked to NDS3 outcomes, and available in both Arabic and English.
3. Anyone types a question in Arabic and gets a cited answer built from English documents, with one click to route it to the right expert if the answer is weak.
4. A director presses "Brief me" on an NDS3 outcome and gets a leadership-ready one-page brief.
5. The whole thing looks and feels like a product a top design studio shipped, not a government intranet.

### 1.3 Scope boundaries for this phase
- Users: NPC employees only. External experts exist as profiles, not accounts.
- Data: NPC data only, entered through uploads and forms. No SharePoint, email, or external system integration. Integration-ready API layer only (Section 13.6).
- Hosting: local. Portable to Supabase/Postgres and Vercel later without schema redesign.
- Languages: Arabic and English, full RTL, from day one.

---

## 2. Client context (use this to write real content, not lorem ipsum)

### 2.1 The National Planning Council
- Established by Amiri Decision No. 13 of 2024, replacing the Planning and Statistics Authority (PSA). Chaired by the Prime Minister and Minister of Foreign Affairs HE Sheikh Mohammed bin Abdulrahman bin Jassim Al Thani; Deputy Chairman is the Minister of Finance. Secretary General: HE Dr Abdulaziz bin Nasser bin Mubarak Al Khalifa.
- Competencies: developing national visions, strategies and development plans and supervising their implementation; ensuring achievement of Qatar National Vision 2030 (QNV 2030); monitoring future prospects in various sectors and analysing their impact on development plans; approving proactive planning projects and risk management; monitoring Qatar's ranking in indices issued by international organisations.
- The National Statistics Center sits inside the General Secretariat and is the official source of the State's official statistics.
- Ministries and public bodies are obligated to implement NPC policies, decisions and circulars and to supply data to the General Secretariat.

### 2.2 Known departments (seed these; make them editable)
1. Department of National Data Affairs (Director: Maha Al-Matwi)
2. Department of Statistical Systems (Director: Aysha Al-Humaidi)
3. Department of Statistical Operations (Director: Saud Al-Shammari)
4. Department of Planning and Development Policies for Institutional Development and Modernization (Director: Nada Al-Mahameed)
5. Department of Economic Planning (placeholder, no public director)
6. Department of Social and Human Development Planning (placeholder)
7. Department of Foresight and Risk (placeholder)
8. Department of Monitoring and Evaluation (placeholder)
9. Office of the Secretary General (placeholder)
10. Information Technology Department (placeholder)
Use only the four real director names; give placeholders generic seeded employee names (Section 12.5).

### 2.3 Knowledge assets NPC holds (this is the content universe)
1. Third National Development Strategy 2024 to 2030 (NDS3): seven national outcomes with targets, priority economic clusters with cluster strategies, sector strategies, delivery and enablement chapters. Developed with 20 plus sector teams and over 600 officials.
2. NDS3 Enablement Guidebook (governance of implementation, roles and responsibilities).
2b. The two earlier strategies as archives: NDS1 2011 to 2016 (14 sector outcome areas) and NDS2 2018 to 2022 (eight sector strategies, delivery framework, final results). These must be navigable in the same Living Strategy module as NDS3, with lineage between editions.
3. National Data Program: National Data Policy, National Data Standards (12 domains, 61 controls, 162 specifications), National Data Management Guide, Qatar Data Trust Index (7 dimensions, 50 sub-indicators), powered by the Q Insights platform.
4. Q Insights central database: 119 indicators for the Supreme Council for Economic Affairs and Investment.
5. Census 2025: Qatar's first administrative-records-only census, integrating data from more than 30 government entities, over 40 million data points.
6. Official statistics: monthly population figures, labour force, CPI and prices, national accounts (GDP), foreign trade, social statistics, education, health, environment, building permits, and annual statistical abstracts.
7. Qatar Open Data Portal (data.gov.qa) with over 1,100 datasets.
8. National Data and Statistics Strategy: 21 initiatives, 128 projects over three years.
9. NDS3 project portfolio: over 110 approved projects across 20 plus entities, funding exceeding QAR 3 billion.
10. Events and forums: Doha Data Forum, Qatar Datathon, National Development Forum, Council Forums.
11. International index monitoring (Global Competitiveness, Human Development Index, Ease of Doing Business successors, Global Innovation Index, E-Government Development Index, Corruption Perceptions Index, Global Peace Index, and others).
12. Legacy: NDS1 (2011 to 2016), NDS2 (2018 to 2022), QNV 2030 (2008), past censuses (2004, 2010, 2015, 2020).

### 2.4 NDS3 structure to seed (extract exact wording from the NDS3 PDF in `/sources`; use the list below as the fallback and as the validation reference)
Seven national outcomes:
1. Sustainable Economic Growth
2. Fiscal Sustainability
3. Future-Ready Workforce
4. Cohesive Society
5. Quality of Life
6. Environmental Sustainability
7. Government Excellence

Headline targets to extract from the PDF (verify each against the document; if the PDF cannot be parsed, seed these with `verified = false` and a note "to verify against NDS3 document"):
- Average real GDP growth of around 4 percent per year to 2030.
- Non-hydrocarbon sector growth and increased contribution to GDP.
- Labour productivity growth of around 2 percent per year.
- Attract around QAR 100 billion in foreign direct investment.
- Increase Qatari participation in the private sector workforce.
- Reduce per capita greenhouse gas emissions and expand renewable energy share (target 4 GW solar capacity).
- Government excellence: digital service targets and citizen satisfaction targets.
Priority economic clusters (verify against the PDF): manufacturing, logistics, tourism, financial services, and digital and ICT.
Cross-cutting enablers: private sector role, data and statistics, institutional excellence.

For every node you seed, store `source_ref` pointing to the page in the NDS3 PDF where the wording came from, so the client can audit it.

---

## 3. Technology decision (final)

### 3.1 The stack
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict, React 19 | Vercel-native later, server components for speed, streaming for AI |
| Database | SQLite via `@libsql/client` (file `./data/nexus.db`) with Drizzle ORM | Zero install, no Docker, prebuilt binaries, FTS5 available; Drizzle schema ports to Postgres later |
| Vector search | Embeddings stored as `BLOB` Float32 arrays; cosine similarity computed in Node (brute force, fine up to ~200k chunks); FTS5 for keyword | No native extensions needed; swap to pgvector on migration |
| Auth | Custom session auth: email plus password, bcryptjs, HTTP-only signed cookie (`iron-session`) | No external provider, simple, secure enough for local prototype |
| File storage | Local filesystem `./data/uploads/{documentId}/` with original file plus extracted text | Portable to Supabase Storage later |
| Parsing | `unpdf` (PDF), `mammoth` (docx), `xlsx` (SheetJS, xlsx/csv), `pptx` via `jszip` slide XML text extraction, images stored as-is | All pure JS |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) with streaming; models: `claude-sonnet-4-6` default, `claude-opus-4-6` for briefs (fallback to sonnet if opus not available), `claude-haiku-4-5` for classification jobs | Quality where it matters, cost where it does not |
| Embeddings | Voyage AI `voyage-multilingual-2` when `VOYAGE_API_KEY` present; otherwise `@xenova/transformers` with `Xenova/multilingual-e5-small` running locally (downloads model once to `./data/models`) | Arabic and English in one vector space, works offline |
| UI | Tailwind CSS 4, shadcn/ui (heavily restyled, see Section 5), Framer Motion 11, Recharts, TipTap, lucide-react, `react-dropzone` | |
| i18n | `next-intl` with `[locale]` routing, `ar` and `en`, RTL via `dir` attribute and logical CSS properties | |
| Background jobs | In-process job queue (`./src/server/jobs`) using a SQLite `jobs` table and a worker started with the dev server (`instrumentation.ts`); jobs: ingest, embed, translate, digest | No Redis, no cron service |
| Validation | Zod everywhere at API boundaries | |
| Testing | Vitest for unit, Playwright for smoke (Chromium download is allowed; if it fails, fall back to the Node fetch smoke script) | |

### 3.2 Migration path (write this into README and keep the code honest to it)
- Drizzle schema written with portable types only (text, integer, real, blob, timestamps as ISO text). A `postgres` schema variant is generated later by swapping the dialect.
- Vector search encapsulated in `src/server/search/vector.ts` with a single interface `searchSimilar(embedding, filters, k)`. pgvector implementation replaces the file.
- Storage encapsulated in `src/server/storage/index.ts` with `put/get/delete/url`. Supabase Storage implementation replaces the file.
- Auth encapsulated in `src/server/auth/*`. Supabase Auth or NAS SSO replaces the provider.
- All external system touchpoints go through `src/server/integrations/*` with typed stubs (SharePoint, Email, Q Insights, Open Data) that currently return "not configured".

### 3.3 Repository layout
```
nexus/
  README.md
  DECISIONS.md
  PROGRESS.md
  package.json
  .env.example
  drizzle.config.ts
  next.config.ts
  tailwind.config.ts (or CSS-first config for Tailwind 4)
  instrumentation.ts                 # starts the job worker
  sources/                           # downloaded public NPC material + manifest.json
  data/                              # runtime: nexus.db, uploads/, models/ (gitignored)
  scripts/
    fetch-sources.ts                 # downloads public NPC sources into /sources
    seed.ts                          # builds the full seeded database from /sources
    smoke.ts                         # end-to-end smoke checks
  messages/
    en.json
    ar.json
  src/
    app/[locale]/(auth)/login/...
    app/[locale]/(app)/home/...
    app/[locale]/(app)/vault/...
    app/[locale]/(app)/strategy/...
    app/[locale]/(app)/statistics/...
    app/[locale]/(app)/experts/...
    app/[locale]/(app)/ask/...
    app/[locale]/(app)/lessons/...
    app/[locale]/(app)/foresight/...
    app/[locale]/(app)/search/...
    app/[locale]/(app)/profile/...
    app/[locale]/(app)/settings/...
    app/api/...                      # route handlers (REST, versioned under /api/v1)
    components/ui/                   # restyled shadcn primitives
    components/nexus/                # product components (Shelf, KnowledgeCard, IndicatorChart, CitationChip, ...)
    components/motion/               # motion primitives (Reveal, CountUp, Stagger, PageTransition)
    lib/                             # utils, i18n helpers, formatting (Arabic numerals option)
    server/db/schema.ts
    server/db/client.ts
    server/db/migrations/
    server/auth/
    server/storage/
    server/ingest/                   # parsers, chunker, extractor
    server/search/                   # fts, vector, hybrid, intent
    server/ai/                       # anthropic client, prompts/, tools, mock mode
    server/gamification/             # rules engine, events, levels, badges
    server/jobs/                     # queue + workers
    server/integrations/             # stubs
    styles/globals.css               # design tokens
```

### 3.4 Scripts (package.json)
- `npm run setup` : installs, creates `./data`, runs migrations, runs `fetch-sources`, runs `seed`, downloads fonts and the local embedding model if needed. Idempotent.
- `npm run dev` : starts Next.js with the job worker on http://localhost:3000.
- `npm run seed` : rebuilds the database from `/sources` (drops and recreates).
- `npm run smoke` : runs Section 15 checks.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test`.

The README must make the whole thing runnable with exactly: `npm run setup` then `npm run dev`.

---

## 4. Brand and naming

### 4.1 Product name
Use a single bilingual name that reads naturally in both languages:

- English wordmark: **NEXUS**
- Arabic wordmark: **نِكسَس**
- Descriptor line (EN): "The knowledge memory of the National Planning Council"
- Descriptor line (AR): "الذاكرة المعرفية للمجلس الوطني للتخطيط"

The wordmark is set in the display face (Section 5.3) with a small maroon "knot" mark: three interlocking arcs forming an abstract node, drawn as an inline SVG (`components/nexus/Logo.tsx`). The knot references the Sadu weaving pattern of Qatar without copying any specific artwork. Draw it yourself, 32px and 120px variants, animated on the login page (arcs draw in over 900ms, once).

### 4.2 Palette (derived from NPC's public identity and the national colour)
Core tokens (define as CSS variables in `globals.css`, expose in Tailwind):
- `--maroon-900: #5A0E24` (deep Qatar maroon, headings on light)
- `--maroon-700: #8A1538` (primary, the national maroon; buttons, active states, wordmark)
- `--maroon-500: #A8325A` (hover, chart primary)
- `--maroon-100: #F6E7EC` (tints, selected rows)
- `--sand-50: #FBF9F5` (page background, the "paper")
- `--sand-100: #F4F0E8` (panels, secondary surfaces)
- `--sand-300: #E2DAC9` (borders, dividers)
- `--ink-900: #1E1B1F` (body text, a warm near-black, never pure black)
- `--ink-600: #5E5760` (secondary text)
- `--ink-400: #928B93` (placeholders, meta)
- `--gulf-600: #0F6E76` (secondary accent: data, indicators, links in charts)
- `--gulf-100: #DFF1F2`
- `--gold-500: #C9A24D` (recognition only: badges, verified marks, streak flame)
- `--gold-100: #F8F0DA`
- Semantic: `--ok: #2E7D5B`, `--warn: #B7791F`, `--danger: #B3261E`, `--info: #2F5F9E`
- Classification chips: Public `gulf`, Internal `sand-300 with ink`, Confidential `warn`, Secret `danger`.

Rule: white (`#FFFFFF`) is used only for cards and inputs floating on sand. The page is never pure white and never grey. It is paper.

### 4.3 Voice
Plain, confident, warm. Sentence case everywhere. Buttons say what happens: "Upload to Vault", "Ask", "Verify answer", "Brief me". Empty states invite an action. Errors say what happened and what to do. Arabic copy is Modern Standard Arabic, formal but not stiff, written natively, not translated word-for-word.

---

## 5. Design system (the game changer; read twice)

### 5.1 Design intent
NEXUS should feel like a beautifully bound national archive that has come alive: paper-light surfaces, generous whitespace, confident maroon, precise typography, and motion that behaves like paper and light rather than software. Professional enough for the Secretary General, delightful enough that an analyst opens it with their first coffee. The reference points are the best editorial and data products in the world, not intranet software. Benchmark: Linear's polish, Stripe's documentation clarity, The Pudding's data storytelling, Apple's motion restraint, Bloomberg's data density done with taste. Then exceed them.

### 5.2 Principles
1. Paper and ink, not glass and neon. Light backgrounds, warm neutrals, one deep accent.
2. Hierarchy through type and space, not boxes. Cards are used where content is a discrete object (a document, an expert). Lists, tables, and text blocks otherwise. Not everything is a card.
3. Every list is a "shelf". Documents render as book spines in shelf view and as cards in grid view; the shelf metaphor is the memorable idea of the product and is used consistently in the Vault, collections, and home.
4. Data is beautiful. Charts have hand-tuned axes, thin maroon lines, gulf-teal comparison series, direct labels instead of legends where possible, and animated draw-in on first view only.
5. Motion is orchestrated, not scattered. One choreographed entrance per page (staggered by 40ms per element, 320ms duration, custom ease `cubic-bezier(0.22, 1, 0.36, 1)`), then only motion that responds to the user: hover lift of 2px with a shadow that warms (maroon-tinted, not grey), expand and collapse with height animation, count-up on numbers when they enter the viewport (once), page transitions as a 180ms crossfade with 8px vertical drift. Respect `prefers-reduced-motion` fully.
6. Fast. Skeletons in the shape of the real content (shelves, not grey bars). Optimistic updates on every user action. Streaming text for every AI response with a caret that breathes.
7. Bilingual is not a translation layer, it is a design constraint: every layout is mirrored in RTL with logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`). Arabic typography gets its own scale (Section 5.3). Numbers can be shown in Western or Eastern Arabic numerals (user preference, default Western).
8. Accessibility floor: WCAG AA contrast, visible focus rings (maroon 2px offset), full keyboard navigation, `aria` on all interactive components, semantic headings.

### 5.3 Typography
- Latin display and headings: **Fraunces** (variable, optical size on, weight 500 to 600). Character, warmth, and authority.
- Latin body and UI: **Inter** (variable), sizes 14 to 16, tracking 0, line-height 1.55.
- Arabic UI and body: **IBM Plex Sans Arabic** (weights 400, 500, 600). Arabic display headings and the wordmark: **Noto Kufi Arabic** (600). Kufi gives Arabic headings a monumental, contemporary Gulf character that pairs well with Fraunces.
- Numerals in charts and KPI tiles: Inter tabular figures (`font-variant-numeric: tabular-nums`).
- Type scale (rem): 0.75, 0.875, 1, 1.125, 1.375, 1.75, 2.25, 3, 4. Arabic sizes are 6 percent larger at each step and line-height 1.7.
- Fonts are self-hosted: `scripts/setup` downloads them from Google Fonts into `public/fonts` (fallback: system fonts with the same metrics declared via `@font-face` `size-adjust`). Never load fonts from a CDN at runtime.

### 5.4 Layout
- App shell: a slim left rail (72px, icons with labels on hover, expands to 232px on demand) in `sand-100`, a top bar with global search (the search input is the single most prominent control in the app, 560px wide, centred), notifications, language switch, and the user's level ring around their avatar. In RTL the rail sits on the right.
- Content max width 1280px, 12-column grid, 24px gutters. Reading layouts (document reader, briefs) max 760px measure for text with a sticky right panel (left in RTL) for AI tools.
- Home is a composed magazine layout, not a dashboard grid of equal tiles (Section 8.1 has the wireframe).

### 5.5 Components to build with distinct character (in `components/nexus/`)
- `Shelf`: a horizontal row of `Spine` elements; each spine is a tall narrow card with the title running vertically (Latin rotated, Arabic stacked vertically per script rules), colour-coded by knowledge type, hover flips it 8 degrees on the Y axis to reveal a small cover with summary and owner. Click opens the reader.
- `KnowledgeCard`: grid card with type mark, title AR/EN, one-line summary, owner avatar, classification chip, verified mark, "reused N times" count.
- `CitationChip`: inline numbered maroon chip; hover shows the source excerpt; click opens the source at the exact page or indicator.
- `IndicatorTile`: latest value with big tabular number, delta arrow, sparkline, period, source, one-line AI narration on hover.
- `IndicatorChart`: Recharts line or bar with custom axis, direct end labels, target line dashed in gold, annotations for releases.
- `StrategyTree`: collapsible tree with node type marks and RAG dots; `StrategyGraph`: force-directed graph view using `d3-force` (pure JS) with outcome nodes as large maroon circles.
- `ExpertCard`: portrait, name AR/EN, domains as small chips, availability dot, "worked with NPC N times", endorsements count.
- `AskComposer`: the question box with language auto-detect, attach-context (choose a document or outcome), and a "route to expert" toggle.
- `AnswerStream`: streaming answer with citations, confidence meter (three segments), source list, feedback (helpful, not helpful, send to expert).
- `LessonCard`: compact card with context, learning, recommendation, and outcome tag.
- `DailyFact`: the "Did you know Qatar" card with a big number, hook line, and a one-question quiz that flips to reveal the answer.
- `LevelRing`, `StreakFlame`, `BadgeMedal`, `BountyCard`: gamification elements in gold and maroon, understated.
- `WordOfTheDay`: rotating strip (quote, NDS3 fact, tip).
- `Reveal`, `Stagger`, `CountUp`, `PageTransition`: motion primitives.

### 5.6 Design QA checklist (run on every screen before moving on)
1. Is there one memorable element on this screen, with everything else quiet?
2. Are there any grey boxes, default shadows, or identical cards in a grid where a list would be better?
3. Does it work at 1440, 1280, 1024, and 390px widths?
4. Does it mirror correctly in Arabic RTL? Take a screenshot of both.
5. Is there a real empty state with an action?
6. Does the page entrance animate once and then stay calm?
7. Is every number tabular and every date localised?
8. Would the Secretary General be proud to show this on a screen in a Council meeting?
Take screenshots with Playwright at each milestone (save to `./data/screenshots/`) and look at them. Fix what looks wrong.

---

## 6. Users, roles, and permissions

### 6.1 Accounts
Accounts exist only for NPC employees. Each account has one expert profile (Section 8.5) created automatically at first login. External experts are profiles without accounts, owned by an employee.

### 6.2 Default roles (seeded, editable in Settings; roles are data, not code)
| Role | Scope | Can |
|---|---|---|
| Super Admin | Global | Everything, including roles, users, taxonomy, classification, AI settings, gamification weights, audit |
| Knowledge Admin | Global | Manage Vault, taxonomy, collections, verify anything, manage experts, manage bounties, view analytics |
| Department Head | Own department | Verify content and answers in own department, manage department members and department collections, post bounties, see department analytics |
| Expert Verifier | Own domains | Mark answers as verified and content as verified within assigned taxonomy domains |
| Contributor | Global read at own clearance, write | Upload, edit own content, answer, capture lessons, edit own expert profile, propose tags |
| Reader | Global read at own clearance | Read, search, ask, follow, take daily quiz, complete own profile |

### 6.3 Permission model
Permissions are a matrix of `module x action`, stored per role as JSON: modules `vault, strategy, statistics, experts, ask, lessons, foresight, settings, analytics, gamification`; actions `read, create, edit_own, edit_any, verify, delete, manage`. Plus two scalar attributes per user: `clearance_level` (1 Public, 2 Internal, 3 Confidential, 4 Secret) and `department_scope` (`all` or `own`). A user can read an item if `item.classification <= user.clearance` and (department_scope is all, or item.department is the user's, or item is shared to all departments). Enforce in a single server-side `can(user, action, resource)` function used by every route handler and server component. Never rely on the UI alone.

### 6.4 The Roles page (Settings > Roles)
- Table of roles with member counts. Create role, duplicate role, edit permissions matrix as a grid of toggles with module rows and action columns, set default clearance and department scope, assign to users. Changes apply immediately. Super Admin cannot be removed from the last super admin.

### 6.5 Classification levels (aligned to the National Data Policy)
1. Public, 2. Internal, 3. Confidential, 4. Secret. Every document, indicator, lesson, question, strategy node, and expert profile carries a classification. Default on upload: Internal. AI suggests a level from content but a human confirms. Secret content is excluded from AI answers unless the asking user has clearance 4, and the answer is marked "includes secret sources".

---

## 7. Data model (Drizzle, SQLite dialect, portable)

Conventions: `id` text ULID; `created_at`, `updated_at` ISO strings; soft delete via `deleted_at`; bilingual fields as pairs `title_en`, `title_ar` plus `title_ar_machine boolean` flags; JSON columns stored as text with Zod schemas in `src/server/db/json.ts`.

### 7.1 Identity and organisation
- `users`: id, email, password_hash, name_en, name_ar, avatar_path, department_id, role_id, clearance_level, department_scope, locale_pref (`ar|en`), numerals_pref (`western|eastern`), quiet_mode, last_login_at, created_at.
- `roles`: id, name_en, name_ar, permissions_json, default_clearance, default_department_scope, is_system.
- `departments`: id, code, name_en, name_ar, description_en, description_ar, head_user_id, parent_id.
- `sessions`: id, user_id, expires_at, ip, user_agent.
- `audit_log`: id, user_id, action, resource_type, resource_id, meta_json, created_at. Actions include view, download, create, edit, verify, delete, ask, answer, login.

### 7.2 Taxonomy
- `taxonomy_dimensions`: id, code (`knowledge_type, outcome, sector, topic, year, language, source_origin`), name_en, name_ar, is_hierarchical.
- `taxonomy_terms`: id, dimension_id, parent_id, code, name_en, name_ar, description_en, description_ar, sort, is_active.
- `classification_levels`: id, level (1..4), name_en, name_ar, color, description.
- `taggings`: id, resource_type, resource_id, term_id, source (`human|ai_suggested|ai_confirmed`), confidence, created_by.

### 7.3 Knowledge Vault
- `documents`: id, title_en, title_ar, title_ar_machine, summary_en, summary_ar, summary_machine, key_facts_json (array of {text_en, text_ar, page}), knowledge_type_term_id, classification_level, department_id, owner_user_id, language_original, status (`draft|under_review|verified|expiring|archived`), review_due_at, verified_by, verified_at, source_origin (`npc|psa_legacy|partner|external`), publish_year, original_filename, mime, size_bytes, page_count, storage_path, text_path, current_version_id, view_count, download_count, reuse_count, is_seeded, source_ref.
- `document_versions`: id, document_id, version_no, storage_path, uploaded_by, note, created_at.
- `document_chunks`: id, document_id, version_id, chunk_index, page_from, page_to, heading, text, lang, token_count, embedding (BLOB), embedding_model. Also an FTS5 virtual table `chunks_fts(text, content='document_chunks')`.
- `document_tables`: id, document_id, page, caption, columns_json, rows_json, promoted_indicator_id (nullable).
- `collections`: id, name_en, name_ar, description_en, description_ar, cover_style, owner_user_id, department_id, visibility (`all|department|private`), is_featured.
- `collection_items`: id, collection_id, resource_type, resource_id, sort, added_by.
- `relations`: id, from_type, from_id, to_type, to_id, relation (`cites|derived_from|related|supersedes|about_node|about_indicator|about_expert`), source (`human|ai`), confidence.
- `reviews`: id, resource_type, resource_id, reviewer_id, decision (`verified|needs_changes|archive`), note, created_at.

### 7.4 Living Strategy (NDS3 live, NDS2 and NDS1 archive)
- `strategy_editions`: id, code (`nds3|nds2|nds1`), name_en, name_ar, period_from, period_to, status (`live|archived`), summary_en, summary_ar, source_document_id, is_default. Seed three editions: NDS3 2024 to 2030 (live, default), NDS2 2018 to 2022 (archived), NDS1 2011 to 2016 (archived).
- `strategy_nodes`: id, edition_id, parent_id, node_type (`vision|outcome|target|sector_strategy|cluster|initiative|project|enabler`), code, title_en, title_ar, description_en, description_ar, owner_user_id, owner_entity_name (for projects run by other entities), status (`not_started|on_track|at_risk|delayed|completed`), start_date, end_date, budget_qar, funding_source, sort, source_ref, verified.
- `kpis`: id, node_id, name_en, name_ar, unit, direction (`up_good|down_good`), baseline_value, baseline_year, target_value, target_year, frequency, indicator_id (link to statistics), owner_user_id, methodology_en, methodology_ar.
- `kpi_values`: id, kpi_id, period (ISO date or `2025`, `2025-Q2`, `2025-06`), actual_value, target_for_period, source_document_id, note, entered_by, created_at.
- `status_updates`: id, node_id, author_id, status, progress_pct, summary_en, summary_ar, risks_json, next_steps_json, evidence_document_ids_json, period, created_at.
- `node_dependencies`: id, node_id, depends_on_node_id, note.
- `node_lineage`: id, from_node_id (older edition), to_node_id (newer edition), relation (`continued|evolved_into|merged_into|discontinued`), note_en, note_ar. Lets a user trace how an NDS1 sector target became an NDS2 priority and then an NDS3 outcome.

### 7.5 Statistics and Indicators
- `indicators`: id, code, name_en, name_ar, definition_en, definition_ar, unit, decimals, frequency (`monthly|quarterly|annual|census`), department_id, source_en, source_ar, methodology_en, methodology_ar, category_term_id, classification_level, direction, first_period, last_period, is_headline, publish_calendar_json.
- `indicator_dimensions`: id, indicator_id, code (`nationality, sex, sector, region, age_group, activity`), values_json.
- `indicator_values`: id, indicator_id, period, value, dimension_key (e.g. `nationality=qatari;sex=female` or `total`), status (`provisional|final|revised`), source_document_id, entered_by, created_at. Unique on (indicator_id, period, dimension_key).
- `releases`: id, title_en, title_ar, release_date, indicator_ids_json, document_id, summary_en, summary_ar.
- `imports`: id, indicator_id, document_id, mapping_json, rows_imported, status, log, created_by.

### 7.6 Expert Network
- `experts`: id, user_id (nullable for externals), type (`npc_employee|government|academic|consultant|international`), name_en, name_ar, photo_path, organisation_en, organisation_ar, position_en, position_ar, bio_en, bio_ar, email, phone, contact_protocol, nationality, languages_json, years_experience, education_json, certifications_json, availability (`available|limited|unavailable`), clearance_level, owner_user_id, is_verified, visibility_classification.
- `expert_domains`: id, expert_id, term_id, level (`aware|practitioner|expert|authority`), source (`self|ai_suggested|endorsed`), accepted.
- `expert_skills`: id, expert_id, skill, level.
- `expert_engagements`: id, expert_id, title, year, role, department_id, outcome_en, outcome_ar, rating (1..5), linked_document_ids_json, linked_node_id.
- `expert_publications`: id, expert_id, title, year, url_or_document_id.
- `endorsements`: id, expert_id, endorsed_by, term_id, note.
- `expert_requests`: id, requester_id, expert_id, question_id (nullable), subject, detail, status (`open|accepted|answered|closed`), created_at.

### 7.7 Ask NPC (Q&A and communities)
- `questions`: id, author_id, title_en, title_ar, body_en, body_ar, lang_original, classification_level, department_id, status (`open|ai_answered|routed|answered|verified|closed`), ai_answer_id, verified_answer_id, view_count, follow_count, bounty_id, created_at.
- `answers`: id, question_id, author_id (nullable when AI), is_ai, body_en, body_ar, citations_json, confidence (`high|medium|low`), is_verified, verified_by, verified_at, helpful_count, created_at.
- `question_routes`: id, question_id, expert_id, reason, status (`notified|accepted|declined|answered`), created_at.
- `communities`: id, name_en, name_ar, description_en, description_ar, term_id, lead_user_id, cover_style.
- `community_members`: id, community_id, user_id, role (`lead|member`).
- `follows`: id, user_id, resource_type (`term|question|node|indicator|document|community|expert`), resource_id.
- `ai_conversations`: id, user_id, title, context_json; `ai_messages`: id, conversation_id, role, content, citations_json, confidence, retrieved_chunk_ids_json, model, tokens_in, tokens_out, created_at.

### 7.8 Lessons and decisions
- `lessons`: id, author_id, title_en, title_ar, context_en, context_ar, learning_en, learning_ar, recommendation_en, recommendation_ar, node_id, document_ids_json, tags via taggings, classification_level, status (`draft|published|verified`), reuse_count, cluster_id.
- `lesson_clusters`: id, label_en, label_ar, summary_en, summary_ar, lesson_ids_json, generated_at.
- `decisions`: id, title_en, title_ar, decision_en, decision_ar, rationale_en, rationale_ar, decided_on, owner_user_id, node_id, evidence_document_ids_json.

### 7.9 Foresight placeholder
- `signals`: id, title_en, title_ar, description_en, description_ar, source, impact (`low|medium|high`), horizon (`near|mid|long`), node_ids_json, document_id, created_by.
- `risks`: id, title_en, title_ar, likelihood (1..5), impact (1..5), owner_user_id, node_id, mitigation_en, mitigation_ar, status.
- `index_rankings`: id, index_name_en, index_name_ar, publisher, year, rank, score, total_countries, responsible_entity, source_url, note.

### 7.10 Gamification
- `game_events`: id, user_id, event_type, resource_type, resource_id, points, multiplier, created_at. (Append-only ledger; totals are derived.)
- `user_game_state`: user_id, total_points, level_id, daily_streak, weekly_streak, streak_freezes, last_active_date, last_contribution_week, breadth_json (domains touched with depth), quiz_streak.
- `levels`: id, order, name_en, name_ar, min_points, unlocks_json.
- `badges`: id, code, family (`builder|guardian|connector|explorer`), name_en, name_ar, description_en, description_ar, criteria_json, icon.
- `user_badges`: id, user_id, badge_id, awarded_at.
- `bounties`: id, title_en, title_ar, description_en, description_ar, source (`gap_radar|manual`), points, term_id, node_id, status (`open|claimed|fulfilled|closed`), posted_by, fulfilled_by, fulfilled_resource_type, fulfilled_resource_id.
- `game_rules`: id, event_type, points, multiplier_rules_json, is_active (editable in Settings).
- `daily_cards`: id, date, indicator_id, fact_en, fact_ar, hook_en, hook_ar, quiz_question_en, quiz_question_ar, options_json, correct_index, explanation_en, explanation_ar.
- `daily_card_answers`: id, user_id, card_id, chosen_index, is_correct, answered_at.
- `word_of_day`: id, date, kind (`quote|fact|tip`), text_en, text_ar, attribution_en, attribution_ar, source_ref.
- `spotlights`: id, user_id, resource_type, resource_id, blurb_en, blurb_ar, starts_on, ends_on, chosen_by.

### 7.11 System
- `jobs`: id, type, payload_json, status (`queued|running|done|failed`), attempts, error, run_after, created_at, finished_at.
- `notifications`: id, user_id, kind, title_en, title_ar, body_en, body_ar, link, read_at, created_at.
- `settings`: key, value_json (branding, ai model names, feature flags, gamification on/off, numerals default).
- `search_log`: id, user_id, query, lang, intent, result_count, clicked_resource_type, clicked_resource_id, created_at.
- `knowledge_gaps`: id, label_en, label_ar, example_queries_json, question_ids_json, term_id, status, bounty_id, detected_at.

---

## 8. Modules: screens, flows, and behaviour

Every module has: a route, a page composition, empty states, loading skeletons, RTL mirror, keyboard support, and audit logging. Every list supports search within, filters, sort, and pagination (cursor-based). Every detail page has a "Brief me" action and a "Save to collection" action.

### 8.1 M1 Home: My Knowledge Hub (`/home`)
The page people open every morning. A composed editorial layout, not a tile grid.

ASCII wireframe (LTR; mirrored in RTL):
```
+------------------------------------------------------------------------------+
| Good morning, Nada.            [ Search NEXUS ...................... ] [AR] [◎]|
| Tuesday 8 September 2026 · Word of the day strip: "…quote…" HE Dr Al Khalifa  |
+------------------------------------------------------+-----------------------+
| DID YOU KNOW QATAR? (hero card, 2/3 width)           | For you (1/3)         |
|  3,124,000                                           |  • New in Statistics   |
|  people were living in Qatar on 31 July 2026         |  • Answer waiting     |
|  Question: how many were Qatari women? [A][B][C]     |  • Unseen document    |
+------------------------------------------------------+-----------------------+
| What changed in NDS3 this week (3 compact rows with RAG dots and deltas)      |
+----------------------------------------------+-------------------------------+
| Latest lessons learned (3 LessonCards)       | Your knowledge footprint      |
|                                              |  (radial map, level ring,     |
|                                              |   streak, next unlock)        |
+----------------------------------------------+-------------------------------+
| Mystery shelf: one spine + hook line          | Contributor spotlight         |
+----------------------------------------------+-------------------------------+
| Newest on the shelves (a Shelf of the 12 most recent verified documents)      |
+------------------------------------------------------------------------------+
```
Behaviour:
- Greeting uses the user's first name and the correct Arabic form. Date in locale.
- Word of the day: rotates daily among a quote from HE the Secretary General or HE the Prime Minister (sourced from public speeches and forum remarks in `/sources`; store `source_ref`), an NDS3 fact, and a practical tip about using NEXUS. Seed at least 60 entries (20 of each).
- Did you know Qatar: generated nightly by the daily-card job from a random headline indicator; the quiz has three options; answering awards points, reveals the answer with a one-line explanation and a link to the indicator. Seed 30 cards so the first month works even if the job never runs.
- For you: three items maximum, computed from follows and department: newest release in followed indicators, a question routed to me or in my domains, one verified document I have never opened. No task lists.
- What changed in NDS3: from `status_updates` and `kpi_values` in the last 7 days, or the last 3 changes if the week is quiet.
- Latest lessons learned: three most recent published lessons, visible to everyone at their clearance.
- Knowledge footprint: a radial chart with seven outcome sectors and topic sub-arcs; depth coloured from sand to maroon by number of items read or contributed; the level ring and streak flame sit in the centre. Private by default.
- Mystery shelf: one random verified document not yet opened by this user, with an AI hook line. Opening it logs an Explorer event.
- Contributor spotlight: the current `spotlights` row; if none, the AI-suggested spotlight (most reused contribution in the last 30 days), labelled "Suggested".
- Entrance choreography: hero number counts up, spines slide in from the end side with 40ms stagger, footprint arcs draw in over 700ms. Once.

### 8.2 M2 Knowledge Vault (`/vault`)
Views: Shelves (default, grouped by knowledge type or by NDS3 outcome, toggle), Grid, List. Filters rail: knowledge type, outcome, sector, topic, department, year, language, classification, status, owner. Sort: newest, most reused, most viewed, review due.

Upload flow (`/vault/upload`, also a global drop target: dropping a file anywhere in the app opens this flow):
1. Drop files (multi). Each file shows a parsing progress bar (extract text, detect language, count pages, find tables).
2. The AI enrichment panel fills in live: title EN and AR, summary EN and AR (120 to 180 words), five key facts with page references, knowledge type, suggested outcome links, suggested sector and topic tags, suggested classification with a one-line reason, suggested owner (the uploader by default), suggested related documents (top 3 by similarity), duplicate warning if similarity to an existing document exceeds 0.92 (offer "add as new version").
3. The uploader confirms or edits in one screen, sets review date (default 12 months), chooses collection(s), and presses "Upload to Vault". Optimistic: the document appears on the shelf immediately with a "processing" shimmer while embeddings and the missing-language translation finish in the background.
4. Points and a toast: "Uploaded. 50 points when verified."

Document reader (`/vault/[id]`): three-column reading layout. Left (start): outline from headings and pages, key facts, tables found. Centre: the rendered document (PDF pages via `pdfjs-dist` canvas rendering; docx converted to HTML by mammoth; xlsx rendered as sheets with a table view). Right (end) sticky AI panel: summary, "Explain this term", "Extract the numbers on this page", "Draft a lesson from this", "Ask about this document" (scoped Ask), "Brief me". Top bar: title AR/EN toggle, classification chip, status, owner, verified mark, versions, download, save to collection, share link, edit metadata, mark for review. Related items graph at the bottom (documents, nodes, indicators, experts, questions).

Verification: owners, department heads, verifiers, and admins see "Verify" and "Needs changes". Verification flips status to verified, clears machine-translation flags if the reviewer checked both languages, awards Guardian points to the verifier and Builder points to the uploader.

Collections (`/vault/collections`): featured collections with custom "book cover" styles (six generated cover patterns in maroon, gulf, and gold; seeded collections: NDS3 Foundations, National Data Program, Census 2025, Statistical Releases 2026, Qatar in International Indices, Legacy Strategies: NDS1 and NDS2 documents and their results reports). A collection page is a shelf with a description and a curator.

### 8.3 Living Strategy (`/strategy`)
Edition toggle: a segmented control in the page header, "NDS3 2024 to 2030 (live)" | "NDS2 2018 to 2022" | "NDS1 2011 to 2016". NDS3 is the default. Archived editions render the same tree, graph, and node pages in read-only mode with a sand-coloured "Archive" banner, their own outcomes or sector structure, final reported results where available, and links to their source documents in the Vault. Every node page shows a "Lineage" strip: where this theme came from in the earlier edition and where it went in the later one (from `node_lineage`), with one-click jump across editions. The global search and Ask NPC cover all three editions; results and citations show the edition chip so nobody mistakes an NDS1 target for a current one. Edition is part of the URL (`/strategy?edition=nds2`) so views are shareable.
- Overview: the seven outcomes as seven large "outcome tiles" arranged in a gentle arc (not a grid), each with a RAG dot, progress ring (share of KPIs on track), one headline KPI tile, and counts of initiatives and projects. Below: the tree/graph toggle.
- Tree view: collapsible hierarchy with inline status, owner avatars, and KPI mini-bars.
- Graph view: force layout, outcomes as large nodes, initiatives and projects orbiting, hover shows details, click navigates. Draw-in on first load only.
- Node page (`/strategy/[id]`): header with type, code, title AR/EN, owner, status, dates, budget; description; KPI section with charts (actual vs target, dashed gold target line, RAG); status updates timeline (author, date, progress, risks, next steps, evidence documents); linked documents shelf; linked experts; linked lessons; dependencies; "What changed" (AI generated for the last period); "Brief me".
- Add or edit: node editor (permissions: Contributor for own department nodes, Admins for all), KPI editor, status update composer (rich text, progress slider, risk chips, attach evidence from the Vault), KPI value entry (period picker, value, source document).
- Seeding: the full NDS3 hierarchy from the PDF (Section 12), the NDS2 and NDS1 hierarchies from their public documents (Section 12.1 items 10 and 11; if the PDFs cannot be fetched or parsed, seed the high-level structure: NDS1 with its 14 sector outcome areas and NDS2 with its eight sector strategies and headline targets, marked `verified = false`), at least 25 lineage links across editions, plus at least 40 initiatives and 60 projects distributed across outcomes with realistic names derived from the NDS3 text and NPC public announcements, KPI baselines and targets from the document, and 12 months of plausible KPI values marked `status = provisional` and `note = "seeded illustrative value"`. Real values from statistics releases where available (population, CPI, GDP growth, trade) must be linked to the real indicators.

### 8.4 M4 Statistics and Indicators Hub (`/statistics`)
- Landing: headline strip of 8 IndicatorTiles (population, real GDP growth, non-hydrocarbon GDP share, CPI inflation, unemployment rate, trade balance, building permits, Qatari labour force participation), each with sparkline and one-line narration. Below: the indicator catalog by category (Population and Social, Economy, Labour, Prices, Trade, Environment, Education, Health, Government) with counts, and the release calendar (next 30 days).
- Indicator page (`/statistics/[id]`): definition, unit, frequency, source, methodology (AR/EN), latest value with delta, full time series chart with period selector and dimension breakdowns (nationality, sex, sector), data table with export CSV, "Explain this indicator" AI narration, linked NDS3 KPIs, linked documents (releases), revision history.
- Import flow (`/statistics/import`): upload xlsx/csv or pick a table detected in a Vault document; AI proposes the mapping (which column is period, value, dimension); preview with validation (duplicates, gaps, unit mismatch); confirm; values written with `status = provisional` until a verifier finalises.
- Manual entry: inline period plus value form on the indicator page for Contributors with statistics create permission.
- Releases (`/statistics/releases`): list of monthly and annual releases with the release document in the Vault and the indicators it updated.
- Seeding: at least 60 indicators with real definitions, and real time series where public sources provide them (monthly population from NPC releases; CPI; GDP; trade) for the last 24 to 36 months. Where real values cannot be fetched, seed illustrative values with `status = provisional` and a clear note. Never present illustrative values as official; the UI shows a small "illustrative" chip when `note` contains "illustrative".

### 8.5 M5 Expert Network (`/experts`)
- Directory: portrait cards, filters by type, domain, department, availability, worked with NPC, language. Search box supports natural language ("who knows census methodology") which runs expert matching (Section 11.4).
- Profile (`/experts/[id]`): header (photo, name AR/EN, type chip, organisation, position, availability, contact protocol, clearance), bio, domains with level bars and endorsement counts, skills, experience and education timeline, certifications, engagements with NPC (table: year, engagement, role, outcome, rating), publications, contributions in NEXUS (documents, answers, lessons; employees only), badges (employees only), "Request this expert" button, "Endorse" button.
- My profile (`/profile`): the employee's own profile with completion meter (this is the onboarding driver), AI-suggested domains to accept or dismiss, privacy toggles (show footprint, show badges), preferences (language, numerals, quiet mode).
- Add external expert: form with all fields; owner defaults to the creator; AI can pre-fill from a pasted CV text or an uploaded CV PDF.
- Request flow: choose subject and detail, optionally link a question; the expert's owner (external) or the expert (employee) is notified; status tracked; closure asks for a one-line outcome.
- Seeding: 40 employee profiles (from the seeded users) with domains, and 30 external profiles across academia (Qatar University, HBKU, Georgetown Qatar), international organisations (UN agencies, World Bank, IMF technical assistance), consultants, and other government entities, with realistic but clearly fictional names and engagements. Real public director names are used only for the four known directors and their roles; do not invent biographical details for real people beyond their public title.

### 8.6 M6 Ask NPC (`/ask`)
- Composer at the top (AskComposer). Language auto-detected. Optional context: a document, an outcome, an indicator, or a community.
- Flow: on submit, the AI answers immediately with streaming, citations, and a confidence meter. Under the answer: "Was this helpful", "Send to an expert" (pre-selected top three matches with reasons), "Post to community" (makes it a public question thread), "Save as note".
- If confidence is Low, the answer includes a clear line: "I could not find a reliable NPC source for this. Route to an expert?" and the route button is primary.
- Question thread page (`/ask/[id]`): question, AI answer (collapsed if a human answer exists), human answers, verified answer pinned, followers, related questions, the bounty if any. Experts see "Answer" with the AI assist panel (related sources, contradiction check). Verifiers see "Verify".
- Communities (`/ask/communities`): seeded communities: Statistical Methods, NDS3 Delivery, Data Governance, Foresight and Risk, Economic Planning, Social Development Planning. Each has members, a feed of questions and documents, and a lead.
- Unanswered board (`/ask/open`): open and routed questions, sortable by age and bounty points.
- My conversations (`/ask/history`): private AI conversations, resumable.

### 8.7 M7 Lessons Learned and Insight Cards (`/lessons`)
- Feed of LessonCards, filter by outcome, department, tag, status. Clusters view: AI-clustered themes (for example "Data sharing agreements take longer than planned") with the lessons inside.
- Capture (`/lessons/new`): the 60-second form: rough text box (or four fields), "Structure with AI" turns rough text into context, learning, recommendation, suggested links and tags; choose outcome and classification; publish. Decisions have a parallel simple form.
- Lesson page: content AR/EN, links, "reused in" list, verify action.
- Seeding: 40 lessons and 15 decisions grounded in real NPC programme themes (administrative census, data policy rollout, NDS3 stakeholder engagement, Q Insights adoption, open data revamp).

### 8.8 M8 Department Spaces (`/departments/[code]`) (Phase 1, build a functional minimal version now)
- Department page: description, head, members, department shelf (department-visibility collections), department KPIs (nodes owned), recent activity. Department heads manage members and collections.

### 8.9 M9 Foresight and Risk Radar (`/foresight`) (placeholder, high level only)
- A single well-designed page: a short explanation of the future module, three demonstration blocks with real seeded data: 10 signals as cards, a 5 by 5 risk heat map with 12 seeded risks, and an international index tracker table with 12 real indices (name, publisher, latest year, Qatar rank, total, trend arrow; use public values where confident, otherwise mark "to verify"). Add signal and add risk forms exist but keep them simple. Label the page "Preview" in the header. No dashboard ambitions here.

### 8.10 M10 Search (`/search?q=`)
- Global search from the top bar. As the user types (300ms debounce): instant suggestions grouped by type (documents, indicators, strategy nodes, experts, questions, lessons) using FTS; pressing Enter runs the full hybrid search.
- Results page: intent banner at the top ("Looks like you want a number" with the indicator tile; "Looks like you want a person" with expert cards; otherwise documents first). Tabs by type with counts. Each result shows why it matched (snippet with highlighted terms, or "semantic match" with the closest passage). "Answer this instead" button switches to Ask with the query prefilled. Zero results: log to `search_log`, show "No NPC source yet. Ask the network?" with a one-click post to the unanswered board.
- Cross-lingual: an Arabic query retrieves English chunks via embeddings and shows the snippet with an inline machine translation toggle.

### 8.11 M11 AI Layer
See Section 11.

### 8.12 M12 Engagement Engine
See Section 10.

### 8.13 M13 Settings, Governance, and Analytics (`/settings`)
Tabs: Users, Roles, Departments, Taxonomy, Classification, Review rules, Gamification rules, Daily cards and Word of the day, Spotlights, Bounties, AI settings (model names, mock mode toggle, temperature, max sources, allow secret in answers), Branding (logo upload, accent override within brand limits), Integrations (SharePoint, Email, Q Insights, Open Data: each shows "Not configured" and a form for later credentials), Audit log (filterable, exportable CSV), Analytics.
Analytics dashboard: active users (daily, weekly), contributions per week by type, verified ratio, median time to verify, stale content count, zero-result searches (top 20 queries), knowledge gaps, top reused items, expert requests turnaround, Ask volume and confidence distribution, gamification participation. Charts follow Section 5.4. A weekly written "KM health narrative" generated by the AI sits at the top (Phase 1: generate on demand with a button; nightly job later).

---

## 9. Bilingual and RTL rules
1. Routing: `/en/...` and `/ar/...`. Default locale from user preference, else browser, else Arabic.
2. Every user-facing string in `messages/en.json` and `messages/ar.json`. No hardcoded strings in components. Arabic strings written natively by you in correct Modern Standard Arabic with proper government register; review them for grammar.
3. Content fields: every bilingual content field shows the current locale's version; if only the other language exists and the machine translation is not ready, show the original with a small "Original language" chip and an inline "Translate now" action.
4. Machine-translated text carries a subtle chip "AI translation"; the chip disappears when a human edits or verifies that language.
5. Layout mirroring: use CSS logical properties only. Icons that imply direction (arrows, chevrons) flip in RTL. Charts keep left-to-right time axes in both locales (time direction is a data convention), but their labels, legends, and tooltips are localised.
6. Numerals: `Intl.NumberFormat` with `ar-QA` and `nu-arab` when the user prefers Eastern Arabic numerals; default Western in both locales. Dates: `Intl.DateTimeFormat` with Gregorian calendar; show Hijri as a secondary line on the home date only.
7. Fonts switch per locale via the `html[lang]` attribute; Arabic line-height and size adjustments from Section 5.3.
8. Search and AI accept mixed-language input; the intent classifier detects language per query.

---

## 10. Gamification: the Engagement Engine

### 10.1 Purpose
NPC employees should open NEXUS daily and keep the library full and trustworthy. The engine rewards three behaviours in order of value: contribute, verify, return. No leaderboards, no cross-person comparison, no HR linkage, no seasonal quests, no department missions, no celebration screens. Everything can be muted by the user (quiet mode) or globally in Settings.

### 10.2 Point rules (seed into `game_rules`, editable)
| Event | Points | Notes |
|---|---|---|
| document_uploaded | 20 | Awarded on upload |
| document_verified (uploader) | 30 | Bonus when a verifier approves it |
| document_version_added | 10 | |
| content_verified (verifier) | 30 | Verifying others' documents, answers, lessons, translations |
| ai_tag_confirmed | 3 | Confirming or correcting AI suggestions on any item (cap 30 per day) |
| translation_reviewed | 15 | Human review of a machine translation |
| question_asked | 5 | Cap 25 per day |
| answer_posted | 20 | |
| answer_verified (author) | 40 | |
| answer_marked_helpful (author) | 5 | Per distinct user, cap 25 per answer |
| lesson_published | 25 | |
| lesson_verified (author) | 20 | |
| decision_logged | 15 | |
| expert_profile_completed | 100 | One-off at 100 percent completion |
| expert_profile_domain_accepted | 5 | Accepting an AI-suggested domain |
| external_expert_added | 30 | Verified externals only |
| expert_request_answered | 25 | |
| kpi_value_entered | 10 | |
| status_update_posted | 15 | |
| indicator_import_completed | 40 | |
| daily_login | 5 | Once per day |
| daily_quiz_correct | 10 | 4 if wrong |
| mystery_shelf_opened | 5 | Once per day |
| document_read_fully | 3 | Scrolled to end, once per document, cap 20 per day |
| bounty_fulfilled | bounty.points | Set per bounty, default 80 |
Multipliers: 2x on any contribution that fills an open knowledge gap (tag or outcome with a gap record); 1.5x on the first contribution in a department that week. Points never expire. Points are never deducted except by admin correction.

### 10.3 Levels (personal, never compared)
| Level | Name EN | Name AR | Threshold | Unlocks |
|---|---|---|---|---|
| 1 | Explorer | مستكشف | 0 | Everything a Reader needs |
| 2 | Contributor | مساهم | 150 | Custom collections, Contributor badge |
| 3 | Curator | أمين معرفة | 600 | Featured collection proposal, spotlight eligibility |
| 4 | Knowledge Keeper | حافظ المعرفة | 1500 | Verification rights in own domains (requests Expert Verifier role automatically, admin approves) |
| 5 | NPC Sage | حكيم المجلس | 4000 | "Sage's pick" slot on Home, permanent gold ring |
Progress shows as the ring around the avatar and on the profile. Level-up produces a quiet toast and a notification, nothing more.

### 10.4 Streaks
- Daily streak: any meaningful action (not just login): read a document fully, answer, upload, quiz, verify. Shown as the flame on Home.
- Weekly streak: at least one contribution (upload, answer, lesson, verification, KPI value, status update) per ISO week. This is the streak that fills the library.
- Streak freezes: earn one per 5 contributions, hold up to 3; automatically consumed on a missed day or week.
- Both streaks visible only to the user.

### 10.5 Badges (four families, each with three tiers: bronze, silver, gold; icons drawn as simple SVG medals in gold and maroon)
Builder: 5 / 25 / 100 verified contributions.
Guardian: 10 / 50 / 200 verifications or freshness fixes.
Connector: 3 / 15 / 50 accepted expert routes or answered requests, or externals added.
Explorer: read documents across 3 / 5 / 7 national outcomes; 7 / 30 / 100 day quiz streak.
Plus single badges: First Shelf (first upload), Welcome (onboarding quest complete), Bilingual (reviewed 10 translations), Gap Closer (fulfilled 3 bounties).

### 10.6 Bounties
- Source 1, gap radar (Phase 1 automation; in the prototype, seed 10 open bounties generated from seeded knowledge gaps).
- Source 2, manual: Department Heads and Admins post a bounty with title, description, points, target tag or node.
- Claiming is optional; fulfilment is a link to the contribution (document, answer, lesson). A verifier marks it fulfilled. Points awarded on fulfilment with the gap multiplier.
- Bounty board lives at `/ask/open` (tab "Bounties") and the three highest-point open bounties appear on Home under "For you" when relevant to the user's domains.

### 10.7 Onboarding quest (first login)
A seven-step checklist shown as a single elegant card on Home until complete: complete your profile, upload one document, ask one question, follow three topics, confirm one AI tag, read one lesson, answer today's quiz. Completion awards the Welcome badge and Level 2 if points allow. The card disappears forever after completion.

### 10.8 Daily hooks
- Did you know Qatar (Home hero) with quiz.
- Mystery shelf.
- Knowledge footprint that visibly grows.
- Impact receipts: notifications like "Your answer on population methodology was cited in 4 briefs this month" generated by counting `reuse` relations weekly (Phase 1 job; seed a few notifications in the prototype).
- Contributor spotlight (never a ranking).

### 10.9 Engine implementation
`src/server/gamification/engine.ts` exposes `record(event)`; it is called by every mutation route. It reads active rules, applies caps and multipliers, appends to `game_events`, updates `user_game_state`, evaluates badge criteria, updates breadth, and emits notifications. Idempotency key per (user, event_type, resource_id) where the rule is one-off. Unit tests cover caps, multipliers, streak freeze consumption, and level thresholds.

---

## 11. AI Layer: Nexus Intelligence

### 11.1 Principles (enforced in code)
1. Grounded only: the answer prompt includes only retrieved NPC chunks and structured records. The system prompt forbids using outside knowledge for factual claims. Every factual sentence must end with citation markers `[n]` that map to retrieved chunks; a validator strips or flags sentences without citations and lowers confidence.
2. Permission-aware retrieval: filters on classification and department are applied in SQL before similarity scoring. Secret chunks are excluded unless the user has clearance 4 and the setting allows it.
3. Human verification visible: badges for AI summary, AI translation, AI-suggested tag, AI answer. Verified content is boosted in ranking (x1.3) over unverified.
4. Bilingual by construction: detect query language; answer in the user's UI language unless the user wrote in the other one, in which case answer in the query language; citations show source language.
5. Audited: every call logs user, model, prompt hash, retrieved chunk ids, tokens, latency, and the answer in `ai_messages` and `audit_log`.
6. Strict NPC sources only in this phase. No general-knowledge fallback. When nothing is found, say so and offer routing.

### 11.2 Pipeline
1. Parse: `src/server/ingest/parse.ts` picks a parser by mime; output is `{ text, pages[], tables[], metadata }`.
2. Language detect: simple script-ratio detector (Arabic Unicode range share) plus a Claude Haiku check on the first 500 characters when mixed.
3. Chunk: heading-aware, target 500 tokens with 80 overlap, keep page anchors, never split tables; tables become their own chunks with a markdown rendering.
4. Embed: batch of 64 chunks per call; provider from `src/server/ai/embeddings.ts` (Voyage or local e5). Store Float32 BLOB and model name. Query embeddings use the same provider; if the provider changes, re-embed via a job.
5. Index: FTS5 for keyword; `document_chunks.embedding` for vectors. Also embed structured records: indicators (definition and latest values as text), strategy nodes, experts (bio plus domains plus engagements), lessons, verified answers. Each has `resource_type` and `resource_id` in a unified `search_index` view.
6. Retrieve: hybrid. Run FTS (BM25 via FTS5 rank) and vector similarity in parallel (k=40 each), fuse with reciprocal rank fusion, apply verified boost and recency boost for statistics, rerank the top 20 with a Claude Haiku pairwise relevance prompt when a key exists, return top 8 to the generator with chunk text, page, document title, classification, and language.
7. Generate: Claude with a strict output schema (JSON: `answer_markdown`, `citations[]`, `confidence`, `suggested_experts[]`, `follow_ups[]`) streamed to the client via SSE; the client renders markdown progressively and attaches citation chips as they arrive.
8. Validate: citation check, language check (Arabic answers must not contain untranslated Latin sentences except proper nouns), length cap, secret leakage check (no chunk above the user's clearance is present).

### 11.3 Capabilities and where they live
| Capability | Trigger | Model | Notes |
|---|---|---|---|
| Ask Nexus | /ask, top bar "Answer this" | Sonnet | Streaming, citations, confidence, expert suggestions |
| Intent detection | every search | Haiku | Classes: number, person, document, definition, status, mixed |
| Smart upload enrichment | upload | Sonnet | Title, summary, key facts, tags, classification, owner, related |
| Translation with flag | upload, edit, on demand | Sonnet | Preserve numbers, names, and formatting; glossary of NPC terms enforced (Section 11.7) |
| Table and indicator extraction | upload, import | Sonnet | Column mapping proposal with confidence |
| Entity and relation extraction | upload (background) | Haiku | Links to nodes, indicators, experts by name matching plus embeddings |
| Duplicate detection | upload | none | Embedding similarity of document-level vector (mean of chunks) |
| Indicator narrator | indicator page, tiles | Sonnet | Trend, latest change, target comparison, caveats from methodology |
| What changed | node page, home | Sonnet | Summarises status updates and KPI deltas for a period |
| Brief me | every detail page | Opus (fallback Sonnet) | One-page leadership brief, AR and EN, exportable to .docx via `docx` npm package |
| Expertise inference | nightly job and on contribution | Haiku | Suggested domains stored with `source = ai_suggested`, private until accepted |
| Expert matching | expert search, Ask routing | Sonnet | Ranks experts with reasons from domains, engagements, contributions |
| Answer quality assist | answer composer | Sonnet | Related sources, contradiction flags against verified content |
| Daily digest | Home "For you" | Haiku | Three items with one-line reasons |
| Reading companion | document reader panel | Sonnet | Section summary, term explanation, number extraction, lesson draft |
| Quick capture assistant | lessons/new | Sonnet | Rough text to structured lesson |
| Lesson clustering | nightly job | Sonnet | Cluster labels and summaries |
| Daily card generation | nightly job | Sonnet | Fact, hook, quiz from a headline indicator |
| KM health narrative | settings analytics (on demand) | Sonnet | Weekly written assessment |
| Gap radar, freshness watch, taxonomy drift | Phase 1 | Haiku | Seed gap records now; implement clustering jobs behind a feature flag, default off |
| Signal scanner (foresight) | Phase 1 | Sonnet | Extracts signals from foresight documents; flag off |

### 11.4 Expert matching algorithm
Score = 0.45 x embedding similarity(question, expert text) + 0.25 x domain overlap with question tags + 0.15 x verified contribution count in those domains (log scaled) + 0.10 x availability + 0.05 x recency of engagement. Return top 3 with a one-line reason generated by Sonnet from the scored features (no hallucinated facts: reasons only cite stored fields).

### 11.5 Confidence
High: at least two verified sources agree and the citation validator passes 100 percent. Medium: one source, or unverified sources, or 80 to 99 percent citation coverage. Low: no source above a similarity threshold of 0.35 (cosine) or citation coverage under 80 percent. Low answers show the routing call to action as primary.

### 11.6 Prompts (write them as files in `src/server/ai/prompts/*.md`, loaded at runtime; keep them versioned and editable from Settings > AI in a later phase)
Minimum set: `system_ask.md`, `system_enrich.md`, `system_translate.md`, `system_table_map.md`, `system_narrate_indicator.md`, `system_what_changed.md`, `system_brief.md`, `system_expert_reason.md`, `system_lesson_structure.md`, `system_daily_card.md`, `system_intent.md`, `system_rerank.md`, `system_health.md`.
Every system prompt must include: the NPC context paragraph (Section 2.1), the strict grounding rule, the bilingual rule, the NPC glossary (11.7), the output JSON schema, and three short examples (one Arabic, one English, one mixed). Use prompt caching (`cache_control`) on the static part.

### 11.7 NPC glossary (enforce consistent terminology in both languages)
National Planning Council: المجلس الوطني للتخطيط. Qatar National Vision 2030: رؤية قطر الوطنية 2030. Third National Development Strategy (NDS3): استراتيجية التنمية الوطنية الثالثة. National outcome: النتيجة الوطنية. Target: المستهدف. Initiative: المبادرة. Project: المشروع. Key performance indicator: مؤشر الأداء الرئيسي. National Statistics Center: المركز الوطني للإحصاء. National Data Program: البرنامج الوطني للبيانات. National Data Policy: السياسة الوطنية للبيانات. National Data Standards: المعايير الوطنية للبيانات. Qatar Data Trust Index: مؤشر قطر لموثوقية البيانات. Q Insights: منصة كيو إنسايتس. Census 2025: تعداد 2025. Open Data Portal: بوابة البيانات المفتوحة. Secretary General: الأمين العام. Knowledge Vault: خزانة المعرفة. Ask NPC: اسأل المجلس. Lessons learned: الدروس المستفادة. Expert Network: شبكة الخبراء. Living Strategy: الاستراتيجية الحية. Brief me: أعدّ لي موجزاً.
Extend the glossary with the seven outcomes and the cluster names in both languages from the NDS3 Arabic and English PDFs.

### 11.8 Cost and latency controls
Prompt caching on all static prompt parts and on the NDS3 structure; Haiku for classification; response streaming; embedding batching; a per-user daily token budget in settings (default generous, enforced softly with a notice); a cache of enrichment results keyed by file hash so re-uploads are free.

### 11.9 AI Mock Mode
When `ANTHROPIC_API_KEY` is missing, or when Settings > AI > Mock mode is on, every AI function returns deterministic, well-formed results from `src/server/ai/mock.ts`: titles from filenames, extractive summaries (first meaningful paragraphs), key facts from sentences containing numbers, tags from keyword matching against the taxonomy, answers as extractive stitching of the top retrieved chunks with real citations, and translations marked "AI translation unavailable, showing original". The UI shows a small "AI mock mode" chip in the top bar. All screens must work fully in this mode; the seed uses mock mode results only where it cannot use pre-authored content. Embeddings in mock mode use the local e5 model, so search still works.

---

## 12. Seeding plan: real public NPC material

### 12.1 `scripts/fetch-sources.ts`
Download the following into `/sources` and write `/sources/manifest.json` (url, filename, sha256, fetched_at, status, notes). Retry twice on failure, then continue.
1. NDS3 English PDF: https://www.npc.qa/en/planning/nds3/Documents/QNDS3_EN.pdf
2. NDS3 Arabic PDF: try https://www.npc.qa/ar/planning/nds3/Documents/QNDS3_AR.pdf and the Arabic NDS3 page https://www.npc.qa/ar/planning/nds3/Pages/default.aspx for the link.
3. NPC About page (EN and AR): https://www.npc.qa/en/aboutus/pages/default.aspx
4. NPC NDS3 overview page: https://www.npc.qa/en/planning/nds3/Pages/default.aspx
5. NPC news items 2024 to 2026 from https://www.npc.qa/en/media/pages/news/ (crawl the listing, fetch up to 40 items in each language; save as HTML and extracted text). Include https://www.npc.qa/en/media/pages/news/27042025.aspx (Council Forum on NDS3 and the National Data Program).
6. GCO articles: https://www.gco.gov.qa/en/media-centre/top-news/the-general-secretariat-of-the-council-of-ministers-highlights-the-objectives-and-competencies-of-the-national-planning-council/ and https://www.gco.gov.qa/en/media-centre/top-news/national-planning-council-launches-national-data-and-statistics-strategy/ (and their `/ar/` versions).
7. Monthly population statistics page: https://www.npc.qa/en/statistics/pages/subjectdetails.aspx and any linked monthly figures PDFs or Excel files for 2024 to 2026 (crawl the statistics section for downloadable releases: population, CPI, foreign trade, GDP, labour force, building permits; cap 40 files).
8. Qatar Open Data Portal datasets via the Opendatasoft API: `https://www.data.gov.qa/api/explore/v2.1/catalog/datasets?limit=100` then export CSV for datasets whose titles match population, consumer price index, gross domestic product, foreign trade, labour force, building permits, education, health (cap 25 datasets, CSV export endpoint `/api/explore/v2.1/catalog/datasets/{id}/exports/csv`).
9. QNV 2030 document if reachable from npc.qa or gco.gov.qa (search the NPC site for "Qatar National Vision 2030 document").
10. NDS2 (Second National Development Strategy 2018 to 2022) PDF, English and Arabic: search npc.qa and the legacy psa.gov.qa domain for "NDS2" and "Second National Development Strategy"; also try the Government Communications Office and Hukoomi. Save whatever full document is found.
11. NDS1 (National Development Strategy 2011 to 2016) PDF, English and Arabic: same approach; the legacy General Secretariat for Development Planning and Ministry of Development Planning and Statistics documents are often mirrored on UN or World Bank sites, which are acceptable if the document is the official publication.
12. Any NDS3 Enablement Guidebook, National Data Policy, or National Data Standards documents linked from npc.qa pages found while crawling (save if found; do not fail if not).
Respect robots and rate limits (one request per 500ms). Save a `SOURCES.md` listing what was fetched and what was not.

### 12.2 `scripts/seed.ts` order
1. Reset database, run migrations.
2. Classification levels, taxonomy dimensions and terms (knowledge types: strategy, policy, guideline, study, report, statistical release, dataset, presentation, minutes, template, speech, circular; outcomes: the seven; sectors: economy, finance, labour, education, health, social protection, environment, energy, infrastructure, digital government, data and statistics, culture and sport, security and justice; topics: at least 60 across data governance, census, national accounts, prices, trade, foresight, M&E, institutional excellence; years 2008 to 2026).
3. Departments (Section 2.2), roles (Section 6.2), users (Section 12.5), expert profiles for users.
4. Strategy editions: seed NDS3, NDS2, NDS1 records. NDS3 hierarchy: parse the NDS3 PDF text; extract outcomes, targets, cluster strategies, and enablers with page references; validate against Section 2.4; seed initiatives and projects (Section 8.3). Then NDS2 and NDS1 hierarchies from their PDFs with page references, final results where the documents or later NPC reports state them, and `node_lineage` links (Section 7.4).
5. Indicators and values: parse fetched statistics files and open data CSVs; map into indicators; where a file cannot be parsed, seed the indicator definition and illustrative values as instructed.
6. Documents: every fetched file becomes a Vault document with real metadata, `is_seeded = true`, `source_ref = url`, verified by the Knowledge Admin seed user. Run the full ingest pipeline (parse, chunk, embed) so search and Ask work on real content. Pre-author summaries and key facts for the top 15 documents in both languages (write them yourself, well); let mock or real AI enrich the rest.
7. Collections (Section 8.2), communities, 30 questions with 20 human answers (10 verified) and AI answers generated through the pipeline, 40 lessons, 15 decisions, 10 signals, 12 risks, 12 index rankings, 10 bounties, 8 knowledge gaps, 60 word-of-day entries, 30 daily cards, 3 spotlights, 12 notifications per seeded active user, game events history producing a realistic spread of levels (a few Keepers, many Contributors, one Sage: the Knowledge Admin).
8. Relations: link documents to nodes and indicators by extraction; link experts to engagements; link lessons to nodes.
9. Write `data/seed-report.md` with counts per table and a list of items marked "to verify" or "illustrative".

### 12.3 Content quality rules
- All seeded Arabic text must be real, grammatical Modern Standard Arabic. Never leave English in an Arabic field or Arabic in an English field.
- Illustrative values and unverified extractions are always flagged in data and UI.
- Public officials appear only with their public titles and public statements. Fictional staff names must be clearly fictional but culturally appropriate Qatari and Arab names (for example Fatima Al-Kuwari, Khalid Al-Sulaiti, Noora Al-Mansoori, Jassim Al-Hitmi, Mariam Al-Ansari, Hamad Al-Mohannadi), plus a few non-Qatari professionals to reflect real staff composition.

### 12.4 Login accounts (print these in README)
| Email | Password | Role | Department |
|---|---|---|---|
| admin@npc.qa | Nexus!2026 | Super Admin | Office of the Secretary General |
| knowledge@npc.qa | Nexus!2026 | Knowledge Admin | Department of National Data Affairs |
| head.stats@npc.qa | Nexus!2026 | Department Head | Department of Statistical Systems |
| verifier@npc.qa | Nexus!2026 | Expert Verifier | Department of Statistical Operations |
| analyst@npc.qa | Nexus!2026 | Contributor | Department of Economic Planning |
| reader@npc.qa | Nexus!2026 | Reader | Department of Monitoring and Evaluation |
Plus 34 more Contributors and Readers with the same password. The first login of `analyst@npc.qa` must show the onboarding quest.

### 12.5 Seed users
40 users across the ten departments, Arabic and English names, avatars generated as initials on a maroon or gulf circle (no stock photos, no external image services). Four department heads use the real public director names with only their public titles; their profiles contain no invented biography.

---

## 13. API layer (integration ready)

### 13.1 Conventions
All mutations and reads go through `/api/v1/*` route handlers with Zod validation, session auth, and the `can()` check. Responses are JSON `{ data, error, meta }`. Server components may call server functions directly, but the same server functions back the API, so nothing is UI-only.

### 13.2 Endpoint groups
`/auth` (login, logout, me), `/users`, `/roles`, `/departments`, `/taxonomy`, `/documents` (list, get, create via multipart upload, update, versions, verify, download), `/collections`, `/strategy/nodes`, `/strategy/kpis`, `/strategy/updates`, `/indicators`, `/indicators/{id}/values`, `/indicators/import`, `/releases`, `/experts`, `/experts/{id}/engagements`, `/experts/requests`, `/questions`, `/answers`, `/routes`, `/communities`, `/follows`, `/lessons`, `/decisions`, `/foresight/signals`, `/foresight/risks`, `/foresight/rankings`, `/search`, `/ai/ask` (SSE), `/ai/enrich`, `/ai/translate`, `/ai/brief`, `/ai/narrate`, `/gamification/state`, `/gamification/events`, `/bounties`, `/daily-card`, `/notifications`, `/settings`, `/analytics`, `/audit`, `/jobs`.

### 13.3 API keys for later
Table `api_keys` (hashed) and a bearer auth path for service accounts, disabled by default, so SharePoint, email, and Q Insights connectors can be added without touching auth.

### 13.4 Webhooks (stub)
`/api/v1/webhooks/ingest` accepts a document payload from a future connector; currently protected and returns 501 with a clear message.

### 13.5 Export
Documents, indicators (CSV), briefs (.docx), and audit log (CSV) are exportable now.

### 13.6 Integration stubs
`src/server/integrations/{sharepoint,email,qinsights,opendata}.ts` each export `status()` returning "not configured" and typed method signatures with TODO comments describing the intended sync.

---

## 14. Build order (one shot, milestones with checks)

Do these in order. After each milestone: typecheck, lint, build, run the milestone check, take screenshots (EN and AR), update PROGRESS.md.

M0 Foundation (est. first 15 percent of effort)
- Scaffold Next.js 15 + TypeScript strict + Tailwind 4 + shadcn + next-intl + Drizzle + libsql. Design tokens, fonts, Logo, app shell, motion primitives, i18n plumbing with both message files, auth (login page with the animated knot), sessions, `can()`, audit logging, job queue and worker, storage module, seed of roles, departments, users, taxonomy. Check: login as admin works in both locales; shell renders RTL correctly; screenshots saved.

M1 Vault and Search
- Ingest pipeline, parsers, chunker, embeddings provider (Voyage or local), FTS, hybrid search, upload flow with enrichment (mock or real), reader with pdfjs, collections, verification, relations. Fetch sources and seed documents. Check: upload a PDF from `/sources`, see enrichment, search finds it in both languages, reader opens at cited page.

M2 Strategy and Statistics
- Strategy tree, graph, node pages, KPIs, status updates, edition toggle with NDS2 and NDS1 archives and lineage, seeding from the NDS1, NDS2, and NDS3 PDFs. Indicators, values, charts, import flow, releases, seeding from statistics files and open data. Check: seven outcomes visible with charts; population indicator shows a real series; import of a CSV works.

M3 Experts and Ask NPC
- Expert directory, profiles, my profile with completion, external add, requests, matching. Ask with streaming, citations, confidence, routing, threads, communities, unanswered board, history. Check: Arabic question returns cited answer from English documents; low-confidence path shows routing; expert answers and verifier verifies.

M4 Lessons, Foresight preview, Departments
- Lessons feed, capture with AI structuring, clusters, decisions. Foresight preview page. Department pages. Check: capture a lesson in under a minute; foresight page renders seeded data.

M5 Engagement Engine and Home
- Rules engine, events, levels, streaks, badges, bounties, onboarding quest, daily cards, word of the day, mystery shelf, spotlight, footprint, notifications. Home composition and choreography. Check: analyst first login shows quest; completing the quiz awards points and updates the ring; weekly streak logic tested.

M6 Settings, Governance, Analytics, Polish
- All settings tabs including the Roles page, AI settings and mock toggle, integrations stubs, audit log, analytics with charts, KM health narrative. Then a full design pass on every screen using the checklist in Section 5.6, performance pass (Lighthouse performance and accessibility above 90 on Home and Vault in Chromium), empty states, error states, 390px layouts. Check: smoke script passes; README complete; PROGRESS.md marks everything done or honestly lists gaps.

Time management: if you find yourself far into the build with the design still ordinary, stop adding features and fix the design. A smaller product that looks extraordinary beats a complete product that looks generic.

---

## 15. Acceptance: `scripts/smoke.ts`
Run against `npm run dev` on a fresh `npm run setup`. All must pass:
1. Login for all six named accounts in both locales; wrong password rejected; Reader cannot open a Confidential document (403) and never sees it in search results.
2. Home renders for analyst with quest, daily card, word of the day, lessons box, mystery shelf, footprint, and shelf; answering the quiz changes points.
3. Vault: list returns seeded documents; upload of `/sources` NDS3 PDF as a new version is detected as duplicate; enrichment returns all fields; reader loads page 10; verification changes status and awards points; download logged in audit.
4. Search: English query "population growth" returns the population indicator first; Arabic query "التضخم" returns the CPI indicator and related releases; a nonsense query yields the zero-result state and a `search_log` row.
5. Strategy: seven outcomes exist with at least one KPI each; the edition toggle switches to NDS2 and NDS1, which render read-only with the archive banner; at least 25 lineage links resolve in both directions; a status update posts and appears in "What changed"; graph view renders.
6. Statistics: CSV import of a two-column file creates values; indicator page chart renders; narration returns text (mock or real).
7. Experts: matching query returns three experts with reasons; request creates a notification; external expert created by analyst is owned by analyst.
8. Ask: question streams an answer with at least one citation on seeded content; low-confidence question offers routing; expert answer, verification, points.
9. Lessons: capture with AI structuring publishes; appears on Home.
10. Gamification: level thresholds, weekly streak, freeze consumption, caps verified by unit tests; quiet mode hides engine UI.
11. Settings: role created with custom permissions and assigned; user with that role respects it; audit export CSV downloads.
12. i18n: no missing translation keys (a test that compares `en.json` and `ar.json` key sets); no hardcoded English strings detected by a grep for common words inside `components/` JSX (allowlist for proper nouns).
13. Build: `next build` succeeds; typecheck and lint clean; Lighthouse accessibility above 90 on Home, Vault, Ask.

---

## 16. README requirements
1. What NEXUS is, in three sentences, EN and AR.
2. Prerequisites (Node 20 plus), and the two commands.
3. `.env.local` keys with what happens if they are absent (mock mode).
4. Seeded accounts table.
5. A screen-by-screen tour with the screenshots from `data/screenshots/`.
6. Architecture overview and the migration path to Supabase and Vercel.
7. Known limitations and the `data/seed-report.md` summary of items to verify.
8. How to re-seed, reset, and run smoke tests.

---

## 17. Final word to Claude Code
This product will be judged first by how it looks and feels, second by whether the AI answers are trustworthy, third by everything else. Build the schema and services quickly and cleanly, then spend most of your effort where the person will look: the Home page, the Vault shelves, the reader, the Ask experience, and the strategy overview. Make the motion feel like paper and light. Make Arabic feel native. Make every number tabular and every empty state an invitation. When you think a screen is done, look at the screenshot and ask whether it belongs on a screen in a Council meeting chaired by the Prime Minister. If the answer is not an immediate yes, keep going.
