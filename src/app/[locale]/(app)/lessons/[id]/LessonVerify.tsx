"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

export function LessonVerify({ lessonId }: { lessonId: string }) {
  const tc = useTranslations("common");
  const t = useTranslations("lessons");
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function verify() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/lessons/${lessonId}/verify`, { method: "POST" });
      if (res.ok) {
        toast(t("verifiedToast"), "success");
        router.refresh();
      } else toast(tc("error"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={busy} onClick={verify}>
      <BadgeCheck /> {tc("verify")}
    </Button>
  );
}
