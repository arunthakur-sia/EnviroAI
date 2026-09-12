"use client";
// Request this expert + endorse.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Send, ThumbsUp } from "lucide-react";
import { bi } from "@/lib/utils";
import { Button, Input, Textarea, Label, NativeSelect } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

export function ExpertActions({
  expertId,
  domains,
}: {
  expertId: string;
  domains: { code: string; nameEn: string; nameAr: string }[];
}) {
  const t = useTranslations("experts");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function request() {
    if (!subject.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/experts/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expertId, subject, detail }),
      });
      if (res.ok) {
        toast(t("requestSent"), "success");
        setOpen(false);
        setSubject("");
        setDetail("");
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function endorse() {
    const res = await fetch(`/api/v1/experts/${expertId}/endorse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) toast(t("endorsed"), "success");
    else toast(tc("error"), "error");
  }

  return (
    <>
      <Button variant="ghost" onClick={endorse}>
        <ThumbsUp /> {t("endorse")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Send /> {t("request")}
          </Button>
        </DialogTrigger>
        <DialogContent title={t("requestTitle")}>
          <div className="flex flex-col gap-3.5">
            <div>
              <Label>{t("requestSubject")}</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>{t("requestDetail")}</Label>
              <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end">
              <Button loading={busy} onClick={request}>
                {t("requestCta")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
