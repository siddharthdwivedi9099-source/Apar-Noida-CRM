export const platformMetadata = {
  name: "AI-Native CRM",
  shortName: "AICRM",
  currentPhase: "Phase 11: SDR and Inside Sales Workspace"
} as const;

export const apiConfig = {
  basePath: "/api",
  version: "v1",
  versionPrefix: "/api/v1"
} as const;

export const environmentGuidance = {
  webPort: 5173,
  apiPort: 4000,
  docsReference: "docs/deployment/DEVOPS_GUIDE.md"
} as const;
