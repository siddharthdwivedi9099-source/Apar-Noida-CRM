import type { RoleSummary } from "@crm/types";
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      userId: string;
      tenantId: string;
      sessionId: string;
      email: string;
      displayName: string;
      roles: RoleSummary[];
      permissionCodes: string[];
    };
    requestId: string;
  }
}
