# Design review: CR08 Section 1, the Organisation rebuild (2026-09-19)

Scope: `/organisation` (the rebuilt chart in its fixed frame, the unit panel
beneath it with its tab strip and the change request), and Settings >
Organisation (the structure editor, the levels, the snapshots, the CSV
import, the change requests), English and Arabic, reviewed as rendered
screenshots in `data/screenshots/cr08/org-*.png` at 1440 by 900 and at 390
wide, driven by `scripts/dev-probes/cr08-org-probe.ts` in system Edge.

## What was checked

- **The frame.** The chart lives in a 70vh frame (never under 480px) that the
  reader can resize from its bottom edge with the pointer or the arrow keys;
  the height is remembered in `users.prefs_json` and read back on the server
  so the first paint already has it. The frame's height never changes because
  of the layout: expanding a sector adds cards (11 to 16 in the probe) while
  the frame stays at 630px.
- **Layout and motion.** A `d3-hierarchy` tidy tree, top-down, fixed 220 by
  88 cards, orthogonal connectors with rounded corners in the `--connection`
  token, a spine with short arms for the stacked columns that DECISIONS 80
  introduced (leaf children run down one column, branches run across, a stack
  reserves the rows it covers so no neighbouring subtree tucks under it).
  Expand and collapse recompute the layout and framer-motion tweens every
  card position and every connector path over 260ms; new cards grow out of
  their parent's position and leaving cards fold back into it. Reduced motion
  removes the tween.
- **Pan and zoom.** One `d3-zoom` transform on the root group, 0.4 to 2.0,
  fit-to-width on arrival and on every frame resize until the reader has
  zoomed or panned (DECISIONS 80's rule, kept), a custom constrain that
  centres a narrow tree and hangs a short one from the top so the chart can
  never be panned out of view, controls for zoom in, zoom out, fit and reset,
  and a mini-map that appears only when the tree is wider or taller than the
  frame and can be clicked to move the view. Drag pans, the wheel scrolls the
  page unless Ctrl or Cmd is held (a trackpad pinch arrives with Ctrl and so
  zooms), touch drags pan through d3-zoom's touch handling, and a plain wheel
  shows a two-second "Hold Ctrl and scroll to zoom" hint instead of trapping
  the scroll.
- **Level rail.** The levels come from `org_levels`; the rail at the start
  side shows one band per level (levels that share a row, Sector and Office,
  merge into one label), each band a hairline spanning exactly the rows of
  that level, transformed with the chart's y and scale so it follows the pan.
- **Keyboard.** Cards use a roving tabindex, a gold focus ring, arrows walk
  columns (Left and Right jump between sibling columns, Up and Down walk a
  stacked column or go to the parent and the first child, opening a collapsed
  branch on the way), Enter opens the panel, Escape closes it or clears the
  search; the focused card is panned into the frame when it sits outside it.
- **The panel.** It opens below the frame with a pointer tail at the frame's
  bottom edge under the selected card's x (hidden when the card is out of the
  frame horizontally), the page scrolls to it, and a sticky "Back to chart"
  chip appears once the frame has scrolled away and returns focus to the
  card. Everything CR07 built is still there, organised behind a tab strip
  defined as one array (`UnitPanelTabs.tsx`) with counts: Overview (mandate
  in both languages with the source), People, What it owns, Policies and
  procedures (the CR07 PolicyTabs, unchanged), Sub-units. The panel registers
  the unit with the Ask NPC launcher ("Ask about this unit").
- **Request change.** The unit head (or a Department Head of the unit) sees
  a Request change button; the form takes what and why, every Super Admin is
  notified with a link to Settings > Organisation, and the head's own
  requests appear as chips with Open, Applied or Declined status and the date.
- **Settings > Organisation.** The editor tree with a drag handle per row
  (pointer events with capture, so mouse, pen and touch behave alike, with
  edge auto-scroll for a tree taller than the screen), a live preview that
  redraws the tree with the unit under the hovered target, then a
  confirmation naming what moves with it (sub-units, people, documents,
  policies, owned strategy items, indicators, lessons, open handovers, HR
  risks, processes, other links) from one impact query; a plus on every row
  to add a child at the next level down; inline rename in both languages;
  the kebab with edit (code, level, head by user or by name and title,
  mandate, responsibilities, sort), move, deactivate, reactivate and delete.
  Delete and deactivate open the risk dialog that lists everything beneath
  and disables the confirm until a unit outside the subtree is chosen;
  nothing is ever orphaned because every column that points at a unit is
  registered once (`UNIT_REFS` in the service) and moved before the row
  goes. Every mutation answers with its inverse and the tab keeps the last
  ten in a session stack behind a sticky Undo pill; every save takes an
  `org_snapshots` row and the snapshot list restores through the same
  validated path after saving the present state. The CSV import previews
  with per-row status (new, update, unchanged, error) and the reason for
  every error, and is blocked until the file is clean. The change requests
  list resolves or declines and notifies the requester. The CR07 sections
  (members, re-sync diff, Strategy Office, knowledge types) are kept as they
  were.
- **RTL.** The Arabic chart keeps its physical left origin (as CR07 decided)
  with the rail on the right, the controls on the left and the tail under the
  card; the panel, the tab strip and every editor dialog mirror through
  logical properties; the CSV grid keeps its code columns LTR.

## Findings and fixes applied during the review

1. **High, fixed.** The first probe run showed ArrowUp from a sibling column
   landing on the neighbouring column instead of the parent, and Left and
   Right walking the stacked cards as if they were a row. The keyboard model
   now treats each branch sibling as its own column and the whole stack as
   one column: Left and Right move between columns, Up and Down move inside
   the stack and to the parent or the first child. Verified in both locales.
2. **High, fixed.** Drag and drop was written with HTML5 drag events, which
   never fire for touch and which the probe could not drive; the drag now
   runs on pointer events with capture, and because the tree is taller than
   any screen, a rAF loop scrolls the page while the pointer rests near an
   edge and re-reads the target underneath. The kebab's "Move under another
   unit" remains the keyboard route.
3. **Medium, fixed.** The rail's level labels were clipped at 96px in
   English ("SECRETARY GENERAL" needs two lines); the label now wraps to
   three lines with tighter tracking. A first attempt to centre the tree in
   the whole frame put the leftmost column under the rail at fit and hid the
   pointer tail; the zoom's viewport is the frame beside the rail, so a
   fitted tree never sits behind it.
6. **Medium, fixed.** The panel's tab strip fell back to Overview whenever
   the server tree refreshed for the same unit (a sent change request, the
   Ask launcher), and the Policies tab's content was absent from the server
   HTML, which the CR07 smoke selector reads. The reset now keys on the unit
   id, and every tab panel is rendered with `hidden` so the document is
   complete and each tab keeps its state.
7. **Medium, fixed.** The smooth scroll to the panel was dropped by the
   browser while the panel was still growing; the page now scrolls when the
   selection is made, when the panel's height animation completes and when
   its body arrives, so the panel lands under the top bar every time.
4. **Medium, fixed.** The card had five rows in CR07 (level, name, other
   language, head with title, staff and policy chip) and could not fit 88px;
   it now carries the level and the headcount on one line, the name on up to
   two, and the head with a compact policy count on the last. The other
   language name and the head's title live in the panel and in the card's
   tooltip.
5. **Low, fixed.** "Import 0 rows" read oddly before a preview; the button
   says "Import" until a preview has counted the rows.
8. **Low, fixed.** The rail label "DEPARTMENT" broke mid-word at the first
   width; the rail is 108px and words no longer break inside.

## Deliberate deviations and limitations

- **Two hydration warnings that are not the organisation's.** `/settings?tab=organisation`
  reports a hydration mismatch in the shared `SettingsTabs` (its CR05 deep
  link reads `window.location` inside a `useState` initialiser, so the server
  renders Users and the client renders Organisation); the fix belongs to the
  shared file and is handed to the coordinator. `/ar/organisation` sometimes
  reports a Radix `useId` attribute mismatch that also appears on `/ar/home`
  with a different diff; it comes from the shell's client components, not
  from the chart, which renders the same tree on both sides.
- **The 390px captures show the app shell's rail not collapsing at phone
  width**, so every page, this one included, is squeezed to about 160px. The
  list view is the default there as the change request asks; the rail is the
  shell's concern (CR08 Section 2).
- **Undo of a delete or deactivate restores the row, its children and every
  moved reference**, except a membership or policy link that was dropped
  because the target already held the same pairing; the API records those as
  `deleted` and leaves them.
- **Restoring a snapshot never deletes.** A unit that exists now but not in
  the snapshot is kept, inactive, under the restored root, so every reference
  keeps resolving; the count is reported in the toast.
- **Change requests notify; they do not yet message.** Section 1.2 also asks
  for a message to the Super Admin through the Section 9 messaging module,
  which another agent is building; the hook is one call in
  `createChangeRequest()` once that service exists.

Closing: no High or Critical HIG findings remain.
