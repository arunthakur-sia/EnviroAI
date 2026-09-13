# CR04 self-critique: the Strategy Canvas

Screenshots: `data/screenshots/cr04/canvas-en-1440.png`, `canvas-en-panel.png`, `canvas-en-panel-full.png`, `canvas-en-chapter.png`, `canvas-en-drawer.png`, `canvas-en-deeplink.png`, `canvas-ar-panel.png`, `canvas-en-390.png`.

## Three sentences

The eye lands on the national frame reading top to bottom like a plan: the four QNV pillars with their faint connection threads flowing down through the at-a-glance figures and the 2024-2030 timeline into the seven medallions, so the whole page states where every outcome comes from and where it is going before a single click. The generic risk found and addressed was the "Read the chapter" summary, whose first extractive draft came back empty or as table fragments for three outcomes because the public NDS3 document has no clean chapter prose there; the summary is now composed from the outcome's own framing, the chapter's clean sentences where they exist, and the named national targets, every sentence page-cited into the real document. A Sia designer would be proud that the page never navigates: the panel opens beneath the arc with a pointer that slides between medallions, targets expand in place, initiatives and projects slide in as a drawer with Previous and Next, the back button unwinds drawer, target, panel in order, and every level hands out a copy-able deep link.

## Verified against CR04 2

- Pillars strip with measured connector lines that brighten on hover along with their medallions; mapping seeded and editable in Settings.
- Timeline strip: year ticks, the maroon today dot with the date, the 2027 mid-term review and 2030 horizon labels, the progress fill, faint per-year start and end bars, and hover tooltips listing that year's projects.
- Panel: 300ms height animation, sliding tapered pointer, 180ms crossfade between outcomes, close on re-click; header with watermark numeral, pillar chips, 120px ring, copy link, open full page.
- Read the chapter: summary first, then the paginated full text from the existing document chunks with "p. N" chips that open the reader at that page, and Open in the Vault.
- Headline KPI tiles (existing `IndicatorTile`), the CR03 target cards with in-place lanes, outcome-level items, experts, and the signals count that opens Trends filtered.
- Sticky ring rail appears only when the arc leaves the viewport; clicking a ring switches the panel and scrolls to it.
- Drawer: 520px end-side slide-over on a 20 percent scrim, skeleton load, sibling prefetch, Previous/Next with arrow keys, Escape closes, Brief me / Ask about this / Extract report / Open full page.
- URL state `?o=&t=&i=|&p=` with pushed history entries; deep links restore panel, target, and drawer; the map switches back into the canvas with the same state.

## HIG pass (apple-design-skill lens)

- Medallions are buttons with `aria-expanded`; the rail is a labelled toolbar of pressable rings; the drawer is `role="dialog"` with `aria-modal` and full keyboard support.
- All motion is height/opacity/transform under 300ms and collapses to instant states under reduced motion.
- Contrast follows the system (ink-600 minimum for text, maroon-900 figures); the connector lines are decorative and `aria-hidden`.
- RTL mirrors the pillars, timeline direction, arc, pointer, and drawer side.

Verdict: no generic item remains; no High or Critical HIG findings.
