import { Router, type Request } from "express";
import { z } from "zod";
import {
  customFieldDataTypes,
  permissionModuleKeys,
  tenantCardStyles,
  tenantDensityPreferences,
  tenantFontPreferences,
  tenantOptionSetKinds,
  tenantSidebarStyles,
  tenantThemeModes,
  type CreateCustomFieldRequestBody,
  type ReplaceTenantOptionSetRequestBody,
  type TenantCoreSettings,
  type TenantTerminologyEntry,
  type TenantThemeSettings,
  type UpdateCustomFieldRequestBody
} from "@crm/types";
import { asyncHandler } from "../../common/http/async-handler.js";
import { createAuthMiddleware } from "../../common/middleware/authenticate.js";
import { requirePermissions } from "../../common/middleware/authorize.js";
import { validateRequest } from "../../common/validation/validate-request.js";
import { env } from "../../config/env.js";
import { DatabaseService } from "../../platform/database/database.service.js";
import { AuthService } from "../auth/auth.service.js";
import { TenantConfigService } from "./tenant-config.service.js";

interface TenantConfigRouterDependencies {
  databaseService: DatabaseService;
}

const moduleKeySchema = z.enum(permissionModuleKeys);
const themeColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const recordSchema = z.record(z.unknown());

const tenantSettingsSchema = z.object({
  workspaceName: z.string().min(2).max(160),
  timezone: z.string().min(2).max(120),
  locale: z.string().min(2).max(32),
  currency: z.string().min(3).max(12),
  dateFormat: z.string().min(2).max(40),
  timeFormat: z.enum(["12h", "24h"])
});

const themeSchema = z.object({
  logo: z.string().max(500).nullable(),
  primaryColor: themeColorSchema,
  secondaryColor: themeColorSchema,
  accentColor: themeColorSchema,
  mode: z.enum(tenantThemeModes),
  sidebarStyle: z.enum(tenantSidebarStyles),
  cardStyle: z.enum(tenantCardStyles),
  fontPreference: z.enum(tenantFontPreferences),
  density: z.enum(tenantDensityPreferences)
});

const moduleSettingsSchema = z.object({
  modules: z.array(
    z.object({
      moduleKey: moduleKeySchema,
      enabled: z.boolean()
    })
  )
});

const terminologySchema = z.object({
  terminology: z.array(
    z.object({
      moduleKey: moduleKeySchema,
      singular: z.string().min(2).max(80),
      plural: z.string().min(2).max(80),
      description: z.string().max(280).nullable()
    })
  )
});

const customFieldCreateSchema = z.object({
  moduleKey: moduleKeySchema,
  entityKey: z.string().min(2).max(120),
  fieldKey: z.string().min(2).max(120).optional(),
  label: z.string().min(2).max(120),
  description: z.string().max(280).optional(),
  dataType: z.enum(customFieldDataTypes),
  placeholder: z.string().max(240).optional(),
  optionSetKey: z.string().min(2).max(160).nullable().optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  settings: recordSchema.optional()
});

const customFieldUpdateSchema = z.object({
  label: z.string().min(2).max(120).optional(),
  description: z.string().max(280).nullable().optional(),
  placeholder: z.string().max(240).nullable().optional(),
  optionSetKey: z.string().min(2).max(160).nullable().optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  settings: recordSchema.optional()
});

const customFieldQuerySchema = z.object({
  moduleKey: moduleKeySchema.optional(),
  entityKey: z.string().min(2).max(120).optional()
});

const fieldIdSchema = z.object({
  fieldId: z.string().uuid()
});

const optionSetKeySchema = z.object({
  setKey: z.string().min(2).max(160)
});

const optionSetReplaceSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(280).nullable().optional(),
  moduleKey: moduleKeySchema.nullable().optional(),
  kind: z.enum(tenantOptionSetKinds),
  options: z.array(
    z.object({
      key: z.string().min(2).max(160),
      label: z.string().min(2).max(120),
      description: z.string().max(280).nullable().optional(),
      color: themeColorSchema.nullable().optional(),
      sortOrder: z.coerce.number().int().min(0).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
      metadata: recordSchema.optional()
    })
  )
});

function getClientIp(request: Request) {
  const forwardedFor = request.header("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return request.ip ?? null;
}

export function createTenantConfigRouter({ databaseService }: TenantConfigRouterDependencies) {
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
  const tenantConfigService = new TenantConfigService(databaseService, {
    enableAuditLogs: env.ENABLE_AUDIT_LOGS
  });

  router.use(authMiddleware);

  router.get(
    "/",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await tenantConfigService.getWorkspace(request.auth!));
    })
  );

  router.get(
    "/settings",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await tenantConfigService.getCoreSettings(request.auth!));
    })
  );

  router.put(
    "/settings",
    requirePermissions({ oneOf: ["admin.edit", "admin.configure"] }),
    validateRequest({
      body: tenantSettingsSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.updateCoreSettings(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as TenantCoreSettings
        )
      );
    })
  );

  router.get(
    "/theme",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await tenantConfigService.getTheme(request.auth!));
    })
  );

  router.put(
    "/theme",
    requirePermissions({ oneOf: ["admin.edit", "admin.configure"] }),
    validateRequest({
      body: themeSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.updateTheme(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as TenantThemeSettings
        )
      );
    })
  );

  router.get(
    "/modules",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await tenantConfigService.getModules(request.auth!));
    })
  );

  router.put(
    "/modules",
    requirePermissions({ oneOf: ["admin.edit", "admin.configure"] }),
    validateRequest({
      body: moduleSettingsSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.updateModules(request.auth!, {
          requestId: request.requestId,
          ipAddress: getClientIp(request),
          userAgent: request.header("user-agent") ?? null
        }, request.body as { modules: Array<{ moduleKey: TenantTerminologyEntry["moduleKey"]; enabled: boolean }> })
      );
    })
  );

  router.get(
    "/terminology",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await tenantConfigService.getTerminology(request.auth!));
    })
  );

  router.put(
    "/terminology",
    requirePermissions({ oneOf: ["admin.edit", "admin.configure"] }),
    validateRequest({
      body: terminologySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.updateTerminology(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as { terminology: TenantTerminologyEntry[] }
        )
      );
    })
  );

  router.get(
    "/custom-fields",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    validateRequest({
      query: customFieldQuerySchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.listCustomFields(request.auth!, {
          moduleKey: request.query.moduleKey as TenantTerminologyEntry["moduleKey"] | undefined,
          entityKey: request.query.entityKey as string | undefined
        })
      );
    })
  );

  router.post(
    "/custom-fields",
    requirePermissions({ oneOf: ["admin.create", "admin.configure"] }),
    validateRequest({
      body: customFieldCreateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await tenantConfigService.createCustomField(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.body as CreateCustomFieldRequestBody
        )
      );
    })
  );

  router.patch(
    "/custom-fields/:fieldId",
    requirePermissions({ oneOf: ["admin.edit", "admin.configure"] }),
    validateRequest({
      params: fieldIdSchema,
      body: customFieldUpdateSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.updateCustomField(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.fieldId,
          request.body as UpdateCustomFieldRequestBody
        )
      );
    })
  );

  router.delete(
    "/custom-fields/:fieldId",
    requirePermissions({ oneOf: ["admin.delete", "admin.configure"] }),
    validateRequest({
      params: fieldIdSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.deleteCustomField(request.auth!, {
          requestId: request.requestId,
          ipAddress: getClientIp(request),
          userAgent: request.header("user-agent") ?? null
        }, request.params.fieldId)
      );
    })
  );

  router.get(
    "/option-sets",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await tenantConfigService.listOptionSets(request.auth!));
    })
  );

  router.put(
    "/option-sets/:setKey",
    requirePermissions({ oneOf: ["admin.edit", "admin.configure"] }),
    validateRequest({
      params: optionSetKeySchema,
      body: optionSetReplaceSchema
    }),
    asyncHandler(async (request, response) => {
      response.status(200).json(
        await tenantConfigService.replaceOptionSet(
          request.auth!,
          {
            requestId: request.requestId,
            ipAddress: getClientIp(request),
            userAgent: request.header("user-agent") ?? null
          },
          request.params.setKey,
          request.body as ReplaceTenantOptionSetRequestBody
        )
      );
    })
  );

  router.get(
    "/form-layouts",
    requirePermissions({ oneOf: ["admin.view", "admin.configure"] }),
    asyncHandler(async (request, response) => {
      response.status(200).json(await tenantConfigService.listFormLayouts(request.auth!));
    })
  );

  return router;
}
