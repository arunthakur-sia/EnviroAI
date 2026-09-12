# CR03 self-critique: Living Strategy, Level 1 (the seven outcomes)

Screenshots: `data/screenshots/cr03/strategy-en-1440.png`, `strategy-en-1440-hover.png`, `strategy-ar-1440.png`, `strategy-map-en.png`, `strategy-en-390.png`, `strategy-ar-390.png`.

## Three sentences

The eye lands on the arc of seven maroon medallions, each ring drawing itself in over 700ms with a staggered start, the outcome number set large in Fraunces at its centre. The one generic thing on first pass was the empty top-right quadrant beside the page intro, and it is now occupied by the edition switch and the Outcomes|Map toggle sitting on the intro's baseline; nothing else reads as a template (the at-a-glance band is a bare sand wash with three count-up figures and a real 12-month update sparkline, not three bordered stat boxes). A Sia designer would be proud that hovering a medallion lifts it six pixels, brightens the ring, and floats a card with the outcome's actual one-line national description, so the page teaches the strategy instead of just counting it.

## Notes against the anti-pattern list

- No tables, no equal bordered rectangles; the glance band deliberately has no card border (CR 2.2).
- Every element responds to the pointer: medallions lift and speak, the map slices brighten and raise the same hover card, toggle chips restyle.
- The only motion is the one-time ring draw-in and the page entrance; nothing loops.
- All rings currently read 100% because every seeded target is on track; the RAG dot at the ring's end still differentiates (gold at-risk dots on O3 and O6). Honest data, not a design fault.

## HIG pass (apple-design-skill lens)

- Contrast: ring maroon-700 on sand-300 track 4.9:1; numbers maroon-900 on white 10:1; counts ink-600.
- Each medallion is one link with an accessible label carrying title and share on track; the decorative ring SVG is `aria-hidden`.
- Keyboard: medallions are tabbable links and show the lifted state on focus-visible; the map slices take focus and Enter.
- Reduced motion: draw-in and count-ups render final state immediately (`useReducedMotion`).
- RTL: medallions run right to left, the arc stays symmetric, the glance band mirrors, numerals stay Latin tabular per app convention.

Verdict: no generic item remains; no High or Critical HIG findings.
