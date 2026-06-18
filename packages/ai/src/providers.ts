// Provider abstraction for the AI Gateway. All concrete providers are
// placeholders in this phase: they do not call external APIs and return a
// deterministic, governed placeholder result. The gateway is the single entry
// point through which every AI call must pass.

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
}

function estimateTokens(text: string) {
  // Rough placeholder token estimate (~4 characters per token).
  return Math.max(1, Math.ceil(text.length / 4));
}

abstract class BasePlaceholderProvider implements AiProvider {
  abstract readonly key: AiProviderKey;
  abstract readonly label: string;

  protected abstract configured: boolean;

  isConfigured() {
    return this.configured;
  }

  async generate(request: AiProviderRequest): Promise<AiProviderResult> {
    const startedAt = Date.now();
    const output =
      `[${this.label} placeholder] AI execution is deferred until provider credentials are configured and the AI Gateway phase enables live calls. ` +
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

class OpenAiProvider extends BasePlaceholderProvider {
  readonly key = "openai" as const;
  readonly label = "OpenAI";
  protected configured: boolean;
  constructor(apiKey?: string) {
    super();
    this.configured = Boolean(apiKey && apiKey.length > 0);
  }
}

class AnthropicProvider extends BasePlaceholderProvider {
  readonly key = "anthropic" as const;
  readonly label = "Anthropic";
  protected configured: boolean;
  constructor(apiKey?: string) {
    super();
    this.configured = Boolean(apiKey && apiKey.length > 0);
  }
}

class AzureOpenAiProvider extends BasePlaceholderProvider {
  readonly key = "azure_openai" as const;
  readonly label = "Azure OpenAI";
  protected configured: boolean;
  constructor(apiKey?: string, endpoint?: string) {
    super();
    this.configured = Boolean(apiKey && apiKey.length > 0 && endpoint && endpoint.length > 0);
  }
}

class LocalModelProvider extends BasePlaceholderProvider {
  readonly key = "local" as const;
  readonly label = "Local Model";
  protected configured: boolean;
  constructor(endpoint?: string) {
    super();
    this.configured = Boolean(endpoint && endpoint.length > 0);
  }
}

export function createAiProviderRegistry(config: AiProviderRegistryConfig): Map<AiProviderKey, AiProvider> {
  const registry = new Map<AiProviderKey, AiProvider>();
  registry.set("openai", new OpenAiProvider(config.openaiApiKey));
  registry.set("anthropic", new AnthropicProvider(config.anthropicApiKey));
  registry.set("azure_openai", new AzureOpenAiProvider(config.azureOpenAiApiKey, config.azureOpenAiEndpoint));
  registry.set("local", new LocalModelProvider(config.localEndpoint));
  return registry;
}
