# SiaNexus Change Request 02
## Home redesign, Living Strategy restructure, Lessons categories, NPC Nexus Podcast, Add Knowledge by voice, Signals refresh, Extract reports

Applies to the SiaNexus codebase after `NPC_KMS_BLUEPRINT.md` and `SIANEXUS_CHANGE_REQUEST_01.md`. This file is the result of the client presentation. Everything not mentioned here stays as it is.

---

## 0. How to run this change request

1. Read this file fully, then `DECISIONS.md`, `PROGRESS.md`, and the route and component tree. Map the paths named here to the real ones and record the mapping in `DECISIONS.md`.
2. Run unattended. Never stop to ask. Decide, record, continue. Retry failed external calls twice, then use the specified fallback.
3. Order of work: Section 1 (design skill and Home), Section 2 (Living Strategy), Section 3 (Lessons), Section 4 (Podcast), Section 5 (Add Knowledge), Section 6 (Signals), Section 7 (Reports), Section 8 (housekeeping). After each section: typecheck, lint, build, the section's checks from Section 9, EN and AR screenshots into `data/screenshots/cr02/`, and a `PROGRESS.md` entry.
4. Design scope: the client likes the current design system. Keep all tokens, fonts, spacing, and motion. Changes to layout and composition are allowed only on: Home, the personal progress panel, Living Strategy, the Lessons page, and the new screens introduced here. Every other page receives a review report only (Section 1.2), no code changes.
5. AI Mock Mode must keep working for every new AI function, including podcast script generation (mock script), text-to-speech (browser voices), speech-to-text (browser recognition), and report narrative (extractive mock).
6. No em dashes in UI copy, comments, or docs. Every new string goes in `messages/en.json` and `messages/ar.json`, Arabic written natively in a formal but natural register.
7. New environment variables (add to `.env.example` with comments): `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_MARIAM`, `ELEVENLABS_VOICE_HAMAD`, `OPENAI_API_KEY` (optional, Whisper upgrade only). The app must run fully without any of them.
8. When finished: README updated (new sections, screenshots, env notes), smoke script extended and green, then stop.

---

## 1. Home page: complete redesign with the Apple design skill

### 1.1 Install and use the Apple HIG design skill
1. Clone `https://github.com/dickwu/apple-design-skill` into `.claude/skills/apple-design-skill/` so that `SKILL.md` sits at `.claude/skills/apple-design-skill/SKILL.md`. If the `claude install-skill` command exists in this environment, run it as well. If cloning fails, fetch `SKILL.md`, `references/hig-lookup.md`, and the `references/hig/` files for layout, typography, color, motion, accessibility, right-to-left, search, loading, and branding through raw.githubusercontent.com and save them to the same folder.
2. Read `SKILL.md` and `references/hig-lookup.md` completely before touching Home. Then read the guideline files for: layout, typography, color, motion, accessibility, right-to-left, search, loading, branding, and generative AI UX.
3. Run the skill's review process on the current Home page (use the existing screenshots in `data/screenshots/` and the source). Save the review to `docs/design-reviews/home-before.md` with the skill's severity ratings.
4. Rebuild Home per Section 1.3, then run the review again and save it to `docs/design-reviews/home-after.md`. Iterate until nothing rated high or critical remains.

### 1.2 Review-only pass on the rest of the product
Run the skill's review on Vault, Statistics, Experts, Ask NPC, Trends and Signals, and Settings. Save each report to `docs/design-reviews/<page>.md`. Do not change those pages in this change request. The client will decide which findings to act on.

### 1.3 The new Home: calm hierarchy
Principle: one focal point, three purposeful rows, generous space, nothing competing. Use only the existing tokens and components; compose them differently.

Layout (LTR shown; mirror in RTL), content max width 1200px, vertical rhythm of 48px between rows:

```
+----------------------------------------------------------------------------------+
| Good morning, Nada.                                            Saturday 12 Sep    |
|                                                                                  |
|            [  Ask SiaNexus anything about NDS3, statistics, documents, people ]   |
|            example chips: "How are we doing in Qatarization?"  "..."  "..."       |
|            word of the day, one line, quiet caption                              |
+----------------------------------------------------------------------------------+
| TODAY                                                                            |
| +------------------------+ +------------------------+ +------------------------+ |
| | Did you know Qatar     | | What changed in NDS3   | | NPC Nexus Podcast      | |
| | big number, hook, quiz | | 3 rows with RAG dots   | | latest episode, play,  | |
| |                        | |                        | | "Make one from..."     | |
| +------------------------+ +------------------------+ +------------------------+ |
+----------------------------------------------------------------------------------+
| LESSONS LEARNED                                            [ + Add knowledge ]   |
| four LessonCards in a row, category chip on each, "See all" at the end           |
+----------------------------------------------------------------------------------+
| EXPLORE                                              | YOUR PROGRESS             |
| Newest on the shelves (Shelf component, 8 spines)    | redesigned panel (1.5)    |
+------------------------------------------------------+---------------------------+
```

Rules:
1. Hero: the Ask box is the only large element above the fold. Greeting and date are quiet. Word of the day is a single caption line under the example chips, not a strip.
2. Today row: exactly three cards of identical size and internal structure (eyebrow label, title, body, one action). No other card sizes on the page.
3. Removed from Home: mystery shelf, contributor spotlight, the "For you" list, and any remaining onboarding element. "For you" items become notifications; the bell shows an unread count.
4. Section eyebrows ("Today", "Lessons learned", "Explore", "Your progress") use one consistent style: small caps label in `ink-400`, 12px tracking, with a hairline rule, no headings larger than the greeting.
5. Motion: one staggered entrance on load (existing `Stagger` primitive), then only user-triggered motion. Remove any looping or ambient animation from Home.
6. Loading: skeletons match the final shapes exactly (three equal cards, four lesson cards, one shelf, one panel).
7. Empty states: each card has a written empty state with one action, in both languages.
8. Responsive: three cards stack at under 1024px; the progress panel moves below Explore at under 1024px; the Ask box stays first at every width.

### 1.4 NPC Nexus Podcast card on Home
- Name (EN): **NPC Nexus Podcast**. Name (AR): **صوت المعرفة** (Voice of Knowledge), shown as "بودكاست صوت المعرفة" in headings. The Arabic name is used as the podcast brand in Arabic; do not transliterate "Nexus" in Arabic headings.
- Card content: podcast mark (a simple maroon waveform glyph drawn as SVG, no new colours), latest episode title, duration, source ("From: Project X lessons"), a play button that starts the mini-player (Section 4.6), and a secondary action "Make an episode" that opens the podcast composer. If no episodes exist: "No episodes yet. Make the first one from any project or topic."

### 1.5 Your progress panel: complete redesign
Replace the current gamification widgets with one composed panel in the style of Apple Fitness rings, built with existing tokens:
- One large ring (level progress to next level) in maroon, with the level name and points inside in tabular numerals. A thin inner ring in gold shows the weekly contribution streak progress (contributions this week toward the weekly streak).
- Under the ring, a single row of seven small dots for the NDS3 outcomes, filled by depth (sand to maroon) as the knowledge footprint; hovering names the outcome; clicking opens the footprint detail on the profile page.
- One line of text: the next unlock ("120 points to Curator") and the daily streak with the flame glyph.
- Nothing else. Badges, receipts, and history live on the profile page.
- Respect quiet mode: when on, the panel shows only the footprint dots and a "Progress hidden" caption.

---

## 2. Living Strategy: Outcomes > Targets > Initiatives and Projects

### 2.1 Vocabulary (final)
Strategy (NDS3 live, NDS2 and NDS1 archive) > **Outcomes** (النتائج الوطنية) > **Targets** (المستهدفات) > **Initiatives** (المبادرات) and **Projects** (المشاريع). Sector strategies, clusters, and enablers remain as node types but are presented as attributes and filters of targets and initiatives, not as levels in the navigation. Every initiative and project attaches to a target; where the source gives no target, it attaches to the outcome and carries the label "Outcome-level" / "على مستوى النتيجة". Migrate existing nodes accordingly with a script and record counts in `DECISIONS.md`.

### 2.2 Navigation: three-pane drill-down
Replace the current tree-first page with a column navigator (Finder-style) plus a map toggle:
- Pane 1 (Outcomes): seven large cards in a single column, each with number, title, progress ring (share of targets on track), counts of targets, initiatives, projects, and the RAG dot. The selected card is highlighted with the existing selected-row tint.
- Pane 2 (Targets of the selected outcome): compact stack; each row shows target code, title, latest actual vs target as a short bar, status dot, and counts of initiatives and projects. Sort by status, code, or progress. Filter by sector strategy.
- Pane 3 (Initiatives and Projects of the selected target): cards grouped under two headers, Initiatives and Projects, each card with title, owner entity, status, timeline bar, and deliverables count. An "Outcome-level" group appears at the top of pane 3 when the outcome itself is selected and has direct items.
- Breadcrumb above the panes: Strategy edition switch > Outcome > Target, always visible, each crumb clickable; the URL reflects the path (`/strategy/nds3/o3/t3-4`).
- Keyboard: arrow keys move within a pane, right arrow drills in, left arrow goes back, Enter opens the detail page. In RTL the arrow semantics mirror.
- Map toggle: a zoomable radial layout (outcomes on the inner ring, targets on the middle ring, initiatives and projects on the outer ring) using the existing graph component or `d3-hierarchy` partition; clicking a node sets the panes to that path. First-load draw-in once, then static.
- Panes animate with a 180ms slide on selection; no other motion.
- At widths under 1024px the panes become a stacked drill-down (one pane at a time with a back control).
- Detail pages (outcome, target, initiative, project) keep their current content, reorganised in this order: header, status and KPIs, deliverables (projects and initiatives), lessons tab, documents, experts, signals, updates, lineage, "Brief me".

### 2.3 Deliverables on initiatives and projects
- New section "Deliverables" on initiative and project pages: upload (multi-file), list with title, version, date, owner, classification, verification status, download, open in reader.
- Storage: deliverables are Vault documents with `knowledge_type = deliverable`, a `relations` row `about_node` to the node, and inherited outcome and target links. They follow the normal Vault classification and verification rules; the node owner is the default verifier.
- Data: add `deliverable_meta` table: document_id, node_id, deliverable_code (D1, D2, ...), milestone, due_date, delivered_date, acceptance_status (`pending|accepted|revised`).
- Ask NPC: add tool `get_deliverables(node_id)` returning the list with summaries; deliverables are indexed like any document, with chips "Deliverable" and the node code so citations read "Deliverable D3 of Project P-21, p. 12". Include deliverables in the `what_changed` tool output.
- Seed: 3 to 5 deliverables for at least 20 projects, generated as real docx or pdf files with meaningful content (use the existing docx generation), so uploads, reading, and citations work in the demo.

---

## 3. Lessons learned: categories and project linking

### 3.1 Four categories (final)
| Code | EN | AR | Rule |
|---|---|---|---|
| delivery | Delivery Lessons | دروس التنفيذ | From NDS initiatives and projects; node link mandatory |
| external | External Learning | معرفة خارجية | Conferences, external reports, visits, other entities |
| expert | Expert Insights | خبرات الخبراء | Tacit knowledge from staff or external experts, interviews, handovers |
| institutional | Institutional Knowledge | معرفة مؤسسية | NPC processes, governance, ways of working, decisions |
Add `category` to `lessons` (migrate existing rows: linked to a node → delivery; otherwise institutional). Lessons may be short or long; no length limit; the card shows the first 240 characters with "Read more".

### 3.2 Linking
- Node link is the primary way to add a Delivery Lesson: the "Add lesson" action on initiative and project pages pre-fills the node and the category.
- A lesson may link to several nodes; the primary node is shown on the card.
- Initiative and project pages get a Lessons tab listing linked lessons, newest first, with a count badge; outcome and target pages aggregate the lessons of their children.

### 3.3 Lessons page
- Header with the four categories as a segmented control (All, Delivery, External, Expert, Institutional) with counts, and the Add Knowledge button at the end of the header.
- Browse modes: Feed (default), By project (a grouped list of nodes with their lesson counts, expanding to the lessons), Clusters (existing AI clusters).
- Add Knowledge auto-suggests the category and, for Delivery Lessons, the node; the user confirms.

---

## 4. NPC Nexus Podcast (صوت المعرفة)

### 4.1 Use case
A user picks knowledge (a project, an outcome, a target, a topic tag, a collection, a document, a set of lessons, or an Ask NPC answer) and presses "Listen". SiaNexus writes a two-voice script and produces a spoken episode of up to five minutes, saved to a shared library.

### 4.2 Hosts
- **Dr. Mariam** (د. مريم): the knowledge expert; answers only from the selected content; calm, precise, warm.
- **Hamad** (حمد): the moderator; asks the questions a curious colleague would ask, summarises, keeps time.
Both speak the episode language (Arabic or English); names are the same in both languages.

### 4.3 Composer (`/podcast/new`, also opened from "Listen" on any node, lesson feed filter, document, collection, or Ask answer)
Steps shown as a simple three-step stepper: 1 Choose knowledge (pre-filled when opened from context; otherwise a picker with search across nodes, topics, collections, documents, lessons), 2 Options (language AR or EN, length 3 or 5 minutes, focus: overview, lessons, numbers, or risks), 3 Review script. Then "Generate audio".

### 4.4 Script generation (`src/server/ai/podcast/script.ts`, Sonnet; Opus for episodes built from more than 10 items)
- Gather content through the same analyst tools as Ask NPC (search, get_node, get_lessons, get_indicator_series, get_deliverables) limited to the selected scope.
- Output strict JSON: title, description, segments[] with speaker (`mariam|hamad`), text, and optional spoken source mention; estimated duration computed at 150 words per minute for English and 130 for Arabic; hard cap 5 minutes (about 750 English words, 650 Arabic words).
- Structure: cold open by Hamad (what we are talking about and why it matters, 20 seconds), three to five question-and-answer beats, a "numbers moment" if indicators exist, a "lesson to keep" close by Dr. Mariam, sign-off by Hamad. Grounding rules as in Ask NPC: no facts outside the selected content; every factual answer carries a spoken attribution ("as the project's second deliverable reports").
- The user can edit any segment text in the review step before audio generation. Save the script alongside the episode.

### 4.5 Audio generation (`src/server/ai/podcast/audio.ts`)
- Provider: ElevenLabs. Model `eleven_multilingual_v2` (Arabic and English). Voice ids from `ELEVENLABS_VOICE_MARIAM` and `ELEVENLABS_VOICE_HAMAD`; if unset, pick two library voices at startup (one female, one male) that list Arabic support, store the choice in Settings, and log it. If the account exposes the Text to Dialogue endpoint (`/v1/text-to-dialogue`), use it for the whole script in one call; otherwise call text-to-speech per segment with `output_format=mp3_44100_128`, and stitch segments in order with a 600ms silence between speakers (one pre-generated silent mp3 chunk) using pure JS frame-level concatenation (`mp3-concat` style; if no reliable package is available, write a minimal MPEG frame concatenator that drops ID3 tags). Add a two-second intro and one-second outro tone generated once as a WAV then encoded through the same path, or skip tones if encoding is not possible.
- Generation runs as a job (`podcast_render`), with progress (segments done of total) streamed to the composer. Store audio at `data/podcasts/{episodeId}.mp3`, duration measured from frames.
- Fallback with no key or on provider failure: mark the episode `audio_provider = browser` and play it through the browser's speech synthesis, reading segments with two different system voices for the episode language, with the same pauses. The UI labels it "Browser voice" and offers "Regenerate with studio voice" once a key exists.
- Cost guard: per-user daily cap of 3 studio renders (Settings), unlimited browser renders.

### 4.6 Library and player
- Data: `podcast_episodes` (id, title_en, title_ar, description, language, focus, source_scope_json, script_json, audio_path, audio_provider, duration_sec, status, created_by, classification_level, listens, created_at), `podcast_listens` (episode_id, user_id, seconds_listened, completed).
- Route `/podcast`: the library, grid of episode cards (title, duration, language, source chips, listens, play), filters by outcome, category, language; "Make an episode" button. Episodes are visible to all NPC users whose clearance covers the episode's classification (the maximum classification of its source content).
- Episode page `/podcast/[id]`: player, script with the current segment highlighted as audio plays, sources list with links, "Ask about this", "Extract report".
- Persistent mini-player docked at the bottom of the app shell (existing tokens, 56px high, play/pause, scrub, speed 1x 1.25x 1.5x, title, close). Playback continues across page navigation.
- Points: `podcast_created` 30, `podcast_listened_full` 5 per episode per user (cap 20 per day). Explorer badge counts completed episodes.
- Seed: 6 episodes across outcomes with scripts and, in mock mode, `audio_provider = browser`; if an ElevenLabs key exists at seed time, render the first two.
- Rail: add "Podcast" / "صوت المعرفة" to the rail under Lessons.

---

## 5. Add Knowledge: placement and voice input

### 5.1 Placement
Remove the rail button. Add the Add Knowledge button in three places: the Home lessons row header (Section 1.3), the Lessons page header (Section 3.3), and the Lessons tab on initiative and project pages (pre-filled as Delivery Lesson).

### 5.2 Three input modes on `/add`
A segmented control at the top: Write, Upload, Speak. The existing text and file paths stay. New: Speak.
- Recorder: a large record button with a live waveform (Web Audio analyser on the microphone stream), elapsed time, pause and resume, stop, re-record, maximum 15 minutes. Language selector: Arabic, English, or Mixed. Also accepts an uploaded audio file (mp3, m4a, wav, webm).
- Transcription strategy, decided at runtime:
  1. If `OPENAI_API_KEY` exists: record with `MediaRecorder` (webm/opus), upload to `/api/v1/transcribe`, transcribe with the OpenAI audio transcription endpoint (`gpt-4o-transcribe`, fallback `whisper-1`), language hint from the selector (omit for Mixed). This is the upgrade path with the best Arabic and mixed-language results.
  2. Otherwise: browser speech recognition (`SpeechRecognition` / `webkitSpeechRecognition`, continuous, interim results) with `lang` set to `ar-QA` or `en-US`; for Mixed, run recognition in the language selected as primary and let the structuring step fix mixed segments. Show a note that browser recognition needs Chrome or Edge and an internet connection. Still record the audio with `MediaRecorder` so the user can re-transcribe later with Whisper.
- The transcript appears live in an editable text area with a "Structure with AI" button; the raw audio is attached to the resulting items as a file (stored under `data/uploads`), so the original is never lost.
- The structuring pipeline (from Change Request 01) then runs unchanged: rewrite, classify, tag, link to outcomes, targets, initiatives, projects, suggest the lesson category, and award points. Add `knowledge_by_voice` 10 bonus points once per submission.
- Mock mode: browser recognition is the mock (no key needed); if the browser lacks it, show an inline message and let the user type.

---

## 6. Signals refresh
On `/trends`: add a primary "Refresh signals" button (permissioned as before) that queues a scan run immediately and shows an inline progress card (briefs completed of total, candidates found, new signals, duplicates skipped) that updates live, then a "Last refreshed: time" stamp under the title. Add a "Rescan" action inside the filter row when a brief or outcome filter is active, which runs only that brief. The scheduled 6-hour scan remains. Log every run in `scan_runs` as today.

---

## 7. Extract knowledge: designed Word reports

### 7.1 Entry points
An "Extract report" button on: Trends and Signals (respects current filters or selected signals), Lessons (filters or selection), Vault (collection or selection), outcome, target, initiative, and project pages (scope = the node and its children), any Ask NPC answer, and any podcast episode.

### 7.2 Selection panel
A side panel: scope summary (what is included, counts), refine controls (topic tags, outcomes, categories, date range, selected items), audience (Leadership or Working level), language (Arabic, English, or Both), options (include charts, include sources, include lessons, include signals, executive summary length short or full). "Generate report" runs a job with progress; the result opens in a preview with Download and "Save to Vault".

### 7.3 Content (`src/server/reports/narrative.ts`, Sonnet; Opus for Leadership audience)
The AI writes, grounded only in the selected items: title, executive summary, key findings (numbered), implications for NDS3 (linked to outcomes and targets by code), recommended actions with suggested owners, then the item section (one entry per signal, lesson, document, or deliverable with its metadata and a two to three sentence synthesis), and an appendix of sources. Facts cited to items; computations marked; judgements labelled as assessment.

### 7.4 Document design (`src/server/reports/docx.ts`, `docx` package)
- NPC palette: primary maroon `#8A1538` (sampled from the NPC emblem), dark maroon `#5A0E24` for the cover band, near-black `#1E1B1F` body text, light sand `#F4F0E8` for table banding, gold `#C9A24D` only for a thin accent rule. During the build, fetch `https://www.npc.qa` and its main stylesheet; if you find NPC's official secondary colours there, record them in `DECISIONS.md` and use them for table headers instead of the defaults.
- Cover page: full-width dark maroon band with the NPC logo (from `public/brand/NPC_logo_white.png`, placed on a white block) and the report title, subtitle (scope), date, classification chip, and the SiaNexus wordmark small at the bottom with "Generated by SiaNexus".
- Typography: headings in a bold sans (Arial or Calibri, since the reader's machine must have the font), body 11pt, Arabic body in a standard Arabic-capable sans (Arial or Tahoma) with right-to-left paragraph direction.
- Structure: table of contents (docx TOC field, updated on open), section headings with a maroon left rule (achieved with a bordered paragraph), key findings as a numbered list, tables with a maroon header row and sand banding, charts as PNG images (render the same chart data to SVG with a small server-side generator, then rasterise with `@resvg/resvg-js`; if that package cannot be installed, fall back to tables only and note it), pull quotes for lessons in a sand box, footers with page numbers, classification, and generation timestamp, headers with the report title.
- Language modes: Arabic only (whole document RTL, Arabic numerals per user preference), English only, or Both (one file: English part then Arabic part, each with its own cover and TOC, the second cover separated by a section break; both parts share sources).
- Save: `data/reports/{id}.docx` and, on "Save to Vault", a Vault document of type `report` with the scope recorded in `key_facts`, so the report becomes searchable and citable.
- Points: `report_extracted` 15 (cap 45 per day).
- Mock mode: the narrative is extractive (item summaries stitched under the same headings); the docx layout is identical.

---

## 8. Housekeeping
- Update seeds: lesson categories, node migration to the target level, deliverables, podcast episodes, example questions for the Home Ask box (keep 15), notifications replacing "For you".
- Update Ask NPC's system prompt and tools: `get_deliverables`, lesson categories in `get_lessons`, podcast episodes indexed as a source type (script text) with a "Podcast" chip.
- README: new Home, Living Strategy navigation, lessons categories, Podcast (with the ElevenLabs setup and voice selection), voice input (browser and Whisper), signals refresh, Extract report, env variables, and the design review reports folder.
- `DECISIONS.md` and `PROGRESS.md` updated. Remove dead code from the old Home widgets, the old tree-first strategy page, and the rail Add Knowledge button.

---

## 9. Acceptance checks
1. Home: Ask box is the only large element above the fold; Today row has exactly three equal cards including the podcast card; lessons row shows four cards with category chips and the Add Knowledge button; Explore and Your progress rows render; mystery shelf, spotlight, and "For you" are gone; `docs/design-reviews/home-after.md` has no high or critical findings; EN and AR screenshots at 1440, 1280, 1024, and 390.
2. Design reviews exist for all listed pages; no source changes in those pages (git diff limited to the allowed scope).
3. Living Strategy: three panes drill from outcome to target to initiatives and projects with URL paths, breadcrumb, keyboard navigation, RTL mirroring, stacked mode under 1024px, and the map toggle; every initiative and project has a target or an outcome-level label; migration counts recorded.
4. Deliverables: upload on a project creates a Vault document with type deliverable and the node relation; it appears in the project's Deliverables section and in the Vault; Ask NPC answers "what did project P-21 deliver?" citing deliverables with node code and page.
5. Lessons: category on every lesson; segmented control counts add up; By project mode lists nodes with lessons; project page Lessons tab shows linked lessons; Add lesson from a project pre-fills node and Delivery category.
6. Podcast: composer builds a script from a project within the cap; script is editable; audio renders through ElevenLabs when a key exists and through browser voices otherwise; episode saved, visible to other users at clearance, plays in the mini-player across navigation, script highlights the current segment; Home card shows the latest episode; six seeded episodes present.
7. Add Knowledge: rail button removed; buttons present on Home, Lessons, and project Lessons tab; Speak mode records, shows waveform, transcribes (browser or Whisper), and produces structured items with category and node suggestions; audio attached to the items; voice bonus points awarded.
8. Signals: Refresh signals button runs a scan with live progress and updates the Last refreshed stamp; Rescan runs a single brief.
9. Reports: Extract report from Trends, Lessons, a project page, and an Ask answer produces a docx that opens in Word with cover, TOC, maroon headings, banded tables, charts (or tables-only fallback noted), and footers; Arabic-only output is RTL; Both produces two parts in one file; Save to Vault creates a searchable report document.
10. Typecheck, lint, build, unit tests, and the extended smoke script pass; Lighthouse accessibility above 90 on Home, Strategy, Lessons, Podcast.
