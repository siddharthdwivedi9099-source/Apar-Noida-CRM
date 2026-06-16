import { ModulePage } from "./module-page";
import { useTenantConfig } from "@/providers/tenant-config-provider";

export function CampaignsPage() {
  const { getModuleLabel } = useTenantConfig();
  const campaignLabel = getModuleLabel("campaigns", "singular");
  const campaignsLabel = getModuleLabel("campaigns");

  return (
    <ModulePage
      eyebrow="Marketing orchestration"
      title={`${campaignLabel} planning and attribution surfaces will grow here.`}
      summary={`This placeholder route validates the information architecture for marketing and ${campaignsLabel.toLowerCase()} operations while keeping the business logic deferred to later phases.`}
      highlights={[
        {
          title: `${campaignLabel} planning`,
          description: "Reserved for goals, audiences, channels, and ownership setup.",
          status: "planned"
        },
        {
          title: "Attribution lineage",
          description: "Future dashboards will map campaign engagement into leads and opportunities.",
          status: "planned"
        },
        {
          title: "Marketing shell",
          description: "The routed surface is already live and ready for future specialized widgets.",
          status: "foundation"
        }
      ]}
      implementationGuidance={[
        "Keep social media marketing modular rather than blending it directly into core campaign records.",
        "Make attribution lineage reviewable when domain logic lands.",
        "Use placeholder pages like this to pressure-test navigation names early."
      ]}
    />
  );
}
