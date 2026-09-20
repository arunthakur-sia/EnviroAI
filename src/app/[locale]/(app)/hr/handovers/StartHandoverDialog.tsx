"use client";
// CR08 6.1: the start form. The person is a colleague (the people picker), a
// row of the External Experts register, or someone added on the spot; then
// the kind, the reason, the last working day, the due date, the recipient
// decision (a default person, the system, or per item later) and notes.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button, Input, Label, NativeSelect, Skeleton, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, Switch } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "@/i18n/navigation";
import { bi, cn } from "@/lib/utils";
import { PersonPicker } from "@/components/nexus/people/PersonPicker";
import type { PickedPerson } from "@/components/nexus/people/types";
import { api } from "../../handover/_components/bits";

type PersonMode = "employee" | "external" | "spot";
type External = { id: string; nameEn: string; nameAr: string; organisationEn: string | null; type: string; email: string | null };

export function StartHandoverDialog({ open, onOpenChange, presetUserId }: { open: boolean; onOpenChange: (v: boolean) => void; presetUserId?: string | null }) {
  const t = useTranslations("handover.start");
  const th = useTranslations("handover");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [personMode, setPersonMode] = React.useState<PersonMode>("employee");
  const [employee, setEmployee] = React.useState<PickedPerson | null>(null);
  const [external, setExternal] = React.useState<External | null>(null);
  const [externalQuery, setExternalQuery] = React.useState("");
  const [externals, setExternals] = React.useState<External[] | null>(null);
  const [spot, setSpot] = React.useState({ name: "", email: "", organisation: "" });
  const [kind, setKind] = React.useState<"leaving" | "transferring" | "long_leave">("leaving");
  const [reason, setReason] = React.useState("");
  const [lastWorkingDay, setLastWorkingDay] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [mode, setMode] = React.useState<"person" | "system" | "per_item">("person");
  const [recipient, setRecipient] = React.useState<PickedPerson | null>(null);
  const [notes, setNotes] = React.useState("");
  const [interviewRequired, setInterviewRequired] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (personMode !== "external" || !open) return;
    let live = true;
    setExternals(null); // the list shows its skeleton while the register is read
    const handle = setTimeout(async () => {
      const res = await api<{ externals: External[] }>(`/api/v1/handover?candidates=1&q=${encodeURIComponent(externalQuery)}`);
      if (live) setExternals(res.data?.externals ?? []);
    }, 180);
    return () => {
      live = false;
      clearTimeout(handle);
    };
  }, [externalQuery, personMode, open]);

  React.useEffect(() => {
    setInterviewRequired(personMode === "employee");
  }, [personMode]);

  const personReady = personMode === "employee" ? Boolean(employee) || Boolean(presetUserId) : personMode === "external" ? Boolean(external) : spot.name.trim().length >= 2;
  const canSubmit = personReady && (mode !== "person" || Boolean(recipient) || personMode !== "employee");

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const person =
        personMode === "employee" ? { userId: employee?.id ?? presetUserId ?? "" } : personMode === "external" ? { expertId: external!.id } : { external: { name: spot.name.trim(), email: spot.email.trim(), organisation: spot.organisation.trim() } };
      const res = await api<{ id: string; items: number }>("/api/v1/handover", {
        method: "POST",
        body: JSON.stringify({
          person,
          kind: personMode === "employee" ? kind : "engagement_ending",
          reason: reason || null,
          lastWorkingDay: lastWorkingDay || null,
          dueDate: dueDate || null,
          recipient: { mode, defaultRecipientUserId: mode === "person" ? recipient?.id ?? null : null },
          notes: notes || null,
          interviewRequired,
        }),
      });
      if (!res.ok || !res.data) {
        setError(res.error === "already_open" ? t("errors.alreadyOpen") : res.error === "forbidden" ? t("errors.forbidden") : res.error === "recipient_is_person" ? t("errors.recipientIsPerson") : tc("error"));
        return;
      }
      toast(t("started", { count: res.data.items }), "success");
      onOpenChange(false);
      router.push(`/hr/handovers/${res.data.id}` as never);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("title")} className="max-h-[92vh] w-[min(720px,94vw)] overflow-y-auto" data-testid="start-dialog">
        <div className="flex flex-col gap-4">
          {/* the person */}
          <div>
            {/* a caption over the person-mode tabs and whatever picker they
                reveal, not the label of one control */}
            <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("person")}</span>
            <div className="mb-2 inline-flex items-center gap-1 rounded-xl bg-sand-100 p-1" role="tablist" aria-label={t("person")}>
              {(["employee", "external", "spot"] as PersonMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={personMode === m}
                  onClick={() => setPersonMode(m)}
                  className={cn("cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold-500", personMode === m ? "bg-white text-maroon-900 shadow-sm" : "text-ink-600 hover:text-ink-900")}
                  data-testid={`person-mode-${m}`}
                >
                  {t(`personMode.${m}`)}
                </button>
              ))}
            </div>
            {personMode === "employee" ? (
              presetUserId ? (
                <p className="text-sm text-ink-600">{t("presetPerson")}</p>
              ) : (
                <PersonPicker value={employee} onChange={setEmployee} testId="start-person" />
              )
            ) : personMode === "external" ? (
              <div>
                {external ? (
                  <div className="flex items-center gap-2 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2 text-sm" data-testid="start-external-selected">
                    <span className="min-w-0 flex-1 truncate">
                      {bi(locale, external.nameEn, external.nameAr)} <span className="text-ink-400">{external.organisationEn ?? ""}</span>
                    </span>
                    <button type="button" onClick={() => setExternal(null)} className="cursor-pointer text-xs text-maroon-700 hover:underline">
                      {tc("remove")}
                    </button>
                  </div>
                ) : (
                  <div>
                    {/* the icon is positioned against the field alone, never
                        against the field plus the results list */}
                    <div className="relative">
                      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
                      <Input value={externalQuery} onChange={(e) => setExternalQuery(e.target.value)} placeholder={t("externalPlaceholder")} className="ps-8" data-testid="start-external-input" aria-label={t("personMode.external")} />
                    </div>
                    <ul className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-sand-300 bg-white p-1" role="listbox" aria-busy={externals === null}>
                      {externals === null ? (
                        [0, 1, 2].map((k) => (
                          <li key={k} className="px-2.5 py-1.5" aria-hidden>
                            <Skeleton className="h-4 w-full" />
                          </li>
                        ))
                      ) : externals.length ? (
                        externals.map((e) => (
                          <li key={e.id} role="option" aria-selected={false}>
                            <button type="button" onClick={() => setExternal(e)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm hover:bg-maroon-100/60 focus-visible:outline-2 focus-visible:outline-gold-500" data-testid="start-external-option">
                              <span className="min-w-0 flex-1 truncate">{bi(locale, e.nameEn, e.nameAr)}</span>
                              <span className="truncate text-xs text-ink-400">{e.organisationEn ?? e.type}</span>
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-2 text-xs text-ink-400">{t("noExternals")}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <Label htmlFor="spot-name">{t("spotName")}</Label>
                  <Input id="spot-name" value={spot.name} onChange={(e) => setSpot({ ...spot, name: e.target.value })} data-testid="spot-name" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="spot-org">{t("spotOrganisation")}</Label>
                  <Input id="spot-org" value={spot.organisation} onChange={(e) => setSpot({ ...spot, organisation: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="spot-email">{t("spotEmail")}</Label>
                  <Input id="spot-email" type="email" dir="ltr" value={spot.email} onChange={(e) => setSpot({ ...spot, email: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="start-kind">{t("kind")}</Label>
              {personMode === "employee" ? (
                <NativeSelect id="start-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} data-testid="start-kind">
                  {(["leaving", "transferring", "long_leave"] as const).map((k) => (
                    <option key={k} value={k}>
                      {th(`kinds.${k}`)}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <p className="flex h-9.5 items-center text-sm text-ink-900">{th("kinds.engagement_ending")}</p>
              )}
            </div>
            <div>
              <Label htmlFor="start-reason">{t("reason")}</Label>
              <Input id="start-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} data-testid="start-reason" />
            </div>
            <div>
              <Label htmlFor="start-lwd">{th("lastWorkingDay")}</Label>
              <Input id="start-lwd" type="date" dir="ltr" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} data-testid="start-lwd" />
            </div>
            <div>
              <Label htmlFor="start-due">{th("dueDate")}</Label>
              <Input id="start-due" type="date" dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="start-due" />
              <p className="mt-1 text-[11px] text-ink-400">{t("dueHint")}</p>
            </div>
          </div>

          <div>
            {/* a caption over a radio group of buttons, not a control */}
            <span className="mb-1.5 block text-xs font-medium text-ink-600">{t("recipientDecision")}</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("recipientDecision")}>
              {(["person", "system", "per_item"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  className={cn("cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold-500", mode === m ? "border-maroon-700 bg-maroon-50 text-maroon-900" : "border-sand-300 text-ink-600 hover:border-maroon-300")}
                  data-testid={`recipient-mode-${m}`}
                >
                  {t(`modes.${m}`)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-400">{t(`modeHint.${mode}`)}</p>
            {mode === "person" ? (
              <div className="mt-2">
                <Label htmlFor="start-recipient">{t("defaultRecipient")}</Label>
                <PersonPicker id="start-recipient" value={recipient} onChange={setRecipient} testId="start-recipient" />
                {personMode !== "employee" && !recipient ? <p className="mt-1 text-[11px] text-ink-400">{t("externalDefault")}</p> : null}
              </div>
            ) : null}
          </div>

          <div>
            <Label htmlFor="start-notes">{t("notes")}</Label>
            <Textarea id="start-notes" rows={2} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="start-notes" />
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm text-ink-900">
            {/* a Radix switch is a button: the wrapping label does not name it */}
            <Switch checked={interviewRequired} onCheckedChange={setInterviewRequired} aria-label={t("interviewRequired")} data-testid="start-interview-required" />
            {t("interviewRequired")}
          </label>

          {error ? (
            <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger" role="alert" data-testid="start-error">
              {error}
            </p>
          ) : null}

          {/* the form is taller than the dialog on a 900px screen, so the
              actions stay on the sticky footer instead of below the fold */}
          <div className="sticky bottom-0 -mx-6 -mb-6 flex items-center justify-end gap-2 border-t border-sand-100 bg-white px-6 py-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={submit} loading={busy} disabled={!canSubmit} data-testid="start-submit">
              {t("submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
