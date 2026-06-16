import { Router, type Request } from "express";
import { z } from "zod";
import {
  accountSortFields,
  contactSortFields,
  crmActivityTypes,
  leadSortFields,
  permissionActionKeys,
  type AccountListQuery,
  type CreateAccountRequestBody,
  type CreateContactRequestBody,
  type CreateCrmActivityRequestBody,
  type CreateCrmNoteRequestBody,
  type CreateLeadRequestBody,
  type ContactListQuery,
  type LeadListQuery,
  type UpdateAccountRequestBody,
  type UpdateContactRequestBody,
  type UpdateLeadRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { CrmService } from "./crm.service.js";

interface CrmRouterDependencies {
  databaseService: DatabaseService;
}

const recordSchema = z.record(z.unknown());
const uuidSchema = z.string().uuid();

const leadReadPermissions = permissionActionKeys.map((actionKey) => `leads.${actionKey}`);
const accountReadPermissions = permissionActionKeys.map((actionKey) => `accounts.${actionKey}`);
const contactReadPermissions = permissionActionKeys.map((actionKey) => `contacts.${actionKey}`);

const leadMutationPermissions = {
  create: ["leads.create", "leads.configure"],
  update: ["leads.edit", "leads.assign", "leads.configure"],
  delete: ["leads.delete", "leads.configure"],
  note: ["leads.create", "leads.edit", "leads.assign", "leads.configure"],
  activity: ["leads.create", "leads.edit", "leads.assign", "leads.configure"]
};

const accountMutationPermissions = {
  create: ["accounts.create", "accounts.configure"],
  update: ["accounts.edit", "accounts.assign", "accounts.configure"],
  delete: ["accounts.delete", "accounts.configure"],
  note: ["accounts.create", "accounts.edit", "accounts.assign", "accounts.configure"],
  activity: ["accounts.create", "accounts.edit", "accounts.assign", "accounts.configure"]
};

const contactMutationPermissions = {
  create: ["contacts.create", "contacts.configure"],
  update: ["contacts.edit", "contacts.assign", "contacts.configure"],
  delete: ["contacts.delete", "contacts.configure"],
  note: ["contacts.create", "contacts.edit", "contacts.assign", "contacts.configure"],
  activity: ["contacts.create", "contacts.edit", "contacts.assign", "contacts.configure"]
};

const leadListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  status: z.string().max(160).optional(),
  source: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  sortBy: z.enum(leadSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const accountListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  accountType: z.string().max(160).optional(),
  industry: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  sortBy: z.enum(accountSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const contactListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  accountId: uuidSchema.optional(),
  role: z.string().max(160).optional(),
  ownerId: uuidSchema.optional(),
  sortBy: z.enum(contactSortFields).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

const noteCreateSchema = z.object({
  body: z.string().min(2).max(5000)
});

const activityCreateSchema = z.object({
  activityType: z.enum(crmActivityTypes),
  subject: z.string().min(2).max(200),
  description: z.string().max(4000).nullable().optional(),
  occurredAt: z.string().datetime().optional()
});

const leadCreateSchema = z.object({
  firstName: z.string().min(2).max(120),
  lastName: z.string().min(2).max(120),
  companyName: z.string().min(2).max(160),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  statusKey: z.string().min(2).max(160),
  sourceKey: z.string().min(2).max(160),
  score: z.coerce.number().int().min(0).max(100).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const leadUpdateSchema = z.object({
  firstName: z.string().min(2).max(120).optional(),
  lastName: z.string().min(2).max(120).optional(),
  companyName: z.string().min(2).max(160).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  statusKey: z.string().min(2).max(160).optional(),
  sourceKey: z.string().min(2).max(160).optional(),
  score: z.coerce.number().int().min(0).max(100).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const accountCreateSchema = z.object({
  name: z.string().min(2).max(160),
  website: z.string().url().nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  accountTypeKey: z.string().min(2).max(160).nullable().optional(),
  healthStatusKey: z.string().min(2).max(160).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const accountUpdateSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  website: z.string().url().nullable().optional(),
  industry: z.string().max(120).nullable().optional(),
  accountTypeKey: z.string().min(2).max(160).nullable().optional(),
  healthStatusKey: z.string().min(2).max(160).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const contactCreateSchema = z.object({
  firstName: z.string().min(2).max(120),
  lastName: z.string().min(2).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  roleKey: z.string().min(2).max(160).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const contactUpdateSchema = z.object({
  firstName: z.string().min(2).max(120).optional(),
  lastName: z.string().min(2).max(120).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  roleKey: z.string().min(2).max(160).nullable().optional(),
  ownerId: uuidSchema.nullable().optional(),
  accountId: uuidSchema.nullable().optional(),
  metadata: recordSchema.optional()
});

const leadIdSchema = z.object({
  leadId: uuidSchema
});

const accountIdSchema = z.object({
  accountId: uuidSchema
});

const contactIdSchema = z.object({
  contactId: uuidSchema
});

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

export function createCrmRouter({ databaseService }: CrmRouterDependencies) {
  const router = Router();
  const authService = new AuthService(databaseService, {
    enabled: env.DATABASE_ENABLED,
    accessTokenSecret: env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: env.JWT_REFRESH_TOKEN_SECRET,
    accessTokenTtlMinutes: env.JWT_ACCESS_TOKEN_TTL_MINUTES,
    refreshTokenTtlDays: env.JWT_REFRESH_TOKEN_TTL_DAYS,
    accountLockThreshold: env.AUTH_ACCOUNT_LOCK_THRESHOLD,
    accountLockMinutes: env.AUTH_ACCOUNT_LOCK_MINUTES,
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });
  const authMiddleware = createAuthMiddleware(authService);
  const crmService = new CrmService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/leads/options",
    requirePermissions({ oneOf: leadReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.getLeadOptions(request.auth!));
    })
  );

  router.get(
    "/leads",
    requirePermissions({ oneOf: leadReadPermissions }),
    validateRequest({
      query: leadListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.listLeads(request.auth!, request.query as LeadListQuery));
    })
  );

  router.post(
    "/leads",
    requirePermissions({ oneOf: leadMutationPermissions.create }),
    validateRequest({
      body: leadCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.createLead(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateLeadRequestBody
        )
      );
    })
  );

  router.get(
    "/leads/:leadId",
    requirePermissions({ oneOf: leadReadPermissions }),
    validateRequest({
      params: leadIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.getLead(request.auth!, request.params.leadId));
    })
  );

  router.patch(
    "/leads/:leadId",
    requirePermissions({ oneOf: leadMutationPermissions.update }),
    validateRequest({
      params: leadIdSchema,
      body: leadUpdateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await crmService.updateLead(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.leadId,
          request.body as UpdateLeadRequestBody
        )
      );
    })
  );

  router.delete(
    "/leads/:leadId",
    requirePermissions({ oneOf: leadMutationPermissions.delete }),
    validateRequest({
      params: leadIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await crmService.deleteLead(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.leadId
        )
      );
    })
  );

  router.post(
    "/leads/:leadId/notes",
    requirePermissions({ oneOf: leadMutationPermissions.note }),
    validateRequest({
      params: leadIdSchema,
      body: noteCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.addLeadNote(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.leadId,
          request.body as CreateCrmNoteRequestBody
        )
      );
    })
  );

  router.post(
    "/leads/:leadId/activities",
    requirePermissions({ oneOf: leadMutationPermissions.activity }),
    validateRequest({
      params: leadIdSchema,
      body: activityCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.addLeadActivity(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.leadId,
          request.body as CreateCrmActivityRequestBody
        )
      );
    })
  );

  router.get(
    "/accounts/options",
    requirePermissions({ oneOf: accountReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.getAccountOptions(request.auth!));
    })
  );

  router.get(
    "/accounts",
    requirePermissions({ oneOf: accountReadPermissions }),
    validateRequest({
      query: accountListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.listAccounts(request.auth!, request.query as AccountListQuery));
    })
  );

  router.post(
    "/accounts",
    requirePermissions({ oneOf: accountMutationPermissions.create }),
    validateRequest({
      body: accountCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.createAccount(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateAccountRequestBody
        )
      );
    })
  );

  router.get(
    "/accounts/:accountId",
    requirePermissions({ oneOf: accountReadPermissions }),
    validateRequest({
      params: accountIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.getAccount(request.auth!, request.params.accountId));
    })
  );

  router.patch(
    "/accounts/:accountId",
    requirePermissions({ oneOf: accountMutationPermissions.update }),
    validateRequest({
      params: accountIdSchema,
      body: accountUpdateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await crmService.updateAccount(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.accountId,
          request.body as UpdateAccountRequestBody
        )
      );
    })
  );

  router.delete(
    "/accounts/:accountId",
    requirePermissions({ oneOf: accountMutationPermissions.delete }),
    validateRequest({
      params: accountIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await crmService.deleteAccount(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.accountId
        )
      );
    })
  );

  router.post(
    "/accounts/:accountId/notes",
    requirePermissions({ oneOf: accountMutationPermissions.note }),
    validateRequest({
      params: accountIdSchema,
      body: noteCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.addAccountNote(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.accountId,
          request.body as CreateCrmNoteRequestBody
        )
      );
    })
  );

  router.post(
    "/accounts/:accountId/activities",
    requirePermissions({ oneOf: accountMutationPermissions.activity }),
    validateRequest({
      params: accountIdSchema,
      body: activityCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.addAccountActivity(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.accountId,
          request.body as CreateCrmActivityRequestBody
        )
      );
    })
  );

  router.get(
    "/contacts/options",
    requirePermissions({ oneOf: contactReadPermissions }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.getContactOptions(request.auth!));
    })
  );

  router.get(
    "/contacts",
    requirePermissions({ oneOf: contactReadPermissions }),
    validateRequest({
      query: contactListQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.listContacts(request.auth!, request.query as ContactListQuery));
    })
  );

  router.post(
    "/contacts",
    requirePermissions({ oneOf: contactMutationPermissions.create }),
    validateRequest({
      body: contactCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.createContact(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateContactRequestBody
        )
      );
    })
  );

  router.get(
    "/contacts/:contactId",
    requirePermissions({ oneOf: contactReadPermissions }),
    validateRequest({
      params: contactIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await crmService.getContact(request.auth!, request.params.contactId));
    })
  );

  router.patch(
    "/contacts/:contactId",
    requirePermissions({ oneOf: contactMutationPermissions.update }),
    validateRequest({
      params: contactIdSchema,
      body: contactUpdateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await crmService.updateContact(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.contactId,
          request.body as UpdateContactRequestBody
        )
      );
    })
  );

  router.delete(
    "/contacts/:contactId",
    requirePermissions({ oneOf: contactMutationPermissions.delete }),
    validateRequest({
      params: contactIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await crmService.deleteContact(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.contactId
        )
      );
    })
  );

  router.post(
    "/contacts/:contactId/notes",
    requirePermissions({ oneOf: contactMutationPermissions.note }),
    validateRequest({
      params: contactIdSchema,
      body: noteCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.addContactNote(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.contactId,
          request.body as CreateCrmNoteRequestBody
        )
      );
    })
  );

  router.post(
    "/contacts/:contactId/activities",
    requirePermissions({ oneOf: contactMutationPermissions.activity }),
    validateRequest({
      params: contactIdSchema,
      body: activityCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await crmService.addContactActivity(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.contactId,
          request.body as CreateCrmActivityRequestBody
        )
      );
    })
  );

  return router;
}
