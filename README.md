# SiaNexus · سيا نكسس

**EN** — SiaNexus is the living memory of the National Planning Council of Qatar. It holds every report, strategy, statistic, expert, lesson, signal, and answer NPC produces, makes all of it findable in one bilingual search, and reasons over it with a conversational analyst that cites its sources. It is a complete local prototype: real NDS3, NDS2, and QNV 2030 documents, 64 indicators, an expert network, a continuously scanned signal stream, an Add Knowledge intake that turns rough notes into structured items, and an engagement engine that rewards contribution and verification.

**AR** — سيا نكسس هو الذاكرة الحية للمجلس الوطني للتخطيط في دولة قطر. يجمع كل تقرير واستراتيجية وإحصاء وخبير ودرس وإشارة وإجابة ينتجها المجلس، ويجعلها قابلة للعثور عليها في بحث ثنائي اللغة واحد، ويحللها بمحلل حواري يستند إلى مصادره. وهو نموذج أولي محلي كامل: وثائق حقيقية للاستراتيجيات الوطنية ورؤية قطر 2030، و64 مؤشراً إحصائياً، وشبكة خبراء، وتدفق إشارات يُمسح باستمرار، ومدخل "أضف معرفة" يحول الملاحظات الخام إلى عناصر منظمة، ومحرك تحفيز يكافئ المساهمة والتوثيق.

> **Change request 01 applied**: SiaNexus branding with the official wordmark and the NPC lockup, **Trends and Signals** (a real scanning module replacing the Foresight preview), an **Ask NPC 2.0** conversational analyst with a rich answer workspace, an **Add Knowledge** universal intake, and the onboarding quest removed from Home in favour of an ask box.

---

## Run it

Prerequisites: **Node 20+** and npm. No Docker, no Python, no build tools.

```bash
npm run setup     # installs, fetches public NPC sources + fonts, migrates, seeds (~6 min)
npm run dev       # http://localhost:3000
```

Optional keys in `.env.local` (the app runs fully without them, in **AI Mock Mode**):

| Key | Effect when present | Effect when absent |
|---|---|---|
| `ANTHROPIC_API_KEY` | Live analyst answers, enrichment, translation, briefs, narration, knowledge structuring, and **web-search scanning** for Trends and Signals | Deterministic mock: extractive answers with real citations, keyword tagging, fixture-based scan results; an "AI mock mode" chip shows in the top bar |
| `VOYAGE_API_KEY` | `voyage-multilingual-2` embeddings (Arabic + English in one vector space) | Local hashed embedder; search still works, cross-lingual recall is weaker |
| `SESSION_SECRET` | Pins the session cookie secret | Auto-generated once into `data/session-secret.txt` |

**Web search note**: the scanner's primary source is Anthropic's server-side web search tool. If the tool is not enabled on the account, the scan logs it and continues with the RSS/Atom feed list (editable in Settings → Trends and Signals).

## Seeded accounts

All passwords: **`Nexus!2026`**

| Email | Role | Department |
|---|---|---|
| admin@npc.qa | Super Admin | Office of the Secretary General |
| knowledge@npc.qa | Knowledge Admin | National Data Affairs |
| head.stats@npc.qa | Department Head | Statistical Systems |
| verifier@npc.qa | Expert Verifier | Statistical Operations |
| analyst@npc.qa | Contributor | Economic Planning · has five seeded analyst conversations |
| reader@npc.qa | Reader | Monitoring and Evaluation |

Plus 34 more contributors and readers with the same password (see Settings → Users).

## Screen-by-screen tour

Screenshots live in `data/screenshots/` (EN and AR; CR01 screens under `data/screenshots/cr01/`).

- **Login** (`cr01/login-en.png`) — the SiaNexus wordmark, the Sadu-inspired brand panel, and the NPC lockup.
- **Home** (`cr01/home-en.png`, `cr01/home-ar.png`) — the morning page: greeting with Hijri date, word of the day, the **Ask SiaNexus box** with rotating example questions directly under it (submitting opens a streaming analyst conversation), the **Did you know Qatar?** hero with a one-tap quiz, the three-item **For you** rail (which may include a signal from outcomes you follow), **What changed in NDS3 this week**, the latest lessons, your private **knowledge footprint**, the mystery shelf, spotlight, and the newest verified documents as book spines.
- **Add Knowledge** (`cr01/add-en.png`) — the universal intake at `/add` (also the primary rail button): one paste area + one drop zone that accepts typed notes in any language, docx/pdf/pptx/xlsx files, photos of handwritten notes (read by vision), and links. **Structure with AI** returns a stack of editable bilingual items (lessons, signals, decisions, Vault documents, expert contacts) with tags, NDS3 links with reasons, and classification; publish all or one by one. Points: 15 per item, 5 per accepted NDS3 link, 20 event bonus, 25 more when verified.
- **Knowledge Vault** (`vault-en.png`, `vault-ar.png`) — documents as colour-coded **book spines on shelves**, grid and list views, nine filters. Upload with a live AI enrichment panel, duplicate detection, review dates, collections.
- **Document reader** (`/vault/[id]`) — three-column reading layout with the sticky Intelligence panel: extract numbers, explain terms, draft a lesson (hands off to Add Knowledge), and **Ask about this document**, which opens the same analyst workspace scoped to the document. **Brief me** exports to .docx.
- **Living Strategy** (`strategy-en.png`, `strategy-ar.png`) — the seven NDS3 outcomes as progress-ring tiles, the delivery tree with real targets from the NDS3 PDF, the force graph, node pages with KPIs vs gold targets, status updates, lineage across NDS1 → NDS2 → NDS3, and now a **Signals** section listing accepted signals linked to the node (last 90 days).
- **Statistics** (`statistics-en.png`) — eight headline tiles, the catalog, the release calendar; indicator pages with charts, AI narration, CSV export, linked KPIs, and their own **related signals** section.
- **Trends and Signals** (`cr01/trends-en.png`, `cr01/trends-ar.png`) — the scanning module at `/trends` (old `/foresight` links redirect): a filterable **signal stream** of bilingual cards (publisher, date, "why it matters for NDS3", linked outcome and indicator chips, impact/horizon/confidence) with a triage strip (Accept, Dismiss, Convert to a lesson, risk, or Vault document); a **radar by outcome** with 30-day sparklines; the **risk heat map** and **international index tracker**, each row showing its related-signal count. "Scan now" runs the scan briefs through Claude web search (primary) and the feed list (always on); every run is recorded with counts, tokens, and errors. Signal pages carry the source excerpt, comments, history, "Ask about this signal", and "Brief me". Manual intake: paste a link or text.
- **Ask NPC 2.0** (`cr01/ask-en.png`, `cr01/conversation-en.png`) — a conversational analyst, not a search box. It plans with a fast model, then works with real tools: hybrid knowledge search, strategy queries with aggregations ("how many targets"), indicator series with computed deltas and gaps, safe arithmetic, expert matching, lessons, signals, what-changed, and cross-edition comparison. Progress streams as thinking chips ("Searching the Vault", "Counting NDS3 targets"), then the prose answer streams with numbered citations, followed by a **rich workspace**: strategy cards, indicator tiles, documents, lessons and decisions, signals, people with "Ask them", context-aware follow-up chips, and a sources footer with edition and verification marks. Conversations persist at `/ask/c/[id]`, resume, share read-only with clearance re-filtering ("2 sources hidden by clearance"), export to .docx, pin to collections, and route to experts. Communities, the unanswered board, and bounties remain.
- **Search** (`search-en.png`) — hybrid keyword + semantic search, grouped suggestions (Ctrl+K), intent banners, cross-lingual retrieval.
- **Profile / Settings** (`settings-en.png`) — as before, plus **Settings → Trends and Signals**: the scan briefs editor, the feed list, schedule interval, web-search toggle, token budget, and the run history table.

## Architecture

- **Next.js 15** (App Router, TypeScript strict, React 19), **Tailwind CSS 4**, framer-motion, Recharts, next-intl (full RTL).
- **SQLite** at `data/nexus.db` via `@libsql/client` + Drizzle ORM. FTS5 for keyword search; embeddings as Float32 BLOBs with brute-force cosine.
- **AI layer** (`src/server/ai/`): Anthropic SDK, prompt files in `prompts/`, strict grounding, permission-aware retrieval, and a deterministic mock for every capability including the analyst loop (the tools are real; only the model is mocked).
- **Analyst** (`src/server/ai/analyst/`): a planner + tool loop (12 permission-filtered tools) + streamed answer with server-assembled workspace sections.
- **Scanner** (`src/server/scan/`): Claude web search per brief, rss-parser feeds, manual URL/PDF intake; URL/title/embedding deduplication; `scan_runs` bookkeeping; scheduled every N hours by the in-process worker.
- **Jobs**: in-process queue whose worker starts with the server via `instrumentation.ts` (ingest, embed, translate, daily card, scan).
- **Gamification** (`src/server/gamification/engine.ts`): append-only ledger with caps, multipliers, streaks, badges; CR01 adds the knowledge_* and signal_accepted rules.
- **Auth**: bcrypt + iron-session; a single server-side `can()` gate.

### Migration path (Supabase / Vercel later)

- Drizzle schema uses portable types; regenerate for Postgres by switching the dialect in `drizzle.config.ts`.
- Vector search is encapsulated in `src/server/search/vector.ts`; a pgvector implementation replaces that one file.
- Storage is `src/server/storage/index.ts`; swap for Supabase Storage.
- Auth lives in `src/server/auth/*`; swap the session provider without touching `can()`.
- External systems go through `src/server/integrations/*` typed stubs.

## Commands

```bash
npm run setup       # full idempotent setup (install, sources, fonts, migrate, seed)
npm run dev         # dev server + job worker (scans self-schedule)
npm run seed        # rebuild the database from /sources (drops and recreates)
npm run smoke       # end-to-end acceptance checks against a running server (includes the CR01 checks and the ten analyst reference cases in mock mode)
npm run test        # unit tests (gamification caps/multipliers/freezes, i18n parity)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
npm run screenshots # refresh data/screenshots (needs a running server)
npx tsx scripts/test-analyst-live.ts   # optional: the ten reference cases against the live model (spends tokens)
```

## Known limitations (honest list)

- `data/seed-report.md` lists every item marked **illustrative** or **to verify**. Seeded signals carry `publisher` but empty `url` where a real link could not be verified during the build.
- Live web-search scanning depends on the account having the Anthropic web search tool; without it the scanner logs the fallback and relies on feeds. Feed fetching tolerates this machine's TLS-intercepting proxy (relaxed verification for those requests only).
- This machine's Application Control policy blocks several native binaries; the repo ships WASM fallbacks and a resolver patch (`scripts/patch-native.mjs`, run by setup). Details in `DECISIONS.md`.
- Lighthouse accessibility was checked with axe-style manual passes and system Edge; the policy blocks Playwright's bundled Chromium.
- Settings implements the high-value tabs; review-rule editing, spotlight/daily-card curation, and branding upload are seeded as data but not yet editable UIs.
- The reader renders PDFs on canvas one page at a time; pptx/xlsx render as extracted views.
- Gap radar, freshness watch, and taxonomy drift remain feature-flagged off; the signal scanner shipped as the Trends and Signals module.

## Reset

```bash
npm run seed        # fresh database from /sources (keeps downloaded sources)
npm run fetch-sources  # re-crawl public NPC material into /sources
```
