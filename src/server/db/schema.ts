// SiaNexus data model. SQLite dialect, portable types only (text, integer, real, blob).
// Conventions: id = text ULID; timestamps = ISO strings; bilingual fields as _en/_ar pairs;
// JSON columns stored as text and validated with Zod in src/server/db/json.ts.
import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () => text("created_at").notNull();
const updatedAt = () => text("updated_at").notNull();

/* ------------------------------------------------------------------ */
/* 7.1 Identity and organisation                                       */
/* ------------------------------------------------------------------ */

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    avatarPath: text("avatar_path"),
    avatarColor: text("avatar_color").notNull().default("maroon"),
    departmentId: text("department_id"),
    roleId: text("role_id").notNull(),
    clearanceLevel: integer("clearance_level").notNull().default(2),
    departmentScope: text("department_scope").notNull().default("all"),
    localePref: text("locale_pref").notNull().default("en"),
    numeralsPref: text("numerals_pref").notNull().default("western"),
    quietMode: integer("quiet_mode").notNull().default(0),
    onboardingJson: text("onboarding_json"),
    prefsJson: text("prefs_json"),
    /* CR08 9.3: messages to this person also land with the delegate */
    delegateUserId: text("delegate_user_id"),
    delegateFrom: text("delegate_from"),
    delegateTo: text("delegate_to"),
    positionEn: text("position_en"),
    positionAr: text("position_ar"),
    lastLoginAt: text("last_login_at"),
    // CR05 6.3: lockout counters and password provenance
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: text("locked_until"),
    passwordSetAt: text("password_set_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: text("deleted_at"),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const roles = sqliteTable("roles", {
  id: id(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  permissionsJson: text("permissions_json").notNull(),
  defaultClearance: integer("default_clearance").notNull().default(2),
  defaultDepartmentScope: text("default_department_scope").notNull().default("all"),
  isSystem: integer("is_system").notNull().default(0),
  // CR05 6.1: the portal visibility set for the role (JSON array of portal keys)
  portalsJson: text("portals_json"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* CR07 3.2: the departments table became the organisation units table. Every
   id survived the rename, so users, nodes, leads, stakeholders, indicators and
   HR rows keep pointing at the same units; a read-only `departments` view
   keeps older raw SQL working. `departments` below is a deprecated alias. */
export const orgUnits = sqliteTable(
  "org_units",
  {
    id: id(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    headUserId: text("head_user_id"),
    parentId: text("parent_id"),
    // CR05 5.2: the HR dashboard's department card content
    responsibilitiesEn: text("responsibilities_en"),
    responsibilitiesAr: text("responsibilities_ar"),
    keyProjectsNote: text("key_projects_note"),
    // CR07 3.2: secretary_general | sector | office | department | section
    level: text("level").notNull().default("department"),
    mandateEn: text("mandate_en"),
    mandateAr: text("mandate_ar"),
    mandateSourceUrl: text("mandate_source_url"),
    mandateSourceUrlAr: text("mandate_source_url_ar"),
    mandateFetchedAt: text("mandate_fetched_at"),
    // heads who are not SiaNexus users are stored by name and title
    headNameEn: text("head_name_en"),
    headNameAr: text("head_name_ar"),
    headTitleEn: text("head_title_en"),
    headTitleAr: text("head_title_ar"),
    sort: integer("sort").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("org_units_parent_idx").on(t.parentId)]
);

/** @deprecated CR07 renamed this to `orgUnits`; kept so older imports compile. */
export const departments = orgUnits;

export const orgUnitMembers = sqliteTable(
  "org_unit_members",
  {
    id: id(),
    unitId: text("unit_id").notNull(),
    userId: text("user_id").notNull(),
    // head | deputy | member
    roleInUnit: text("role_in_unit").notNull().default("member"),
    since: text("since"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("org_unit_members_unique").on(t.unitId, t.userId)]
);

export const orgSyncRuns = sqliteTable("org_sync_runs", {
  id: id(),
  fetchedAt: text("fetched_at").notNull(),
  diffJson: text("diff_json"),
  appliedBy: text("applied_by"),
  appliedAt: text("applied_at"),
});

/* CR07 3.5: policies, procedures, forms and services belong to a unit */
export const documentUnitLinks = sqliteTable(
  "document_unit_links",
  {
    id: id(),
    documentId: text("document_id").notNull(),
    unitId: text("unit_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("document_unit_unique").on(t.documentId, t.unitId)]
);

export const sessions = sqliteTable("sessions", {
  id: id(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(), // CR05 6.3: absolute expiry (7 days)
  ip: text("ip"),
  userAgent: text("user_agent"),
  // CR05 6.3: 12-hour inactivity window rides on this
  lastSeenAt: text("last_seen_at"),
  createdAt: createdAt(),
});

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: id(),
    userId: text("user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metaJson: text("meta_json"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)]
);

/* ------------------------------------------------------------------ */
/* 7.2 Taxonomy                                                        */
/* ------------------------------------------------------------------ */

export const taxonomyDimensions = sqliteTable("taxonomy_dimensions", {
  id: id(),
  code: text("code").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  isHierarchical: integer("is_hierarchical").notNull().default(0),
});

export const taxonomyTerms = sqliteTable(
  "taxonomy_terms",
  {
    id: id(),
    dimensionId: text("dimension_id").notNull(),
    parentId: text("parent_id"),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    sort: integer("sort").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
  },
  (t) => [index("terms_dimension_idx").on(t.dimensionId)]
);

export const classificationLevels = sqliteTable("classification_levels", {
  id: id(),
  level: integer("level").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  color: text("color").notNull(),
  description: text("description"),
});

export const taggings = sqliteTable(
  "taggings",
  {
    id: id(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    termId: text("term_id").notNull(),
    source: text("source").notNull().default("human"),
    confidence: real("confidence"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("taggings_resource_idx").on(t.resourceType, t.resourceId)]
);

/* ------------------------------------------------------------------ */
/* 7.3 Knowledge Vault                                                 */
/* ------------------------------------------------------------------ */

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    titleArMachine: integer("title_ar_machine").notNull().default(0),
    summaryEn: text("summary_en"),
    summaryAr: text("summary_ar"),
    summaryMachine: integer("summary_machine").notNull().default(0),
    keyFactsJson: text("key_facts_json"),
    knowledgeTypeTermId: text("knowledge_type_term_id"),
    classificationLevel: integer("classification_level").notNull().default(2),
    departmentId: text("department_id"),
    ownerUserId: text("owner_user_id"),
    languageOriginal: text("language_original").notNull().default("en"),
    status: text("status").notNull().default("draft"),
    reviewDueAt: text("review_due_at"),
    verifiedBy: text("verified_by"),
    verifiedAt: text("verified_at"),
    sourceOrigin: text("source_origin").notNull().default("npc"),
    publishYear: integer("publish_year"),
    originalFilename: text("original_filename"),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    pageCount: integer("page_count"),
    storagePath: text("storage_path"),
    textPath: text("text_path"),
    currentVersionId: text("current_version_id"),
    viewCount: integer("view_count").notNull().default(0),
    downloadCount: integer("download_count").notNull().default(0),
    reuseCount: integer("reuse_count").notNull().default(0),
    isSeeded: integer("is_seeded").notNull().default(0),
    sourceRef: text("source_ref"),
    /* CR07 3.5: policies and procedures carry their own visibility on top of
       the classification level, plus the version and review fields. */
    visibilityScope: text("visibility_scope").notNull().default("all_staff"),
    visibilityAllowJson: text("visibility_allow_json"),
    effectiveFrom: text("effective_from"),
    versionLabel: text("version_label"),
    reviewCycleMonths: integer("review_cycle_months"),
    supersedesDocumentId: text("supersedes_document_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("documents_status_idx").on(t.status),
    index("documents_dept_idx").on(t.departmentId),
  ]
);

export const documentVersions = sqliteTable("document_versions", {
  id: id(),
  documentId: text("document_id").notNull(),
  versionNo: integer("version_no").notNull(),
  storagePath: text("storage_path").notNull(),
  uploadedBy: text("uploaded_by"),
  note: text("note"),
  createdAt: createdAt(),
});

export const documentChunks = sqliteTable(
  "document_chunks",
  {
    id: id(),
    documentId: text("document_id").notNull(),
    versionId: text("version_id"),
    chunkIndex: integer("chunk_index").notNull(),
    pageFrom: integer("page_from"),
    pageTo: integer("page_to"),
    heading: text("heading"),
    text: text("text").notNull(),
    lang: text("lang").notNull().default("en"),
    tokenCount: integer("token_count"),
    embedding: blob("embedding", { mode: "buffer" }),
    embeddingModel: text("embedding_model"),
  },
  (t) => [index("chunks_document_idx").on(t.documentId)]
);

export const documentTables = sqliteTable("document_tables", {
  id: id(),
  documentId: text("document_id").notNull(),
  page: integer("page"),
  caption: text("caption"),
  columnsJson: text("columns_json"),
  rowsJson: text("rows_json"),
  promotedIndicatorId: text("promoted_indicator_id"),
});

export const collections = sqliteTable("collections", {
  id: id(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  coverStyle: text("cover_style").notNull().default("maroon-weave"),
  ownerUserId: text("owner_user_id"),
  departmentId: text("department_id"),
  visibility: text("visibility").notNull().default("all"),
  isFeatured: integer("is_featured").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const collectionItems = sqliteTable(
  "collection_items",
  {
    id: id(),
    collectionId: text("collection_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    sort: integer("sort").notNull().default(0),
    addedBy: text("added_by"),
    createdAt: createdAt(),
  },
  (t) => [index("collection_items_cidx").on(t.collectionId)]
);

export const relations = sqliteTable(
  "relations",
  {
    id: id(),
    fromType: text("from_type").notNull(),
    fromId: text("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: text("to_id").notNull(),
    relation: text("relation").notNull(),
    source: text("source").notNull().default("human"),
    confidence: real("confidence"),
    createdAt: createdAt(),
  },
  (t) => [
    index("relations_from_idx").on(t.fromType, t.fromId),
    index("relations_to_idx").on(t.toType, t.toId),
  ]
);

export const reviews = sqliteTable("reviews", {
  id: id(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  reviewerId: text("reviewer_id").notNull(),
  decision: text("decision").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* 7.4 Living Strategy                                                 */
/* ------------------------------------------------------------------ */

export const strategyEditions = sqliteTable("strategy_editions", {
  id: id(),
  code: text("code").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  periodFrom: integer("period_from").notNull(),
  periodTo: integer("period_to").notNull(),
  status: text("status").notNull().default("live"),
  summaryEn: text("summary_en"),
  summaryAr: text("summary_ar"),
  sourceDocumentId: text("source_document_id"),
  isDefault: integer("is_default").notNull().default(0),
});

export const strategyNodes = sqliteTable(
  "strategy_nodes",
  {
    id: id(),
    editionId: text("edition_id").notNull(),
    parentId: text("parent_id"),
    nodeType: text("node_type").notNull(),
    code: text("code"),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    ownerUserId: text("owner_user_id"),
    ownerEntityName: text("owner_entity_name"),
    status: text("status").notNull().default("not_started"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    budgetQar: real("budget_qar"),
    fundingSource: text("funding_source"),
    sort: integer("sort").notNull().default(0),
    sourceRef: text("source_ref"),
    verified: integer("verified").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("nodes_edition_idx").on(t.editionId),
    index("nodes_parent_idx").on(t.parentId),
  ]
);

export const kpis = sqliteTable(
  "kpis",
  {
    id: id(),
    nodeId: text("node_id").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    unit: text("unit"),
    direction: text("direction").notNull().default("up_good"),
    baselineValue: real("baseline_value"),
    baselineYear: integer("baseline_year"),
    targetValue: real("target_value"),
    targetYear: integer("target_year"),
    frequency: text("frequency").notNull().default("annual"),
    indicatorId: text("indicator_id"),
    ownerUserId: text("owner_user_id"),
    methodologyEn: text("methodology_en"),
    methodologyAr: text("methodology_ar"),
  },
  (t) => [index("kpis_node_idx").on(t.nodeId)]
);

export const kpiValues = sqliteTable(
  "kpi_values",
  {
    id: id(),
    kpiId: text("kpi_id").notNull(),
    period: text("period").notNull(),
    actualValue: real("actual_value"),
    targetForPeriod: real("target_for_period"),
    sourceDocumentId: text("source_document_id"),
    note: text("note"),
    enteredBy: text("entered_by"),
    createdAt: createdAt(),
  },
  (t) => [index("kpi_values_kpi_idx").on(t.kpiId)]
);

export const statusUpdates = sqliteTable(
  "status_updates",
  {
    id: id(),
    nodeId: text("node_id").notNull(),
    authorId: text("author_id").notNull(),
    status: text("status").notNull(),
    progressPct: integer("progress_pct").notNull().default(0),
    summaryEn: text("summary_en"),
    summaryAr: text("summary_ar"),
    risksJson: text("risks_json"),
    nextStepsJson: text("next_steps_json"),
    evidenceDocumentIdsJson: text("evidence_document_ids_json"),
    period: text("period"),
    createdAt: createdAt(),
  },
  (t) => [index("status_updates_node_idx").on(t.nodeId)]
);

export const nodeDependencies = sqliteTable("node_dependencies", {
  id: id(),
  nodeId: text("node_id").notNull(),
  dependsOnNodeId: text("depends_on_node_id").notNull(),
  note: text("note"),
});

export const nodeLineage = sqliteTable("node_lineage", {
  id: id(),
  fromNodeId: text("from_node_id").notNull(),
  toNodeId: text("to_node_id").notNull(),
  relation: text("relation").notNull(),
  noteEn: text("note_en"),
  noteAr: text("note_ar"),
});

/* ------------------------------------------------------------------ */
/* CR05 2: responsible entities and node leads                         */
/* ------------------------------------------------------------------ */

export const entities = sqliteTable("entities", {
  id: id(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  shortNameEn: text("short_name_en"),
  shortNameAr: text("short_name_ar"),
  // ministry | agency | authority | company | international | other
  kind: text("kind").notNull().default("ministry"),
  logoPath: text("logo_path"),
  website: text("website"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  isActive: integer("is_active").notNull().default(1),
  // Arabic names generated during the owner_entity_name migration are flagged
  nameArMachine: integer("name_ar_machine").notNull().default(0),
  mergedIntoId: text("merged_into_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const nodeLeads = sqliteTable(
  "node_leads",
  {
    id: id(),
    nodeId: text("node_id").notNull(),
    leadKind: text("lead_kind").notNull(), // department | entity
    departmentId: text("department_id"),
    entityId: text("entity_id"),
    role: text("role").notNull().default("lead"), // lead | supporting
    sort: integer("sort").notNull().default(0),
    verified: integer("verified").notNull().default(0),
    // CR07 2.3: nds = strategy_nodes, council = council_nodes
    nodeKind: text("node_kind").notNull().default("nds"),
    createdAt: createdAt(),
  },
  (t) => [
    index("node_leads_node_idx").on(t.nodeId),
    index("node_leads_entity_idx").on(t.entityId),
    index("node_leads_department_idx").on(t.departmentId),
  ]
);

/* ------------------------------------------------------------------ */
/* CR05 3: stakeholders on projects and initiatives                    */
/* ------------------------------------------------------------------ */

export const nodeStakeholders = sqliteTable(
  "node_stakeholders",
  {
    id: id(),
    nodeId: text("node_id").notNull(),
    personKind: text("person_kind").notNull().default("employee"), // employee | expert | external_contact
    userId: text("user_id"),
    expertId: text("expert_id"),
    nameEn: text("name_en"),
    nameAr: text("name_ar"),
    organisation: text("organisation"),
    email: text("email"),
    // sponsor | owner | manager | team | expert | external_partner
    role: text("role").notNull().default("team"),
    roleNoteEn: text("role_note_en"),
    roleNoteAr: text("role_note_ar"),
    domainTermId: text("domain_term_id"),
    sinceDate: text("since_date"),
    untilDate: text("until_date"),
    sort: integer("sort").notNull().default(0),
    // CR07 2.3: nds = strategy_nodes, council = council_nodes
    nodeKind: text("node_kind").notNull().default("nds"),
    createdAt: createdAt(),
  },
  (t) => [
    index("node_stakeholders_node_idx").on(t.nodeId),
    index("node_stakeholders_user_idx").on(t.userId),
    index("node_stakeholders_expert_idx").on(t.expertId),
  ]
);

/* ------------------------------------------------------------------ */
/* CR05 4: International Indices                                       */
/* ------------------------------------------------------------------ */

export const indices = sqliteTable(
  "indices",
  {
    id: id(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    publisher: text("publisher"),
    publisherUrl: text("publisher_url"),
    methodologySummaryEn: text("methodology_summary_en"),
    methodologySummaryAr: text("methodology_summary_ar"),
    scale: text("scale").notNull().default("both"), // rank | score | both
    scoreMin: real("score_min"),
    scoreMax: real("score_max"),
    higherIsBetter: integer("higher_is_better").notNull().default(1),
    frequency: text("frequency").notNull().default("annual"),
    latestYear: integer("latest_year"),
    responsibleEntityId: text("responsible_entity_id"),
    linkedNodeIdsJson: text("linked_node_ids_json"),
    // economy | governance | society | environment | technology | human
    category: text("category").notNull().default("economy"),
    isActive: integer("is_active").notNull().default(1),
    sourceNotes: text("source_notes"),
    /* CR08 4.1: an SDG goal record carries its number; a national indicator
       reads its values from a Statistics Hub series and carries a target */
    sdgGoal: integer("sdg_goal"),
    linkedStatisticsIndicatorId: text("linked_statistics_indicator_id"),
    targetValue: real("target_value"),
    targetYear: integer("target_year"),
    // rank | score | target_gap, decided per index when null
    forecastMode: text("forecast_mode"),
    forecastEnabled: integer("forecast_enabled").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("indices_code_idx").on(t.code)]
);

export const indexObservations = sqliteTable(
  "index_observations",
  {
    id: id(),
    indexId: text("index_id").notNull(),
    countryCode: text("country_code").notNull(), // ISO3
    year: integer("year").notNull(),
    rank: integer("rank"),
    score: real("score"),
    totalCountries: integer("total_countries"),
    sourceUrl: text("source_url"),
    fetchedAt: text("fetched_at"),
    status: text("status").notNull().default("fetched"), // fetched | manual | verified
  },
  (t) => [
    uniqueIndex("index_obs_unique").on(t.indexId, t.countryCode, t.year),
    index("index_obs_index_idx").on(t.indexId),
  ]
);

export const indexPillars = sqliteTable(
  "index_pillars",
  {
    id: id(),
    indexId: text("index_id").notNull(),
    pillarCode: text("pillar_code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("index_pillars_index_idx").on(t.indexId)]
);

export const indexPillarValues = sqliteTable(
  "index_pillar_values",
  {
    id: id(),
    indexId: text("index_id").notNull(),
    pillarCode: text("pillar_code").notNull(),
    countryCode: text("country_code").notNull(),
    year: integer("year").notNull(),
    rank: integer("rank"),
    score: real("score"),
    sourceUrl: text("source_url"),
  },
  (t) => [
    uniqueIndex("index_pillar_values_unique").on(
      t.indexId,
      t.pillarCode,
      t.countryCode,
      t.year
    ),
  ]
);

export const countries = sqliteTable("countries", {
  iso3: text("iso3").primaryKey(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  region: text("region").notNull().default("other"), // GCC | MENA | G20 | OECD | other
});

export const peerGroups = sqliteTable("peer_groups", {
  id: id(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  countryCodesJson: text("country_codes_json").notNull(),
  isDefault: integer("is_default").notNull().default(0),
  ownerUserId: text("owner_user_id"), // null = shared preset
  createdAt: createdAt(),
});

export const indexForecasts = sqliteTable(
  "index_forecasts",
  {
    id: id(),
    indexId: text("index_id").notNull(),
    generatedAt: text("generated_at").notNull(),
    horizonYears: integer("horizon_years").notNull(), // 1 | 3 | 5
    centralRank: real("central_rank"),
    centralScore: real("central_score"),
    low: real("low"),
    high: real("high"),
    rankLow: real("rank_low"),
    rankHigh: real("rank_high"),
    direction: text("direction").notNull().default("stable"), // up | down | stable
    methodVersion: text("method_version").notNull().default("v1"),
    assumptionsJson: text("assumptions_json"),
    inputsJson: text("inputs_json"),
    simulationSummaryJson: text("simulation_summary_json"),
    explanationEn: text("explanation_en"),
    explanationAr: text("explanation_ar"),
    status: text("status").notNull().default("current"), // current | superseded
  },
  (t) => [index("index_forecasts_index_idx").on(t.indexId, t.status)]
);

export const indexForecastAssumptions = sqliteTable(
  "index_forecast_assumptions",
  {
    id: id(),
    indexId: text("index_id"), // null = the global defaults
    key: text("key").notNull(),
    value: real("value").notNull(),
    min: real("min").notNull(),
    max: real("max").notNull(),
    step: real("step").notNull().default(0.1),
    labelEn: text("label_en").notNull(),
    labelAr: text("label_ar").notNull(),
    editableBy: text("editable_by").notNull().default("user_whatif"), // admin | user_whatif
  },
  (t) => [index("index_assumptions_index_idx").on(t.indexId)]
);

/* ------------------------------------------------------------------ */
/* CR05 5: HR Knowledge Dashboard                                      */
/* ------------------------------------------------------------------ */

export const employeeStatus = sqliteTable("employee_status", {
  userId: text("user_id").primaryKey(),
  status: text("status").notNull().default("active"), // active | leaving | transferring | long_leave
  effectiveDate: text("effective_date"),
  targetDepartmentId: text("target_department_id"),
  note: text("note"),
  setBy: text("set_by"),
  setAt: text("set_at").notNull(),
});

export const ownershipBackups = sqliteTable(
  "ownership_backups",
  {
    id: id(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    backupUserId: text("backup_user_id").notNull(),
    setBy: text("set_by"),
    setAt: text("set_at").notNull(),
  },
  (t) => [
    uniqueIndex("ownership_backups_unique").on(t.resourceType, t.resourceId),
    index("ownership_backups_user_idx").on(t.backupUserId),
  ]
);

export const handovers = sqliteTable(
  "handovers",
  {
    id: id(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull().default("leaving"), // leaving | transferring | leave
    createdBy: text("created_by"),
    createdAt: createdAt(),
    dueDate: text("due_date"),
    successorDefaultUserId: text("successor_default_user_id"),
    status: text("status").notNull().default("open"), // open | in_progress | complete | overdue
    completionPct: integer("completion_pct").notNull().default(0),
    completedAt: text("completed_at"),
    /* CR08 6.5: the rebuilt handover */
    personKind: text("person_kind").notNull().default("employee"), // employee | external
    expertId: text("expert_id"),
    externalName: text("external_name"),
    externalEmail: text("external_email"),
    reason: text("reason"),
    lastWorkingDay: text("last_working_day"),
    notes: text("notes"),
    accessTokenHash: text("access_token_hash"),
    accessExpiresAt: text("access_expires_at"),
    accessRevokedAt: text("access_revoked_at"),
    cutOffAt: text("cut_off_at"),
    cutOffBy: text("cut_off_by"),
    reportDocumentId: text("report_document_id"),
    overrideReason: text("override_reason"),
    overrideBy: text("override_by"),
    interviewRequired: integer("interview_required").notNull().default(1),
    updatedAt: text("updated_at"),
  },
  (t) => [index("handovers_user_idx").on(t.userId)]
);

export const handoverItems = sqliteTable(
  "handover_items",
  {
    id: id(),
    handoverId: text("handover_id").notNull(),
    // document | node_owner | node_role | indicator | lesson | expert_request |
    // collection | community_lead | tacit_topic
    itemKind: text("item_kind").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    title: text("title").notNull(),
    successorUserId: text("successor_user_id"),
    status: text("status").notNull().default("pending"), // pending | reassigned | captured | not_needed
    note: text("note"),
    doneAt: text("done_at"),
    /* CR08 6.3: the recipient decision per item */
    recipientKind: text("recipient_kind"), // person | system
    recipientUserId: text("recipient_user_id"),
    category: text("category"),
    inScope: integer("in_scope").notNull().default(1),
    filingProposalJson: text("filing_proposal_json"),
    filingStatus: text("filing_status").notNull().default("none"), // none | proposed | approved | applied
    understoodAt: text("understood_at"),
    addedBy: text("added_by"),
    createdAt: text("created_at"),
  },
  (t) => [index("handover_items_h_idx").on(t.handoverId)]
);

export const handoverInterviews = sqliteTable(
  "handover_interviews",
  {
    id: id(),
    handoverId: text("handover_id").notNull(),
    topic: text("topic").notNull(),
    topicRefType: text("topic_ref_type"),
    topicRefId: text("topic_ref_id"),
    // [{ role: "ai" | "person", text, at }]
    transcriptJson: text("transcript_json"),
    // { status, decisions, contacts, pitfalls, locations, summary_en, summary_ar }
    structuredJson: text("structured_json"),
    status: text("status").notNull().default("pending"), // pending | in_progress | complete
    insightLessonId: text("insight_lesson_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("handover_interviews_h_idx").on(t.handoverId)]
);

export const handoverLearningPaths = sqliteTable(
  "handover_learning_paths",
  {
    id: id(),
    handoverId: text("handover_id").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    modulesJson: text("modules_json").notNull().default("[]"),
    progressJson: text("progress_json").notNull().default("{}"),
    signedOffAt: text("signed_off_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("handover_paths_unique").on(t.handoverId, t.recipientUserId)]
);

export const knowledgeCaptures = sqliteTable(
  "knowledge_captures",
  {
    id: id(),
    handoverId: text("handover_id").notNull(),
    lessonId: text("lesson_id"),
    documentId: text("document_id"),
    topic: text("topic"),
    createdAt: createdAt(),
  },
  (t) => [index("knowledge_captures_h_idx").on(t.handoverId)]
);

export const hrRisks = sqliteTable(
  "hr_risks",
  {
    id: id(),
    // incomplete_handover | outdated_content | missing_knowledge |
    // overdue_update | single_point_of_failure | no_backup
    kind: text("kind").notNull(),
    severity: text("severity").notNull().default("medium"), // low | medium | high | critical
    departmentId: text("department_id"),
    userId: text("user_id"),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    title: text("title").notNull(),
    detailEn: text("detail_en"),
    detailAr: text("detail_ar"),
    ownerUserId: text("owner_user_id"), // who should act
    detectedAt: text("detected_at").notNull(),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    index("hr_risks_open_idx").on(t.resolvedAt, t.severity),
    index("hr_risks_dept_idx").on(t.departmentId),
  ]
);

/* ------------------------------------------------------------------ */
/* CR05 6: per-user overrides and invitations                          */
/* ------------------------------------------------------------------ */

export const userPermissionOverrides = sqliteTable(
  "user_permission_overrides",
  {
    id: id(),
    userId: text("user_id").notNull(),
    // "portal:<key>" for portal visibility, "<module>:<action>" for module actions
    permissionKey: text("permission_key").notNull(),
    effect: text("effect").notNull().default("grant"), // grant | deny
    reason: text("reason"),
    setBy: text("set_by"),
    setAt: text("set_at").notNull(),
    expiresAt: text("expires_at"),
  },
  (t) => [index("user_overrides_user_idx").on(t.userId)]
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: id(),
    email: text("email").notNull(),
    nameEn: text("name_en"),
    nameAr: text("name_ar"),
    roleId: text("role_id").notNull(),
    departmentId: text("department_id"),
    clearanceLevel: integer("clearance_level").notNull().default(2),
    portalsJson: text("portals_json"),
    token: text("token").notNull(),
    invitedBy: text("invited_by"),
    createdAt: createdAt(),
    expiresAt: text("expires_at").notNull(),
    acceptedAt: text("accepted_at"),
    status: text("status").notNull().default("pending"), // pending | accepted | expired | revoked
  },
  (t) => [uniqueIndex("invitations_token_idx").on(t.token)]
);

/* ------------------------------------------------------------------ */
/* 7.5 Statistics and Indicators                                       */
/* ------------------------------------------------------------------ */

export const indicators = sqliteTable(
  "indicators",
  {
    id: id(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    definitionEn: text("definition_en"),
    definitionAr: text("definition_ar"),
    unit: text("unit"),
    decimals: integer("decimals").notNull().default(0),
    frequency: text("frequency").notNull().default("annual"),
    departmentId: text("department_id"),
    sourceEn: text("source_en"),
    sourceAr: text("source_ar"),
    methodologyEn: text("methodology_en"),
    methodologyAr: text("methodology_ar"),
    categoryTermId: text("category_term_id"),
    classificationLevel: integer("classification_level").notNull().default(1),
    direction: text("direction").notNull().default("up_good"),
    firstPeriod: text("first_period"),
    lastPeriod: text("last_period"),
    isHeadline: integer("is_headline").notNull().default(0),
    publishCalendarJson: text("publish_calendar_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("indicators_code_idx").on(t.code)]
);

export const indicatorDimensions = sqliteTable("indicator_dimensions", {
  id: id(),
  indicatorId: text("indicator_id").notNull(),
  code: text("code").notNull(),
  valuesJson: text("values_json"),
});

export const indicatorValues = sqliteTable(
  "indicator_values",
  {
    id: id(),
    indicatorId: text("indicator_id").notNull(),
    period: text("period").notNull(),
    value: real("value").notNull(),
    dimensionKey: text("dimension_key").notNull().default("total"),
    status: text("status").notNull().default("final"),
    sourceDocumentId: text("source_document_id"),
    note: text("note"),
    enteredBy: text("entered_by"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("indicator_values_unique").on(t.indicatorId, t.period, t.dimensionKey),
    index("indicator_values_ind_idx").on(t.indicatorId),
  ]
);

export const releases = sqliteTable("releases", {
  id: id(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  releaseDate: text("release_date").notNull(),
  indicatorIdsJson: text("indicator_ids_json"),
  documentId: text("document_id"),
  summaryEn: text("summary_en"),
  summaryAr: text("summary_ar"),
});

export const imports = sqliteTable("imports", {
  id: id(),
  indicatorId: text("indicator_id").notNull(),
  documentId: text("document_id"),
  mappingJson: text("mapping_json"),
  rowsImported: integer("rows_imported").notNull().default(0),
  status: text("status").notNull().default("draft"),
  log: text("log"),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* 7.6 Expert Network                                                  */
/* ------------------------------------------------------------------ */

export const experts = sqliteTable(
  "experts",
  {
    id: id(),
    userId: text("user_id"),
    type: text("type").notNull().default("npc_employee"),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    photoPath: text("photo_path"),
    avatarColor: text("avatar_color").notNull().default("gulf"),
    organisationEn: text("organisation_en"),
    organisationAr: text("organisation_ar"),
    positionEn: text("position_en"),
    positionAr: text("position_ar"),
    bioEn: text("bio_en"),
    bioAr: text("bio_ar"),
    email: text("email"),
    phone: text("phone"),
    contactProtocol: text("contact_protocol"),
    nationality: text("nationality"),
    /* CR08 3: the country of an external expert's organisation (ISO 3166-1
       alpha-2); null for NPC staff */
    country: text("country"),
    languagesJson: text("languages_json"),
    yearsExperience: integer("years_experience"),
    educationJson: text("education_json"),
    certificationsJson: text("certifications_json"),
    availability: text("availability").notNull().default("available"),
    clearanceLevel: integer("clearance_level").notNull().default(2),
    ownerUserId: text("owner_user_id"),
    isVerified: integer("is_verified").notNull().default(0),
    visibilityClassification: integer("visibility_classification").notNull().default(2),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("experts_user_idx").on(t.userId)]
);

export const expertDomains = sqliteTable(
  "expert_domains",
  {
    id: id(),
    expertId: text("expert_id").notNull(),
    termId: text("term_id").notNull(),
    level: text("level").notNull().default("practitioner"),
    source: text("source").notNull().default("self"),
    accepted: integer("accepted").notNull().default(1),
  },
  (t) => [index("expert_domains_eidx").on(t.expertId)]
);

export const expertSkills = sqliteTable("expert_skills", {
  id: id(),
  expertId: text("expert_id").notNull(),
  skill: text("skill").notNull(),
  level: text("level").notNull().default("practitioner"),
});

export const expertEngagements = sqliteTable("expert_engagements", {
  id: id(),
  expertId: text("expert_id").notNull(),
  title: text("title").notNull(),
  year: integer("year"),
  role: text("role"),
  departmentId: text("department_id"),
  outcomeEn: text("outcome_en"),
  outcomeAr: text("outcome_ar"),
  rating: integer("rating"),
  linkedDocumentIdsJson: text("linked_document_ids_json"),
  linkedNodeId: text("linked_node_id"),
});

export const expertPublications = sqliteTable("expert_publications", {
  id: id(),
  expertId: text("expert_id").notNull(),
  title: text("title").notNull(),
  year: integer("year"),
  urlOrDocumentId: text("url_or_document_id"),
});

export const endorsements = sqliteTable("endorsements", {
  id: id(),
  expertId: text("expert_id").notNull(),
  endorsedBy: text("endorsed_by").notNull(),
  termId: text("term_id"),
  note: text("note"),
  createdAt: createdAt(),
});

export const expertRequests = sqliteTable("expert_requests", {
  id: id(),
  requesterId: text("requester_id").notNull(),
  expertId: text("expert_id").notNull(),
  questionId: text("question_id"),
  subject: text("subject").notNull(),
  detail: text("detail"),
  status: text("status").notNull().default("open"),
  outcomeNote: text("outcome_note"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* 7.7 Ask NPC                                                         */
/* ------------------------------------------------------------------ */

export const questions = sqliteTable(
  "questions",
  {
    id: id(),
    authorId: text("author_id").notNull(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    bodyEn: text("body_en"),
    bodyAr: text("body_ar"),
    langOriginal: text("lang_original").notNull().default("en"),
    classificationLevel: integer("classification_level").notNull().default(2),
    departmentId: text("department_id"),
    status: text("status").notNull().default("open"),
    aiAnswerId: text("ai_answer_id"),
    verifiedAnswerId: text("verified_answer_id"),
    viewCount: integer("view_count").notNull().default(0),
    followCount: integer("follow_count").notNull().default(0),
    bountyId: text("bounty_id"),
    contextJson: text("context_json"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("questions_status_idx").on(t.status)]
);

export const answers = sqliteTable(
  "answers",
  {
    id: id(),
    questionId: text("question_id").notNull(),
    authorId: text("author_id"),
    isAi: integer("is_ai").notNull().default(0),
    bodyEn: text("body_en"),
    bodyAr: text("body_ar"),
    citationsJson: text("citations_json"),
    confidence: text("confidence"),
    isVerified: integer("is_verified").notNull().default(0),
    verifiedBy: text("verified_by"),
    verifiedAt: text("verified_at"),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("answers_question_idx").on(t.questionId)]
);

export const questionRoutes = sqliteTable("question_routes", {
  id: id(),
  questionId: text("question_id").notNull(),
  expertId: text("expert_id").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("notified"),
  createdAt: createdAt(),
});

export const communities = sqliteTable("communities", {
  id: id(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  termId: text("term_id"),
  leadUserId: text("lead_user_id"),
  coverStyle: text("cover_style").notNull().default("gulf-weave"),
  createdAt: createdAt(),
});

export const communityMembers = sqliteTable("community_members", {
  id: id(),
  communityId: text("community_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull().default("member"),
  createdAt: createdAt(),
});

export const follows = sqliteTable(
  "follows",
  {
    id: id(),
    userId: text("user_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("follows_unique").on(t.userId, t.resourceType, t.resourceId),
  ]
);

export const aiConversations = sqliteTable("ai_conversations", {
  id: id(),
  userId: text("user_id").notNull(),
  title: text("title"),
  contextJson: text("context_json"),
  // CR01 4.4: sharing and long-conversation summaries
  isShared: integer("is_shared").notNull().default(0),
  summary: text("summary"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const aiMessages = sqliteTable(
  "ai_messages",
  {
    id: id(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    citationsJson: text("citations_json"),
    confidence: text("confidence"),
    retrievedChunkIdsJson: text("retrieved_chunk_ids_json"),
    model: text("model"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    // CR01 4.5: the structured answer workspace for this assistant turn
    workspaceJson: text("workspace_json"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_conv_idx").on(t.conversationId)]
);

/* ------------------------------------------------------------------ */
/* 7.8 Lessons and decisions                                           */
/* ------------------------------------------------------------------ */

export const lessons = sqliteTable("lessons", {
  id: id(),
  authorId: text("author_id").notNull(),
  // CR02 3.1: delivery | external | expert | institutional
  category: text("category").notNull().default("institutional"),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  contextEn: text("context_en"),
  contextAr: text("context_ar"),
  learningEn: text("learning_en"),
  learningAr: text("learning_ar"),
  recommendationEn: text("recommendation_en"),
  recommendationAr: text("recommendation_ar"),
  nodeId: text("node_id"),
  documentIdsJson: text("document_ids_json"),
  classificationLevel: integer("classification_level").notNull().default(2),
  status: text("status").notNull().default("draft"),
  reuseCount: integer("reuse_count").notNull().default(0),
  clusterId: text("cluster_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lessonClusters = sqliteTable("lesson_clusters", {
  id: id(),
  labelEn: text("label_en").notNull(),
  labelAr: text("label_ar").notNull(),
  summaryEn: text("summary_en"),
  summaryAr: text("summary_ar"),
  lessonIdsJson: text("lesson_ids_json"),
  generatedAt: text("generated_at"),
});

/* CR04 3.5: private reflection notes and guided Learn sessions */
export const notes = sqliteTable(
  "notes",
  {
    id: id(),
    userId: text("user_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("notes_user_idx").on(t.userId)]
);

export const learnSessions = sqliteTable(
  "learn_sessions",
  {
    id: id(),
    userId: text("user_id").notNull(),
    lessonIdsJson: text("lesson_ids_json").notNull(),
    progressJson: text("progress_json"),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("learn_sessions_user_idx").on(t.userId)]
);

export const decisions = sqliteTable("decisions", {
  id: id(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  decisionEn: text("decision_en"),
  decisionAr: text("decision_ar"),
  rationaleEn: text("rationale_en"),
  rationaleAr: text("rationale_ar"),
  decidedOn: text("decided_on"),
  ownerUserId: text("owner_user_id"),
  nodeId: text("node_id"),
  evidenceDocumentIdsJson: text("evidence_document_ids_json"),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* 7.9 Foresight                                                        */
/* ------------------------------------------------------------------ */

export const signals = sqliteTable(
  "signals",
  {
    id: id(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    source: text("source"),
    impact: text("impact").notNull().default("medium"),
    horizon: text("horizon").notNull().default("mid"),
    nodeIdsJson: text("node_ids_json"),
    documentId: text("document_id"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    // CR01 2.4: the scanning pipeline
    sourceKind: text("source_kind").notNull().default("manual"),
    url: text("url"),
    publisher: text("publisher"),
    publishedAt: text("published_at"),
    signalType: text("signal_type").notNull().default("policy"),
    sentiment: text("sentiment").notNull().default("neutral"),
    confidence: real("confidence"),
    whyItMattersEn: text("why_it_matters_en"),
    whyItMattersAr: text("why_it_matters_ar"),
    triageStatus: text("triage_status").notNull().default("new"),
    triagedBy: text("triaged_by"),
    triagedAt: text("triaged_at"),
    convertedResourceType: text("converted_resource_type"),
    convertedResourceId: text("converted_resource_id"),
    scanRunId: text("scan_run_id"),
    rawJson: text("raw_json"),
    sourceExcerpt: text("source_excerpt"),
    embedding: blob("embedding", { mode: "buffer" }),
    embeddingModel: text("embedding_model"),
  },
  (t) => [
    index("signals_triage_idx").on(t.triageStatus),
    index("signals_published_idx").on(t.publishedAt),
  ]
);

/* CR01 2.4: scan briefs, feeds, runs, and signal links */

export const scanBriefs = sqliteTable("scan_briefs", {
  id: id(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  queryEn: text("query_en").notNull(),
  queryAr: text("query_ar"),
  nodeIdsJson: text("node_ids_json"),
  indicatorIdsJson: text("indicator_ids_json"),
  isActive: integer("is_active").notNull().default(1),
  lastRunAt: text("last_run_at"),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

export const feeds = sqliteTable("feeds", {
  id: id(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  kind: text("kind").notNull().default("rss"),
  isActive: integer("is_active").notNull().default(1),
  lastFetchedAt: text("last_fetched_at"),
  lastError: text("last_error"),
  createdAt: createdAt(),
});

export const scanRuns = sqliteTable("scan_runs", {
  id: id(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull().default("running"),
  trigger: text("trigger").notNull().default("scheduled"),
  briefsRun: integer("briefs_run").notNull().default(0),
  candidates: integer("candidates").notNull().default(0),
  acceptedNew: integer("accepted_new").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  errorsJson: text("errors_json"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
});

export const signalLinks = sqliteTable(
  "signal_links",
  {
    id: id(),
    signalId: text("signal_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    relation: text("relation").notNull().default("about"),
    source: text("source").notNull().default("ai"),
    // CR07 2.3: nds = strategy_nodes, council = council_nodes
    nodeKind: text("node_kind").notNull().default("nds"),
    createdAt: createdAt(),
  },
  (t) => [
    index("signal_links_signal_idx").on(t.signalId),
    index("signal_links_resource_idx").on(t.resourceType, t.resourceId),
  ]
);

export const risks = sqliteTable("risks", {
  id: id(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  likelihood: integer("likelihood").notNull().default(3),
  impact: integer("impact").notNull().default(3),
  ownerUserId: text("owner_user_id"),
  nodeId: text("node_id"),
  mitigationEn: text("mitigation_en"),
  mitigationAr: text("mitigation_ar"),
  status: text("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const indexRankings = sqliteTable("index_rankings", {
  id: id(),
  indexNameEn: text("index_name_en").notNull(),
  indexNameAr: text("index_name_ar").notNull(),
  publisher: text("publisher"),
  year: integer("year"),
  rank: integer("rank"),
  score: real("score"),
  totalCountries: integer("total_countries"),
  responsibleEntity: text("responsible_entity"),
  sourceUrl: text("source_url"),
  note: text("note"),
});

/* ------------------------------------------------------------------ */
/* CR02: deliverables, podcast, reports                                 */
/* ------------------------------------------------------------------ */

/* CR02 2.3: deliverable metadata over Vault documents */
export const deliverableMeta = sqliteTable(
  "deliverable_meta",
  {
    id: id(),
    documentId: text("document_id").notNull(),
    nodeId: text("node_id").notNull(),
    deliverableCode: text("deliverable_code").notNull(),
    milestone: text("milestone"),
    dueDate: text("due_date"),
    deliveredDate: text("delivered_date"),
    acceptanceStatus: text("acceptance_status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("deliverable_meta_node_idx").on(t.nodeId),
    index("deliverable_meta_doc_idx").on(t.documentId),
  ]
);

/* CR02 4.6: NPC Knowledge Cast (renamed by CR04 4.1) */
export const podcastEpisodes = sqliteTable(
  "podcast_episodes",
  {
    id: id(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    language: text("language").notNull().default("en"),
    focus: text("focus").notNull().default("overview"),
    sourceScopeJson: text("source_scope_json"),
    scriptJson: text("script_json"),
    audioPath: text("audio_path"),
    audioProvider: text("audio_provider").notNull().default("browser"),
    durationSec: integer("duration_sec").notNull().default(0),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by"),
    classificationLevel: integer("classification_level").notNull().default(2),
    listens: integer("listens").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("podcast_episodes_status_idx").on(t.status)]
);

export const podcastListens = sqliteTable(
  "podcast_listens",
  {
    id: id(),
    episodeId: text("episode_id").notNull(),
    userId: text("user_id").notNull(),
    secondsListened: integer("seconds_listened").notNull().default(0),
    completed: integer("completed").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("podcast_listens_unique").on(t.episodeId, t.userId)]
);

/* CR02 7: extracted Word reports */
export const reports = sqliteTable(
  "reports",
  {
    id: id(),
    title: text("title").notNull(),
    scopeJson: text("scope_json").notNull(),
    optionsJson: text("options_json"),
    audience: text("audience").notNull().default("working"),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("queued"),
    filePath: text("file_path"),
    narrativeJson: text("narrative_json"),
    error: text("error"),
    vaultDocumentId: text("vault_document_id"),
    classificationLevel: integer("classification_level").notNull().default(2),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    finishedAt: text("finished_at"),
    /* CR08 5.4: the Reports module. The CR02 extract reports keep the columns
       above; module reports fill these and use the draft | in_review |
       approved | published lifecycle in `status`. */
    typeId: text("type_id"),
    titleEn: text("title_en"),
    titleAr: text("title_ar"),
    periodJson: text("period_json"),
    languageMode: text("language_mode"), // en | ar | both
    sectionsJson: text("sections_json"),
    requestedBy: text("requested_by"),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    publishedDocumentId: text("published_document_id"),
    publishedAt: text("published_at"),
    docxPath: text("docx_path"),
    previewImagesJson: text("preview_images_json"),
    version: integer("version").notNull().default(1),
    progressJson: text("progress_json"),
    updatedAt: text("updated_at"),
  },
  (t) => [
    index("reports_user_idx").on(t.createdBy),
    index("reports_type_idx").on(t.typeId),
    index("reports_status_idx").on(t.status),
  ]
);

export const reportTypes = sqliteTable(
  "report_types",
  {
    id: id(),
    code: text("code").notNull(),
    family: text("family").notNull().default("internal"), // public | internal | custom
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    defaultSectionsJson: text("default_sections_json").notNull().default("[]"),
    optionalSectionsJson: text("optional_sections_json").notNull().default("[]"),
    scopeKind: text("scope_kind").notNull().default("npc"), // npc | outcome | department | project | period
    classificationDefault: integer("classification_default").notNull().default(2),
    audienceDefault: text("audience_default").notNull().default("working"),
    cadence: text("cadence"),
    sort: integer("sort").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
  },
  (t) => [uniqueIndex("report_types_code").on(t.code)]
);

export const reportSections = sqliteTable(
  "report_sections",
  {
    id: id(),
    reportId: text("report_id").notNull(),
    sectionCode: text("section_code").notNull(),
    sort: integer("sort").notNull().default(0),
    contentJson: text("content_json"),
    status: text("status").notNull().default("pending"), // pending | generating | ready | edited | failed
    commentsJson: text("comments_json"),
    error: text("error"),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("report_sections_report_idx").on(t.reportId),
    uniqueIndex("report_sections_unique").on(t.reportId, t.sectionCode),
  ]
);

export const reportVersions = sqliteTable(
  "report_versions",
  {
    id: id(),
    reportId: text("report_id").notNull(),
    version: integer("version").notNull(),
    docxPath: text("docx_path"),
    snapshotJson: text("snapshot_json"),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [index("report_versions_report_idx").on(t.reportId)]
);

/* ------------------------------------------------------------------ */
/* 7.10 Gamification                                                   */
/* ------------------------------------------------------------------ */

export const gameEvents = sqliteTable(
  "game_events",
  {
    id: id(),
    userId: text("user_id").notNull(),
    eventType: text("event_type").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    points: integer("points").notNull().default(0),
    multiplier: real("multiplier").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    index("game_events_user_idx").on(t.userId),
    index("game_events_type_idx").on(t.userId, t.eventType),
  ]
);

export const userGameState = sqliteTable("user_game_state", {
  userId: text("user_id").primaryKey(),
  totalPoints: integer("total_points").notNull().default(0),
  levelId: text("level_id"),
  dailyStreak: integer("daily_streak").notNull().default(0),
  weeklyStreak: integer("weekly_streak").notNull().default(0),
  streakFreezes: integer("streak_freezes").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  lastContributionWeek: text("last_contribution_week"),
  breadthJson: text("breadth_json"),
  quizStreak: integer("quiz_streak").notNull().default(0),
  contributionCount: integer("contribution_count").notNull().default(0),
  updatedAt: updatedAt(),
});

export const levels = sqliteTable("levels", {
  id: id(),
  order: integer("order_no").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  minPoints: integer("min_points").notNull(),
  unlocksJson: text("unlocks_json"),
  /* CR08 7.1: the numeric levels carry a short descriptor for hover and profile */
  descriptorEn: text("descriptor_en"),
  descriptorAr: text("descriptor_ar"),
});

/* CR08 7.2: the leaderboard is materialised every ten minutes, never
   computed from the events ledger on page load */
export const leaderboardPeriods = sqliteTable(
  "leaderboard_periods",
  {
    id: id(),
    board: text("board").notNull(), // people | departments
    category: text("category").notNull(), // overall | contributors | guardians | learners
    periodKind: text("period_kind").notNull(), // week | month | quarter | year | all
    periodKey: text("period_key").notNull(),
    subjectId: text("subject_id").notNull(),
    points: integer("points").notNull().default(0),
    rank: integer("rank").notNull().default(0),
    previousPoints: integer("previous_points").notNull().default(0),
    previousRank: integer("previous_rank"),
    members: integer("members"),
    activeMembers: integer("active_members"),
    refreshedAt: text("refreshed_at").notNull(),
  },
  (t) => [
    uniqueIndex("leaderboard_periods_unique").on(
      t.board,
      t.category,
      t.periodKind,
      t.periodKey,
      t.subjectId
    ),
    index("leaderboard_periods_lookup").on(t.board, t.category, t.periodKind, t.periodKey, t.rank),
  ]
);

export const badges = sqliteTable("badges", {
  id: id(),
  code: text("code").notNull(),
  family: text("family").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  criteriaJson: text("criteria_json"),
  icon: text("icon"),
  tier: text("tier"),
});

export const userBadges = sqliteTable(
  "user_badges",
  {
    id: id(),
    userId: text("user_id").notNull(),
    badgeId: text("badge_id").notNull(),
    awardedAt: text("awarded_at").notNull(),
  },
  (t) => [uniqueIndex("user_badges_unique").on(t.userId, t.badgeId)]
);

export const bounties = sqliteTable("bounties", {
  id: id(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  source: text("source").notNull().default("manual"),
  points: integer("points").notNull().default(80),
  termId: text("term_id"),
  nodeId: text("node_id"),
  status: text("status").notNull().default("open"),
  postedBy: text("posted_by"),
  fulfilledBy: text("fulfilled_by"),
  fulfilledResourceType: text("fulfilled_resource_type"),
  fulfilledResourceId: text("fulfilled_resource_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const gameRules = sqliteTable("game_rules", {
  id: id(),
  eventType: text("event_type").notNull(),
  points: integer("points").notNull(),
  multiplierRulesJson: text("multiplier_rules_json"),
  isActive: integer("is_active").notNull().default(1),
  /* CR08 7.2: admin-duty actions count for the person but not the boards */
  excludedFromBoards: integer("excluded_from_boards").notNull().default(0),
});

export const dailyCards = sqliteTable(
  "daily_cards",
  {
    id: id(),
    date: text("date").notNull(),
    indicatorId: text("indicator_id"),
    factEn: text("fact_en").notNull(),
    factAr: text("fact_ar").notNull(),
    hookEn: text("hook_en"),
    hookAr: text("hook_ar"),
    quizQuestionEn: text("quiz_question_en"),
    quizQuestionAr: text("quiz_question_ar"),
    optionsJson: text("options_json"),
    correctIndex: integer("correct_index"),
    explanationEn: text("explanation_en"),
    explanationAr: text("explanation_ar"),
    bigNumber: text("big_number"),
  },
  (t) => [uniqueIndex("daily_cards_date_idx").on(t.date)]
);

export const dailyCardAnswers = sqliteTable(
  "daily_card_answers",
  {
    id: id(),
    userId: text("user_id").notNull(),
    cardId: text("card_id").notNull(),
    chosenIndex: integer("chosen_index").notNull(),
    isCorrect: integer("is_correct").notNull(),
    answeredAt: text("answered_at").notNull(),
  },
  (t) => [uniqueIndex("daily_card_answers_unique").on(t.userId, t.cardId)]
);

export const wordOfDay = sqliteTable("word_of_day", {
  id: id(),
  date: text("date"),
  kind: text("kind").notNull(),
  textEn: text("text_en").notNull(),
  textAr: text("text_ar").notNull(),
  attributionEn: text("attribution_en"),
  attributionAr: text("attribution_ar"),
  sourceRef: text("source_ref"),
});

export const spotlights = sqliteTable("spotlights", {
  id: id(),
  userId: text("user_id").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  blurbEn: text("blurb_en"),
  blurbAr: text("blurb_ar"),
  startsOn: text("starts_on"),
  endsOn: text("ends_on"),
  chosenBy: text("chosen_by"),
});

/* ------------------------------------------------------------------ */
/* 7.11 System                                                          */
/* ------------------------------------------------------------------ */

export const jobs = sqliteTable(
  "jobs",
  {
    id: id(),
    type: text("type").notNull(),
    payloadJson: text("payload_json"),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    runAfter: text("run_after"),
    createdAt: createdAt(),
    finishedAt: text("finished_at"),
  },
  (t) => [index("jobs_status_idx").on(t.status)]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    bodyEn: text("body_en"),
    bodyAr: text("body_ar"),
    link: text("link"),
    readAt: text("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId)]
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
});

export const searchLog = sqliteTable(
  "search_log",
  {
    id: id(),
    userId: text("user_id"),
    query: text("query").notNull(),
    lang: text("lang"),
    intent: text("intent"),
    resultCount: integer("result_count").notNull().default(0),
    clickedResourceType: text("clicked_resource_type"),
    clickedResourceId: text("clicked_resource_id"),
    createdAt: createdAt(),
  },
  (t) => [index("search_log_created_idx").on(t.createdAt)]
);

export const knowledgeGaps = sqliteTable("knowledge_gaps", {
  id: id(),
  labelEn: text("label_en").notNull(),
  labelAr: text("label_ar").notNull(),
  exampleQueriesJson: text("example_queries_json"),
  questionIdsJson: text("question_ids_json"),
  termId: text("term_id"),
  status: text("status").notNull().default("open"),
  bountyId: text("bounty_id"),
  detectedAt: text("detected_at"),
});

export const apiKeys = sqliteTable("api_keys", {
  id: id(),
  name: text("name").notNull(),
  hashedKey: text("hashed_key").notNull(),
  scopesJson: text("scopes_json"),
  isActive: integer("is_active").notNull().default(0),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* CR07 1.2: a lesson links to many strategy nodes, one of them primary */
/* ------------------------------------------------------------------ */

export const lessonNodeLinks = sqliteTable(
  "lesson_node_links",
  {
    id: id(),
    lessonId: text("lesson_id").notNull(),
    nodeId: text("node_id").notNull(),
    // nds = strategy_nodes, council = council_nodes
    nodeKind: text("node_kind").notNull().default("nds"),
    isPrimary: integer("is_primary").notNull().default(0),
    linkedBy: text("linked_by"),
    linkedAt: text("linked_at").notNull(),
  },
  (t) => [
    index("lesson_links_lesson_idx").on(t.lessonId),
    index("lesson_links_node_idx").on(t.nodeId),
    uniqueIndex("lesson_links_unique").on(t.lessonId, t.nodeId, t.nodeKind),
  ]
);

/* ------------------------------------------------------------------ */
/* CR07 2.3: the Council Strategy (NPC's own institutional strategy)   */
/* ------------------------------------------------------------------ */

export const councilStrategies = sqliteTable("council_strategies", {
  id: id(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  visionEn: text("vision_en"),
  visionAr: text("vision_ar"),
  missionEn: text("mission_en"),
  missionAr: text("mission_ar"),
  // [{ name_en, name_ar, description_en, description_ar }]
  valuesJson: text("values_json"),
  status: text("status").notNull().default("live"),
  isDefault: integer("is_default").notNull().default(0),
  approvedOn: text("approved_on"),
  sourceDocumentId: text("source_document_id"),
  ownerUnitId: text("owner_unit_id"),
  isIllustrative: integer("is_illustrative").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const councilAnalysis = sqliteTable(
  "council_analysis",
  {
    id: id(),
    strategyId: text("strategy_id").notNull(),
    // swot | stakeholder | challenge | baseline
    kind: text("kind").notNull(),
    payloadJson: text("payload_json").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("council_analysis_strategy_idx").on(t.strategyId)]
);

export const councilNodes = sqliteTable(
  "council_nodes",
  {
    id: id(),
    strategyId: text("strategy_id").notNull(),
    parentId: text("parent_id"),
    // goal | intermediate_outcome | output | project | activity
    level: text("level").notNull(),
    code: text("code"),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    // goals, intermediate outcomes and outputs are owned by a unit
    ownerUnitId: text("owner_unit_id"),
    // projects and activities are owned by a person
    ownerUserId: text("owner_user_id"),
    status: text("status").notNull().default("not_started"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    budgetQar: real("budget_qar"),
    // { people: n, systems: [..], budget_note_en, budget_note_ar }
    inputsJson: text("inputs_json"),
    priorityImpact: integer("priority_impact"),
    priorityFeasibility: integer("priority_feasibility"),
    sort: integer("sort").notNull().default(0),
    sourceRef: text("source_ref"),
    isIllustrative: integer("is_illustrative").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("council_nodes_strategy_idx").on(t.strategyId),
    index("council_nodes_parent_idx").on(t.parentId),
    index("council_nodes_level_idx").on(t.level),
  ]
);

export const councilIndicators = sqliteTable(
  "council_indicators",
  {
    id: id(),
    nodeId: text("node_id").notNull(),
    code: text("code"),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    definitionEn: text("definition_en"),
    definitionAr: text("definition_ar"),
    formulaEn: text("formula_en"),
    formulaAr: text("formula_ar"),
    unit: text("unit"),
    direction: text("direction").notNull().default("up_good"),
    baselineYear: text("baseline_year"),
    baselineValue: real("baseline_value"),
    // monthly | quarterly | yearly
    frequency: text("frequency").notNull().default("yearly"),
    dataSourceEn: text("data_source_en"),
    dataSourceAr: text("data_source_ar"),
    meansOfVerificationEn: text("means_of_verification_en"),
    meansOfVerificationAr: text("means_of_verification_ar"),
    responsibleUserId: text("responsible_user_id"),
    linkedStatisticsIndicatorId: text("linked_statistics_indicator_id"),
    notesEn: text("notes_en"),
    notesAr: text("notes_ar"),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("council_indicators_node_idx").on(t.nodeId)]
);

export const councilIndicatorTargets = sqliteTable(
  "council_indicator_targets",
  {
    id: id(),
    indicatorId: text("indicator_id").notNull(),
    // 2026 | 2026-Q3 | 2026-07
    period: text("period").notNull(),
    targetValue: real("target_value"),
  },
  (t) => [uniqueIndex("council_targets_unique").on(t.indicatorId, t.period)]
);

export const councilIndicatorValues = sqliteTable(
  "council_indicator_values",
  {
    id: id(),
    indicatorId: text("indicator_id").notNull(),
    period: text("period").notNull(),
    actualValue: real("actual_value"),
    status: text("status").notNull().default("provisional"),
    sourceDocumentId: text("source_document_id"),
    enteredBy: text("entered_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("council_values_unique").on(t.indicatorId, t.period)]
);

export const councilMilestones = sqliteTable(
  "council_milestones",
  {
    id: id(),
    nodeId: text("node_id").notNull(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    dueDate: text("due_date"),
    doneDate: text("done_date"),
    status: text("status").notNull().default("planned"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("council_milestones_node_idx").on(t.nodeId)]
);

export const councilDependencies = sqliteTable(
  "council_dependencies",
  {
    id: id(),
    nodeId: text("node_id").notNull(),
    dependsOnNodeId: text("depends_on_node_id").notNull(),
    noteEn: text("note_en"),
    noteAr: text("note_ar"),
  },
  (t) => [index("council_dependencies_node_idx").on(t.nodeId)]
);

export const councilRisks = sqliteTable(
  "council_risks",
  {
    id: id(),
    strategyId: text("strategy_id").notNull(),
    nodeId: text("node_id"),
    code: text("code"),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    likelihood: integer("likelihood").notNull().default(3),
    impact: integer("impact").notNull().default(3),
    ownerUserId: text("owner_user_id"),
    mitigationEn: text("mitigation_en"),
    mitigationAr: text("mitigation_ar"),
    // open | mitigating | closed
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("council_risks_strategy_idx").on(t.strategyId)]
);

export const councilGovernance = sqliteTable("council_governance", {
  id: id(),
  strategyId: text("strategy_id").notNull(),
  bodyNameEn: text("body_name_en").notNull(),
  bodyNameAr: text("body_name_ar").notNull(),
  roleEn: text("role_en"),
  roleAr: text("role_ar"),
  cadence: text("cadence"),
  membersJson: text("members_json"),
  sort: integer("sort").notNull().default(0),
});

export const councilAlignment = sqliteTable(
  "council_alignment",
  {
    id: id(),
    councilNodeId: text("council_node_id").notNull(),
    // nds_node | nds_kpi | data_strategy_initiative
    targetKind: text("target_kind").notNull().default("nds_node"),
    targetId: text("target_id").notNull(),
    labelEn: text("label_en"),
    labelAr: text("label_ar"),
    noteEn: text("note_en"),
    noteAr: text("note_ar"),
  },
  (t) => [index("council_alignment_node_idx").on(t.councilNodeId)]
);

export const councilChangeLog = sqliteTable(
  "council_change_log",
  {
    id: id(),
    strategyId: text("strategy_id").notNull(),
    entityKind: text("entity_kind").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    detailJson: text("detail_json"),
    actorId: text("actor_id"),
    createdAt: createdAt(),
  },
  (t) => [index("council_change_log_strategy_idx").on(t.strategyId)]
);

/* ------------------------------------------------------------------ */
/* CR08 1.2: organisation levels, snapshots and change requests         */
/* ------------------------------------------------------------------ */

export const orgLevels = sqliteTable(
  "org_levels",
  {
    id: id(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("org_levels_code").on(t.code)]
);

export const orgSnapshots = sqliteTable("org_snapshots", {
  id: id(),
  takenAt: text("taken_at").notNull(),
  takenBy: text("taken_by"),
  treeJson: text("tree_json").notNull(),
  note: text("note"),
});

export const orgChangeRequests = sqliteTable(
  "org_change_requests",
  {
    id: id(),
    unitId: text("unit_id").notNull(),
    requestedBy: text("requested_by").notNull(),
    what: text("what").notNull(),
    why: text("why"),
    status: text("status").notNull().default("open"), // open | resolved | declined
    resolvedBy: text("resolved_by"),
    resolvedAt: text("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("org_change_requests_unit_idx").on(t.unitId)]
);

/* ------------------------------------------------------------------ */
/* CR08 4.1: index groups                                               */
/* ------------------------------------------------------------------ */

export const indexGroups = sqliteTable(
  "index_groups",
  {
    id: id(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    colourToken: text("colour_token").notNull().default("maroon"),
    sort: integer("sort").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
  },
  (t) => [uniqueIndex("index_groups_code").on(t.code)]
);

export const indexGroupMembers = sqliteTable(
  "index_group_members",
  {
    id: id(),
    groupId: text("group_id").notNull(),
    indexId: text("index_id").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    uniqueIndex("index_group_members_unique").on(t.groupId, t.indexId),
    index("index_group_members_index_idx").on(t.indexId),
  ]
);

/* ------------------------------------------------------------------ */
/* CR08 8: Knowledge of the Week                                        */
/* ------------------------------------------------------------------ */

export const knowledgeOfWeek = sqliteTable(
  "knowledge_of_week",
  {
    id: id(),
    weekStart: text("week_start").notNull(),
    resourceType: text("resource_type").notNull(), // document | lesson | study | report
    resourceId: text("resource_id").notNull(),
    contributorUserId: text("contributor_user_id"),
    unitId: text("unit_id"),
    noteEn: text("note_en"),
    noteAr: text("note_ar"),
    setBy: text("set_by"),
    setAt: text("set_at").notNull(),
    status: text("status").notNull().default("scheduled"), // scheduled | active | archived
    readCount: integer("read_count").notNull().default(0),
  },
  (t) => [uniqueIndex("knowledge_of_week_week").on(t.weekStart)]
);

export const knowledgeOfWeekReads = sqliteTable(
  "knowledge_of_week_reads",
  {
    id: id(),
    kowId: text("kow_id").notNull(),
    userId: text("user_id").notNull(),
    readAt: text("read_at").notNull(),
  },
  (t) => [uniqueIndex("kow_reads_unique").on(t.kowId, t.userId)]
);

export const knowledgeOfWeekSeen = sqliteTable(
  "knowledge_of_week_seen",
  {
    id: id(),
    kowId: text("kow_id").notNull(),
    userId: text("user_id").notNull(),
    seenAt: text("seen_at").notNull(),
  },
  (t) => [uniqueIndex("kow_seen_unique").on(t.kowId, t.userId)]
);

/* ------------------------------------------------------------------ */
/* CR08 9.2: in-app messaging                                           */
/* ------------------------------------------------------------------ */

export const messageThreads = sqliteTable(
  "message_threads",
  {
    id: id(),
    subject: text("subject").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    resourceTitle: text("resource_title"),
    resourceLink: text("resource_link"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    lastMessageAt: text("last_message_at").notNull(),
    status: text("status").notNull().default("open"), // open | done
    questionId: text("question_id"),
  },
  (t) => [index("message_threads_last_idx").on(t.lastMessageAt)]
);

export const threadParticipants = sqliteTable(
  "thread_participants",
  {
    id: id(),
    threadId: text("thread_id").notNull(),
    userId: text("user_id").notNull(),
    lastReadAt: text("last_read_at"),
    isDelegateForUserId: text("is_delegate_for_user_id"),
    doneAt: text("done_at"),
  },
  (t) => [
    uniqueIndex("thread_participants_unique").on(t.threadId, t.userId),
    index("thread_participants_user_idx").on(t.userId),
  ]
);

export const messages = sqliteTable(
  "messages",
  {
    id: id(),
    threadId: text("thread_id").notNull(),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    attachmentsJson: text("attachments_json"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_thread_idx").on(t.threadId, t.createdAt)]
);

/* ------------------------------------------------------------------ */
/* CR08 10: the process architecture and the Operating Model           */
/* ------------------------------------------------------------------ */

export const processes = sqliteTable(
  "processes",
  {
    id: id(),
    parentId: text("parent_id"),
    level: integer("level").notNull().default(1), // 0 value chain, 1 process, 2 procedure or SOP
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    purposeEn: text("purpose_en"),
    purposeAr: text("purpose_ar"),
    ownerUnitId: text("owner_unit_id"),
    inputsJson: text("inputs_json"),
    outputsJson: text("outputs_json"),
    stepsJson: text("steps_json"),
    systemsJson: text("systems_json"),
    kpisJson: text("kpis_json"),
    policyDocumentIdsJson: text("policy_document_ids_json"),
    sopDocumentIdsJson: text("sop_document_ids_json"),
    status: text("status").notNull().default("active"),
    sort: integer("sort").notNull().default(0),
    isIllustrative: integer("is_illustrative").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("processes_code").on(t.code),
    index("processes_parent_idx").on(t.parentId),
    index("processes_owner_idx").on(t.ownerUnitId),
  ]
);

export const processRaci = sqliteTable(
  "process_raci",
  {
    id: id(),
    processId: text("process_id").notNull(),
    unitId: text("unit_id").notNull(),
    role: text("role").notNull(), // R | A | C | I
  },
  (t) => [uniqueIndex("process_raci_unique").on(t.processId, t.unitId)]
);

export const operatingPrinciples = sqliteTable("operating_principles", {
  id: id(),
  sort: integer("sort").notNull().default(0),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  textEn: text("text_en"),
  textAr: text("text_ar"),
  isIllustrative: integer("is_illustrative").notNull().default(1),
});

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: id(),
    // strategy_review | budget | statistical_release | nds_review | council_meeting | report_deadline | forum | other
    kind: text("kind").notNull(),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    dateFrom: text("date_from").notNull(),
    dateTo: text("date_to"),
    ownerUnitId: text("owner_unit_id"),
    linkedResourceType: text("linked_resource_type"),
    linkedResourceId: text("linked_resource_id"),
    recurrence: text("recurrence").notNull().default("none"), // none | annual | quarterly | monthly
    isIllustrative: integer("is_illustrative").notNull().default(1),
  },
  (t) => [index("calendar_events_date_idx").on(t.dateFrom)]
);

export const unitInterfaces = sqliteTable(
  "unit_interfaces",
  {
    id: id(),
    fromUnitId: text("from_unit_id").notNull(),
    toUnitId: text("to_unit_id").notNull(),
    flowKind: text("flow_kind").notNull().default("data"), // data | input | approval | review | deliverable
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),
    triggerEn: text("trigger_en"),
    triggerAr: text("trigger_ar"),
    cadence: text("cadence"),
    serviceLevel: text("service_level"),
    processId: text("process_id"),
    focalFromUserId: text("focal_from_user_id"),
    focalToUserId: text("focal_to_user_id"),
    status: text("status").notNull().default("active"),
    isIllustrative: integer("is_illustrative").notNull().default(1),
  },
  (t) => [
    index("unit_interfaces_from_idx").on(t.fromUnitId),
    index("unit_interfaces_to_idx").on(t.toUnitId),
  ]
);

export const entityInterfaces = sqliteTable("entity_interfaces", {
  id: id(),
  entityId: text("entity_id").notNull(),
  providesEn: text("provides_en"),
  providesAr: text("provides_ar"),
  receivesEn: text("receives_en"),
  receivesAr: text("receives_ar"),
  focalNpcUserId: text("focal_npc_user_id"),
  focalEntityName: text("focal_entity_name"),
  legalBasisEn: text("legal_basis_en"),
  legalBasisAr: text("legal_basis_ar"),
  cadence: text("cadence"),
  processIdsJson: text("process_ids_json"),
  isIllustrative: integer("is_illustrative").notNull().default(1),
});

export const interfaceChangeRequests = sqliteTable("interface_change_requests", {
  id: id(),
  interfaceId: text("interface_id"),
  fromUnitId: text("from_unit_id"),
  toUnitId: text("to_unit_id"),
  requestedBy: text("requested_by").notNull(),
  text: text("text").notNull(),
  status: text("status").notNull().default("open"), // open | approved | declined
  resolvedBy: text("resolved_by"),
  resolvedAt: text("resolved_at"),
  createdAt: createdAt(),
});

export const opsKpis = sqliteTable(
  "ops_kpis",
  {
    id: id(),
    code: text("code").notNull(),
    nameEn: text("name_en").notNull(),
    nameAr: text("name_ar").notNull(),
    unit: text("unit"),
    direction: text("direction").notNull().default("up_good"),
    sourceKind: text("source_kind").notNull().default("manual"), // auto | manual
    targetValue: real("target_value"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("ops_kpis_code").on(t.code)]
);

export const opsKpiValues = sqliteTable(
  "ops_kpi_values",
  {
    id: id(),
    kpiId: text("kpi_id").notNull(),
    period: text("period").notNull(),
    value: real("value"),
    enteredBy: text("entered_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ops_kpi_values_unique").on(t.kpiId, t.period)]
);

/* Embeddings for structured records (indicators, nodes, experts, lessons, answers) */
export const searchIndex = sqliteTable(
  "search_index",
  {
    id: id(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    text: text("text").notNull(),
    lang: text("lang").notNull().default("en"),
    // CR01 4.7: edition chip data for strategy rows (nds3|nds2|nds1, else null)
    edition: text("edition"),
    embedding: blob("embedding", { mode: "buffer" }),
    embeddingModel: text("embedding_model"),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("search_index_unique").on(t.resourceType, t.resourceId),
  ]
);
