import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiModel, isAiEnabled } from "@/lib/ai/model";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ai model selection", () => {
  it("isAiEnabled is false without GROQ_API_KEY", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(isAiEnabled()).toBe(false);
  });

  it("isAiEnabled is true when GROQ_API_KEY is set", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    expect(isAiEnabled()).toBe(true);
  });

  it("getAiModel throws ai_disabled without key", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(() => getAiModel()).toThrow("ai_disabled");
  });

  it("getAiModel honours AI_MODEL override", () => {
    vi.stubEnv("GROQ_API_KEY", "gsk_test");
    vi.stubEnv("AI_MODEL", "llama-3.3-70b-versatile");
    const model = getAiModel();
    expect(typeof model === "string" ? model : model.modelId).toBe("llama-3.3-70b-versatile");
  });
});
