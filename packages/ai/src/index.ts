export * from "./providers.js";

export const aiFoundationCards = [
  {
    title: "Gateway Policies",
    description: "Model routing, safety, budgets, and auditability will be governed centrally.",
    status: "foundation"
  },
  {
    title: "Prompt Registry",
    description: "Versioned prompts will land as a managed platform asset in upcoming phases.",
    status: "planned"
  },
  {
    title: "Agent Registry",
    description: "Agents will remain policy-scoped, observable, and tenant-aware from the start.",
    status: "planned"
  }
] as const;

