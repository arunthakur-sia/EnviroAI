"use client";
// CR05 6.3: set a policy-conforming password and accept the use notice.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Input, Label } from "@/components/ui/primitives";

export function AcceptInviteForm({ token }: { token: string }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [accept, setAccept] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("errors.mismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/accept-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, acceptUse: true, localePref: locale }),
      });
      const json = await res.json();
      if (!res.ok) {
        const known = ["too_short", "needs_letter", "needs_digit", "too_common", "invalid_invite", "user_exists"];
        setError(t(`errors.${known.includes(json.error) ? json.error : "generic"}` as never));
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate data-testid="accept-invite-form">
      <div>
        <Label htmlFor="pw">{t("password")}</Label>
        <Input
          id="pw"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="mt-1 text-[11px] text-ink-600">{t("policy")}</p>
      </div>
      <div>
        <Label htmlFor="pw2">{t("confirm")}</Label>
        <Input
          id="pw2"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-600">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          className="mt-0.5 accent-maroon-700"
          data-testid="accept-use"
        />
        {t("acceptableUse")}
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={loading} disabled={!accept} className="mt-1">
        {t("cta")}
      </Button>
    </form>
  );
}
