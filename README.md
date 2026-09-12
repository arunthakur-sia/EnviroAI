# SiaNexus · سيا نكسس

**EN** - SiaNexus is the living memory of the National Planning Council of Qatar. It holds every report, strategy, statistic, expert, lesson, signal, and answer NPC produces, makes all of it findable in one bilingual search, and reasons over it with a conversational analyst that cites its sources. It is a complete local prototype: real NDS3, NDS2, and QNV 2030 documents, 64 indicators, an expert network, a continuously scanned signal stream, an Add Knowledge intake that turns rough notes into structured items, and an engagement engine that rewards contribution and verification.

**AR** - سيا نكسس هو الذاكرة الحية للمجلس الوطني للتخطيط في دولة قطر. يجمع كل تقرير واستراتيجية وإحصاء وخبير ودرس وإشارة وإجابة ينتجها المجلس، ويجعلها قابلة للعثور عليها في بحث ثنائي اللغة واحد، ويحللها بمحلل حواري يستند إلى مصادره. وهو نموذج أولي محلي كامل: وثائق حقيقية للاستراتيجيات الوطنية ورؤية قطر 2030، و64 مؤشراً إحصائياً، وشبكة خبراء، وتدفق إشارات يُمسح باستمرار، ومدخل "أضف معرفة" يحول الملاحظات الخام إلى عناصر منظمة، ومحرك تحفيز يكافئ المساهمة والتوثيق.

> **Change request 01 applied**: SiaNexus branding with the official wordmark and the NPC lockup, **Trends and Signals** (a real scanning module replacing the Foresight preview), an **Ask NPC 2.0** conversational analyst with a rich answer workspace, an **Add Knowledge** universal intake, and the onboarding quest removed from Home in favour of an ask box.

> **Change request 02 applied**: Home rebuilt around one focal point with an Apple-HIG design review trail (`docs/design-reviews/`), the Living Strategy restructured into an **Outcomes > Targets > Initiatives and Projects** column navigator with a radial map and **Deliverables** on delivery nodes, **lesson categories** with project linking, the **NPC Nexus Podcast (صوت المعرفة)** with a two-voice composer, ElevenLabs studio audio and a persistent mini-player, **Add Knowledge by voice**, a live **Refresh signals** flow, and designed **Word report extraction** from anywhere.

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
| `ELEVENLABS_API_KEY` | Studio podcast audio (`eleven_multilingual_v2`); the seed renders the first two episodes | Episodes play through the browser's speech synthesis ("Browser voice"), with "Regenerate with studio voice" appearing once a key exists |
| `ELEVENLABS_VOICE_MARIAM` / `ELEVENLABS_VOICE_HAMAD` | Pins the two host voices by ElevenLabs voice id | Two library voices (one female, one male) are picked once at first render, stored in Settings, and logged |
| `OPENAI_API_KEY` | Whisper-grade voice transcription for Add Knowledge Speak mode (`gpt-4o-transcribe`, fallback `whisper-1`); best Arabic and mixed-language results | Browser speech recognition (Chrome or Edge) transcribes live; the recording is still saved for later re-transcription |
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

Screenshots live in `data/screenshots/` (EN and AR; CR01 screens under `cr01/`, CR02 screens under `cr02/`). The Apple-HIG design reviews (before/after for Home, review-only reports for every other page) live in `docs/design-reviews/`.

- **Login** (`cr01/login-en.png`) - the SiaNexus wordmark, the Sadu-inspired brand panel, and the NPC lockup.
- **Home** (`cr02/home-en-1440.png`, `cr02/home-ar-1440.png`, plus 1280/1024/390 widths) - rebuilt in CR02 around one focal point: a quiet greeting, then the **Ask SiaNexus box** as the only large element above the fold (word of the day is one caption line under the example chips). The **Today** row holds exactly three equal cards: **Did you know Qatar?** with the one-tap quiz, **What changed in NDS3** as three RAG rows, and the **NPC Nexus Podcast** card with the latest episode and a play button that starts the mini-player. Then four **Lessons learned** cards with category chips and the Add Knowledge button, and **Explore** (eight newest spines) beside the redesigned **Your progress** panel: a maroon level ring with points and level inside, a thin gold weekly-streak ring, seven knowledge-footprint dots (hover names the outcome, click opens the profile), and one line with the next unlock and the daily streak flame. "For you" items now arrive as notifications behind the bell.
- **Add Knowledge** (`cr02/add-en.png`, `cr02/add-speak-en.png`) - the universal intake at `/add` with three modes: **Write**, **Upload**, and **Speak** (CR02). Speak records with a live waveform, pause/resume, a 15-minute cap and a language selector (Arabic, English, Mixed); the transcript appears live and editable (browser recognition by default, Whisper when `OPENAI_API_KEY` exists), the original audio is stored and attached to everything published, and the voice bonus adds 10 points once per submission. **Structure with AI** returns editable bilingual items with the suggested **lesson category** and, when opened from a project ("Add lesson"), the pre-filled node and Delivery category. The rail button is gone; Add Knowledge now lives on Home, the Lessons page, and project Lessons tabs. Points: 15 per item, 5 per accepted NDS3 link, 20 event bonus, 10 voice bonus, 25 more when verified.
- **Knowledge Vault** (`vault-en.png`, `vault-ar.png`) - documents as colour-coded **book spines on shelves**, grid and list views, nine filters. Upload with a live AI enrichment panel, duplicate detection, review dates, collections.
- **Document reader** (`/vault/[id]`) - three-column reading layout with the sticky Intelligence panel: extract numbers, explain terms, draft a lesson (hands off to Add Knowledge), and **Ask about this document**, which opens the same analyst workspace scoped to the document. **Brief me** exports to .docx.
- **Living Strategy** (`cr02/strategy-en.png`, `cr02/strategy-target-en.png`, `cr02/strategy-map-en.png`) - restructured in CR02 as **Outcomes > Targets > Initiatives and Projects**: a Finder-style three-pane column navigator (outcome cards with progress rings, target rows with status dots and latest-vs-target bars, initiatives and projects grouped with an "Outcome-level" group where no target exists), an always-visible clickable breadcrumb with the edition switch, URL paths like `/strategy/nds3/o3/o3-t1`, arrow-key navigation (mirrored in RTL, Enter opens the detail), a stacked one-pane mode under 1024px, and a **Map** toggle: a zoomable status-coloured radial layout (outcomes inner, targets middle, initiatives and projects outer). Sector strategies, clusters, and enablers remain as filters and attributes, not levels. Node detail pages are reorganised (header, status and KPIs, Deliverables | Lessons | Documents tabs, experts, signals, updates, lineage, Brief me) and initiative/project pages gained **Deliverables**: multi-file upload into the Vault with D-codes, milestones, acceptance status, versions, classification, download, and open-in-reader; Ask NPC cites them as "Deliverable D3 of Project PRJ-01a".
- **Statistics** (`statistics-en.png`) - eight headline tiles, the catalog, the release calendar; indicator pages with charts, AI narration, CSV export, linked KPIs, and their own **related signals** section.
- **Lessons Learned** (`cr02/lessons-en.png`, `cr02/lessons-byproject-en.png`) - four final categories as a segmented control with counts (**Delivery Lessons, External Learning, Expert Insights, Institutional Knowledge**), three browse modes (Feed, **By project** with expandable node groups, Themes), 240-character cards with Read more, Listen and Extract report in the header, and multi-node linking with the primary node on the card.
- **NPC Nexus Podcast / صوت المعرفة** (`cr02/podcast-en.png`, `cr02/podcast-episode-en.png`) - pick any knowledge (a project, outcome, topic, document, collection, lessons, or an Ask answer) and press **Listen**. A three-step composer (choose, options: AR/EN, 3 or 5 minutes, focus; review with per-line editing) writes a grounded two-voice script for **Dr. Mariam** (the expert, answers only from the content, with spoken attributions) and **Hamad** (the moderator). Audio renders through ElevenLabs (`eleven_multilingual_v2`, per-segment with 600ms breaks, stitched by a pure-JS MPEG concatenator) as a background job with live progress, or plays with two browser voices when no key exists. The library filters by outcome, focus, and language; episode pages highlight the line being spoken and list sources; a persistent 56px **mini-player** keeps playing across navigation (play/pause, scrub, 1x/1.25x/1.5x). Points: 30 to create, 5 per full listen (Explorer badge counts them). Six seeded episodes; the first two ship with studio audio.
- **Trends and Signals** (`cr02/trends-en.png`, `cr01/trends-ar.png`) - the scanning module at `/trends` (old `/foresight` links redirect): a filterable **signal stream** of bilingual cards (publisher, date, "why it matters for NDS3", linked outcome and indicator chips, impact/horizon/confidence) with a triage strip (Accept, Dismiss, Convert to a lesson, risk, or Vault document); a **radar by outcome** with 30-day sparklines; the **risk heat map** and **international index tracker**, each row showing its related-signal count. CR02 adds a primary **Refresh signals** button with an inline live progress card (briefs done of total, candidates, new, duplicates), the **Last refreshed** stamp, and a **Rescan** for the brief behind an active outcome filter. The scheduled scan continues every N hours; every run lands in `scan_runs`. Signal pages carry the source excerpt, comments, history, "Ask about this signal", and "Brief me". Manual intake: paste a link or text.
- **Extract report** (everywhere) - Trends, Lessons, the Vault and collections, outcome/target/initiative/project pages, any Ask answer, and any podcast episode carry an **Extract report** button: a side panel with the scope summary, refine controls, audience (Leadership runs Opus, Working runs Sonnet), language (**Arabic, English, or Both in one file**), and options; generation runs as a job with progress and the result downloads as a designed Word document (dark-maroon cover band with the NPC logo, updating TOC, maroon-ruled headings, numbered findings, banded tables, docx-native bar charts, sand pull quotes, classified footers with page numbers) or saves to the Vault as a searchable `report` document. 15 points, capped at 45 per day.
- **Ask NPC 2.0** (`cr01/ask-en.png`, `cr01/conversation-en.png`) - a conversational analyst, not a search box. It plans with a fast model, then works with real tools: hybrid knowledge search, strategy queries with aggregations ("how many targets"), indicator series with computed deltas and gaps, safe arithmetic, expert matching, lessons, signals, what-changed, and cross-edition comparison. Progress streams as thinking chips ("Searching the Vault", "Counting NDS3 targets"), then the prose answer streams with numbered citations, followed by a **rich workspace**: strategy cards, indicator tiles, documents, lessons and decisions, signals, people with "Ask them", context-aware follow-up chips, and a sources footer with edition and verification marks. Conversations persist at `/ask/c/[id]`, resume, share read-only with clearance re-filtering ("2 sources hidden by clearance"), export to .docx, pin to collections, and route to experts. Communities, the unanswered board, and bounties remain.
- **Search** (`search-en.png`) - hybrid keyword + semantic search, grouped suggestions (Ctrl+K), intent banners, cross-lingual retrieval.
- **Profile / Settings** (`settings-en.png`) - as before, plus **Settings → Trends and Signals**: the scan briefs editor, the feed list, schedule interval, web-search toggle, token budget, and the run history table.

## Architecture

- **Next.js 15** (App Router, TypeScript strict, React 19), **Tailwind CSS 4**, framer-motion, Recharts, next-intl (full RTL).
- **SQLite** at `data/nexus.db` via `@libsql/client` + Drizzle ORM. FTS5 for keyword search; embeddings as Float32 BLOBs with brute-force cosine.
- **AI layer** (`src/server/ai/`): Anthropic SDK, prompt files in `prompts/`, strict grounding, permission-aware retrieval, and a deterministic mock for every capability including the analyst loop (the tools are real; only the model is mocked).
- **Analyst** (`src/server/ai/analyst/`): a planner + tool loop (12 permission-filtered tools) + streamed answer with server-assembled workspace sections.
- **Scanner** (`src/server/scan/`): Claude web search per brief, rss-parser feeds, manual URL/PDF intake; URL/title/embedding deduplication; `scan_runs` bookkeeping with per-brief progress; scheduled every N hours by the in-process worker; single-brief rescans.
- **Podcast** (`src/server/ai/podcast/`): grounded two-voice script generation over the analyst tools (Opus for scopes over 10 items), ElevenLabs rendering with library-voice auto-pick, a minimal MPEG frame concatenator and duration parser, and a per-user daily studio cap.
- **Reports** (`src/server/reports/`): scope gathering, a grounded narrative writer (extractive mock with the same shape), and a `docx` layout engine in the NPC palette with full RTL and a Both-languages mode.
- **Jobs**: in-process queue whose worker starts with the server via `src/instrumentation.ts` (ingest, embed, translate, daily card, scan, podcast render, report generate).
- **Gamification** (`src/server/gamification/engine.ts`): append-only ledger with caps, multipliers, streaks, badges; CR01 adds the knowledge_* and signal_accepted rules; CR02 adds knowledge_by_voice 10, podcast_created 30, podcast_listened_full 5 (cap 20/day, once per episode), report_extracted 15 (cap 45/day).
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
npm run smoke       # end-to-end acceptance checks against a running server (CR01 + CR02 sections, 163 checks, mock mode)
npm run test        # unit tests (gamification caps/multipliers/freezes, i18n parity)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
npm run screenshots # refresh data/screenshots (needs a running server)
npx tsx scripts/screenshots-cr02.ts    # CR02 screens (home strategy lessons podcast add trends; pass names to limit)
node scripts/lighthouse-a11y.mjs       # Lighthouse accessibility via system Edge (Home, Strategy, Lessons, Podcast, Ask, Trends)
npx tsx scripts/test-analyst-live.ts   # optional: the ten reference cases against the live model (spends tokens)
```

## Known limitations (honest list)

- `data/seed-report.md` lists every item marked **illustrative** or **to verify**. Seeded signals carry `publisher` but empty `url` where a real link could not be verified during the build.
- Live web-search scanning depends on the account having the Anthropic web search tool; without it the scanner logs the fallback and relies on feeds. Feed fetching tolerates this machine's TLS-intercepting proxy (relaxed verification for those requests only).
- This machine's Application Control policy blocks several native binaries; the repo ships WASM fallbacks and a resolver patch (`scripts/patch-native.mjs`, run by setup). Details in `DECISIONS.md`.
- Lighthouse accessibility was checked with axe-style manual passes and system Edge; the policy blocks Playwright's bundled Chromium.
- Report charts render as docx-native shaded-bar tables: the CR's preferred `@resvg/resvg-js` is a native binary this machine's policy blocks, and the CR's tables-only fallback applies (DECISIONS.md).
- Podcast intro/outro tones are skipped (no pure-JS mp3 encoder for a generated WAV); the 600ms speaker pauses come from ElevenLabs break tags instead of a stitched silent chunk.
- Browser-voice playback and Speak-mode recognition depend on the browser (Chrome or Edge recommended); voices vary by machine.
- Settings implements the high-value tabs; review-rule editing, spotlight/daily-card curation, and branding upload are seeded as data but not yet editable UIs.
- The reader renders PDFs on canvas one page at a time; pptx/xlsx render as extracted views.
- Gap radar, freshness watch, and taxonomy drift remain feature-flagged off; the signal scanner shipped as the Trends and Signals module.

## Reset

```bash
npm run seed        # fresh database from /sources (keeps downloaded sources)
npm run fetch-sources  # re-crawl public NPC material into /sources
```
