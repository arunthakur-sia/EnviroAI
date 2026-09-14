"use client";
// CR05 5.6.4: one handover: the generated checklist grouped by item kind,
// successor pickers (bulk assign then adjust), item status, knowledge capture
// sessions (Speak mode with the handover pre-linked), and completion.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Mic, UserCheck } from "lucide-react";
import { bi } from "@/lib/utils";
import { Avatar, Button, Chip, NativeSelect, SectionTitle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { getHrHandover } from "@/server/services/hr";

type Data = NonNullable<Awaited<ReturnType<typeof getHrHandover>>>;

const ITEM_STATUS_TONE: Record<string, "sand" | "gulf" | "ok" | "ghost"> = {
  pending: "sand",
  reassigned: "gulf",
  captured: "ok",
  not_needed: "ghost",
};

export function HandoverDetailClient({ data }: { data: Data }) {
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const h = data.handover;

  async function patch(body: Record<string, unknown>, key: string) {
    setBusy(key);
    try {
      const res = await fetch("/api/v1/hr/handovers", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoverId: h.id, ...body }),
      });
      if (res.ok) router.refresh();
      else toast(tc("error"), "error");
    } finally {
      setBusy(null);
    }
  }

  const kinds = [...new Set(data.items.map((i) => i.itemKind))];

  return (
    <div data-testid="handover-detail">
      {/* header */}
      <div className="card mb-5 flex flex-wrap items-center gap-4 p-5">
        {data.person ? <Avatar name={data.person.nameEn} color={data.person.avatarColor} size={44} /> : null}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-ink-900">
            {data.person ? bi(locale, data.person.nameEn, data.person.nameAr) : "-"}
          </p>
          <p className="text-xs text-ink-600">
            {t(`handoverKinds.${h.kind}` as never)}
            {h.dueDate ? ` · ${t("due", { date: h.dueDate })}` : ""}
            {data.successor
              ? ` · ${t("successorLine", { name: bi(locale, data.successor.nameEn, data.successor.nameAr) })}`
              : ""}
          </p>
        </div>
        <div className="w-44">
          <p className="mb-1 flex justify-between text-xs text-ink-600 tnum">
            <Chip tone={h.status === "complete" ? "ok" : h.status === "overdue" ? "danger" : "sand"}>
              {t(`handoverStatus.${h.status}` as never)}
            </Chip>
            {h.completionPct}%
          </p>
          <p className="h-2 overflow-hidden rounded-full bg-sand-200">
            <span className="block h-full rounded-full bg-maroon-700" style={{ width: `${h.completionPct}%` }} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {h.successorDefaultUserId ? (
            <Button
              size="sm"
              variant="secondary"
              loading={busy === "bulk"}
              onClick={() => patch({ action: "bulk_assign" }, "bulk")}
              data-testid="bulk-assign"
            >
              <UserCheck /> {t("bulkAssign")}
            </Button>
          ) : null}
          <Link
            href={`/add?mode=speak&handover=${h.id}` as never}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-maroon-700 px-3.5 text-sm font-medium text-white hover:bg-maroon-900"
            data-testid="capture-session"
          >
            <Mic className="size-4" /> {t("captureSession")}
          </Link>
        </div>
      </div>

      {/* checklist grouped by kind */}
      <div className="flex flex-col gap-5" data-testid="handover-checklist">
        {kinds.map((kind) => (
          <section key={kind}>
            <SectionTitle>
              {t(`itemKinds.${kind}` as never)}{" "}
              <span className="text-xs font-normal text-ink-600 tnum">
                {data.items.filter((i) => i.itemKind === kind).length}
              </span>
            </SectionTitle>
            <div className="card divide-y divide-sand-100">
              {data.items
                .filter((i) => i.itemKind === kind)
                .map((i) => (
                  <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5" data-testid="handover-item">
                    <span className="min-w-0 flex-1 text-sm text-ink-900">{i.title}</span>
                    <NativeSelect
                      value={i.successorUserId ?? ""}
                      onChange={(e) =>
                        patch(
                          { action: "item", itemId: i.id, successorUserId: e.target.value || null },
                          i.id
                        )
                      }
                      className="h-8 w-44 text-xs"
                      aria-label={t("successor")}
                    >
                      <option value="">{t("noSuccessor")}</option>
                      {data.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {bi(locale, u.nameEn, u.nameAr)}
                        </option>
                      ))}
                    </NativeSelect>
                    <NativeSelect
                      value={i.status}
                      onChange={(e) => patch({ action: "item", itemId: i.id, status: e.target.value }, i.id)}
                      className="h-8 w-36 text-xs"
                      aria-label={t("itemStatus")}
                    >
                      {["pending", "reassigned", "captured", "not_needed"].map((s) => (
                        <option key={s} value={s}>
                          {t(`itemStatus_.${s}` as never)}
                        </option>
                      ))}
                    </NativeSelect>
                    <Chip tone={ITEM_STATUS_TONE[i.status] ?? "sand"} className="hidden sm:inline-flex">
                      {t(`itemStatus_.${i.status}` as never)}
                    </Chip>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>

      {/* capture sessions */}
      <section className="mt-6" data-testid="handover-captures">
        <SectionTitle>{t("captures")}</SectionTitle>
        {data.captures.length ? (
          <div className="card divide-y divide-sand-100">
            {data.captures.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <Mic className="size-4 shrink-0 text-gulf-600" aria-hidden />
                <span className="min-w-0 flex-1">
                  {c.lesson ? (
                    <Link href={`/lessons?lesson=${c.lesson.id}` as never} className="link-draw text-sm font-medium text-ink-900">
                      {bi(locale, c.lesson.titleEn, c.lesson.titleAr)}
                    </Link>
                  ) : (
                    <span className="text-sm text-ink-900">{c.topic ?? "-"}</span>
                  )}
                  <span className="block text-xs text-ink-600 tnum">{c.createdAt.slice(0, 10)}</span>
                </span>
                <Chip tone="gold">{t("expertInsight")}</Chip>
              </div>
            ))}
          </div>
        ) : (
          <p className="card px-4 py-5 text-center text-sm text-ink-600">{t("noCaptures")}</p>
        )}
      </section>
    </div>
  );
}
