import "server-only";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

/** Default Groq model; override with AI_MODEL. Chosen by scripts/ai-eval.ts. */
const DEFAULT_MODEL = "openai/gpt-oss-120b";

/** True when the AI features can run (a Groq key is configured). */
export function isAiEnabled(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * The single place the AI provider and model are chosen. Swapping providers
 * (e.g. to Gemini) is a change here only.
 */
export function getAiModel(): LanguageModel {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("ai_disabled");
  const groq = createGroq({ apiKey });
  return groq(process.env.AI_MODEL || DEFAULT_MODEL);
}
