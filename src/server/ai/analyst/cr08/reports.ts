// CR08 5: Reports module tools. list_report_types names the catalogue the
// caller may request; find_reports finds published module reports (and the
// caller's own when asked) by type, period and scope and returns their
// titles with links to /reports/[id], registering each as a source.
import { canUseReports, listModuleReports, listReportTypes } from "@/server/services/reports";
import type { ToolModule } from "./types";

const mod: ToolModule = {
  definitions: [
    {
      name: "list_report_types",
      description:
        "Lists the report types of the Reports module (Annual Environment Report, National Environment Strategy Progress Report, Programme Office Strategy Performance Report, Leadership Briefing Pack and the rest): family (public or internal), scope kind, cadence and the sections each carries by default. Use it when the user asks what reports EnviroAI can produce or how to request one.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "find_reports",
      description:
        "Finds published reports of the Reports module by type, period and scope, returning titles, status and links of the form /reports/<id>. Published reports are also Institutional Memory documents. Use it when the user asks for the annual report, a quarterly scorecard, a briefing pack or 'the latest report on' something.",
      input_schema: {
        type: "object",
        properties: {
          type: { type: "string", description: "a type code (e.g. org_annual_report) or part of a type name" },
          period: { type: "string", description: "a year like 2026, a quarter like 'Q3 2026' or a month name" },
          scope: { type: "string", description: "part of the scope label: an outcome code or name, a department, a project" },
          include_mine: { type: "boolean", description: "also include the caller's own draft and in-review reports" },
        },
      },
    },
  ],
  portal: { list_report_types: "reports", find_reports: "reports" },
  async run(ctx, name, input) {
    if (name === "list_report_types") {
      if (!canUseReports(ctx.user)) return "The Reports module is not available to this account.";
      const types = await listReportTypes(ctx.user);
      if (!types.length) return "No report types are configured yet.";
      return [
        `${types.length} report types are available (family, scope, cadence, default sections):`,
        ...types.map(
          (t) =>
            `${t.code}: "${t.nameEn}" / "${t.nameAr}", ${t.family}, scope ${t.scopeKind}, ${t.cadence ?? "on demand"}, ${t.defaultSections.length} default sections (${t.defaultSections.join(", ")}), ${t.optionalSections.length} optional. ${t.descriptionEn ?? ""}`
        ),
        "Anyone with the Reports portal may request a public or internal type for their scope; the Super Admin approves, publishes and builds custom reports. The request form is at /reports.",
      ].join("\n");
    }
    if (name === "find_reports") {
      if (!canUseReports(ctx.user)) return "The Reports module is not available to this account.";
      const typeNeedle = String(input.type ?? "").trim().toLowerCase();
      const periodNeedle = String(input.period ?? "").trim().toLowerCase();
      const scopeNeedle = String(input.scope ?? "").trim().toLowerCase();
      const includeMine = Boolean(input.include_mine);
      const all = await listModuleReports(ctx.user, {});
      let rows = all.filter((r) => r.status === "published" || (includeMine && r.requestedBy === ctx.user.id));
      if (typeNeedle) rows = rows.filter((r) => r.typeCode.includes(typeNeedle) || r.typeNameEn.toLowerCase().includes(typeNeedle) || r.typeNameAr.includes(String(input.type ?? "").trim()));
      if (periodNeedle) rows = rows.filter((r) => r.period.label.en.toLowerCase().includes(periodNeedle) || r.period.label.ar.includes(String(input.period ?? "").trim()) || String(r.period.year) === periodNeedle);
      if (scopeNeedle) rows = rows.filter((r) => r.scope.label.en.toLowerCase().includes(scopeNeedle) || r.scope.label.ar.includes(String(input.scope ?? "").trim()) || (r.scope.code ?? "").toLowerCase() === scopeNeedle);
      if (!rows.length) {
        return `No ${includeMine ? "" : "published "}report matches${typeNeedle ? ` type "${input.type}"` : ""}${periodNeedle ? ` period "${input.period}"` : ""}${scopeNeedle ? ` scope "${input.scope}"` : ""}. The Reports gallery is at /reports.`;
      }
      const lines = rows.slice(0, 12).map((r) => {
        const n = ctx.state.addSource({
          resource_type: "report",
          resource_id: r.id,
          title: r.titleEn,
          page: null,
          excerpt: `${r.typeNameEn}, ${r.period.label.en}, ${r.scope.label.en}, ${r.status}`,
          classification: r.classification,
          verified: r.status === "published",
        });
        return `[${n}] "${r.titleEn}" / "${r.titleAr}" (${r.typeNameEn}, ${r.family}, ${r.period.label.en}, scope ${r.scope.kind}: ${r.scope.label.en}, status ${r.status}${r.publishedAt ? `, published ${r.publishedAt.slice(0, 10)}` : ""}, classification ${r.classification}) link /reports/${r.id}${r.publishedDocumentId ? ` document /vault/${r.publishedDocumentId}` : ""}`;
      });
      return [`${rows.length} report${rows.length === 1 ? "" : "s"} found:`, ...lines, rows.length > 12 ? `(${rows.length - 12} more)` : ""].filter(Boolean).join("\n");
    }
    return null;
  },
};

export default mod;
