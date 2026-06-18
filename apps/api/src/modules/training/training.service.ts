import type {
  AccountLookupSummary,
  ContactRelationshipSummary,
  CreateCustomerLearnerRequestBody,
  CreateTrainingAssetRequestBody,
  CreateTrainingAssignmentRequestBody,
  CreateTrainingFeedbackRequestBody,
  CreateTrainingLessonRequestBody,
  CreateTrainingModuleRequestBody,
  CreateTrainingProgramRequestBody,
  CrmLookupUserSummary,
  CrmMutationSuccessResponse,
  CrmOptionValueSummary,
  CrmPagination,
  CustomerLearnerSummary,
  CustomerLearnersResponse,
  MyTrainingResponse,
  RoleSummary,
  TrainingAiPlaceholderSummary,
  TrainingAssetSummary,
  TrainingAssetType,
  TrainingAssigneeType,
  TrainingAssignmentDetail,
  TrainingAssignmentListQuery,
  TrainingAssignmentResponse,
  TrainingAssignmentStatus,
  TrainingAssignmentSummary,
  TrainingAssignmentsResponse,
  TrainingDashboardResponse,
  TrainingLearnerType,
  TrainingLessonSummary,
  TrainingLessonType,
  TrainingModuleSummary,
  TrainingOptionsResponse,
  TrainingProgramDetail,
  TrainingProgramListQuery,
  TrainingProgramResponse,
  TrainingProgramStatus,
  TrainingProgramSummary,
  TrainingProgramsResponse,
  TrainingProgressItem,
  TrainingProgressStatus,
  UpdateTrainingAssignmentRequestBody,
  UpdateTrainingLessonRequestBody,
  UpdateTrainingModuleRequestBody,
  UpdateTrainingProgramRequestBody,
  UpdateTrainingProgressRequestBody
} from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
  roles: RoleSummary[];
}

interface UserLookupRow {
  id: string;
  display_name: string;
  email: string;
  team_name: string | null;
  department_name: string | null;
}

interface OptionValueRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface AccountLookupRow {
  id: string;
  name: string;
  website: string | null;
}

interface ContactLookupRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role_id: string | null;
  role_key: string | null;
  role_label: string | null;
  role_description: string | null;
  role_color: string | null;
  role_is_default: boolean | null;
  role_is_active: boolean | null;
}

const PROGRAM_STATUSES: TrainingProgramStatus[] = ["draft", "published", "archived"];
const LESSON_TYPES: TrainingLessonType[] = ["article", "video", "quiz", "interactive"];
const ASSET_TYPES: TrainingAssetType[] = ["link", "video", "document", "scorm"];
const ASSIGNEE_TYPES: TrainingAssigneeType[] = ["user", "contact", "account"];
const ASSIGNMENT_STATUSES: TrainingAssignmentStatus[] = ["assigned", "in_progress", "completed", "expired"];
const PROGRESS_STATUSES: TrainingProgressStatus[] = ["not_started", "in_progress", "completed"];
const LEARNER_TYPES: TrainingLearnerType[] = ["user", "contact"];

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function getMetadata(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

function getTrimmedNullableString(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFromList<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

function averageOf(values: number[]) {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function mapUser(input: { id: string | null; displayName: string | null; email: string | null; teamName: string | null; departmentName: string | null }): CrmLookupUserSummary | null {
  if (!input.id || !input.displayName || !input.email) {
    return null;
  }
  return { id: input.id, displayName: input.displayName, email: input.email, teamName: input.teamName, departmentName: input.departmentName };
}

function mapOptionValue(input: { id: string | null; key: string | null; label: string | null; description: string | null; color: string | null; isDefault: boolean | null; isActive: boolean | null }): CrmOptionValueSummary | null {
  if (!input.id || !input.key || !input.label) {
    return null;
  }
  return { id: input.id, key: input.key, label: input.label, description: input.description, color: input.color, isDefault: Boolean(input.isDefault), isActive: Boolean(input.isActive) };
}

function mapContact(row: ContactLookupRow): ContactRelationshipSummary {
  return {
    id: row.id,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    role: mapOptionValue({ id: row.role_id, key: row.role_key, label: row.role_label, description: row.role_description, color: row.role_color, isDefault: row.role_is_default, isActive: row.role_is_active })
  };
}

function buildPagination(page: number, pageSize: number, total: number): CrmPagination {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { page, pageSize, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
}

export class TrainingService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Training is unavailable until the database connection is enabled.", undefined, "TRAINING_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure" | "denied" | "error"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, session_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, request_id, metadata) VALUES ($1, $2, $3, 'crm', $4, $5, $6, $7, NULLIF($8, '')::inet, $9, $10, $11::jsonb)`,
      [actor.tenantId, actor.userId, actor.sessionId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress ?? "", audit.userAgent ?? null, audit.requestId, JSON.stringify(input.metadata ?? {})]
    );
  }

  private async loadOwners(client: PoolClient, tenantId: string): Promise<CrmLookupUserSummary[]> {
    const result = await client.query<UserLookupRow>(
      `SELECT users.id, users.display_name, users.email, teams.name AS team_name, departments.name AS department_name FROM users LEFT JOIN teams ON teams.id = users.team_id AND teams.tenant_id = users.tenant_id AND teams.deleted_at IS NULL LEFT JOIN departments ON departments.id = users.department_id AND departments.tenant_id = users.tenant_id AND departments.deleted_at IS NULL WHERE users.tenant_id = $1 AND users.deleted_at IS NULL AND users.status IN ('active', 'invited') ORDER BY users.display_name ASC`,
      [tenantId]
    );
    return result.rows.map((row) => ({ id: row.id, displayName: row.display_name, email: row.email, teamName: row.team_name, departmentName: row.department_name }));
  }

  private async loadOptionSetValues(client: PoolClient, tenantId: string, setKey: string): Promise<CrmOptionValueSummary[]> {
    const result = await client.query<OptionValueRow>(
      `SELECT tenant_option_values.id, tenant_option_values.value_key AS key, tenant_option_values.label, tenant_option_values.description, tenant_option_values.color, tenant_option_values.is_default, tenant_option_values.is_active FROM tenant_option_sets INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL ORDER BY tenant_option_values.sort_order ASC, tenant_option_values.label ASC`,
      [tenantId, setKey]
    );
    return result.rows.map((row) => ({ id: row.id, key: row.key, label: row.label, description: row.description, color: row.color, isDefault: row.is_default, isActive: row.is_active }));
  }

  private async resolveOptionValueId(client: PoolClient, tenantId: string, setKey: string, valueKey: string, label: string) {
    const result = await client.query<{ id: string }>(
      `SELECT tenant_option_values.id FROM tenant_option_sets INNER JOIN tenant_option_values ON tenant_option_values.option_set_id = tenant_option_sets.id AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id WHERE tenant_option_sets.tenant_id = $1 AND tenant_option_sets.set_key = $2 AND tenant_option_sets.deleted_at IS NULL AND tenant_option_values.deleted_at IS NULL AND tenant_option_values.is_active = true AND tenant_option_values.value_key = $3 LIMIT 1`,
      [tenantId, setKey, valueKey.trim()]
    );
    const id = result.rows[0]?.id;
    if (!id) {
      throw new AppError(400, `${label} is invalid for this tenant.`, undefined, "INVALID_OPTION_VALUE");
    }
    return id;
  }

  private async ensureReference(client: PoolClient, tenantId: string, table: "users" | "accounts" | "contacts" | "customer_success_accounts" | "onboarding_plans" | "customer_learners", id: string | null | undefined, code: string, label: string) {
    if (!id) {
      return null;
    }
    const statusClause = table === "users" ? "AND status IN ('active', 'invited')" : "";
    const result = await client.query<{ id: string }>(`SELECT id FROM ${table} WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL ${statusClause} LIMIT 1`, [id, tenantId]);
    const resolvedId = result.rows[0]?.id ?? null;
    if (!resolvedId) {
      throw new AppError(400, `The selected ${label} is invalid for this tenant.`, undefined, code);
    }
    return resolvedId;
  }

  private async getProgramState(client: PoolClient, tenantId: string, programId: string) {
    const result = await client.query<{ id: string }>(`SELECT id FROM training_programs WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [programId, tenantId]);
    if (!result.rows[0]) {
      throw new AppError(404, "Training program not found.", undefined, "TRAINING_PROGRAM_NOT_FOUND");
    }
    return result.rows[0];
  }

  private async getAssignmentState(client: PoolClient, tenantId: string, assignmentId: string) {
    const result = await client.query<{ id: string; program_id: string }>(`SELECT id, program_id FROM training_assignments WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`, [assignmentId, tenantId]);
    if (!result.rows[0]) {
      throw new AppError(404, "Training assignment not found.", undefined, "TRAINING_ASSIGNMENT_NOT_FOUND");
    }
    return result.rows[0];
  }

  private assertManage(actor: ActorContext) {
    const canManage = actor.permissionCodes.includes("training.create") || actor.permissionCodes.includes("training.edit") || actor.permissionCodes.includes("training.configure") || actor.permissionCodes.includes("training.manage_workflow");
    if (!canManage) {
      throw new AppError(403, "You do not have permission to manage training content.", undefined, "AUTHORIZATION_ERROR");
    }
  }

  private buildAiPlaceholders(actor: ActorContext): TrainingAiPlaceholderSummary {
    const permissionCodes = new Set(actor.permissionCodes);
    const canUseAi = permissionCodes.has("training.use_ai") || permissionCodes.has("training.manage_ai") || permissionCodes.has("ai.use_ai") || permissionCodes.has("ai.manage_ai");
    const canManageAi = permissionCodes.has("training.manage_ai") || permissionCodes.has("ai.manage_ai");
    return {
      actions: canUseAi
        ? [
            { key: "ai_product_trainer", label: "AI product trainer", description: "Placeholder entry point for future interactive AI product training." },
            { key: "learning_path_recommender", label: "Learning path recommender", description: "Placeholder entry point for future personalized learning paths." },
            { key: "lesson_summarizer", label: "Lesson summarizer", description: "Placeholder entry point for future lesson summarization." },
            { key: "quiz_generator", label: "Quiz generator", description: "Placeholder entry point for future quiz generation." },
            { key: "knowledge_gap_detection", label: "Knowledge gap detection", description: "Placeholder entry point for future knowledge gap detection." }
          ]
        : [],
      governanceHint: canManageAi
        ? "AI placeholders are visible and will later connect to the governed AI Gateway with training controls."
        : canUseAi
          ? "AI placeholders are visible for this role, but execution remains deferred until the AI Gateway phase."
          : "AI placeholders remain hidden until the role includes training or global AI usage permissions."
    };
  }

  // ==========================================================================
  // Programs
  // ==========================================================================

  private programSelectColumns() {
    return `
      training_programs.id, training_programs.title, training_programs.description, training_programs.status,
      training_programs.estimated_minutes, training_programs.is_role_based, training_programs.target_role,
      training_programs.metadata, training_programs.created_at, training_programs.updated_at,
      owner_users.id AS owner_id, owner_users.display_name AS owner_display_name, owner_users.email AS owner_email,
      owner_teams.name AS owner_team_name, owner_departments.name AS owner_department_name,
      category_values.id AS category_id, category_values.value_key AS category_key, category_values.label AS category_label,
      category_values.description AS category_description, category_values.color AS category_color, category_values.is_default AS category_is_default, category_values.is_active AS category_is_active,
      level_values.id AS level_id, level_values.value_key AS level_key, level_values.label AS level_label,
      level_values.description AS level_description, level_values.color AS level_color, level_values.is_default AS level_is_default, level_values.is_active AS level_is_active,
      COALESCE(module_counts.count, 0)::int AS module_count,
      COALESCE(lesson_counts.count, 0)::int AS lesson_count,
      COALESCE(assignment_counts.count, 0)::int AS assignment_count
    `;
  }

  private programFromClause() {
    return `
      FROM training_programs
      INNER JOIN tenant_option_values AS category_values ON category_values.id = training_programs.category_option_id AND category_values.tenant_id = training_programs.tenant_id
      INNER JOIN tenant_option_values AS level_values ON level_values.id = training_programs.level_option_id AND level_values.tenant_id = training_programs.tenant_id
      LEFT JOIN users AS owner_users ON owner_users.id = training_programs.owner_id AND owner_users.tenant_id = training_programs.tenant_id AND owner_users.deleted_at IS NULL
      LEFT JOIN teams AS owner_teams ON owner_teams.id = owner_users.team_id AND owner_teams.tenant_id = owner_users.tenant_id AND owner_teams.deleted_at IS NULL
      LEFT JOIN departments AS owner_departments ON owner_departments.id = owner_users.department_id AND owner_departments.tenant_id = owner_users.tenant_id AND owner_departments.deleted_at IS NULL
      LEFT JOIN (SELECT tenant_id, program_id, COUNT(*) AS count FROM training_modules WHERE deleted_at IS NULL GROUP BY tenant_id, program_id) AS module_counts ON module_counts.tenant_id = training_programs.tenant_id AND module_counts.program_id = training_programs.id
      LEFT JOIN (SELECT tenant_id, program_id, COUNT(*) AS count FROM training_lessons WHERE deleted_at IS NULL GROUP BY tenant_id, program_id) AS lesson_counts ON lesson_counts.tenant_id = training_programs.tenant_id AND lesson_counts.program_id = training_programs.id
      LEFT JOIN (SELECT tenant_id, program_id, COUNT(*) AS count FROM training_assignments WHERE deleted_at IS NULL GROUP BY tenant_id, program_id) AS assignment_counts ON assignment_counts.tenant_id = training_programs.tenant_id AND assignment_counts.program_id = training_programs.id
    `;
  }

  private mapProgramSummary(row: ProgramRow): TrainingProgramSummary {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: normalizeFromList(PROGRAM_STATUSES, row.status, "draft"),
      category: mapOptionValue({ id: row.category_id, key: row.category_key, label: row.category_label, description: row.category_description, color: row.category_color, isDefault: row.category_is_default, isActive: row.category_is_active }),
      level: mapOptionValue({ id: row.level_id, key: row.level_key, label: row.level_label, description: row.level_description, color: row.level_color, isDefault: row.level_is_default, isActive: row.level_is_active }),
      owner: mapUser({ id: row.owner_id, displayName: row.owner_display_name, email: row.owner_email, teamName: row.owner_team_name, departmentName: row.owner_department_name }),
      estimatedMinutes: row.estimated_minutes,
      isRoleBased: row.is_role_based,
      targetRole: row.target_role,
      moduleCount: row.module_count,
      lessonCount: row.lesson_count,
      assignmentCount: row.assignment_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async getOptions(actor: ActorContext): Promise<TrainingOptionsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const accountsResult = await client.query<AccountLookupRow>(`SELECT id, name, website FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name ASC`, [actor.tenantId]);
      const contactsResult = await client.query<ContactLookupRow>(`SELECT contacts.id, contacts.first_name, contacts.last_name, contacts.email, role_values.id AS role_id, role_values.value_key AS role_key, role_values.label AS role_label, role_values.description AS role_description, role_values.color AS role_color, role_values.is_default AS role_is_default, role_values.is_active AS role_is_active FROM contacts LEFT JOIN tenant_option_values AS role_values ON role_values.id = contacts.role_option_id AND role_values.tenant_id = contacts.tenant_id WHERE contacts.tenant_id = $1 AND contacts.deleted_at IS NULL ORDER BY contacts.first_name ASC`, [actor.tenantId]);
      const csResult = await client.query<{ id: string; account_name: string }>(`SELECT customer_success_accounts.id, accounts.name AS account_name FROM customer_success_accounts INNER JOIN accounts ON accounts.id = customer_success_accounts.account_id AND accounts.tenant_id = customer_success_accounts.tenant_id WHERE customer_success_accounts.tenant_id = $1 AND customer_success_accounts.deleted_at IS NULL ORDER BY accounts.name ASC LIMIT 200`, [actor.tenantId]);
      const programsResult = await client.query<{ id: string; title: string; status: string }>(`SELECT id, title, status FROM training_programs WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200`, [actor.tenantId]);
      return {
        owners: await this.loadOwners(client, actor.tenantId),
        accounts: accountsResult.rows.map((row) => ({ id: row.id, name: row.name, website: row.website })),
        contacts: contactsResult.rows.map((row) => mapContact(row)),
        categories: await this.loadOptionSetValues(client, actor.tenantId, "training-category"),
        levels: await this.loadOptionSetValues(client, actor.tenantId, "training-level"),
        customerSuccessAccounts: csResult.rows.map((row) => ({ id: row.id, accountName: row.account_name })),
        programs: programsResult.rows.map((row) => ({ id: row.id, title: row.title, status: normalizeFromList(PROGRAM_STATUSES, row.status, "draft") }))
      };
    });
  }

  async listPrograms(actor: ActorContext, query: TrainingProgramListQuery): Promise<TrainingProgramsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["training_programs.tenant_id = $1", "training_programs.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.search) {
        params.push(`%${query.search.trim()}%`);
        conditions.push(`(training_programs.title ILIKE $${params.length} OR training_programs.description ILIKE $${params.length})`);
      }
      if (query.status) {
        params.push(query.status);
        conditions.push(`training_programs.status = $${params.length}`);
      }
      if (query.category) {
        params.push(query.category);
        conditions.push(`category_values.value_key = $${params.length}`);
      }
      if (query.ownerId) {
        params.push(query.ownerId);
        conditions.push(`training_programs.owner_id = $${params.length}`);
      }
      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = { title: "training_programs.title", status: "training_programs.status", category: "category_values.sort_order", updatedAt: "training_programs.updated_at", createdAt: "training_programs.created_at" };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "training_programs.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total ${this.programFromClause()} WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<ProgramRow>(`SELECT ${this.programSelectColumns()} ${this.programFromClause()} WHERE ${whereClause} ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, training_programs.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
      return { programs: listResult.rows.map((row) => this.mapProgramSummary(row)), pagination: buildPagination(page, pageSize, total) };
    });
  }

  private async loadProgramDetail(client: PoolClient, actor: ActorContext, programId: string): Promise<TrainingProgramDetail> {
    const result = await client.query<ProgramRow>(`SELECT ${this.programSelectColumns()} ${this.programFromClause()} WHERE training_programs.tenant_id = $1 AND training_programs.id = $2 AND training_programs.deleted_at IS NULL LIMIT 1`, [actor.tenantId, programId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "Training program not found.", undefined, "TRAINING_PROGRAM_NOT_FOUND");
    }

    const modulesResult = await client.query<{ id: string; title: string; description: string | null; sort_order: number; created_at: Date; updated_at: Date }>(`SELECT id, title, description, sort_order, created_at, updated_at FROM training_modules WHERE tenant_id = $1 AND program_id = $2 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`, [actor.tenantId, programId]);
    const lessonsResult = await client.query<{ id: string; module_id: string; title: string; content: string | null; lesson_type: string; duration_minutes: number | null; sort_order: number; created_at: Date; updated_at: Date }>(`SELECT id, module_id, title, content, lesson_type, duration_minutes, sort_order, created_at, updated_at FROM training_lessons WHERE tenant_id = $1 AND program_id = $2 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`, [actor.tenantId, programId]);
    const lessonIds = lessonsResult.rows.map((lesson) => lesson.id);
    const assetsResult = lessonIds.length > 0
      ? await client.query<{ id: string; lesson_id: string; name: string; asset_type: string; url: string | null; external_reference: string | null; created_at: Date; updated_at: Date }>(`SELECT id, lesson_id, name, asset_type, url, external_reference, created_at, updated_at FROM training_assets WHERE tenant_id = $1 AND lesson_id = ANY($2::uuid[]) AND deleted_at IS NULL ORDER BY created_at ASC`, [actor.tenantId, lessonIds])
      : { rows: [] as Array<{ id: string; lesson_id: string; name: string; asset_type: string; url: string | null; external_reference: string | null; created_at: Date; updated_at: Date }> };

    const assetsByLesson = new Map<string, TrainingAssetSummary[]>();
    for (const asset of assetsResult.rows) {
      const summary: TrainingAssetSummary = { id: asset.id, name: asset.name, assetType: normalizeFromList(ASSET_TYPES, asset.asset_type, "link"), url: asset.url, externalReference: asset.external_reference, createdAt: asset.created_at.toISOString(), updatedAt: asset.updated_at.toISOString() };
      const existing = assetsByLesson.get(asset.lesson_id) ?? [];
      existing.push(summary);
      assetsByLesson.set(asset.lesson_id, existing);
    }

    const lessonsByModule = new Map<string, TrainingLessonSummary[]>();
    for (const lesson of lessonsResult.rows) {
      const summary: TrainingLessonSummary = { id: lesson.id, moduleId: lesson.module_id, title: lesson.title, content: lesson.content, lessonType: normalizeFromList(LESSON_TYPES, lesson.lesson_type, "article"), durationMinutes: lesson.duration_minutes, sortOrder: lesson.sort_order, assets: assetsByLesson.get(lesson.id) ?? [], createdAt: lesson.created_at.toISOString(), updatedAt: lesson.updated_at.toISOString() };
      const existing = lessonsByModule.get(lesson.module_id) ?? [];
      existing.push(summary);
      lessonsByModule.set(lesson.module_id, existing);
    }

    const modules: TrainingModuleSummary[] = modulesResult.rows.map((module) => {
      const lessons = lessonsByModule.get(module.id) ?? [];
      return { id: module.id, title: module.title, description: module.description, sortOrder: module.sort_order, lessons, lessonCount: lessons.length, createdAt: module.created_at.toISOString(), updatedAt: module.updated_at.toISOString() };
    });

    const feedbackResult = await client.query<{ count: string; avg_rating: string | null }>(`SELECT COUNT(*)::text AS count, AVG(rating)::text AS avg_rating FROM training_feedback WHERE tenant_id = $1 AND program_id = $2 AND deleted_at IS NULL`, [actor.tenantId, programId]);

    return {
      ...this.mapProgramSummary(row),
      modules,
      averageRating: feedbackResult.rows[0]?.avg_rating ? Math.round(Number(feedbackResult.rows[0].avg_rating) * 100) / 100 : null,
      feedbackCount: Number(feedbackResult.rows[0]?.count ?? "0"),
      roleBasedPathPlaceholder: { available: false, message: "Role-based learning paths will connect once the lifecycle automation runtime is introduced." },
      certificationPlaceholder: { available: false, message: "Training certifications will connect once the certification runtime is introduced." },
      aiPlaceholders: this.buildAiPlaceholders(actor)
    };
  }

  async getProgram(actor: ActorContext, programId: string): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    const program = await this.databaseService.withClient(async (client) => this.loadProgramDetail(client, actor, programId));
    return { program };
  }

  async createProgram(actor: ActorContext, audit: AuditMetadata, input: CreateTrainingProgramRequestBody): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    const programId = await this.databaseService.withTransaction(async (client) => {
      const ownerId = await this.ensureReference(client, actor.tenantId, "users", input.ownerId ?? null, "INVALID_OWNER", "owner");
      const categoryOptionId = await this.resolveOptionValueId(client, actor.tenantId, "training-category", input.categoryKey ?? "product", "Training category");
      const levelOptionId = await this.resolveOptionValueId(client, actor.tenantId, "training-level", input.levelKey ?? "beginner", "Training level");
      const result = await client.query<{ id: string }>(
        `INSERT INTO training_programs (tenant_id, owner_id, category_option_id, level_option_id, title, description, status, estimated_minutes, is_role_based, target_role, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12) RETURNING id`,
        [actor.tenantId, ownerId, categoryOptionId, levelOptionId, input.title.trim(), getTrimmedNullableString(input.description), normalizeFromList(PROGRAM_STATUSES, input.status, "draft"), input.estimatedMinutes ?? null, Boolean(input.isRoleBased), getTrimmedNullableString(input.targetRole), JSON.stringify(input.metadata ?? {}), actor.userId]
      );
      const nextId = result.rows[0]?.id;
      if (!nextId) {
        throw new AppError(500, "Training program creation failed.", undefined, "TRAINING_PROGRAM_CREATE_FAILED");
      }
      await this.recordAuditLog(client, actor, audit, { action: "training.program.create", resourceType: "training_program", resourceId: nextId, status: "success", metadata: { categoryKey: input.categoryKey ?? "product" } });
      return nextId;
    });
    return this.getProgram(actor, programId);
  }

  async updateProgram(actor: ActorContext, audit: AuditMetadata, programId: string, input: UpdateTrainingProgramRequestBody): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateTrainingProgramRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      this.assertManage(actor);
      await this.getProgramState(client, actor.tenantId, programId);
      const assignments: string[] = [];
      const params: unknown[] = [programId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (keys.includes("title") && input.title !== undefined) push("title", input.title.trim());
      if (keys.includes("description")) push("description", getTrimmedNullableString(input.description));
      if (keys.includes("status")) push("status", normalizeFromList(PROGRAM_STATUSES, input.status, "draft"));
      if (keys.includes("categoryKey") && input.categoryKey) push("category_option_id", await this.resolveOptionValueId(client, actor.tenantId, "training-category", input.categoryKey, "Training category"));
      if (keys.includes("levelKey") && input.levelKey) push("level_option_id", await this.resolveOptionValueId(client, actor.tenantId, "training-level", input.levelKey, "Training level"));
      if (keys.includes("ownerId")) push("owner_id", await this.ensureReference(client, actor.tenantId, "users", input.ownerId ?? null, "INVALID_OWNER", "owner"));
      if (keys.includes("estimatedMinutes")) push("estimated_minutes", input.estimatedMinutes ?? null);
      if (keys.includes("isRoleBased")) push("is_role_based", Boolean(input.isRoleBased));
      if (keys.includes("targetRole")) push("target_role", getTrimmedNullableString(input.targetRole));
      if (keys.includes("metadata")) push("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      if (assignments.length > 0) {
        await client.query(`UPDATE training_programs SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }
      await this.recordAuditLog(client, actor, audit, { action: "training.program.update", resourceType: "training_program", resourceId: programId, status: "success", metadata: { updatedFields: keys } });
    });
    return this.getProgram(actor, programId);
  }

  async deleteProgram(actor: ActorContext, audit: AuditMetadata, programId: string): Promise<CrmMutationSuccessResponse> {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      this.assertManage(actor);
      await this.getProgramState(client, actor.tenantId, programId);
      await client.query(`UPDATE training_assets SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND deleted_at IS NULL AND lesson_id IN (SELECT id FROM training_lessons WHERE tenant_id = $1 AND program_id = $2)`, [actor.tenantId, programId, actor.userId]);
      for (const table of ["training_lessons", "training_modules", "training_assignments"]) {
        await client.query(`UPDATE ${table} SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND program_id = $2 AND deleted_at IS NULL`, [actor.tenantId, programId, actor.userId]);
      }
      await client.query(`UPDATE training_programs SET deleted_at = NOW(), updated_by = $3 WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`, [actor.tenantId, programId, actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "training.program.delete", resourceType: "training_program", resourceId: programId, status: "success" });
      return { success: true };
    });
  }

  async createModule(actor: ActorContext, audit: AuditMetadata, programId: string, input: CreateTrainingModuleRequestBody): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    this.assertManage(actor);
    await this.databaseService.withTransaction(async (client) => {
      await this.getProgramState(client, actor.tenantId, programId);
      const result = await client.query<{ id: string }>(`INSERT INTO training_modules (tenant_id, program_id, title, description, sort_order, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7) RETURNING id`, [actor.tenantId, programId, input.title.trim(), getTrimmedNullableString(input.description), input.sortOrder ?? 0, JSON.stringify(input.metadata ?? {}), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "training.module.create", resourceType: "training_module", resourceId: result.rows[0]?.id, status: "success", metadata: { programId } });
    });
    return this.getProgram(actor, programId);
  }

  async updateModule(actor: ActorContext, audit: AuditMetadata, programId: string, moduleId: string, input: UpdateTrainingModuleRequestBody): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    this.assertManage(actor);
    await this.databaseService.withTransaction(async (client) => {
      await this.getProgramState(client, actor.tenantId, programId);
      const existing = await client.query<{ id: string }>(`SELECT id FROM training_modules WHERE id = $1 AND tenant_id = $2 AND program_id = $3 AND deleted_at IS NULL LIMIT 1`, [moduleId, actor.tenantId, programId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "Training module not found.", undefined, "TRAINING_MODULE_NOT_FOUND");
      }
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateTrainingModuleRequestBody] !== undefined);
      const assignments: string[] = [];
      const params: unknown[] = [moduleId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (keys.includes("title") && input.title !== undefined) push("title", input.title.trim());
      if (keys.includes("description")) push("description", getTrimmedNullableString(input.description));
      if (keys.includes("sortOrder")) push("sort_order", input.sortOrder ?? 0);
      if (keys.includes("metadata")) push("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      if (assignments.length > 0) {
        await client.query(`UPDATE training_modules SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }
      await this.recordAuditLog(client, actor, audit, { action: "training.module.update", resourceType: "training_module", resourceId: moduleId, status: "success", metadata: { programId } });
    });
    return this.getProgram(actor, programId);
  }

  async createLesson(actor: ActorContext, audit: AuditMetadata, programId: string, moduleId: string, input: CreateTrainingLessonRequestBody): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    this.assertManage(actor);
    await this.databaseService.withTransaction(async (client) => {
      await this.getProgramState(client, actor.tenantId, programId);
      const moduleExists = await client.query<{ id: string }>(`SELECT id FROM training_modules WHERE id = $1 AND tenant_id = $2 AND program_id = $3 AND deleted_at IS NULL LIMIT 1`, [moduleId, actor.tenantId, programId]);
      if (!moduleExists.rows[0]) {
        throw new AppError(404, "Training module not found.", undefined, "TRAINING_MODULE_NOT_FOUND");
      }
      const result = await client.query<{ id: string }>(`INSERT INTO training_lessons (tenant_id, program_id, module_id, title, content, lesson_type, duration_minutes, sort_order, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10) RETURNING id`, [actor.tenantId, programId, moduleId, input.title.trim(), getTrimmedNullableString(input.content), normalizeFromList(LESSON_TYPES, input.lessonType, "article"), input.durationMinutes ?? null, input.sortOrder ?? 0, JSON.stringify(input.metadata ?? {}), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "training.lesson.create", resourceType: "training_lesson", resourceId: result.rows[0]?.id, status: "success", metadata: { programId, moduleId } });
    });
    return this.getProgram(actor, programId);
  }

  async updateLesson(actor: ActorContext, audit: AuditMetadata, programId: string, lessonId: string, input: UpdateTrainingLessonRequestBody): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    this.assertManage(actor);
    await this.databaseService.withTransaction(async (client) => {
      await this.getProgramState(client, actor.tenantId, programId);
      const existing = await client.query<{ id: string }>(`SELECT id FROM training_lessons WHERE id = $1 AND tenant_id = $2 AND program_id = $3 AND deleted_at IS NULL LIMIT 1`, [lessonId, actor.tenantId, programId]);
      if (!existing.rows[0]) {
        throw new AppError(404, "Training lesson not found.", undefined, "TRAINING_LESSON_NOT_FOUND");
      }
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateTrainingLessonRequestBody] !== undefined);
      const assignments: string[] = [];
      const params: unknown[] = [lessonId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (keys.includes("title") && input.title !== undefined) push("title", input.title.trim());
      if (keys.includes("content")) push("content", getTrimmedNullableString(input.content));
      if (keys.includes("lessonType")) push("lesson_type", normalizeFromList(LESSON_TYPES, input.lessonType, "article"));
      if (keys.includes("durationMinutes")) push("duration_minutes", input.durationMinutes ?? null);
      if (keys.includes("sortOrder")) push("sort_order", input.sortOrder ?? 0);
      if (keys.includes("metadata")) push("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      if (assignments.length > 0) {
        await client.query(`UPDATE training_lessons SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }
      await this.recordAuditLog(client, actor, audit, { action: "training.lesson.update", resourceType: "training_lesson", resourceId: lessonId, status: "success", metadata: { programId } });
    });
    return this.getProgram(actor, programId);
  }

  async createAsset(actor: ActorContext, audit: AuditMetadata, programId: string, lessonId: string, input: CreateTrainingAssetRequestBody): Promise<TrainingProgramResponse> {
    this.assertEnabled();
    this.assertManage(actor);
    await this.databaseService.withTransaction(async (client) => {
      await this.getProgramState(client, actor.tenantId, programId);
      const lessonExists = await client.query<{ id: string }>(`SELECT id FROM training_lessons WHERE id = $1 AND tenant_id = $2 AND program_id = $3 AND deleted_at IS NULL LIMIT 1`, [lessonId, actor.tenantId, programId]);
      if (!lessonExists.rows[0]) {
        throw new AppError(404, "Training lesson not found.", undefined, "TRAINING_LESSON_NOT_FOUND");
      }
      const result = await client.query<{ id: string }>(`INSERT INTO training_assets (tenant_id, lesson_id, name, asset_type, url, external_reference, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $8) RETURNING id`, [actor.tenantId, lessonId, input.name.trim(), normalizeFromList(ASSET_TYPES, input.assetType, "link"), getTrimmedNullableString(input.url), getTrimmedNullableString(input.externalReference), JSON.stringify(input.metadata ?? {}), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "training.asset.create", resourceType: "training_asset", resourceId: result.rows[0]?.id, status: "success", metadata: { lessonId } });
    });
    return this.getProgram(actor, programId);
  }

  // ==========================================================================
  // Learners
  // ==========================================================================

  private mapLearner(row: LearnerRow): CustomerLearnerSummary {
    return {
      id: row.id,
      learnerType: normalizeFromList(LEARNER_TYPES, row.learner_type, "user"),
      displayName: row.display_name,
      email: row.email,
      user: mapUser({ id: row.user_id, displayName: row.user_display_name, email: row.user_email, teamName: row.user_team_name, departmentName: row.user_department_name }),
      contact: row.contact_id ? mapContact({ id: row.contact_id, first_name: row.contact_first_name ?? "", last_name: row.contact_last_name ?? "", email: row.contact_email, role_id: null, role_key: null, role_label: null, role_description: null, role_color: null, role_is_default: null, role_is_active: null }) : null,
      account: row.account_id ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website } : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private learnerSelect() {
    return `
      customer_learners.id, customer_learners.learner_type, customer_learners.display_name, customer_learners.email, customer_learners.created_at, customer_learners.updated_at,
      learner_users.id AS user_id, learner_users.display_name AS user_display_name, learner_users.email AS user_email, learner_teams.name AS user_team_name, learner_departments.name AS user_department_name,
      learner_contacts.id AS contact_id, learner_contacts.first_name AS contact_first_name, learner_contacts.last_name AS contact_last_name, learner_contacts.email AS contact_email,
      learner_accounts.id AS account_id, learner_accounts.name AS account_name, learner_accounts.website AS account_website
    `;
  }

  private learnerFrom() {
    return `
      FROM customer_learners
      LEFT JOIN users AS learner_users ON learner_users.id = customer_learners.user_id AND learner_users.tenant_id = customer_learners.tenant_id AND learner_users.deleted_at IS NULL
      LEFT JOIN teams AS learner_teams ON learner_teams.id = learner_users.team_id AND learner_teams.tenant_id = learner_users.tenant_id AND learner_teams.deleted_at IS NULL
      LEFT JOIN departments AS learner_departments ON learner_departments.id = learner_users.department_id AND learner_departments.tenant_id = learner_users.tenant_id AND learner_departments.deleted_at IS NULL
      LEFT JOIN contacts AS learner_contacts ON learner_contacts.id = customer_learners.contact_id AND learner_contacts.tenant_id = customer_learners.tenant_id AND learner_contacts.deleted_at IS NULL
      LEFT JOIN accounts AS learner_accounts ON learner_accounts.id = customer_learners.account_id AND learner_accounts.tenant_id = customer_learners.tenant_id AND learner_accounts.deleted_at IS NULL
    `;
  }

  async listLearners(actor: ActorContext): Promise<CustomerLearnersResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<LearnerRow>(`SELECT ${this.learnerSelect()} ${this.learnerFrom()} WHERE customer_learners.tenant_id = $1 AND customer_learners.deleted_at IS NULL ORDER BY customer_learners.created_at DESC LIMIT 200`, [actor.tenantId]);
      return { learners: result.rows.map((row) => this.mapLearner(row)) };
    });
  }

  async createLearner(actor: ActorContext, audit: AuditMetadata, input: CreateCustomerLearnerRequestBody): Promise<CustomerLearnersResponse> {
    this.assertEnabled();
    this.assertManage(actor);
    await this.databaseService.withTransaction(async (client) => {
      const userId = await this.ensureReference(client, actor.tenantId, "users", input.userId ?? null, "INVALID_USER", "user");
      const contactId = await this.ensureReference(client, actor.tenantId, "contacts", input.contactId ?? null, "INVALID_CONTACT", "contact");
      const accountId = await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account");
      const result = await client.query<{ id: string }>(`INSERT INTO customer_learners (tenant_id, learner_type, user_id, contact_id, account_id, display_name, email, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9) RETURNING id`, [actor.tenantId, normalizeFromList(LEARNER_TYPES, input.learnerType, "user"), userId, contactId, accountId, input.displayName.trim(), getTrimmedNullableString(input.email), JSON.stringify(input.metadata ?? {}), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "training.learner.create", resourceType: "customer_learner", resourceId: result.rows[0]?.id, status: "success" });
    });
    return this.listLearners(actor);
  }

  // ==========================================================================
  // Assignments and progress
  // ==========================================================================

  private assignmentSelectColumns() {
    return `
      training_assignments.id, training_assignments.assignee_type, training_assignments.status, training_assignments.completion_percent,
      training_assignments.due_date, training_assignments.completed_at, training_assignments.cs_account_id, training_assignments.onboarding_plan_id,
      training_assignments.metadata, training_assignments.created_at, training_assignments.updated_at,
      programs.id AS program_id, programs.title AS program_title, programs.status AS program_status,
      assignee_users.id AS user_id, assignee_users.display_name AS user_display_name, assignee_users.email AS user_email, assignee_teams.name AS user_team_name, assignee_departments.name AS user_department_name,
      assignee_contacts.id AS contact_id, assignee_contacts.first_name AS contact_first_name, assignee_contacts.last_name AS contact_last_name, assignee_contacts.email AS contact_email,
      assignee_accounts.id AS account_id, assignee_accounts.name AS account_name, assignee_accounts.website AS account_website,
      training_assignments.learner_id,
      COALESCE(lesson_counts.count, 0)::int AS lesson_count,
      COALESCE(completed_counts.count, 0)::int AS completed_lesson_count
    `;
  }

  private assignmentFromClause() {
    return `
      FROM training_assignments
      INNER JOIN training_programs AS programs ON programs.id = training_assignments.program_id AND programs.tenant_id = training_assignments.tenant_id
      LEFT JOIN users AS assignee_users ON assignee_users.id = training_assignments.user_id AND assignee_users.tenant_id = training_assignments.tenant_id AND assignee_users.deleted_at IS NULL
      LEFT JOIN teams AS assignee_teams ON assignee_teams.id = assignee_users.team_id AND assignee_teams.tenant_id = assignee_users.tenant_id AND assignee_teams.deleted_at IS NULL
      LEFT JOIN departments AS assignee_departments ON assignee_departments.id = assignee_users.department_id AND assignee_departments.tenant_id = assignee_users.tenant_id AND assignee_departments.deleted_at IS NULL
      LEFT JOIN contacts AS assignee_contacts ON assignee_contacts.id = training_assignments.contact_id AND assignee_contacts.tenant_id = training_assignments.tenant_id AND assignee_contacts.deleted_at IS NULL
      LEFT JOIN accounts AS assignee_accounts ON assignee_accounts.id = training_assignments.account_id AND assignee_accounts.tenant_id = training_assignments.tenant_id AND assignee_accounts.deleted_at IS NULL
      LEFT JOIN (SELECT tenant_id, program_id, COUNT(*) AS count FROM training_lessons WHERE deleted_at IS NULL GROUP BY tenant_id, program_id) AS lesson_counts ON lesson_counts.tenant_id = training_assignments.tenant_id AND lesson_counts.program_id = training_assignments.program_id
      LEFT JOIN (SELECT tenant_id, assignment_id, COUNT(*) AS count FROM training_progress WHERE deleted_at IS NULL AND status = 'completed' GROUP BY tenant_id, assignment_id) AS completed_counts ON completed_counts.tenant_id = training_assignments.tenant_id AND completed_counts.assignment_id = training_assignments.id
    `;
  }

  private mapAssignmentSummary(row: AssignmentRow): TrainingAssignmentSummary {
    return {
      id: row.id,
      program: row.program_id ? { id: row.program_id, title: row.program_title ?? "", status: normalizeFromList(PROGRAM_STATUSES, row.program_status, "draft") } : null,
      assigneeType: normalizeFromList(ASSIGNEE_TYPES, row.assignee_type, "user"),
      user: mapUser({ id: row.user_id, displayName: row.user_display_name, email: row.user_email, teamName: row.user_team_name, departmentName: row.user_department_name }),
      contact: row.contact_id ? mapContact({ id: row.contact_id, first_name: row.contact_first_name ?? "", last_name: row.contact_last_name ?? "", email: row.contact_email, role_id: null, role_key: null, role_label: null, role_description: null, role_color: null, role_is_default: null, role_is_active: null }) : null,
      account: row.account_id ? { id: row.account_id, name: row.account_name ?? "", website: row.account_website } : null,
      learner: null,
      csAccountId: row.cs_account_id,
      onboardingPlanId: row.onboarding_plan_id,
      status: normalizeFromList(ASSIGNMENT_STATUSES, row.status, "assigned"),
      completionPercent: row.completion_percent,
      dueDate: row.due_date,
      completedAt: toIsoString(row.completed_at),
      lessonCount: row.lesson_count,
      completedLessonCount: row.completed_lesson_count,
      metadata: getMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private async loadAssignmentDetail(client: PoolClient, actor: ActorContext, assignmentId: string): Promise<TrainingAssignmentDetail> {
    const result = await client.query<AssignmentRow>(`SELECT ${this.assignmentSelectColumns()} ${this.assignmentFromClause()} WHERE training_assignments.tenant_id = $1 AND training_assignments.id = $2 AND training_assignments.deleted_at IS NULL LIMIT 1`, [actor.tenantId, assignmentId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, "Training assignment not found.", undefined, "TRAINING_ASSIGNMENT_NOT_FOUND");
    }
    const progressResult = await client.query<{ id: string; lesson_id: string; lesson_title: string; status: string; progress_percent: number; started_at: Date | null; completed_at: Date | null; updated_at: Date; sort_order: number }>(
      `SELECT training_lessons.id AS lesson_id, training_lessons.title AS lesson_title, training_lessons.sort_order,
         training_progress.id, training_progress.status, training_progress.progress_percent, training_progress.started_at, training_progress.completed_at, training_progress.updated_at
       FROM training_lessons
       LEFT JOIN training_progress ON training_progress.lesson_id = training_lessons.id AND training_progress.assignment_id = $2 AND training_progress.tenant_id = training_lessons.tenant_id AND training_progress.deleted_at IS NULL
       WHERE training_lessons.tenant_id = $1 AND training_lessons.program_id = $3 AND training_lessons.deleted_at IS NULL
       ORDER BY training_lessons.sort_order ASC, training_lessons.created_at ASC`,
      [actor.tenantId, assignmentId, row.program_id]
    );
    const progress: TrainingProgressItem[] = progressResult.rows.map((entry) => ({
      id: entry.id ?? entry.lesson_id,
      lessonId: entry.lesson_id,
      lessonTitle: entry.lesson_title,
      status: entry.status ? normalizeFromList(PROGRESS_STATUSES, entry.status, "not_started") : "not_started",
      progressPercent: entry.progress_percent ?? 0,
      startedAt: toIsoString(entry.started_at),
      completedAt: toIsoString(entry.completed_at),
      updatedAt: entry.updated_at ? entry.updated_at.toISOString() : new Date().toISOString()
    }));
    return { ...this.mapAssignmentSummary(row), progress, aiPlaceholders: this.buildAiPlaceholders(actor) };
  }

  async getAssignment(actor: ActorContext, assignmentId: string): Promise<TrainingAssignmentResponse> {
    this.assertEnabled();
    const assignment = await this.databaseService.withClient(async (client) => this.loadAssignmentDetail(client, actor, assignmentId));
    return { assignment };
  }

  async listAssignments(actor: ActorContext, query: TrainingAssignmentListQuery): Promise<TrainingAssignmentsResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
      const conditions = ["training_assignments.tenant_id = $1", "training_assignments.deleted_at IS NULL"];
      const params: unknown[] = [actor.tenantId];
      if (query.status) {
        params.push(query.status);
        conditions.push(`training_assignments.status = $${params.length}`);
      }
      if (query.programId) {
        params.push(query.programId);
        conditions.push(`training_assignments.program_id = $${params.length}`);
      }
      if (query.userId) {
        params.push(query.userId);
        conditions.push(`training_assignments.user_id = $${params.length}`);
      }
      if (query.accountId) {
        params.push(query.accountId);
        conditions.push(`training_assignments.account_id = $${params.length}`);
      }
      if (query.csAccountId) {
        params.push(query.csAccountId);
        conditions.push(`training_assignments.cs_account_id = $${params.length}`);
      }
      const whereClause = conditions.join(" AND ");
      const sortColumnMap: Record<string, string> = { status: "training_assignments.status", dueDate: "training_assignments.due_date", updatedAt: "training_assignments.updated_at", createdAt: "training_assignments.created_at" };
      const sortColumn = sortColumnMap[query.sortBy ?? "updatedAt"] ?? "training_assignments.updated_at";
      const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";
      const countResult = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total ${this.assignmentFromClause()} WHERE ${whereClause}`, params);
      const total = Number(countResult.rows[0]?.total ?? "0");
      const listParams = [...params, pageSize, (page - 1) * pageSize];
      const listResult = await client.query<AssignmentRow>(`SELECT ${this.assignmentSelectColumns()} ${this.assignmentFromClause()} WHERE ${whereClause} ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, training_assignments.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`, listParams);
      return { assignments: listResult.rows.map((row) => this.mapAssignmentSummary(row)), pagination: buildPagination(page, pageSize, total) };
    });
  }

  async createAssignment(actor: ActorContext, audit: AuditMetadata, input: CreateTrainingAssignmentRequestBody): Promise<TrainingAssignmentResponse> {
    this.assertEnabled();
    const assignmentId = await this.databaseService.withTransaction(async (client) => {
      const canAssign = actor.permissionCodes.includes("training.assign") || actor.permissionCodes.includes("training.create") || actor.permissionCodes.includes("training.edit") || actor.permissionCodes.includes("training.configure");
      if (!canAssign) {
        throw new AppError(403, "You do not have permission to assign training.", undefined, "AUTHORIZATION_ERROR");
      }
      await this.getProgramState(client, actor.tenantId, input.programId);
      const userId = await this.ensureReference(client, actor.tenantId, "users", input.userId ?? null, "INVALID_USER", "user");
      const contactId = await this.ensureReference(client, actor.tenantId, "contacts", input.contactId ?? null, "INVALID_CONTACT", "contact");
      const accountId = await this.ensureReference(client, actor.tenantId, "accounts", input.accountId ?? null, "INVALID_ACCOUNT", "account");
      const csAccountId = await this.ensureReference(client, actor.tenantId, "customer_success_accounts", input.csAccountId ?? null, "INVALID_CS_ACCOUNT", "customer success account");
      const onboardingPlanId = await this.ensureReference(client, actor.tenantId, "onboarding_plans", input.onboardingPlanId ?? null, "INVALID_ONBOARDING_PLAN", "onboarding plan");
      const learnerId = await this.ensureReference(client, actor.tenantId, "customer_learners", input.learnerId ?? null, "INVALID_LEARNER", "learner");
      const result = await client.query<{ id: string }>(
        `INSERT INTO training_assignments (tenant_id, program_id, assignee_type, user_id, contact_id, account_id, cs_account_id, onboarding_plan_id, learner_id, status, completion_percent, due_date, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'assigned', 0, $10::date, $11::jsonb, $12, $12) RETURNING id`,
        [actor.tenantId, input.programId, normalizeFromList(ASSIGNEE_TYPES, input.assigneeType, "user"), userId, contactId, accountId, csAccountId, onboardingPlanId, learnerId, input.dueDate ?? null, JSON.stringify(input.metadata ?? {}), actor.userId]
      );
      const nextId = result.rows[0]?.id;
      if (!nextId) {
        throw new AppError(500, "Training assignment creation failed.", undefined, "TRAINING_ASSIGNMENT_CREATE_FAILED");
      }
      await this.recordAuditLog(client, actor, audit, { action: "training.assignment.create", resourceType: "training_assignment", resourceId: nextId, status: "success", metadata: { programId: input.programId, userId, accountId } });
      return nextId;
    });
    return this.getAssignment(actor, assignmentId);
  }

  async updateAssignment(actor: ActorContext, audit: AuditMetadata, assignmentId: string, input: UpdateTrainingAssignmentRequestBody): Promise<TrainingAssignmentResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateTrainingAssignmentRequestBody] !== undefined);
      if (keys.length === 0) {
        throw new AppError(400, "At least one field must be updated.", undefined, "VALIDATION_ERROR");
      }
      this.assertManage(actor);
      await this.getAssignmentState(client, actor.tenantId, assignmentId);
      const assignments: string[] = [];
      const params: unknown[] = [assignmentId, actor.tenantId, actor.userId];
      const push = (column: string, value: unknown, cast = "") => {
        params.push(value);
        assignments.push(`${column} = $${params.length}${cast}`);
      };
      if (keys.includes("status") && input.status) push("status", normalizeFromList(ASSIGNMENT_STATUSES, input.status, "assigned"));
      if (keys.includes("dueDate")) push("due_date", input.dueDate ?? null, "::date");
      if (keys.includes("csAccountId")) push("cs_account_id", await this.ensureReference(client, actor.tenantId, "customer_success_accounts", input.csAccountId ?? null, "INVALID_CS_ACCOUNT", "customer success account"));
      if (keys.includes("onboardingPlanId")) push("onboarding_plan_id", await this.ensureReference(client, actor.tenantId, "onboarding_plans", input.onboardingPlanId ?? null, "INVALID_ONBOARDING_PLAN", "onboarding plan"));
      if (keys.includes("learnerId")) push("learner_id", await this.ensureReference(client, actor.tenantId, "customer_learners", input.learnerId ?? null, "INVALID_LEARNER", "learner"));
      if (keys.includes("metadata")) push("metadata", JSON.stringify(input.metadata ?? {}), "::jsonb");
      if (assignments.length > 0) {
        await client.query(`UPDATE training_assignments SET ${assignments.join(", ")}, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`, params);
      }
      await this.recordAuditLog(client, actor, audit, { action: "training.assignment.update", resourceType: "training_assignment", resourceId: assignmentId, status: "success", metadata: { updatedFields: keys } });
    });
    return this.getAssignment(actor, assignmentId);
  }

  async updateProgress(actor: ActorContext, audit: AuditMetadata, assignmentId: string, input: UpdateTrainingProgressRequestBody): Promise<TrainingAssignmentResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const state = await this.getAssignmentState(client, actor.tenantId, assignmentId);
      const lessonResult = await client.query<{ id: string }>(`SELECT id FROM training_lessons WHERE id = $1 AND tenant_id = $2 AND program_id = $3 AND deleted_at IS NULL LIMIT 1`, [input.lessonId, actor.tenantId, state.program_id]);
      if (!lessonResult.rows[0]) {
        throw new AppError(400, "The selected lesson is invalid for this assignment.", undefined, "INVALID_LESSON");
      }
      const status = normalizeFromList(PROGRESS_STATUSES, input.status, "in_progress");
      const progressPercent = input.progressPercent ?? (status === "completed" ? 100 : status === "in_progress" ? 50 : 0);

      const existing = await client.query<{ id: string }>(`SELECT id FROM training_progress WHERE tenant_id = $1 AND assignment_id = $2 AND lesson_id = $3 AND deleted_at IS NULL LIMIT 1`, [actor.tenantId, assignmentId, input.lessonId]);
      if (existing.rows[0]) {
        await client.query(
          `UPDATE training_progress SET status = $4, progress_percent = $5, started_at = COALESCE(started_at, NOW()), completed_at = CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END, metadata = $6::jsonb, updated_by = $7 WHERE id = $1 AND tenant_id = $2 AND assignment_id = $3 AND deleted_at IS NULL`,
          [existing.rows[0].id, actor.tenantId, assignmentId, status, progressPercent, JSON.stringify(input.metadata ?? {}), actor.userId]
        );
      } else {
        await client.query(
          `INSERT INTO training_progress (tenant_id, assignment_id, lesson_id, status, progress_percent, started_at, completed_at, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, NOW(), CASE WHEN $4 = 'completed' THEN NOW() ELSE NULL END, $6::jsonb, $7, $7)`,
          [actor.tenantId, assignmentId, input.lessonId, status, progressPercent, JSON.stringify(input.metadata ?? {}), actor.userId]
        );
      }

      // Recompute assignment completion from lesson progress.
      const totals = await client.query<{ lesson_count: string; completed_count: string }>(
        `SELECT (SELECT COUNT(*) FROM training_lessons WHERE tenant_id = $1 AND program_id = $2 AND deleted_at IS NULL)::text AS lesson_count, (SELECT COUNT(*) FROM training_progress WHERE tenant_id = $1 AND assignment_id = $3 AND status = 'completed' AND deleted_at IS NULL)::text AS completed_count`,
        [actor.tenantId, state.program_id, assignmentId]
      );
      const lessonCount = Number(totals.rows[0]?.lesson_count ?? "0");
      const completedCount = Number(totals.rows[0]?.completed_count ?? "0");
      const completionPercent = lessonCount === 0 ? 0 : Math.round((completedCount / lessonCount) * 100);
      const assignmentStatus: TrainingAssignmentStatus = lessonCount > 0 && completedCount >= lessonCount ? "completed" : completedCount > 0 ? "in_progress" : "assigned";
      await client.query(
        `UPDATE training_assignments SET completion_percent = $4, status = $5, completed_at = CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END, updated_by = $3 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [assignmentId, actor.tenantId, actor.userId, completionPercent, assignmentStatus]
      );

      await this.recordAuditLog(client, actor, audit, { action: "training.progress.update", resourceType: "training_assignment", resourceId: assignmentId, status: "success", metadata: { lessonId: input.lessonId, completionPercent } });
    });
    return this.getAssignment(actor, assignmentId);
  }

  async createFeedback(actor: ActorContext, audit: AuditMetadata, assignmentId: string, input: CreateTrainingFeedbackRequestBody): Promise<TrainingAssignmentResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const state = await this.getAssignmentState(client, actor.tenantId, assignmentId);
      let lessonId: string | null = null;
      if (input.lessonId) {
        const lessonResult = await client.query<{ id: string }>(`SELECT id FROM training_lessons WHERE id = $1 AND tenant_id = $2 AND program_id = $3 AND deleted_at IS NULL LIMIT 1`, [input.lessonId, actor.tenantId, state.program_id]);
        if (!lessonResult.rows[0]) {
          throw new AppError(400, "The selected lesson is invalid for this assignment.", undefined, "INVALID_LESSON");
        }
        lessonId = input.lessonId;
      }
      const result = await client.query<{ id: string }>(`INSERT INTO training_feedback (tenant_id, program_id, lesson_id, assignment_id, learner_id, rating, comments, metadata, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9) RETURNING id`, [actor.tenantId, state.program_id, lessonId, assignmentId, input.learnerId ?? null, input.rating, getTrimmedNullableString(input.comments), JSON.stringify(input.metadata ?? {}), actor.userId]);
      await this.recordAuditLog(client, actor, audit, { action: "training.feedback.create", resourceType: "training_feedback", resourceId: result.rows[0]?.id, status: "success", metadata: { assignmentId, rating: input.rating } });
    });
    return this.getAssignment(actor, assignmentId);
  }

  // ==========================================================================
  // Portal and dashboard
  // ==========================================================================

  async getMyTraining(actor: ActorContext): Promise<MyTrainingResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query<AssignmentRow>(`SELECT ${this.assignmentSelectColumns()} ${this.assignmentFromClause()} WHERE training_assignments.tenant_id = $1 AND training_assignments.deleted_at IS NULL AND training_assignments.user_id = $2 ORDER BY training_assignments.updated_at DESC`, [actor.tenantId, actor.userId]);
      const assignments = result.rows.map((row) => this.mapAssignmentSummary(row));
      return {
        assignedCount: assignments.filter((entry) => entry.status === "assigned").length,
        inProgressCount: assignments.filter((entry) => entry.status === "in_progress").length,
        completedCount: assignments.filter((entry) => entry.status === "completed").length,
        assignments,
        recommendedTrainingPlaceholder: { available: false, message: "Recommended training will connect once the learning recommendation runtime is introduced." },
        aiPlaceholders: this.buildAiPlaceholders(actor)
      };
    });
  }

  async getDashboard(actor: ActorContext): Promise<TrainingDashboardResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const programsResult = await client.query<ProgramRow>(`SELECT ${this.programSelectColumns()} ${this.programFromClause()} WHERE training_programs.tenant_id = $1 AND training_programs.deleted_at IS NULL`, [actor.tenantId]);
      const programs = programsResult.rows.map((row) => this.mapProgramSummary(row));
      const assignmentsResult = await client.query<{ status: string; completion_percent: number }>(`SELECT status, completion_percent FROM training_assignments WHERE tenant_id = $1 AND deleted_at IS NULL`, [actor.tenantId]);
      const ratingResult = await client.query<{ avg_rating: string | null }>(`SELECT AVG(rating)::text AS avg_rating FROM training_feedback WHERE tenant_id = $1 AND deleted_at IS NULL`, [actor.tenantId]);

      const categoryMap = new Map<string, { category: CrmOptionValueSummary | null; programCount: number }>();
      for (const program of programs) {
        const key = program.category?.key ?? "__none__";
        const entry = categoryMap.get(key) ?? { category: program.category, programCount: 0 };
        entry.programCount += 1;
        categoryMap.set(key, entry);
      }

      const statusCounts = new Map<TrainingAssignmentStatus, number>();
      const completionValues: number[] = [];
      for (const assignment of assignmentsResult.rows) {
        const status = normalizeFromList(ASSIGNMENT_STATUSES, assignment.status, "assigned");
        statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
        completionValues.push(assignment.completion_percent);
      }

      return {
        totalPrograms: programs.length,
        publishedPrograms: programs.filter((program) => program.status === "published").length,
        totalAssignments: assignmentsResult.rows.length,
        completedAssignments: statusCounts.get("completed") ?? 0,
        inProgressAssignments: statusCounts.get("in_progress") ?? 0,
        averageCompletionPercent: averageOf(completionValues),
        averageRating: ratingResult.rows[0]?.avg_rating ? Math.round(Number(ratingResult.rows[0].avg_rating) * 100) / 100 : null,
        categoryDistribution: Array.from(categoryMap.values()),
        statusDistribution: ASSIGNMENT_STATUSES.map((status) => ({ status, assignmentCount: statusCounts.get(status) ?? 0 })).filter((entry) => entry.assignmentCount > 0)
      };
    });
  }
}

interface ProgramRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  estimated_minutes: number | null;
  is_role_based: boolean;
  target_role: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  owner_team_name: string | null;
  owner_department_name: string | null;
  category_id: string | null;
  category_key: string | null;
  category_label: string | null;
  category_description: string | null;
  category_color: string | null;
  category_is_default: boolean | null;
  category_is_active: boolean | null;
  level_id: string | null;
  level_key: string | null;
  level_label: string | null;
  level_description: string | null;
  level_color: string | null;
  level_is_default: boolean | null;
  level_is_active: boolean | null;
  module_count: number;
  lesson_count: number;
  assignment_count: number;
}

interface LearnerRow {
  id: string;
  learner_type: string;
  display_name: string;
  email: string | null;
  created_at: Date;
  updated_at: Date;
  user_id: string | null;
  user_display_name: string | null;
  user_email: string | null;
  user_team_name: string | null;
  user_department_name: string | null;
  contact_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
}

interface AssignmentRow {
  id: string;
  assignee_type: string;
  status: string;
  completion_percent: number;
  due_date: string | null;
  completed_at: Date | null;
  cs_account_id: string | null;
  onboarding_plan_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  program_id: string | null;
  program_title: string | null;
  program_status: string;
  user_id: string | null;
  user_display_name: string | null;
  user_email: string | null;
  user_team_name: string | null;
  user_department_name: string | null;
  contact_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  account_id: string | null;
  account_name: string | null;
  account_website: string | null;
  learner_id: string | null;
  lesson_count: number;
  completed_lesson_count: number;
}
