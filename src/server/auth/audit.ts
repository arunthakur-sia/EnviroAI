import { db, schema } from "@/server/db/client";
import { newId, nowIso } from "@/lib/ids";

export async function audit(
  userId: string | null,
  action: string,
  resourceType?: string,
  resourceId?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      id: newId(),
      userId,
      action,
      resourceType: resourceType ?? null,
      resourceId: resourceId ?? null,
      metaJson: meta ? JSON.stringify(meta) : null,
      createdAt: nowIso(),
    });
  } catch {
    // Auditing must never break the request.
  }
}
