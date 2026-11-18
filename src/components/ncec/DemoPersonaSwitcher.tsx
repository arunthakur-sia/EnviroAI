"use client";
// The NCEC demo persona switcher (ui-plan.md s4, decision #13): available to
// every signed-in user while demo mode is on, since Step 1 has no real NCEC
// SSO or access-grant workflow yet. Clearly marked as a demo-only control so
// it is never mistaken for a real permission. The current persona is passed
// in from the server (resolved by the same getNcecPrincipal() the pages
// use), so switching just posts the new choice and refreshes the page.
import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FlaskConical, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/overlays";

export type DemoPersonaKey = "l1" | "l2" | "l3";
const PERSONAS: DemoPersonaKey[] = ["l1", "l2", "l3"];

export function DemoPersonaSwitcher({ persona }: { persona: DemoPersonaKey }) {
  const t = useTranslations("ksaNcec");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function pick(next: DemoPersonaKey) {
    if (next === persona || pending) return;
    setPending(true);
    try {
      await fetch("/api/v1/demo/persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persona: next }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full border border-dashed border-ink-400/60 bg-mist-50 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-mist-100 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-aqua-500"
          data-testid="ncec-demo-switcher"
          aria-label={t("shell.demoControl")}
          disabled={pending}
        >
          <FlaskConical className="size-3.5" aria-hidden />
          <span className="hidden lg:inline">{t(`shell.persona.${persona}` as never)}</span>
          <ChevronDown className="size-3.5 text-ink-400" aria-hidden />
        </button>
      </DropdownTrigger>
      <DropdownContent align="end">
        <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-400">
          {t("shell.demoBadge")}
        </p>
        <p className="px-2.5 pb-2 text-xs text-ink-600">{t("shell.demoHint")}</p>
        {PERSONAS.map((p) => (
          <DropdownItem key={p} onSelect={() => pick(p)} className={cn(p === persona && "font-semibold text-navy-900")}>
            {t(`shell.persona.${p}` as never)}
            {p === persona ? <span className="ms-auto text-aqua-500">●</span> : null}
          </DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
