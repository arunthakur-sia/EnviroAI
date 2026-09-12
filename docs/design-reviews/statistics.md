# Design review: Statistics and Indicators (SiaNexus)

Reviewed: `src/app/[locale]/(app)/statistics/page.tsx`, `src/components/nexus/IndicatorTile.tsx`,
`src/components/nexus/IndicatorChart.tsx`, shared primitives and motion components they use,
design tokens in `src/styles/globals.css`, and the screenshots `data/screenshots/statistics-en.png`
and `statistics-ar.png` (1440x900 CSS px). Desktop-first bilingual web app, so HIG foundations
apply as principles; Apple platform conventions are noted where they do not apply. Contrast ratios
below are computed (WCAG relative luminance) from the token hex values, not sampled from the PNGs.
CSS px are treated as equivalent to HIG pt for desktop sizes. One limit: the skill's loading table
lists `charts.md`, but that file is not present in this skill's reference bundle; chart findings
cite `charting-data.md`, which is.

### Summary

The page has a real thesis: a national statistical ledger in paper and ink. Warm sand ground,
white cards, serif tabular numerals in Fraunces for the data voice, Qatar-flag maroon for every
trend line, one choreographed entrance and then calm. The thing it will be remembered by is the
headline strip: eight KPI tiles where a large serif figure, a delta, and a maroon sparkline read
as one sentence. The structure is right and the RTL execution is unusually careful. What holds it
back is small-text color: nearly every piece of metadata on the page is set in `ink-400` or the
warn chip pair, and both fall well below the 4.5:1 minimum, and the good/bad meaning of every
delta is carried by a red-green pair alone. Overall rating: **Critical issues**. The fixes are
narrow (two text colors and one labeling pattern); the design itself does not need to change.

### Critical

- **[Critical] Metadata text in `ink-400` fails contrast everywhere it appears.**
  **What**: `ink-400` #928B93 measures 3.31:1 on white cards and 3.15:1 on the sand-50 #FBF9F5
  page ground. It is used at 11px for the tile meta row (`text-[11px] text-ink-400`,
  IndicatorTile.tsx line 59), at 12px for the catalog frequency and year columns and the category
  count (`text-xs text-ink-400`, page.tsx lines 72, 84, 88), at 14px for the empty release
  calendar message (page.tsx line 104), and at 11px for both chart axes in IndicatorChart.tsx
  (lines 61 and 68; those axes render on the indicator detail views, but the component was in
  scope for this review). All of these are regular or medium weight below 18pt, so the minimum is
  4.5:1.
  **Why**: `accessibility.md › Vision`: "it's important that there's enough contrast between
  foreground text and icons and background colors", with the WCAG AA table: up to 17pt needs
  4.5:1.
  **Fix**: Use `text-ink-600` (#5E5760, 6.98:1 on white, 6.64:1 on sand-50) for all metadata text
  and chart ticks, and reserve `ink-400` for disabled states and decorative marks. If a lighter
  tier is wanted, add a token around #6F6871 and verify it clears 4.5:1 on both surfaces.

- **[Critical] The Illustrative chip fails contrast on every tile.**
  **What**: `Chip tone="warn"` sets `warn` #B7791F text on `warn-light` #F9EFDD at 11px medium
  (primitives.tsx line 128). That pair measures 3.19:1; the minimum at this size is 4.5:1. The
  chip appears eight times in the headline strip, so the one honest disclosure on the page is the
  hardest text to read.
  **Why**: `accessibility.md › Vision`, same WCAG AA table as above.
  **Fix**: Darken the warn text token for text-on-warn-light use, for example #7A5014 on the same
  background, 6.17:1. This also lifts every other `tone="warn"` chip in the app.

- **[Critical] Gold target line and label are below both text and graphic minimums.**
  **What**: In IndicatorChart.tsx (lines 84 to 90), the target `ReferenceLine` and its 11px label
  use `gold-500` #C9A24D on the white card: 2.40:1. The label needs 4.5:1 as small text; even as
  a non-text graphic the dashed line needs 3:1. Scope note: this renders on the indicator detail
  views, not on the statistics index itself, but the component was named in scope.
  **Why**: `accessibility.md › Vision`: "it's important that there's enough contrast between
  foreground text and icons and background colors". `charting-data.md › Best practices`: "Make
  every chart in your app accessible."
  **Fix**: Use a darker gold for both, for example #8A6D24 (4.89:1 on white), keeping `gold-500`
  for larger fills where 3:1 suffices.

- **[Critical] Whether a delta is good or bad is conveyed by color alone, and its direction is
  lost to screen readers.**
  **What**: IndicatorTile.tsx lines 60 to 69: the delta glyph is the same arrow shape for good and
  bad; only `text-ok` #2E7D5B versus `text-danger` #B3261E distinguishes "improvement" from
  "deterioration" (an up arrow on Non-Hydrocarbon Share is good, the same up arrow on CPI
  Inflation is bad). That is precisely the red-green pair colorblind users struggle with. The
  contrast of each color is fine (5.00:1 and 6.54:1 on white); the problem is the encoding. It
  compounds for assistive tech: the rendered text is `formatNumber(Math.abs(delta))`, so a screen
  reader hears "0.5" with no sign, no direction, and no valence, and the Lucide arrow SVG carries
  no label.
  **Why**: `accessibility.md › Vision`: "people who are color blind may have particular difficulty
  with pairings such as red-green and blue-orange" and "Offer visual indicators, like distinct
  shapes or icons, in addition to color".
  **Fix**: Add a non-color cue and an accessible name. For example render the signed value
  ("+0.5" / "-0.5") instead of the absolute value, and put an `aria-label` on the delta span such
  as "down 0.5 since Q1 2026, improving", built from existing translations. A filled versus
  outlined marker for good versus bad would also work as the visual double.

### Improvements

- **[High] Units are untranslated on the Arabic page.**
  **What**: The Arabic screenshot shows "percent", "persons", "QAR billion", and "permits" in
  Latin script inside otherwise Arabic tiles. The data model carries one `unit` string
  (statistics service exposes `unit: ind.unit`), while names are bilingual (`nameEn` / `nameAr`,
  rendered through `bi()`). For an official State statistics page, English units inside Arabic
  sentences read as unfinished.
  **Why**: `writing.md › Getting started`: "Choose simple, plain language and write with
  accessibility and localization in mind".
  **Fix**: Split the field into `unitEn` / `unitAr` (matching the existing name pattern) and
  render with `bi(locale, ...)` in IndicatorTile and the chart tooltip.

- **[Medium] Three numeral systems mix on the Arabic page.**
  **What**: Values use Latin digits ("55.3", via `formatNumber`, which defaults to `-u-nu-latn`),
  monthly periods come out in Eastern Arabic digits (the screenshot shows Aug 2026 as Arabic-Indic
  year digits, because `formatPeriod` in `src/lib/format.ts` builds `ar-QA` without a numeral
  override), and quarterly periods use Latin digits again (the template string on line 66). One
  tile can carry two systems at once.
  **Why**: judgment, supported by `writing.md › Build language patterns`: "Consistency builds
  familiarity, helping your app feel cohesive, intuitive, and thoughtfully designed."
  **Fix**: Pass the same numeral preference `formatNumber` uses into `formatPeriod` and
  `formatDate` so one setting governs every digit on the page.

- **[Medium] The value and its unit collide in RTL.**
  **What**: The English tile reads "1.9 percent" with a space; the Arabic tile reads
  "1.6percent". The unit span's `ms-1` (IndicatorTile.tsx line 55) becomes a right margin in RTL,
  but the Latin number and Latin unit form a single LTR run inside the RTL paragraph, so the
  margin lands on the wrong side of the run. Verified in both screenshots.
  **Why**: judgment (bidi layout craft); the principle is `layout.md › Visual hierarchy`: "Align
  components with one another to make them easier to scan and to communicate organization and
  hierarchy."
  **Fix**: Wrap number plus unit in one bidi-isolated span (`<bdi>` or `unicode-bidi: isolate`
  with `dir="ltr"`) and put the gap inside it, or place the unit with a normal space character
  rather than a margin.

- **[Medium] One appearance, and no answer for increased contrast.**
  **What**: `globals.css` declares `color-scheme: light` only; no dark variants exist for any
  token, and there is no `prefers-contrast` handling. Card edges rely on a 1.39:1 border
  (sand-300 on white) and a 1.05:1 surface difference (white card on sand-50) plus shadow, which
  is fine as a default aesthetic but has no stronger fallback.
  **Why**: `color.md › Best practices`: "If you define a custom color, make sure to supply light
  and dark variants, and an increased contrast option for each variant". The Liquid Glass clause
  there is Apple-specific; the portable principle is defining both modes per token.
  **Fix**: For the prototype stage, at minimum add a `prefers-contrast: more` block that swaps
  ink-400-tier text to ink-600/ink-900 and strengthens card borders; plan dark values per token
  rather than per page.

- **[Medium] Key data text is locked to px and ignores the reader's font-size preference.**
  **What**: The KPI value is `text-[26px]`, the tile meta row `text-[11px]`, chart ticks and
  labels 11px via inline props, and the sparkline is a fixed 96x30 box. Browser page zoom scales
  everything (so WCAG 200 percent resize is met), but a user who raises their default font size
  instead of zooming gets larger body text next to unchanged tiles.
  **Why**: `accessibility.md › Vision`: "Make sure people can adjust the size of your text or
  icons to make them more legible, visible, and comfortable to read." Desktop minimums (10pt) are
  respected; this is about scalability, not size.
  **Fix**: Express these sizes in rem (26px = 1.625rem, 11px = 0.6875rem) so they track the root
  size the way `text-xs`/`text-sm` already do.

- **[Medium] Sparklines normalize min-to-max, so noise reads as signal.**
  **What**: `Sparkline` (IndicatorChart.tsx lines 160 to 168) stretches every series across the
  full 30px height regardless of amplitude. Unemployment moving 0.02 around 0.18 percent draws
  the same dramatic mountain range as GDP growth; a perfectly flat series would draw a line at
  the bottom edge (`range || 1`). Eight tiles styled identically invite comparison the scaling
  does not support.
  **Why**: judgment, supported by `charting-data.md › Best practices`: charts should be "clearly
  communicating what people can learn from the data they care about", and small charts exist "to
  offer glanceable information about an individual item".
  **Fix**: Either pad the domain (for example, never let the drawn range be narrower than a set
  fraction of the latest value) so quiet series look quiet, or accept per-tile shape-only
  reading and say so in a caption. Handle the flat-series case explicitly (centered line).

- **[Low] Catalog category names are paragraphs, not headings.**
  **What**: Page structure is h1 (title), h2 (SectionTitle for "Indicator catalog" and "Release
  calendar"), but each category ("Education", "Environment") is a `<p>` (page.tsx line 70), so
  screen reader users cannot jump between categories in a long catalog.
  **Why**: judgment (semantic structure; the principle behind `accessibility.md`'s adaptable
  interface).
  **Fix**: Make categories `<h3>` with the current styling.

- **[Low] Truncated indicator names have no way to reveal the full text.**
  **What**: Catalog rows use `truncate` (page.tsx line 81) and tile titles `line-clamp-1`
  (IndicatorTile.tsx line 38) with no `title` attribute or tooltip; long official indicator names
  (visible in the Arabic catalog) can clip with no recourse other than opening the detail page.
  **Why**: judgment; the detail page does show the full name, so this is friction, not loss.
  **Fix**: Add `title={name}` to truncated spans.

- **[Low] Stale brand name in the search placeholder.**
  **What**: The shared shell visible in the screenshot still reads "Search NEXUS: documents,
  numbers, people, answers" after the rename to SiaNexus. Shell scope, not this page's code;
  flagged because the screenshot ships it with this screen.
  **Why**: judgment (brand consistency).
  **Fix**: Update the placeholder string in the shell's translations.

### Craft notes

The point of view is real and rooted: maroon is Qatar's flag color, the gulf teal and gold read
as regional accents rather than decoration, and the serif tabular numeral as the voice of
official data is a genuine signature. It must be said that warm cream plus a high-contrast serif
is also one of the template looks this skill warns about; what keeps this page on the right side
of that line is that the palette is doing semantic work (maroon = the State's data, gulf =
schedule and comparison, gold = targets) and the structure encodes information honestly: the
catalog counts are true counts, the timeline is a real timeline, and nothing is numbered for
effect. Boldness is spent in exactly one place, the KPI strip, and everything after it is quiet.
That is the right distribution.

- **[Low] Remove one accessory: the eight repeated Illustrative chips.**
  **What**: Every headline tile carries the same warn chip. The disclosure matters (and is a
  credit to the design's honesty), but repeated eight times it becomes texture and competes with
  the deltas.
  **Why**: judgment, from the skill's restraint rule and `charting-data.md › Best practices`:
  "Keep a chart simple, letting people choose when they want additional details."
  **Fix**: One caption line under the strip ("Headline figures are illustrative pending NSC
  connection"), keeping per-tile chips only when tiles genuinely differ in status. This also
  removes eight instances of the failing chip contrast.

### What works

Keep these; they are the page's spine.

- The headline tile grammar: name, large Fraunces tabular figure (26px semibold, ink-900, 17.05:1
  on white), delta, period, sparkline. One glance per indicator, consistent across all eight, as
  `charting-data.md › Maintain continuity` asks.
- Whole-tile link targets with the `card-hover` lift, catalog rows at roughly 41px height with a
  maroon-50 hover, and buttons at 38px: everything comfortably clears the 28px desktop default
  control size, and every interactive element has pointer feedback.
- Focus is designed, not defaulted: a global 2px maroon `:focus-visible` outline with offset, so
  keyboard paths through tiles, rows, and buttons are visible.
- Motion discipline: one 320ms entrance with a 40ms stagger, then calm; reduced motion is
  respected in three layers (the CSS kill switch, `useReducedMotion` in Reveal/Stagger, and
  CountUp snapping to the final value). The sparkline is `aria-hidden` while the same information
  survives as text.
- RTL is done with logical properties (`ms`, `ps`, `border-s`, `-start-`), and the Arabic
  screenshot confirms a genuinely mirrored layout, an Arabic type scale 6 percent larger with 1.7
  line height, and dedicated faces (IBM Plex Sans Arabic body, Noto Kufi headings). Charts and
  sparklines are pinned `dir="ltr"` so time axes never flip; a defensible, consistently applied
  choice.
- Color used semantically and legibly at the macro level: primary button white on maroon-700 at
  9.35:1, release calendar dates gulf-600 on sand-50 at 5.69:1, sparkline maroon-500 at 6.42:1
  (well above the 3:1 graphic minimum), body ink-900 at 16.21:1 on the page ground.
- The writing: "The official numbers of the State, from the National Statistics Center" says
  exactly what the screen is; "Releases" and "Import data" are verbs-first and unambiguous; the
  Illustrative disclosure is honest about prototype data.

### Platform notes

- This is a desktop-first web app (Next.js + Tailwind, browser-hosted). Apple platform
  conventions that do not apply and were not held against the design: menu bar command coverage,
  native window controls and settings placement, tab bars and sheets, Liquid Glass materials,
  Dynamic Type APIs, and SF system typefaces. Their portable principles (keyboard reachability,
  text scalability, semantic color, restrained materials) were applied instead.
- Desktop expectations that do apply and are met: hover states everywhere, a visible keyboard
  focus ring, a keyboard accelerator surfaced in the UI (Ctrl+K in the search field), and no
  critical controls pinned to the window bottom.
- Sizes were read from code (Tailwind scale: text-xs 12px, text-sm 14px, custom 11px and 26px;
  body 15px, Arabic 15.9px) and screenshots were used for layout, hierarchy, and copy only.
  Nothing here was estimated from image pixels.
- The `statistics/page.tsx` route imports no files from its own folder; its rendering depends on
  `IndicatorTile`, `Sparkline`/`IndicatorChart`, `primitives.tsx`, and `motion/index.tsx`, all of
  which were read. The import, releases, and detail sub-pages were out of scope.
