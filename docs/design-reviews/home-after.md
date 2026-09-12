# Design review: Home (after CR02 rebuild)

Second pass with the apple-design skill after the Section 1.3 rebuild. Artifact: `data/screenshots/cr02/home-en-1440.png`, `home-ar-1440.png`, `home-en-1280.png`, `home-ar-1280.png`, `home-en-1024.png`, `home-ar-1024.png`, `home-en-390.png`, `home-ar-390.png`, plus source (`src/app/[locale]/(app)/home/`). Contrast computed from the tokens in `src/styles/globals.css`.

### Summary

The page now has one thesis and it reads instantly: ask SiaNexus. One focal point (the Ask box), three rows with one card geometry each, a 48px rhythm, and a single staggered entrance. The paper-and-ink identity survived the diet; the boldness is spent once, on the fact card's Fraunces figure inside the Today row. Overall rating: **Good**. No Critical or High findings remain.

### Resolved from the before review

- ink-400 small text carrying information is gone from Home: eyebrows, captions, date, and the progress line use `ink-600` (#5E5760 on #FBF9F5, 6.6:1; on white 6.9:1). `ink-400` remains only on the duplicated Hijri date and the word-of-day attribution, both of which restate adjacent ink-600 content.
- One focal point: the greeting dropped to 20px, the count-up hero was removed, and the Ask box is the only large element above the fold at every width down to 390px.
- One card geometry per row: three identical Today cards (eyebrow, content, one action row), four identical lesson cards, one shelf, one panel.
- `loading.tsx` added with skeletons that match the final shapes exactly (hero bar, three equal cards, four lesson cards, shelf, panel).
- One entrance: the page `Stagger` only. The count-up animation and the footprint keyframes are gone; remaining motion (quiz feedback, ring dashoffset on mount, hover lifts) is user-triggered or part of the single entrance and respects `prefers-reduced-motion`.
- Eyebrow style unified: 12px small caps, 0.12em tracking, `ink-600`, hairline rule, with real `h2` semantics (fontFamily inherits the per-locale body face; the display serif no longer leaks in through the base heading rule).
- Empty states written for every card in both languages, each with one action (fact card, changed card, podcast card, lessons row, shelf).
- The word of the day is a single truncated caption line under the example chips.
- Mystery shelf, contributor spotlight, and the "For you" list are gone; For-you items now arrive as notifications and the bell badge shows the unread count.

### Improvements

- **Medium.** The example chips can wrap to two lines at 1440px when three long questions rotate in together; the hero stays calm but the chip block competes slightly with the caption below it. Judgment: cap the rotation at two chips above 1280px only if the client finds it busy; left as is because the chips are the generative-AI onboarding surface (`generative-ai.md › Inputs`).
- **Low.** The quiz's three option chips give the fact card a taller content block than its siblings until answered; the shared action row keeps the geometry aligned, so this is visible only as internal density. No change made.
- **Low.** The Hijri date and word-of-day attribution sit at 3.1:1 (`ink-400`). Both duplicate or decorate adjacent accessible text, so they are treated as exempt decorative text; darken to `ink-600` if the client prefers a strict reading.

### Craft notes

The signature is now the quiet one: a government page that opens with a question box instead of a dashboard. The Fraunces figure in the fact card is the single expressive moment and it belongs to the content (a national statistic), not to decoration. The maroon waveform glyph on the podcast card is drawn from the product palette with no new colors.

### What works

- The Today row's three-card contract (eyebrow, content, one action) survives translation: AR mirrors the grid, chips, and arrows correctly, including the flipped submit arrow.
- Keyboard: the Ask form submits on Enter, every action is a real link or button, and focus-visible outlines are intact.
- Progress panel: level ring and weekly ring are redundant to the caption line beneath them, so no information is carried by the rings alone; the seven footprint dots carry name and depth in their accessible labels and tooltips.
- Quiet mode collapses the panel to footprint dots plus a "Progress hidden" caption, and suppresses point toasts.

### Platform notes

- Desktop web: unchanged rail and top bar; Home renders inside the existing shell.
- Below 1024px the Today cards stack, the progress panel drops below Explore (source order), and the Ask box stays first at every width; at 390px the textarea grows to keep the placeholder legible.
