// CR08 6.3: "A handover has started for you". A server component the Home
// page mounts; renders nothing when the viewer receives no open handover.
import { getCurrentUser } from "@/server/auth/session";
import { getMyRecipientHandovers } from "@/server/services/handover";
import { HandoverBannerClient } from "./HandoverBannerClient";

export async function HandoverBanner() {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = await getMyRecipientHandovers(user).catch((e) => {
    console.error("[handover] banner query failed:", (e as Error)?.message ?? e);
    return [];
  });
  const open = rows.filter((r) => r.status !== "complete" && !r.signedOffAt);
  if (!open.length) return null;
  return (
    <HandoverBannerClient
      items={open.map((r) => ({
        id: r.id,
        kind: r.kind,
        nameEn: r.person.nameEn,
        nameAr: r.person.nameAr,
        avatarColor: r.person.avatarColor,
        lastWorkingDay: r.lastWorkingDay,
        pct: r.progress?.pct ?? null,
        items: r.items,
      }))}
    />
  );
}
