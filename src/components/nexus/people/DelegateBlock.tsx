"use client";
// CR08 9.3: "Delegate my messages to" on the profile. Self-loading over
// GET/PUT /api/v1/profile/delegate so the profile page stays untouched.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Chip, Input, Label, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { PersonPicker } from "./PersonPicker";
import type { PickedPerson } from "./types";

type Info = { delegate: PickedPerson | null; from: string | null; to: string | null; active: boolean };

export function DelegateBlock() {
  const t = useTranslations("profile.delegate");
  const locale = useLocale();
  const { toast } = useToast();
  const [info, setInfo] = React.useState<Info | null>(null);
  const [person, setPerson] = React.useState<PickedPerson | null>(null);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/v1/profile/delegate")
      .then((r) => r.json())
      .then((json) => {
        const data: Info = json.data ?? { delegate: null, from: null, to: null, active: false };
        setInfo(data);
        setPerson(data.delegate);
        setFrom(data.from ?? "");
        setTo(data.to ?? "");
      })
      .catch(() => setInfo({ delegate: null, from: null, to: null, active: false }));
  }, []);

  async function save(clear = false) {
    if (!clear && from && to && from > to) {
      toast(t("invalidDates"), "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/profile/delegate", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          clear || !person ? { delegateUserId: null } : { delegateUserId: person.id, from: from || null, to: to || null }
        ),
      });
      const json = await res.json().catch(() => ({ data: null }));
      if (res.ok && json.data) {
        setInfo(json.data);
        setPerson(json.data.delegate);
        setFrom(json.data.from ?? "");
        setTo(json.data.to ?? "");
        toast(clear || !person ? t("cleared") : t("saved"), "success");
      } else toast(t("failed"), "error");
    } catch {
      toast(t("failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-4 p-5" data-testid="delegate-block">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">{t("title")}</p>
        {info ? (
          info.delegate ? (
            <Chip tone={info.active ? "ok" : "sand"} data-testid="delegate-status">
              {info.active ? t("active") : t("scheduled")}
            </Chip>
          ) : (
            <Chip tone="ghost" data-testid="delegate-status">{t("none")}</Chip>
          )
        ) : null}
      </div>
      <p className="-mt-2 text-xs text-ink-600">{t("hint")}</p>
      {!info ? (
        <div className="space-y-2">
          <Skeleton className="h-9.5 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9.5 w-full" />
            <Skeleton className="h-9.5 w-full" />
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="delegate-person">{t("person")}</Label>
            <PersonPicker id="delegate-person" value={person} onChange={setPerson} testId="delegate-person" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="delegate-from">{t("from")}</Label>
              <Input id="delegate-from" type="date" dir="ltr" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="delegate-from" />
            </div>
            <div>
              <Label htmlFor="delegate-to">{t("to")}</Label>
              <Input id="delegate-to" type="date" dir="ltr" value={to} onChange={(e) => setTo(e.target.value)} data-testid="delegate-to" />
            </div>
          </div>
          {info.delegate && (info.from || info.to) ? (
            <p className="text-xs text-ink-400 tnum">
              {[info.from ? formatDate(info.from, locale, { style: "medium" }) : null, info.to ? formatDate(info.to, locale, { style: "medium" }) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {info.delegate ? (
              <Button variant="ghost" size="sm" onClick={() => save(true)} disabled={busy} data-testid="delegate-clear">
                {t("clear")}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" loading={busy} disabled={!person} onClick={() => save(false)} data-testid="delegate-save">
              {t("save")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
