# Design review: Settings (/settings)

Reviewed: 2026-09-12. Artifact: `src/app/[locale]/(app)/settings/page.tsx`, `SettingsTabs.tsx`, `TrendsSettingsTab.tsx`, `AnalyticsTab.tsx`, shared primitives (`src/components/ui/primitives.tsx`, `overlays.tsx`), tokens (`src/styles/globals.css`), and the EN screenshot `data/screenshots/settings-en.png`. All contrast ratios below are computed from the token hex values (WCAG relative luminance), not estimated from the image. Apple point values are read as CSS px at 1x, the standard equivalence.

## Summary

An admin governance area for a bilingual desktop web app: ten flat tabs over quiet white cards on warm sand, auto-saving row by row. The thesis is "the engine room": a serious, paper-and-ink control panel with one moment of voice in the title block, and that is the right register for settings. The structure underneath is weaker than the surface: the smallest text and the status chips lean on an ink-400 gray and tinted chip pairs that fail contrast minimums, the permission checkboxes are under-sized, and several controls have no accessible name, so the page currently fails its most likely users, administrators who live in dense tables all day.

**Overall rating: Critical issues.**

## Critical

Must fix. All four are Lens 1 accessibility failures.

- **[Critical] Small gray text fails contrast across the page.**
  - **What**: `ink-400` #928B93 is used for 11 to 12px text on white cards (3.31:1) and on the sand-50 page ground (3.15:1); both are below the 4.5:1 minimum. Instances: user emails and last sign-in dates in the Users table, member counts under role names, taxonomy term counts, the 11px classification note and 11px integration hint, brief and feed timestamps (11px) and feed URLs (12px) in Trends, audit timestamps, and 10px chart axis ticks in Analytics. The 12px semibold uppercase eyebrows in Trends pass only if semibold is counted as bold (3.31:1 against a 3:1 bold threshold); every regular-weight use fails outright.
  - **Why**: `accessibility.md › Vision`: "Strive to meet color contrast minimum standards." Its table requires 4.5:1 for text up to 17pt, any weight.
  - **Fix**: Add an `--color-ink-500` around #716A72 (4.98:1 on sand-50, 5.24:1 on white) and use it for every text role at 14px and below that currently uses `ink-400`. Reserve `ink-400` for decorative marks and text 18px+ only. One token edit plus class swaps; no layout change.

- **[Critical] Status chips fail contrast at 11px.**
  - **What**: `Chip` renders 11px font-medium text. Tone `warn` is #B7791F on #F9EFDD, 3.19:1; tone `ok` is #2E7D5B on #E3F1EA, 4.29:1. Both are below 4.5:1 (medium weight is not bold, so the 3:1 bold allowance does not apply). Tones `danger` (5.40:1), `info` (5.48:1), and `sand` (ink-600 on sand-100, 6.14:1) pass. Warn and ok chips carry meaning here: run status in Trends, bounty status, Ask confidence.
  - **Why**: `accessibility.md › Vision`, same contrast table. Also `color.md › Inclusive color`: "insufficient contrast can cause icons and text to blend with the background and make content hard to read."
  - **Fix**: Darken the chip text tokens only, keeping the tinted backgrounds: `--color-warn` text to #8A5A14 (5.18:1 on warn-light) and `--color-ok` text to #276749 (5.78:1 on ok-light). If the warn/ok hexes are shared with non-chip uses, split into `-text` variants.

- **[Critical] Permission matrix checkboxes are below the minimum control size.**
  - **What**: The role editor dialog uses native checkboxes at `size-3.5` (14x14px) with no padded hit area beyond the cell's 8px horizontal padding. Desktop minimum is 20x20, default 28x28.
  - **Why**: `accessibility.md › Mobility`: "Offer sufficiently sized controls. Controls that are too small are hard for many people to interact with and select," with the macOS row of the size table (default 28x28 pt, minimum 20x20 pt).
  - **Fix**: In `SettingsTabs.tsx` (RolesTab matrix), raise to `size-5` (20px) at minimum, and make the whole `td` a click target by wrapping the checkbox in a label with `p-2.5`, giving an effective 28px+ region. The per-cell `aria-label` is already present; keep it.

- **[Critical] Controls without accessible names.**
  - **What**: (a) GamificationTab: each rule row's `Switch` has no `aria-label`; a screen reader announces an unnamed switch next to an unnamed row (the points `Input` in the same row does have one). (b) AuditTab: the action filter `NativeSelect` has no label or `aria-label`; it is announced only by its current value. (c) UsersTab: the three per-row selects rely solely on table header association; workable, but an explicit name including the user would be far clearer ("Role for Abdulla Al-Marri").
  - **Why**: `accessibility.md › Mobility`: "To ensure a smooth experience, label interface elements appropriately." The Trends tab already does this correctly (`aria-label={b.nameEn}` on its switches), so this is an internal inconsistency as well.
  - **Fix**: `aria-label={r.eventType}` on the rule switch (or better, the translated rule name per the naming finding below); `aria-label={t("allActions")}` or a visible `Label` on the audit filter; `aria-label` composed of column and user name on the Users row selects.

## Improvements

- **[High] Department and role selects truncate away the distinguishing words.**
  - **What**: The Users table clamps the department select to `max-w-44` (176px). In the screenshot, five consecutive rows all read "Department of Nationa...", "Department of Statistica...", "Department of Economi...": the shared prefix survives and the differentiating tail is cut, so the selected value cannot be read without opening the menu.
  - **Why**: `layout.md › Best practices`: "Make essential information easy to find by giving it sufficient space. People want to view the most important information right away."
  - **Fix**: Widen to `max-w-60`+ (the table already scrolls horizontally at `min-w-[760px]`), or display the short department code with the full name in `title`, or drop the "Department of" prefix inside this column since the column header already says Department.

- **[High] People search ignores Arabic names.**
  - **What**: The Users filter matches only `nameEn` and `email`. An administrator working in the Arabic locale who types an Arabic name gets zero rows even though every user has a `nameAr` that the table itself displays.
  - **Why**: Judgment; Apple's Flexibility principle (adapt to diverse contexts and needs) applied to a bilingual product whose own data model is bilingual.
  - **Fix**: Include `u.nameAr.includes(q)` in the `visible` filter in UsersTab (no lowercasing needed for Arabic).

- **[High] Ten flat tabs mix settings with reporting.**
  - **What**: Users, Roles, Taxonomy, Gamification, AI, Trends and Signals, Bounties, Integrations, Audit log, Analytics: ten peers in one `flex-wrap` strip that becomes a two-row pill cloud at narrower widths. Two of the ten (Audit log, Analytics) are read-only reporting, and Analytics is a full dashboard with charts and an AI narrative, not a setting anyone changes.
  - **Why**: The settings principle, translated from macOS guidance (the mechanism there is a fixed-toolbar settings window; `settings.md` is not installed in this skill's reference set, so this is the skill's distillation plus judgment): settings hold general, infrequently changed options with clear grouping. Also `layout.md › Best practices`: "Group related items to help people find the information they want."
  - **Fix**: Group into five or six tabs with in-tab sections: People and access (Users, Roles), Knowledge (Taxonomy), Engagement (Gamification, Bounties), Intelligence (AI, Trends and Signals), System (Integrations). Move Analytics and Audit log out of Settings into a Reports area, or at minimum separate them visually from the configuration tabs; the page already routes analytics-only users here, which shows the seam.

- **[Medium] Integrations tab ships dead controls and ignores its own status data.**
  - **What**: Every integration card renders two permanently disabled inputs (at `opacity-50` the placeholder lands near 1.9:1, unreadable) and a hardcoded "Not configured" chip; the `integration.status` field passed into the component is never read, so a configured integration would still say "Not configured."
  - **Why**: Judgment; Apple's Simplicity principle: has every element earned its place? A control that can never be used is decoration that reads as breakage.
  - **Fix**: Replace the disabled inputs with the existing `EmptyState` pattern or a single "Planned" line, and bind the chip to `integration.status`.

- **[Medium] Switch off state is nearly invisible.**
  - **What**: The off track is sand-300 #E2DAC9 against the white card, 1.39:1 (1.32:1 on sand-50). WCAG 1.4.11 expects 3:1 for component boundaries; the installed references cover text contrast only, so labeled judgment with numbers.
  - **Why**: Judgment (WCAG 1.4.11); also `accessibility.md › Vision` in spirit: information conveyed by a barely visible control state.
  - **Fix**: Off track to `ink-200` #D8D4D9 with a 1px `ink-400` border, or any track pair reaching 3:1 against white.

- **[Medium] Raw system identifiers surface as UI text.**
  - **What**: Gamification rows print `r.eventType` keys verbatim; the audit action filter lists untranslated lowercase strings ("login", "view", "brief") in both locales; audit resource types render raw. In Arabic these remain English machine words.
  - **Why**: `writing.md › Best practices`: "Keep settings labels clear and simple. Help people easily find the settings they need by labeling them as practically as possible."
  - **Fix**: A translation map for event types and audit actions, mirroring the existing `modules.*` and `actions.*` message pattern already used in the role matrix.

- **[Medium] Button nested inside a link (Audit export).**
  - **What**: `<a href=...><Button>Export CSV</Button></a>`: an interactive element inside an interactive element; keyboard and screen reader users get a doubled or ambiguous stop, and the button's focus ring belongs to the wrong element.
  - **Why**: Judgment (HTML semantics; interactive nesting is invalid).
  - **Fix**: Style the anchor itself with the secondary button classes, or trigger the download from the Button's onClick.

- **[Medium] Security-significant changes commit instantly with no undo.**
  - **What**: Changing a user's role, department, or clearance fires a PATCH on select change; the only feedback is a "Saved." toast. The last-super-admin guard is good, but a mis-click on Clearance from Internal to Secret is live immediately and reversible only by remembering the old value.
  - **Why**: Judgment (Lens 4; the undo guidance page is not installed): feedback in the interface is right, but consequential changes deserve a recovery path.
  - **Fix**: An Undo action inside the toast (the previous value is known at call time), or a one-step confirm only for clearance changes.

- **[Medium] Chart uses a near-invisible series and sub-minimum tick text.**
  - **What**: In Analytics, the "Other" bars are sand-300 on a white card, 1.39:1; axis ticks are 10px `ink-400` at 3.31:1; the legend is 11px. Ten px sits exactly at the desktop 10pt floor.
  - **Why**: `color.md › Inclusive color` (quote above) and the `accessibility.md` type minimums.
  - **Fix**: "Other" to `ink-200` #D8D4D9 or a hatched neutral with a visible edge; ticks to 11px with the new ink-500.

- **[Medium] Inconsistent capitalization and date formatting.**
  - **What**: Tab labels mix conventions: "Trends and Signals" capitalizes Signals while "Audit log" lowercases log. The Users table prints `lastLoginAt.slice(0, 10)` as raw ISO in both locales while Trends uses the localized `formatDate` for the same kind of value.
  - **Why**: `writing.md › Best practices`: "Adopt capitalization rules that align with your app's style, then apply them consistently."
  - **Fix**: Sentence case everywhere ("Trends and signals" or just "Trends"); use `formatDate(u.lastLoginAt, locale)` in the Users table.

- **[Medium] Gold avatar initials at 2.40:1.**
  - **What**: White initials on gold-500 #C9A24D compute to 2.40:1 at roughly 10.6px (visible in the screenshot on the AA, MA, KA, PN rows). The avatar is `aria-hidden` with the name adjacent, so it is decorative rather than a WCAG failure, but it visibly washes out next to the maroon (9.35:1) and gulf (5.98:1) variants.
  - **Why**: Judgment, with computed values; one component, three very different legibility levels.
  - **Fix**: Ink-900 initials on the gold avatar only (7.08:1 against gold-500 by the same math), or a darker gold for avatar use.

- **[Low] No empty state for a fruitless people search.**
  - **What**: Filtering to zero users leaves a bare header row.
  - **Why**: `writing.md › Best practices`: "An empty screen can be daunting if it isn't obvious what to do next."
  - **Fix**: Reuse `EmptyState` with the query echoed and a clear-search action.

- **[Low] Silent number coercion in Trends inputs.**
  - **What**: `Number(e.target.value) || 6` turns 0 or invalid input into the default without telling the user; `maxSources` in the AI tab has no min or max at all.
  - **Why**: Judgment (Lens 4: validate dynamically; the entering-data page is not installed).
  - **Fix**: Clamp with visible min/max attributes (interval already has them; enforce on blur) and keep the typed value when valid.

- **[Low] Bilingual requirements differ by form.**
  - **What**: Creating a scan brief requires both English and Arabic names; saving a role requires only `nameEn`. A role saved without `nameAr` shows an empty string in the Arabic locale.
  - **Why**: Judgment; internal consistency.
  - **Fix**: Require both in the role dialog, matching the brief form.

## Craft notes

- The identity is real and earned. Warm paper, a Fraunces serif display, and a deep maroon accent superficially match the warm-cream-plus-serif template look this skill warns about, but here the maroon is Qatar's flag maroon and the gold and gulf teal come from the same national palette, so the choice is rooted in the product, not a default. On this page the identity is spent exactly once, in the "Settings and Governance" title and the "engine room" subtitle, and everything below is a quiet utility. For a settings surface, that restraint is the correct answer, and it should be named so it survives iteration.
- **[Medium] The control vocabulary is inconsistent.** A carefully restyled Switch sits in the same flows as a raw native checkbox (roles matrix) and a raw native range slider (AI temperature). One system, three visual languages for "binary/valued choice." Restyle the checkbox and slider with the same maroon accent treatment (`accent-maroon-700` is a start, but size and track styling do not match the Switch).
- **[Low] The Analytics KPI tiles are the big-number-over-small-label pattern** the skill lists among generated-interface defaults. For a metrics dashboard it is conventional and defensible; the serif numerals tie it to the brand. Fine to keep, worth knowing it is the expected move rather than a signature.
- Remove-one test: after the Integrations dead inputs go (already a finding), the page is lean; nothing else asks to be cut.

## What works

Keep these; they are specific and easy to lose in a refactor.

- **RTL discipline in the code**: `text-start` on every table header, `ms-auto` instead of `ml-auto`, `dir="ltr"` pinned on emails, URLs, timestamps, and numeric inputs, the Switch thumb with explicit `rtl:` translate variants, the dialog's `rtl:translate-x-1/2` centering, and a `.flip-rtl` utility for directional icons. This matches `right-to-left.md › Text alignment` ("Adjust text alignment to match the interface direction") without a single hard-coded left/right in the settings code.
- **Focus visibility**: a global `:focus-visible` outline in maroon-700 at 2px with 2px offset, 8.90:1 against sand-50; buttons carry their own matching outline classes. Keyboard-only use is visible everywhere on this page.
- **Reduced motion is a real answer**: the one entrance animation (`.reveal`) is disabled under `prefers-reduced-motion`, and all animation and transition durations are collapsed globally.
- **Loading states are shaped like content**: skeletons with `aria-busy` in Audit, Trends, and the AI narrative, never a spinner-only screen.
- **Toggle copy follows the settings-writing rule**: "Turns points, streaks, badges and quests on or off for everyone" and the mock-mode hint describe the on state and let people infer the off state, exactly as `writing.md › Best practices` prescribes.
- **The last-super-admin guard message** ("That is the last Super Admin. Assign another one first.") says what went wrong and how to fix it, in voice, without apologizing.
- **Structural details**: sticky header on the audit table, zebra-free rows separated by hairline sand-100 borders, tabular numerals via `.tnum` on every count and date, and the active tab pill at 13.79:1 (maroon-900 on white).

## Platform notes

- This is a desktop-first web app (Next.js + Tailwind), so Apple's foundations (accessibility, layout, typography, color, writing, RTL) apply as principles; macOS mechanisms (menu bar, settings window, window chrome) do not. The macOS fixed-toolbar settings-window guidance was translated to its principle (general, infrequently changed options, clearly grouped) in the tab-structure finding.
- Reference set limits: this skill installation carries a subset of the HIG pages. `settings.md`, `entering-data.md`, `toggles.md`, `buttons.md`, and `lists-and-tables.md` are not present, so findings in those areas are labeled judgment or cite the skill's distillation instead of a page quote.
- Artifact limits: there is no Arabic screenshot, so RTL was judged from the source's logical properties only and should be verified visually. The EN screenshot is also stale: it shows nine tabs while the source renders ten (the "Trends and Signals" tab is missing from the image), so visual findings for that tab come from code alone.
- The Analytics chart is deliberately forced LTR (`direction: "ltr"`) in the Arabic locale. For a left-to-right time axis that is a defensible convention, and `right-to-left.md › Controls` concerns controls rather than content, but Arabic legend and tooltip labels will sit inside an LTR block; check the AR rendering when a screenshot exists.
- Type sizes measured against the desktop scale (points read as px): body 15px, table text 14px, metadata 12px, chips and hints 11px, chart ticks 10px. Everything sits at or above the 10pt desktop floor, so the failures on this page are contrast and control size, not type size, though 11px for meaning-bearing chips sits uncomfortably far below the 13pt desktop default.
