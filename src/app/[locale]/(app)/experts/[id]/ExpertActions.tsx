"use client";
// Request this expert (the shared dialog) + endorse.
import { useTranslations } from "next-intl";
import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { RequestExpertDialog } from "@/components/nexus/RequestExpertDialog";

export function ExpertActions({ expertId, expertName }: { expertId: string; expertName: string }) {
  const t = useTranslations("experts");
  const tc = useTranslations("common");
  const { toast } = useToast();

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
      <RequestExpertDialog expertId={expertId} expertName={expertName} />
    </>
  );
}
