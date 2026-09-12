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
    positionEn: text("position_en"),
    positionAr: text("position_ar"),
    lastLoginAt: text("last_login_at"),
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
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const departments = sqliteTable("departments", {
  id: id(),
  code: text("code").notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  headUserId: text("head_user_id"),
  parentId: text("parent_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = sqliteTable("sessions", {
  id: id(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
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

/* CR02 4.6: NPC Nexus Podcast */
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
  },
  (t) => [index("reports_user_idx").on(t.createdBy)]
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
});

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
