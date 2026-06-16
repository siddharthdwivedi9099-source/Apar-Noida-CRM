import { ModulePage } from "./module-page";
import { useTenantConfig } from "@/providers/tenant-config-provider";

export function OpportunitiesPage() {
  const { getModuleLabel } = useTenantConfig();
  const opportunityLabel = getModuleLabel("opportunities", "singular");
  const opportunitiesLabel = getModuleLabel("opportunities");

  return (
    <ModulePage
      eyebrow="Sales execution"
      title={`${opportunityLabel} management will later extend this initialized route.`}
      summary={`The shell is ready for ${opportunitiesLabel.toLowerCase()} pipelines, stage progression, collaboration, and forecast-oriented workflows. Phase 1 intentionally stops at the routed UI placeholder.`}
      highlights={[
        {
          title: "Pipeline stages",
          description: "Future stage configuration and progression will sit here with auditable change tracking.",
          status: "planned"
        },
        {
          title: "Presales collaboration",
          description: "Technical discovery and deal support surfaces will integrate into this route later.",
          status: "coming-soon"
        },
        {
          title: "Opportunity context",
          description: "Shared shell and cards are in place so future details pages can expand without redesigning the app.",
          status: "foundation"
        }
      ]}
      implementationGuidance={[
        "Model opportunity lifecycle semantics before building table-heavy views.",
        "Keep commercial, technical, and partner contribution context linked but distinct.",
        "Use the API versioning foundation for future deal endpoints rather than unversioned routes."
      ]}
    />
  );
}
