import { aiFoundationCards } from "@crm/ai";
import { ModulePage } from "./module-page";

export function AiAssistantPage() {
  return (
    <ModulePage
      eyebrow="AI platform"
      title="The future assistant experience is anchored to the AI Gateway, prompt registry, and agent registry foundations."
      summary="This page demonstrates the app destination for AI-assisted workflows without introducing model calls yet. It is deliberately paired with the documented governance model from Phase 0."
      highlights={aiFoundationCards.map((card) => ({
        title: card.title,
        description: card.description,
        status: card.status
      }))}
      implementationGuidance={[
        "Route all future model access through the gateway instead of feature-local SDK calls.",
        "Use this page for internal-assist workflows first before building autonomous actions.",
        "Keep prompt, agent, and retrieval metadata visible enough for trust and debugging."
      ]}
    />
  );
}

