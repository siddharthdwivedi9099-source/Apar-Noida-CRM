import { ModulePage } from "./module-page";
import { useTenantConfig } from "@/providers/tenant-config-provider";

export function SupportPage() {
  const { getModuleLabel } = useTenantConfig();
  const supportLabel = getModuleLabel("support");
  const ticketLabel = getModuleLabel("support", "singular");

  return (
    <ModulePage
      eyebrow="Service operations"
      title={`${supportLabel} ticketing and service response workflows will be built from this route.`}
      summary={`The ${supportLabel.toLowerCase()} workspace currently exists as a navigable placeholder so that future ${ticketLabel.toLowerCase()} queues, SLAs, AI assist, and escalation flows can arrive on a stable shell.`}
      highlights={[
        {
          title: "Case intake and routing",
          description: `Future ${ticketLabel.toLowerCase()} creation, severity tagging, and queue assignment will live here.`,
          status: "planned"
        },
        {
          title: "Knowledge-assisted response",
          description: "This module is intentionally adjacent to the AI assistant because support will rely heavily on governed retrieval.",
          status: "coming-soon"
        },
        {
          title: "Cross-team continuity",
          description: "The eventual implementation will connect tickets to onboarding, success, and account context.",
          status: "foundation"
        }
      ]}
      implementationGuidance={[
        "Support must reuse account context instead of introducing a disconnected service customer model.",
        "Escalation actions should remain auditable and visible to later success workflows.",
        "This route is a good candidate for future AI draft assistance once the gateway exists."
      ]}
    />
  );
}
