# CR08 build brief (shared by every implementation agent)

You are one of several agents building SIANEXUS_CHANGE_REQUEST_08.md in parallel inside `C:\npckms`
(SiaNexus, the bilingual knowledge management prototype of Qatar's National Planning Council).
Read this whole file before touching code. Read `C:\npckms\SIANEXUS_CHANGE_REQUEST_08.md` for the
section you own. Read `DECISIONS.md` items 60 to 80 and the last CR07 entry in `PROGRESS.md` for the
design language and conventions that are already in force.

## The machine (hard constraints, no workarounds needed, just follow them)

- Windows 11, PowerShell 5.1 in constrained mode: NO `&&`, no `.NET` method calls such as
  `[Math]::Max` or `.Substring()`, no inline `node -e` with complex quoting. Write any probe as a
  file under `scripts/dev-probes/` and run it with `node` or `npx tsx`. `Select-Object -First N`
  kills the upstream native process (use `-Last`, or `Out-File` then read). `Set-Content -Encoding
  utf8` writes a BOM that `JSON.parse` rejects: write JSON with the Write tool.
- Application Control blocks unsigned native binaries: Playwright's bundled Chromium (use
  `chromium.launch({ channel: "msedge" })`), `@resvg/resvg-js`, `sharp`, `canvas`, LibreOffice
  (absent). SVG to PNG rasterisation therefore goes through Playwright in system Edge (a page that
  renders the SVG and `page.screenshot`s it) or is skipped with a note.
- `npm install` needs `--force` and then `node scripts/patch-native.mjs`. Do NOT install packages
  unless your task says so; everything needed is already installed (`docx`, `d3-zoom`,
  `d3-hierarchy`, `d3-selection`, `d3-shape`, `framer-motion`, `recharts`, `radix`, `zod`,
  `lucide-react`, `next-intl` v4, `server-only`, `playwright`).
- File DELETION in the repo is blocked by a session hook. To retire a file, overwrite it with
  `export {};` and a one-line comment saying why.
- In a `.ts` script run by `tsx`, `page.evaluate(fn)` throws `__name is not defined`: pass the page
  function as a STRING.
- A corporate TLS proxy re-signs public sites. Relax `NODE_TLS_REJECT_UNAUTHORIZED` ONLY inside a
  one-shot public data fetch script, never in app code and never for Anthropic, Voyage or ElevenLabs.
- `.env.local` holds quote-wrapped keys. Never print key material; boolean presence checks only.
- The seeded password is `Nexus!2026` for every seeded account (`admin@npc.qa` Super Admin,
  `knowledge@npc.qa` Knowledge Admin, `hr@npc.qa` HR Admin, `head.stats@npc.qa` Department Head,
  `verifier@npc.qa` Expert Verifier, `analyst@npc.qa` Contributor, `reader@npc.qa` Reader).
- Never send `temperature` to the Anthropic API.
- The Anthropic key IS present but Mock Mode must work for every AI function you add: check
  `aiLive()` from `src/server/ai/client.ts`, call the model with `callJson(promptName, content)`
  or `streamPrompt`, and fall back to a deterministic mock function (put mocks next to the feature
  or in `src/server/ai/mock.ts` style). Prompts live in `src/server/ai/prompts/<name>.md` and are
  loaded with `loadPrompt(name)` (shared `_shared.md` is prepended automatically by `callJson`).

## The shared dev server and what you may run

- ONE dev server is already running at `http://localhost:3000` (`next dev`, hot reload). Use it
  for manual checks, Playwright probes and screenshots. Do NOT start another server, do NOT run
  `next build`, do NOT kill anything on port 3000, do NOT run `npm run seed` or `scripts/seed.ts`.
- Your seed lives in `scripts/cr08-<module>-seed.ts` (a stub exists with a default export). Make it
  idempotent and run it standalone with `npx tsx scripts/cr08-<module>-seed.ts` while the server
  runs (ordinary writes are fine; SQLite WAL).
- Migrations are DONE: every CR08 table and column is in `src/server/db/migrations/0007_cr08.sql`
  and in `src/server/db/schema.ts` (Drizzle). If you truly need another column, add it to BOTH
  the migration (as an additive `ALTER TABLE ... ADD COLUMN`, with a `--> statement-breakpoint`
  separator) and the schema, then run `npx tsx scripts/migrate.ts`. Mention it in your report.
- Typecheck with `npx tsc --noEmit 2>&1 | Select-String "error TS"` (takes ~2 minutes; other
  agents' in-progress files may show errors: only fix errors in files you own). Lint your own
  files with `npx eslint <paths>`.
- Other agents are editing other files at the same time. Only touch the files your task lists as
  yours plus files you create under your own directories. If you believe you must edit a shared
  file (AppShell, Home page, seed.ts, schema.ts, tools.ts, worker.ts, en.json/ar.json, an existing
  page owned by someone else), do not: describe the exact change you need in your final report and
  the coordinator applies it.

## Internationalisation

- Never edit `messages/en.json` or `messages/ar.json` directly. Put your keys in
  `messages/cr08-<module>.en.json` and `messages/cr08-<module>.ar.json` under ONE top-level
  namespace you own (for example `"reports": {...}`), then run
  `node scripts/dev-probes/i18n-merge.mjs cr08` which deep-merges every `cr08-*` fragment into the
  two real files and checks key parity. Re-run it after every change to your fragment. It is
  idempotent and safe to run concurrently.
- Existing top-level namespaces you may READ from (`useTranslations("common")`, `"shell"`):
  shell, login, common, vault, upload, reader, search, collections, brief, statistics, import,
  strategy, experts, profile, askPage, addKnowledge, analyst, settings, home, reports, podcast,
  lessons, trends, foresight, departments, ask, indices, hr, invite, organisation, council. If you
  add keys inside an EXISTING namespace (e.g. `experts.internal`), that is fine through your
  fragment; never remove or rename existing keys.
- Every user-visible string is translated: native, formal Modern Standard Arabic with a Qatari
  government register, never a literal translation. ICU plurals for counts (Arabic has zero, one,
  two, few, many, other). Use `bi(locale, en, ar)` from `@/lib/utils` for bilingual data fields.
- Full RTL: logical properties only (`ps-`, `pe-`, `ms-`, `me-`, `start`, `end`, `border-s`),
  never `left`/`right`/`ml-`/`mr-`. Use `mx-` (not `ms-/me-`) on any element that carries
  `dir="auto"`. SVG that must not mirror gets `style={{ direction: "ltr" }}` on its wrapper; icons
  that point somewhere use the `flip-rtl` class. Numbers: `formatNumber`/`formatDate` from
  `@/lib/format` honour the user's numeral preference.

## Design rules (CR03 to CR07 are in force; your screens must match the Strategy Canvas, the
## Learning Room and the Council Strategy in quality)

- Tokens only, from `src/styles/globals.css` `@theme`: `maroon-{50,100,300,500,700,900}`,
  `sand-{50,100,200,300}`, `ink-{200,400,600,900}`, `gulf-{100,400,600}`, `gold-{100,300,500}`,
  `ok`/`warn`/`danger`/`info` with `-light` tints, `bar`/`bar-ink`/`bar-muted`/`bar-field` for the
  maroon top bar. Never a raw hex in components. Display serif is Fraunces (`font-display`), body
  Inter, Arabic IBM Plex Sans Arabic (automatic per `dir`), Noto Kufi for Arabic display.
- Cards use the `.card` class (white, `radius-card`, `shadow-paper`, hover lift). Eyebrow labels
  are `text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400` (Arabic: no
  letter-spacing). Section headings: `<h2 className="font-display ...">`.
- Primitives: `Button`, `Input`, `Textarea`, `Label`, `NativeSelect`, `Chip`, `ClassificationChip`,
  `Avatar`, `Skeleton`, `EmptyState`, `SectionTitle`, `ProgressRing`, `RagDot` from
  `@/components/ui/primitives`; `Dialog*`, `Dropdown*`, `Tabs*`, `Tip`, `Switch` from
  `@/components/ui/overlays`; `useToast` from `@/components/ui/toast`; `Reveal`, `Stagger`,
  `CountUp` from `@/components/motion`. `Link`, `useRouter`, `usePathname` from
  `@/i18n/navigation` (locale-aware). `cn()` from `@/lib/utils`.
- Motion: framer-motion, 200 to 300ms, `useReducedMotion()` guard on every animation, no bounce.
- NO HTML `<table>` in new UI: matrices and lists are CSS grid with ARIA roles (`role="table"`,
  `role="row"`, `role="columnheader"`, `role="cell"`).
- NO em dashes or en dashes anywhere you write (code, comments, strings, docs, Arabic text).
  Use commas, colons or separate sentences. `node scripts/dev-probes/emdash-sweep.mjs` checks git
  changed files.
- Every list has loading (Skeleton), empty (EmptyState with a designed line) and error states.
  Hover states, focus rings (`focus-visible:outline-2 focus-visible:outline-gold-500`), keyboard
  reachability, `cursor-pointer` on clickable non-buttons, `aria-label` on icon buttons,
  `data-testid` on the elements a smoke test would need.
- Pages: server component `page.tsx` with `export const dynamic = "force-dynamic"`, loads data
  through a service in `src/server/services/*.ts` (never raw SQL in components), passes plain
  props to a client component. Portal directories carry `layout.tsx` calling
  `requirePortal("<portal key>")` from `@/server/auth/portal`.
- Contrast AA on every pair (`node scripts/contrast-audit.mjs` checks the token pairs).
- Illustrative seeded content shows an "Illustrative" chip (`Chip tone="sand"`) like the Council
  Strategy does.

## Server conventions

- Database: `import { db, schema } from "@/server/db/client"`, Drizzle over SQLite (`@libsql`).
  Ids: `newId()` (ulid) and `nowIso()` from `@/lib/ids`. JSON columns are text; parse with
  `parseJson(zodSchema, raw, fallback)` from `@/server/db/json` or a guarded `JSON.parse`.
- Auth: `getCurrentUser()` from `@/server/auth/session` (returns `CurrentUser` with `role`,
  `department`, `clearanceLevel`, `departmentScope`, `overrides`); permissions with
  `can(user, action, module, resource?)`, `hasPermission`, `canSeePortal`, `canSeeDocument`,
  `visiblePortals` from `@/server/auth/permissions`. Modules: vault, strategy, statistics, experts,
  ask, lessons, foresight, settings, analytics, gamification, council, organisation, reports,
  messaging, processes, operating_model. Actions: read, create, edit_own, edit_any, verify,
  delete, manage. "Super Admin" = `can(user, "manage", "settings")`. Role names: Super Admin,
  Knowledge Admin, HR Admin, Department Head, Expert Verifier, Contributor, Reader.
  Portal keys (`PORTALS` in `src/server/db/json.ts`): home, council, strategy, statistics,
  indices, trends, vault, processes, studies, lessons, podcast, reports, experts, organisation,
  operating_model, hr, leaderboard, ask, handover, inbox, settings.
- API routes: `src/app/api/v1/<area>/route.ts`, Next 15 `NextRequest`/`NextResponse`, always
  `{ data, error }` JSON envelopes, 401 for no user, 403 forbidden, 404 not found, zod-validated
  bodies, `audit(user.id, action, resourceType, resourceId)` from `@/server/auth/audit` on
  mutations. Route params are `Promise<{ id: string }>` (await them).
- Notifications: `notify(userId, kind, titleEn, titleAr, link?, { en, ar })` from
  `@/server/gamification/engine`. Points: `record({ userId, type, resourceType, resourceId,
  meta })` from the same file; rule types live in `game_rules` (add new ones in your seed with
  `db.insert(schema.gameRules)` if missing).
- Jobs: `enqueue(type, payload, { runAfter? })` from `@/server/jobs/queue`. The job types you may
  need are already declared and dispatched in `src/server/jobs/worker.ts` to these stub files
  which you FILL (do not rename the exports): `report_build` -> `src/server/reports/build.ts`
  `runReportBuild(reportId)` and `runSectionRebuild(reportId, sectionCode)`;
  `leaderboard_refresh` -> `src/server/services/leaderboard.ts` `refreshLeaderboards()`;
  `kow_rollover` -> `src/server/services/knowledge-of-week.ts` `rolloverKnowledgeOfWeek()`;
  `handover_nightly` -> `src/server/services/handover.ts` `runHandoverNightly()`.
- Ask NPC tools: each module fills its own file under `src/server/ai/analyst/cr08/<module>.ts`
  (a stub with `definitions`, `portal`, `run` exists; see `cr08/types.ts`). Look at
  `src/server/ai/analyst/tools-cr07.ts` for how a tool reads data, respects `ctx.user`
  permissions, registers sources in `ctx.state` for citations and returns compact text. Add a
  short paragraph about your tools to `src/server/ai/prompts/system_analyst.md` ONLY through your
  final report (the coordinator edits that file).
- The Ask NPC context marker: any item page you build or own should render
  `<AskContextItem item={{ kind, id, code, titleEn, titleAr, href }} />` from
  `@/components/nexus/ask/AskContextItem` so the floating Ask launcher knows the current item.
- Settings tabs: `src/app/[locale]/(app)/settings/SettingsTabs.tsx` is shared. Build your tab as
  its own file `settings/<Name>SettingsTab.tsx` (client component, self-loading via your API) and
  ask the coordinator in your report to register it (tab value + i18n key).

## Verification you must do before reporting

1. `npx tsc --noEmit` clean for your files; `npx eslint <your files>` clean.
2. Your seed runs standalone twice without error and without duplicating rows.
3. Every page/API you built opened or called in BOTH locales on the shared dev server via a
   Playwright probe (`scripts/dev-probes/<module>-probe.ts`, `chromium.launch({channel:"msedge"})`,
   login with the seeded account, `page.screenshot` into `data/screenshots/cr08/<name>-en.png` and
   `-ar.png` at 1440x900). Look at your screenshots (use the Read tool on the PNG) and fix what
   looks wrong: overflow, clipped text, wrong RTL mirroring, missing translations (a raw key like
   `reports.title` on screen is a defect), console errors. Capture `page.on("console")` errors and
   `page.on("pageerror")` and fix them.
4. Write `docs/design-reviews/cr08-<module>.md`: a self-critique against the design rules above
   listing every finding with severity and how it was fixed; it must end with the exact sentence
   "Closing: no High or Critical HIG findings remain." only when true.
5. Add smoke checks: create `scripts/smoke-cr08-<module>.ts` exporting
   `export async function run(check: (name: string, ok: boolean, detail?: string) => void, ctx: { base: string; cookie: string; adminCookie: string; db: import("@libsql/client").Client }) : Promise<void>`
   with 8 to 20 checks (API responses, seeded counts, permission refusals, tool answers). The
   coordinator wires it into `scripts/smoke.ts`. Use `ctx.base` + `fetch` with the `cookie` header
   for a Contributor session and `adminCookie` for the Super Admin; use `ctx.db.execute(sql)` for
   raw counts.
6. Your final report (the message you end with) must list: files created, files changed, what the
   coordinator must wire (shell/nav, settings tab registration, prompt paragraph, smoke module,
   PORTAL_OF_RESOURCE entries, Home blocks), every assumption you made, every deliberate
   limitation, and DECISIONS-worthy decisions as ready-to-paste numbered paragraphs (the
   coordinator assigns the numbers).
