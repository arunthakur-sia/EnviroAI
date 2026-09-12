# Design review: Expert Network (experts page)

Reviewed: `src/app/[locale]/(app)/experts/page.tsx`, `ExpertsToolbar.tsx`, `src/components/nexus/ExpertCard.tsx`, shared primitives in `src/components/ui/primitives.tsx`, tokens in `src/styles/globals.css`, screenshot `data/screenshots/experts-en.png` (EN only). Desktop-first bilingual web app (Next.js + Tailwind), so Apple's foundations are applied as principles, not platform law. HIG point values are read as CSS pixels. All contrast ratios below are computed from the token hex values, not sampled from the PNG.

## Summary

The page's thesis is clear and served: help NPC staff find the right person fast, through a semantic search whose conversational placeholder ("Try: who knows census methodology") is a promise the backend actually keeps. The paper-and-ink world (sand ground, white cards, Qatar maroon) is coherent, the voice is human, and the RTL and motion foundations are unusually disciplined for a prototype. What holds it back is accessibility at the metadata layer: the ink-400 text that carries availability, organisations, and counts fails contrast on every surface it sits on, and the verified badge is invisible to screen readers. Overall rating: **Critical issues**.

## Critical

### [Critical] Metadata text in ink-400 fails contrast on both surfaces

- **What**: `--color-ink-400` #928B93 measures 3.31:1 on white cards and 3.15:1 on the sand-50 #FBF9F5 page, below the 4.5:1 minimum for text under 18 px. It carries real content: the 11 px card footer (availability label, "{n} engagements", "{n} endorsements") and the 12 px organisation suffix in `ExpertCard.tsx` (lines 27 to 63), the search placeholder and icon in `ExpertsToolbar.tsx` (line 38) via `placeholder:text-ink-400` in `primitives.tsx`, and the empty-state icon.
- **Why**: `accessibility.md › Vision`: "Strive to meet color contrast minimum standards", with the WCAG AA table requiring 4.5:1 for text up to 17 pt at all weights.
- **Fix**: either promote this content to ink-600 #5E5760 (6.98:1 on white, 6.64:1 on sand-50) and reserve ink-400 for decorative strokes, or darken the token itself: about #767077 keeps the plum cast and clears the bar on both surfaces (4.82:1 on white, 4.59:1 on sand-50). The token fix repairs every usage at once, including the placeholder.

### [Critical] Verified status has no text alternative

- **What**: the `BadgeCheck` icon (`ExpertCard.tsx` line 25) is the only carrier of "verified". Lucide renders an unlabeled `<svg>`, so a screen reader user never learns which experts are verified. The availability status on the same card is done right (dot plus visible text); this indicator is icon-only.
- **Why**: `accessibility.md › Vision`: "Describe your app's interface and content for VoiceOver."
- **Fix**: `<BadgeCheck role="img" aria-label={t("verified")} />` with a new `verified` key in `messages/en.json` and `messages/ar.json`, or a visually hidden `<span>` beside the icon.

## Improvements

### [High] Gold avatar initials at 2.40:1

- **What**: white semibold initials (46 x 0.38, about 17.5 px) on gold-500 #C9A24D reach 2.40:1, below even the 3:1 line the HIG allows for bold text. Visible on the Maha Al-Matwi, Priya Nair, and Ahmed Fathy cards in the screenshot.
- **Why**: `accessibility.md › Vision` contrast table: bold text at any size needs 3:1. The avatar is `aria-hidden` and the name sits beside it, so a strict WCAG reading could call the initials decorative (judgment), but low-vision users still see illegible letters on every gold avatar.
- **Fix**: dark initials on the gold background only: ink-900 #1E1B1F gives 7.11:1, maroon-900 #5A0E24 gives 5.75:1. Add a per-color foreground next to `AVATAR_BG` in `primitives.tsx`. White stays correct on maroon-700 (9.35:1) and gulf-600 (5.98:1).

### [Medium] The card link's accessible name is the entire card

- **What**: each `ExpertCard` is one `<Link>` wrapping all its text, so the accessible name becomes name, position, organisation, match reason, four chips, availability, and two counts, roughly 25 words, repeated 70 times in a list a screen reader user must arrow through.
- **Why**: judgment; link purpose survives, but scanning by name becomes slow and noisy.
- **Fix**: `aria-label={bi(locale, expert.nameEn, expert.nameAr)}` on the Link (optionally name plus position), leaving the visual card untouched.

### [Medium] The search field is missing its standard anatomy

- **What**: the experts search is `<input>` with default `type="text"`: no Clear button, and its accessible name comes only from the placeholder, which disappears the moment someone types.
- **Why**: `search-fields.md` (intro): "A search field is an editable text field that displays a Search icon, a Clear button, and placeholder text where people can enter what they are searching for."
- **Fix**: `type="search"` (restores the native clear affordance in Chromium and WebKit) plus `aria-label={t("searchPlaceholder")}` or a visually hidden label on the `Input` in `ExpertsToolbar.tsx`.

### [Medium] Search runs only on Enter

- **What**: results update on form submit; nothing happens while typing, and there is no visible submit button to hint that Enter is required.
- **Why**: `search-fields.md › Best practices`: "If possible, start search immediately when a person types."
- **Fix**: debounce about 300 ms and run the cheap LIKE path (`listExperts` already has one) while typing, keeping semantic retrieval for pause or Enter. Trade-off, named: semantic retrieval per keystroke would be slow and costly; the two-tier approach keeps the responsiveness without the bill.

### [Medium] Button nested inside a link

- **What**: "Add external expert" renders `<a><button>` (`page.tsx` lines 47 to 51): invalid interactive nesting, two tab stops for one action, and ambiguous semantics for assistive tech.
- **Why**: judgment (HTML semantics; no HIG page covers this construct).
- **Fix**: apply the button classes to the `Link` itself (export `buttonVariants` for reuse), or add an `asChild` pattern to `Button`.

### [Medium] The empty state promises an action it does not offer

- **What**: "No experts match" with hint "Loosen the filters, or add the expert you have in mind", but no control does either; `EmptyState` already accepts an `action` prop the page never passes.
- **Why**: `writing.md › Best practices`: "guide people on actions they can take, and give them a button or link to do so if possible".
- **Fix**: pass `action` with a "Clear filters" link and, when `can(user, "create", "experts")`, an "Add external expert" button.

### [Medium] Card rows do not align

- **What**: cards in the same grid row end at different heights (third row of the screenshot: the Rajesh Kumar card runs about 24 px past its neighbours) even though the footer uses `mt-auto` to pin itself. Cause: `Stagger` wraps each card in a `motion.div` that becomes the grid item; its class `contents-none` is not a Tailwind utility and does nothing, and neither the wrapper nor the card `Link` has `h-full`, so the card never stretches to the row height.
- **Why**: `layout.md › Visual hierarchy`: "Align components with one another to make them easier to scan and to communicate organization and hierarchy."
- **Fix**: `h-full` on the `Stagger` item wrapper and on the card `Link` (`display: contents` is not an option here because the wrapper animates a transform).

### [Low] Hidden domains give no signal

- **What**: `domains.slice(0, 3)` silently drops any domain past the third; nothing tells the reader more exist.
- **Why**: `layout.md › Visual hierarchy`: "you need to indicate that there are additional items that aren't currently visible".
- **Fix**: a ghost chip reading "+{n}" when `expert.domains.length > 3`.

### [Low] Maroon carries two jobs

- **What**: the maroon family marks interactivity (primary button, focus ring, maroon-300 border on active filters) and also decorates noninteractive domain chips (maroon-100 ground, maroon-900 text, 11.53:1).
- **Why**: `color.md › Best practices`: "Avoid using the same color to mean different things." The values are far apart and the chips read as tags, so in practice it mostly works (judgment).
- **Fix**: if the chips ever become clickable domain filters, the tension resolves itself; otherwise consider sand or gulf tones for domain chips so maroon stays the interaction color.

## Craft notes

The page has a real point of view: a paper library for the state's institutional memory, sand ground, white cards, and Qatar maroon. That palette sits close to the warm-cream-serif-terracotta template that dominates generated interfaces, but it earns its place here: maroon-700 #8A1538 is the national flag maroon and the sand tones belong to the place, so the look escapes the template on reason, if narrowly. Fraunces is the most generic-editorial choice in the system; the identity would survive a swap, which is the test of an accessory (judgment). The signature element is the pairing of the conversational search prompt with the gulf-teal match-reason strip that answers "why this person": it is specific to this product, backed by a real semantic backend, and worth protecting through every iteration. Boldness is spent exactly once (the maroon button); everything else stays quiet, which is right. One density note: 11 px is the workhorse size for chips and footers, above the 10 px desktop floor but with no room below it.

- **[Low] Remove one accessory**: every expert visible in the screenshot wears the verified badge (14 of 14). A mark everyone carries distinguishes no one. Consider reserving it for external experts, or surfacing it only where verification is the exception; whichever way, Critical finding 2 still applies to the badges that remain. Judgment.

## What works

- **The availability dot never speaks alone**: `bg-ok`/`bg-warn`/`bg-danger` is always paired with a visible text label. `accessibility.md › Vision`: "Convey information with more than color alone."
- **The search promise is honest**: "Try: who knows census methodology" is exactly what the system can do; `listExperts` routes multi-word queries through semantic retrieval and shows a per-card match reason. Copy and capability agree. `search-fields.md › Best practices`: "Use placeholder text to help people know what they can search for."
- **Search architecture**: one global search in the shell, one local filter field placed directly above the grid it filters. `searching.md › Best practices`: "Aim to make your app's content searchable through a single location", with local search for distinct sections; placement matches `search-fields.md › Search as an inline field`.
- **RTL by construction**: `start-3`, `ps-9`, `ms-auto` throughout; no LTR-only offsets anywhere on this page, so the Arabic mirror needs no fork.
- **Motion discipline**: one 320 ms entrance with a 30 ms stagger, then calm; `useReducedMotion` in `Reveal`/`Stagger` plus the global reduced-motion CSS kill switch cover both the JS and CSS animation paths.
- **Keyboard path**: native form, input, selects, and links; the global maroon `:focus-visible` outline; 38 px control heights above the 28 px desktop default (`accessibility.md › Mobility`). The filter selects each carry an `aria-label`.
- **Filters live in the URL**: shareable, back-button friendly, and the subtitle count doubles as a live result count. Judgment.
- **Voice**: "70 experts who know what NPC needs to know", "Loosen the filters, or add the expert you have in mind": consistent sentence case, human, specific, no jargon (`writing.md › Best practices`).
- **Solid text hierarchy where it counts**: ink-900 names at 17.05:1, ink-600 positions at 6.98:1 on white, chip text at 11.53:1 (maroon) and 6.14:1 (sand), match reason at 5.47:1 on its tinted ground, button text at 9.35:1. Everything above the metadata layer passes with room.

## Platform notes

- Desktop web app: macOS conventions (menu bar, toolbars, windowing, settings placement) are out of scope; foundations were applied as principles. Hover states exist on cards (`card-hover` lift) and buttons, appropriate for pointer input.
- **[Low] Light-only appearance**: `color-scheme: light` and no dark variant for any token. `color.md › Best practices`: "Even if your app ships in a single appearance mode, provide both light and dark colors". A committed paper look is a defensible choice for a government tool (judgment), but the token layer should grow dark values before any dark context (embeds, print, OS-forced schemes) arrives.
- **Artifact limits, not findings**: there is no Arabic screenshot for this page, so RTL was judged from the source's logical properties only; the rendered Arabic type (Kufi headings, Plex Arabic body at +6 percent, line-height 1.7) is unverified. The EN screenshot predates the CR01 rename: the shell's global search still reads "Search NEXUS" while `messages/en.json` now reads "Search SiaNexus"; the shell is outside this review's scope. Contrast is computed from hex tokens, not estimated from the image.
