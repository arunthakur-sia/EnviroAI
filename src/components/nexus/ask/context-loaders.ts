import "server-only";
// CR08 2.3: server helpers that turn a route id into the Ask EnviroAI context item
// a page mounts, for pages whose renderer lives elsewhere (the strategy node
// route delegates to node-detail.tsx and never sees the node itself).
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import type { AskContextItem, AskContextItemKind } from "./context-store";

const NODE_KINDS: Partial<Record<string, AskContextItemKind>> = {
  outcome: "outcome",
  target: "target",
  initiative: "initiative",
  project: "project",
};

/** The Living Strategy node behind /strategy/[id], or null for edition codes
 *  and node types the launcher has no wording for (clusters, enablers). */
export async function strategyNodeAskContext(id: string): Promise<AskContextItem | null> {
  const [node] = await db
    .select({
      id: schema.strategyNodes.id,
      code: schema.strategyNodes.code,
      nodeType: schema.strategyNodes.nodeType,
      titleEn: schema.strategyNodes.titleEn,
      titleAr: schema.strategyNodes.titleAr,
    })
    .from(schema.strategyNodes)
    .where(eq(schema.strategyNodes.id, id))
    .limit(1);
  const kind = node ? NODE_KINDS[node.nodeType] : undefined;
  if (!node || !kind) return null;
  return {
    kind,
    id: node.id,
    code: node.code,
    titleEn: node.titleEn,
    titleAr: node.titleAr,
    href: `/strategy/${node.id}`,
  };
}
