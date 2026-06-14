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

