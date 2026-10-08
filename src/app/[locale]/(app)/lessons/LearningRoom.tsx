"use client";
// CR04 3: the Learning Room. Lesson of the week, themes with syntheses,
// category lanes ordered by the worth-reading score, browse tools, the full
// feed, and Learn mode on top. Reading always expands inline on this page.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  BookOpen,
  ChevronDown,
  GraduationCap,
  Headphones,
  Lightbulb,
  Loader2,
  Plus,
  Recycle,
  Search,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn, bi, initialsOf } from "@/lib/utils";
import { Avatar, Button, Chip, EmptyState, NativeSelect } from "@/components/ui/primitives";
import { CATEGORY_TONES } from "@/components/nexus/LessonCard";
import { OwnerControlCompact } from "@/components/nexus/people/OwnerControl";
import { ReportButton } from "@/components/nexus/ReportButton";
import { PrimaryNodeChip } from "@/components/nexus/LessonLinks";
import type { LearningRoomData, RoomLesson, RoomTheme } from "@/server/services/lessons";
import { LessonReader, useListen } from "./LessonReader";
import { LearnMode } from "./LearnMode";
import { ProjectPicker } from "./ProjectPicker";

const CATEGORY_ORDER = ["delivery", "external", "expert", "institutional"] as const;

function firstSentence(s: string | null): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").split(/(?<=[.!؟?])\s+/)[0] ?? s;
}

/* the compact lane card (CR04 3.4) */
function RoomLessonCard({
  lesson,
  onOpen,
  wide = false,
  inheritedFrom,
}: {
  lesson: RoomLesson;
  onOpen: () => void;
  wide?: boolean;
  /** CR07 1.3: set when the card is shown on a parent node */
  inheritedFrom?: string;
}) {
  const t = useTranslations("lessons");
  const locale = useLocale();
  const chipFill: Record<string, string> = {
    delivery: "group-hover/rl:bg-navy-700 group-hover/rl:text-white",
    external: "group-hover/rl:bg-teal-600 group-hover/rl:text-white",
    expert: "group-hover/rl:bg-aqua-500 group-hover/rl:text-white",
    institutional: "group-hover/rl:bg-mist-300 group-hover/rl:text-ink-900",
  };
  return (
    /* CR08 9.1: the author is a person chip, which is a button of its own, so
       the card is no longer one button: the title carries the open action and
       stretches over the card (::after), the chip sits above that overlay */
    <div
      className={cn(
        "group/rl card relative flex shrink-0 flex-col gap-1.5 p-4 text-start transition-all duration-200 ease-[var(--ease-paper)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
        wide ? "w-full" : "w-72"
      )}
      data-testid="room-lesson"
    >
      <span className="flex items-center gap-2">
        <Chip
          tone={CATEGORY_TONES[lesson.category] ?? "mist"}
          className={cn("transition-colors duration-200", chipFill[lesson.category] ?? "")}
        >
          {t(`categories.${lesson.category}` as never)}
        </Chip>
        <span
          aria-hidden
          className="inline-block size-2 rounded-full bg-navy-500 group-hover/rl:[animation:dot-once_600ms_ease-out]"
        />
        {lesson.status === "verified" ? (
          <BadgeCheck className="size-3.5 shrink-0 text-teal-600" aria-hidden />
        ) : null}
        {lesson.topReuse ? (
          <span className="ms-auto size-2 rounded-full bg-aqua-500" title={t("room.goldMark")} aria-label={t("room.goldMark")} />
        ) : null}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-md text-start after:absolute after:inset-0 after:rounded-[inherit] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-500"
        data-testid="room-lesson-open"
      >
        <span className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">
          {bi(locale, lesson.titleEn, lesson.titleAr)}
        </span>
      </button>
      <span className="line-clamp-2 text-xs leading-relaxed text-ink-600">
        {firstSentence(bi(locale, lesson.learningEn ?? "", lesson.learningAr ?? ""))}
      </span>
      {inheritedFrom ? (
        <span className="truncate text-[11px] text-ink-400" title={inheritedFrom}>
          {t("picker.fromNode", { node: inheritedFrom })}
        </span>
      ) : null}
      <span className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-[11px] text-ink-600">
        {/* CR07 1.2: the primary link rides on the card, the rest count up */}
        <PrimaryNodeChip links={lesson.links} />
        {lesson.reuseCount ? (
          <span className={cn("flex items-center gap-1 tnum", lesson.topReuse && "font-medium text-aqua-500")}>
            <Recycle className="size-3" /> {lesson.reuseCount}
          </span>
        ) : null}
        {lesson.authorId && lesson.authorNameEn ? (
          <OwnerControlCompact
            owner={{
              id: lesson.authorId,
              nameEn: lesson.authorNameEn,
              nameAr: lesson.authorNameAr ?? lesson.authorNameEn,
              avatarColor: lesson.authorColor ?? "navy",
            }}
            item={{ type: "lesson", id: lesson.id, titleEn: lesson.titleEn, titleAr: lesson.titleAr, href: `/lessons/${lesson.id}` }}
            align="end"
            className="relative z-[1] ms-auto max-w-[60%]"
          />
        ) : lesson.authorNameEn ? (
          <span className="ms-auto">
            <Avatar name={lesson.authorNameEn} color={lesson.authorColor ?? "navy"} size={18} />
          </span>
        ) : null}
      </span>
    </div>
  );
}

function ThemeSparkline({ values }: { values: number[] }) {
  const w = 90;
  const h = 22;
  const max = Math.max(1, ...values);
  const points = values
    .map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 2 - (v / max) * (h - 5)}`)
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden style={{ direction: "ltr" }} className="block">
      <polyline points={points} fill="none" stroke="var(--color-teal-400)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function LearningRoom({
  data,
  canAdd,
}: {
  data: LearningRoomData;
  canAdd: boolean;
}) {
  const t = useTranslations("lessons");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const sp = useSearchParams();
  const { listen, busyId } = useListen();

  const byId = React.useMemo(() => new Map(data.lessons.map((l) => [l.id, l])), [data.lessons]);
  const [learnMode, setLearnMode] = React.useState(false);
  const [open, setOpen] = React.useState<{ id: string; section: string } | null>(() => {
    const deep = sp.get("lesson");
    return deep && data.lessons.some((l) => l.id === deep) ? { id: deep, section: "deeplink" } : null;
  });
  const [themeOpen, setThemeOpen] = React.useState<string | null>(null);
  const [allThemes, setAllThemes] = React.useState(false);
  const [laneOpen, setLaneOpen] = React.useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    CATEGORY_ORDER.forEach((c, i) => {
      state[c] = data.lanePrefs[c] ?? i < 2; // top two expanded by default
    });
    return state;
  });
  const [browseTab, setBrowseTab] = React.useState<"projects" | "outcomes" | "contributors">("projects");
  const [q, setQ] = React.useState("");
  const [feedCategory, setFeedCategory] = React.useState("");
  const [feedOutcome, setFeedOutcome] = React.useState("");
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleLane = (key: string) => {
    setLaneOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch("/api/v1/profile/prefs", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lessonLanes: next }),
        }).catch(() => {});
      }, 500);
      return next;
    });
  };

  const openLesson = (id: string, section: string) =>
    setOpen((prev) => (prev?.id === id && prev.section === section ? null : { id, section }));

  const reader = (section: string) => (
    <AnimatePresence initial={false}>
      {open?.section === section && byId.has(open.id) ? (
        <LessonReader key={open.id} lesson={byId.get(open.id)!} onClose={() => setOpen(null)} />
      ) : null}
    </AnimatePresence>
  );

  const searchResults = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return data.lessons
      .filter((l) =>
        [l.titleEn, l.titleAr, l.learningEn ?? "", l.learningAr ?? "", l.recommendationEn ?? ""].some((s) =>
          s.toLowerCase().includes(needle)
        )
      )
      .slice(0, 8);
  }, [q, data.lessons]);

  const week = data.lessonOfWeek;
  const themes = allThemes ? data.themes : data.themes.slice(0, 8);

  const feedLessons = data.lessons.filter(
    (l) => (!feedCategory || l.category === feedCategory) && (!feedOutcome || l.outcome === feedOutcome)
  );

  return (
    <div>
      {/* header (CR04 3.2.1) */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("room.invitation")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportButton
            scope={{ kind: "lessons", ids: [], labelEn: "Lessons learned", labelAr: "الدروس المستفادة" }}
          />
          {data.learnModeEnabled ? (
            <Button
              variant={learnMode ? "primary" : "aqua"}
              onClick={() => setLearnMode((v) => !v)}
              data-testid="learn-mode-toggle"
              aria-pressed={learnMode}
            >
              <GraduationCap /> {learnMode ? t("room.leaveSession") : t("room.learnMode")}
            </Button>
          ) : null}
          {canAdd ? (
            <Link href={"/add" as never}>
              <Button>
                <Plus /> {t("addKnowledge")}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {learnMode ? (
          <motion.div
            key="session"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LearnMode onLeave={() => setLearnMode(false)} />
          </motion.div>
        ) : (
          <motion.div
            key="room"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-8"
          >
            {reader("deeplink")}

            {/* 2. Lesson of the week */}
            {week ? (
              <section data-testid="lesson-week">
                <div
                  className="bento-card relative flex min-h-60 flex-col overflow-hidden p-7"
                  style={{
                    background: `linear-gradient(to ${locale === "ar" ? "left" : "right"}, var(--color-aqua-100), #ffffff 45%)`,
                  }}
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-navy-900"
                      style={{ fontFamily: "inherit" }}
                    >
                      {t("room.lessonOfWeek")}
                    </span>
                    <Chip tone={CATEGORY_TONES[week.lesson.category] ?? "mist"}>
                      {t(`categories.${week.lesson.category}` as never)}
                    </Chip>
                    {week.suggested ? <Chip tone="ghost">{t("room.suggested")}</Chip> : null}
                    {week.lesson.topReuse ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-aqua-500 tnum">
                        <Recycle className="size-3" /> {week.lesson.reuseCount} · {t("room.goldMark")}
                      </span>
                    ) : null}
                  </p>
                  <h2
                    className="mt-2 max-w-3xl leading-snug"
                    style={{ fontSize: 26, fontFamily: locale === "ar" ? "var(--font-kufi)" : "var(--font-display)" }}
                  >
                    {bi(locale, week.lesson.titleEn, week.lesson.titleAr)}
                  </h2>
                  <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink-900" style={{ fontSize: 16 }}>
                    {firstSentence(bi(locale, week.lesson.learningEn ?? "", week.lesson.learningAr ?? ""))}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                    {week.lesson.nodeCode ? (
                      <Chip tone="mist">
                        {t("room.source")}: {week.lesson.nodeCode}
                      </Chip>
                    ) : null}
                    {week.lesson.outcomeNameEn ? (
                      <Chip tone="navy">
                        {bi(locale, week.lesson.outcomeNameEn, week.lesson.outcomeNameAr ?? "")}
                      </Chip>
                    ) : null}
                    {/* CR08 9.1: the author of the week's lesson, with the person card */}
                    {week.lesson.authorId && week.lesson.authorNameEn ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <OwnerControlCompact
                          owner={{
                            id: week.lesson.authorId,
                            nameEn: week.lesson.authorNameEn,
                            nameAr: week.lesson.authorNameAr ?? week.lesson.authorNameEn,
                            avatarColor: week.lesson.authorColor ?? "navy",
                          }}
                          item={{
                            type: "lesson",
                            id: week.lesson.id,
                            titleEn: week.lesson.titleEn,
                            titleAr: week.lesson.titleAr,
                            href: `/lessons/${week.lesson.id}`,
                          }}
                          size="md"
                        />
                        {week.lesson.departmentEn ? (
                          <span className="truncate text-ink-600">
                            · {bi(locale, week.lesson.departmentEn, week.lesson.departmentAr ?? "")}
                          </span>
                        ) : null}
                      </span>
                    ) : week.lesson.authorNameEn ? (
                      <span className="flex items-center gap-1.5">
                        <Avatar name={week.lesson.authorNameEn} color={week.lesson.authorColor ?? "navy"} size={20} />
                        {bi(locale, week.lesson.authorNameEn, week.lesson.authorNameAr ?? "")}
                        {week.lesson.departmentEn ? (
                          <span className="text-ink-600">
                            · {bi(locale, week.lesson.departmentEn, week.lesson.departmentAr ?? "")}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    <Button size="sm" onClick={() => openLesson(week.lesson.id, "week")} data-testid="week-read">
                      <BookOpen /> {t("room.read")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => listen({ lessonId: week.lesson.id })}
                      disabled={busyId === week.lesson.id}
                      data-testid="week-listen"
                    >
                      {busyId === week.lesson.id ? <Loader2 className="animate-spin" /> : <Headphones />}{" "}
                      {t("room.listen")}
                    </Button>
                  </div>
                </div>
                {reader("week")}
              </section>
            ) : null}

            {/* 3. Themes */}
            {data.themes.length ? (
              <section data-testid="themes-row">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
                    style={{ fontFamily: "inherit" }}
                  >
                    {t("room.themes")}
                  </h2>
                  {data.themes.length > 8 ? (
                    <button
                      onClick={() => setAllThemes((v) => !v)}
                      className="link-draw text-xs font-medium text-navy-700 cursor-pointer"
                    >
                      {t("room.allThemes")}
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {themes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      open={themeOpen === theme.id}
                      onToggle={() => setThemeOpen(themeOpen === theme.id ? null : theme.id)}
                    />
                  ))}
                </div>
                <AnimatePresence initial={false}>
                  {themeOpen ? (
                    <ThemeLane
                      key={themeOpen}
                      theme={data.themes.find((th) => th.id === themeOpen)!}
                      lessons={data.themes
                        .find((th) => th.id === themeOpen)!
                        .lessonIds.map((id) => byId.get(id))
                        .filter(Boolean) as RoomLesson[]}
                      onOpenLesson={(id) => openLesson(id, "themes")}
                      onListen={() => listen({ themeId: themeOpen })}
                      listening={busyId === themeOpen}
                    />
                  ) : null}
                </AnimatePresence>
                {reader("themes")}
              </section>
            ) : null}

            {/* 4. Category lanes */}
            <section data-testid="category-lanes">
              <h2
                className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
                style={{ fontFamily: "inherit" }}
              >
                {t("room.lanes")}
              </h2>
              <div className="flex flex-col gap-4">
                {CATEGORY_ORDER.map((category) => {
                  const lessons = data.lessons.filter((l) => l.category === category);
                  const isOpen = laneOpen[category] && lessons.length > 0;
                  const avgReuse = lessons.length
                    ? (lessons.reduce((sum, l) => sum + l.reuseCount, 0) / lessons.length).toFixed(1)
                    : "0";
                  return (
                    <div key={category} data-testid={`lane-${category}`}>
                      <div className="flex w-full items-center gap-2 px-1">
                        <button
                          onClick={() => toggleLane(category)}
                          aria-expanded={isOpen}
                          className="flex min-w-0 items-center gap-2 rounded-lg py-1.5 text-start hover:text-navy-900 cursor-pointer"
                        >
                          <span className="text-sm font-medium text-ink-900">
                            {t(`categories.${category}` as never)}
                          </span>
                          <span className="text-xs text-ink-600 tnum">{lessons.length}</span>
                          <span className="text-[11px] text-ink-600 tnum">
                            · {avgReuse} {t("room.avgReuse")}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            setFeedCategory(category);
                            document.getElementById("all-lessons")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="link-draw ms-2 text-[11px] font-medium text-navy-700 cursor-pointer"
                        >
                          {t("room.seeAll")}
                        </button>
                        <span className="mx-2 h-px flex-1 bg-mist-300/70" aria-hidden />
                        <button
                          onClick={() => toggleLane(category)}
                          aria-label={t(`categories.${category}` as never)}
                          aria-expanded={isOpen}
                          className="rounded p-1 cursor-pointer"
                        >
                          <ChevronDown
                            className={cn("size-4 shrink-0 text-ink-400 transition-transform duration-200", !isOpen && "-rotate-90 rtl:rotate-90")}
                            aria-hidden
                          />
                        </button>
                      </div>
                      {isOpen ? (
                        <div className="mt-2 flex gap-3 overflow-x-auto pb-2" style={{ overscrollBehaviorX: "contain" }}>
                          {[...lessons]
                            .sort((a, b) => b.score - a.score)
                            .map((l) => (
                              <RoomLessonCard key={l.id} lesson={l} onOpen={() => openLesson(l.id, "lanes")} />
                            ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {reader("lanes")}
            </section>

            {/* 5. Browse tools */}
            <section data-testid="browse-tools">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2
                  className="me-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
                  style={{ fontFamily: "inherit" }}
                >
                  {t("room.browse")}
                </h2>
                <span className="inline-flex items-center gap-0.5 rounded-lg bg-mist-100 p-0.5">
                  {(
                    [
                      ["projects", t("room.byProject")],
                      ["outcomes", t("room.byOutcome")],
                      ["contributors", t("room.byContributor")],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setBrowseTab(key)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer",
                        browseTab === key ? "bg-white font-medium text-navy-900 shadow-sm" : "text-ink-600"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </span>
                <span className="relative ms-auto">
                  <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("room.searchLessons")}
                    className="h-9 w-64 rounded-lg border border-mist-300 bg-white ps-8 pe-3 text-sm placeholder:text-ink-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-100"
                    data-testid="lesson-search"
                  />
                </span>
              </div>

              {q.trim().length >= 2 ? (
                <div className="card divide-y divide-mist-100">
                  {searchResults.length ? (
                    searchResults.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => openLesson(l.id, "browse")}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm hover:bg-navy-50 cursor-pointer"
                      >
                        <Lightbulb className="size-4 shrink-0 text-aqua-500" />
                        <span className="min-w-0 flex-1 truncate text-ink-900">
                          {bi(locale, l.titleEn, l.titleAr)}
                        </span>
                        {l.nodeCode ? <Chip tone="mist">{l.nodeCode}</Chip> : null}
                      </button>
                    ))
                  ) : (
                    <p className="px-4 py-6 text-center text-sm text-ink-600">{t("room.noResults")}</p>
                  )}
                </div>
              ) : browseTab === "projects" ? (
                /* CR07 1.3: a real picker with search, drill down, counts at
                   every level, the store switch and a Not linked group */
                <ProjectPicker
                  picker={data.picker}
                  lessons={data.lessons}
                  renderLesson={(lesson, inheritedFrom) => (
                    <RoomLessonCard
                      key={lesson.id}
                      lesson={lesson}
                      inheritedFrom={inheritedFrom}
                      onOpen={() => openLesson(lesson.id, "browse")}
                    />
                  )}
                />
              ) : browseTab === "outcomes" ? (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {data.outcomes
                      .filter((o) => o.count > 0)
                      .map((o) => (
                        <button
                          key={o.tax}
                          onClick={() => setFeedOutcome(feedOutcome === o.tax ? "" : o.tax)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer",
                            feedOutcome === o.tax
                              ? "border-navy-700 bg-navy-700 text-white"
                              : "border-mist-300 bg-white text-ink-900 hover:border-navy-300"
                          )}
                        >
                          {bi(locale, o.nameEn, o.nameAr)} <span className="tnum">{o.count}</span>
                        </button>
                      ))}
                  </div>
                  {feedOutcome ? (
                    <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                      {data.lessons
                        .filter((l) => l.outcome === feedOutcome)
                        .map((l) => (
                          <RoomLessonCard key={l.id} lesson={l} onOpen={() => openLesson(l.id, "browse")} />
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.contributors.map((c) => (
                    <span key={c.nameEn} className="flex items-center gap-2 rounded-lg border border-mist-100 bg-white px-3 py-2 text-xs">
                      <span
                        className="flex size-6 items-center justify-center rounded-full bg-navy-700 text-[10px] font-semibold text-white"
                        aria-hidden
                      >
                        {initialsOf(c.nameEn)}
                      </span>
                      <span className="text-ink-900">{bi(locale, c.nameEn, c.nameAr)}</span>
                      <span className="text-ink-600 tnum">{c.count}</span>
                    </span>
                  ))}
                </div>
              )}
              {reader("browse")}
            </section>

            {/* 6. All lessons */}
            <section id="all-lessons" data-testid="all-lessons">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600"
                  style={{ fontFamily: "inherit" }}
                >
                  {t("room.allLessons")}
                </h2>
                <span className="mx-2 h-px flex-1 bg-mist-300/70" aria-hidden />
                <NativeSelect
                  value={feedCategory}
                  onChange={(e) => setFeedCategory(e.target.value)}
                  className="w-auto"
                  aria-label={t("room.lanes")}
                >
                  <option value="">{t("categoriesAll")}</option>
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}` as never)}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  value={feedOutcome}
                  onChange={(e) => setFeedOutcome(e.target.value)}
                  className="w-auto max-w-44"
                  aria-label={t("filterOutcome")}
                >
                  <option value="">{t("filterOutcome")}</option>
                  {data.outcomes.map((o) => (
                    <option key={o.tax} value={o.tax}>
                      {bi(locale, o.nameEn, o.nameAr)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {feedLessons.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {feedLessons.map((l) => (
                    <RoomLessonCard key={l.id} lesson={l} wide onOpen={() => openLesson(l.id, "feed")} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Lightbulb />} title={t("empty")} hint={t("emptyHint")} />
              )}
              {reader("feed")}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeCard({
  theme,
  open,
  onToggle,
}: {
  theme: RoomTheme;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("lessons");
  const locale = useLocale();
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        // min-w-0: a grid item will not shrink below its content otherwise, and
        // the footer row below carries a count, two chips and a sparkline
        "bento-card flex min-w-0 flex-col gap-1.5 p-4 text-start cursor-pointer",
        open && "border-navy-300"
      )}
      data-testid="theme-card"
    >
      <span className="text-sm font-medium leading-snug text-ink-900">
        {bi(locale, theme.labelEn, theme.labelAr)}
      </span>
      {(theme.summaryEn || theme.summaryAr) ? (
        <span className="line-clamp-2 text-xs leading-relaxed text-ink-600">
          {bi(locale, theme.summaryEn ?? "", theme.summaryAr ?? "")}
        </span>
      ) : null}
      <span className="mt-auto flex min-w-0 items-center justify-between gap-2 pt-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] text-ink-600 tnum">{t("room.themeLessons", { count: theme.count })}</span>
          {theme.outcomes.slice(0, 2).map((o) => (
            <Chip key={o.code} tone="navy" className="shrink-0">{o.code}</Chip>
          ))}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <ThemeSparkline values={theme.perMonth} />
          <span className="text-[9px] text-ink-600">{t("room.perMonth")}</span>
        </span>
      </span>
    </button>
  );
}

function ThemeLane({
  theme,
  lessons,
  onOpenLesson,
  onListen,
  listening,
}: {
  theme: RoomTheme;
  lessons: RoomLesson[];
  onOpenLesson: (id: string) => void;
  onListen: () => void;
  listening: boolean;
}) {
  const t = useTranslations("lessons");
  const locale = useLocale();
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduced ? undefined : { height: 0, opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
      data-testid="theme-lane"
    >
      <div className="mt-3 rounded-xl border border-navy-100 bg-navy-50/40 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-900">{bi(locale, theme.labelEn, theme.labelAr)}</p>
          <Button size="sm" variant="secondary" onClick={onListen} disabled={listening}>
            {listening ? <Loader2 className="animate-spin" /> : <Headphones />} {t("room.listenTheme")}
          </Button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[...lessons]
            .sort((a, b) => b.score - a.score)
            .map((l) => (
              <RoomLessonCard key={l.id} lesson={l} onOpen={() => onOpenLesson(l.id)} />
            ))}
        </div>
      </div>
    </motion.div>
  );
}
