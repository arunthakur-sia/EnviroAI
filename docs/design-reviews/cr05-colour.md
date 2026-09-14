# CR05 Section 1 review: Maroon Authority on a bright neutral ground

Screens reviewed as images: `data/screenshots/cr05/after-{home,vault,strategy,ask,trends,lessons,settings}-{en,ar}.png`, `after-bar-search-focus-en.png`, `after-login-{en,ar}.png`, `after-home-en-390.png`, against the `before-*` set.

## Self-critique (three sentences)

The maroon bar now anchors every page and the white monochrome NPC lockup, gold avatar ring, and translucent search field read as one composed object rather than four controls that happen to share a row, while the cool neutral ground makes the white cards and the maroon data lines noticeably crisper than the warm paper did. The books, their cloth, and their warm paper title plates survive the repaint untouched, which keeps the Library feeling physical instead of turning the shelves into another UI surface, and the plank's cool grey board with its darker edge still separates object from page. The weakest moment is the `Ctrl K` keycap on the translucent bar field, which sits near the legibility floor on maroon; it is a decorative duplicate of an accessible label and turns fully legible the moment the field focuses to white, so it stays.

## Findings

- Low: the `Ctrl K` keycap hint on the resting bar field is faint on maroon (white at 70 percent over the 14 percent field). Decorative, duplicated by the input's aria-label, legible on focus. No change.
- Low: the shelf plank at 1440 is quieter than the old warm board. Intentional: the given `--plank` values are close to the ground by design, and the edge line plus bracket shadows keep the object readable.
- Checked and clean: bar text and icons are `--bar-ink`; the language pill and keycap use the muted white; search placeholder is white at 72 percent and flips to ink on focus with the 2px gold ring; the notification badge moved to gold-on-ink so it no longer vanishes into the bar; focus outlines inside the bar are gold (maroon-on-maroon was invisible); RTL mirrors the whole bar; the mini-player stays light and docked under the content; charts kept maroon/gulf/gold with hairlines on the new `--sand-300`; the quote band keeps its maroon wash; the login form now sits in a white card on the neutral ground with the maroon primary button and the reveal intact.
- Contrast audit (`node scripts/contrast-audit.mjs`): 25 pairs, all pass; `--ok` and `--warn` were darkened to clear AA on their light tints (4.29:1 and 3.19:1 before; 5.13:1 and 5.09:1 now) - the one semantic adjustment, recorded in DECISIONS 66.

Closing statement: no High or Critical HIG findings.
