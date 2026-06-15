import type { ConnectionHealth } from "@crm/types";

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
