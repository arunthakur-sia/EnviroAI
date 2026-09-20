// CR08 9.2: the Inbox. Threads grouped by item, filters, the thread view with
// replies, "Convert to question" and "Mark done". Deep link: ?thread=<id>.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listThreads, type ListFilter } from "@/server/services/messaging";
import { Reveal } from "@/components/motion";
import { InboxClient } from "./InboxClient";

export const dynamic = "force-dynamic";

const FILTERS: ListFilter[] = ["all", "unread", "done", "delegate"];

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ thread?: string; filter?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const filter = (FILTERS as string[]).includes(sp.filter ?? "") ? (sp.filter as ListFilter) : "all";
  const threads = await listThreads(user, { filter });
  return (
    <Reveal>
      <InboxClient
        me={{ id: user.id, nameEn: user.nameEn, nameAr: user.nameAr, avatarColor: user.avatarColor }}
        initialThreads={threads}
        initialFilter={filter}
        initialThreadId={sp.thread ?? null}
      />
    </Reveal>
  );
}
