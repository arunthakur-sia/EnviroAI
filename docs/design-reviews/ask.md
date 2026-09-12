# Design review: Ask NPC (landing and conversation workspace)

Reviewed 2026-09-12 with the apple-design skill. Scope: `/ask` (landing) and `/ask/c/[id]` (conversation workspace) only.

**Context.** Desktop-first bilingual (EN/AR, full RTL) web app, Next.js + Tailwind, for Qatar's National Planning Council. As a web app it gets Apple's principles and foundations (accessibility, color, typography, layout, writing) plus the generative AI lens, not Apple's platform component conventions. Artifacts: design tokens (`C:\npckms\src\styles\globals.css`), three screenshots (`data\screenshots\cr01\ask-en.png`, `ask-ar.png`, `conversation-en.png`), and source (`src\app\[locale]\(app)\ask\page.tsx`, `AskLanding.tsx`, `ask\c\[id]\ConversationClient.tsx`, `src\components\nexus\Workspace.tsx`, plus `AnswerStream.tsx`, `IndicatorTile.tsx`, `ui\primitives.tsx`, `ui\overlays.tsx` as shared dependencies). Contrast ratios below are computed from the token hex values, not estimated from screenshots. Tailwind px values are treated as pt at 1x. Limits: no AR conversation screenshot, so the workspace's RTL rendering is verified from code (logical properties throughout), not visually; streaming and toast behavior is read from code, not observed live.

References loaded: `accessibility.md`, `layout.md`, `typography.md`, `color.md`, `writing.md`, `generative-ai.md`, `loading.md`. (`feedback.md` is not present in this skill's references; interaction findings without a page to cite are labeled judgment.)

---

### Summary

Ask NPC has a real thesis: an analyst's desk, not a chatbot. Answers arrive as a cited dossier (strategy cards, indicator tiles, documents, lessons, signals, people) on a paper-and-ink surface, with human experts woven in wherever the AI runs out. The identity is strong and the fallback-to-humans design is genuinely better than most AI products. But the page currently fails on three fronts that must be fixed before anything else: two text tokens (ink-400, gold-500) are used for small reading text at 2.4:1 to 3.3:1, the streamed answer and its error state are invisible to screen readers, and a conversation can be permanently deleted in one click with no confirmation. The AI copy also promises the one thing no AI system can promise ("Nothing is invented").

**Overall rating: Critical issues.**

---

### Critical

**C1. Small reading text fails contrast minimums across both screens.** [Critical]

- **What**: Computed from the tokens on their actual surfaces:

  | Pair | Ratio | Needs |
  | --- | --- | --- |
  | ink-400 `#928B93` on white | 3.31:1 | 4.5:1 |
  | ink-400 `#928B93` on sand-50 `#FBF9F5` | 3.15:1 | 4.5:1 |
  | ink-400 `#928B93` on sand-100 `#F4F0E8` | 2.92:1 | 4.5:1 |
  | gold-500 `#C9A24D` on white | 2.40:1 | 4.5:1 |

  ink-400 is used for regular-weight text at 10 to 12px in: the grounded hint (11px, `AskLanding.tsx:74`), conversation timestamps (11px, `page.tsx:104`), strategy card meta rows (11px, `Workspace.tsx:333`), target/gap lines (11px, `Workspace.tsx:387`), document page numbers (11px, `Workspace.tsx:422`), the hidden-sources note (12px, `Workspace.tsx:553`), the pin popover loading text (12px, `ConversationClient.tsx:212`), tile footers (11px, `IndicatorTile.tsx:59`), and every placeholder (`primitives.tsx:65,80`). The 12px semibold section labels (`Workspace.tsx:269`) sit in a gray zone: the HIG's bold row allows 3:1, but semibold 12px is far below the 14pt bold threshold WCAG intends, and 3.31:1 leaves no margin. gold-500 is worse: it carries the KPI target reading text in strategy cards (12px, `Workspace.tsx:352`) at 2.40:1.
- **Why**: `accessibility.md › Vision`: "Strive to meet color contrast minimum standards", with the table "Up to 17 pts | All | 4.5:1".
- **Fix**: Reassign roles, not just values. Reading text at 12px and below moves to ink-600 `#5E5760` (6.98:1 on white, 6.64:1 on sand-50). If a lighter tertiary tone is wanted, retune ink-400 to about `#767078` (4.82:1 on white) and keep the old value for decorative glyphs and disabled states only. Replace `text-gold-500` on KPI targets with ink-600, or darken text-role gold to about `#8A6D1F` (4.90:1 on white) and keep `#C9A24D` for icons and fills.

**C2. The streamed answer, its completion, and its failure are silent for screen readers.** [Critical]

- **What**: Nothing in the flow declares a live region. The thinking chips, the token-by-token answer, the confidence meter, and the final workspace sections appear with no announcement (`Workspace.tsx:294-561`, `AnswerStream.tsx:130-163`). The error paragraph is a plain `<p>` (`ConversationClient.tsx:247-249`), and toasts for share/pin/delete are visual only (verified for this page's markup; the toast component itself was not in scope). A screen reader user submits a question and hears nothing, ever.
- **Why**: `accessibility.md` (intro): "Perceivable. Your interface doesn't rely on any single method to convey information." The specific ARIA mechanics are my judgment: a full token stream should not be announced word by word, but arrival and failure must be.
- **Fix**: Add one visually hidden `role="status"` (`aria-live="polite"`) node that announces the current chip label while gathering and "Answer ready" when the `final` event lands; give the error paragraph `role="alert"`. Announce "Streaming stopped" if a stop control is added (see H2).

**C3. Delete is one click, permanent, and unconfirmed.** [Critical]

- **What**: The trash button in the header (`ConversationClient.tsx:217-219`) calls `remove()` (`:153-160`), which fires `DELETE` immediately, shows the toast "Conversation deleted.", and navigates away. No confirmation, no undo, and the button is icon-only while its siblings (Share, Export, Pin) have visible labels, so a stray click on the last ghost button destroys the whole conversation.
- **Why**: `accessibility.md › Cognitive`: "Always ask for confirmation twice whenever people perform an action that's difficult to recover from" (written for Assistive Access, but the principle is general). The one-warning baseline for destructive, irreversible actions is the skill's interaction lens; labeled judgment.
- **Fix**: Wrap it in the existing Radix `Dialog` (`ui\overlays.tsx`) with the question, a `danger` Button ("Delete conversation") and Cancel; or soft-delete server-side and put an Undo action in the toast. Give the trash button a visible label like its siblings.

---

### Improvements

**H1. The AI copy promises zero hallucination.** [High]

- **What**: The landing hint reads "Answers come only from NPC sources, with citations. Nothing is invented." (`messages\en.json:476`, rendered at `AskLanding.tsx:74`). Nothing anywhere in the conversation view says AI output can be wrong. The claim is directly contradicted by the artifact itself: `conversation-en.png` shows an answer containing "[seeded illustrative values]" beside real-looking national statistics.
- **Why**: `generative-ai.md › Inputs`: "it's important to clearly communicate that AI-generated content may contain errors." The grounding claim (retrieval only from NPC sources) is legitimate; the "Nothing is invented" absolute is not, because a model can still misread, miscombine, or misattribute the sources it cites.
- **Fix**: Reword to claim what the system actually guarantees, e.g. "Every answer cites NPC sources. Verify against the citations; the AI can still misread them." Repeat a one-line version near each answer or in the sources footer, in both languages.

**H2. No way to refine, revert, retry, or stop.** [High]

- **What**: An answer offers follow-up chips only. There is no Retry/Regenerate on a turn, no way to edit the previous question, and no Stop while streaming (the send button is simply disabled, `ConversationClient.tsx:281`). On failure, the user's message is already appended to the transcript (`:60`), the composer is cleared (`:61`), and the error strip ("Something went wrong. Try again.") has no button, so "try again" means retyping the whole question.
- **Why**: `generative-ai.md › Outputs`: "surfacing controls like Edit, Undo, Retry, or Adjust near generated content preserves people's agency while still letting them benefit from automation."
- **Fix**: While streaming, swap the send button for Stop (abort the fetch via `AbortController` in `useAnalyst`). On error, render a Retry button that resends the last user turn. Add Regenerate to the latest answer, and let clicking one's own bubble refill the composer.

**H3. The answer body renders as a raw evidence dump, under a "High confidence" badge.** [High]

- **What**: `conversation-en.png` shows the answer exposing internal retrieval records: field syntax like `(qatarization_rate_private) unit=percent direction=up_good`, seed annotations "[seeded illustrative values]", excerpts cut mid-word ("measured co", "translated titl"), non-sequential citation markers (1, 2, 3, 4, 9, 10, 11, 15, 16, 17), and mojibake where Arabic excerpts appear inside the English answer. Directly beneath sits the green "High confidence" meter. Part of this is the analyst pipeline, not this page; but the renderer contributes: `AnswerMarkdown` (`AnswerStream.tsx:130-163`) supports only bold and `[n]` chips over `whitespace-pre-wrap`, so even a well-formed answer with headings, lists, or tables would degrade to flat text.
- **Why**: `generative-ai.md › Best practices`: "Keep people in control" depends on output people can actually read; the confidence meter beside malformed output miscalibrates trust (judgment). Hallucination-awareness guidance in `generative-ai.md › Inputs` assumes the surface distinguishes evidence from prose.
- **Fix**: In the UI layer: render real markdown (headings, lists, tables) with the existing citation-chip pass; set `dir="auto"` and the Arabic font stack on excerpt runs so embedded Arabic renders correctly; renumber citations sequentially at display time. In the pipeline: strip internal field names and seed annotations before display, and suppress the confidence meter when the answer failed post-processing checks.

**H4. Answers carry no AI attribution inside the conversation, including for shared viewers.** [High]

- **What**: Assistant turns are anonymous white cards (`ConversationClient.tsx:233-239`). The thread view elsewhere labels AI output "SiaNexus Intelligence" (`messages\en.json:489`), but this workspace never says AI anywhere on screen; a colleague opening a shared link, or reading the exported .docx, sees what reads as staff-authored analysis. The landing discloses AI only obliquely ("Experts pick up what the AI cannot").
- **Why**: `generative-ai.md › Transparency`: "Letting people know when and where your app uses AI sets expectations", and "Never trick someone into thinking they're interacting with or viewing content authored by a human."
- **Fix**: Add a small caption row to each assistant card (the existing "SiaNexus Intelligence" string plus the sparkle icon), keep it in shared view and in the .docx export header.

**M1. No feedback affordance on answers in the workspace.** [Medium]

- **What**: `AnswerFooter` with thumbs up/down exists (`AnswerStream.tsx:262-345`) but `AnalystAnswer` never renders it, and `ConversationClient` does not import it. The conversation, the product's main AI surface, collects no signal.
- **Why**: `generative-ai.md › Continuous improvement`: "Consider offering a quick and easy way to give positive and negative feedback, like simple thumbs-up and thumbs-down buttons."
- **Fix**: Render the existing thumbs pair at the end of each completed assistant turn, wired to the same feedback endpoint the thread view uses.

**M2. Answer text runs about 105 to 115 characters per line.** [Medium]

- **What**: The column is `max-w-4xl` (896px) and answer text fills the card (`ConversationClient.tsx:174,233`). The design system already has `.measure { max-width: 760px }` (`globals.css:250-252`) but this page does not use it.
- **Why**: `layout.md › Guides and safe areas`: system layout guides exist to "restrict the width of text for optimal readability."
- **Fix**: Apply `.measure` to `AnswerMarkdown`'s container while letting tile grids keep the full card width.

**M3. The Pin popover is a hand-rolled overlay with no dismissal contract.** [Medium]

- **What**: An absolutely positioned `<span>` toggled by state (`ConversationClient.tsx:192-216`): Escape does not close it, clicking outside does not close it, and focus is dropped (autoFocus in, no return). Radix `Dropdown` and `Dialog`, already styled in `ui\overlays.tsx`, handle all of this.
- **Why**: Judgment (interaction lens): transient views need an obvious, standard way out; keyboard users must be able to leave without picking a collection.
- **Fix**: Replace with `Dropdown` + `DropdownItem` per collection (also removes the odd select-inside-popover pattern).

**M4. Inline citation chips are 18px tall interactive targets with 10px type.** [Medium]

- **What**: `CitationChip` is `h-4.5 min-w-4.5` = 18x18px at `text-[10px]` (`AnswerStream.tsx:170`). Desktop minimum control size is 20x20pt, and these are primary navigation into the evidence.
- **Why**: `accessibility.md › Mobility`: "Strive to meet the recommended minimum control size for each platform" (macOS minimum 20x20 pt).
- **Fix**: Raise to `h-5 min-w-5` (20px) and 11px type; padding already separates them from surrounding text. Keep the source list rows as the comfortable path.

**M5. The feature answers to three names.** [Medium]

- **What**: Landing title "Ask NPC", conversation back link "Ask SiaNexus" (`messages\en.json:469,560`), AI byline "SiaNexus Intelligence" (`:489`), plus the search placeholder "Search SiaNexus". Two brands and three labels for one feature on two adjacent screens.
- **Why**: `writing.md › Best practices`: "Consistency builds familiarity, helping your app feel cohesive, intuitive, and thoughtfully designed."
- **Fix**: Pick one feature name (the nav and h1 say "Ask NPC", so likely that) and use it for the back link; keep "SiaNexus Intelligence" solely as the AI byline.

**M6. Status chip text tones miss 4.5:1 at 11px.** [Medium]

- **What**: Chips are 11px medium (`primitives.tsx:118`). Computed: warn `#B7791F` on warn-light `#F9EFDD` = 3.19:1 (the "Open" chip on the landing list, the "illustrative" chip on tiles); ok `#2E7D5B` on ok-light `#E3F1EA` = 4.29:1 ("Verified", "Answered" is gulf at 5.13:1 and passes).
- **Why**: `accessibility.md › Vision` contrast table, "Up to 17 pts | All | 4.5:1".
- **Fix**: Darken text-role values only: warn text to about `#8F5E14` (4.87:1 on warn-light), ok text to about `#256B4D` (5.48:1 on ok-light). Fills stay as they are.

**L1. Two ellipsis conventions.** [Low]

- **What**: `askPage.placeholder` ends in three periods "..." while `followUpPlaceholder`, `pinTo`, and `loading` use the ellipsis character "…" (`messages\en.json:474,573,569,51`).
- **Why**: Judgment (craft lens): one convention per app.
- **Fix**: Use "…" everywhere, in both message files.

**L2. The two composers drift apart.** [Low]

- **What**: Landing: 3 rows, `text-base`, send inset `bottom-3 end-3`, no icon (`AskLanding.tsx:37-58`). Conversation: 2 rows, default `text-sm`, `bottom-2 end-2`, gold Sparkles prefix (`ConversationClient.tsx:263-289`). Same job, two specs.
- **Why**: Judgment (craft lens): the composer is this feature's signature control; it should be one component.
- **Fix**: Extract one AskComposer with a size prop; keep 16px input text in both (it is the primary input).

**L3. Verified sources are marked by a bare 10px check glyph.** [Low]

- **What**: `SourceList` renders verification as the character "✓" alone (`AnswerStream.tsx:242-246`), with no text alternative; the landing list, by contrast, uses a labeled "Verified" chip.
- **Why**: `accessibility.md › Vision`: "Convey information with more than color alone. Offer visual indicators... in addition to color"; a lone glyph also reads poorly to screen readers (judgment).
- **Fix**: Reuse the labeled chip, or give the glyph a visually hidden "Verified" text and a tooltip.

**L4. Possible double-render of the finished answer.** [Low]

- **What**: `onFinal` appends the turn while `analyst.streaming` is still true until the stream closes, and `liveTurn` renders whenever `streaming` is true (`ConversationClient.tsx:162-171,242-246`; `Workspace.tsx:223-251`), so the completed answer may flash twice for a frame or two. Runtime-only; verify in the browser.
- **Why**: Judgment (interaction lens): completion should feel like a single settled state.
- **Fix**: Suppress `liveTurn` once `analyst.final` exists, regardless of `streaming`.

**L5. Smooth auto-scroll ignores Reduce Motion.** [Low]

- **What**: `scrollIntoView({ behavior: "smooth" })` on send (`ConversationClient.tsx:76`). The global reduced-motion CSS (`globals.css:229-232`) cannot reach JS-driven scrolling.
- **Why**: `accessibility.md › Cognitive`: with Reduce Motion on, "ensure your app or game responds by reducing automatic and repetitive animations."
- **Fix**: `behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"`.

**L6. The landing grid leaves a dead half.** [Low]

- **What**: `ask-en.png` shows Recent threads pinned to the left column with the entire right half of a 1440px canvas empty, because the two-column grid (`page.tsx:82`) renders one child when the user has no conversations yet.
- **Why**: `layout.md › Best practices`: "Make essential information easy to find by giving it sufficient space"; a permanently empty region reads as a bug (judgment).
- **Fix**: When only one list exists, let it span both columns (`lg:col-span-2`) or cap the grid to one column.

---

### Craft notes

The page has a point of view and it holds. The signature is the answer-as-dossier: a question comes back not as chat bubbles but as an analyst's desk of labeled sections (Strategy, Numbers, Documents, Lessons, Signals, People), each rendered with the product's own cards, ending with the humans who can pick it up. That is the thing this design will be remembered by; protect it. The surface is close to the fashionable warm-cream-plus-serif template, but here it is earned: the maroon is Qatar's flag maroon (#8A1538), the sand is desert paper, Fraunces carries display while Kufi carries Arabic headings, and the whole system is documented in tokens. It could not be mistaken for a generic AI chat skin. [Judgment]

One accessory to remove [Low]: the gold Sparkles inside the conversation composer (`ConversationClient.tsx:264`). It is decorative, it repeats the AI signal the thinking chips already carry, and at gold-500 on white (2.40:1) it barely exists visually. Removing it also resolves the composer drift in L2. Gold generally is doing too many small jobs (composer icon, chip icon, KPI targets); after the C1 fix, reserve it for the KPI target accent alone.

The structure encodes information honestly: section labels name real content types, citation numbers point at real sources, the confidence meter uses count (1 to 3 bars) plus a text label rather than color alone. The boldness is spent in one place (the dossier), and the chrome stays quiet. That is the right distribution.

---

### What works

Keep these; they should survive every fix above.

- **The human fallback is woven in, not bolted on.** "Experts pick up what the AI cannot" on the landing, a People section with "Ask them" routing inside answers, and an Unanswered board. This is the strongest implementation of `generative-ai.md › Best practices` ("When possible, consider offering a non-AI fallback") in the product.
- **Specific streamed progress.** The thinking chips stream bilingual stage labels while gathering (`Workspace.tsx:296-312`), exactly the pattern `generative-ai.md › Outputs` asks for: instead of "Processing…", say what is actually happening. Also satisfies `loading.md › Best practices`: "Show something as soon as possible."
- **Citations as first-class UI.** Inline `[n]` chips with hover excerpts and page numbers, a typed source list with indicator/document icons, deep links into `/vault`, `/statistics`, `/strategy`, and an honest "N sources hidden by clearance" note. The Radix tooltip triggers on focus as well as hover.
- **The clearance-aware share toast**: "Shared. The link was copied; any NPC colleague can read it at their clearance." sets expectations in one sentence.
- **Bilingual craft**: logical properties (`ps/pe/ms/me`) throughout, `flip-rtl` on the back arrow, a separate Arabic type scale (6 percent larger, 1.7 line-height), day-rotated example prompts localized per language. The AR landing screenshot mirrors correctly.
- **Motion discipline**: one entrance reveal per page, a breathing caret while streaming, and a global `prefers-reduced-motion` kill switch (`globals.css:229-232`).
- **Keyboard basics**: a visible global `:focus-visible` ring in maroon, Enter to send with Shift+Enter for newline, disabled send on empty input.

---

### Platform notes

- **Web app scope.** Apple's foundations and principles were applied; platform component conventions (menu bar, sheets, tab bars) were not enforced. Vocabulary translated per the skill: semantic tokens = CSS custom properties, VoiceOver = screen reader/ARIA, Dynamic Type = browser zoom and font scaling.
- **Desktop sizing.** Body text 15px against the macOS 13pt default is comfortable. The 10px micro-labels (edition tags, "STATISTIC" tag, citation chip numerals) sit at the platform's absolute minimum; after the C1/M6 recolors they are tolerable, but nothing new should be added at 10px. Buttons (32 to 38px) and the thumbs targets (28px) meet desktop control sizes; only the citation chips (M4) fall under.
- **Text scaling.** Sizes are in px, so user font-size preferences do not scale them (browser zoom does). If the ministry's accessibility bar requires font-size scaling, a rem-based scale would be the single biggest structural change; flagged as an observation, not a finding, since zoom works.
- **Single appearance.** `color-scheme: light` is declared and the design commits to one paper-light look, a defensible choice for a government tool. Note `color.md › Best practices`: "If you define a custom color, make sure to supply light and dark variants"; if a dark mode ever becomes a requirement, the token layer is the place it lands.
- **RTL.** The AR landing mirrors fully (screenshot verified). The workspace uses logical properties throughout, so it should mirror; capture an AR conversation screenshot to close the verification gap, and fix the embedded-Arabic-in-English excerpt rendering from H3 in the same pass.
