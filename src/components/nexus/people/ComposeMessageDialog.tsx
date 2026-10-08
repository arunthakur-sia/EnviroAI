"use client";
// CR08 9.2: the compose box. From a person card the recipient is fixed and
// the subject and body are prefilled with the item and its deep link; from
// the Inbox the recipient is searched. Send creates the thread, the
// notification and the unread count on the server.
import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Avatar, Button, Input, Label, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { bi } from "@/lib/utils";
import { AttachmentPicker } from "./AttachmentPicker";
import { PersonPicker } from "./PersonPicker";
import { absoluteItemLink, type ItemRef, type PickedDocument, type PickedPerson } from "./types";

export function ComposeMessageDialog({
  open,
  onOpenChange,
  to,
  item,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** a fixed recipient (person card); omit to search */
  to?: PickedPerson | null;
  item?: ItemRef | null;
  /** when given, the dialog closes on send and hands over the thread id */
  onSent?: (threadId: string) => void;
}) {
  const t = useTranslations("people.compose");
  const locale = useLocale();
  const { toast } = useToast();
  const [recipient, setRecipient] = React.useState<PickedPerson | null>(to ?? null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [attachments, setAttachments] = React.useState<PickedDocument[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [sentId, setSentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setRecipient(to ?? null);
    setSubject(item ? t("subjectPrefix", { title: bi(locale, item.titleEn, item.titleAr) }) : "");
    setBody(
      item
        ? t("bodyLink", { title: bi(locale, item.titleEn, item.titleAr), link: absoluteItemLink(locale, item.href) })
        : ""
    );
    setAttachments([]);
    setSentId(null);
    // reset on open only; the props are read at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSend = Boolean(recipient) && subject.trim().length > 0 && body.trim().length > 0;

  async function send() {
    if (!canSend || !recipient) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toUserId: recipient.id,
          subject: subject.trim(),
          body: body.trim(),
          resource: item
            ? { type: item.type, id: item.id, titleEn: item.titleEn, titleAr: item.titleAr, link: item.href }
            : null,
          attachments: attachments.map((d) => ({ documentId: d.id })),
        }),
      });
      const json = await res.json().catch(() => ({ data: null }));
      if (res.ok && json.data?.id) {
        toast(t("sent"), "success");
        if (onSent) {
          onSent(json.data.id);
          onOpenChange(false);
        } else {
          setSentId(json.data.id);
        }
      } else toast(t("failed"), "error");
    } catch {
      toast(t("failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  const title = to ? t("titleTo", { name: bi(locale, to.nameEn, to.nameAr) }) : t("title");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} className="w-[min(600px,92vw)]" data-testid="compose-dialog">
        {sentId ? (
          <div className="flex flex-col items-start gap-3" data-testid="compose-sent">
            <p className="text-sm text-ink-900">{t("sent")}</p>
            <Link
              href={`/inbox?thread=${sentId}` as never}
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9.5 items-center rounded-lg border border-mist-300 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-navy-300 hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-aqua-500"
              data-testid="compose-open-inbox"
            >
              {t("openInbox")}
            </Link>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div>
              <Label htmlFor="compose-to">{t("to")}</Label>
              {to ? (
                <div className="flex h-9.5 items-center gap-2 rounded-lg border border-mist-300 bg-mist-50 px-2" data-testid="compose-to-fixed">
                  <Avatar name={to.nameEn} color={to.avatarColor} size={22} />
                  <span className="truncate text-sm text-ink-900">{bi(locale, to.nameEn, to.nameAr)}</span>
                  {to.unitEn || to.unitAr ? (
                    <span className="truncate text-xs text-ink-400">{bi(locale, to.unitEn ?? "", to.unitAr ?? "")}</span>
                  ) : null}
                </div>
              ) : (
                <PersonPicker id="compose-to" value={recipient} onChange={setRecipient} autoFocus testId="compose-to" />
              )}
            </div>
            <div>
              <Label htmlFor="compose-subject">{t("subject")}</Label>
              <Input
                id="compose-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                dir="auto"
                autoFocus={Boolean(to)}
                data-testid="compose-subject"
              />
            </div>
            <div>
              <Label htmlFor="compose-body">{t("body")}</Label>
              <Textarea
                id="compose-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                dir="auto"
                placeholder={t("bodyPlaceholder")}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                data-testid="compose-body"
              />
            </div>
            <AttachmentPicker value={attachments} onChange={setAttachments} testId="compose-attach" />
            {!recipient ? <p className="text-xs text-ink-400">{t("recipientRequired")}</p> : null}
            <div className="flex justify-end gap-2 border-t border-mist-100 pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" loading={busy} disabled={!canSend} data-testid="compose-send">
                {t("send")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
