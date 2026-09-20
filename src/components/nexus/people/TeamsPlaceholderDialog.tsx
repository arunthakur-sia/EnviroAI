"use client";
// CR08 9.4: "Chat in Teams" keeps its place on the person card; the deep link
// arrives with deployment and integration.
import * as React from "react";
import { useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";

export function TeamsPlaceholderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("people.teams");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("title")} className="w-[min(440px,92vw)]" data-testid="teams-dialog">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gulf-100 text-gulf-600">
            <MessagesSquare className="size-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-ink-600">{t("body")}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="teams-close" autoFocus>
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
