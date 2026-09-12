# Design review: Home (before CR02 rebuild)

Reviewed with the apple-design skill (SKILL.md process, five lenses). Artifact: `data/screenshots/cr01/home-en.png`, `data/screenshots/cr01/home-ar.png`, plus source (`src/app/[locale]/(app)/home/page.tsx` and child components). Platform: desktop web app (Next.js), reviewed under the desktop conventions with foundations applied as principles. Contrast figures are computed from the hex tokens in `src/styles/globals.css`, not estimated from screenshots.

### Summary

The design system itself is strong: a real paper-and-ink identity (sand surfaces, maroon accent, Fraunces display, weave motif), disciplined tokens, RTL mirroring, and tabular numerals. The page composition is the problem: five rows with seven different card sizes and three competing hero moments (the 28px greeting, the 52px count-up number, and the Ask box) mean no single element owns the screen. Overall rating: **Needs work**. The thesis this screen should have ("ask SiaNexus anything") is present but buried third in the visual order.

### Critical

- **What**: Section eyebrows and metadata set in `ink-400` (#928b93) on white (#FFFFFF) or sand-50 (#FBF9F5) compute to about 3.1:1 at 12px semibold ("FOR YOU", "YOUR KNOWLEDGE FOOTPRINT", the next-unlock line, the mystery hint). Below the 4.5:1 minimum for text up to 17pt.
  **Why**: `accessibility.md › Vision`: "Text up to 17 pts needs a minimum contrast ratio of 4.5:1."
  **Fix**: Set eyebrow and caption text that carries information in `ink-600` (#5E5760, 6.9:1 on white). Reserve `ink-400` for genuinely decorative or duplicated text.

### Improvements

- **High. Three competing focal points above the fold.** The greeting (28px Fraunces), the daily-fact number (52px, animated count-up), and the Ask box all claim the hero position; the Ask box, the strategic centre of the product after CR01, reads as the third element. `design-principles.md › Simplicity`: "Establish hierarchy... Prioritize recognizable controls and a consistent structure." `layout.md › Best practices`: "Make essential information easy to find by giving it sufficient space." Fix: one focal point (the Ask box), everything else quiet.
- **High. Seven card geometries on one page.** Hero 2:1 split, full-width changed strip, lessons 2:1 with footprint, mystery 2:1 with spotlight, then a shelf. Each card also invents its own internal structure. `design-principles.md › Simplicity`: "Include just what is necessary"; the skill's craft lens: "Is the boldness spent in one place?" Fix: a small number of identical card shapes per row.
- **High. Nothing renders while the page loads.** The route is `force-dynamic` with no `loading.tsx`; the previous page stays frozen until the server responds. `loading.md › Best practices`: "Show something as soon as possible... consider showing placeholder text, graphics, or animations as content loads." Fix: skeletons that match the final shapes exactly.
- **Medium. Eyebrow labels use three different colors with no semantic difference.** `maroon-700` ("DID YOU KNOW QATAR?"), `gold-500` ("SPOTLIGHT"), `ink-400` (the rest). `color.md › Best practices`: "Avoid using the same color to mean different things", and the inverse: three colors here mean the same thing (a section label). Fix: one eyebrow style everywhere.
- **Medium. Two extra entrance systems beyond the page stagger.** The count-up number animates on scroll and the footprint arcs run their own keyframe entrance, so motion keeps firing after load. `motion.md › Best practices`: "Add motion purposefully... avoid adding motion to UI interactions that occur frequently." Fix: one staggered entrance on load, then only user-triggered motion.
- **Medium. Sections vanish instead of showing empty states.** `card ? <Card/> : null` for the daily card, changed strip, mystery, spotlight, and shelf; the layout reshuffles depending on data. `writing.md` (empty states) and `feedback.md`: empty screens invite the next action. Fix: written empty states with one action, in both languages.
- **Medium. The word-of-the-day strip competes with content.** A gold-ruled quotation with icon and attribution sits between the greeting and the Ask box, pushing the primary control down. `branding.md › Best practices`: "Ensure branding always defers to content." Fix: one quiet caption line under the Ask examples.

### Craft notes

- The design has a real point of view: government paper with a weave. Keep it. The problem is that six different moments (count-up, quiz, mystery spine, spotlight, footprint sunburst, shelf) all spend boldness at once; the memorable element should be one.
- The 52px count-up number over a small label is exactly the "big number hero with an accent gradient" template the craft lens warns about; it earns its place only if it is the single Today moment, not the page hero.

### What works

- Token discipline: every color, radius, and shadow comes from `@theme` tokens; no hard-coded values in the page.
- Full RTL mirroring including logical properties (`ms-`, `end-`), flipped chevrons, and the Arabic type scale (+6 percent, IBM Plex Sans Arabic, Kufi for headings).
- Reduced motion is respected globally (`prefers-reduced-motion` kills animations and `Reveal`/`CountUp` check `useReducedMotion`).
- `:focus-visible` outline is defined once and visible on all interactive elements; the Ask box submit is a real form submit reachable by keyboard.
- Tabular numerals (`tnum`) on every figure.
- Example chips under the Ask box follow `generative-ai.md › Inputs`: "offer diverse, predefined example inputs that hint at what is possible."

### Platform notes

- Desktop web: the rail plus top bar arrangement is consistent with a sidebar layout; no findings there in this scope (Home only).
- At 390px the 2:1 grids stack acceptably, but the footprint's fixed 210px SVG leaves dead space beside it in the stacked layout.
