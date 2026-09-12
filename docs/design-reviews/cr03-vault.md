# CR03 self-critique: Knowledge Vault

Screenshots: `data/screenshots/cr03/vault-en-1440.png`, `vault-en-1440-hover.png`, `vault-ar-1440.png`, `vault-en-390.png`, `vault-ar-390.png`, `vault-grid-en.png`, `vault-en-full.png`.

## Three sentences

The eye lands first on the row of maroon strategy volumes standing on the top plank, each with its cloth grain, headbands, gold rules, and gilt verification seal, which reads instantly as a library rather than a filter results page. Nothing on the screen still looks generic after the second pass: the earlier flat "1 pp." captions and the washed-out ink-400 counts were the two generic tells, and both were fixed (size-estimated page counts now give the shelves their width rhythm, and counts sit at ink-600). A Sia designer would be proud of the pull-off-the-shelf hover, where the book tips four degrees short of falling, its front cover recedes into the case in true perspective, and the shadow it drops on the plank deepens as it lifts.

## Notes against the anti-pattern list

- No equal rectangles: spine widths follow page count (40/52/64), heights alternate 216/184, the last book on each shelf leans.
- Shadows are shaped and warm (a blurred plank shadow under each book), not default Tailwind greys.
- No tables; the list view (unchanged by the CR) remains rows, not a table.
- Every book has hover and keyboard-focus states (the same pulled-out state), planks respond with arrows and fade masks.
- Empty planks on sparse shelves are deliberate: a bookcase keeps one width for every shelf, and free space reads as room for the library to grow.

## HIG pass (apple-design-skill lens)

- Contrast: spine text is paper white (#FBF9F5) on cloth colours at 7:1 or better; the sand cloth switches to dark ink text (CR 1.3); shelf-header eyebrows and counts use ink-600 (6.9:1). No High or Critical findings.
- Hit targets: whole spines are links at 40x184px minimum; header rows are full-width buttons with `aria-expanded`.
- Reduced motion: collapse animation drops to zero duration, the shimmer and hover transforms are suppressed by the global reduced-motion rule.
- RTL: shelves fill from the right, Arabic spine titles run rotated in the Arabic book-spine convention, the fore-edge page block and cover reveal mirror.
- The decorative year/NPC monogram marks are `aria-hidden`; the accessible name of a book is its title plus verification state.

Verdict: no generic item remains; no High or Critical HIG findings.
