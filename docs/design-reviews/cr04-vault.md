# CR04 self-critique: Knowledge Vault (the book hover, done right)

Screenshots: `data/screenshots/cr04/vault-en-1440.png`, `vault-en-1440-hover.png`, `vault-ar-1440.png`, `vault-ar-1440-hover.png`, `vault-en-390.png`.

## Three sentences

The eye lands on the pulled book: it comes forward and up off the plank, turns 22 degrees about its fore-edge so the hinged cover with its paper title plate swings into view over a real 4px page slab, while its own shadow widens and softens on the plank and the two neighbours lean away. The one generic-feeling defect found on the first pass was structural, not cosmetic: the shared shelf perspective put every book in one 3D rendering context, so depth sorting let a neighbour's spine slice through the turned cover like a ghost; each book now carries its own 1100px stage and the object reads as solid. A Sia designer would be proud that the whole interaction is two properties (transform and opacity), starts after a 40ms intent window so sweeps never flicker, and lands a preview card built entirely from data already on the page, with the reader route prefetching in the background.

## The interaction, verified against CR04 1.2

- Pull `translate3d(0,-12px,28px)`, turn `rotateY(-22deg)` (`+22` in RTL), both at 160ms with the house ease, from the same frame the intent window closes.
- The spine, cover, and page slab are one hinged object; the cover carries the same cloth, headbands, and gold rules, with the sand-50 title plate (type eyebrow, Fraunces 15px title, two-line summary, year) and the NPC mark and seal beneath; text is horizontal, Arabic covers are RTL and unrotated.
- The shadow is its own blurred ellipse: `scaleX(1.35)`, opacity 0.45 to 0.6.
- Neighbours part 6px each way at opacity 0.85 through pure CSS sibling selectors (`+` and `:has`), mirrored in RTL.
- z-index rises on enter and clears 160ms after leave via a transition delay; `will-change: transform` exists only on the pulled book and its neighbours, only while engaged.
- The preview card fades in over 120ms with a 6px drift, anchored to the book, flipping below the plank when the shelf sits high; it never covers the pulled book; Open and Save to collection both work (Save posts to the collections API).
- Touch is two-tap (first pulls and shows the card, second opens; tapping elsewhere returns the book; one book pulled at a time via a broadcast event). Keyboard: Tab pulls, Enter opens, Escape returns.
- Reduced motion: no transforms at all; the preview appears and disappears instantly.

## Performance (CR04 1.6)

Method: production build, system Edge via Playwright, rAF frame counting during three full pointer sweeps across the widest real shelf (Statistical Releases, 37 books) with all 137 books of the library mounted on the page. Result: **272 frames in 4.52s = 60.2fps** (display cap 60Hz), no dropped-frame stutter visible in the capture. The hover cost is constant per book (local state, no shelf re-render); the library holds sixty-plus books per section (Projects, 87) with the same per-book cost. Recorded by `scripts/dev-probes/book-fps-probe.mjs`.

## HIG pass (apple-design-skill lens)

- The book link exposes `aria-expanded`; the preview is reachable by pointer and keyboard focus without disappearing (a 120ms grace window bridges the gap between book and card).
- Hit target: the whole spine; the preview's actions are full-size buttons.
- Contrast: plate text is ink-900/ink-600 on sand-50 (12:1 and 6.9:1); preview follows the card system.
- No motion loops introduced; every transition is user-initiated and under 200ms.

Verdict: no generic item remains; no High or Critical HIG findings.
