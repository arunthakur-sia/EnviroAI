# CR05 Sections 5-6 review: the HR Knowledge Dashboard and the access model

Screens reviewed as images: `hr-overview-{en,ar}.png`, `hr-overview-en-full.png`, `hr-departments-en.png`, `hr-people-en.png`, `hr-handovers-en.png`, `hr-risks-{en,ar}.png`, `access-user-en.png`, `access-roles-{en,ar}.png`, `access-domains-en.png` in `data/screenshots/cr05/`.

## Self-critique (three sentences)

The HR overview earns trust by refusing to decorate: three rings whose formulas are printed under them, risk counts that match the register, and a department heat strip whose worst cell (the Secretary General's office at 0 with 37 open risks) is exactly where the seeded single-point-of-failure lives, so the page tells one coherent story. The people rows do the CR's hardest job well - knowledge owned, backups, readiness components, and the four actions sit in one expansion without ever showing a point or a badge. The roles portal grid is the weakest surface aesthetically (a plain checkbox matrix), but it is the one place where a plain matrix is the honest control, and every checkbox writes through immediately with the change audited.

## Findings

- Fixed during implementation: the "no linked documents" risk rule initially produced 174 low rows because initiatives hold their paper through their projects; the rule now reads the subtree and skips not-started nodes, and the organisation continuity ring averages department scores instead of flooring at zero (DECISIONS 69).
- Low: the roles list still shows "0 members" in its member counts (a pre-existing subquery display issue outside CR05's scope); the portal grid above it is the CR05 surface and is correct.
- Checked and clean: overdue handover, single-point-of-failure (leaving person escalates to critical), outdated content, overdue update, and no-backup rules all materialise with named act-on owners and working act links; the handover page groups the generated checklist by item kind with bulk assignment and per-item successor/status writes that recompute completion and pay the capped points; capture sessions open Add Knowledge in Speak mode with the handover pre-linked and publish as Expert Insights; the risks register filters, groups, resolves with a note, and draws the 12-week trend; the preview banner is gold, labelled, and its exit works while the middleware refuses writes; the invite flow shows the link inline (no local mail server) and logs it; the Access dialog cycles role/grant/deny with reason and expiry and shows the trail.

Closing statement: no High or Critical HIG findings.
