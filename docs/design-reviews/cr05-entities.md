# CR05 Sections 2-3 review: responsible entities, leads, stakeholders

Screens reviewed as images: `entities-lanes-en.png`, `entities-drawer-en.png`, `entities-bylead-{en,ar}.png`, `entities-settings-en.png`, `stakeholders-drawer-{en,ar}.png`, `stakeholders-page-en.png` in `data/screenshots/cr05/`.

## Self-critique (three sentences)

The lead chips read instantly on the lane cards because the kind glyph does the sorting work (building for ministries, the NPC emblem for internal departments) and the gulf tint keeps them subordinate to the title, while joint leads simply stack as two chips without inventing a new pattern. The By-lead view is honest information architecture: departments first, then entities ranked by portfolio size, each row a completion ring plus counts, expanding in place to the same lanes used everywhere else, so nothing new has to be learned. The weakest moment was the stakeholder rows' secondary-language name hugging the primary name; the margin is now enforced with an inline-block so the two scripts breathe.

## Findings

- Fixed during review: the secondary-language name in stakeholder rows rendered flush against the primary name in mixed-direction text; the margin now applies to an inline-block span.
- Low: in the Entities register the Arabic secondary line right-aligns within the name column, which reads slightly detached at wide widths; it keeps the Arabic aligned to its natural reading edge, so it stays.
- Checked and clean: the drawer shows lead chips in the header and a Supporting row only when supporting entities exist; the stakeholder section renders in the CR's fixed order (sponsor, owner, manager, team, experts, external partners) with role chips, expert domain chips and notes, mailto actions, and Profile links into the Expert Network; a person with two roles appears twice; the Lead filter survives outcome and drawer navigation in the URL (`l=`); the By-lead view mirrors correctly in RTL; the register's machine-generated Arabic names carry a review flag.

Closing statement: no High or Critical HIG findings.
