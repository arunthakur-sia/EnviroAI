# CR03 self-critique: Trends and Signals (radar + briefing)

Screenshots: `data/screenshots/cr03/trends-en-1440.png`, `trends-en-1440-hover.png`, `trends-ar-1440.png`, `trends-en-390.png`, `trends-ar-390.png`, `trends-en-full.png`.

## Three sentences

The eye lands on the radar: a real semicircular field with three sand horizon bands, eight labelled type wedges, and thirty coloured blips sized by impact, the high-impact ones breathing a slow halo, all revealed once by a maroon sweep on load. Two things looked generic on the first pass and were fixed: the three band labels collided into one unreadable string along the base (now the short words with the full ranges moved into the legend), and the legend's impact row wrapped mid-word (now a tidy column). A Sia designer would be proud that the radar and the briefing are one organism: hovering any card enlarges and rings its blip, hovering a blip raises a card with the signal's why-it-matters and outcome chips, clicking a blip scrolls to and highlights the story below, and clicking a wedge or band label filters both through the URL.

## Notes against the anti-pattern list

- No table in the radar or briefing; the international index tracker below keeps its table because CR 3.1 marks it "unchanged, moved below".
- The flat masonry is gone; the briefing is a hierarchy: three feature cards (the first with the maroon top rule), then category lanes ordered by summed impact with the top three expanded, with a by-outcome regrouping toggle.
- The only loops are the high-impact blip pulse (explicitly allowed) and nothing else; the sweep runs once.
- Feature and lane cards lift on hover and show the radar connection; every wedge label, band label, chip, and lane header is interactive.

## HIG pass (apple-design-skill lens)

- Blips are focusable buttons in impact order with names carrying title, impact, and horizon; wedge and band labels are focusable filter buttons with explicit aria labels.
- Sentiment colours (gulf/danger/ink/warn) are backed by the size scale and the legend, so colour is not the only channel; the legend spells both scales.
- Reduced motion suppresses the sweep, the reveal delays, and the pulse.
- RTL: the wedge order runs counterclockwise so policy sits at the reader's start side, band labels mirror, the legend moves to the end side; labels stay upright.
- Triage on feature cards keeps the accept/dismiss/convert affordances with toasts and points, identical semantics to CR01.

Verdict: no generic item remains; no High or Critical HIG findings.
