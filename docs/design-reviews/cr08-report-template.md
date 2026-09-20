# CR08 5.5 design review: the report docx template

Self-critique of the page designs from the docx-preview page images in
`data/reports/previews/samples/template-sample-en/` and `template-sample-ar/`
(13 pages each), rendered from `scripts/dev-probes/cr08-template-sample.ts`.
Findings are listed per page type with severity (Critical, High, Medium, Low)
and how each was fixed. The preview method and its limits are in the module
report; anything the preview cannot show (Word's own pagination, tab leaders
in the contents list) is marked as verified structurally in the XML instead.

## Method

- Every page type was rendered in both languages and read at 1.5x.
- Structural checks (`scripts/dev-probes/cr08-template-check.mjs`): the zip,
  document.xml, 9 header and 9 footer parts, 25 image parts, one docx section
  per report section, the TOC field, the palette, the RAG tints, page breaks,
  Heading1 and Heading2 styles, the PAGE field and "SiaNexus" in the footer;
  for Arabic, `w:bidi` paragraphs, `w:rtl` runs, `w:bidiVisual` tables and
  Sakkal Majalla in the `w:cs` slot; for English, none of the bidi markers.
- The no-rasteriser build (`REPORT_NO_RASTER=1`) was rendered and previewed too.

## Findings and fixes

### Cover (EN and AR)

- High, fixed: the first render showed the title in a black serif fallback at
  16px, clipped, and the key figure clipped. Cause: font stacks with double
  quotes interpolated inside double-quoted `style` attributes, which ended the
  attribute early so no style applied. All font stacks now use single quotes;
  the cover renders Fraunces (EN) and Noto Kufi Arabic (AR) in white at the
  size the title length allows (52 to 30px), subtitle in Inter or IBM Plex Sans
  Arabic, the period as a tracked eyebrow, the year in gold Fraunces at the
  band's bottom edge, the Sadu lattice at 8 percent.
- Medium, fixed: the AR cover must mirror. The logo sits at the top right, the
  title block is `dir="rtl"`, the year numeral sits bottom left; the lower
  half (chip, type name, scope, key figure, wordmark, generated line) is
  bidi and start-aligned, which the preview shows at the right.
- Low, accepted: the cover chip is a shaded run (square corners) because Word
  has no native rounded chip; the closing page chip is an image and is round.

### Contents

- High, fixed: the English document rendered mirrored (numeral at the end,
  header swapped, full stops at the start of lines) because the preview's RTL
  detection matched `<w:bidi w:val="false"/>`. The detection now requires a
  bidi element without a value or with a true value, and English paragraphs no
  longer emit bidi or rtl attributes at all.
- Medium, accepted (preview only): the dotted leaders and right-aligned page
  numbers are Word tab stops with a dot leader; docx-preview computes tab
  stops only approximately even with `experimental: true`, so the preview
  shows the page number after the title. The XML carries the tab stops.
- Low, accepted: page numbers in the static list are estimates from the block
  measure (the docx has no layout engine); the TOC field under the list gives
  the exact numbers once Word updates fields on open.

### Section opener

- High, fixed: a two-line title ("NDS3 outcomes overview") overlapped itself
  because the line spacing was emitted without a rule and the preview treated
  it as exact. Every paragraph now sets `lineRule: auto` explicitly.
- Medium, fixed: the numeral in maroon-100 (Fraunces 196px) sits in the start
  cell and the title bottom-aligned beside it; the AR opener mirrors through
  `bidiVisual` (numeral at the right). The lead carries the maroon start-side
  rule (right border in AR), the key figure is a Fraunces image.
- Low, accepted: the opener is a deliberately quiet full page; the body starts
  on the next page.

### At a glance

- High, fixed: in the AR tiles an English delta such as "+3 vs 2025" was
  bidi-reordered to "vs 2025 3+". The value, unit and delta spans now carry
  `unicode-bidi: plaintext`, so LTR strings read left to right inside RTL
  tiles. Labels are Arabic and right-aligned, rows lay out right to left.
- Medium, fixed: tile rows are rendered as one image per row of four so the
  tiles align exactly in Word and in the preview; a partial row starts at the
  start side.
- Low, accepted: `KpiTile` carries no direction ("up is good"), so the delta
  arrow takes the tile's tone colour rather than ok or danger; sparklines are
  not drawn because the contract has no series on the tile (proposed addition
  in the report).

### Body (two columns)

- High, fixed: the second column was clipped at the page edge because the pull
  quote inside a column was built at full text width. Quotes, callouts and key
  figures now take the column width; wide blocks (tables, scorecards, charts,
  figures, KPI rows) leave the flow and render full width between the column
  tables.
- Medium, fixed: a short narrative (an intro of a few lines) rendered as one
  narrow left column with an empty right column; narratives of nine estimated
  lines or fewer now render at full width.
- Medium, accepted: docx-preview does not paginate flowing text, so a long
  body section shows as one tall page in the preview. Word paginates the
  column table row across pages. The flow is chunked per estimated page (42
  lines per column) and a heading never ends a column.
- Low, fixed: run-in headings (level 3 followed by a paragraph) merge into one
  paragraph with a bold maroon lead-in in both languages; level 2 headings
  keep with the next paragraph.
- Low, accepted: the AR numbered list and bullets mirror in Word (logical
  indents); the preview swaps margins for RTL paragraphs to match.

### Chart page

- Medium, fixed: the unit label ("million") collided with the top tick label;
  the plot top moves down when a unit is shown and the unit sits above the axis.
- Medium, fixed: the primary series' end label sat on the dashed forecast line;
  when a forecast series exists the label moves above the point.
- Medium, fixed: the chart section left a mostly empty intro page; a short
  intro now shares the first chart's page and later charts get their own.
- Low, accepted: the palette validator flags the brand colours (maroon outside
  the lightness band, gulf chroma, gold contrast 2.3:1 on white). The CR fixes
  these colours; the secondary encodings the validator asks for are present:
  a legend for two or more series, distinct mark types (solid, thin, dashed
  gold, dashed maroon), an end label on the primary series and on the target,
  hairline solid gridlines, and text in ink tokens never in the series colour.
- Low, accepted: the plot stays left to right in Arabic (time reads the same
  way, as in the app); legend and labels take IBM Plex Sans Arabic and sit at
  the right.

### Scorecard

- Verified: RAG cells are tinted (ok, warn, danger light tints from the app
  tokens) with the darker text of the same pair, trend glyphs are 12px images
  in the cell's text colour, the legend chips under the table name the three
  states, the source line follows. AR mirrors (label column at the right).
- Low, accepted: the sample writes the status words in English in the AR
  scorecard because `cells[].text` is a plain string in the contract; the
  section writers must localise cell text.

### Sources and closing

- Verified: numbered sources with a hanging indent, the number in maroon, the
  detail in ink-600, URLs as gulf hyperlinks.
- High, fixed: the closing page showed the wordmark as dark letters on a white
  rectangle because `public/brand/SiaNexus_logo_white.png` is the ink mark on
  an opaque white ground. The closing page now draws the transparent mark
  through an SVG colour matrix, giving a white monochrome wordmark on maroon.
- Verified: full maroon page with the lattice, the NPC white logo at the top
  start, the line and contact in white at 86 and 72 percent, the
  classification as a round outlined chip; AR mirrored.

### Running header and footer

- Verified: header (report title at the start in ink-400, section name at the
  end in maroon, hairline under), footer (classification, page number, SiaNexus,
  hairline above) on every page except cover and closing, mirrored in AR via
  `bidiVisual` tables. Page numbers are Western digits in both languages
  because the PAGE run is not marked rtl.

### Fallback build (no Playwright)

- Medium, fixed: the CR02-style shaded-bar chart table drew a negative value
  as a long maroon bar; negative values now read in ink-200.
- Low, accepted: the fallback cover is a shaded table with Calibri and no
  lattice; the closing band fills two thirds of the page; KPI tiles are sand
  cells. This path only runs where Playwright cannot load.

## Contrast

All text pairs used: white on maroon 8A1538 (9.3:1), ink 1E1B1F on white,
ink-600 5B6470 on white (5.5:1) and on sand F4F0E8 (5.0:1), maroon on
maroon-100 (6.9:1), ok 27704F on E3F1EA, warn 8A5C10 on F9EFDD, danger B3261E
on F9E5E4 (the CR05 AA-fixed pairs), gold 22px+ numerals on maroon (4.6:1,
large text). ink-400 8A93A0 is used only for small metadata (source lines,
axis ticks, the generated line) as the app does.

Closing: no High or Critical HIG findings remain.
