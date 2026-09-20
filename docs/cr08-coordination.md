# CR08 coordination notes (working file, deleted content goes into DECISIONS and PROGRESS at the end)

## Wiring the coordinator still owes

- (shell) AskBarButton and AskEverywhere are wired into AppShell already; the placeholder stubs were overwritten by the Ask agent.
- Settings tab registrations pending: GamificationSettingsTab (replace the inline tab), Organisation editor lives in the existing tab (agent A), Indices (agent D2 extended the existing tab).
- Home: LeaderboardHomePanel (leaderboard/HomePanel.tsx), Knowledge of the Week strip and reveal (agent H, wave 2).
- system_analyst.md paragraphs: collect from every report.
- smoke: modules land as scripts/smoke-cr08-*.ts and are auto-discovered by section 19.

## Run log

- 2026-09-19 ~18:00: all ten running agents were cut by a session rate limit (reset 18:10). Resumed all ten at 18:55 by message; the dev server survived (pid 24044). Wave 1 pending: organisation, Ask everywhere, experts and studies, indices data B, indices UI, sections and builder, gamification. Wave 2 running: operating model data, Knowledge of the Week, owners and messaging. Not yet launched: handover (needs a free slot; template is ready), Reports UI (after the builder report), processes page and operating model page (after the opmodel data report and the organisation report).

- 2026-09-19 evening: wave 3 launched: Reports UI, Processes page, Operating Model page (d3-chord installed for the chord diagram). Still running from earlier: organisation, indices UI, Knowledge of the Week, owners and messaging, handover.

- 2026-09-19 23:50: second session rate limit cut the seven running agents (processes page, KoW, Reports UI, messaging, operating model page, indices UI, handover); all seven resumed at 23:55.

- 2026-09-20 00:10: DECISIONS 81 to 103 written for the reported sections; em dash sweep now ZERO repository-wide (format.ts, Reader.tsx, ImportFlow.tsx, departments page placeholders changed from the em dash to a hyphen); scripts/qc/emdash-and-tables.mjs exempts the nine pre-CR08 table files and fails on any new one; package.json gained start:demo, reset-demo, reset-demo:snapshot, qc:sweep, qc:permissions, qc:console, analyze; next.config.mjs wires @next/bundle-analyzer behind ANALYZE=true.

## Known warnings for Phase A (not errors)

- FIXED 2026-09-20: the shell-wide Radix useId mismatches traced to the Ask panel store reading sessionStorage at module load, and the Reveal/Stagger motion components switching `initial` on useReducedMotion() (null on the server). Both now render identically on both sides.
- Home's constellation paths carry float digits that differ between server and client (CR03 era). Round them in Phase A, the same rule as the operating model charts.
- The Knowledge of the Week strip appears in the server HTML only intermittently while agents run concurrently against the shared dev server; the service returns the card every time when called directly, so re-verify in the final quiet pass before treating it as a defect.

### Owner placement, data and organisation surfaces - done
- New: services/owner-lookup.ts (resolveOwners, resolveOwner, resolveUnitHead, ownerKey, OwnerChip), smoke-cr08-owners-data.ts (19 checks), probe, design review, 26 screenshots.
- Changed: organisation.ts (UnitPolicy owner), operating-model.ts (policy owners), search.ts (SearchResult.owner), ai/ask.ts (CitationOut.owner), AnswerStream, Level1Panel, PolicyDocRow, ProcessesPage, UnitPanel, UnitPanelTabs, PolicyTabs, statistics/[id], indices/[code], SearchResults.
- Wired by me: SourceRef.owner in analyst/tools.ts plus attachSourceOwners() called before both sources yields in analyst/index.ts, so analyst answers carry the chips too.
- Open data gap (deliberate): indicators carry no department_id (0 of 64), so the indicator and national index chips render nothing; filling it would scope national statistics away from other department heads.

### Owner placement, library surfaces - done
- Changed: documents.ts toShelfDocs (ownerUserId, the key change), Shelf.tsx (preview chip + leave-timer fix), DocListRow, vault/[id], collections/[id], StudiesView, lessons/[id], lessons.ts (RoomLesson.authorId), LearningRoom, LessonReader, reports.ts (requesterColor), ReportPage, ReportsPage, ask/[id] page and ThreadAnswers. 17 smoke checks, 30 screenshots, design review.
- Two shelves still build ShelfDoc by hand and show no preview chip: components/nexus/processes/shared.tsx toShelfDoc and council-strategy/ProjectDrawer.tsx (Council deliverables). One line each once their service carries an owner id.
- No chip on a book spine or a grid cover by design (the spine already carries the seal and the KoW ribbon); the owner lives on the hover preview and every list row.

## Loose ends to clean before the final reseed

- A stray `smoke_8cuaot` index group and `sm8cuaot` index exist in the working DB from the indices UI smoke run (its archive step may not remove rows); the final pristine reseed wipes them, and the smoke module should archive or delete what it creates.

## Reports received

### Indices data A (SDG, Gallup, human, governance) - done
- Files: src/server/indices/defs-cr08-a.ts (33 defs, CR08_INDEX_DEFS_A, CR08_EXISTING_MEMBERSHIPS_A), sources/indices/research/cr08-<code>.json x33, cr08-coverage-a.md, dev probes cr08-indices-a-*.mjs.
- Loader needs (for agent B): concat CR08_INDEX_DEFS_A into INDEX_DEFS; loadResearch reads cr08-<code>.json; register insert writes sdg_goal, forecast_mode, forecast_enabled; memberships from groups + CR08_EXISTING_MEMBERSHIPS_A; SDG Index responsible entity uses "Planning and Statistics Authority" (no NPC entity exists).
- Coverage: SDG index + 17 goals 2020-2026 full field (goal 1/10 only 2025-2026, goal 14 not landlocked); WGI six dims 2010-2024 full field; GII (gender inequality) 2010-2023; gender gap 2021-2025 (Qatar dropped in 2025); happiness editions 2012-2026 (Qatar last 2019); social progress 2025 (+2026 press ranks); Gallup: Qatar absent from public tables, only 2010 thriving 56%; forecasting off for Gallup, happiness, social progress.
- DECISIONS paragraphs (verbatim in the agent report; summary): provenance of SDR editions incl. Wayback id_ copies and derived goal ranks; WGI percentile-as-score with ordinal derived rank; WHR Figure 2.1 file cross-checked; Gallup Qatar absence recorded honestly; publisher gaps (WEF 2025, WHR post-2019, SPI 2026 image-only).
- Method note: publisher files downloaded with curl.exe + parsed with xlsx/unpdf (WebFetch cannot read xlsx or big PDFs), raw files kept out of the repo.

### Reports UI (5.4) - done
- Files: reports/{layout,page,ReportsPage,loading}, reports/new/{page,ReportBuilder,scopes,loading}, reports/[id]/{page,ReportPage,loading}; components/nexus/reports/{BlockRenderer,ReportChart,CoverCard,ProgressList,SectionEditor,Filmstrip,ButtonLink,TimeAgo,shared}; messages/cr08-reports.* (248 keys); smoke-cr08-reports-ui.ts (20 checks); docs/design-reviews/cr08-reports.md; 24 screenshots.
- Wiring: none outstanding (rail, PORTAL_OF_RESOURCE and smoke discovery already in place). The KoW Set button was added to the report page by that agent.
- Defects found and fixed: server-rendered relative time hydration mismatch (TimeAgo), blank page for an unknown or invisible report (notFound cannot paint behind loading.tsx, so a designed in-page state), duplicate chips, doubled classification control, lazy covers above the fold, unnamed scorecard column header.
- Limitations: no drag reorder (the server re-sorts to SECTION_ORDER), editing covers text blocks only, page previews come from the primary English edition (a language-keyed previewImagesJson is the one server addition worth considering).
- DECISIONS paragraphs 3 (streaming notFound; the scope picker mirroring mayRequestScope without a new API; no reordering).
- Scratch to delete at cleanup: data/reports/ui-block-samples.json.
- Second pass (opus agent) added docs/design-reviews/cr08-reports.md, fixed a High finding (390px sideways scroll from a missing grid-cols-1, also fixed in ReportBuilder, ProgressList, SectionEditor), made template-composed sections say so, added the KoW control and one smoke check (20/20). Known limitation: previews are English only (the preview API takes no language). Two probes retired to export {}.

### Handover rebuild (6) - done
- Files: services/handover.ts, lib/handover-constants.ts, api/v1/handover/** (route, [id], interviews, path, report, access/[token]), hr/handovers/{HandoversListClient,StartHandoverDialog,[id]/HandoverAdminClient}, (app)/handover/** (mine, [id], HandoverBanner, _components), (auth)/handover/access/[token]/**, prompts system_handover_{interview,path,filing}.md, cr08/handover.ts tools, cr08-handover-seed.ts, smoke-cr08-handover.ts (30 checks), messages/cr08-handover.*, design review, 35 screenshots.
- Changed: services/hr.ts (delegates, in-scope completion, new handover_gap risk rule, reminders moved to the nightly job), api/v1/hr/handovers (wrapper), hr/handovers pages; old HandoverDetailClient.tsx stubbed to export {}.
- Wired (done): Home banner as the first child of the Stagger, system_analyst.md 2m, smoke auto.
- Notes: external handovers store the experts row id in user_id; learning_path_completed paid once per recipient per handover; module episodes written directly (no podcast_created points); applyFiling does not rewrite lesson authorship; cut-off locks the employee account (seed lifts it on the demo account).
- Flagged by this agent: tests/i18n-parity.test.ts fails on two empty Operating Model strings (operatingModel.kpis.unit.count, operatingModel.kpis.unitLong.count) - that agent is still running.

### Owners, person cards, messaging (9) - done
- Files: services/{people,messaging}.ts, components/nexus/people/** (OwnerControl, OwnerControlCompact, PersonCard, ComposeMessageDialog, TeamsPlaceholderDialog, types), api/v1/{people,messages,profile/delegate}, inbox/** (+ dev demo route), cr08/messaging.ts (get_owner), cr08-messaging-seed.ts, messages/cr08-messaging.*, smoke-cr08-messaging.ts (32 checks incl. 5 privacy), design review, screenshots.
- Second pass fixed: 390px sideways scroll in the Inbox, the backup owner and delegate now steppable inside the card with a way back, stale card data while stepping, item-type and person filters (CR 9.2 required them), mixed numerals in Arabic threads, an English snippet clipped at its start in RTL.
- Wired (done): system_analyst.md 2o. Everything else was already in place.
- Limitations: filters narrow the list already sent (not server-side); "Ask a question" routes through an expert profile when there is one; Teams is the placeholder dialog the CR asks for; message bodies are never embedded, so Ask NPC cannot summarise a conversation (the privacy contract).
- The 24-item OwnerControl placement table from this agent is being executed by three agents (strategy/council, library, data/org). No migrations: a missing person falls back to the unit head or renders nothing.

### Processes page (10.1) - done
- Files: processes/** and components/nexus/processes/**, UnitProcessesTab, services/operating-model-unit.ts, messages/cr08-processes.*, smoke-cr08-processes.ts (28 checks), design review, 21 screenshots; probe 57 checks 0 problems.
- Fixed from screenshots: dialog opening behind the panel (z-50 under z-60), one Escape closing both, the person card invisible behind the panel, 1439px sideways scroll at 390 from sr-only text escaping the scroller, a React error from history.replaceState inside a setState updater, Level 0 titles chopped mid-word, plus seven medium findings.
- Wired (done): UnitProcessesTab mounted in UNIT_PANEL_TABS between policies and subUnits; OwnerControl popover lifted to z-80; system_analyst.md 2k gained the /processes sentence.
- Limitations: the steps' `system` field is a single English column (generic names show in English on the Arabic page); hyphenation does not fire in headless Edge; the global Ask pill floats over the panel's bottom corner.
- DECISIONS: overlay layering and Escape ownership; sr-only inside a scroller; phone probes use hasTouch without isMobile; URL state written outside setState; free-text vocabularies named through i18n.

### Indices UI (4.2, 4.3) - done
- Second pass fixed: forecast tiles pairing a rank headline with a score range (now rank bounds with #), the unit appended to the sentence instead of the value ("Target 75.0 by 2030 percent"), and the Add index wizard now states whether a target reads as a rank or a score. Cleaned five leftover probe groups and indices from the database (Governance had read 12 instead of 9); scripts/dev-probes/cr08-indices-ui-dbstate.mjs reports drift and cleans with --clean.
- Verified: all five probe stages exit 0 in both locales, smoke 36/36, 9 groups at 18/12/8/5/9/6/2/3/5.
- Wiring: none outstanding.
- DECISIONS: forecast range on the same basis as the headline; the unit binds to the value; the creating screen states the ambiguous rule; probes assert settled state, never a single read.

### Operating Model page (10.2) - done
- Files: operating-model/** and components/nexus/operating-model/**, smoke-cr08-operating-model.ts (26 checks), design review, screenshots.
- Fixed from screenshots: ring calendar hydration mismatch (SVG coordinates now rounded to 2 dp, which also cured the cascading useId warnings), Arabic chord caption escaping the circle, hero collapsing at 390, 37px page overflow, popover off-screen, section nav not highlighting the last section, RACI cell losing keyboard focus mid-write, "Target 10days", English cadences on the Arabic page.
- RaciMatrix is a CSS grid with ARIA roles; the sweep's hit is on the literal role="table" and is a false positive. Sweep updated accordingly if it recurs.
- Section 3 renders its own Level 0 chain (not the processes agent's component); optional later swap, one import.
- DECISIONS: round server-rendered SVG geometry; a positioned box inside an LTR-locked chart keeps the chart's direction; single-column vocabulary is translated in the component; a control that is writing stays focusable.

### Knowledge of the Week (8) - done
- Files: services/knowledge-of-week.ts, api/v1/knowledge-of-week (one route, ?view=active|ids|hall|schedule|preview), components/nexus/kow/* (Reveal, Strip, SetButton, KowRibbon, Award, KowCardBody, client, index), home/KnowledgeOfWeek.tsx, hall-of-knowledge/* (+ dev-only preview), cr08/kow.ts tool, cr08-kow-seed.ts, smoke-cr08-kow.ts (35 checks), messages/cr08-kow.*, docs/design-reviews/cr08-knowledge-of-week.md, probes incl. cr08-kow-leak.mjs (client-to-node import tracer), screenshots kow-*.
- Changed: Shelf.tsx (kow pennant on the spine), services/documents.ts (toShelfDocs sets kow), LessonCard.tsx, SearchResults.tsx (document and lesson ribbons), profile/page.tsx (award chip, badge de-duplicated).
- Wired (done): Home after Row A, vault/[id] Set button with kowKindForDocument, lessons/[id] Set button; reports button requested from the Reports UI agent; smoke and tool auto-registered.
- Notes: reads counted on the explicit Read now click; replacing a week clears that pick's reads and seen marks; only the scheduled to active transition pays; badge awarded once with the week count on the profile; reveal at z-80 above the Ask launcher and panel.
- DECISIONS paragraphs: path mappings and the shared KowCardBody + cached id set; pay-on-transition idempotency; the Home placement deviation (Row A is a two-column grid, so the band sits after it).

### Organisation rebuild (1) - done
- Files: organisation/{OrgChart (d3), UnitPanel, UnitPanelTabs (UNIT_PANEL_TABS array: Overview, People, What it owns, Policies, Sub-units), page}.tsx, settings/{OrganisationEditorShared,OrganisationTreeEditor,OrganisationLevelsEditor,OrganisationSnapshots,OrganisationCsvImport,OrganisationChangeRequests,OrganisationSettingsTab}.tsx, api/v1/organisation/editor/route.ts (+structure), services/organisation.ts (levels, impact, UNIT_REFS registry, mutations with inverses, snapshots/restore, CSV, change requests), cr08/organisation.ts tools, cr08-org-seed.ts, smoke-cr08-org.ts (29), messages/cr08-organisation.*, docs/design-reviews/cr08-organisation.md, probes, screenshots org-*.
- Wired (done): system_analyst.md 2l, SettingsTabs hydration fix (useSearchParams), smoke auto.
- Still to do: mount the Processes tab in UNIT_PANEL_TABS when the processes agent delivers UnitProcessesTab; the Section 9 message on createChangeRequest() once messaging lands; the 390px rail collapse (coordinator, AppShell); the Radix useId mismatch on /ar pages (investigate in Phase A); prune the ~55 probe snapshots in org_snapshots before the final reseed (reseed wipes them).
- Notes: chart height in prefs.orgChartHeight; chart geometry stays physical-left in RTL (DECISIONS 80); request change offered to unit head / department heads beneath / Super Admin; restore never deletes (unknown units kept inactive); no d3-transition (rAF tween).
- DECISIONS paragraphs 1-3 (d3 tree + zoom frame + dummy-node stacking + wheel rules; editor inverses + snapshots + UNIT_REFS + drag/drop; tab array with hidden panels for SSR).

### Experts and Studies (3, 2.2) - done
- Files: experts/{ExpertsSegments,InternalBoard,loading}.tsx, studies/{layout,page,StudiesView,loading}.tsx, components/nexus/RequestExpertDialog.tsx, services/studies.ts, api/v1/studies, lib/experts-constants.ts, messages/cr08-experts.*, scripts/smoke-cr08-experts.ts (29 checks), probes, docs/design-reviews/cr08-experts-studies.md (closes clean), 26 screenshots experts-*/studies-*/search-experts-*.
- Changed: experts pages, ExpertCard, services/experts.ts (rewritten), services/search.ts (expertGroups), ai/ask.ts (suggestExpertsGrouped, kind), SearchResults.tsx, AnswerStream.tsx (additive), api/v1/experts, UploadFlow.tsx (?type=), cr08/experts.ts tools (find_experts_grouped, get_studies), seeds; migration 0007 + schema gained experts.country.
- Wired by coordinator: system_analyst.md 2f paragraph (done), vault SHELF_ORDER research/evaluation (done), smoke auto-discovered.
- Assumptions: internal = user_id or npc_employee; level = highest accepted domain level; projects = stakeholder rows or owner_user_id across both stores; worked with NPC = engagement/stakeholder/request; country ISO alpha-2; prefsJson.expertsView / expertsGroups.
- Limitations: external cards carry no Illustrative chip (bio says it); "Dr Test Externus" row from the old smoke; find_experts now returns up to 2x limit with kind.
- DECISIONS paragraphs 1-6 in the agent report (path mappings; project involvement rule; experts.country column; never-blended data shapes; Studies content decision incl. research/evaluation taxonomy terms, four chip rows, per-year shelves, ?type= upload, 8 illustrative studies with source_ref cr08-illustrative; filter semantics and per-user memory).

### Ask NPC everywhere (2.3) - done
- Files: components/nexus/ask/{panel-store,suggestions,AskBarButton,AskLauncher,AskPanel,AskEverywhere,context-loaders}.ts(x); api/v1/conversations/[id]/messages (GET turns); markers on strategy/[id], vault/[id], statistics/[id], lessons/[id], council ProjectDrawer; Workspace.tsx send(contextItem) + AnalystAnswer compact; analyst route + index.ts contextItem; messages/cr08-ask.* (askEverywhere, 103 keys); smoke-cr08-ask.ts (24 checks); probes; docs/design-reviews/cr08-ask-everywhere.md (closes clean); screenshots ask-*.png.
- Wired: AppShell (already), GlobalSearch rebound to "/" (done), system_analyst.md 2g (done), panel-test route removed (done, Remove-Item works in PowerShell).
- Notes: launcher lifts above [data-testid="mini-player"]; scrim starts at the measured rail width, sits above the council drawer; panel stays mounted while closed (inert) so streams survive; sessionStorage mirror sia:ask-panel; single-instance registry.
- DECISIONS paragraphs 1-3 (thread outside React + sessionStorage + single instance; scrim/rail/drawer + Ctrl+K moved from search; contextItem plumbing + messages GET endpoint).

### Indices data B (competitiveness, environment, peace, digital, national) - done
- Files: src/server/indices/{defs-cr08,defs-cr08-b}.ts, fetcher.ts (CR05_INDEX_DEFS + CR08, parseHeritage, parseGtmi, loadResearch cr08-*, ensureIndexRows writing sdg_goal/forecast_mode/forecast_enabled, runIndicesFetch({download, codes}), busy_timeout), forecast.ts (target_gap), compute.ts (resolveForecastMode, forecast_enabled=0 retires rows, gapExplanation mock), scripts/cr08-indices-seed.ts (NATIONAL_INDICATORS, memberships union), scripts/fetch-indices.ts --only, tests/forecast.test.ts (+5, 45 total pass), research cr08-{economic_freedom,gfci,ccpi,gti,safe_cities,ai_readiness,imd_digital,govtech}.json + cr08-coverage-b.md, raw heritage/govtech workbooks (gitignored).
- State: 53 index defs (41 new), 12 national indices (61 obs, 6 targets), group counts sdg 18, national 12, competitiveness 8, gallup 5, governance 9, human 6, environment 2, peace 3, digital 5; idempotent; full seed ~12 min (forecast loop).
- Wired: system_analyst.md 2h (done). Remaining: defs-cr08-a.ts `as const` typing error (fix now).
- DECISIONS paragraphs 1-3 (provenance incl. Heritage/GovTech workbooks and last-source-wins; forecast modes and target_gap method; national indicators as index records, 12 = 8 headline + 4 targeted, GW to MW).

### Report sections and builder (5.2-5.4 server) - done
- Files: src/server/reports/sections/* (23 + index, _shared, _scope), reports/types.ts (12 types + custom), services/reports.ts, api/v1/report-builder/{route,[id]/route,[id]/download,[id]/preview/[n]}, prompts/system_report_section.md, build.ts (filled), cr08/reports.ts tools, cr08-reports-seed.ts, smoke-cr08-reports.ts (27 checks, cleans up), probes cr08-reports-{db,run,smoke,cleanup,state,rerender}.ts.
- State: 12 example reports published v2 with en+ar docx under data/reports/module/<id>-<lang>.docx, previews, Institutional Memory documents; game rule report_published 20.
- Contracts for the UI: GET /api/v1/report-builder -> { types, library, reports }; POST CreateReportInput (exported from services/reports.ts) enqueues report_build; PATCH /[id] { action: edit_section|comment|regenerate_section|submit|approve|publish|request_changes } errors 403/404/400/409 with detail; ProgressState from build.ts { done, total, current, stage, notes[{at, code?, en, ar}], templateUnavailable?, startedAt, finishedAt? }; download route per lang; preview route /[id]/preview/[n]. Notification kinds report_* link to /reports/[id].
- Wired: PORTAL_OF_RESOURCE report (done earlier), system_analyst.md 2i (done), smoke auto.
- Notes: mock writer by default (REPORTS_SEED_AI=1 for live); requester scope rules (department = own unit, project = owned/led/stakeholder, Super Admin any); publish attaches the primary docx only; knowledge_continuity honours hrScopeFor; indices sections exclude SDG goals and national indicators.
- DECISIONS paragraphs 1-5 (section library design + grounding guard + WeakMap memo; data mapping per section; events/partnerships proxy; lifecycle incl. __render__ sentinel; SQLITE_BUSY busy_timeout + custom type as 13th row).

### Gamification and Leaderboard (7) - done
- Files: lib/leaderboard-math.ts, services/leaderboard.ts, leaderboard/{layout,page,LeaderboardBoard,MedalAvatar,HomePanel,settings/page,preview/page}.tsx, api/v1/leaderboard/{route,refresh,settings}, settings/GamificationSettingsTab.tsx, cr08/leaderboard.ts (get_leaderboard), messages/cr08-leaderboard.*, docs/design-reviews/cr08-leaderboard.md, smoke-cr08-leaderboard.ts (29), probes, 26 screenshots leaderboard-*.
- Changed: cr08-gamification-seed.ts (level migration, rules, exclusions, settings, first refresh; three descriptors reworded), engine.ts (Arabic level-up wording, exported type sets), api gamification/rules (excludedFromBoards, category), profile/page.tsx, home/ProgressPanel.tsx + services/home.ts (descriptor), tests/gamification.test.ts.
- Wired (done): SettingsTabs swap to GamificationSettingsTab (inline tab removed), Home Row E gets LeaderboardHomePanel under the progress panel, system_analyst.md 2j, smoke auto; badges explorer family renamed Pathfinder I/II/III / رائد 1-3 in seed.ts + cr08-seed.ts seedCr08BadgeNames + README.
- Leftovers to retire: leaderboard/preview page (optional dev route) at the cleanup pass; leaderboard/settings page is an admin shortcut (keep or retire).
- KoW contract: record() types kow_contributor 150, kow_read 10, kow_unit 100 with resourceType "org_unit"; kow_unit Departments board only.
- Limitations: Departments board lists units with users only (10 of 39); people rows only for points > 0; unlocks_json unconsumed; whole-ledger refresh; period-close notifications only on consecutive periods; hydration warnings on /profile (Radix id on notifications button) and /home (constellation floats) are pre-existing.
- DECISIONS paragraphs 1-5 (unlock re-mapping + descriptor rewording + id-stable migration; exclusion list rationale; category type sets; departments per-member ranking and unique ties; rebuild-whole + leaderboard_state period-close).

### Operating model data (10, services/APIs/seed/tools) - done
- Files: services/operating-model.ts, api/v1/processes/{route,[code]/route}, api/v1/operating-model/{route,_shared,raci,calendar,interfaces,kpis,principles}, scripts/data/cr08-opmodel-content.ts, cr08-opmodel-seed.ts, cr08/operating-model.ts tools, smoke-cr08-opmodel.ts (39 checks), probes cr08-opmodel-{probe,db,smoke-run}.ts.
- Seeded: 6 principles, 5 governance bodies (settings row operating_model_governance + council bodies), 8 L0 + 23 L1 + 8 L2 processes, 182 RACI cells, 46 calendar events, 20 internal + 10 external interfaces, 5 KPIs with 45 values; idempotent.
- Wired (done): PORTAL_OF_RESOURCE operating_model, system_analyst.md 2k, smoke auto. Seed order fine (opmodel last in cr08-seed.ts).
- Read models: getProcessMap(user) -> { chain, byUnit, byPolicyType, totals, canEdit }; getProcess(user, codeOrId) -> ProcessDetail; getOperatingModel(user, {year?}) -> { principles, governance {bodies, connectors}, chain, raci {processes, units, cells}, calendar {year, events}, interfaces {external, internal, units, matrix, chord, changeRequests}, kpis, canEdit, isIllustrative }; getUnitInterfaces(user, unitId); writes upsertProcess/deleteProcess/setRaci (409 accountable_exists)/principles/calendar/interfaces/proposeInterfaceChange/resolveInterfaceChange/ops KPIs; canEditOperatingModel, canEditUnitProcesses.
- Assumptions: no GCO entity (GSCM used); statistical releases from `releases` table; report deadlines from report_types cadence; Strategy Office = settings council_strategy_office (IDP); units without accounts get null focals (7 of 20 lack a focal); governance extras live in a settings row (no write API).
- DECISIONS paragraphs 1-5 (illustrative content and flag clearing on edit; governance reuse; calendar sources; KPI definitions incl. auto handover completion 33% and policy currency 71%; RACI integrity).

### Docx template (5.5) - done
- Files: src/server/reports/template/{index,theme,png,svg,charts,blocks,pages,preview}.ts; probes cr08-template-sample.ts, cr08-template-check.mjs, cr08-template-preview.ts; scripts/smoke-cr08-template.ts (20 checks, self-contained); docs/design-reviews/cr08-report-template.md (closes clean); samples data/reports/samples/template-sample-{en,ar}.docx (13 pages each) + previews data/reports/previews/samples/; package.json gained docx-preview ^0.4.0.
- API: renderReportDocx(model, {lang, outPath?}); renderDocxPreviews(docxPath, {outDir?, scale?}) -> data/reports/previews/<id>/page-N.png; svgToPng, pngAvailable, closePngRenderer, chartSvg, previewDir.
- Preview method: docx-preview 0.4.0 in Edge via Playwright, 1.5x per page element; limits: no flow pagination (long body = one tall page), page split only on page-size change (one-twip alternation trick), no bidiVisual (page dir=rtl + swapped alignment), tab leaders approximate, TOC/PAGE fields uncomputed.
- Fonts: Calibri body/headings 11pt EN, Georgia serif leads/quotes, Sakkal Majalla all slots + rtl runs 13pt AR; images Fraunces/Noto Kufi/Inter/Plex embedded as data-URI @font-face.
- Fallbacks when Edge/Playwright unavailable (REPORT_NO_RASTER=1): shaded-table cover/closing, Calibri numerals, sand KPI cells, CR02 shaded-bar chart tables, text arrows, note for SVG figures. Playwright loaded via eval("require").
- Limitations: cover band maroon 8A1538 (not the CR02 dark band); contents numbers are estimates until Word updates fields; KpiTile has no direction/series; jc left/right assumed logical in bidi (unverified, no Office); numerals always Western.
- Proposed spec additions (not applied): KpiTile.spark/direction; RenderOptions.numerals; estimatedPages on SectionContent.
- DECISIONS paragraphs 1-5 in the agent report (rasterisation via Edge with eval require; docx-preview QA and its limits; Arabic bidi handling; chart palette kept despite dataviz validator with secondary encodings; SiaNexus wordmark colour-matrix on the closing page).
