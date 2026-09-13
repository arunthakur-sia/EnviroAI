# CR04 self-critique: the Learning Room

Screenshots: `data/screenshots/cr04/lessons-en-1440.png`, `lessons-en-full.png`, `lessons-en-hover.png`, `lessons-ar-1440.png`, `lessons-ar-full.png`, `learn-mode-en.png`, `lessons-en-390.png`.

## Three sentences

The eye lands on the Lesson of the week: a gold-washed editorial card with the category chip, the 26px Fraunces title, the learning in one plain sentence, the source and outcome chips, the contributor with their department, and Read and Listen as the only two actions, which makes the page open like a magazine rather than a query result. The generic finding fixed during the pass was the missing fourth lane: External Learning has no lessons yet and silently disappeared, which broke the room's promise of a fixed structure, so all four lanes now always render in order with their counts, the empty one honestly collapsed at zero. A Sia designer would be proud that reading never leaves the page (every card expands inline with a both-languages toggle), that Listen builds a real two-minute NPC Knowledge Cast episode once and replays it forever after, and that Learn mode turns the same page into a five-lesson guided session with progress dots, a reflection that saves as a private note, points, and streak credit that survives leaving and returning within the day.

## Verified against CR04 3

- Composition in order: header with the 60-second invitation and the Learn mode toggle, Lesson of the week (scheduled from Settings, else the highest worth-reading suggestion with the Suggested chip), themes with AI syntheses expanding in place with a theme Listen, the four category lanes ordered by the worth-reading score with per-user collapse persistence, the three browse tabs plus instant search, and the full filterable feed last.
- The worth-reading score (3x verified + 2x log(1+reuse) + 1.5x endorsements + recency boost) orders lanes, themes, and Learn mode; the gold mark sits on the top decile by reuse.
- Learn mode selects two near lessons, two top unread, one from an untouched theme; Got it advances (and arrows move), the reflection prompt comes from the editable Settings list, `learn_session_completed` (25, once per day), `lesson_read_fully` (3, capped), `reflection_saved` (10) all record, and today's session resumes.
- Lesson and theme episodes are generated through the podcast pipeline with the single-lesson template and reused on later plays; Settings > Lessons holds the schedule, re-clustering (now + nightly), the Learn mode switch, and the prompts editor.

## HIG pass (apple-design-skill lens)

- Lane headers, theme cards, and the reader all expose `aria-expanded`; the search input is labelled; the session announces progress in text ("1 of 5") beside the dots.
- Category colour chips keep their text labels (colour is never the only channel); contrast follows the system palette.
- All expansion is height/opacity under 260ms and instant under reduced motion; nothing loops.
- RTL mirrors the editorial wash, the lanes, the browse tabs, and the session navigation keys.

Verdict: no generic item remains; no High or Critical HIG findings.
