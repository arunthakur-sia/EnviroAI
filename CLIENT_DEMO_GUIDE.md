# SiaNexus: the demo guide

A thirty minute path through the product for the National Planning Council,
with the exact clicks. Everything below runs from this machine with no network
except the AI keys, and every figure on screen comes from the seeded database.

---

## Before they arrive (ten minutes, once)

```bash
npm run setup          # only on a fresh clone: installs, fetches sources and fonts, migrates, seeds
npm run reset-demo:snapshot   # freeze this database and its files as the demo baseline
npm run start:demo     # builds once if needed, then serves the production build with the job worker
```

Open `http://localhost:3000` and sign in as **admin@npc.qa** with the password
**Nexus!2026**. Leave the browser at 1440 by 900; the product is designed at that
width and reads well down to a phone.

If a demo goes sideways (someone deletes a report, a handover gets closed), stop
the server, run `npm run reset-demo`, start it again: under two minutes, and the
database and every generated file return to the baseline.

**The accounts.** All of them use `Nexus!2026`.

| Email | Who they are | Use them to show |
|---|---|---|
| admin@npc.qa | Super Admin | everything, the settings, approvals |
| knowledge@npc.qa | Knowledge Admin | verification, Knowledge of the Week |
| hr@npc.qa | HR Admin | continuity, handovers |
| head.stats@npc.qa | Department Head | a unit head's view, change requests |
| analyst@npc.qa | Contributor | the everyday person |
| reader@npc.qa | Reader | what a restricted account cannot see |

---

## The path

### 1. Home, and what the Council knows this week (3 minutes)

Sign in as **admin@npc.qa**. You land on Home.

1. The **Knowledge of the Week** reveal opens over the page on the first visit
   of the week. Read the contributor's name and the Knowledge Admin's note on
   why it was chosen, then press **Read now**. The reader earns ten points; the
   contributor earned a hundred and fifty and a permanent award.
2. Back on Home, point at the **band under the greeting**: the same pick stays
   there all week with its read count, beside a link to the **Hall of
   Knowledge**.
3. Scroll: **Qatar in numbers** counts up from real indicator values, the
   **daily challenge** flips, **What changed in NDS3** is a live timeline, and
   **Top five this month** shows the leaderboard with the viewer's own rank.
4. Hover any card: the constellation behind the page lights the threads of that
   card's outcome. Every thread is a real relation in the database.

### 2. Ask NPC, from anywhere (4 minutes)

1. Press **Ctrl+K** (or the white **Ask NPC** button on the maroon bar). The
   panel slides in from the side.
2. Ask: **"How are we doing on Qatarization targets this year?"** Watch the
   thinking chips name the tools as they run, then the answer streams with
   numbered citations and a workspace of strategy cards and indicator tiles
   beneath it.
3. Close the panel with **Escape**, navigate to **Living Strategy**, reopen with
   Ctrl+K: the thread is still there. That is the point of the panel.
4. Open any project from the canvas. The launcher in the corner says **"Ask
   about this project"** for three seconds. Open it: the project is attached as
   a removable chip and the three suggestions are about that project.
5. Press **Expand** to move the same conversation to the full page at `/ask`.

### 3. The Living Strategy and the Council's own strategy (4 minutes)

1. **Living Strategy**: the seven outcome medallions on the arc, the 2024 to
   2030 timeline, and the at-a-glance counts. Click **Sustainable Economic
   Growth**: the panel opens beneath the arc with a pointer to the medallion.
2. Press **Read the chapter**: the summary is page-cited into the real NDS3
   document; every `p. N` chip opens the reader at that page.
3. Expand a target: its initiatives and projects open in place. Open a project:
   the drawer shows milestones, KPIs, deliverables, lessons and the **owner as a
   person chip**. Hover the chip: the person card gives their unit, expertise,
   availability, backup owner, and the actions to message them, ask them a
   question, or chat in Teams.
4. Switch to **Council Strategy** in the rail: the Council's own institutional
   strategy as a results chain, with an **Internal** chip on every screen and an
   **Illustrative** chip while the seeded strategy stands in for the real one.
   Open a goal, then the results view with its narrative written from the
   figures alone.

### 4. Institutional Memory, Studies and the Knowledge Cast (3 minutes)

1. **Institutional Memory** (the rail's Knowledge Hub): the library as real
   books on planks. Hover a book: it comes forward, the cover swings open, and
   the preview card appears. Books carry a gold ribbon when they are the week's
   pick.
2. Open a document: the three-column reader, the intelligence panel on the
   right, **Brief me** and **Ask about this document**.
3. **Studies**: the featured study, the chips for type, topic, outcome and year,
   and one shelf per year.
4. **NPC Knowledge Cast**: press play on an episode. The mini-player follows you
   across every page for the rest of the demo.

### 5. The numbers: Statistics and the nine index groups (3 minutes)

1. **Statistics**: the headline tiles, then one indicator with its chart, its
   AI narration and its release calendar.
2. **Indices**: the board now carries **nine groups**. Show **SDGs** (the
   seventeen goal scores with the official colours and Qatar's overall index
   rank), then **National Indicators** (Statistics Hub series with their NDS3
   targets and a gap forecast), then **Competitiveness**.
3. Open one index: the sourced history, the comparison with the Gulf, and the
   **forecast** with its fan chart, its method note and the what-if sliders that
   re-run the simulation in the browser without touching the official rows.

### 6. People, the organisation and how the Council works (4 minutes)

1. **Experts**: the segmented control. **Internal Experts** are NPC staff,
   grouped by unit; **External Experts** are the other register, with their
   organisation, availability and engagements. Search never blends the two.
2. **Organisation**: the published structure as a chart. Drag to pan, Ctrl and
   the wheel to zoom, press **fit**. Click a unit: the panel opens below with
   the published mandate in both languages, the people, what the unit owns, its
   policies, and **the processes it owns**.
3. **Processes**: the eight Level 0 processes as a chain. Click one: its Level 1
   processes open in place; click one of those: the panel gives the purpose, the
   numbered steps naming the unit and system, the inputs and outputs, the
   governing policies and SOPs, and the KPIs.
4. **Operating Model**: the principles, the governance map, the RACI matrix, the
   annual calendar as a ring, the interfaces with their chord diagram, and the
   operational KPIs.

### 7. Reports, generated properly (4 minutes)

1. **Reports**: the cover gallery of the twelve published examples. Filter to
   **Public**.
2. Press **Request report**: choose **Statistical Highlights**, the period
   **Q3 2026**, the scope **the Council**, the audience **Working**, the
   language **Both**, keep the default sections, and watch the **live structure
   preview** count the pages.
3. Press **Generate**. The report page shows each section as it is written.
4. Open a finished report: the sections rendered on screen, a comment on one of
   them, **Regenerate section**, then **Approve** and **Publish**. Download the
   Word document and open it: the maroon cover with the Sadu pattern, the
   contents, the two-column body, the chart pages, and the Arabic edition fully
   mirrored.

### 8. Continuity: the handover (3 minutes)

1. Sign in as **hr@npc.qa** (or stay as the admin) and open **HR Knowledge**,
   then **Handovers**. Open the internal handover for Ahmed Fathy.
2. Show the **inventory**: everything he owns, by category, with a recipient per
   item, a note per item, and the **filing proposals** for the items going to the
   system.
3. Open the **interview**: the AI asked about status, decisions, contacts and
   pitfalls, and the answers became an Expert Insights lesson.
4. Sign in as **mohammed.alsulaiti@npc.qa**: the banner on Home, then the
   **learning path** with its modules, the check questions, and the sign-off.

### 9. What a restricted account sees (2 minutes)

Sign in as **reader@npc.qa**: the rail is shorter, confidential documents are
absent from the library, from search and from Ask NPC answers, and a direct link
to one answers with the friendly not-found page rather than a permission error.

---

## If someone asks

- **Is the data real?** The documents, the NDS3 and QNV 2030 content, the
  statistics and all fifty three international indices are real and every index
  value carries the URL it was read from. The Council's own strategy, the
  operating model and the handovers are illustrative, and every screen that
  shows them says so.
- **Does it work without the internet?** Yes. Without an Anthropic key it runs
  in **AI Mock Mode**: every AI feature answers deterministically from the same
  data, and the top bar says so.
- **Is it bilingual?** Every screen, both directions. Press **العربية** on the
  bar at any point in this path.
- **Where does it run?** Node 20 and a single SQLite file. The migration path to
  Postgres and Supabase is written down in the README.
