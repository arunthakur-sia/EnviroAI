"use client";
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { usePathname as useRawPathname } from "next/navigation";
import {
  Home,
  Library,
  Compass,
  BarChart3,
  Users,
  MessageCircleQuestion,
  Lightbulb,
  Radar,
  Settings,
  LogOut,
  UserRound,
  Building2,
  Sparkles,
  Podcast,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  points: number;
  quietMode: boolean;
  clearance: number;
};

/* CR02 5.1: the Add Knowledge rail button is gone (it lives on Home, the
   Lessons page, and project Lessons tabs). CR02 4.6: Podcast under Lessons. */
const NAV = [
  { href: "/home", icon: Home, key: "home" },
  { href: "/vault", icon: Library, key: "vault" },
  { href: "/strategy", icon: Compass, key: "strategy" },
  { href: "/statistics", icon: BarChart3, key: "statistics" },
  { href: "/experts", icon: Users, key: "experts" },
  { href: "/ask", icon: MessageCircleQuestion, key: "ask" },
  { href: "/lessons", icon: Lightbulb, key: "lessons" },
  { href: "/podcast", icon: Podcast, key: "podcast" },
  { href: "/trends", icon: Radar, key: "trends" },
] as const;

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
  const name = locale === "ar" ? user.nameAr : user.nameEn;

  const otherLocale = locale === "ar" ? "en" : "ar";
  const switchHref = rawPathname.replace(`/${locale}`, `/${otherLocale}`);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <TooltipProvider>
      <ToastProvider>
        <GlobalDropZone enabled={user.canUpload}>
          <div className="flex min-h-screen">
            {/* Rail */}
            <nav
              className="group/rail sticky top-0 z-40 flex h-screen w-[72px] shrink-0 flex-col items-stretch gap-1 border-e border-sand-300 bg-sand-100 px-2.5 py-4 transition-[width] duration-300 hover:w-[232px]"
              aria-label={t("mainNav")}
            >
              <Link href="/home" className="mb-4 flex h-10 items-center gap-2.5 overflow-hidden ps-1.5" aria-label="SiaNexus">
                {/* collapsed rail: the slash mark; expanded: the full wordmark */}
                <SiaLogo variant="mark" height={30} className="shrink-0 group-hover/rail:hidden" />
                <SiaLogo
                  variant="full"
                  height={22}
                  className="hidden shrink-0 group-hover/rail:block"
                />
              </Link>
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "flex h-10 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm transition-colors",
                      active
                        ? "bg-maroon-100 font-medium text-maroon-900"
                        : "text-ink-600 hover:bg-white/70 hover:text-ink-900"
                    )}
                  >
                    <item.icon className={cn("size-5 shrink-0", active && "text-maroon-700")} />
                    <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100">
                      {t(`nav.${item.key}`)}
                    </span>
                  </Link>
                );
              })}
              <div className="mt-auto flex flex-col gap-1">
                {user.canSettings ? (
                  <Link
                    href="/settings"
                    className={cn(
                      "flex h-10 items-center gap-3 overflow-hidden rounded-lg px-3 text-sm transition-colors",
                      pathname.startsWith("/settings")
                        ? "bg-maroon-100 font-medium text-maroon-900"
                        : "text-ink-600 hover:bg-white/70 hover:text-ink-900"
                    )}
                  >
                    <Settings className="size-5 shrink-0" />
                    <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100">
                      {t("nav.settings")}
                    </span>
                  </Link>
                ) : null}
              </div>
            </nav>

            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Top bar */}
              <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-sand-300 bg-sand-50/90 px-6 backdrop-blur">
                <div className="flex flex-1 justify-center">
                  <GlobalSearch />
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
                    className="rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-600 hover:border-maroon-300 hover:text-maroon-700"
                    aria-label={t("switchLanguage")}
                  >
                    {otherLocale === "ar" ? "العربية" : "EN"}
                  </Link>
                  <NotificationsMenu unreadCount={unreadCount} />
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <button
                        className="ms-1 flex items-center gap-2 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-maroon-700 cursor-pointer"
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
                            {user.levelName} · {user.points.toLocaleString()} {t("points")}
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
                  {/* NPC lockup at the end side of the bar (CR01 1.3): full logo
                      from 1024px, emblem-only crop 768-1024px, hidden below 768px. */}
                  <span className="ms-4 hidden h-9 items-center border-s border-sand-300 ps-4 md:flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/NPC_logo_transparent.png"
                      alt={locale === "ar" ? "المجلس الوطني للتخطيط" : "National Planning Council"}
                      className="hidden h-9 w-auto select-none lg:block"
                      draggable={false}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/NPC_logo_transparent.png"
                      alt={locale === "ar" ? "المجلس الوطني للتخطيط" : "National Planning Council"}
                      className="h-9 w-9 select-none object-cover object-right lg:hidden"
                      draggable={false}
                    />
                  </span>
                </div>
              </header>

              <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6 pb-20">
                {children}
              </main>
            </div>
          </div>
          {/* CR02 4.6: playback continues across page navigation */}
          <MiniPlayer />
        </GlobalDropZone>
      </ToastProvider>
    </TooltipProvider>
  );
}
