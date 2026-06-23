import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiProviderRegistry } from "@crm/ai";

// Helper to stub global.fetch with a single JSON response.
function mockFetchJson(payload: unknown, ok = true, status = 200) {
  const fn = vi.fn(async () => ({
    ok,
    status,
    text: async () => JSON.stringify(payload)
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const req = {
  providerKey: "anthropic" as const,
  model: "claude-opus-4-8",
  prompt: "Summarize the Acme account",
  requestType: "summary",
  tenantId: "tenant-1"
};

describe("AI providers: live integration with placeholder fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns a deterministic placeholder and makes no network call when unconfigured", async () => {
    const fetchFn = mockFetchJson({});
    const provider = createAiProviderRegistry({}).get("anthropic")!;
    expect(provider.isConfigured()).toBe(false);
    const result = await provider.generate(req);
    expect(result.placeholder).toBe(true);
    expect(result.status).toBe("placeholder");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("calls the Anthropic API and maps the response when configured", async () => {
    const fetchFn = mockFetchJson({
      content: [{ type: "text", text: "Acme is a strategic account." }],
      usage: { input_tokens: 12, output_tokens: 7 }
    });
    const provider = createAiProviderRegistry({ anthropicApiKey: "sk-test" }).get("anthropic")!;
    expect(provider.isConfigured()).toBe(true);
    const result = await provider.generate(req);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toContain("api.anthropic.com");
    expect(result.output).toBe("Acme is a strategic account.");
    expect(result.placeholder).toBe(false);
    expect(result.status).toBe("success");
    expect(result.promptTokens).toBe(12);
    expect(result.completionTokens).toBe(7);
  });

  it("calls the OpenAI API and maps choices/usage when configured", async () => {
    const fetchFn = mockFetchJson({
      choices: [{ message: { content: "Hello from OpenAI" } }],
      usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
    });
    const provider = createAiProviderRegistry({ openaiApiKey: "sk-test" }).get("openai")!;
    const result = await provider.generate({ ...req, providerKey: "openai" });
    expect((fetchFn.mock.calls[0] as unknown[])[0]).toContain("api.openai.com");
    expect(result.output).toBe("Hello from OpenAI");
    expect(result.status).toBe("success");
    expect(result.totalTokens).toBe(8);
  });

  it("fails closed to a governed error result on a non-2xx response (does not throw)", async () => {
    mockFetchJson({ error: "rate limited" }, false, 429);
    const provider = createAiProviderRegistry({ anthropicApiKey: "sk-test" }).get("anthropic")!;
    const result = await provider.generate(req);
    expect(result.status).toBe("error");
    expect(result.placeholder).toBe(false);
    expect(result.output).toContain("error");
  });
});
