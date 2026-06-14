import type { ConnectionHealth } from "@crm/types";

export interface DatabasePlaceholderConfig {
  enabled: boolean;
  driver: "postgresql";
  url: string;
}

export interface RedisPlaceholderConfig {
  enabled: boolean;
  driver: "redis";
  url: string;
}

export const createPlaceholderHealth = (
  enabled: boolean,
  driver: string,
  message: string
): ConnectionHealth => ({
  enabled,
  driver,
  status: enabled ? "placeholder" : "disabled",
  message
});

