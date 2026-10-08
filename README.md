# EnviroAI by Sia

EnviroAI is a knowledge, regulatory and data platform for the Saudi Arabia environment, water and agriculture sector. It is a white-label of Sia's institutional knowledge system, configured for a Programme Office that works with MEWA, NCEC, NCW, NCVC, MWAN, the Environment Fund and the wider Saudi Green Initiative ecosystem.

It holds the reports, strategies, statistics, regulations, experts, lessons and signals a programme produces, makes them findable in one bilingual (English and Arabic, full RTL) search, and reasons over them with a conversational analyst that cites its sources.

This is a demo tenant. Seeded content is generic and marked **Illustrative** wherever a real figure or link could not be verified. Public institutions appear as external entities; staff and demo users are fictional.

## Modules

| Area | Modules |
|---|---|
| Home | Scorecard, Knowledge of the Week, daily challenge, Ask EnviroAI |
| Strategy Hub | Programme Strategy, the National Environment Strategy (NES) and its themes, Saudi Vision 2030 alignment |
| Data and Insights | Statistics (indicators, SDG performance, water security, agriculture and food security, climate and environment), International Indices, Trends and Signals, Regulatory Overview, Source Library |
| Knowledge Hub | Institutional Memory, Processes, Studies, Lessons Learned, EnviroAI Briefing Cast, Reports |
| People and Organisation | Experts, Organisation, Operating Model, HR Knowledge, Leaderboard |
| Everywhere | Ask EnviroAI (Ctrl+K), Add Knowledge (write, upload, speak), Search, Inbox, Handover, Settings |

Regulatory Overview (`/regulatory`) and Source Library (`/sources`) are the two modules added for the Saudi environment tenant. The Source Library is built from the KSA Environmental Data Source Databank (`KSA_Environmental_Data_Source_Databank.xlsx`), a list of public data sources, not a copy of their data.

## Run it

Prerequisites: Node 22 and npm. No Docker, no Python.

```bash
npm run setup      # installs, fetches fonts, migrates, seeds
npm run dev        # http://localhost:3000
```

On Windows machines whose policy blocks unsigned native binaries, run `npm run setup:win` after any `npm install`. It installs two WebAssembly shims with `--no-save`. On Linux and macOS it does nothing.

Seeding embeds the source documents, computes index forecasts and renders example reports, so it can take tens of minutes. To show the product, serve a production build over frozen data:

```bash
npm run start:demo            # builds if needed, then serves with the job worker
npm run reset-demo            # server stopped: restores the frozen demo data
npm run reset-demo:snapshot   # freeze the current state as that baseline
```

### Optional keys

Copy `.env.example` to `.env.local`. Every key is optional. Without them the app runs in **AI Mock Mode**: extractive answers with real citations, keyword tagging and fixture-based scan results, flagged by a chip in the interface.

| Key | Effect when present |
|---|---|
| `ANTHROPIC_API_KEY` | Live analyst answers, enrichment, translation, briefs, narration, web-search scanning |
| `VOYAGE_API_KEY` | `voyage-multilingual-2` embeddings (Arabic and English in one vector space); otherwise a local hashed embedder |
| `ELEVENLABS_API_KEY` | Studio audio for the Briefing Cast; otherwise browser speech synthesis |
| `OPENAI_API_KEY` | Whisper-grade transcription for Add Knowledge Speak mode; otherwise browser recognition |
| `SESSION_SECRET` | Pins the session cookie secret; otherwise generated into `data/session-secret.txt` |

### Seeded accounts

Demo accounts use the `enviroai.demo` domain (the allowed sign-up domain is configurable in Settings). Super Admin, Knowledge Admin, Department Head, Expert Verifier, Contributor, Reader and HR Admin accounts are seeded; the full list is in Settings > Users. The shared demo password is in `scripts/seed.ts`. Change it before any shared deployment.

## Brand and design tokens

Defined in `src/styles/globals.css`.

| Token | Use |
|---|---|
| `navy-*` | Brand primary: top bar, headings, primary buttons |
| `teal-*` | Secondary: data, links, positive states |
| `aqua-*` | Sia Teal accent (#00DECC): focus rings, highlights, the ascent line |
| `mist-*` | Cool neutral grounds |
| `ink-*` | Text |
| `cloth-*` | Institutional Memory book covers (navy, ink, teal, deep, indigo, steel, slate, mist) |

- Typeface: **Sora** (self-hosted, `public/fonts/sora-var-latin.woff2`). Arabic uses IBM Plex Sans Arabic with Noto Kufi Arabic for display.
- Logos: `public/brand/Sia_logo*.{svg,png}`. Use the full-colour logo on light grounds and the white logo on navy. Do not recolour, stretch or crop it, and keep clear space equal to the height of the "S".
- Colour keys stored in the database (`avatar_color`, `colour_token`, `cover_style`) are `navy`, `teal` and `aqua`. Legacy values are mapped at read time by `src/lib/colour-keys.ts`.
- Contrast: `node scripts/contrast-audit.mjs` checks token pairs against WCAG AA.

## Architecture

- **Next.js 15** (App Router, TypeScript strict, React 19), **Tailwind CSS 4**, framer-motion, Recharts, next-intl with full RTL.
- **SQLite** at `data/nexus.db` through `@libsql/client` and Drizzle ORM. FTS5 for keyword search, Float32 embeddings with brute-force cosine.
- **AI layer** (`src/server/ai/`): Anthropic SDK, prompt files in `prompts/`, strict grounding, permission-aware retrieval, and a deterministic mock for every capability.
- **Analyst** (`src/server/ai/analyst/`): planner, permission-filtered tool loop, streamed answer with server-assembled workspace sections.
- **Scanner** (`src/server/scan/`): web search per brief, RSS and Atom feeds, manual URL and PDF intake, deduplication.
- **Reports** (`src/server/reports/`): scope gathering, grounded narrative, a `docx` layout engine with RTL and a Both-languages mode.
- **Indices** (`src/server/indices/`): forecast engine, compute layer and fetcher, with the Kingdom as the home entity.
- **Jobs**: in-process queue started by `src/instrumentation.ts`.
- **Auth**: bcrypt and iron-session, one server-side `can()` gate with per-user overrides and portal visibility, invite-only on allowed domains.

Portability: the Drizzle schema uses portable types (switch the dialect in `drizzle.config.ts` for Postgres), vector search sits in `src/server/search/vector.ts`, storage in `src/server/storage/index.ts`, and auth in `src/server/auth/*`.

## Deploy on Railway

One service, one volume mounted at `/app/data`. `DATA_DIR` points at the volume; locally it is unset and everything lives in `./data`. Detailed runbooks: `ENVIROAI_RAILWAY_READINESS.md` and `ENVIROAI_RAILWAY_NO_CLI.md`.

1. Create the service from this repository and add a volume at `/app/data`.
2. `npm run railway:variables` writes `railway-variables.txt` (fresh `SESSION_SECRET`, your API keys, `DATA_DIR=/app/data`, `TZ=Asia/Riyadh`, a `SETUP_TOKEN`). Paste it into the service variables, then delete the file.
3. Deploy. `railway.json` builds with `npm run build` and starts `npm run start:railway`, which runs `scripts/boot.mjs` (folders, bundle restore, migrations, SQLite pragmas). `/api/health` is the health check.
4. `npm run data:export` writes the data bundle. Open `/setup/restore` on the deployment, enter `SETUP_TOKEN` and upload it.
5. Delete `SETUP_TOKEN` and redeploy. The restore page stops existing.

## Commands

```bash
npm run dev | build | start | typecheck | lint | test
npm run migrate        # apply migrations
npm run seed           # rebuild the database from seed content
npm run fetch-fonts    # fetch fonts
npm run fetch-indices  # refresh international index data
npm run smoke          # acceptance checks against a running server
npm run data:export    # bundle the data directory
npm run qc:sweep       # no em dashes, no HTML tables in new UI
npm run qc:permissions # every route as every role
npm run analyze        # bundle treemaps
```

## Known limitations

- Live web-search scanning needs the Anthropic web search tool on the account; otherwise the scanner falls back to feeds.
- Browser voice playback and Speak-mode recognition depend on the browser (Chrome or Edge recommended).
- No mail server exists locally: invitation links are shown to the admin and logged.
- Items marked **Illustrative** are placeholders for content the client supplies. Never present them as sourced fact.
