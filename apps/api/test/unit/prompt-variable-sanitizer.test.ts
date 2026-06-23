import { describe, expect, it } from "vitest";
import { MAX_PROMPT_VARIABLE_LENGTH, sanitizePromptVariable } from "../../src/modules/ai/ai-gateway.service";

// Regression guard for the AI governance prompt-injection / abuse hardening.
// sanitizePromptVariable is the single chokepoint that normalizes caller-supplied
// values before they are interpolated into a managed prompt template.
describe("AI Gateway: prompt-variable sanitizer", () => {
  it("passes ordinary values through unchanged", () => {
    expect(sanitizePromptVariable("Summarize the Acme account")).toBe("Summarize the Acme account");
    expect(sanitizePromptVariable("Line 1\nLine 2\tTabbed")).toBe("Line 1\nLine 2\tTabbed");
  });

  it("neutralizes the {{ }} template delimiters so a value cannot introduce template tokens", () => {
    expect(sanitizePromptVariable("{{injectedVar}}")).toBe("{ {injectedVar} }");
    expect(sanitizePromptVariable("a {{b}} c")).toBe("a { {b} } c");
  });

  it("strips control characters but keeps tab, newline, and carriage return", () => {
    expect(sanitizePromptVariable("clean\x07\x00end")).toBe("cleanend");
    expect(sanitizePromptVariable("keep\t\n\r")).toBe("keep\t\n\r");
  });

  it("clamps values to the maximum length", () => {
    const oversized = "x".repeat(MAX_PROMPT_VARIABLE_LENGTH + 500);
    const result = sanitizePromptVariable(oversized);
    expect(result.length).toBe(MAX_PROMPT_VARIABLE_LENGTH);
  });

  it("handles empty input", () => {
    expect(sanitizePromptVariable("")).toBe("");
  });
});
