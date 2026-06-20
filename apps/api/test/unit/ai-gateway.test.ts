import { describe, expect, it } from "vitest";
import { aiProviderKeys, createAiProviderRegistry } from "@crm/ai";

describe("AI Gateway: provider registry", () => {
  it("registers a provider for every known provider key", () => {
    const registry = createAiProviderRegistry({});
    for (const key of aiProviderKeys) {
      expect(registry.has(key)).toBe(true);
      expect(registry.get(key)?.key).toBe(key);
    }
  });

  it("reports a provider as configured only when its credentials are present", () => {
    const registry = createAiProviderRegistry({ anthropicApiKey: "sk-test", azureOpenAiApiKey: "k" });
    expect(registry.get("anthropic")?.isConfigured()).toBe(true);
    expect(registry.get("openai")?.isConfigured()).toBe(false);
    // Azure requires both an API key and an endpoint.
    expect(registry.get("azure_openai")?.isConfigured()).toBe(false);
  });

  it("returns a deterministic governed placeholder result through generate()", async () => {
    const registry = createAiProviderRegistry({});
    const provider = registry.get("anthropic")!;
    const result = await provider.generate({
      providerKey: "anthropic",
      model: "claude-opus-4-8",
      prompt: "Summarize this account",
      requestType: "summary",
      tenantId: "tenant-1"
    });
    expect(result.placeholder).toBe(true);
    expect(result.status).toBe("placeholder");
    expect(result.output).toContain("placeholder");
    expect(result.totalTokens).toBe((result.promptTokens ?? 0) + (result.completionTokens ?? 0));
  });
});
