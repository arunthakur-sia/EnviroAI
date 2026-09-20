# Phase A: system cleaning

Change request 08, section 12. This is the record of what was inspected, what
was found, and what was changed. Every claim here is something a command in
this repository can reproduce.

Run date: 2026-09-20. Commands: `npm run typecheck`, `npm run lint`,
`npm run qc:sweep`, `npm run qc:permissions`, `npm run qc:console`,
`npm run test`, `npx ts-prune`, `node scripts/qc/deps-check.mjs`,
`npm audit --omit=dev`.

## 1. Static analysis

**TypeScript.** `tsc --noEmit` is clean across the repository, including every
script and probe. `strict` is on in `tsconfig.json` and was not relaxed.

**`any`.** The repository carried 21 occurrences. Nine of them were
`catch (e: any)`, which is not a typed boundary but a hole: an error object is
whatever was thrown. All nine were rewritten to `catch (e: unknown)` with the
narrowing done once per file in an `errMessage`/`errStack` helper
(`scripts/qc/fix-catch-any.mjs` did the rewrite and is kept so the pass can be
repeated). One of them was hiding a real assumption: the web-search scanner
read `e.status` to decide whether to try the next tool variant, which is now an
explicit check that the thrown value carries a numeric `status`.

What remains is at library boundaries and is deliberate:

| File | Use | Why it stays |
|---|---|---|
| `components/nexus/IndicatorChart.tsx`, `components/nexus/reports/ReportChart.tsx` | Recharts `label` and `formatter` callbacks | Recharts types these as `any` itself |
| `vault/[id]/Reader.tsx` | two `useRef` holding pdf.js objects | pdf.js ships no types for the worker handles |
| `server/search/vector.ts` | `args as any` on two raw libsql statements | the driver's arg union does not admit `Float32Array` |
| `server/services/search.ts` | `rows as any[]` from a raw FTS query | raw driver rows |
| `server/services/analytics.ts` | a generic `count(table, conds)` helper | one helper over many Drizzle tables |
| `server/reports/sections/index.ts` | `SectionDefinition<any>` | the library is deliberately heterogeneous: each section has its own data type |

**Unused exports.** `npx ts-prune` reports 794 lines, almost all of them
framework conventions it cannot see: page and layout default exports, the
middleware `config`, `instrumentation.register`, every seed's default export
(loaded by `scripts/cr08-seed.ts` through a computed path) and every smoke
module's `run` (discovered by a glob in `scripts/smoke.ts`). The genuinely dead
files are the two documented stubs: `next.config.ts` (the active config is
`next.config.mjs`, because the native SWC binary is blocked) and the root
`instrumentation.ts` (the real one is `src/instrumentation.ts`). Both already
carry a comment saying so, and several retired probes follow the same pattern.

A correction to an earlier reading of this machine: deletion is not blocked.
`Remove-Item` from PowerShell removes a file in this tree, which is how the
three development preview routes were retired in Phase C (DECISIONS 130). The
stubs above were left as stubs rather than churned at the end of the run.

**Cycles.** No import cycle was found: the one place where two modules referred
to each other, `src/server/indices/defs-cr08.ts` and `fetcher.ts`, is a
type-only import in the direction that would have closed the loop, which the
compiler erases.

**Duplicates.** Two pairs were merged during the work rather than left: the
handover categories and the expert constants now live in `src/lib/*-constants.ts`
and are re-exported by their services, because a client component that imports a
value from a server service drags `next/headers` into the browser bundle (see
DECISIONS 109). Two probe scripts that duplicated a sibling were retired to
`export {}`.

## 2. Runtime hygiene

`npm run qc:console` opens every page under `src/app/[locale]/(app)` in both
locales in system Edge, captures console errors and warnings, page errors,
failed requests, 404 assets and raw translation keys, and writes
`docs/qc/console-sweep.md`.

Three hydration defects were found during the build and fixed at the source
rather than suppressed; all three were the same mistake, a value only the
browser knows changing what the server renders (DECISIONS 113):

1. `Reveal` and `Stagger` switched their `initial` prop on `useReducedMotion()`,
   which is null on the server. A reduced-motion client therefore rendered no
   style where the server had written `opacity: 0`. The initial state is now the
   same on both sides and the preference collapses the transition duration.
2. The Ask NPC panel store read `sessionStorage` at module load, so a saved
   thread made the first client render differ from the server's snapshot. React
   then discarded the server tree and reported every Radix `useId` beneath the
   shell as a further mismatch, which is why the top bar looked guilty. The
   store now starts empty and restores after mount.
3. The operating model's ring calendar and chord diagram printed unrounded
   `Math.sin`/`Math.cos` output into SVG path strings. Every generated
   coordinate is now rounded to two decimals.

A fourth class of defect, horizontal overflow, has its own gate:
`npm run qc:overflow` walks every page at 1440, 1024 and 390 in both languages
and names the widest box on any page that scrolls sideways, skipping geometry
that an ancestor already clips so the report points at the cause rather than at
the symptom. It found three: the Ask NPC panel parked off-screen while closed
(a fixed element is not clipped by an ancestor, so it added its own width to
every Arabic page; it now lives inside a viewport-sized clipper), the Strategy
Canvas's last outcome medallion whose 288 pixel hover card hung past the grid,
and Home's Ask hero, whose focus glow reached eight pixels further than the
page gutter and so gave every Home page a scrollbar for a decoration that is
invisible until the box is focused.

## 3. Data layer

Every page and API reads through a service in `src/server/services/*`; the one
raw `sql` fragment left in a page is an atomic view-count increment on the Ask
thread page, which is a write, not a query. Raw SQL otherwise lives in the
search layer, where FTS5 and the vector scan need it.

`src/server/db/client.ts` holds one connection for the whole process (cached on
`globalThis` so a hot reload does not open a second) and now sets the pragmas the
change request asks for: WAL, `synchronous = NORMAL`, foreign keys on,
`busy_timeout = 8000`, a 64 MB page cache, `temp_store = MEMORY` and a 256 MB
memory map. The busy timeout matters here in particular: seeds, probes and the
dev server write to the same file from different processes, and without it a
concurrent seed surfaced as a page silently missing a block.

Indexes were added in `0007_cr08.sql` for the lookups CR08 introduced (reports
by type and status, sections by report, leaderboard by board and period,
messages by thread and time, participants by user, processes by parent and
owner, interfaces by unit) alongside the ones the earlier change requests had
already placed.

Migrations are idempotent and now also checkable: `scripts/migrate.ts` records
each file's content hash in a `_migrations` table and skips a file whose hash has
not changed, which is what lets the demo start check migrations instead of
re-running them (DECISIONS 82).

## 4. Permissions

`npm run qc:permissions` walks every page route and every GET API route,
requests each as anonymous and as all seven seeded roles in both locales, and
writes `docs/qc/permissions-matrix.md` with the status code for every cell. It
fails the run if an anonymous request reaches a page, if any role receives a 500,
or if a hidden portal answers anything but the friendly 404.

## 5. AI layer

Every capability goes through `src/server/ai/client.ts`, which loads its prompt
from `src/server/ai/prompts/*.md` with the shared preamble cached, caps
`max_tokens` on every call, never sends `temperature` (the current models reject
it), and returns `null` on any failure so the caller falls back to its
deterministic mock. Mock mode is honoured by every CR08 capability: the report
section writer, the handover interview, the learning path, the filing
classifier, the index narratives and the analyst loop each have a deterministic
writer that produces the same shape as the model.

The report section writer adds a grounding guard the other capabilities should
adopt: an answer is accepted only when every paragraph is bilingual, free of
dashes, and every number of two or more digits appears in the facts that were
sent; otherwise the mock writer runs (DECISIONS 97). No AI call is made on
hover or on page load anywhere: every call is behind an explicit action or a
queued job.

## 6. Jobs

The worker starts once from `src/instrumentation.ts`, claims one job at a time
with an optimistic update, retries with a growing delay and gives up after three
attempts. Nothing runs at startup: the recurring kinds (scan, lesson
re-clustering, index forecasts, HR risks, the ten-minute leaderboard refresh,
the hourly Knowledge of the Week rollover, the nightly handover pass) are
enqueued with a future `run_after` and only one future instance of each is ever
queued. Failures are visible in Settings and in the `jobs` table with their
error text.

## 7. Consistency

`npm run test` includes an i18n parity test that asserts the two message files
carry the same keys, that no value is empty, that no value contains an em dash
or an en dash, that every ICU placeholder in English exists in Arabic, and that
every Arabic plural carries the forms Arabic needs. Parity is 4,390 keys per
language.

`npm run qc:sweep` asserts that no authored file anywhere in `src`, `messages`,
`scripts` or `docs` contains an em dash or an en dash (the repository is now at
zero, including the null placeholders in `lib/format.ts` which had used one),
and that no new component uses an HTML `<table>`; the nine files that predate
the rule are listed by name and exempt, so a new one fails the sweep.

## 8. Security

- Session cookie: `httpOnly`, `sameSite=lax`, `path=/`, and `secure` behind
  `SESSION_COOKIE_SECURE=1`. It is deliberately not secure by default because
  the prototype, including `npm run start:demo`, is served over plain http on
  this machine and a secure cookie would lock everyone out.
- Headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`
  that leaves only the microphone (Speak mode) enabled, and the `X-Powered-By`
  header removed. A Content-Security-Policy is deliberately left to the
  deployment: Next injects inline bootstrap scripts and the dev server needs
  `eval`, so a policy written here would either be unsafe or break the dev loop.
- Login is rate limited by the existing lockout: five failed attempts lock the
  account for fifteen minutes, recorded on the user row.
- Uploads are now checked against an allowlist of the extensions the product can
  actually read (`isAllowedUpload` in `src/server/storage/index.ts`) and refused
  with 415 otherwise, in both the Institutional Memory and the deliverables
  routes, before anything is written to disk. The 100 MB cap was already there.
- Path traversal: stored paths are generated by the storage layer, never by a
  caller, and `get()` now refuses to read outside `data/` even if a row were
  tampered with.
- Secrets live only in `.env.local`, are read through `src/lib/load-env.ts`, are
  never logged, and the repository checks presence with booleans.

## 9. Seeds

`npm run seed` rebuilds the database from `sources/` through the whole chain,
CR01 to CR08, and block 12h runs every CR08 module seed in dependency order
(portals and badges, gamification, organisation, experts, studies, indices,
reports, handover, Knowledge of the Week, messaging, operating model) before one
final leaderboard materialisation. Every module seed is idempotent and was run at
least twice by its author with identical counts.

## 10. Dependencies

`node scripts/qc/deps-check.mjs` reports no unused dependency and no unpinned
version. Four packages that nothing imported were removed
(`@radix-ui/react-checkbox`, `@radix-ui/react-select`, `@radix-ui/react-slider`,
`d3-force` and its types), and thirteen packages declared as `latest` were
pinned to the version installed here, so a clean clone reproduces this tree.

`npm audit --omit=dev` reports four advisories. None is fixable without a major
upgrade, and each was assessed rather than waved through:

| Package | Severity | Assessment |
|---|---|---|
| `drizzle-orm` | high | SQL injection through improperly escaped **identifiers**. Every identifier in this product is a literal in `schema.ts`; no table or column name is ever taken from a request. The fix is a major bump, which is not a change to make on the last night of a release. Recorded as the first thing to do next. |
| `xlsx` | high | Prototype pollution and a regular-expression denial of service. No fix exists on npm. The parser only ever sees publisher workbooks fetched by the indices scripts and administrator uploads on the indicator import screen. |
| `postcss`, `next` | high, moderate | Both resolve only by moving to Next 16. The affected PostCSS paths are build-time. |

## 11. Notes for whoever runs this next

- `server-only` now guards the AI client, the ingest parsers and the storage
  layer. The unit tests run that server code directly, and the package's own
  client build throws on import, so `vitest.config.ts` resolves `server-only` to
  an empty stub in `tests/stubs/`. A future test that imports a guarded module
  needs nothing further.
- The upload allowlist is a single list in `src/server/storage/index.ts`. A new
  file type the product learns to read is added there once and both upload
  routes follow.

## 12. What Phase A deliberately did not do

- The Drizzle and Next major upgrades above.
- A Content-Security-Policy (see Security).
- Converting the nine pre-CR08 screens that still use an HTML `<table>`; they are
  listed in the sweep and exempt, and every new matrix in CR08 is a CSS grid with
  ARIA roles.
