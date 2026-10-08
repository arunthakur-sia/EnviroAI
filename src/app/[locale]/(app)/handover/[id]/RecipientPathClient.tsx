"use client";
// CR08 6.3: the Handover Learning Path. Modules as cards with the summary,
// the documents, the lessons, the handover notes, the short Knowledge Cast
// episode, the check question and Mark as understood; the overall ring;
// questions to the leaving person; the sign-off.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Check, FileText, Headphones, HelpCircle, Lightbulb, MessageSquare, PenSquare, Quote } from "lucide-react";
import { Button, Chip, EmptyState, Textarea } from "@/components/ui/primitives";
import { ProgressRing } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { HandoverDetail, PathModule, PathProgress } from "@/server/services/handover";
import { api, Countdown, Eyebrow, KindChip, PersonLine } from "../_components/bits";
import { Checklist } from "../_components/Checklist";

type PathData = { id: string; modules: PathModule[]; progress: PathProgress; signedOffAt: string | null };

export function RecipientPathClient({ detail: initialDetail, initialPath }: { detail: HandoverDetail; initialPath: PathData | null }) {
  const t = useTranslations("handover.recipient");
  const th = useTranslations("handover");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [detail, setDetail] = React.useState(initialDetail);
  const [path, setPath] = React.useState(initialPath);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [question, setQuestion] = React.useState("");
  const [hints, setHints] = React.useState<Record<string, boolean>>({});

  const reload = React.useCallback(async () => {
    const [d, p] = await Promise.all([api<HandoverDetail>(`/api/v1/handover/${initialDetail.id}`), api<PathData>(`/api/v1/handover/${initialDetail.id}/path`)]);
    if (d.ok && d.data) setDetail(d.data);
    if (p.ok && p.data) setPath(p.data);
  }, [initialDetail.id]);

  async function understood(moduleId: string) {
    setBusy(moduleId);
    try {
      const res = await api<{ modules: PathModule[]; progress: PathProgress }>(`/api/v1/handover/${detail.id}/path`, { method: "PATCH", body: JSON.stringify({ action: "understood", moduleId }) });
      if (!res.ok || !res.data) throw new Error(res.error ?? "error");
      setPath((p) => (p ? { ...p, modules: res.data!.modules, progress: res.data!.progress } : p));
      toast(t("understoodToast"), "success");
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function understoodItem(itemId: string) {
    setBusy(itemId);
    try {
      const res = await api(`/api/v1/handover/${detail.id}`, { method: "PATCH", body: JSON.stringify({ action: "understood", itemId }) });
      if (!res.ok) throw new Error(res.error ?? "error");
      await reload();
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function signOff() {
    setBusy("sign_off");
    try {
      const res = await api<{ signedOffAt: string; points: number }>(`/api/v1/handover/${detail.id}/path`, { method: "PATCH", body: JSON.stringify({ action: "sign_off" }) });
      if (!res.ok || !res.data) throw new Error(res.error ?? "error");
      toast(res.data.points ? t("signedOffPoints", { points: res.data.points }) : t("signedOff"), "points");
      await reload();
    } catch (e) {
      toast((e as Error).message === "modules_open" ? t("modulesOpen") : tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setBusy("ask");
    try {
      const res = await api<{ delivered: "thread" | "notification"; threadId: string | null }>(`/api/v1/handover/${detail.id}/path`, { method: "POST", body: JSON.stringify({ text: question }) });
      if (!res.ok || !res.data) throw new Error(res.error ?? "error");
      toast(res.data.delivered === "thread" ? t("askedThread") : t("askedNotification"), "success");
      setQuestion("");
    } catch {
      toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  const pct = path?.progress.pct ?? 0;
  const allUnderstood = Boolean(path && path.modules.length && path.modules.every((m) => m.understoodAt));
  const personGone = detail.status === "complete" || Boolean(detail.cutOffAt);
  const illustrative = (detail.notes ?? "").startsWith("[Illustrative]");

  return (
    <div className="flex flex-col gap-6" data-testid="recipient-handover">
      <section className="card p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1 className="mt-1 font-display text-3xl text-ink-900">{t("title", { name: bi(locale, detail.person.nameEn, detail.person.nameAr) })}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <KindChip kind={detail.kind} />
              {path?.signedOffAt ? (
                <Chip tone="ok">
                  <Check className="size-3" aria-hidden /> {t("signedOffChip", { date: formatDate(path.signedOffAt, locale) })}
                </Chip>
              ) : null}
              {illustrative ? <Chip tone="mist">{tc("illustrative")}</Chip> : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <PersonLine person={detail.person} size={44} />
              <div className="text-sm">
                <Eyebrow>{th("lastWorkingDay")}</Eyebrow>
                <Countdown days={detail.daysToLastWorkingDay} lastWorkingDay={detail.lastWorkingDay} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-mist-50 px-5 py-4">
            <ProgressRing value={pct / 100} size={96} stroke={8} color={pct === 100 ? "var(--color-ok)" : "var(--color-navy-700)"}>
              <span className="text-xl font-semibold text-ink-900 tnum" data-testid="path-pct">
                {pct}%
              </span>
            </ProgressRing>
            <div className="text-sm">
              <p className="font-medium text-ink-900">{t("overall")}</p>
              <p className="mt-0.5 text-xs text-ink-600 tnum">{path ? t("modulesDone", { done: path.progress.understood, total: path.progress.total }) : t("noPathYet")}</p>
              <p className="mt-0.5 text-xs text-ink-600 tnum">{t("itemsAssigned", { count: detail.recipients[0]?.items ?? 0 })}</p>
            </div>
          </div>
        </div>
      </section>

      {!path ? (
        <section>
          <EmptyState icon={<BookOpen />} title={t("noPathTitle")} hint={t("noPathHint")} />
          {detail.categories.length ? (
            <div className="mt-5">
              <h2 className="mb-3 font-display text-xl text-ink-900">{t("assignedItems")}</h2>
              <Checklist
                categories={detail.categories.map((c) => ({ ...c, items: c.items.filter((i) => i.recipient?.id && detail.recipients.some((r) => r.user.id === i.recipient?.id)) })).filter((c) => c.items.length)}
                canEditNotes={false}
                showRecipient={false}
                showUnderstood
                renderControls={(item) =>
                  item.understoodAt ? null : (
                    <Button size="sm" variant="secondary" onClick={() => understoodItem(item.id)} loading={busy === item.id} data-testid="item-understood">
                      <Check /> {t("markUnderstood")}
                    </Button>
                  )
                }
              />
            </div>
          ) : null}
        </section>
      ) : (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl text-ink-900">{t("pathTitle")}</h2>
            <p className="text-xs text-ink-600">{t("pathHint")}</p>
          </div>
          <ol className="grid gap-4 lg:grid-cols-2" data-testid="path-modules">
            {path.modules.map((m, i) => (
              <motion.li
                key={m.id}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: reduced ? 0 : Math.min(0.3, i * 0.05) }}
                className={cn("card flex flex-col gap-3 p-5", m.understoodAt && "border-ok/40")}
                data-testid="path-module"
                data-understood={m.understoodAt ? "1" : "0"}
              >
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm", m.understoodAt ? "bg-ok text-white" : "bg-navy-100 text-navy-900")} aria-hidden>
                    {m.understoodAt ? <Check className="size-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg leading-snug text-ink-900">{bi(locale, m.topic, m.topicAr)}</h3>
                    <p className="mt-1 text-xs text-ink-600 tnum">{t("moduleCounts", { documents: m.documents.length, lessons: m.lessons.length, items: m.itemIds.length })}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-ink-900" dir="auto">
                  {bi(locale, m.summaryEn, m.summaryAr)}
                </p>
                {m.documents.length ? (
                  <div>
                    <Eyebrow className="mb-1">{t("documents")}</Eyebrow>
                    <ul className="flex flex-col gap-1">
                      {m.documents.map((d) => (
                        <li key={d.id}>
                          <Link href={d.href as never} className="link-draw inline-flex items-center gap-1.5 text-sm text-ink-900">
                            <FileText className="size-3.5 text-ink-400" aria-hidden /> {bi(locale, d.titleEn, d.titleAr)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.lessons.length ? (
                  <div>
                    <Eyebrow className="mb-1">{t("lessons")}</Eyebrow>
                    <ul className="flex flex-col gap-1">
                      {m.lessons.map((l) => (
                        <li key={l.id}>
                          <Link href={l.href as never} className="link-draw inline-flex items-center gap-1.5 text-sm text-ink-900">
                            <Lightbulb className="size-3.5 text-aqua-500" aria-hidden /> {bi(locale, l.titleEn, l.titleAr)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.notes.length ? (
                  <div className="rounded-lg bg-mist-50 p-3">
                    <Eyebrow className="mb-1">{t("notes")}</Eyebrow>
                    {m.notes.slice(0, 3).map((n, k) => (
                      <p key={k} className="flex gap-2 text-sm leading-relaxed text-ink-900" dir="auto">
                        <Quote className="mt-1 size-3.5 shrink-0 text-ink-400" aria-hidden />
                        <span className="line-clamp-4">{n}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {m.episodeId ? (
                    <Link href={`/podcast/${m.episodeId}` as never} className="inline-flex items-center gap-1.5 rounded-lg border border-mist-300 px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors hover:border-navy-300 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-aqua-500" data-testid="module-episode">
                      <Headphones className="size-3.5" aria-hidden /> {t("episode")}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-400">
                      <Headphones className="size-3.5" aria-hidden /> {t("noEpisode")}
                    </span>
                  )}
                </div>
                <div className="rounded-lg border border-aqua-300 bg-aqua-100/40 p-3">
                  <p className="flex items-start gap-2 text-sm text-ink-900">
                    <HelpCircle className="mt-0.5 size-4 shrink-0 text-navy-700" aria-hidden />
                    <span>
                      <span className="block text-[11px] font-semibold uppercase text-ink-400">{t("checkQuestion")}</span>
                      {bi(locale, m.checkQuestion.en, m.checkQuestion.ar)}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setHints((h) => ({ ...h, [m.id]: !h[m.id] }))}
                    className="mt-1.5 cursor-pointer text-xs font-medium text-navy-700 hover:underline focus-visible:outline-2 focus-visible:outline-aqua-500"
                    aria-expanded={Boolean(hints[m.id])}
                  >
                    {hints[m.id] ? t("hideHint") : t("showHint")}
                  </button>
                  {hints[m.id] ? (
                    <p className="mt-1 text-xs text-ink-600" dir="auto">
                      {bi(locale, m.checkQuestion.answerHint, m.checkQuestion.answerHintAr)}
                    </p>
                  ) : null}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  {m.understoodAt ? (
                    <span className="text-xs text-ink-600 tnum">{t("understoodOn", { date: formatDate(m.understoodAt, locale) })}</span>
                  ) : (
                    <Button size="sm" onClick={() => understood(m.id)} loading={busy === m.id} disabled={Boolean(path.signedOffAt)} data-testid="module-understood">
                      <Check /> {t("markUnderstood")}
                    </Button>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" data-testid="ask-person">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink-900">
            <MessageSquare className="size-4 text-navy-700" aria-hidden /> {t("askTitle")}
          </h2>
          <p className="mt-1 text-sm text-ink-600">{personGone ? t("askGone") : t("askHint", { name: bi(locale, detail.person.nameEn, detail.person.nameAr) })}</p>
          {!personGone ? (
            <>
              <Textarea rows={3} dir="auto" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("askPlaceholder")} className="mt-3" data-testid="ask-input" />
              <div className="mt-2">
                <Button size="sm" onClick={ask} loading={busy === "ask"} disabled={!question.trim()} data-testid="ask-send">
                  {t("askSend")}
                </Button>
              </div>
            </>
          ) : null}
        </section>
        <section className="card p-5" data-testid="sign-off">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink-900">
            <PenSquare className="size-4 text-navy-700" aria-hidden /> {t("signOffTitle")}
          </h2>
          {path?.signedOffAt ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-ink-900">
              <Check className="size-4 text-ok" aria-hidden /> {t("signedOffLine", { date: formatDate(path.signedOffAt, locale) })}
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-600">{allUnderstood ? t("signOffReady") : t("signOffHint")}</p>
              <div className="mt-3">
                <Button onClick={signOff} loading={busy === "sign_off"} disabled={!allUnderstood} data-testid="sign-off-button">
                  <Check /> {t("signOff")}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
