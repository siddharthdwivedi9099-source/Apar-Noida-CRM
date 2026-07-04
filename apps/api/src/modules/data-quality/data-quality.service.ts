import type { PoolClient } from "pg";
import type {
  CommitImportRequestBody,
  DataQualityDashboardResponse,
  DqEnrichmentEntry,
  DqEnrichmentQueueResponse,
  DqSignal,
  MergeRecordsRequestBody,
  ResolveEnrichmentRequestBody,
  ValidateImportRequestBody
} from "@crm/types";
import { computeCompleteness, enrichmentStatuses, isStale, isValidEmail, isValidPhone, resolveMergedRecord, validateImportRows } from "@crm/types";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";

interface ActorContext {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  permissionCodes: string[];
}

interface AuditMetadata {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface LeadRow {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string | null;
  phone: string | null;
  owner_id: string | null;
  source_key: string | null;
  status_key: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: Date;
  created_at: Date;
}

const STALE_DAYS = 60;
const REQUIRED_LEAD_FIELDS = ["firstName", "lastName", "companyName", "email", "phone", "ownerId"];
const RESOLVED_STATUSES = new Set(["converted", "disqualified"]);
const GENERIC_SOURCES = new Set(["manual", "unknown", "other"]);

function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export class DataQualityService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly config: { enableAuditLogs: boolean }
  ) {}

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Data quality is unavailable until the database connection is enabled.", undefined, "DATA_QUALITY_UNAVAILABLE");
    }
  }

  private async recordAuditLog(client: PoolClient, actor: ActorContext, audit: AuditMetadata, input: { action: string; resourceType: string; resourceId?: string | null; status: "success" | "failure"; metadata?: Record<string, unknown> }) {
    if (!this.config.enableAuditLogs) {
      return;
    }
    await client.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, event_type, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, 'data_quality', $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [actor.tenantId, actor.userId, input.action, input.resourceType, input.resourceId ?? null, input.status, audit.ipAddress, audit.userAgent, JSON.stringify(input.metadata ?? {})]
    );
  }

  private async resolveOptionValueId(client: PoolClient, tenantId: string, setKey: string, valueKey: string) {
    const result = await client.query<{ id: string }>(
      `SELECT v.id FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id
       WHERE s.tenant_id = $1 AND s.set_key = $2 AND s.deleted_at IS NULL AND v.deleted_at IS NULL AND v.is_active = true AND v.value_key = $3 LIMIT 1`,
      [tenantId, setKey, valueKey]
    );
    if (result.rowCount === 0) {
      throw new AppError(400, `Option "${valueKey}" is invalid for set "${setKey}".`, undefined, "INVALID_OPTION_VALUE");
    }
    return result.rows[0].id;
  }

  private async loadLeads(client: PoolClient, tenantId: string, limit = 5000): Promise<LeadRow[]> {
    const result = await client.query<LeadRow>(
      `SELECT l.id, l.first_name, l.last_name, l.company_name, l.email, l.phone, l.owner_id,
              sv.value_key AS source_key, st.value_key AS status_key, l.metadata, l.updated_at, l.created_at
       FROM leads l
       LEFT JOIN tenant_option_values sv ON sv.id = l.source_option_id AND sv.tenant_id = l.tenant_id
       LEFT JOIN tenant_option_values st ON st.id = l.status_option_id AND st.tenant_id = l.tenant_id
       WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
       ORDER BY l.created_at DESC LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  }

  private leadRecord(row: LeadRow): Record<string, unknown> {
    return { firstName: row.first_name, lastName: row.last_name, companyName: row.company_name, email: row.email, phone: row.phone, ownerId: row.owner_id };
  }

  private consentGranted(metadata: Record<string, unknown> | null): boolean {
    const consent = (metadata?.consent ?? null) as Record<string, unknown> | null;
    return typeof consent?.status === "string" && consent.status.toLowerCase() === "granted";
  }

  // ---- DQM-001: dashboard ----------------------------------------------------------------------

  async getDashboard(actor: ActorContext): Promise<DataQualityDashboardResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const leads = await this.loadLeads(client, actor.tenantId);
      const now = Date.now();

      const buckets: Record<string, string[]> = {
        duplicates: [], invalid_emails: [], invalid_phones: [], missing_owners: [], missing_sources: [], stale_leads: [], consent_gaps: []
      };
      const emailGroups = new Map<string, string[]>();
      let completenessSum = 0;

      for (const lead of leads) {
        completenessSum += computeCompleteness(this.leadRecord(lead), REQUIRED_LEAD_FIELDS).pct;
        if (lead.email && !isValidEmail(lead.email)) buckets.invalid_emails.push(lead.id);
        if (lead.phone && !isValidPhone(lead.phone)) buckets.invalid_phones.push(lead.id);
        if (!lead.owner_id) buckets.missing_owners.push(lead.id);
        if (!lead.source_key || GENERIC_SOURCES.has(lead.source_key)) buckets.missing_sources.push(lead.id);
        if (!RESOLVED_STATUSES.has(lead.status_key ?? "") && isStale(lead.updated_at.toISOString(), now, STALE_DAYS)) buckets.stale_leads.push(lead.id);
        if (!this.consentGranted(lead.metadata)) buckets.consent_gaps.push(lead.id);
        if (lead.email) {
          const key = lead.email.trim().toLowerCase();
          emailGroups.set(key, [...(emailGroups.get(key) ?? []), lead.id]);
        }
      }
      for (const ids of emailGroups.values()) {
        if (ids.length > 1) buckets.duplicates.push(...ids);
      }

      const labels: Record<string, string> = {
        duplicates: "Duplicate emails", invalid_emails: "Invalid emails", invalid_phones: "Invalid phones",
        missing_owners: "Missing owners", missing_sources: "Missing sources", stale_leads: "Stale leads", consent_gaps: "Consent gaps"
      };
      const signals: DqSignal[] = Object.entries(buckets).map(([key, ids]) => ({ key, label: labels[key], count: ids.length, sampleIds: ids.slice(0, 10) }));
      const cleanupPriorities = [...signals].sort((a, b) => b.count - a.count).filter((s) => s.count > 0).slice(0, 3).map((s) => s.label);

      return {
        entity: "lead",
        totalRecords: leads.length,
        completenessPct: leads.length > 0 ? Math.round(completenessSum / leads.length) : 100,
        signals,
        cleanupPriorities,
        aiPlaceholder: { available: false, message: "AI cleanup-priority ranking will connect with the governed AI Gateway; deterministic priorities are shown meanwhile." }
      };
    });
  }

  // ---- DQM-002: import validation --------------------------------------------------------------

  async validateImport(actor: ActorContext, input: ValidateImportRequestBody) {
    this.assertEnabled();
    const rows = Array.isArray(input.rows) ? input.rows : [];
    if (rows.length === 0 || rows.length > 5000) {
      throw new AppError(400, "Provide between 1 and 5000 rows to validate.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withClient(async (client) => {
      const sources = await client.query<{ value_key: string }>(
        `SELECT v.value_key FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id
         WHERE s.tenant_id = $1 AND s.set_key = 'lead-capture-source' AND v.deleted_at IS NULL`,
        [actor.tenantId]
      );
      const allowedSources = sources.rows.map((r) => r.value_key);
      return validateImportRows(rows, { mandatoryFields: ["firstName", "lastName", "companyName"], requireConsent: Boolean(input.requireConsent), allowedValues: allowedSources.length > 0 ? { sourceKey: allowedSources } : undefined });
    });
  }

  async commitImport(actor: ActorContext, audit: AuditMetadata, input: CommitImportRequestBody) {
    this.assertEnabled();
    const rows = Array.isArray(input.rows) ? input.rows : [];
    return this.databaseService.withTransaction(async (client) => {
      const sources = await client.query<{ value_key: string }>(
        `SELECT v.value_key FROM tenant_option_sets s INNER JOIN tenant_option_values v ON v.option_set_id = s.id AND v.tenant_id = s.tenant_id
         WHERE s.tenant_id = $1 AND s.set_key = 'lead-capture-source' AND v.deleted_at IS NULL`,
        [actor.tenantId]
      );
      const validation = validateImportRows(rows, { mandatoryFields: ["firstName", "lastName", "companyName"], requireConsent: Boolean(input.requireConsent), allowedValues: sources.rows.length > 0 ? { sourceKey: sources.rows.map((r) => r.value_key) } : undefined });
      const statusId = await this.resolveOptionValueId(client, actor.tenantId, "lead-status", "new");
      const importedSourceId = await this.resolveOptionValueId(client, actor.tenantId, "lead-capture-source", "imported");

      let imported = 0;
      for (const result of validation.rows) {
        if (!result.valid) continue;
        const row = rows[result.rowIndex];
        await client.query(
          `INSERT INTO leads (tenant_id, first_name, last_name, company_name, email, phone, status_option_id, source_option_id, metadata, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10)`,
          [actor.tenantId, String(row.firstName).trim(), String(row.lastName).trim(), String(row.companyName).trim(), typeof row.email === "string" ? row.email.trim() : null, typeof row.phone === "string" ? row.phone.trim() : null, statusId, importedSourceId, JSON.stringify({ importedAt: new Date().toISOString(), consent: input.requireConsent ? { status: "granted" } : undefined }), actor.userId]
        );
        imported += 1;
      }
      const batch = await client.query<{ id: string }>(
        `INSERT INTO dq_import_batches (tenant_id, entity_type, total_rows, valid_rows, error_rows, imported_rows, status, created_by)
         VALUES ($1, 'lead', $2, $3, $4, $5, 'committed', $6) RETURNING id`,
        [actor.tenantId, validation.totalRows, validation.validRows, validation.errorRows, imported, actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "data_quality.import.commit", resourceType: "dq_import_batch", resourceId: batch.rows[0].id, status: "success", metadata: { imported, errorRows: validation.errorRows } });
      return { batchId: batch.rows[0].id, imported, errorRows: validation.errorRows, validation };
    });
  }

  // ---- DQM-003: enrichment queue ---------------------------------------------------------------

  private mapEnrichment(row: { id: string; entity_type: string; entity_id: string; missing_fields: unknown; suggestions: unknown; status: string; source: string | null; confidence: number | null; created_at: Date }): DqEnrichmentEntry {
    return {
      id: row.id,
      entityType: normalize(["lead", "contact", "account"] as const, row.entity_type, "lead"),
      entityId: row.entity_id,
      missingFields: Array.isArray(row.missing_fields) ? (row.missing_fields as unknown[]).filter((x): x is string => typeof x === "string") : [],
      suggestions: (row.suggestions ?? {}) as Record<string, string>,
      status: normalize(enrichmentStatuses, row.status, "pending"),
      source: row.source,
      confidence: row.confidence,
      createdAt: row.created_at.toISOString()
    };
  }

  async generateEnrichmentQueue(actor: ActorContext, audit: AuditMetadata) {
    this.assertEnabled();
    return this.databaseService.withTransaction(async (client) => {
      const leads = await this.loadLeads(client, actor.tenantId, 1000);
      let queued = 0;
      for (const lead of leads) {
        const missing: string[] = [];
        if (!lead.email) missing.push("email");
        if (!lead.phone) missing.push("phone");
        if (!lead.owner_id) missing.push("ownerId");
        if (missing.length === 0) continue;
        // Deterministic stand-in for the AI enrichment suggester.
        const suggestions: Record<string, string> = {};
        if (missing.includes("email")) suggestions.email = `${slug(lead.first_name)}.${slug(lead.last_name)}@${slug(lead.company_name) || "example"}.com`;
        await client.query(
          `INSERT INTO dq_enrichment_queue (tenant_id, entity_type, entity_id, missing_fields, suggestions, source, confidence, created_by, updated_by)
           VALUES ($1, 'lead', $2, $3::jsonb, $4::jsonb, 'heuristic', 40, $5, $5)
           ON CONFLICT (tenant_id, entity_type, entity_id) DO UPDATE SET missing_fields = EXCLUDED.missing_fields, suggestions = EXCLUDED.suggestions, updated_by = EXCLUDED.updated_by
           WHERE dq_enrichment_queue.status = 'pending'`,
          [actor.tenantId, lead.id, JSON.stringify(missing), JSON.stringify(suggestions), actor.userId]
        );
        queued += 1;
      }
      await this.recordAuditLog(client, actor, audit, { action: "data_quality.enrichment.generate", resourceType: "dq_enrichment_queue", status: "success", metadata: { queued } });
      return { queued };
    });
  }

  async listEnrichmentQueue(actor: ActorContext): Promise<DqEnrichmentQueueResponse> {
    this.assertEnabled();
    return this.databaseService.withClient(async (client) => {
      const result = await client.query(
        `SELECT id, entity_type, entity_id, missing_fields, suggestions, status, source, confidence, created_at FROM dq_enrichment_queue WHERE tenant_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 200`,
        [actor.tenantId]
      );
      return { entries: result.rows.map((row) => this.mapEnrichment(row)) };
    });
  }

  async resolveEnrichment(actor: ActorContext, audit: AuditMetadata, entryId: string, input: ResolveEnrichmentRequestBody): Promise<DqEnrichmentQueueResponse> {
    this.assertEnabled();
    await this.databaseService.withTransaction(async (client) => {
      const entry = (await client.query<{ id: string; entity_id: string; suggestions: Record<string, string> | null; entity_type: string }>(`SELECT id, entity_id, suggestions, entity_type FROM dq_enrichment_queue WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [entryId, actor.tenantId])).rows[0];
      if (!entry) {
        throw new AppError(404, "Enrichment entry not found.", undefined, "NOT_FOUND");
      }
      if (input.decision === "reject") {
        await client.query(`UPDATE dq_enrichment_queue SET status = 'rejected', resolved_by = $3, resolved_at = NOW(), updated_by = $3 WHERE id = $1 AND tenant_id = $2`, [entryId, actor.tenantId, actor.userId]);
      } else {
        // accept uses the stored suggestions; edit uses the user-provided values.
        const values = input.decision === "edit" ? (input.values ?? {}) : (entry.suggestions ?? {});
        const email = typeof values.email === "string" && isValidEmail(values.email) ? values.email.trim() : null;
        const phone = typeof values.phone === "string" && isValidPhone(values.phone) ? values.phone.trim() : null;
        if (entry.entity_type === "lead" && (email || phone)) {
          await client.query(
            `UPDATE leads SET email = COALESCE($3, email), phone = COALESCE($4, phone), updated_by = $5 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
            [entry.entity_id, actor.tenantId, email, phone, actor.userId]
          );
        }
        await client.query(`UPDATE dq_enrichment_queue SET status = $3, source = 'human_confirmed', confidence = 100, suggestions = $4::jsonb, resolved_by = $5, resolved_at = NOW(), updated_by = $5 WHERE id = $1 AND tenant_id = $2`, [entryId, actor.tenantId, input.decision === "edit" ? "edited" : "accepted", JSON.stringify(values), actor.userId]);
      }
      await this.recordAuditLog(client, actor, audit, { action: "data_quality.enrichment.resolve", resourceType: "dq_enrichment_queue", resourceId: entryId, status: "success", metadata: { decision: input.decision } });
    });
    return this.listEnrichmentQueue(actor);
  }

  // ---- DQM-004: merge workflow -----------------------------------------------------------------

  async mergeRecords(actor: ActorContext, audit: AuditMetadata, input: MergeRecordsRequestBody) {
    this.assertEnabled();
    if (!input.reason?.trim()) {
      throw new AppError(400, "A merge reason is required.", undefined, "MERGE_REASON_REQUIRED");
    }
    if (input.masterId === input.duplicateId) {
      throw new AppError(400, "Master and duplicate must be different records.", undefined, "VALIDATION_ERROR");
    }
    return this.databaseService.withTransaction(async (client) => {
      const load = async (id: string) => (await client.query<LeadRow>(
        `SELECT l.id, l.first_name, l.last_name, l.company_name, l.email, l.phone, l.owner_id, NULL AS source_key, NULL AS status_key, l.metadata, l.updated_at, l.created_at FROM leads l WHERE l.id = $1 AND l.tenant_id = $2 AND l.deleted_at IS NULL LIMIT 1`,
        [id, actor.tenantId]
      )).rows[0];
      const master = await load(input.masterId);
      const duplicate = await load(input.duplicateId);
      if (!master || !duplicate) {
        throw new AppError(404, "Master or duplicate lead not found.", undefined, "NOT_FOUND");
      }

      const masterRec = this.leadRecord(master);
      const dupRec = this.leadRecord(duplicate);
      const merged = resolveMergedRecord(masterRec, dupRec, input.fieldSelections ?? {});

      await client.query(
        `UPDATE leads SET first_name = $3, last_name = $4, company_name = $5, email = $6, phone = $7, owner_id = $8, updated_by = $9 WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [master.id, actor.tenantId, String(merged.firstName), String(merged.lastName), String(merged.companyName), (merged.email as string | null) ?? null, (merged.phone as string | null) ?? null, (merged.ownerId as string | null) ?? null, actor.userId]
      );
      // DQM-004: preserve related activity by reassigning it from the duplicate to the master.
      const reassigned = await client.query(`UPDATE crm_tasks SET entity_id = $3, updated_by = $4 WHERE tenant_id = $1 AND entity_type = 'lead' AND entity_id = $2 AND deleted_at IS NULL`, [actor.tenantId, duplicate.id, master.id, actor.userId]);
      // Soft-delete the duplicate.
      await client.query(`UPDATE leads SET deleted_at = NOW(), updated_by = $3, metadata = metadata || $4::jsonb WHERE id = $1 AND tenant_id = $2`, [duplicate.id, actor.tenantId, actor.userId, JSON.stringify({ mergedInto: master.id })]);

      const preserved = { duplicate: dupRec, duplicateMetadata: duplicate.metadata ?? {}, reassignedTasks: reassigned.rowCount ?? 0 };
      const log = await client.query<{ id: string }>(
        `INSERT INTO dq_merge_log (tenant_id, entity_type, master_id, duplicate_id, field_selections, preserved, reason, merged_by)
         VALUES ($1, 'lead', $2, $3, $4::jsonb, $5::jsonb, $6, $7) RETURNING id`,
        [actor.tenantId, master.id, duplicate.id, JSON.stringify(input.fieldSelections ?? {}), JSON.stringify(preserved), input.reason.trim(), actor.userId]
      );
      await this.recordAuditLog(client, actor, audit, { action: "data_quality.merge", resourceType: "lead", resourceId: master.id, status: "success", metadata: { duplicateId: duplicate.id, reason: input.reason.trim(), reassignedTasks: reassigned.rowCount ?? 0 } });
      return { masterId: master.id, duplicateId: duplicate.id, mergeLogId: log.rows[0].id, reassignedTasks: reassigned.rowCount ?? 0 };
    });
  }
}
