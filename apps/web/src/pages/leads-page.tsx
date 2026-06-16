import { ModulePage } from "./module-page";
import { useTenantConfig } from "@/providers/tenant-config-provider";

export function LeadsPage() {
  const { getModuleLabel } = useTenantConfig();
  const leadLabel = getModuleLabel("leads", "singular");
  const leadsLabel = getModuleLabel("leads");

  return (
    <ModulePage
      eyebrow="Revenue development"
      title={`${leadLabel} qualification and SDR workflows will begin from this route.`}
      summary={`The ${leadsLabel.toLowerCase()} workspace is currently a placeholder surface so we can lock routing, navigation, and shell behavior before introducing qualification logic, assignment rules, and activity flows.`}
      highlights={[
        {
          title: `${leadLabel} intake`,
          description: `Reserved for campaign and channel-sourced ${leadLabel.toLowerCase()} capture and review flows.`,
          status: "planned"
        },
        {
          title: "Qualification",
          description: "Future states, ownership rules, and handoff semantics will attach here.",
          status: "planned"
        },
        {
          title: "Shared activity timeline",
          description: "The shell is ready to support a future CRM-wide activity experience.",
          status: "foundation"
        }
      ]}
      implementationGuidance={[
        "Do not implement lead business rules until tenant context and auth foundations exist.",
        "Keep lead states documented and explainable before introducing automation.",
        "Use the shared types package for future DTOs and state contracts."
      ]}
    />
  );
}
