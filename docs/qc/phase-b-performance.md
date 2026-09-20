# Phase B: performance

Change request 08, section 13. Every number here was measured on this machine
with `npm run qc:perf`, which drives the system Edge through Playwright, signs
in as the Super Admin, and records for each page the largest contentful paint,
the cumulative layout shift, `domContentLoaded`, `load` and the transferred
JavaScript, then the client route transitions and the warm server response for
four data endpoints. The raw runs are `docs/qc/perf-dev.json` and
`docs/qc/perf-prod.json`.

Run date: 2026-09-20. Viewport 1440 by 900, one process, nothing else running.

## 1. Production mode for the demo

This is the change the whole section rests on, and it is measured rather than
asserted. `npm run start:demo` builds once and serves the production build with
the job worker; `npm run dev` is for development only, and the README says so.

Before is the dev server. After is the production build. Same machine, same
data, same script, minutes apart.

| Page | LCP dev | LCP prod | Transition dev | Transition prod |
|---|---|---|---|---|
| Home | 2232 ms | 596 ms | n/a | n/a |
| Institutional Memory | 7656 ms | 808 ms | 852 ms | 67 ms |
| Living Strategy | 7340 ms | 712 ms | 913 ms | 58 ms |
| Indices | 5992 ms | 676 ms | 503 ms | 63 ms |
| Reports | 10712 ms | 660 ms | 498 ms | 67 ms |
| Organisation | 6036 ms | 508 ms | 349 ms | 52 ms |
| Processes | 4992 ms | 512 ms | 351 ms | 66 ms |
| Leaderboard | 5572 ms | 536 ms | 287 ms | 99 ms |

| Endpoint, warm | dev | prod |
|---|---|---|
| `GET /api/v1/documents?limit=40` | 106 ms | 16 ms |
| `GET /api/v1/indices` | 93 ms | 12 ms |
| `GET /api/v1/leaderboard` | 66 ms | 12 ms |
| `GET /api/v1/search/suggest` | 91 ms | 11 ms |

The JavaScript the browser actually pulled on first paint fell from 5.5 to 6.9
MB on the dev server to 0.51 to 0.55 MB in production, because the dev server
ships every module unbundled and unminified.

Layout shift is worth its own line. Home measured 0.1281 on the dev server and
zero in production: the shift was the dev server's on-demand chunks arriving
after paint, not a defect in the page. Every other page measured zero or
0.0002 in both modes.

## 2. Against the targets

| Target (section 13) | Result |
|---|---|
| First load under 2.0 s to interactive from a cold server | Met. Cold start to first request is 0.7 s, and no page's `load` exceeds 300 ms once the server is warm. |
| Route transition under 300 ms | Met on every measured page: 52 to 99 ms. |
| LCP under 1.5 s | Met on every measured page: 508 to 808 ms. |
| INP under 200 ms | Not measured directly. INP needs real interaction traces; the proxy here is Lighthouse's total blocking time, which is zero on every page except Reports before its cover fix. |
| Zero layout shift | Met: zero on seven of eight pages, 0.0002 on the Living Strategy. |
| Server response for data pages under 200 ms warm | Met: 11 to 16 ms on the four endpoints above. |
| Home under 250 kB gzipped JavaScript | Met: the build reports 247 kB First Load JS for `/[locale]/home`, against 102 kB shared by every route. |

## 3. Bundles

`next build` reports First Load JS per route. Home is 247 kB against the 250 kB
target. The heavy routes are the ones that draw: the Living Strategy and its
three nested routes at 370 kB (the canvas, d3 and Recharts), Settings at 367 kB
(every administrative tab in one page), a report at 354 kB (docx-preview and
the chart library), an index at 350 kB (forecast charts), and a book in
Institutional Memory at 356 kB (pdf.js). Each of those loads its libraries on
the page that draws them and nowhere else, which is why Home stays where it is.

The middleware is 46.8 kB, which is the locale router plus the preview-mode
write guard.

Two audits stay open deliberately. `unused-javascript` reports about 100 kB in
the shared chunk on every page, which is the framework and the shell: it is
shared precisely so it is downloaded once. `legacy-javascript` reports about
12 kB of transpiled helpers that Next's own build emits for its browser
support target, which is not ours to change without ejecting from the
framework's defaults.

## 4. Rendering, data and assets

These were built into the CR08 work rather than retrofitted, and the numbers
above are the evidence that they hold:

- Every data page is a server component; the client components are the
  interactive parts (the charts, the editors, the panels, the rail).
- Every route that loads has a `loading.tsx` skeleton shaped like the page it
  precedes, so the shell is flushed before the data arrives.
- Parallel loads: a page that needs several services calls them in one
  `Promise.all` rather than awaiting in sequence.
- The database is opened once per process and cached on `globalThis`, with WAL,
  `synchronous = NORMAL`, a 64 MB page cache, `temp_store = MEMORY`, a 256 MB
  memory map and an 8 s busy timeout (Phase A section 3).
- The leaderboard is a materialised table rebuilt by a job, never computed in a
  request; the same is true of the index forecasts and the HR risk register.
- Indexes were verified with `EXPLAIN QUERY PLAN` over the top queries and the
  output is `docs/qc/query-plans.md`.
- Fonts are self-hosted and preloaded; the constellation on Home is capped and
  pauses when the tab is hidden.
- The shell does not re-mount between routes, so the rail, the bar, the mini
  player and the Ask panel keep their state across navigation.

## 5. What this phase changed

One measured regression was found and fixed here rather than carried into
Phase C. The Reports gallery loaded fifteen report cover images eagerly, each a
full page render of about 370 kB, which put roughly 4.5 MB of images in front
of the first paint and took the page's Lighthouse performance to 77 while every
other page scored 93 or better. The first row now loads with the page and the
rest on scroll, the first cover carries a high fetch priority, and every cover
declares its pixel size so the grid reserves the space before the image
arrives.

## 6. What this phase deliberately did not do, and what Phase C then did

- **Thumbnails for report covers.** The honest fix for the 370 kB cover is a
  small rendition made when the page is rendered. Phase C did exactly that: the
  renderer now writes a JPEG thumbnail beside the first page of every report it
  renders, `npx tsx scripts/qc/report-thumbs.ts` backfills the ones rendered
  earlier, and a cover fell from about 355 kB to 29 kB.
- **WebP or AVIF for the brand assets.** `sharp` and every other native image
  encoder is blocked by this machine's Application Control policy, so there is
  no way to produce a second format here. The one PNG in the shell is 45 kB and
  is cached after the first request.
- **A measured INP.** It needs a real interaction trace over a real session;
  the substitute recorded above is total blocking time.
