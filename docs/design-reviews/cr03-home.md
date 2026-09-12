# CR03 self-critique: Home (the page that wins the decision)

Screenshots: `data/screenshots/cr03/home-en-1440.png`, `home-en-1440-hover.png`, `home-ar-1440.png`, `home-en-390.png`, `home-ar-390.png`, `home-en-full.png`, `home-ar-full.png`.

## Three sentences

The eye lands on the 36px Fraunces greeting and then falls into the Ask hero, whose placeholder is literally typing a real question letter by letter while the constellation's threads drift faintly behind the whole page. Three generic tells were found and fixed across passes: the What changed timeline repeated the same KPI three times (now deduplicated to one row per subject), the quote wrapped one word per line at 390px (now responsive type), and the old word-of-day caption duplicated the new quote band (removed). A Sia designer would be proud that hovering a lesson card lights the constellation lines of its outcome, pulses the matching dot in Your progress, and washes the What changed row of that outcome in maroon, so the page visibly knows how its own knowledge connects.

## Notes against the anti-pattern list

- Bento with intentional sizes on the 12-column grid (greeting 4 / ask 8; quote full width; numbers 5-tall / quiz 3 / podcast 4 / timeline 7; lessons 12; library 8 / progress 4); nothing is an equal bordered rectangle.
- Shadows are the warm maroon-tinted pair from `.bento-card`; borders fade in from transparent to maroon-100 on hover; primary actions slide 4px from the end side.
- The only loops are the four allowed: constellation drift, podcast halo, the sparkline end dot, and (on Trends) the radar pulse. The entrance stagger runs once, the constellation fades in last.
- Every card responds under the pointer: lift, chip fills, digit ticks, underline draws; the quiz flips on its Y axis; the progress ring draws in and glows when points change.
- No table, no emoji, no heading larger than the greeting; progress is rings and bars, never text alone.

## HIG pass (apple-design-skill lens)

- The Ask input keeps a real accessible name while the animated placeholder cycles; the cycle stops the moment the user types and respects reduced motion (static placeholder).
- The quiz's flip announces its result in text and iconography, persists for the day, and the answered state arrives from the server, not local state.
- The constellation is `aria-hidden`, pointer-transparent, sand-toned at 60 percent, and dims when the Ask hero has focus, so it can never fight the content for attention.
- Contrast: 64px maroon-900 figures, ink-600 captions, the quote at ink-900 on the maroon-100 wash (about 12:1); the delta chip uses the ok/warn light pairs from the system.
- RTL: the bento mirrors through the grid, the quote wash starts from the reader's start side, Hijri date sits beneath the Gregorian line, and the podcast halo, flip, and timeline all run mirrored.

Verdict: no generic item remains; no High or Critical HIG findings.
