"use client";
// CR08 1.2: change requests filed by unit heads, for the Super Admin to
// resolve (once the change is made) or decline. The requester is notified.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check, Inbox, X } from "lucide-react";
import { bi } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Button, Chip, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { editorCall, editorGet, type ChangeRequestRow } from "./OrganisationEditorShared";

const STATUS_TONE: Record<string, "warn" | "ok" | "mist"> = { open: "warn", resolved: "ok", declined: "mist" };

export function OrganisationChangeRequests({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("settings.organisationTab");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<ChangeRequestRow[] | null>(null);
  const [showClosed, setShowClosed] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(async () => {
    const data = await editorGet<ChangeRequestRow[]>("requests", showClosed ? {} : { status: "open" });
    if (data) {
      setRows(data);
      setFailed(false);
    } else {
      setRows([]);
      setFailed(true);
    }
  }, [showClosed]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, status: "resolved" | "declined") {
    setBusy(id);
    try {
      const res = await editorCall({ action: "requests.resolve", id, status });
      if (!res.ok) {
        toast(tc("error"), "error");
        return;
      }
      toast(t(status === "resolved" ? "requestResolved" : "requestDeclined"), "success");
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-4" data-testid="org-requests">
      <div className="mb-3 flex items-center justify-end">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-600">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="size-3.5 cursor-pointer accent-navy-700" data-testid="org-requests-closed" />
          {t("requestsShowClosed")}
        </label>
      </div>
      {rows === null ? (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : failed ? (
        <p className="text-sm text-danger">{tc("error")}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("requestsEmpty")} className="py-8" />
      ) : (
        <ul className="divide-y divide-mist-100">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 py-3" data-testid="org-request-row" data-status={r.status}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/organisation?unit=${encodeURIComponent(r.unitCode)}`} className="link-draw text-sm font-medium text-ink-900 hover:text-navy-700" title={t("requestOpenUnit")}>
                    {bi(locale, r.unitNameEn, r.unitNameAr)}
                  </Link>
                  <span className="text-[11px] text-ink-400 tnum" dir="ltr">
                    {r.unitCode}
                  </span>
                  <Chip tone={STATUS_TONE[r.status] ?? "mist"}>{t(`requestStatus.${r.status}` as never)}</Chip>
                </div>
                <p className="mt-1 text-sm text-ink-900">{r.what}</p>
                {r.why ? (
                  <p className="mt-0.5 text-xs text-ink-600">
                    <span className="font-medium">{t("requestWhy")}:</span> {r.why}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-ink-400">
                  {t("requestBy", { name: bi(locale, r.requesterEn, r.requesterAr), date: formatDate(r.createdAt, locale, { style: "medium" }) })}
                </p>
              </div>
              {r.status === "open" ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="secondary" loading={busy === r.id} disabled={!canEdit} onClick={() => void resolve(r.id, "resolved")} data-testid="org-request-resolve">
                    <Check /> {t("requestResolve")}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!canEdit || busy === r.id} onClick={() => void resolve(r.id, "declined")} data-testid="org-request-decline">
                    <X /> {t("requestDecline")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
