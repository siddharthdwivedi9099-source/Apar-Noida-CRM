import { ModulePage } from "./module-page";

export function CampaignsPage() {
  return (
    <ModulePage
      eyebrow="Marketing orchestration"
      title="Campaign planning and attribution surfaces will grow here."
      summary="This placeholder route validates the information architecture for marketing and campaign operations while keeping the business logic deferred to later phases."
      highlights={[
        {
          title: "Campaign planning",
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

