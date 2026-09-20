"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { usePathname as useRawPathname } from "next/navigation";
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
  Star,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RAIL_GROUPS } from "@/server/db/json";
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

/* CR08 2.2: every page of the rail, keyed by portal. Home and Settings stand
   alone; the rest sit inside the four groups of RAIL_GROUPS (json.ts). Ask NPC
   left the rail for the bar button and the floating launcher (2.3). */
const PAGES: Record<string, { href: string; icon: LucideIcon }> = {
  home: { href: "/home", icon: Home },
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

const GROUP_ICON: Record<string, LucideIcon> = {
  strategy_hub: Compass,
  data: BarChart3,
  knowledge: Library,
  people: Users,
};

const ROW =
  "flex min-h-10 items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5 text-sm transition-colors outline-none focus-visible:outline-2 focus-visible:outline-gold-500";
const ROW_IDLE = "text-ink-600 hover:bg-white/70 hover:text-ink-900";
const ROW_ACTIVE = "bg-maroon-100 font-medium text-maroon-700";

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
  const groups = RAIL_GROUPS.map((g) => ({
    key: g.key,
    icon: GROUP_ICON[g.key] ?? Layers,
    pages: g.portals.filter((p) => visible.has(p) && PAGES[p]),
  })).filter((g) => g.pages.length > 0);

  const isActive = (portal: string) => pathname.startsWith(PAGES[portal].href);
  const activeGroup = groups.find((g) => g.pages.some(isActive))?.key ?? null;

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    setFlyout(null);
    persist({ expanded: next, collapsed: [...collapsed] });
  }

  function toggleGroup(key: string) {
    if (key === activeGroup) return; // the active group always stays open
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
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

  function PageRow({ portal, showLabel }: { portal: string; showLabel: boolean }) {
    const page = PAGES[portal];
    const active = isActive(portal);
    return (
      <Link
        href={page.href as never}
        className={cn(ROW, active ? ROW_ACTIVE : ROW_IDLE)}
        aria-current={active ? "page" : undefined}
        data-testid={`rail-${portal}`}
      >
        <page.icon className={cn("size-5 shrink-0", active && "text-maroon-700")} />
        {showLabel ? (
          <span className="line-clamp-2 leading-tight">{t(`nav.${portal}` as never)}</span>
        ) : (
          <span className="sr-only">{t(`nav.${portal}` as never)}</span>
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
            {/* Rail (CR08 2.2: grouped, collapsible, remembered per user) */}
            <nav
              className={cn(
                "flex shrink-0 flex-col items-stretch gap-1 border-e border-sand-300 bg-sand-100 px-2.5 py-4 transition-[width] duration-300",
                mobileOpen
                  ? "fixed inset-y-0 start-0 z-50 h-screen w-[232px] shadow-pop"
                  : "sticky top-0 z-40 hidden h-screen md:flex",
                !mobileOpen && (expanded ? "w-[232px]" : "w-[72px]")
              )}
              aria-label={t("mainNav")}
              data-testid="rail"
              data-expanded={showLabels ? "1" : "0"}
            >
              <div className="mb-3 flex h-10 items-center justify-between gap-2 ps-1.5">
                <Link href="/home" className="flex h-10 items-center overflow-hidden" aria-label="SiaNexus">
                  {showLabels ? (
                    <SiaLogo variant="full" height={22} className="shrink-0" />
                  ) : (
                    <SiaLogo variant="mark" height={30} className="shrink-0" />
                  )}
                </Link>
                {mobileOpen ? (
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md p-1.5 text-ink-400 hover:bg-white/70 hover:text-ink-900 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-gold-500"
                    aria-label={t("rail.collapse")}
                    data-testid="rail-close"
                  >
                    <X className="size-4" />
                  </button>
                ) : expanded ? (
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="rounded-md p-1.5 text-ink-400 hover:bg-white/70 hover:text-ink-900 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-gold-500"
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

              {visible.has("home") ? <PageRow portal="home" showLabel={showLabels} /> : null}

              <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-visible">
                {groups.map((g) => {
                  const active = g.key === activeGroup;
                  const open = active || !collapsed.has(g.key);
                  const label = groupLabel(g.key);
                  const star = g.key === "knowledge" && user.knowledgeOfWeekLive;
                  if (!showLabels) {
                    /* compact: one icon per group, a flyout with its pages */
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
                          <span className="relative">
                            <g.icon className={cn("size-5 shrink-0", active && "text-maroon-700")} />
                            {star ? (
                              <Star
                                className="absolute -end-1.5 -top-1.5 size-3 fill-gold-500 text-gold-500"
                                aria-hidden
                              />
                            ) : null}
                          </span>
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
                              className="absolute top-0 z-50 w-56 rounded-xl border border-sand-200 bg-white p-2 shadow-pop start-[calc(100%+6px)]"
                              data-testid={`rail-flyout-${g.key}`}
                            >
                              <p className="mb-1 flex items-center gap-1.5 px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400 rtl:tracking-normal">
                                {label}
                                {star ? <Star className="size-3 fill-gold-500 text-gold-500" aria-hidden /> : null}
                              </p>
                              {g.pages.map((p) => (
                                <PageRow key={p} portal={p} showLabel />
                              ))}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  }
                  /* expanded: eyebrow header with chevron, animated height */
                  return (
                    <div key={g.key} data-testid={`rail-group-${g.key}`}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.key)}
                        className={cn(
                          // ink-600, not ink-400: eleven-pixel uppercase text on
                          // the rail's sand ground has to clear 4.5 to 1
                          "mt-2 flex w-full items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 outline-none focus-visible:outline-2 focus-visible:outline-gold-500 rtl:tracking-normal",
                          active ? "cursor-default" : "cursor-pointer hover:text-ink-900"
                        )}
                        aria-expanded={open}
                        aria-label={open ? t("rail.closeGroup", { group: label }) : t("rail.openGroup", { group: label })}
                        aria-disabled={active || undefined}
                      >
                        <span className="truncate">{label}</span>
                        {star ? (
                          <Star
                            className="size-3 shrink-0 fill-gold-500 text-gold-500"
                            aria-label={t("knowledgeOfWeekStar")}
                          />
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "ms-auto size-3.5 shrink-0 transition-transform duration-200",
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
                            <div className="flex flex-col gap-0.5 pt-1">
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
                    className={cn(
                      ROW,
                      pathname.startsWith("/settings")
                        ? "bg-maroon-100 font-medium text-maroon-900"
                        : ROW_IDLE
                    )}
                    data-testid="rail-settings"
                  >
                    <Settings className="size-5 shrink-0" />
                    {showLabels ? (
                      <span className="whitespace-nowrap">{t("nav.settings")}</span>
                    ) : (
                      <span className="sr-only">{t("nav.settings")}</span>
                    )}
                  </Link>
                ) : null}
              </div>
            </nav>

            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Top bar: NPC maroon with white ink (CR05 1.3) */}
              <header
                data-bar
                className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-maroon-900/40 bg-bar px-4 text-bar-ink md:gap-4 md:px-6"
              >
                {/* CR08 2.2: the drawer handle under 768px */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="rounded-lg p-2 text-bar-ink hover:bg-white/15 md:hidden cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-gold-500"
                  aria-label={t("mainNav")}
                  aria-expanded={mobileOpen}
                  data-testid="rail-open"
                >
                  <Menu className="size-5" />
                </button>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
                  <GlobalSearch />
                  {/* CR08 2.3: the solid Ask NPC button right after the search */}
                  {visible.has("ask") ? <AskBarButton /> : null}
                </div>
                <div className="flex items-center gap-2">
                  {aiMock ? (
                    <Tip content={t("aiMockHint")}>
                      <span>
                        <Chip tone="gold" className="hidden md:inline-flex">
                          <Sparkles className="size-3" /> {t("aiMock")}
                        </Chip>
                      </span>
                    </Tip>
                  ) : null}
                  <Link
                    href={"/home"}
                    locale={otherLocale}
                    // preserve current path on locale switch
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.href = switchHref;
                    }}
                    className="rounded-lg border border-white/25 bg-bar-field px-2.5 py-1.5 text-xs font-semibold text-bar-ink hover:bg-white/25"
                    // the name has to contain the word on the button
                    aria-label={t("switchLanguageTo", { language: otherLocale === "ar" ? "العربية" : "EN" })}
                  >
                    {otherLocale === "ar" ? "العربية" : "EN"}
                  </Link>
                  {/* CR08 9.2: the inbox sits next to the notifications */}
                  {visible.has("inbox") ? (
                    <Link
                      href={"/inbox" as never}
                      className="relative rounded-lg p-2 text-bar-ink hover:bg-white/15 outline-none focus-visible:outline-2 focus-visible:outline-gold-500"
                      aria-label={t("inboxUnread", { count: user.inboxUnread })}
                      data-testid="bar-inbox"
                    >
                      <Inbox className="size-5" />
                      {user.inboxUnread > 0 ? (
                        <span className="absolute -top-0.5 -end-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-semibold text-ink-900">
                          {user.inboxUnread > 9 ? "9+" : user.inboxUnread}
                        </span>
                      ) : null}
                    </Link>
                  ) : null}
                  <NotificationsMenu unreadCount={unreadCount} />
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <button
                        className="ms-1 flex items-center gap-2 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-gold-500 cursor-pointer"
                        aria-label={t("userMenu")}
                      >
                        <ProgressRing value={user.quietMode ? 0 : user.levelProgress} size={44} stroke={2.5} color="var(--color-gold-500)">
                          <Avatar name={user.nameEn} color={user.avatarColor} size={34} />
                        </ProgressRing>
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
                  {/* NPC lockup at the end side of the bar (CR01 1.3, CR05 1.3:
                      the white monochrome file on the maroon bar, no plate):
                      full logo from 1024px, emblem-only crop 768-1024px,
                      hidden below 768px. */}
                  <span className="ms-4 hidden h-9 items-center border-s border-white/25 ps-4 md:flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/NPC_logo_white_mono.png"
                      alt={locale === "ar" ? "المجلس الوطني للتخطيط" : "National Planning Council"}
                      className="hidden h-9 w-auto select-none lg:block"
                      // the file's own pixels, so the box is reserved before it loads
                      width={1021}
                      height={347}
                      draggable={false}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/NPC_logo_white_mono.png"
                      alt={locale === "ar" ? "المجلس الوطني للتخطيط" : "National Planning Council"}
                      className="h-9 w-9 select-none object-cover object-right lg:hidden"
                      width={1021}
                      height={347}
                      draggable={false}
                    />
                  </span>
                </div>
              </header>

              {/* CR05 6.4: the read-only preview banner */}
              {user.previewLabel ? (
                <div
                  className="flex items-center justify-center gap-3 bg-gold-100 px-4 py-1.5 text-xs text-maroon-900"
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
                    className="rounded-md border border-maroon-300 px-2 py-0.5 font-medium hover:bg-maroon-100 cursor-pointer"
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
