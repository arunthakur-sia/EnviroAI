# Phase C: final QC and client readiness

Change request 08, section 14. This is the record of the gates, what they
caught, and what was deliberately left. Every claim below is reproducible with
a command in this repository, and every command was run against the production
build (`next build` then `next start`) on the seeded database.

Run date: 2026-09-20.

## 1. The gates, and where they stand

| Gate | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | clean |
| Lint | `npx next lint --max-warnings=0` | no warnings, no errors |
| Unit tests | `npx vitest run` | 45 of 45 |
| Smoke suite | `npm run smoke` | 825 of 825 |
| End-to-end scenarios | `npm run qc:e2e` | 147 passed, 0 failed, 2 skipped |
| Permissions matrix | `npm run qc:permissions` | 122 page checks, 72 API checks, 0 problems |
| Console sweep | `npm run qc:console` | 0 findings over every page in both locales |
| Horizontal overflow | `npm run qc:overflow` | no page scrolls sideways at 1440, 1024 or 390 |
| Prose and markup sweep | `npm run qc:sweep` | 0 em or en dashes, 0 new HTML tables |
| Dependencies | `npm run qc:deps` | no unused package, no unpinned version |
| Lighthouse | `node scripts/lighthouse-a11y.mjs` | 24 pages, all above 90 |

Lighthouse, desktop preset, authenticated, 1440 by 900, accessibility and best
practices on every page and performance on every page that draws data:

| Range | Accessibility | Best practices | Performance |
|---|---|---|---|
| across 24 pages | 93 to 100 | 100 everywhere | 94 to 100 |

## 2. What the gates caught

Thirteen defects were found in this phase and fixed at the source. None was
suppressed and none was worked around in a test.

**Security.** The transcription capability probe (`GET /api/v1/transcribe`)
answered an anonymous caller with whether an OpenAI key is configured. Its POST
was properly gated; the probe now is too.

**Accessibility.** Six separate defects, all real and all measured:

1. The rail's group headings were `ink-400` on the rail's sand ground, which is
   2.72 to 1 at eleven pixels. They are `ink-600` now.
2. The language switch and the notifications button each had an accessible name
   that did not contain their own visible text, so a screen reader and a sighted
   person were told different things. Both names now carry what is on screen,
   the notification count included.
3. The Leaderboard's pinned strip declared itself a row group even when it held
   a sentence rather than a row, which is invalid.
4. The Leaderboard's category tabs pointed at panels that were never rendered,
   so every `aria-controls` referred to nothing. Each category now has its panel
   and only the chosen one holds the board.
5. White initials on the gold avatar measure 2.39 to 1, and white on the silver
   medal 2.8. Each ground now carries the ink that reads on it.
6. **One hundred and eighteen form labels across twenty three files named their
   control by sitting next to it and nothing more.** A screen reader announced
   an unnamed text field on every form in the product. They are associated now:
   105 label-and-control pairs, 14 captions over groups of buttons converted to
   a group with `aria-labelledby`, and 7 Radix switches given a name of their
   own.

**Performance.** The Reports gallery loaded fifteen report covers eagerly, each
a full page render of about 370 kB, and its largest contentful paint was 4.2
seconds against 0.6 for every other page. Covers now have a JPEG rendition at
the size they are drawn (29 kB instead of 355), the first row loads with the
page and the rest on scroll, and the page scores 97.

**Layout.** The Learning Room's theme cards grew the page sideways by 28 pixels
at 1024 in English and 12 in Arabic, because a grid item does not shrink below
its content unless told to.

**Correctness.** Three that mattered more than their size:

1. The CR05 handover API had quietly become a no-op. CR08 derives an item's
   status from its recipient decision, so the CR05 body that says only
   `status: "reassigned"` changed nothing and the completion percentage stopped
   moving. The translation now lives in the service (DECISIONS 129).
2. **The per-item handover points award was lost in the CR08 rewrite.** CR05
   paid five points for each item of a person's handover that was completed, and
   nothing recorded that event any more. It is recorded again at the one place
   an item becomes done.
3. "Read now" on the Knowledge of the Week reveal did not mark the reveal seen
   for the one person whose visit is never counted as a read, the contributor of
   that week's own pick, so the reveal opened again on every visit for the rest
   of their week.

**Honesty on screen.** Two, both found because the Anthropic account behind this
machine ran out of credit during this phase (see section 5):

1. A live gather whose calls all failed wrote its fallback answer from no
   evidence at all and told the reader that SiaNexus holds nothing on the
   question. It now re-runs the planned tools, so the fallback answer is
   grounded in the same real sources mock mode uses and its citations are real.
2. The "AI mock mode" chip read key presence alone, so a key that is present but
   refused left every answer coming from the deterministic writer with nothing
   on screen to say so. One refusal now latches the process into mock mode for
   fifteen minutes and the chip explains why (DECISIONS 131).

## 3. Every page, both locales, three widths, every role

The change request asks for this as screenshots. It is covered by four passes
that assert rather than only record, plus the screenshots the module authors
took while building:

- **Both locales, every page**: `npm run qc:console` opens all 61 page routes in
  English and Arabic as the Super Admin and captures console errors and
  warnings, page errors, failed requests, 404 assets and any raw translation key
  reaching the screen. Zero findings.
- **Three widths, both languages, every page**: `npm run qc:overflow` walks every
  page at 1440, 1024 and 390 in both languages and names the widest offending
  box on any page that scrolls sideways. Clean.
- **Every role**: `npm run qc:permissions` requests every page route and every
  GET API route as an anonymous visitor and as all seven seeded roles in both
  locales, and fails on an anonymous request that reaches a page, any 500, or a
  hidden portal that answers anything but the friendly 404. Scenario 8 of the
  end-to-end suite then signs in as each of the seven and asserts, in the
  browser, which rail groups and portals that role sees and that a portal it
  does not hold answers the friendly 404.
- **RTL mirroring**: scenario 9 of the end-to-end suite asserts `dir="rtl"` on
  the document and that the rail sits against the right edge, and repeats a full
  interactive scenario in Arabic.
- **Screenshots**: 379 captures in `data/screenshots/cr08/`, taken and read back
  by the module authors during the build, plus 20 in
  `data/screenshots/cr08-e2e/`, one per end-to-end scenario step, rewritten on
  every run so the folder always shows the last run.

## 4. The end-to-end scenarios

`npm run qc:e2e` drives system Edge through nine scenarios and writes a
screenshot per step. 147 checks pass and none fails.

| Scenario | What it proves |
|---|---|
| Ask NPC everywhere | Ctrl+K opens the panel on a project page, the context chip names the item, the answer streams with citations, the thread survives a route change, Expand carries the same conversation to the full page |
| Knowledge of the Week | a fresh sign-in raises the reveal, Read now opens the item, the reveal does not come back, the Home strip carries the pick with its read count |
| Messaging | a person card opens from an owner chip, the message is sent, the recipient's badge and inbox show it unread, the reply comes back to the sender |
| Reports | the gallery, a published report with its sections and download, the builder through to the live structure preview with page estimates |
| Organisation | add a child, rename in place, delete with reassignment, undo, and the tree is byte-identical to where it started, with the snapshots recording every step |
| Leaderboard | both boards, period and category switching, the viewer's own row pinned and real on each |
| Handover | the HR list, an in-progress handover with its completion and recipient controls, and the recipient's learning path with progress and modules |
| Permissions | all seven roles: the rail carries exactly that role's portals, and a portal it does not hold answers the friendly 404 |
| Arabic mirror | Home and the whole Leaderboard scenario again in Arabic, with the direction and the rail's side asserted |

Two checks print as skipped rather than passing vacuously: the Super Admin and
the HR Admin hold every portal, so there is no hidden portal to refuse them.

## 5. Demo readiness

- `npm run start:demo` builds once if needed and serves the production build
  with the job worker. Cold start to first request is 0.7 s.
- `npm run reset-demo` restores the frozen baseline with the server stopped in
  **under three seconds**, against the two minutes the change request allows.
  `npm run reset-demo:snapshot` freezes the current state as that baseline.
  The baseline holds the database plus uploads, reports and podcasts.
- `CLIENT_DEMO_GUIDE.md` walks a presenter through a thirty minute path across
  every module with the exact clicks, the accounts to use, and what to say about
  illustrative data. Every person, handover and report it names was checked
  against the seeded database.
- **The seed inside `npm run setup` takes 8 minutes 38 seconds**, against the
  fifteen the change request allows. That is with nothing else running; an
  earlier run the same day took 36 minutes, and the difference is worth keeping:
  the Anthropic account had run out of credit, so every capability waited on a
  call that was going to be refused. The refusal latch described above fixed the
  seed's time as a side effect, because one refusal now puts the whole process
  into mock mode instead of each capability discovering it alone. The demo path
  does not need the seed at all: the frozen baseline restores in seconds.
- **The Anthropic account behind this machine has no credit.** Every model call
  returns a 400 saying so, so the product runs in mock mode: every AI capability
  answers deterministically from the same real data, and the top bar now says
  so. Topping the account up needs no code change and no restart. The same is
  true of ElevenLabs, whose quota ran out during the CR02 work: podcast episodes
  play through the browser's own voice.

## 6. What Phase C deliberately did not do

Each of these is a decision, not an oversight.

- **Thumbnails beyond the first page and the English edition.** The gallery
  draws page one of the English rendition, so that is what gets a small
  rendition. `npx tsx scripts/qc/report-thumbs.ts --all-pages` makes the rest if
  a screen ever needs them.
- **WebP or AVIF anywhere.** Every native image encoder is blocked by this
  machine's Application Control policy. The one PNG in the shell is 45 kB and
  the report covers are now JPEG through the browser rasteriser.
- **A measured INP.** It needs a real interaction trace; total blocking time
  stands in for it and is zero on every page.
- **The Drizzle and Next major upgrades.** Both are named in Phase A with the
  advisories they would close. A major version bump is not a change to make on
  the last night of a release.
- **Converting the nine pre-CR08 screens that still use an HTML table.** They
  are listed by name in the sweep and exempt from it; every matrix CR08 added is
  a CSS grid with ARIA roles.
- **A Content-Security-Policy.** Left to the deployment, for the reasons in
  Phase A.
- **The `scripts/dev-probes/` directory.** It holds around 220 one-off
  investigation scripts from CR03 to CR08 and is the record of how each finding
  was established. It ships nothing, costs nothing at runtime, and was left
  alone rather than swept away at the end.

## 7. Sign-off

Sections 1 to 11 of the change request are complete and their acceptance checks
in section 15 pass. The three phase reports are `docs/qc/phase-a-cleaning.md`,
`docs/qc/phase-b-performance.md` and this file. Every limitation above is named
with its reason, and nothing is left partly done without being named here.
