// CR08 8: the Home block. Renders the strip for the active pick and, when
// this person has not seen the reveal this week, the reveal over it. The
// coordinator mounts `<KnowledgeOfWeekHome user={user} />` in home/page.tsx
// between the greeting row and the quote band (a full-width row of the
// Stagger). Nothing renders when there is no active pick or the viewer may
// not read it.
import type { CurrentUser } from "@/server/auth/session";
import { getActiveKnowledgeOfWeek } from "@/server/services/knowledge-of-week";
import { KnowledgeOfWeekReveal, KnowledgeOfWeekStrip } from "@/components/nexus/kow";

export async function KnowledgeOfWeekHome({
  user,
  forceReveal = false,
}: {
  user: CurrentUser;
  /** Dev preview only: show the reveal even when already seen */
  forceReveal?: boolean;
}) {
  const card = await getActiveKnowledgeOfWeek(user);
  if (!card) return null;
  return (
    <section data-testid="home-kow">
      <KnowledgeOfWeekStrip card={card} numerals={user.numeralsPref} />
      {forceReveal || !card.viewerSeen ? <KnowledgeOfWeekReveal card={card} numerals={user.numeralsPref} /> : null}
    </section>
  );
}
