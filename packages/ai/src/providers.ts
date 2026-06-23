// Provider abstraction for the AI Gateway. Each provider makes a real call to
// its upstream API when credentials are configured, and otherwise returns a
// deterministic, governed placeholder result so the platform runs end-to-end
// without external dependencies. The gateway remains the single entry point
// through which every AI call must pass.

export const aiProviderKeys = ["openai", "anthropic", "azure_openai", "local"] as const;
export type AiProviderKey = (typeof aiProviderKeys)[number];

export interface AiProviderRequest {
  providerKey: AiProviderKey;
  model: string;
  prompt: string;
  requestType: string;
  tenantId: string;
  metadata?: Record<string, unknown>;
}

export interface AiProviderResult {
  output: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  placeholder: boolean;
  status: "placeholder" | "success" | "error";
  latencyMs: number;
}

export interface AiProvider {
  readonly key: AiProviderKey;
  readonly label: string;
  isConfigured(): boolean;
  generate(request: AiProviderRequest): Promise<AiProviderResult>;
}

export interface AiProviderRegistryConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  azureOpenAiApiKey?: string;
  azureOpenAiEndpoint?: string;
  localEndpoint?: string;
  // Upper bound on completion tokens requested from upstream providers.
  maxOutputTokens?: number;
  // Network timeout for a single provider call.
  requestTimeoutMs?: number;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const ANTHROPIC_VERSION = "2023-06-01";

function estimateTokens(text: string) {
  // Rough token estimate (~4 characters per token) used when an upstream
  // provider does not return usage figures.
  return Math.max(1, Math.ceil(text.length / 4));
}

// Perform a JSON POST with an enforced timeout. Throws on network failure,
// timeout, or a non-2xx response.
async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Provider responded ${response.status}: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

abstract class BaseProvider implements AiProvider {
  abstract readonly key: AiProviderKey;
  abstract readonly label: string;

  protected abstract configured: boolean;

  constructor(protected readonly options: { maxOutputTokens: number; timeoutMs: number }) {}

  isConfigured() {
    return this.configured;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    const startedAt = Date.now();
    if (!this.configured) {
      return this.placeholderResult(request, startedAt);
    }
    try {
      const result = await this.callProvider(request);
      return { ...result, latencyMs: Math.max(0, Date.now() - startedAt) };
    } catch (error) {
      // Fail closed to a governed error result rather than throwing, so the
      // gateway can log the failure and the caller gets a clean response.
      const message = error instanceof Error ? error.message : "Unknown provider error.";
      return {
        output: `[${this.label} error] The AI provider request failed: ${message}`,
        promptTokens: estimateTokens(request.prompt),
        completionTokens: null,
        totalTokens: null,
        placeholder: false,
        status: "error",
        latencyMs: Math.max(0, Date.now() - startedAt)
      };
    }
  }

  // Real upstream call. Only invoked when the provider is configured.
  protected abstract callProvider(request: AiProviderRequest): Promise<AiProviderResult>;

  protected placeholderResult(request: AiProviderRequest, startedAt: number): AiProviderResult {
    const output =
      `[${this.label} placeholder] AI execution is deferred until provider credentials are configured. ` +
      `Model: ${request.model}. Request type: ${request.requestType}.`;
    const promptTokens = estimateTokens(request.prompt);
    const completionTokens = estimateTokens(output);
    return {
      output,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      placeholder: true,
      status: "placeholder",
      latencyMs: Math.max(0, Date.now() - startedAt)
    };
  }
}

// Map an OpenAI-compatible chat-completions response into a provider result.
function mapOpenAiChatResponse(data: unknown, prompt: string): AiProviderResult {
  const payload = (data ?? {}) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const output = payload.choices?.[0]?.message?.content?.trim() ?? "";
  const promptTokens = payload.usage?.prompt_tokens ?? estimateTokens(prompt);
  const completionTokens = payload.usage?.completion_tokens ?? estimateTokens(output);
  const totalTokens = payload.usage?.total_tokens ?? promptTokens + completionTokens;
  return { output, promptTokens, completionTokens, totalTokens, placeholder: false, status: "success", latencyMs: 0 };
}

class OpenAiProvider extends BaseProvider {
  readonly key = "openai" as const;
  readonly label = "OpenAI";
  protected configured: boolean;
  constructor(private readonly apiKey: string | undefined, options: { maxOutputTokens: number; timeoutMs: number }) {
    super(options);
    this.configured = Boolean(apiKey && apiKey.length > 0);
  }

  protected async callProvider(request: AiProviderRequest): Promise<AiProviderResult> {
    const data = await postJson(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${this.apiKey}` },
      { model: request.model, max_tokens: this.options.maxOutputTokens, messages: [{ role: "user", content: request.prompt }] },
      this.options.timeoutMs
    );
    return mapOpenAiChatResponse(data, request.prompt);
  }
}

class AnthropicProvider extends BaseProvider {
  readonly key = "anthropic" as const;
  readonly label = "Anthropic";
  protected configured: boolean;
  constructor(private readonly apiKey: string | undefined, options: { maxOutputTokens: number; timeoutMs: number }) {
    super(options);
    this.configured = Boolean(apiKey && apiKey.length > 0);
  }

  protected async callProvider(request: AiProviderRequest): Promise<AiProviderResult> {
    const data = await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.apiKey ?? "", "anthropic-version": ANTHROPIC_VERSION },
      { model: request.model, max_tokens: this.options.maxOutputTokens, messages: [{ role: "user", content: request.prompt }] },
      this.options.timeoutMs
    );
    const payload = (data ?? {}) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const output = (payload.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("")
      .trim();
    const promptTokens = payload.usage?.input_tokens ?? estimateTokens(request.prompt);
    const completionTokens = payload.usage?.output_tokens ?? estimateTokens(output);
    return {
      output,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      placeholder: false,
      status: "success",
      latencyMs: 0
    };
  }
}

class AzureOpenAiProvider extends BaseProvider {
  readonly key = "azure_openai" as const;
  readonly label = "Azure OpenAI";
  protected configured: boolean;
  constructor(
    private readonly apiKey: string | undefined,
    private readonly endpoint: string | undefined,
    options: { maxOutputTokens: number; timeoutMs: number }
  ) {
    super(options);
    this.configured = Boolean(apiKey && apiKey.length > 0 && endpoint && endpoint.length > 0);
  }

  protected async callProvider(request: AiProviderRequest): Promise<AiProviderResult> {
    // The model name is used as the Azure deployment id.
    const base = (this.endpoint ?? "").replace(/\/+$/, "");
    const url = `${base}/openai/deployments/${encodeURIComponent(request.model)}/chat/completions?api-version=2024-02-01`;
    const data = await postJson(
      url,
      { "api-key": this.apiKey ?? "" },
      { max_tokens: this.options.maxOutputTokens, messages: [{ role: "user", content: request.prompt }] },
      this.options.timeoutMs
    );
    return mapOpenAiChatResponse(data, request.prompt);
  }
}

class LocalModelProvider extends BaseProvider {
  readonly key = "local" as const;
  readonly label = "Local Model";
  protected configured: boolean;
  constructor(private readonly endpoint: string | undefined, options: { maxOutputTokens: number; timeoutMs: number }) {
    super(options);
    this.configured = Boolean(endpoint && endpoint.length > 0);
  }

  protected async callProvider(request: AiProviderRequest): Promise<AiProviderResult> {
    // Expects an OpenAI-compatible chat-completions endpoint.
    const data = await postJson(
      (this.endpoint ?? "").replace(/\/+$/, ""),
      {},
      { model: request.model, max_tokens: this.options.maxOutputTokens, messages: [{ role: "user", content: request.prompt }] },
      this.options.timeoutMs
    );
    return mapOpenAiChatResponse(data, request.prompt);
  }
}

export function createAiProviderRegistry(config: AiProviderRegistryConfig): Map<AiProviderKey, AiProvider> {
  const options = {
    maxOutputTokens: config.maxOutputTokens && config.maxOutputTokens > 0 ? config.maxOutputTokens : DEFAULT_MAX_OUTPUT_TOKENS,
    timeoutMs: config.requestTimeoutMs && config.requestTimeoutMs > 0 ? config.requestTimeoutMs : DEFAULT_TIMEOUT_MS
  };
  const registry = new Map<AiProviderKey, AiProvider>();
  registry.set("openai", new OpenAiProvider(config.openaiApiKey, options));
  registry.set("anthropic", new AnthropicProvider(config.anthropicApiKey, options));
  registry.set("azure_openai", new AzureOpenAiProvider(config.azureOpenAiApiKey, config.azureOpenAiEndpoint, options));
  registry.set("local", new LocalModelProvider(config.localEndpoint, options));
  return registry;
}
