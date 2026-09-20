// CR08 6: the handover item categories, in one client-safe module. The
// server service re-exports these; client components import them from here,
// because importing a value from src/server/services/handover.ts would pull
// next/headers into the browser bundle.

export const CATEGORIES = [
  "document",
  "report",
  "deliverable",
  "policy",
  "lesson",
  "project_role",
  "stakeholder_role",
  "indicator",
  "council_indicator",
  "expert_request",
  "expert_profile",
  "contact",
  "community",
  "org_role",
  "collection",
  "tacit_topic",
  "other",
] as const;

export type ItemCategory = (typeof CATEGORIES)[number];

/** The CR05 item_kind each category maps onto (the readiness rules read it). */
export const ITEM_KIND_OF: Record<ItemCategory, string> = {
  document: "document",
  report: "document",
  deliverable: "document",
  policy: "document",
  lesson: "lesson",
  project_role: "node_owner",
  stakeholder_role: "node_role",
  indicator: "indicator",
  council_indicator: "indicator",
  expert_request: "expert_request",
  expert_profile: "expert_request",
  contact: "expert_request",
  community: "community_lead",
  org_role: "node_role",
  collection: "collection",
  tacit_topic: "tacit_topic",
  other: "tacit_topic",
};
