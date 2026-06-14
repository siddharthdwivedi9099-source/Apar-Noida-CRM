import { createPlaceholderHealth, type DatabasePlaceholderConfig } from "@crm/database";

export class DatabaseService {
  constructor(private readonly config: DatabasePlaceholderConfig) {}

  getHealth() {
    return createPlaceholderHealth(
      this.config.enabled,
      this.config.driver,
      this.config.enabled
        ? "Database integration is configured as a placeholder for the upcoming persistence phase."
        : "Database integration is currently disabled. Enable it once persistence work begins."
    );
  }
}

