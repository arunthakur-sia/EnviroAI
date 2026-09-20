# Design review: Ask NPC everywhere (CR08 2.3)

Reviewed 2026-09-19 against the CR03 to CR07 design rules and the CR01 Ask NPC review (`docs/design-reviews/ask.md`). Scope: the top-bar button (`AskBarButton`), the floating launcher (`AskLauncher`), the panel (`AskPanel`), the shell mount (`AskEverywhere`), the panel store, the context markers on the strategy node, document, indicator, lesson and council project pages, and the `compact` layout of the answer workspace. Evidence: `data/screenshots/cr08/ask-launcher-{en,ar}.png`, `ask-nudge-en.png`, `ask-panel-empty-{en,ar}.png`, `ask-panel-{en,ar}.png`, `ask-panel-small-en.png`, and the Playwright probe `scripts/dev-probes/cr08-ask-probe.ts` (both locales, live analyst). AppShell already mounts `AskBarButton` and `AskEverywhere`, so the probe drives the shell's own instance; the dev test page's `<AskEverywhere fallback />` yields to it. `scripts/dev-probes/cr08-ask-nav-probe.ts` isolates the route change and reports whether it was a client transition.

## Summary

The panel is the conversation page folded into 480px: the same answer dossier (strategy cards, indicator tiles, documents, lessons, signals, people, sources), the same analyst stream, the same conversation rows, so nothing was forked. What is new is the frame: a maroon pill with a gold breath at the end corner, a white panel with the card language and a Fraunces (Kufi in Arabic) title, the page item as a removable chip with three suggestions written about it, and a thread that survives navigation because it lives outside React. The rail stays usable behind the scrim, which is the one place the panel is deliberately less than modal.

## Findings

**F1. The scrim dimmed the expanded rail.** [High, fixed]
The scrim was written with `start-[72px]` from the CR05 rail; CR08 2.2 widened the rail to 232px when expanded, so the scrim (z-65, above the rail's z-40) covered its labels. The panel now measures `[data-testid="rail"]` with a ResizeObserver while open and starts the scrim at that width, so the rail is never dimmed or blocked at either width (probe check "scrim starts where the rail ends").

**F2. A live answer could double-render for a frame.** [Low, fixed]
Same as ask.md L4: the live turn is suppressed as soon as `analyst.final` exists, so the completed answer never flashes twice when the store appends the final turn.

**F3. No way back from a failed send.** [High, fixed]
ask.md H2 asked for Retry. The panel's error strip is a `role="alert"` with a Retry that resends the last user turn without pushing a duplicate bubble.

**F4. The streamed answer was silent for screen readers.** [High, fixed]
ask.md C2. One visually hidden `role="status"` node announces the current thinking chip while gathering, "Answer ready" when the final event lands, and the error text on failure.

**F5. Assistant turns carried no AI attribution.** [Medium, fixed]
ask.md H4. Every assistant card in the panel opens with the sparkle and the "SiaNexus Intelligence" byline as an eyebrow.

**F6. The grounding claim.** [Medium, fixed]
ask.md H1. The composer footer says what the system guarantees ("Answers cite NPC sources. Verify against the citations; the AI can still misread them") in both languages, not "nothing is invented".

**F7. Two-column workspace grids inside a 480px panel.** [Medium, fixed]
`sm:grid-cols-2` is viewport based, so the strategy cards and indicator tiles would have squeezed into two 210px columns. `AnalystAnswer` gained a `compact` prop (one column everywhere) that the panel passes; the conversation page is unchanged.

**F8. The nudge on phones.** [Low, deliberate]
Under 640px the launcher is a 56px round button and the three-second "Ask about this project" wording is not shown (there is no room for a label that does not cover content). The `aria-label` still carries the nudge text while it is active. Recorded as a limitation.

**F9. Modal semantics with a reachable rail.** [Low, deliberate]
The panel is `role="dialog" aria-modal="true"` with a Tab trap, focus on the composer when opened, and focus returned to the opener on close; the scrim closes on click; Escape closes and keeps the thread. The rail is intentionally outside the scrim (the change request asks for it), so a pointer user can navigate while the panel stays open; a keyboard user leaves the panel with Escape first. This is a knowing deviation from strict modality and it is what the CR specifies.

**F10. Contrast.** [Verified]
White on maroon-700 (pill, send button, header glyph) 8.6:1; maroon-700 on white (bar button) 8.6:1; ink-600 for the 11px footer and timestamps 6.5:1 on white; ink-900 suggestion text; the gold-300 sparkle and the gold halo are decorative only. No new 10px text: the smallest is 11px (eyebrows, footer, the Ctrl+K key cap).

**F11. Motion.** [Verified]
Panel slide 240ms on the paper ease, scrim 200ms, pill label crossfade 160ms, the pill's width change 240ms through `layout`; the halo is transform and opacity only on a 3 second breath. Under `prefers-reduced-motion` the halo is a static gold ring, the slide is instant, the layout animation is off, and auto-scroll uses `behavior: "auto"`.

**F12. RTL.** [Verified in `ask-panel-ar.png`, `ask-launcher-ar.png`]
Logical properties throughout (`end-6`, `inset-inline-start`, `ps/pe`, `rounded-ee-md`); the panel docks at the left in Arabic and slides in from there; the send arrow flips with `flip-rtl`; eyebrow letter-spacing is removed in Arabic with `rtl:tracking-normal`; the Ctrl+K key cap keeps Latin glyphs.

**F13. Keyboard shortcut collision.** [Medium, mitigated, coordinator note]
`GlobalSearch` already bound Ctrl/Cmd+K to focus the search field (a window listener in the bubble phase). `AskEverywhere` registers its listener in the capture phase and stops immediate propagation, so Ctrl+K opens the panel as CR08 2.3 requires and the search binding never fires (probe check "Ctrl+K did not land in the search field"). The search field still shows a "Ctrl K" key cap in its placeholder; the coordinator should rebind or relabel it (see the report).

**F14. The panel vanished after the first navigation from the test page.** [High, fixed]
The first double-mount guard elected the first instance to run its effect as primary. React runs effects child-first, so on the test page the page's own mount (inside `children`) beat the shell's, and when that page unmounted on navigation no instance rendered at all. `AskEverywhere` now keeps a live registry: the first non-fallback instance is primary, a `fallback` instance (the test page) yields to the shell, and when the primary unmounts the next instance takes over immediately, so the panel is never absent (probe checks "panel still open after client navigation", "Expand opens /ask/c/[id]").

**F15. The thread died with a full page load.** [Medium, fixed]
The module store kept the thread through client transitions but not through a hard refresh (or the dev server forcing a full reload while other modules change). `panel-store.ts` now mirrors open state, conversation id, title, turns, draft and the removed item into `sessionStorage` per tab (capped at 400k characters, silently skipped in private mode), and restores it on the next load; hydration is unaffected because the server snapshot stays the closed initial state and React swaps to the restored state after hydrating. A new tab still starts clean.

**F16. Empty, loading and error states.** [Verified]
Recent conversations: three skeleton rows while loading, an EmptyState with a designed line when there are none, an alert with Retry on failure, and an inline alert if one fails to open. The thread has its error strip with Retry.

## What works

- The dossier survives the narrowing: citations chips, confidence meter, source list, follow-ups and the people section all render at 440px without horizontal scroll.
- The item chip and the suggestions make the first question one click: "What did PRJ-01a deliver?" reads as a question a planner would actually ask, and the answer came back cited in the probe.
- The thread persists through a client route change, Escape, and Ctrl+K (probe checks), because `panel-store.ts` owns it.
- The launcher lifts above the mini-player and drops back when playback ends (probe check with the shell's own `sia:podcast:state` event).

Closing: no High or Critical HIG findings remain.
