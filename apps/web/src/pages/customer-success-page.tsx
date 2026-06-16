import { ModulePage } from "./module-page";
import { useTenantConfig } from "@/providers/tenant-config-provider";

export function CustomerSuccessPage() {
  const { getModuleLabel } = useTenantConfig();
  const customerSuccessLabel = getModuleLabel("customer_success");

  return (
    <ModulePage
      eyebrow="Post-sales growth"
      title={`${customerSuccessLabel}, onboarding, training, and health signals will converge here.`}
      summary="This page is the Phase 1 placeholder for the post-sales operating surface. It already sits in the routed shell so future lifecycle modules can expand on a stable structure."
      highlights={[
        {
          title: "Success plans",
          description: "Reserved for structured goals, milestones, and risk tracking.",
          status: "planned"
        },
        {
          title: "Health visibility",
          description: "Future explainable health scores and portfolio reviews will be surfaced here.",
          status: "coming-soon"
        },
        {
          title: "Onboarding and training links",
          description: "This route is ready to integrate the post-sales modules documented in Phase 0.",
          status: "foundation"
        }
      ]}
      implementationGuidance={[
        "Keep health scoring explainable from the first implementation pass.",
        "Use shared account, ticket, onboarding, and training signals instead of isolated metrics.",
        "Preserve room for executive, manager, and CSM-specific views within the same module."
      ]}
    />
  );
}
