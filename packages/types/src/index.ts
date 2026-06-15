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

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
}

export interface RoleSummary {
  id: string;
  slug: string;
  name: string;
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
