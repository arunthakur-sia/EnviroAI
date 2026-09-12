# Design review: Knowledge Vault

Reviewed: `src/app/[locale]/(app)/vault/page.tsx`, `VaultToolbar.tsx`, `DocListRow.tsx`, `src/components/nexus/Shelf.tsx`, shared primitives in `src/components/ui/primitives.tsx`, tokens in `src/styles/globals.css`; screenshots `vault-en.png`, `vault-ar.png`, `vault-mobile.png`, `collections-en.png` (context only). Contrast ratios computed from the hex tokens, not estimated from images. Rendered sizes derived from Tailwind classes; runtime keyboard and screen reader behavior inferred from source, not tested. Note on references: this skill installation does not include `lists-and-tables.md` or `collections.md`, so points in those areas are labeled as judgment.

### Summary

The page has a real thesis: a knowledge vault rendered literally as a library, documents as book spines color-coded by type, standing on tactile shelves, with a hover tilt and cover reveal. It is the one thing this product will be remembered by, and everything around it stays appropriately quiet. The bilingual execution is among the best I have reviewed: true logical properties, a mirrored AR layout, a distinct Kufi display face. The problems are almost entirely at the token level: a cluster of small-text contrast failures (spine labels on light type colors, ink-400 used as information text, the level 3 classification chip) that are fixable without touching the concept. Overall rating: **Critical issues**, with the caveat that the distance from here to Good is short and mostly mechanical.

### Critical

**1. Spine labels fail contrast on half the type palette.** [Critical]

- **What**: Spine titles are white, 11px, weight 500, on the twelve `TYPE_COLORS` in `Shelf.tsx`. Six fail the 4.5:1 minimum for small text, three of them below even 3:1: `template` white on sand-300 #E2DAC9 = 1.39:1; `guideline` on gold-500 #C9A24D = 2.40:1; `presentation` on maroon-300 #CF7D99 = 2.98:1; `minutes` on ink-400 #928B93 = 3.31:1; `dataset` on gulf-400 #3A959C = 3.52:1; `speech` on warn #B7791F = 3.64:1. The gold-300 verified badge dies on the same spines: 1.24:1 on sand-300, 1.39:1 on gold-500. The screenshots happen to show only passing colors (maroon-700 = 9.35:1, ink-600 = 6.98:1, gulf-600 = 5.98:1), but every mapped color renders as soon as its type exists in the corpus.
- **Why**: `accessibility.md › Vision`: "Strive to meet color contrast minimum standards", with the table requiring 4.5:1 for text up to 17pt at any weight.
- **Fix**: Make `TYPE_COLORS` a map of background plus foreground pairs. Dark text solves all six light spines: ink-900 #1E1B1F gives 12.26:1 on sand-300, 7.11:1 on gold-500, 5.72:1 on maroon-300, 5.14:1 on ink-400, 4.84:1 on gulf-400, 4.68:1 on warn. Give the badge a dark variant on light spines.

**2. ink-400 is used as an information color.** [Critical]

- **What**: Shelf counts (12px, ink-400 on the sand-50 page ground) = 3.15:1. The year in the cover reveal and the reuse and view counts on `KnowledgeCard` (11px, ink-400 on white cards) = 3.31:1. All below 4.5:1, and all carry real information: how many documents, how old, how used.
- **Why**: `accessibility.md › Vision`, same 4.5:1 table.
- **Fix**: Use ink-600 #5E5760 for any text that informs: 6.64:1 on sand-50, 6.98:1 on white. Reserve ink-400 for disabled states and decorative glyphs.

**3. The level 3 classification chip fails.** [Critical]

- **What**: `ClassificationChip` maps level 3 to the warn tone: #B7791F on #F9EFDD = 3.19:1 at 11px medium. On a page whose subtitle promises "51 items on the shelves at your clearance", classification is primary metadata, shown on every list row and grid card.
- **Why**: `accessibility.md › Vision`, 4.5:1 for small text.
- **Fix**: Add a darker warn text token for use on warn-light, for example #7A500F (6.18:1) or #8F5E18 (4.87:1). Keep #B7791F for fills and large glyphs. While there, note ok on ok-light is 4.29:1; it is not used on this page but sits just under the line.

### Improvements

**4. The cover reveal is pointer-only.** [High]

- **What**: The spine preview (title, summary, owner, year) appears only on `group-hover/spine`. Keyboard focus on the spine link does not trigger it; touch never does. The information is reachable one click deeper on the document page, which is why this is High rather than Critical.
- **Why**: `accessibility.md › Mobility`: "Make sure your UI's core functionality is accessible through more than one type of physical interaction."
- **Fix**: Add `group-focus-within/spine:visible group-focus-within/spine:opacity-100` alongside the hover variants, and let Esc dismiss the open preview so it does not obscure content for keyboard users.

**5. The view toggle claims to be tabs but does not behave like tabs.** [High]

- **What**: `VaultToolbar` uses `role="tablist"` and `role="tab"` with `aria-selected`, but there is no `aria-controls`, no `tabpanel`, and no roving tabindex with arrow keys. A screen reader announces a tab interface whose keyboard grammar does not exist.
- **Why**: Judgment (ARIA tabs pattern), supported by `accessibility.md › Speech`: "Let people use the keyboard alone to navigate and interact with your app."
- **Fix**: The simplest honest markup wins: plain buttons with `aria-pressed`, or a radiogroup. Keep the visual treatment as is.

**6. On compact widths the filters bury the shelves.** [High]

- **What**: `vault-mobile.png` shows the view toggle plus seven stacked full-width selects consuming roughly two thirds of the viewport before the first shelf appears. The point of the page arrives below the fold.
- **Why**: `layout.md › Best practices`: "Make essential information easy to find by giving it sufficient space", and `layout.md › Visual hierarchy`: "Take advantage of progressive disclosure to help people discover content that's currently hidden."
- **Fix**: Below the `sm` breakpoint, collapse the dimension selects behind a single Filters button (sheet or disclosure) with an active-filter count badge. Keep the view toggle and sort inline.

**7. Nothing happens visibly while a filter loads.** [Medium]

- **What**: Every filter change is a `router.push` and a server round trip. The vault route has no `loading.tsx` (only `home` has one), and `setParam` does not use a transition, so the stale result sits unchanged after a click. `ShelfSkeleton` exists in primitives and is unused here.
- **Why**: `loading.md › Best practices`: "Show something as soon as possible."
- **Fix**: Add a vault `loading.tsx` using `ShelfSkeleton`, or wrap `setParam` in `useTransition` and dim the results with `aria-busy` while pending.

**8. In outcome grouping, knowledge type is conveyed by color alone.** [Medium]

- **What**: With `group=outcome`, shelf headings name outcomes and spine color becomes the only carrier of type. There is no legend, and the cover reveal shows title, summary, owner, and year but not the type name.
- **Why**: `accessibility.md › Vision`: "Convey information with more than color alone."
- **Fix**: Add the type name to the cover reveal. The grid view already pairs the color swatch with a text label; reuse that pattern.

**9. Verified changes color between views.** [Medium]

- **What**: The verified badge is gold-300 on spines and gulf-600 in grid and list. Same state, two colors, one page.
- **Why**: `color.md › Best practices`: "Avoid using the same color to mean different things"; the converse holds too: one meaning deserves one color.
- **Fix**: Standardize on the gulf family as the trust accent (it already means verified in grid and list); on dark spines use a light gulf tint or white with adequate contrast.

**10. The Arabic type scale never reaches the small UI text.** [Medium]

- **What**: `globals.css` gives Arabic body text a 6 percent bump and 1.7 line-height, but the bump lives on `body` font-size. Tailwind sizes are rem (root-relative) and spine labels are `text-[11px]` (absolute), so chips, spine titles, counts, and toolbar text render at identical sizes in both languages. Arabic script at 11px is optically smaller than Latin at 11px, and pixel-literal sizes also ignore the reader's browser font-size preference.
- **Why**: `right-to-left.md › Controls`: "it often works well to increase the RTL font size by about 2 points", applied as a principle; plus the `typography.md › Ensuring legibility` size floors (10pt minimum on desktop, treated as px here).
- **Fix**: Express the smallest sizes in rem and scope a root-level bump for `html[lang="ar"]`, or add lang-scoped overrides for the 11px and 12px utilities.

**11. Three filter dimensions can be active with no visible control.** [Medium]

- **What**: `page.tsx` filters on `year`, `language`, and `classification` from the URL, and `activeFilters` counts them, but the toolbar renders no control for them. A shared link arrives filtered with nothing on screen saying so except the Clear filters button appearing.
- **Why**: Judgment: visibility of system status.
- **Fix**: Render removable chips for any active param that lacks a select, or add the three missing selects.

**12. The 120-item cap is silent.** [Medium]

- **What**: `listDocuments` is called with `limit: 120` and the subtitle counts `shelfDocs.length`. Past 120 matches, the page would show and claim 120 with no pagination and no notice. Latent today (corpus is 51), waiting for the corpus to grow.
- **Why**: Judgment.
- **Fix**: Return the true total, show "120 of N", and add a load-more affordance.

**13. Spines do not announce verified status.** [Low] The badge inside the spine is `aria-hidden` and the link's `aria-label` is only the title. Append the status to the label. Judgment.

**14. Clear filters resets the grouping.** [Low] The reset preserves only `view`; a chosen `group=outcome` is dropped, though grouping is not a filter. Preserve `group` alongside `view`. Judgment.

**15. `.spine-title-ltr` and `.spine-title-rtl` are identical rules.** [Low] Both declare `writing-mode: vertical-rl; text-orientation: mixed` in `globals.css`. Either the Arabic spine reading-direction decision is unfinished or one class can go; as written the distinction does nothing. Judgment.

**16. Heading structure skips a level.** [Low] The page renders an h1 and shelf labels as h3 with no h2. Make shelf labels h2 for a clean outline. Judgment.

**17. The search placeholder still says "Search NEXUS".** [Low] The brand assets are SiaNexus (`SiaNexus_logo.svg`, the wordmark crops in `globals.css`), and the header placeholder uses the old name. It lives in the app shell, not this page's files, but it appears in every vault screenshot. `writing.md › Getting started`: "Create a list of common terms, and reference that list to keep your language consistent."

### Craft notes

The design has a point of view and it is the right one for the product: an institutional archive that feels like a room full of books rather than a database. It sits near the warm-cream-plus-serif template this skill warns about, but survives the challenge on the merits: the maroon is Qatar's flag color, the sand is the ground the institution stands on, the gulf teal and gold complete a national palette, and Fraunces reads as print archive rather than fashion. A palette this rooted is an argument, not a default.

The boldness is spent in exactly one place. Spines are the only loud element; the toolbar, cards, rows, and empty state stay paper-quiet. Structure encodes information: spine color is a real taxonomy, shelf counts say something true, and the decorative spine-height variation is cheap delight that reads as actual books; keep it. Asked to remove one accessory, the honest answer is that the page is already lean; the one dense area is the nine-control toolbar, and even on desktop the department and status selects could retire behind a More filters control without loss.

### What works

- **The shelf metaphor**: type-colored spines, the tilt on hover, the cover reveal, the gradient rail underneath. This is the memorable idea; protect it through iterations, and fix its contrast rather than flattening it.
- **URL as the single source of filter state**: shareable, bookmarkable, back-button-friendly, refresh-proof. This is the Agency principle done properly.
- **RTL execution**: logical properties throughout (`ms-auto`, `start-1/2`, `text-start`), a `flip-rtl` hook for directional icons, a fully mirrored AR layout in the screenshots, and numerals left unflipped, matching `right-to-left.md › Numbers and characters`: "Don't reverse the order of numerals in a specific number."
- **Motion discipline**: one entrance animation per page, and `prefers-reduced-motion` neutralizes every animation and transition globally in `globals.css`.
- **Native selects**: free keyboard support, screen reader semantics, and platform pickers on mobile. The right call over a custom dropdown.
- **Focus visibility**: a global `:focus-visible` outline in maroon-700, 9.35:1 against white, far above the 3:1 non-text need.
- **Core reading contrast**: ink-900 at 17.05:1 on white and 16.21:1 on sand-50; ink-600 secondary text at 6.98:1 and 6.64:1. The primary reading path is excellent; the failures are confined to the smallest tier.
- **The empty state** names the situation, hints, and offers Upload only to users who hold the permission. `writing.md › Best practices`: "guide people on actions they can take, and give them a button or link to do so."
- **Verb-led labels**: "Upload to Vault" says what happens.

### Platform notes

- This is a desktop-first web app (Next.js + Tailwind), so Apple platform conventions were applied as principles only. Not applicable here: the menu bar, standard window controls, the Settings window, tab bar and sidebar components, Liquid Glass, and the Dynamic Type API. Their principles do apply and were checked: keyboard-only paths, user text scaling, hover and focus feedback.
- Sizes: CSS px treated as equivalent to pt at 1x. Body text at 15px exceeds the 13pt desktop default; the 11px caption tier sits above the 10pt floor but at the edge, and is pixel-locked (finding 10).
- Control sizes clear the desktop bar: selects at 38px and toggle buttons at 32px against a 28px default; spines are 44px wide, which also meets the 44pt mobile target in `vault-mobile.png`.
- Single light appearance: `color-scheme: light` is declared and no dark palette exists. For an internal government tool shipping one appearance is a defensible trade-off; the semantic token structure would support a dark set later, and `color.md › Best practices` asks that colors eventually work in "light, dark, and increased contrast contexts". Named as a trade-off, not a finding.
- Verification limits: contrast is computed from token hex values; what could not be verified from this artifact is runtime behavior (actual focus order, screen reader output, transition timing under load).
