"use client";
// CR08 3: "Request this expert" is the primary action on every external card
// and on the profile page, so the dialog lives once, here.
import * as React from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { Button, Input, Textarea, Label } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

export function RequestExpertDialog({
  expertId,
  expertName,
  trigger,
}: {
  expertId: string;
  expertName?: string;
  /** the element that opens the dialog; a primary button by default */
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("experts");
  const tc = useTranslations("common");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button data-testid="request-expert">
            <Send /> {t("request")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={expertName ? `${t("requestTitle")}: ${expertName}` : t("requestTitle")}>
        <div className="flex flex-col gap-3.5">
          <div>
            <Label htmlFor={`req-subject-${expertId}`}>{t("requestSubject")}</Label>
            <Input
              id={`req-subject-${expertId}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="request-subject"
            />
          </div>
          <div>
            <Label htmlFor={`req-detail-${expertId}`}>{t("requestDetail")}</Label>
            <Textarea
              id={`req-detail-${expertId}`}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end">
            <Button loading={busy} onClick={request} disabled={!subject.trim()} data-testid="request-send">
              {t("requestCta")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
