# CR05 Section 4 review: the International Indices module

Screens reviewed as images: `indices-board-{en,ar}.png`, `indices-board-en-full.png`, `indices-board-en-hover.png`, `indices-table-en.png`, `index-page-en{,-full}.png`, `index-page-ar-full.png`, `indices-settings-en.png`, `indices-board-en-390.png` in `data/screenshots/cr05/`.

## Self-critique (three sentences)

The board earns its keep because every number on it is a real published value with a source behind it (IMD 11 of 67, GPI 29 of 163 at 1.66, CPI 41 of 182 at 58), and the inverted rank sparklines read "up is better" without a legend. The index page's strongest move is keeping the forecast honest: the evidence/assessment split, the visible fan, the method section with the fitted parameters, and the gold what-if banner that appears the moment a slider moves make it hard to mistake a model output for a fact. The weakest first render said "1 places" and announced that the forecast moved from #43 to #43; both were fixed during this review (ICU plurals, and the moved line now only appears when the central value actually changed).

## Findings

- Fixed during review: `/indices` crashed client-side because a bare-string setting went through `getSetting`'s object merge and came back as character soup; the refresh stamp is now stored as an object. Found by reading the screenshot, confirmed with a console probe.
- Fixed during review: "1 places" pluralization (EN and AR ICU plural forms), the zero-change chip showing "0 places", and the forecast-moved line firing when nothing moved.
- Fixed during review (engine): rank derivation for report-extracted indices was peer-relative (GII showed rank 12 against 18 stored peers instead of ~49 of 133); the engine now anchors pool movement to the published rank (DECISIONS 68, unit-tested), and rank-fallback ranges (IMD) store as clamped positive ranks.
- Low: the benchmark rank chart draws grey peers behind Qatar's maroon with the leader in gulf; at six GCC lines it stays legible, and custom groups cap at 30 countries where it will crowd - the latest-scores bars carry that case.
- Checked and clean: RTL mirrors the whole page (charts keep their internal LTR direction); the what-if simulator runs the same engine in the browser at 1,000 runs and never stores; the summary strip counts improving/stable/declining honestly from published changes; the history table exposes per-row sources and non-`fetched` statuses; Settings > Indices covers the register, refresh, manual corrections, assumption defaults, and recompute-now.

Closing statement: no High or Critical HIG findings.
