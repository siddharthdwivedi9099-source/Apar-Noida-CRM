import { ModulePage } from "./module-page";
import { useTenantConfig } from "@/providers/tenant-config-provider";

export function AccountsPage() {
  const { getModuleLabel } = useTenantConfig();
  const accountLabel = getModuleLabel("accounts", "singular");
  const accountsLabel = getModuleLabel("accounts");

  return (
    <ModulePage
      eyebrow="CRM core"
      title={`${accountsLabel} will become the shared customer context spine for every downstream module.`}
      summary={`This route is where ${accountLabel.toLowerCase()}, contact, stakeholder, and lifecycle visibility will converge. For now it provides the navigation and layout anchor needed before domain modeling begins.`}
      highlights={[
        {
          title: `${accountLabel} system of record`,
          description: `Future ${accountLabel.toLowerCase()} identity, ownership, and relationship views will anchor here.`,
          status: "planned"
        },
        {
          title: "Lifecycle continuity",
          description: "Support, success, onboarding, and revenue modules will all depend on shared account context.",
          status: "foundation"
        },
        {
          title: "Tenant-safe visibility",
          description: "The later implementation must preserve isolation and record-level access decisions.",
          status: "coming-soon"
        }
      ]}
      implementationGuidance={[
        "Treat account modeling as a shared contract, not as a feature-local data shape.",
        "Preserve space for stakeholders, contacts, and timeline views in the upcoming UI iterations.",
        "Avoid creating duplicate customer identity concepts in future modules."
      ]}
    />
  );
}
