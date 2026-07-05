import { createOpenAI } from "@ai-sdk/openai";

// Any OpenAI-compatible inference provider works here (Groq, Together AI,
// OpenRouter, etc.) — just point LLM_BASE_URL/LLM_API_KEY/LLM_MODEL at it.
// Defaults to Groq's free tier.
const provider = createOpenAI({
  apiKey: process.env.LLM_API_KEY ?? "",
  baseURL: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
});

const DEFAULT_MODEL = "llama-3.1-8b-instant";

export function chatModel() {
  return provider(process.env.LLM_MODEL || DEFAULT_MODEL);
}
