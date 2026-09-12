# CR03 self-critique: Living Strategy, Level 2 (one outcome's targets)

Screenshots: `data/screenshots/cr03/strategy-outcome-en.png`, `strategy-outcome-en-open.png`, `strategy-outcome-ar.png`, `strategy-target-en.png`, `project-detail-en.png`, `project-detail-ar.png`.

## Three sentences

The eye lands on the outcome hero: the big Fraunces title over the sand band with the watermark numeral behind it, the description, the owner chip, and the 120px progress ring holding the share of targets on track. What first looked generic was the three targets without a matched measure sitting as near-empty white cards with only an apology line, so each of them now carries a delivery pulse (one RAG dot per initiative and project) under the honest "no measure linked" note, and the second pass finds nothing else template-like since the borderless cards, the maroon fill with the gold target tick, and the in-place expansion are all specific to this product. A Sia designer would be proud of the expansion itself: the card widens to the full grid, its side gains the maroon edge, and the Initiatives and Projects lanes slide open with their timeline bars and today marks while every other target quietly keeps its place.

## Notes against the anti-pattern list

- No tables anywhere in the module; the target detail's delivery items render as status-grouped card grids, and KPI values render as charts.
- Cards are borderless white on sand (CR 2.3) with the warm shadow on hover; the expanded state carries the maroon-100 start edge.
- One target expands at a time; Enter expands, Escape collapses, arrow keys move (mirrored in RTL).
- Lanes scroll horizontally with compact cards: title, owner, status dot, timeline bar with the maroon today mark, deliverables count.

## HIG pass (apple-design-skill lens)

- The whole card face is one button with `aria-expanded` and a descriptive label; the "Open target" link is separate and reachable.
- Progress figures use tabular numerals; the bar has an `img` role naming measure, actual, and target; the gold tick is decorative.
- Contrast: 32px maroon-900 figures, ink-600 captions, chip tones from the existing system; nothing under 4.5:1 for reading text.
- Reduced motion collapses the height animation to an instant state.
- The project detail page carries the CR 2.4 header band with the milestone-dotted timeline and the deliverables as a 140px mini shelf of real books.

Verdict: no generic item remains; no High or Critical HIG findings.
