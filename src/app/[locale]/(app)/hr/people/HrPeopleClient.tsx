"use client";
// CR05 5.6.3: the searchable, filterable people list; each row expands in
// place to expertise, project roles, owned knowledge, backups, the readiness
// ring, handover state, and the actions. No points or badges anywhere (5.1).
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { ChevronDown, Mail } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, bi } from "@/lib/utils";
import {
  Avatar,
  Button,
  Chip,
  Input,
  Label,
  NativeSelect,
  ProgressRing,
} from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import type { HrPeople } from "@/server/services/hr";

type Person = HrPeople["people"][number];

const ROLE_TONE: Record<string, "navy" | "teal" | "aqua" | "mist" | "ghost"> = {
  sponsor: "navy",
  owner: "teal",
  manager: "aqua",
  team: "mist",
  expert: "teal",
  external_partner: "ghost",
};

export function HrPeopleClient({ data, focusId }: { data: HrPeople; focusId: string | null }) {
  const t = useTranslations("hr");
  const ts = useTranslations("strategy.stakeholders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [dept, setDept] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [band, setBand] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(focusId);
  const [dialog, setDialog] = React.useState<{
    kind: "status" | "handover" | "backup" | null;
    person: Person | null;
  }>({ kind: null, person: null });
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const filtered = data.people.filter((p) => {
    if (query.trim()) {
      const q = query.toLowerCase();
      if (
        !p.nameEn.toLowerCase().includes(q) &&
        !p.nameAr.includes(query) &&
        !p.email.toLowerCase().includes(q) &&
        !p.expertise.some((e) => e.nameEn.toLowerCase().includes(q) || e.nameAr.includes(query))
      )
        return false;
    }
    if (dept && p.department?.id !== dept) return false;
    if (status && p.status !== status) return false;
    if (band === "high" && p.readiness.score < 80) return false;
    if (band === "medium" && (p.readiness.score < 55 || p.readiness.score >= 80)) return false;
    if (band === "low" && p.readiness.score >= 55) return false;
    return true;
  });

  async function submitDialog() {
    if (!dialog.person || !dialog.kind) return;
    setBusy(true);
    try {
      let res: Response | null = null;
      if (dialog.kind === "status") {
        res = await fetch("/api/v1/hr/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: dialog.person.id,
            status: form.status ?? "active",
            effectiveDate: form.effectiveDate || null,
            note: form.note || null,
          }),
        });
      } else if (dialog.kind === "handover") {
        res = await fetch("/api/v1/hr/handovers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: dialog.person.id,
            kind: form.kind ?? "leaving",
            dueDate: form.dueDate || null,
            successorDefaultUserId: form.successor || null,
          }),
        });
      } else if (dialog.kind === "backup") {
        res = await fetch("/api/v1/hr/backups", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            forUserId: dialog.person.id,
            backupUserId: form.backup,
          }),
        });
      }
      if (res?.ok) {
        toast(t("saved"), "points");
        setDialog({ kind: null, person: null });
        setForm({});
        router.refresh();
      } else if (res) {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="hr-people">
      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPeople")}
          className="max-w-64"
          aria-label={t("searchPeople")}
          data-testid="hr-people-search"
        />
        <NativeSelect value={dept} onChange={(e) => setDept(e.target.value)} className="w-56" aria-label={t("filterDepartment")}>
          <option value="">{t("allDepartments")}</option>
          {data.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {bi(locale, d.nameEn, d.nameAr)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label={t("filterStatus")}>
          <option value="">{t("allStatuses")}</option>
          {["active", "leaving", "transferring", "long_leave"].map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}` as never)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={band} onChange={(e) => setBand(e.target.value)} className="w-44" aria-label={t("filterReadiness")}>
          <option value="">{t("allBands")}</option>
          <option value="high">{t("bands.high")}</option>
          <option value="medium">{t("bands.medium")}</option>
          <option value="low">{t("bands.low")}</option>
        </NativeSelect>
        <span className="ms-auto text-xs text-ink-600 tnum">{t("peopleCount", { count: filtered.length })}</span>
      </div>

      <div className="flex flex-col gap-2" data-testid="hr-people-list">
        {filtered.map((p) => {
          const isOpen = open === p.id;
          return (
            <div key={p.id} className="card overflow-hidden" data-testid="hr-person-row">
              <button
                onClick={() => setOpen(isOpen ? null : p.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-start cursor-pointer hover:bg-mist-50"
              >
                <Avatar name={p.nameEn} color={p.avatarColor} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink-900">
                      {bi(locale, p.nameEn, p.nameAr)}
                    </span>
                    {p.status !== "active" ? (
                      <Chip tone="warn">{t(`status.${p.status}` as never)}</Chip>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-ink-600">
                    {bi(locale, p.positionEn ?? "", p.positionAr ?? "")}
                    {p.department ? ` · ${bi(locale, p.department.nameEn, p.department.nameAr)}` : ""}
                  </span>
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  {p.expertise.slice(0, 2).map((e) => (
                    <Chip key={e.id} tone="teal">{bi(locale, e.nameEn, e.nameAr)}</Chip>
                  ))}
                </span>
                <ProgressRing
                  value={p.readiness.score / 100}
                  size={44}
                  stroke={4.5}
                  color={
                    p.readiness.score >= 80
                      ? "var(--color-ok)"
                      : p.readiness.score >= 55
                        ? "var(--color-aqua-500)"
                        : "var(--color-danger)"
                  }
                >
                  <span className="text-[11px] font-semibold tnum">{p.readiness.score}</span>
                </ProgressRing>
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
                    <div className="grid grid-cols-1 gap-5 border-t border-mist-100 px-4 py-4 lg:grid-cols-3">
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                          {t("projectRoles")}
                        </p>
                        {p.roles.length ? (
                          <ul className="flex flex-col gap-1">
                            {p.roles.map((r, i) => (
                              <li key={`${r.nodeId}:${i}`} className="flex items-center gap-2 text-sm">
                                <Chip tone={ROLE_TONE[r.role] ?? "mist"} className="shrink-0">
                                  {ts(`roles.${r.role}` as never)}
                                </Chip>
                                <Link href={`/strategy/${r.nodeId}` as never} className="link-draw min-w-0 truncate text-ink-900">
                                  {r.code ? <span className="me-1 text-xs text-ink-400 tnum">{r.code}</span> : null}
                                  {bi(locale, r.titleEn, r.titleAr)}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-ink-600">{t("noRoles")}</p>
                        )}
                        {p.expertise.length ? (
                          <>
                            <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                              {t("expertise")}
                            </p>
                            <span className="flex flex-wrap gap-1">
                              {p.expertise.map((e) => (
                                <Chip key={e.id} tone="teal">{bi(locale, e.nameEn, e.nameAr)}</Chip>
                              ))}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                          {t("knowledgeOwned")}
                        </p>
                        {p.ownedByKind.length ? (
                          <ul className="flex flex-col gap-1 text-sm">
                            {p.ownedByKind.map((k) => (
                              <li key={k.kind} className="flex items-center justify-between gap-3">
                                <span className="text-ink-900">{t(`itemKinds.${k.kind}` as never)}</span>
                                <span className="tnum text-ink-600">
                                  {k.count}
                                  <span className="text-ink-400"> · {t("verifiedOf", { n: k.verified })}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-ink-600">{t("noOwned")}</p>
                        )}
                        <p className="mt-3 text-xs text-ink-600 tnum">
                          {t("backupLine", {
                            pct: Math.round(p.backedUpShare * 100),
                            forOthers: p.backupFor,
                          })}
                        </p>
                        <p className="mt-2 text-xs text-ink-600 tnum">
                          {t("readinessParts", {
                            backup: Math.round(p.readiness.backupShare * 100),
                            fresh: Math.round(p.readiness.freshShare * 100),
                            deputy: Math.round(p.readiness.deputyShare * 100),
                            capture: p.readiness.captureRecent ? "1" : "0",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-600">
                          {t("handoverState")}
                        </p>
                        {p.handover ? (
                          <Link href={`/hr/handovers/${p.handover.id}` as never} className="block rounded-lg bg-mist-50 px-3 py-2 hover:bg-mist-100">
                            <span className="flex items-center justify-between text-sm">
                              <Chip tone={p.handover.status === "complete" ? "ok" : p.handover.status === "overdue" ? "danger" : "mist"}>
                                {t(`handoverStatus.${p.handover.status}` as never)}
                              </Chip>
                              <span className="tnum text-ink-600">{p.handover.completionPct}%</span>
                            </span>
                            {p.handover.dueDate ? (
                              <span className="mt-1 block text-xs text-ink-600 tnum">{t("due", { date: p.handover.dueDate })}</span>
                            ) : null}
                          </Link>
                        ) : (
                          <p className="text-sm text-ink-600">{t("noHandover")}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "status", person: p })} data-testid="set-status">
                            {t("setStatus")}
                          </Button>
                          {!p.handover ? (
                            <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "handover", person: p })} data-testid="start-handover">
                              {t("startHandover")}
                            </Button>
                          ) : null}
                          <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "backup", person: p })} data-testid="assign-backup">
                            {t("assignBackup")}
                          </Button>
                          <Link
                            href={`/add?mode=speak${p.handover ? `&handover=${p.handover.id}` : ""}` as never}
                            className="inline-flex h-8 items-center rounded-lg border border-mist-300 bg-white px-3 text-xs font-medium text-ink-600 hover:border-navy-300 hover:text-navy-700"
                          >
                            {t("requestCapture")}
                          </Link>
                          <a
                            href={`mailto:${p.email}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-mist-300 bg-white px-3 text-xs font-medium text-ink-600 hover:border-navy-300 hover:text-navy-700"
                          >
                            <Mail className="size-3.5" /> {t("email")}
                          </a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* dialogs */}
      <Dialog
        open={dialog.kind !== null}
        onOpenChange={(o) => !o && setDialog({ kind: null, person: null })}
      >
        <DialogContent
          title={
            dialog.kind === "status"
              ? t("setStatusTitle", { name: dialog.person?.nameEn ?? "" })
              : dialog.kind === "backup"
                ? t("assignBackupTitle", { name: dialog.person?.nameEn ?? "" })
                : t("startHandoverTitle", { name: dialog.person?.nameEn ?? "" })
          }
        >
          {dialog.kind === "backup" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-600">{t("assignBackupHint")}</p>
              <div>
                <Label htmlFor="hr-backup-person">{t("backupPerson")}</Label>
                <NativeSelect id="hr-backup-person" value={form.backup ?? ""} onChange={(e) => setForm((f) => ({ ...f, backup: e.target.value }))}>
                  <option value="">{tc("choose")}</option>
                  {data.people
                    .filter((x) => x.id !== dialog.person?.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {bi(locale, x.nameEn, x.nameAr)}
                      </option>
                    ))}
                </NativeSelect>
              </div>
            </div>
          ) : dialog.kind === "status" ? (
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="hr-status">{t("statusLabel")}</Label>
                <NativeSelect id="hr-status" value={form.status ?? "active"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {["active", "leaving", "transferring", "long_leave"].map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="hr-effective-date">{t("effectiveDate")}</Label>
                <Input id="hr-effective-date" type="date" value={form.effectiveDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label htmlFor="hr-status-note">{t("note")}</Label>
                <Input id="hr-status-note" value={form.note ?? ""} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <Label htmlFor="hr-handover-kind">{t("handoverKind")}</Label>
                <NativeSelect id="hr-handover-kind" value={form.kind ?? "leaving"} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                  {["leaving", "transferring", "leave"].map((k) => (
                    <option key={k} value={k}>
                      {t(`handoverKinds.${k}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="hr-handover-due">{t("dueDate")}</Label>
                <Input id="hr-handover-due" type="date" value={form.dueDate ?? ""} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label htmlFor="hr-handover-successor">{t("defaultSuccessor")}</Label>
                <NativeSelect id="hr-handover-successor" value={form.successor ?? ""} onChange={(e) => setForm((f) => ({ ...f, successor: e.target.value }))}>
                  <option value="">{t("noSuccessor")}</option>
                  {data.people
                    .filter((x) => x.id !== dialog.person?.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {bi(locale, x.nameEn, x.nameAr)}
                      </option>
                    ))}
                </NativeSelect>
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button loading={busy} onClick={submitDialog}>
              {tc("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
