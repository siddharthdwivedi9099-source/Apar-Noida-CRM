import type { PermissionActionKey, PermissionModuleKey } from "./rbac.js";
import type { TenantSummary } from "./tenant-config.js";

export * from "./rbac.js";
export * from "./crm.js";
export * from "./tenant-config.js";
export * from "./ai.js";
export * from "./ai-registry.js";
export * from "./rag.js";
export * from "./customer-query.js";

export type EnvironmentName = "development" | "test" | "production";

export type HealthDependencyStatus = "connected" | "placeholder" | "disabled" | "error";

export interface ConnectionHealth {
  enabled: boolean;
  driver: string;
  status: HealthDependencyStatus;
  message: string;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: EnvironmentName;
  dependencies: {
    database: ConnectionHealth;
    redis: ConnectionHealth;
  };
}

export interface NavItem {
  title: string;
  href: string;
  description: string;
}

export interface ModuleHighlight {
  title: string;
  description: string;
  status: "planned" | "foundation" | "coming-soon";
}

export interface RoleSummary {
  id: string;
  slug: string;
  name: string;
}

export interface PermissionSummary {
  id: string;
  code: string;
  moduleKey: PermissionModuleKey;
  moduleLabel: string;
  actionKey: PermissionActionKey;
  actionLabel: string;
  description: string;
}

export interface RoleDetail extends RoleSummary {
  description: string | null;
  isSystemRole: boolean;
  templateKey: string | null;
  permissions: PermissionSummary[];
  permissionCodes: string[];
  userCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RoleTemplateSummary {
  id: string;
  key: string;
  slug: string;
  name: string;
  description: string;
  permissionCodes: string[];
  permissions: PermissionSummary[];
  metadata: Record<string, unknown>;
}

export interface RbacModuleSummary {
  key: PermissionModuleKey;
  label: string;
}

export interface RbacActionSummary {
  key: PermissionActionKey;
  label: string;
}

export interface RbacCatalogResponse {
  modules: RbacModuleSummary[];
  actions: RbacActionSummary[];
  permissions: PermissionSummary[];
  roleTemplates: RoleTemplateSummary[];
}

export interface RbacRolesResponse {
  roles: RoleDetail[];
}

export interface CreateRoleRequestBody {
  name: string;
  slug: string;
  description?: string;
  templateKey?: string;
  permissionCodes?: string[];
}

export interface UpdateRoleRequestBody {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface ReplaceRolePermissionsRequestBody {
  permissionCodes: string[];
}

export interface RoleResponse {
  role: RoleDetail;
}

export interface RbacUserSummary {
  id: string;
  email: string;
  displayName: string;
  status: string;
  teamName: string | null;
  departmentName: string | null;
  roles: RoleSummary[];
  permissionCodes: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface RbacUsersResponse {
  users: RbacUserSummary[];
}

export interface ReplaceUserRolesRequestBody {
  roleIds: string[];
}

export interface UserRolesResponse {
  user: RbacUserSummary;
}

export interface AuthSessionSummary {
  id: string;
  expiresAt: string;
  lastSeenAt: string;
}

export interface AuthUserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: string;
  tenant: TenantSummary;
  roles: RoleSummary[];
  permissionCodes: string[];
  metadata: Record<string, unknown>;
}

export interface AuthTokens {
  tokenType: "Bearer";
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResponse {
  user: AuthUserSummary;
  session: AuthSessionSummary;
  tokens: AuthTokens;
}

export interface CurrentUserResponse {
  user: AuthUserSummary;
  session: AuthSessionSummary;
}

export interface LoginRequestBody {
  tenantSlug: string;
  email: string;
  password: string;
}

export interface RefreshRequestBody {
  refreshToken?: string;
}

export interface LogoutResponse {
  success: true;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown | null;
  };
}
