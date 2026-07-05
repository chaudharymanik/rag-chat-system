import type { RetrievedChunk } from "./types";

type PromptInput = {
  question: string;
  chunks: RetrievedChunk[];
  history: string;
};

export function buildSystemPrompt({ question, chunks, history }: PromptInput): string {
  const contextBlock = chunks.length
    ? chunks.map((chunk, i) => `[${i + 1}] ${chunk.content}`).join("\n\n")
    : null;

  return [
    "You are a helpful assistant that answers questions using ONLY the retrieved context below.",
    "Do not use any outside or general knowledge, even if you know the answer — if it isn't in the",
    "retrieved context, it doesn't count. Keep answers short (1-3 sentences) unless the question requires more detail.",
    contextBlock
      ? "If the retrieved context does not fully answer the question, say what's missing instead of guessing or filling gaps from general knowledge."
      : "The retrieved context below is empty, which means nothing relevant was found. You MUST respond that you don't have enough information to answer — do not answer from general knowledge under any circumstance.",
    "",
    contextBlock ? `Retrieved context:\n${contextBlock}` : "Retrieved context: (empty — nothing sufficiently relevant was found)",
    history ? `\nConversation so far:\n${history}` : "",
    `\nQuestion: ${question}`,
    "Answer:",
  ]
    .filter(Boolean)
    .join("\n");
}
