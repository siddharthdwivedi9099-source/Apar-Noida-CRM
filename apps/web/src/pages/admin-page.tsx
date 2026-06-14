import { ModulePage } from "./module-page";

export function AdminPage() {
  return (
    <ModulePage
      eyebrow="Platform administration"
      title="Tenant, governance, and configuration controls will live here."
      summary="This placeholder page anchors the future administrative workspace for tenant setup, role governance, audit review, AI policy management, and operational controls."
      highlights={[
        {
          title: "Tenant settings",
          description: "Reserved for tenant metadata, environment-safe configuration, and lifecycle controls.",
          status: "foundation"
        },
        {
          title: "Role governance",
          description: "Phase 2 will connect the documented RBAC model to real policies and admin flows.",
          status: "planned"
        },
        {
          title: "Audit visibility",
          description: "Platform and tenant admins will be able to inspect security and AI audit trails here.",
          status: "planned"
        },
        {
          title: "Feature configuration",
          description: "Shared configuration packages are initialized so this area can grow without ad hoc flags.",
          status: "coming-soon"
        }
      ]}
      implementationGuidance={[
        "Keep platform and tenant-level controls separate even when the UI appears unified.",
        "Every future admin action in this area should be auditable and tenant-aware.",
        "Use this route to validate layout density, navigation, and table patterns before live data arrives."
      ]}
    />
  );
}

