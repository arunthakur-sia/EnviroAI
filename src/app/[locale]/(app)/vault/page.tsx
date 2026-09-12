// CR03 1: the Knowledge Vault as a real library. Shelves grouped by knowledge
// type in a fixed order, Projects as the lowest shelf (deliverables grouped by
// project), collapsible headers persisted per user, and books instead of boxes.
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { Upload, LibraryBig } from "lucide-react";
import { db, schema } from "@/server/db/client";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listDocuments, toShelfDocs } from "@/server/services/documents";
import { termsByDimension, getDepartmentsLite } from "@/server/services/taxonomy";
import { KnowledgeCard, type ShelfDoc } from "@/components/nexus/Shelf";
import { VaultToolbar } from "./VaultToolbar";
import { DocListRow } from "./DocListRow";
import { ShelvesBoard, type ShelfGroup, type ProjectShelf } from "./ShelvesBoard";
import { EmptyState, Button } from "@/components/ui/primitives";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/motion";
import { ReportButton } from "@/components/nexus/ReportButton";

export const dynamic = "force-dynamic";

/* CR03 1.1: the fixed shelf order, top to bottom. Type codes without a named
   shelf fall into "other" just above Projects. */
const SHELF_ORDER: { key: string; codes: string[] }[] = [
  { key: "strategies", codes: ["strategy"] },
  { key: "policies", codes: ["policy", "standard"] },
  { key: "reports", codes: ["report", "study"] },
  { key: "statistical", codes: ["statistical_release", "dataset"] },
  { key: "guidebooks", codes: ["guideline", "template"] },
  { key: "presentations", codes: ["presentation", "speech"] },
  { key: "minutes", codes: ["minutes", "circular"] },
];

export default async function VaultPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = await getTranslations("vault");

  const view = sp.view === "grid" ? "grid" : sp.view === "list" ? "list" : "shelves";

  const [{ documents }, terms, departments] = await Promise.all([
    listDocuments(user, {
      q: sp.q,
      knowledgeType: sp.type,
      outcome: sp.outcome,
      sector: sp.sector,
      topic: sp.topic,
      department: sp.department,
      year: sp.year ? Number(sp.year) : undefined,
      language: sp.language,
      classification: sp.classification ? Number(sp.classification) : undefined,
      status: sp.status,
      sort: (sp.sort as never) ?? "newest",
      limit: view === "shelves" ? 300 : 120,
    }),
    termsByDimension(),
    getDepartmentsLite(),
  ]);

  const shelfDocs = await toShelfDocs(documents);
  const canUpload = can(user, "create", "vault");

  const groups: ShelfGroup[] = [];
  let projectCount = 0;
  if (view === "shelves" && shelfDocs.length) {
    const tShelves = await getTranslations({ locale: "en", namespace: "vault" });
    const tShelvesAr = await getTranslations({ locale: "ar", namespace: "vault" });
    const byId = new Map(shelfDocs.map((d) => [d.id, d]));
    const assigned = new Set<string>();

    for (const def of SHELF_ORDER) {
      const docs = shelfDocs.filter((d) => def.codes.includes(d.typeCode ?? ""));
      for (const d of docs) assigned.add(d.id);
      if (docs.length) {
        groups.push({
          key: def.key,
          labelEn: tShelves(`shelves.${def.key}` as never),
          labelAr: tShelvesAr(`shelves.${def.key}` as never),
          count: docs.length,
          docs,
        });
      }
    }

    // Projects: one sub-shelf per project, sorted by outcome then code
    const deliverableDocs = shelfDocs.filter((d) => d.typeCode === "deliverable");
    for (const d of deliverableDocs) assigned.add(d.id);
    if (deliverableDocs.length) {
      const metas = await db
        .select()
        .from(schema.deliverableMeta)
        .where(
          inArray(
            schema.deliverableMeta.documentId,
            deliverableDocs.map((d) => d.id)
          )
        );
      const nodeIds = [...new Set(metas.map((m) => m.nodeId))];
      const allNodes = nodeIds.length
        ? await db.select().from(schema.strategyNodes)
        : [];
      const nodeById = new Map(allNodes.map((n) => [n.id, n]));
      const outcomeSortOf = (nodeId: string): number => {
        let current = nodeById.get(nodeId);
        for (let i = 0; i < 6 && current; i++) {
          if (current.nodeType === "outcome") return current.sort;
          current = current.parentId ? nodeById.get(current.parentId) : undefined;
        }
        return 999;
      };
      const projects: ProjectShelf[] = nodeIds
        .map((id) => nodeById.get(id))
        .filter((n): n is NonNullable<typeof n> => Boolean(n))
        .map((n) => ({
          id: n.id,
          code: n.code,
          titleEn: n.titleEn,
          titleAr: n.titleAr,
          docs: metas
            .filter((m) => m.nodeId === n.id)
            .sort((a, b) => a.deliverableCode.localeCompare(b.deliverableCode, "en", { numeric: true }))
            .flatMap((m): ShelfDoc[] => {
              const d = byId.get(m.documentId);
              return d ? [d] : [];
            }),
          outcomeSort: outcomeSortOf(n.id),
        }))
        .filter((p) => p.docs.length)
        .sort(
          (a, b) =>
            a.outcomeSort - b.outcomeSort ||
            (a.code ?? "").localeCompare(b.code ?? "", "en", { numeric: true })
        )
        .map(({ id, code, titleEn, titleAr, docs }) => ({ id, code, titleEn, titleAr, docs }));
      projectCount = projects.length;
      groups.push({
        key: "projects",
        labelEn: tShelves("shelves.projects"),
        labelAr: tShelvesAr("shelves.projects"),
        count: deliverableDocs.length,
        docs: [],
        projects,
      });
    }

    // anything the fixed shelves did not claim
    const rest = shelfDocs.filter((d) => !assigned.has(d.id));
    if (rest.length) {
      const projectsIdx = groups.findIndex((g) => g.key === "projects");
      const otherGroup: ShelfGroup = {
        key: "other",
        labelEn: tShelves("otherShelf"),
        labelAr: tShelvesAr("otherShelf"),
        count: rest.length,
        docs: rest,
      };
      if (projectsIdx >= 0) groups.splice(projectsIdx, 0, otherGroup);
      else groups.push(otherGroup);
    }
  }

  // per-user collapse state (CR03 1.1)
  let initialOpen: Record<string, boolean> = {};
  try {
    const prefs = user.prefsJson ? JSON.parse(user.prefsJson) : {};
    if (prefs && typeof prefs.vaultShelves === "object" && prefs.vaultShelves) {
      initialOpen = prefs.vaultShelves as Record<string, boolean>;
    }
  } catch {
    initialOpen = {};
  }

  return (
    <Reveal>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-600">{t("subtitle", { count: shelfDocs.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* CR02 7.1: report over the current Vault filters */}
          <ReportButton
            scope={{
              kind: "vault",
              ids: shelfDocs.slice(0, 30).map((d) => d.id),
              labelEn: "Knowledge Vault",
              labelAr: "خزانة المعرفة",
            }}
          />
          <Link href="/vault/collections">
            <Button variant="secondary">
              <LibraryBig /> {t("collections")}
            </Button>
          </Link>
          {canUpload ? (
            <Link href="/vault/upload">
              <Button>
                <Upload /> {t("upload")}
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <VaultToolbar
        terms={{
          knowledge_type: terms.knowledge_type ?? [],
          outcome: terms.outcome ?? [],
          sector: terms.sector ?? [],
          topic: terms.topic ?? [],
        }}
        departments={departments}
      />

      {shelfDocs.length === 0 ? (
        <EmptyState
          icon={<LibraryBig />}
          title={t("emptyTitle")}
          hint={t("emptyHint")}
          action={
            canUpload ? (
              <Link href="/vault/upload">
                <Button>
                  <Upload /> {t("upload")}
                </Button>
              </Link>
            ) : undefined
          }
          className="mt-8"
        />
      ) : view === "shelves" ? (
        <ShelvesBoard groups={groups} initialOpen={initialOpen} projectCount={projectCount} />
      ) : view === "grid" ? (
        <div className="mt-6 flex flex-wrap gap-5">
          {shelfDocs.map((d) => (
            <KnowledgeCard key={d.id} doc={d} />
          ))}
        </div>
      ) : (
        <div className="card mt-6 divide-y divide-sand-100">
          {shelfDocs.map((d) => (
            <DocListRow key={d.id} doc={d} />
          ))}
        </div>
      )}
    </Reveal>
  );
}
