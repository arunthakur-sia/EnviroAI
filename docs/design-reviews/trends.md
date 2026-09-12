# Design review: Trends and Signals (/trends)

Reviewed: 2026-09-12. Platform: web app (Next.js + Tailwind), desktop-first, bilingual EN/AR for Qatar's National Planning Council. Per the skill's scope rule, a web app gets the HIG principles and foundations (accessibility, color, typography, layout, writing) plus pattern pages, not Apple's platform component conventions.

Artifacts reviewed: screenshots `data/screenshots/cr01/trends-en.png`, `trends-ar.png`, `signal-en.png`; source `src/app/[locale]/(app)/trends/page.tsx`, `TrendsToolbar.tsx`, `RadarStrip.tsx`, `src/components/nexus/SignalCard.tsx`; tokens `src/styles/globals.css`; shared primitives `src/components/ui/primitives.tsx` (chip and button styles) and `src/lib/format.ts` (date logic) read to make contrast and localization findings exact.

Limits of what could be verified: contrast is computed from token hex values, not sampled from PNGs. Rendered sizes are taken from Tailwind classes, treating CSS px as pt equivalents at 1x. No Arabic screenshot of the signal detail page was provided, so its RTL behavior is unverified. No card in a screenshot shows the "new" triage state, so the Accept / Dismiss / Convert strip is reviewed from code only. This skill copy has no `lists-and-tables.md`, so list-specific points below are labeled as judgment.

### Summary

The thesis is a national scanning desk on paper: a warm sand ground, white signal cards, Qatar maroon as the accent, and a gold "why it matters" strip that ties every headline back to NDS3. That strip is the thing the page will be remembered by, and the bilingual execution underneath (logical properties, per-script type scales, correct Arabic dates) is unusually thorough for a prototype. But the page's quiet-metadata habit crosses the legibility line: nearly every small gray element (dates, confidence figures, chip tones, zero counts) computes below the required contrast ratio, and the three analytics sections are buried under as many as sixty cards. Overall rating: **Critical issues**, driven entirely by fixable color arithmetic; the structure and craft underneath are Good.

### Critical

- **[Critical] ink-400 metadata text fails contrast on every surface it appears on.**
  - **What**: `#928B93` on white computes to 3.31:1 and on sand-50 `#FBF9F5` to 3.15:1, below the 4.5:1 required for small regular-weight text. Instances on this page: signal card dates and the "Confidence 85%" row at 11px regular (`SignalCard.tsx` lines 107, 180-187), the last-scan note at 12px (`page.tsx` line 77), the "last 30 days" caption at 10px (`RadarStrip.tsx` line 61), zero counts and "-" placeholders in the index table at 11px (`page.tsx` lines 160, 172). The detail page's section labels (ACTIONS, HISTORY, DETAILS, COMMENTS) are the same token at 12px semibold; semibold at 3.31:1 scrapes past the skill's 3:1 bold allowance but fails strict WCAG AA, since 12px is not large text.
  - **Why**: `accessibility.md › Vision`: "Strive to meet color contrast minimum standards", with the table requiring 4.5:1 for text up to 17 pt at all weights.
  - **Fix**: keep ink-400 for disabled states only. Move all readable metadata to ink-600 `#5E5760` (6.98:1 on white, 6.64:1 on sand-50), or add an ink-500 around `#6E6770` (5.47:1 on white, 5.20:1 on sand-50) if a lighter tier is wanted. One token change in `globals.css` plus class swaps fixes every instance at once.

- **[Critical] Two chip tones fail contrast at 11px medium weight.**
  - **What**: chips render at `text-[11px] font-medium` (`primitives.tsx` line 118). Warn tone `#B7791F` on `#F9EFDD` computes to 3.19:1 (used for "Medium impact", the "Index" type, and "To verify"). Ok tone `#2E7D5B` on `#E3F1EA` computes to 4.29:1, just under 4.5:1, and it is the most frequent chip on the page because every triaged card wears "Accepted". The ghost tone (dismissed status) is ink-400 on white, 3.31:1. Passing tones for reference: danger 5.40:1, gulf 5.13:1, info 5.48:1, sand 6.14:1, maroon 11.53:1, gold 12.13:1.
  - **Why**: `accessibility.md › Vision` contrast table: 11px medium is small text and needs 4.5:1; medium (500) is not bold, so the 3:1 bold row does not apply.
  - **Fix**: darken the two text tokens and retire ghost-on-white for statuses: warn text to about `#8F5D14` (4.92:1 on warn-light), ok text to about `#276A4E` (5.54:1 on ok-light), dismissed chips to sand tone (ink-600 on sand-100, 6.14:1).

- **[Critical] Zero counts in the radar strip are nearly invisible.**
  - **What**: when an outcome has no signals, the count renders in ink-200 `#D8D4D9` at 24px semibold (`RadarStrip.tsx` lines 51-57). That computes to 1.46:1 on white, below even the 3:1 floor for large bold text. The numeral is data (this outcome produced nothing in 30 days), which for an environment-scanning tool is itself a finding worth reading.
  - **Why**: `accessibility.md › Vision` contrast table: 3:1 minimum for 18 pt or larger text. 1.46:1 fails every tier.
  - **Fix**: keep the de-emphasis but get it from weight, not invisibility: render 0 in ink-600 at regular weight, or replace it with a short "No signals" line in ink-600.

### Improvements

- **[High] Nothing on screen responds while the page or a filter loads.**
  - **What**: the route is `force-dynamic` and awaits seven queries before rendering (`page.tsx` lines 27, 42-63), yet there is no `loading.tsx` anywhere under the `(app)` group. Filter changes call `router.push` (`TrendsToolbar.tsx` lines 38-43) with no pending indication, so after choosing a filter the page appears frozen until the server responds. The design system already ships `.skeleton` shimmer styles (`globals.css` lines 197-207) and `Skeleton` / `ShelfSkeleton` components; this page just never uses them.
  - **Why**: `loading.md › Best practices`: "Show something as soon as possible." Also "Let people do other things in your app or game while they wait for content to load."
  - **Fix**: add `src/app/[locale]/(app)/trends/loading.tsx` with card-shaped skeletons for the toolbar and stream; wrap `setParam` in `useTransition` and dim the stream (opacity plus `aria-busy`) while `isPending`.

- **[High] The radar strip, risk heat map, and index tracker are buried below up to 60 cards.**
  - **What**: sections 2 to 4 render after the full signal stream (`page.tsx` lines 90-183), which at roughly 250px per card in two columns puts them 7,000px or more below the fold. Neither screenshot shows the radar strip at all. The component is named RadarStrip and costs about 150px of height; it is designed as an overview, then filed as an appendix.
  - **Why**: `layout.md › Best practices`: "Make essential information easy to find by giving it sufficient space." The trade-off is real: triage is the daily job, so stream-first is defensible. But the strip is cheap, and its seven outcome counts double as orientation before triage. Judgment on the resolution.
  - **Fix**: move `RadarStrip` between the toolbar and the stream, and cap the initial stream at 20 with a "Show more" control so the heat map and index tracker come back within reach; alternatively split the four sections into tabs (Stream / Radar / Risks / Indexes).

- **[Medium] The masonry columns scramble chronological order.**
  - **What**: the stream uses CSS `columns-2` (`page.tsx` line 99), which fills the first column with the newest half and the second column with the older half. The EN screenshot shows it: left column Sep 7, Sep 4, Sep 2; right column Jul 16, Jul 13, Jul 10. A reader scanning the top row sees a September card next to a July card and has no way to know the right column continues from the bottom of the left.
  - **Why**: `layout.md › Visual hierarchy`: "People often start by viewing items in reading order", top to bottom and leading to trailing. For a time-ordered stream, judgment says row order must match sort order.
  - **Fix**: switch to `grid md:grid-cols-2` so cards fill row by row (newest four occupy the top two rows), or distribute cards to columns alternately in JS if the masonry heights are worth keeping.

- **[Medium] One color carries several meanings.**
  - **What**: gulf teal is the "Market" type chip, the "Converted" status chip, the radar source icon, signal-count links in the index table, and "Positive for Qatar" sentiment. A market signal that gets converted wears two identical teal chips meaning category and state. Danger red is both the "High impact" rating and the "Geopolitical" type, so a high-impact geopolitical card shows two red chips saying different things (`SignalCard.tsx` lines 33-48).
  - **Why**: `color.md › Best practices`: "Avoid using the same color to mean different things."
  - **Fix**: reserve tonal chips for judgment (impact, triage status, sentiment) and give the eight type chips one neutral treatment, for example sand tone or an outlined chip with a small per-type dot.

- **[Medium] Raw system identifiers appear as user-facing labels.**
  - **What**: NDS3 link chips render `l.code` verbatim: "gdp_real_growth", "trade_balance", "solar_capacity", and bare "O1" / "O6" (`SignalCard.tsx` line 174). The snake_case reads as developer vocabulary in the EN interface and as untranslated foreign strings inside Arabic sentences in the AR screenshot.
  - **Why**: `writing.md › Getting started`: "Choose simple, plain language and write with accessibility and localization in mind, avoiding jargon and gendered terminology."
  - **Fix**: display the localized indicator title (already available as `titleEn` / `titleAr`, truncated) with the code relegated to a tooltip, and expand outcome chips to "O1 · Economic growth" or the Arabic equivalent.

- **[Medium] The empty stream offers no next step.**
  - **What**: when filters return nothing, `EmptyState` renders icon, title, and hint only; the component supports an `action` prop that the page never passes (`page.tsx` lines 92-97, `primitives.tsx` lines 210-236).
  - **Why**: `writing.md › Best practices`: "Provide clear next steps on any blank screens." "Guide people on actions they can take, and give them a button or link to do so if possible."
  - **Fix**: pass an action: "Clear filters" when filters are active, "Scan now" (for users with scan permission) when the stream is genuinely empty.

- **[Medium] The sparklines have no non-visual equivalent.**
  - **What**: each radar sparkline is `aria-hidden` with no label (`RadarStrip.tsx` line 28), and the trend it shows (rising or falling scanning volume) exists nowhere in text. The adjacent count and "last 30 days" caption give the total but not the direction.
  - **Why**: `charting-data.md › Best practices`: "Make every chart in your app accessible." Also `accessibility.md › Vision`: "Convey information with more than color alone."
  - **Fix**: add an `aria-label` such as "12 signals in the last 30 days, rising" to the card or an sr-only sentence, computed from the first and last thirds of the `daily` array.

- **[Medium] Micro-type sits at or below the desktop floor.**
  - **What**: "last 30 days" is 10px uppercase with wide tracking (`RadarStrip.tsx` line 61), at the macOS minimum with legibility further reduced by all-caps and letterspacing; 11px is the default size for all chips, card metadata, and the radar's top-signal links. Body text is fine (15px EN, 15.9px AR).
  - **Why**: `typography.md › Ensuring legibility`: desktop minimum 10 pt, default 13 pt. Judgment on how px maps to pt, stated above.
  - **Fix**: lift the caption to 11px and consider 12px as the metadata floor once the contrast fixes land; chips can stay at 11px given their medium weight and short strings.

- **[Low] The toolbar wraps differently per locale and per select width.** In EN the actions wrap to a second row; in AR everything fits on one line, and select widths are ragged (Outcome is roughly twice the width of Type). Judgment: give the selects a shared min-width scale and let the action pair break deliberately rather than incidentally.
- **[Low] The disabled Post button reads as an enabled tinted button.** The 50 percent opacity primary composites to about `#C58A9C` with white text at 2.80:1 (`signal-en.png`; `primitives.tsx` line 11). Disabled controls are exempt from contrast rules, but this one looks clickable. Judgment: use a hollow disabled style (sand border, ink-400 label), or keep Post enabled and validate on submit.
- **[Low] Directional icons do not flip in RTL.** `ArrowUpRight` on Convert and `ExternalLink` on the source link ship unflipped (`SignalCard.tsx` lines 188-197, 210-213) even though a `.flip-rtl` utility exists in `globals.css`. `right-to-left.md › Interface icons`: "Flip an interface icon that shows forward or backward motion." External-link glyphs are often left alone by convention; the Convert arrow is the one to fix.
- **[Low] The 40-character minimum in the paste dialog is enforced silently.** The submit button stays disabled with no explanation (`TrendsToolbar.tsx` lines 61, 166). `writing.md › Best practices`: "Show hints in text fields." Add a helper line under the textarea ("Paste a link or at least a paragraph of text").
- **[Low] The stream caps at 60 with no count or continuation cue.** `listSignals` takes `limit: 60` (`page.tsx` line 53) and the UI never says whether more exist. Judgment: show "Showing 60 of N" with a load-more control, which also serves the High finding above.

### Craft notes

The page has a real point of view: a national scanning desk rendered as paper and ink, with Qatar's flag maroon `#8A1538` doing the accent work, desert sand as the ground, gulf teal and gold in support, Fraunces for EN display and Noto Kufi for AR headings. The signature element is the gold "why it matters" strip on every card (maroon-900 on the gold-100 blend, 12.78:1), which encodes the product's whole reason to exist: raw news on top, national relevance highlighted beneath. Structure encodes information honestly, and the numeric discipline (`tnum` everywhere numbers align) is the kind of detail most prototypes skip.

- **[Low] The palette sits one step from a known template.** Warm cream plus a high-contrast serif plus a red-brown accent is one of the three looks the craft lens flags as generated-interface defaults. Here it survives because every choice is rooted in the subject (flag maroon, desert sand, gulf teal, Kufi script), but the margin is thin. Judgment: protect the distance by keeping the gold strip and the Arabic typography prominent, and resist adding more serif display moments.
- **[Low] Remove one accessory: the URL tooltip on card titles.** The title link navigates internally to `/trends/[id]`, yet hovering it shows the external URL (`SignalCard.tsx` lines 127-135), a mixed signal about where the click goes. The "Source" link at the card foot already owns the external destination. Judgment: drop the Tip wrapper.

### What works

Keep these through the next iteration:

- **RTL as a first-class citizen**: logical properties throughout (`ms-auto`, `text-start` / `text-end`), a mirrored layout verified in `trends-ar.png`, `Intl` dates via `ar-QA` rendering day-month-year correctly with Latin numerals, `dir="ltr"` pinning on the URL input, and a separate Arabic type scale (6 percent larger, 1.7 line height) with IBM Plex Sans Arabic body and Kufi headings.
- **Motion discipline**: one entrance reveal per page, a subtle card hover lift, and a global `prefers-reduced-motion` kill switch that zeroes both animations and transitions (`globals.css` lines 229-232).
- **Keyboard and focus**: a consistent 2px maroon `:focus-visible` ring with offset, native selects with `aria-label`s, and every card action reachable as a real button or link.
- **Interaction feedback in the interface, not in alerts**: optimistic triage status on the card, a spinner inside "Scan now", distinct toasts for queued vs. completed scans and for the specific `fetch_failed` error, and points feedback on accept.
- **The wide table pattern**: the index tracker scrolls inside its own `overflow-x-auto` card with `min-w-[760px]`, so the page body never scrolls horizontally.
- **Writing voice**: sentence-case controls applied consistently ("Add signal", "Scan now", "Brief me"), verb-first labels, and empty states written as invitations ("No comments yet. Start the discussion.").

### Platform notes

- This is a web app, so Apple's component conventions (tab bars, menu bar, sheets) were not applied; the review used the HIG foundations, `loading.md`, `charting-data.md`, and `right-to-left.md` as design principles, per the skill's scope rule for non-Apple platforms.
- Desktop-first holds up: control heights are 32-38px against a 28px desktop default, hover states exist on every interactive element, and the Ctrl+K affordance is visible in the search field. Worth checking beyond this review: the seven-column radar grid below 1280px collapses to four then two columns, which is fine, but the seven filter selects plus two actions deserve a pass at laptop widths.
- The sparkline is deliberately pinned `direction: ltr` in RTL. `right-to-left.md › Controls` says to flip controls that show progress, but time-series axes are conventionally kept left-to-right in Arabic data displays; the explicit pin shows intent. Acceptable as is; worth confirming with Arabic-speaking users.
- Unverified for lack of artifacts: the Arabic signal detail page (including whether the back arrow flips), the triage strip in its rendered state, and dialog and dropdown styling from `overlays.tsx`.

Finding counts: 3 Critical, 2 High, 6 Medium, 7 Low.
