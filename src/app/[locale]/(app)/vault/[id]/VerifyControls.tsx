"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BadgeCheck, MessageSquareWarning } from "lucide-react";
import { Button, Textarea, Label } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/toast";

export function VerifyControls({ documentId }: { documentId: string }) {
  const t = useTranslations("reader");
  const tc = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [both, setBoth] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function submit(decision: "verified" | "needs_changes") {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note, bothLanguagesChecked: both }),
      });
      if (res.ok) {
        toast(decision === "verified" ? t("verifiedToast") : t("needsChangesToast"), "success");
        setOpen(false);
        router.refresh();
      } else {
        toast(tc("error"), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <BadgeCheck /> {tc("verify")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("verifyTitle")}>
        <p className="mb-3 text-sm text-ink-600">{t("verifyHint")}</p>
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-ink-900">
          <input
            type="checkbox"
            checked={both}
            onChange={(e) => setBoth(e.target.checked)}
            className="accent-maroon-700"
          />
          {t("bothLanguagesChecked")}
        </label>
        <Label htmlFor="verify-note">{t("verifyNote")}</Label>
        <Textarea id="verify-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" loading={busy} onClick={() => submit("needs_changes")}>
            <MessageSquareWarning /> {tc("needsChanges")}
          </Button>
          <Button loading={busy} onClick={() => submit("verified")}>
            <BadgeCheck /> {tc("verify")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
