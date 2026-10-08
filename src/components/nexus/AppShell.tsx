"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { usePathname as useRawPathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Home,
  Library,
  Compass,
  BarChart3,
  Globe2,
  Users,
  Lightbulb,
  Radar,
  Settings,
  LogOut,
  UserRound,
  Building2,
  Sparkles,
  Podcast,
  HeartHandshake,
  Eye,
  Target,
  Network,
  Workflow,
  BookOpenText,
  FileText,
  Layers,
  Trophy,
  Inbox,
  PanelLeftOpen,
  PanelLeftClose,
  ChevronDown,
  Droplet,
  Sprout,
  Cloud,
  Scale,
  Bookmark,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_RAIL, RAIL_GROUPS } from "@/server/db/json";
import { SiaLogo } from "./Logo";
import { Avatar, ProgressRing, Chip } from "@/components/ui/primitives";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  TooltipProvider,
  Tip,
} from "@/components/ui/overlays";
import { ToastProvider } from "@/components/ui/toast";
import { GlobalSearch } from "./GlobalSearch";
import { GlobalDropZone } from "./GlobalDropZone";
import { NotificationsMenu } from "./NotificationsMenu";
import { MiniPlayer } from "./MiniPlayer";
import { AskBarButton } from "./ask/AskBarButton";
import { AskEverywhere } from "./ask/AskEverywhere";

export type RailPrefs = {
  expanded: boolean;
  collapsed: string[];
};

export type ShellUser = {
  id: string;
  nameEn: string;
  nameAr: string;
  email: string;
  avatarColor: string;
  departmentCode: string | null;
  canSettings: boolean;
  canUpload: boolean;
  levelProgress: number; // 0..1 toward next level
  levelName: string;
  /* CR08 7.1: shown only on hover */
  levelDescriptor: string;
  points: number;
  quietMode: boolean;
  clearance: number;
  /* CR05 6.1: the visible portal keys, in rail order */
  portals: string[];
  /* CR05 6.4: non-null while a Super Admin previews as this role/user */
  previewLabel: string | null;
  /* CR08 2.2: the rail state remembered per user */
  rail: RailPrefs;
  /* CR08 8: a live Knowledge of the Week lights the Knowledge Hub group */
  knowledgeOfWeekLive: boolean;
  /* CR08 9.2: unread message threads */
  inboxUnread: number;
};

/* EnviroAI rail: the primary items (PRIMARY_RAIL in json.ts) sit at the top
   with bilingual labels; every other module lives in the collapsible "More"
   group (RAIL_GROUPS). Settings stands alone at the bottom. Ask left the rail
   for the bar button and the floating launcher. */
const PAGES: Record<string, { href: string; icon: LucideIcon }> = {
  home: { href: "/home", icon: Home },
  regulatory: { href: "/regulatory", icon: Scale },
  sources: { href: "/sources", icon: Bookmark },
  council: { href: "/council-strategy", icon: Target },
  strategy: { href: "/strategy", icon: Compass },
  statistics: { href: "/statistics", icon: BarChart3 },
  indices: { href: "/indices", icon: Globe2 },
  trends: { href: "/trends", icon: Radar },
  vault: { href: "/vault", icon: Library },
  processes: { href: "/processes", icon: Workflow },
  studies: { href: "/studies", icon: BookOpenText },
  lessons: { href: "/lessons", icon: Lightbulb },
  podcast: { href: "/podcast", icon: Podcast },
  reports: { href: "/reports", icon: FileText },
  experts: { href: "/experts", icon: Users },
  organisation: { href: "/organisation", icon: Network },
  operating_model: { href: "/operating-model", icon: Layers },
  hr: { href: "/hr", icon: HeartHandshake },
  leaderboard: { href: "/leaderboard", icon: Trophy },
};

const PRIMARY_ICON: Record<string, LucideIcon> = {
  home: Home,
  indices: Globe2,
  water: Droplet,
  agriculture: Sprout,
  climate: Cloud,
  regulatory: Scale,
  sources: Bookmark,
  trends: BarChart3,
  vault: Library,
};

const GROUP_ICON: Record<string, LucideIcon> = {
  more: Layers,
};

/* The rail prefs store the groups the reader has collapsed; "More" starts
   closed, so its state is kept as an opened marker in the same list. */
const MORE_OPEN = "more:open";

const ROW =
  "relative flex min-h-10 items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5 text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-aqua-500";
const ROW_IDLE = "text-white/80 hover:bg-white/8 hover:text-white";
const ROW_ACTIVE = "bg-aqua-500/15 font-medium text-white";
/* the compact flyout is a white card, so its rows use the light palette */
const ROW_IDLE_LIGHT = "text-ink-600 hover:bg-mist-100 hover:text-ink-900";
const ROW_ACTIVE_LIGHT = "bg-navy-100 font-medium text-navy-700";

export function AppShell({
  user,
  aiMock,
  unreadCount,
  children,
}: {
  user: ShellUser;
  aiMock: boolean;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations("shell");
  const pathname = usePathname();
  const rawPathname = useRawPathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const name = locale === "ar" ? user.nameAr : user.nameEn;

  const otherLocale = locale === "ar" ? "en" : "ar";
  const switchHref = rawPathname.replace(`/${locale}`, `/${otherLocale}`);

  /* rail state: server-provided, persisted per user (users.prefs_json.rail) */
  const [expanded, setExpanded] = React.useState(user.rail.expanded);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set(user.rail.collapsed)
  );
  const [flyout, setFlyout] = React.useState<string | null>(null);
  const flyoutTimer = React.useRef<number | null>(null);
  /* CR08 2.2: under 768px the rail is a drawer opened from the bar */
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const showLabels = expanded || mobileOpen;

  const persist = React.useCallback((next: RailPrefs) => {
    fetch("/api/v1/profile/prefs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rail: next }),
    }).catch(() => {});
  }, []);

  const visible = new Set(user.portals);
  const searchParams = useSearchParams();
  const theme = searchParams.get("o");

  type PrimaryItem = {
    key: string;
    href: string;
    icon: LucideIcon;
    theme?: string;
  };
  const primary: PrimaryItem[] = PRIMARY_RAIL.filter((i) => visible.has(i.portal)).map((i) => ({
    key: i.key,
    href: i.theme ? `/strategy?o=${i.theme}` : PAGES[i.portal].href,
    icon: PRIMARY_ICON[i.key] ?? PAGES[i.portal].icon,
    theme: i.theme,
  }));
  const groups = RAIL_GROUPS.map((g) => ({
    key: g.key,
    icon: GROUP_ICON[g.key] ?? Layers,
    pages: g.portals.filter((p) => visible.has(p) && PAGES[p]),
  })).filter((g) => g.pages.length > 0);

  const themeSlugs = PRIMARY_RAIL.flatMap((i) => (i.theme ? [i.theme] : []));
  const isPrimaryActive = (item: PrimaryItem) => {
    if (item.theme) return pathname.startsWith("/strategy") && theme === item.theme;
    if (item.key === "home") return pathname === "/home" || pathname.startsWith("/home/");
    return pathname.startsWith(item.href);
  };
  const isActive = (portal: string) => {
    if (portal === "strategy") {
      return pathname.startsWith("/strategy") && !(theme && themeSlugs.includes(theme as never));
    }
    return pathname.startsWith(PAGES[portal].href);
  };
  const activeGroup = groups.find((g) => g.pages.some(isActive))?.key ?? null;

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    setFlyout(null);
    persist({ expanded: next, collapsed: [...collapsed] });
  }

  function toggleGroup(key: string) {
    if (key === activeGroup) return; // the active group always stays open
    const marker = `${key}:open`;
    const next = new Set(collapsed);
    if (next.has(marker)) next.delete(marker);
    else next.add(marker);
    setCollapsed(next);
    persist({ expanded, collapsed: [...next] });
  }

  function openFlyout(key: string) {
    if (flyoutTimer.current) window.clearTimeout(flyoutTimer.current);
    setFlyout(key);
  }
  function scheduleCloseFlyout() {
    if (flyoutTimer.current) window.clearTimeout(flyoutTimer.current);
    flyoutTimer.current = window.setTimeout(() => setFlyout(null), 160);
  }

  React.useEffect(() => {
    setFlyout(null);
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const groupLabel = (key: string) => t(`groups.${key}` as never);

  /* a More row: one line, icon plus label */
  function PageRow({
    portal,
    showLabel,
    light = false,
  }: {
    portal: string;
    showLabel: boolean;
    light?: boolean;
  }) {
    const page = PAGES[portal];
    const active = isActive(portal);
    return (
      <Link
        href={page.href as never}
        className={cn(
          ROW,
          light ? (active ? ROW_ACTIVE_LIGHT : ROW_IDLE_LIGHT) : active ? ROW_ACTIVE : ROW_IDLE
        )}
        aria-current={active ? "page" : undefined}
        data-testid={`rail-${portal}`}
      >
        <page.icon className={cn("size-5 shrink-0", active && (light ? "text-navy-700" : "text-aqua-500"))} />
        {showLabel ? (
          <span className="line-clamp-2 leading-tight">{t(`nav.${portal}` as never)}</span>
        ) : (
          <span className="sr-only">{t(`nav.${portal}` as never)}</span>
        )}
      </Link>
    );
  }

  /* a primary row: bilingual, the reader's language first, aqua bar when active */
  function PrimaryRow({ item, showLabel }: { item: PrimaryItem; showLabel: boolean }) {
    const active = isPrimaryActive(item);
    const first = t(`primary.${item.key}.${locale === "ar" ? "ar" : "en"}` as never);
    const second = t(`primary.${item.key}.${locale === "ar" ? "en" : "ar"}` as never);
    return (
      <Link
        href={item.href as never}
        className={cn(ROW, "min-h-12 py-2", active ? ROW_ACTIVE : ROW_IDLE)}
        aria-current={active ? "page" : undefined}
        data-testid={`rail-${item.key}`}
      >
        {active ? (
          <span className="absolute inset-y-0 start-0 w-1 rounded-e-full bg-aqua-500" aria-hidden />
        ) : null}
        <item.icon className={cn("size-5 shrink-0", active && "text-aqua-500")} />
        {showLabel ? (
          <span className="min-w-0 leading-tight">
            <span className="block text-sm">{first}</span>
            <span className="block text-xs font-normal text-white/65">{second}</span>
          </span>
        ) : (
          <span className="sr-only">{first}</span>
        )}
      </Link>
    );
  }

  return (
    <TooltipProvider>
      <ToastProvider>
        <GlobalDropZone enabled={user.canUpload}>
          <div className="flex min-h-screen">
            {/* CR08 2.2: the scrim behind the mobile drawer */}
            {mobileOpen ? (
              <button
                type="button"
                className="fixed inset-0 z-40 bg-ink-900/40 md:hidden"
                aria-label={t("rail.collapse")}
                onClick={() => setMobileOpen(false)}
              />
            ) : null}
            {/* Rail: dark navy sidebar at the start edge, grouped, collapsible,
                remembered per user */}
            <nav
              className={cn(
                "flex shrink-0 flex-col items-stretch gap-1 border-e border-black/20 bg-navy-700 px-2.5 py-4 text-white transition-[width] duration-300",
                mobileOpen
                  ? "fixed inset-y-0 start-0 z-50 h-screen w-[264px] shadow-pop"
                  : "sticky top-0 z-40 hidden h-screen md:flex",
                !mobileOpen && (expanded ? "w-[264px]" : "w-[72px]")
              )}
              aria-label={t("mainNav")}
              data-testid="rail"
              data-expanded={showLabels ? "1" : "0"}
            >
              <div className="mb-3 flex h-12 items-center justify-between gap-2 ps-1.5">
                <Link href="/home" className="flex h-10 items-center overflow-hidden" aria-label="EnviroAI">
                  {showLabels ? (
                    <SiaLogo variant="full" white height={34} className="shrink-0" />
                  ) : (
                    <SiaLogo variant="mark" white height={32} className="shrink-0" />
                  )}
                </Link>
                {mobileOpen ? (
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-label={t("rail.collapse")}
                    data-testid="rail-close"
                  >
                    <X className="size-4" />
                  </button>
                ) : expanded ? (
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-label={t("rail.collapse")}
                    data-testid="rail-toggle"
                  >
                    <PanelLeftClose className="size-4 flip-rtl" />
                  </button>
                ) : null}
              </div>
              {!showLabels ? (
                <button
                  type="button"
                  onClick={toggleExpanded}
                  className={cn(ROW, ROW_IDLE, "mb-1 cursor-pointer")}
                  aria-label={t("rail.expand")}
                  data-testid="rail-toggle"
                >
                  <PanelLeftOpen className="size-5 shrink-0 flip-rtl" />
                </button>
              ) : null}

              <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-visible">
                {primary.map((item) => (
                  <React.Fragment key={item.key}>
                    {item.key === "regulatory" ? (
                      <hr className="mx-3 my-1.5 border-white/15" aria-hidden />
                    ) : null}
                    <PrimaryRow item={item} showLabel={showLabels} />
                  </React.Fragment>
                ))}

                {groups.map((g) => {
                  const active = g.key === activeGroup;
                  const open = active || collapsed.has(`${g.key}:open`);
                  const label = groupLabel(g.key);
                  if (!showLabels) {
                    /* compact: one icon for the group, a flyout with its pages */
                    const isOpen = flyout === g.key;
                    return (
                      <div
                        key={g.key}
                        className="relative"
                        onMouseEnter={() => openFlyout(g.key)}
                        onMouseLeave={scheduleCloseFlyout}
                        onFocus={() => openFlyout(g.key)}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) scheduleCloseFlyout();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setFlyout(null);
                        }}
                      >
                        <button
                          type="button"
                          className={cn(ROW, "w-full cursor-pointer", active ? ROW_ACTIVE : ROW_IDLE)}
                          aria-haspopup="menu"
                          aria-expanded={isOpen}
                          aria-label={t("rail.groupMenu", { group: label })}
                          onClick={() => setFlyout(isOpen ? null : g.key)}
                          data-testid={`rail-group-${g.key}`}
                        >
                          <g.icon className={cn("size-5 shrink-0", active && "text-aqua-500")} />
                        </button>
                        <AnimatePresence>
                          {isOpen ? (
                            <motion.div
                              role="menu"
                              aria-label={label}
                              initial={reduce ? false : { opacity: 0, x: locale === "ar" ? 6 : -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={reduce ? undefined : { opacity: 0, x: locale === "ar" ? 6 : -6 }}
                              transition={{ duration: 0.18 }}
                              className="absolute top-0 z-50 max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-mist-200 bg-white p-2 shadow-pop start-[calc(100%+6px)]"
                              data-testid={`rail-flyout-${g.key}`}
                            >
                              <p className="mb-1 px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
                                {label}
                              </p>
                              {g.pages.map((p) => (
                                <PageRow key={p} portal={p} showLabel light />
                              ))}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  }
                  /* expanded: the "More" header with a chevron, animated height */
                  return (
                    <div key={g.key} data-testid={`rail-group-${g.key}`} className="mt-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.key)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus-visible:outline-2 focus-visible:outline-aqua-500",
                          active ? "cursor-default" : "cursor-pointer hover:bg-white/8 hover:text-white"
                        )}
                        aria-expanded={open}
                        aria-label={open ? t("rail.closeGroup", { group: label }) : t("rail.openGroup", { group: label })}
                        aria-disabled={active || undefined}
                      >
                        <g.icon className="size-5 shrink-0" />
                        <span className="truncate">{label}</span>
                        <ChevronDown
                          className={cn(
                            "ms-auto size-4 shrink-0 transition-transform duration-200",
                            open ? "rotate-180" : "",
                            active && "opacity-0"
                          )}
                          aria-hidden
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {open ? (
                          <motion.div
                            key="pages"
                            initial={reduce ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reduce ? undefined : { height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="ms-4 flex flex-col gap-0.5 border-s border-white/15 ps-1.5 pt-1">
                              {g.pages.map((p) => (
                                <PageRow key={p} portal={p} showLabel />
                              ))}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

              <div className="mt-auto flex flex-col gap-1 pt-2">
                {user.canSettings ? (
                  <Link
                    href="/settings"
                    className={cn(ROW, pathname.startsWith("/settings") ? ROW_ACTIVE : ROW_IDLE)}
                    data-testid="rail-settings"
                  >
                    {pathname.startsWith("/settings") ? (
                      <span className="absolute inset-y-0 start-0 w-1 rounded-e-full bg-aqua-500" aria-hidden />
                    ) : null}
                    <Settings className="size-5 shrink-0" />
                    {showLabels ? (
                      <span className="whitespace-nowrap">{t("nav.settings")}</span>
                    ) : (
                      <span className="sr-only">{t("nav.settings")}</span>
                    )}
                  </Link>
                ) : null}
                {/* The Sia logo in the sidebar footer, white on the navy ground */}
                <div className="mt-1 flex items-center gap-2 border-t border-white/15 px-3 pt-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/Sia_logo_white.svg"
                    alt="Sia"
                    className={cn("w-auto select-none", showLabels ? "h-7" : "h-5")}
                    draggable={false}
                  />
                  {showLabels ? (
                    <span className="text-[11px] leading-tight text-white/65">{t("poweredBy")}</span>
                  ) : null}
                </div>
              </div>
            </nav>

            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Top bar: white, wide rounded search, EN/AR segmented toggle,
                  bell, user menu */}
              <header
                className="topbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-mist-300 bg-white px-4 text-navy-900 md:gap-4 md:px-6"
              >
                {/* CR08 2.2: the drawer handle under 768px */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="rounded-lg p-2 text-navy-900 hover:bg-mist-100 md:hidden cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-aqua-500"
                  aria-label={t("mainNav")}
                  aria-expanded={mobileOpen}
                  data-testid="rail-open"
                >
                  <Menu className="size-5" />
                </button>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
                  <GlobalSearch />
                  {/* CR08 2.3: the solid Ask button right after the search */}
                  {visible.has("ask") ? <AskBarButton /> : null}
                </div>
                <div className="flex items-center gap-2">
                  {aiMock ? (
                    <Tip content={t("aiMockHint")}>
                      <span>
                        <Chip tone="aqua" className="hidden md:inline-flex">
                          <Sparkles className="size-3" /> {t("aiMock")}
                        </Chip>
                      </span>
                    </Tip>
                  ) : null}
                  {/* EN / AR segmented toggle: the active language is the aqua pill */}
                  <div
                    className="flex items-center rounded-full border border-mist-300 bg-mist-50 p-0.5 text-xs font-semibold"
                    role="group"
                    aria-label={t("languageToggle")}
                    data-testid="lang-toggle"
                  >
                    {(["en", "ar"] as const).map((l) =>
                      l === locale ? (
                        <span
                          key={l}
                          className="rounded-full bg-aqua-500 px-3 py-1.5 text-navy-900"
                          aria-current="true"
                        >
                          {l.toUpperCase()}
                        </span>
                      ) : (
                        <Link
                          key={l}
                          href={"/home"}
                          locale={otherLocale}
                          // preserve current path on locale switch
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = switchHref;
                          }}
                          className="rounded-full px-3 py-1.5 text-ink-600 hover:text-navy-900"
                          // the name has to contain the word on the button
                          aria-label={t("switchLanguageTo", { language: otherLocale === "ar" ? "العربية" : "EN" })}
                        >
                          {l.toUpperCase()}
                        </Link>
                      )
                    )}
                  </div>
                  {/* CR08 9.2: the inbox sits next to the notifications */}
                  {visible.has("inbox") ? (
                    <Link
                      href={"/inbox" as never}
                      className="relative rounded-lg p-2 text-navy-900 hover:bg-mist-100 outline-none focus-visible:outline-2 focus-visible:outline-aqua-500"
                      aria-label={t("inboxUnread", { count: user.inboxUnread })}
                      data-testid="bar-inbox"
                    >
                      <Inbox className="size-5" />
                      {user.inboxUnread > 0 ? (
                        <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-aqua-500 px-1 text-[10px] font-semibold text-ink-900">
                          {user.inboxUnread > 9 ? "9+" : user.inboxUnread}
                        </span>
                      ) : null}
                    </Link>
                  ) : null}
                  <NotificationsMenu unreadCount={unreadCount} />
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <button
                        className="ms-1 flex items-center gap-2 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-aqua-500 cursor-pointer"
                        aria-label={t("userMenu")}
                      >
                        <ProgressRing value={user.quietMode ? 0 : user.levelProgress} size={44} stroke={2.5} color="var(--color-aqua-500)">
                          <Avatar name={user.nameEn} color={user.avatarColor} size={34} />
                        </ProgressRing>
                        <span className="hidden max-w-[160px] truncate text-sm font-medium text-navy-900 lg:inline">
                          {name}
                        </span>
                        <ChevronDown className="hidden size-4 text-ink-400 lg:block" aria-hidden />
                      </button>
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      <div className="px-2.5 py-2">
                        <p className="text-sm font-medium text-ink-900">{name}</p>
                        {!user.quietMode ? (
                          <p className="text-xs text-ink-400">
                            {/* CR08 7.1: the descriptor shows only on hover */}
                            <span title={user.levelDescriptor || undefined}>{user.levelName}</span>
                            {" · "}
                            {user.points.toLocaleString()} {t("points")}
                          </p>
                        ) : null}
                      </div>
                      <DropdownSeparator />
                      <DropdownItem onSelect={() => router.push("/profile")}>
                        <UserRound /> {t("myProfile")}
                      </DropdownItem>
                      {user.departmentCode ? (
                        <DropdownItem onSelect={() => router.push(`/departments/${user.departmentCode}`)}>
                          <Building2 /> {t("myDepartment")}
                        </DropdownItem>
                      ) : null}
                      <DropdownSeparator />
                      <DropdownItem onSelect={logout}>
                        <LogOut /> {t("logout")}
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                </div>
              </header>

              {/* CR05 6.4: the read-only preview banner */}
              {user.previewLabel ? (
                <div
                  className="flex items-center justify-center gap-3 bg-aqua-100 px-4 py-1.5 text-xs text-navy-900"
                  data-testid="preview-banner"
                >
                  <Eye className="size-3.5" aria-hidden />
                  {t("previewBanner", { label: user.previewLabel })}
                  <button
                    onClick={async () => {
                      await fetch("/api/v1/preview", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ action: "exit" }),
                      });
                      window.location.href = `/${locale}/settings?tab=roles`;
                    }}
                    className="rounded-md border border-navy-300 px-2 py-0.5 font-medium hover:bg-navy-100 cursor-pointer"
                    data-testid="preview-exit"
                  >
                    {t("previewExit")}
                  </button>
                </div>
              ) : null}

              <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 pb-20">
                {children}
              </main>
            </div>
          </div>
          {/* CR02 4.6: playback continues across page navigation */}
          <MiniPlayer />
          {/* CR08 2.3: the floating launcher and the side panel, on every page */}
          {visible.has("ask") ? <AskEverywhere /> : null}
        </GlobalDropZone>
      </ToastProvider>
    </TooltipProvider>
  );
}
