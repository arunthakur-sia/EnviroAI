"use client";
// CR05 5.6.2: department cards expanding in place to people, projects, and
// risks; responsibilities editable inline by HR Admin and the department head.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ChevronDown, Pencil } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import { Avatar, Button, Chip, ProgressRing, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { SEVERITY_TONE } from "../HrOverviewClient";
import type { HrDepartments } from "@/server/services/hr";

type Dept = HrDepartments["departments"][number];

function ScoreRing({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <ProgressRing
        value={value / 100}
        size={54}
        stroke={5}
        color={value >= 80 ? "var(--color-ok)" : value >= 55 ? "var(--color-aqua-500)" : "var(--color-danger)"}
      >
        <span className="text-xs font-semibold tnum">{value}</span>
      </ProgressRing>
      <span className="text-[10px] uppercase tracking-wider text-ink-600">{label}</span>
    </span>
  );
}

export function HrDepartmentsClient({
  data,
  focusCode,
}: {
  data: HrDepartments;
  focusCode: string | null;
}) {
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState<string | null>(
    focusCode ? data.departments.find((d) => d.code === focusCode)?.id ?? null : null
  );
  const [editing, setEditing] = React.useState<string | null>(null);
  const [respEn, setRespEn] = React.useState("");
  const [respAr, setRespAr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function saveResponsibilities(d: Dept) {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/hr/departments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          departmentId: d.id,
          responsibilitiesEn: respEn,
          responsibilitiesAr: respAr,
        }),
      });
      if (res.ok) {
        toast(t("saved"), "points");
        setEditing(null);
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="hr-departments">
      {data.departments.map((d) => {
        const isOpen = open === d.id;
        return (
          <div key={d.id} className="card overflow-hidden" data-testid="hr-department-card">
            <button
              onClick={() => setOpen(isOpen ? null : d.id)}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-center gap-4 px-5 py-4 text-start cursor-pointer hover:bg-mist-50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {bi(locale, d.nameEn, d.nameAr)}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-600">
                  {bi(locale, d.responsibilitiesEn ?? "", d.responsibilitiesAr ?? "") || t("noResponsibilities")}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-600 tnum">
                  <span>{t("headcount", { count: d.headcount })}</span>
                  <span>{t("docsCount", { count: d.repository.documents })}</span>
                  <span>{t("verifiedShare", { pct: Math.round(d.repository.verifiedShare * 100) })}</span>
                  <span>{t("staleShare", { pct: Math.round(d.repository.staleShare * 100) })}</span>
                  <span>{t("lessonsCount", { count: d.repository.lessons })}</span>
                  <span>{t("deliverablesCount", { count: d.repository.deliverables })}</span>
                  <span>{t("openHandovers", { count: d.openHandovers })}</span>
                </p>
              </div>
              {d.head ? (
                <span className="flex items-center gap-2 text-xs text-ink-600">
                  <Avatar name={d.head.nameEn} color={d.head.avatarColor} size={28} />
                  <span className="hidden sm:block">
                    <span className="block font-medium text-ink-900">{bi(locale, d.head.nameEn, d.head.nameAr)}</span>
                    {t("head")}
                  </span>
                </span>
              ) : null}
              <span className="flex items-center gap-3">
                <ScoreRing value={d.readiness} label={t("readinessShort")} />
                <ScoreRing value={d.continuity} label={t("continuityShort")} />
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-ink-400 transition-transform", isOpen && "rotate-180")} aria-hidden />
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 gap-5 border-t border-mist-100 px-5 py-4 lg:grid-cols-3">
                    {/* responsibilities */}
                    <div>
                      <p className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                        {t("responsibilities")}
                        {d.canEdit && editing !== d.id ? (
                          <button
                            onClick={() => {
                              setEditing(d.id);
                              setRespEn(d.responsibilitiesEn ?? "");
                              setRespAr(d.responsibilitiesAr ?? "");
                            }}
                            className="flex items-center gap-1 text-navy-700 cursor-pointer normal-case tracking-normal"
                            data-testid="edit-responsibilities"
                          >
                            <Pencil className="size-3" /> {tc("edit")}
                          </button>
                        ) : null}
                      </p>
                      {editing === d.id ? (
                        <div className="flex flex-col gap-2">
                          <Textarea value={respEn} onChange={(e) => setRespEn(e.target.value)} rows={3} dir="ltr" aria-label="EN" />
                          <Textarea value={respAr} onChange={(e) => setRespAr(e.target.value)} rows={3} dir="rtl" aria-label="AR" />
                          <div className="flex gap-2">
                            <Button size="sm" loading={busy} onClick={() => saveResponsibilities(d)}>
                              {tc("save")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              {tc("cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed text-ink-600">
                          {bi(locale, d.responsibilitiesEn ?? "", d.responsibilitiesAr ?? "") || t("noResponsibilities")}
                        </p>
                      )}
                      {d.keyProjects.length ? (
                        <>
                          <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                            {t("keyProjects")}
                          </p>
                          <ul className="flex flex-col gap-1">
                            {d.keyProjects.map((p) => (
                              <li key={p.id}>
                                <Link href={`/strategy/${p.id}` as never} className="link-draw text-sm text-ink-900">
                                  {p.code ? <span className="me-1 text-xs text-ink-400 tnum">{p.code}</span> : null}
                                  {bi(locale, p.titleEn, p.titleAr)}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                    </div>
                    {/* people */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                        {t("people")}
                      </p>
                      <ul className="flex flex-col gap-1.5">
                        {d.people.map((p) => (
                          <li key={p.id} className="flex items-center gap-2.5">
                            <Avatar name={p.nameEn} color={p.avatarColor} size={28} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-ink-900">{bi(locale, p.nameEn, p.nameAr)}</span>
                              <span className="block truncate text-[11px] text-ink-600">
                                {bi(locale, p.positionEn ?? "", p.positionAr ?? "")}
                              </span>
                            </span>
                            {p.status !== "active" ? (
                              <Chip tone="warn">{t(`status.${p.status}` as never)}</Chip>
                            ) : null}
                            <span className="shrink-0 text-xs text-ink-600 tnum">{p.readiness}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* risks */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                        {t("risksTitle")}
                      </p>
                      {d.risks.length ? (
                        <ul className="flex flex-col gap-1.5">
                          {d.risks.map((r) => (
                            <li key={r.id} className="flex items-start gap-2 text-sm">
                              <Chip tone={SEVERITY_TONE[r.severity]} className="mt-0.5 shrink-0">
                                {t(`severity.${r.severity}` as never)}
                              </Chip>
                              <span className="min-w-0 text-ink-900">{r.title}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-600">{t("noRisks")}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
