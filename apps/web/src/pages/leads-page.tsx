import { ModulePage } from "./module-page";

export function LeadsPage() {
  return (
    <ModulePage
      eyebrow="Revenue development"
      title="Lead qualification and SDR workflows will begin from this route."
      summary="The leads workspace is currently a placeholder surface so we can lock routing, navigation, and shell behavior before introducing qualification logic, assignment rules, and activity flows."
      highlights={[
        {
          title: "Lead intake",
          description: "Reserved for campaign and channel-sourced lead capture and review flows.",
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

