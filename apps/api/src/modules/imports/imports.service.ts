import type {
  BulkImportEntity,
  BulkImportRequestBody,
  BulkImportResponse,
  BulkImportRowError,
  BulkImportTemplateResponse,
  RoleSummary
} from "@crm/types";
import { buildImportTemplateCsv, bulkImportSpecs, parseImportRows } from "@crm/types";
import type { PoolClient } from "pg";
import { AppError } from "../../common/errors/app-error.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { CrmService } from "../crm/crm.service.js";
import { OpportunityService } from "../opportunities/opportunities.service.js";

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

interface OptionLookup {
  /** value_key (lowercased) -> value_key */
  byKey: Map<string, string>;
  /** label (lowercased) -> value_key */
  byLabel: Map<string, string>;
}

/**
 * Bulk import for data migration: each row goes through the SAME create flow
 * as a manually entered record (option resolution, validations, MQL state,
 * audit logs), so imported data is first-class. Rows succeed or fail
 * independently — one bad row never blocks the rest.
 */
export class ImportsService {
  private readonly crmService: CrmService;
  private readonly opportunityService: OpportunityService;

  constructor(
    private readonly databaseService: DatabaseService,
    config: { enableAuditLogs: boolean }
  ) {
    this.crmService = new CrmService(databaseService, config);
    this.opportunityService = new OpportunityService(databaseService, config);
  }

  private assertEnabled() {
    if (!this.databaseService.isEnabled()) {
      throw new AppError(503, "Bulk import is unavailable until the database connection is enabled.", undefined, "IMPORTS_UNAVAILABLE");
    }
  }

  getTemplate(entity: BulkImportEntity): BulkImportTemplateResponse {
    return {
      entity,
      columns: bulkImportSpecs[entity],
      csv: buildImportTemplateCsv(entity)
    };
  }

  private async loadOptionLookup(client: PoolClient, tenantId: string, setKey: string): Promise<OptionLookup> {
    const result = await client.query<{ value_key: string; label: string }>(
      `
        SELECT tenant_option_values.value_key, tenant_option_values.label
        FROM tenant_option_sets
        INNER JOIN tenant_option_values
          ON tenant_option_values.option_set_id = tenant_option_sets.id
         AND tenant_option_values.tenant_id = tenant_option_sets.tenant_id
        WHERE tenant_option_sets.tenant_id = $1
          AND tenant_option_sets.set_key = $2
          AND tenant_option_sets.deleted_at IS NULL
          AND tenant_option_values.deleted_at IS NULL
          AND tenant_option_values.is_active = true
      `,
      [tenantId, setKey]
    );

    const byKey = new Map<string, string>();
    const byLabel = new Map<string, string>();
    for (const row of result.rows) {
      byKey.set(row.value_key.toLowerCase(), row.value_key);
      byLabel.set(row.label.toLowerCase(), row.value_key);
    }
    return { byKey, byLabel };
  }

  /** Option columns accept the value key or the label, case-insensitively. */
  private resolveOptionKey(lookup: OptionLookup, raw: string, column: string, setKey: string): string {
    const needle = raw.trim().toLowerCase();
    const resolved = lookup.byKey.get(needle) ?? lookup.byLabel.get(needle);
    if (!resolved) {
      throw new AppError(400, `${column} "${raw}" does not match any value in the ${setKey} option set.`, undefined, "INVALID_OPTION_VALUE");
    }
    return resolved;
  }

  private async loadUserIdsByEmail(client: PoolClient, tenantId: string, emails: string[]): Promise<Map<string, string>> {
    if (emails.length === 0) {
      return new Map();
    }
    const result = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE tenant_id = $1 AND deleted_at IS NULL AND LOWER(email) = ANY($2::text[])`,
      [tenantId, emails.map((email) => email.toLowerCase())]
    );
    return new Map(result.rows.map((row) => [row.email.toLowerCase(), row.id]));
  }

  private async loadAccountIdsByName(client: PoolClient, tenantId: string, names: string[]): Promise<Map<string, string>> {
    if (names.length === 0) {
      return new Map();
    }
    const result = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL AND LOWER(name) = ANY($2::text[])`,
      [tenantId, names.map((name) => name.toLowerCase())]
    );
    return new Map(result.rows.map((row) => [row.name.toLowerCase(), row.id]));
  }

  private async loadExistingEmails(client: PoolClient, tenantId: string, table: "leads" | "contacts", emails: string[]): Promise<Set<string>> {
    if (emails.length === 0) {
      return new Set();
    }
    const result = await client.query<{ email: string }>(
      `SELECT email FROM ${table} WHERE tenant_id = $1 AND deleted_at IS NULL AND LOWER(email) = ANY($2::text[])`,
      [tenantId, emails.map((email) => email.toLowerCase())]
    );
    return new Set(result.rows.map((row) => row.email.toLowerCase()));
  }

  private requireCells(record: Record<string, string>, entity: BulkImportEntity): void {
    for (const column of bulkImportSpecs[entity]) {
      if (column.required && !record[column.key]) {
        throw new AppError(400, `Required cell "${column.key}" is empty.`, undefined, "VALIDATION_ERROR");
      }
    }
  }

  private parseNumberCell(raw: string, column: string, min: number, max: number): number | null {
    if (!raw) {
      return null;
    }
    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new AppError(400, `${column} "${raw}" must be a number between ${min} and ${max}.`, undefined, "VALIDATION_ERROR");
    }
    return value;
  }

  private parseDateCell(raw: string, column: string): string | null {
    if (!raw) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
      throw new AppError(400, `${column} "${raw}" must be a valid date in YYYY-MM-DD format.`, undefined, "VALIDATION_ERROR");
    }
    return raw;
  }

  async importRecords(
    actor: ActorContext,
    audit: AuditMetadata,
    entity: BulkImportEntity,
    input: BulkImportRequestBody
  ): Promise<BulkImportResponse> {
    this.assertEnabled();

    const dryRun = Boolean(input.dryRun);
    const allowDuplicates = Boolean(input.allowDuplicates);
    const parsed = parseImportRows(entity, input.csv ?? "");

    if (parsed.formatErrors.length > 0) {
      throw new AppError(
        400,
        "The file does not match the fixed import format.",
        { formatErrors: parsed.formatErrors },
        "IMPORT_FORMAT_ERROR"
      );
    }

    // Shared lookups resolved once per import (option sets, owners, accounts, duplicates).
    const context = await this.databaseService.withClient(async (client) => {
      const ownerEmails = [...new Set(parsed.rows.map((row) => row.owner_email).filter(Boolean))];
      const accountNames = [...new Set(parsed.rows.map((row) => row.account_name).filter(Boolean))];
      const rowEmails = [...new Set(parsed.rows.map((row) => row.email).filter(Boolean))];

      return {
        owners: await this.loadUserIdsByEmail(client, actor.tenantId, ownerEmails),
        accounts: await this.loadAccountIdsByName(client, actor.tenantId, accountNames),
        existingEmails:
          entity === "lead" || entity === "contact"
            ? await this.loadExistingEmails(client, actor.tenantId, entity === "lead" ? "leads" : "contacts", rowEmails)
            : new Set<string>(),
        leadStatus: entity === "lead" ? await this.loadOptionLookup(client, actor.tenantId, "lead-status") : null,
        leadSource: entity === "lead" ? await this.loadOptionLookup(client, actor.tenantId, "lead-source") : null,
        accountType: entity === "account" ? await this.loadOptionLookup(client, actor.tenantId, "account-type") : null,
        accountHealth: entity === "account" ? await this.loadOptionLookup(client, actor.tenantId, "account-health") : null,
        contactRole: entity === "contact" ? await this.loadOptionLookup(client, actor.tenantId, "contact-role") : null,
        stage: entity === "opportunity" ? await this.loadOptionLookup(client, actor.tenantId, "opportunity-pipeline") : null,
        opportunitySource: entity === "opportunity" ? await this.loadOptionLookup(client, actor.tenantId, "opportunity-source") : null
      };
    });

    const errors: BulkImportRowError[] = [];
    let created = 0;
    let skippedDuplicates = 0;

    const resolveOwnerId = (record: Record<string, string>): string | null => {
      const email = record.owner_email;
      if (!email) {
        return null; // create flows default to the importing user / unassigned
      }
      const ownerId = context.owners.get(email.toLowerCase());
      if (!ownerId) {
        throw new AppError(400, `owner_email "${email}" does not match any active user in this tenant.`, undefined, "INVALID_OWNER");
      }
      return ownerId;
    };

    const importMetadata = { importedAt: new Date().toISOString(), importedBy: actor.userId, source: "bulk_import" };

    // Emails seen in the database plus ones created earlier in this same file,
    // so in-file duplicates are caught too.
    const seenEmails = new Set(context.existingEmails);

    for (const [index, record] of parsed.rows.entries()) {
      const rowNumber = index + 1;
      try {
        this.requireCells(record, entity);

        if ((entity === "lead" || entity === "contact") && record.email) {
          const emailKey = record.email.toLowerCase();
          if (seenEmails.has(emailKey) && !allowDuplicates) {
            skippedDuplicates += 1;
            continue;
          }
          seenEmails.add(emailKey);
        }

        if (entity === "lead") {
          const body = {
            firstName: record.first_name,
            lastName: record.last_name,
            companyName: record.company_name,
            email: record.email || null,
            phone: record.phone || null,
            statusKey: this.resolveOptionKey(context.leadStatus!, record.status, "status", "lead-status"),
            sourceKey: this.resolveOptionKey(context.leadSource!, record.source, "source", "lead-source"),
            score: this.parseNumberCell(record.score, "score", 0, 100),
            ownerId: resolveOwnerId(record),
            metadata: { import: importMetadata }
          };
          if (!dryRun) {
            await this.crmService.createLead(actor, audit, body);
          }
        } else if (entity === "account") {
          const body = {
            name: record.name,
            website: record.website || null,
            industry: record.industry || null,
            accountTypeKey: record.account_type
              ? this.resolveOptionKey(context.accountType!, record.account_type, "account_type", "account-type")
              : null,
            healthStatusKey: record.health_status
              ? this.resolveOptionKey(context.accountHealth!, record.health_status, "health_status", "account-health")
              : null,
            ownerId: resolveOwnerId(record),
            metadata: { import: importMetadata }
          };
          if (!dryRun) {
            await this.crmService.createAccount(actor, audit, body);
          }
        } else if (entity === "contact") {
          const accountName = record.account_name;
          const accountId = accountName ? context.accounts.get(accountName.toLowerCase()) : null;
          if (accountName && !accountId) {
            throw new AppError(400, `account_name "${accountName}" does not match any account. Import accounts first.`, undefined, "ACCOUNT_NOT_FOUND");
          }
          const body = {
            firstName: record.first_name,
            lastName: record.last_name,
            email: record.email || null,
            phone: record.phone || null,
            linkedinUrl: record.linkedin_url || null,
            roleKey: record.role ? this.resolveOptionKey(context.contactRole!, record.role, "role", "contact-role") : null,
            accountId: accountId ?? null,
            ownerId: resolveOwnerId(record),
            metadata: { import: importMetadata }
          };
          if (!dryRun) {
            await this.crmService.createContact(actor, audit, body);
          }
        } else {
          const accountId = context.accounts.get(record.account_name.toLowerCase());
          if (!accountId) {
            throw new AppError(400, `account_name "${record.account_name}" does not match any account. Import accounts first.`, undefined, "ACCOUNT_NOT_FOUND");
          }
          const body = {
            name: record.name,
            accountId,
            stageKey: this.resolveOptionKey(context.stage!, record.stage, "stage", "opportunity-pipeline"),
            sourceKey: this.resolveOptionKey(context.opportunitySource!, record.source, "source", "opportunity-source"),
            amount: this.parseNumberCell(record.amount, "amount", 0, 1_000_000_000_000),
            probability: this.parseNumberCell(record.probability, "probability", 0, 100),
            expectedCloseDate: this.parseDateCell(record.expected_close_date, "expected_close_date"),
            nextStep: record.next_step || null,
            ownerId: resolveOwnerId(record),
            metadata: { import: importMetadata }
          };
          if (!dryRun) {
            await this.opportunityService.createOpportunity(actor, audit, body);
          }
        }

        created += 1;
      } catch (error) {
        const message = error instanceof AppError ? error.message : "Row import failed.";
        errors.push({ row: rowNumber, message });
      }
    }

    return {
      entity,
      dryRun,
      total: parsed.rows.length,
      created,
      skippedDuplicates,
      failed: errors.length,
      errors
    };
  }
}
