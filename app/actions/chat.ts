"use server";

import { streamText } from "ai";
import { createStreamableValue, type StreamableValue } from "ai/rsc";
import { chatModel } from "@/lib/llm";
import { buildSystemPrompt } from "@/lib/prompt";
import { retrieveRelevantChunks, sampleNamespaceChunks } from "@/lib/retrieval";
import { isBroadQuery } from "@/lib/query-intent";
import { getHistoryStore } from "@/lib/history";
import type { ChatMessage, RetrievedChunk } from "@/lib/types";

type AskResult = {
  stream: StreamableValue<string>;
  sources: RetrievedChunk[];
};

export async function askQuestion(
  sessionId: string,
  conversation: ChatMessage[]
): Promise<AskResult> {
  const history = getHistoryStore();
  const question = conversation[conversation.length - 1];

  await history.append(sessionId, question);

  const sources = isBroadQuery(question.content)
    ? await sampleNamespaceChunks(sessionId)
    : await retrieveRelevantChunks(question.content, sessionId);

  const priorTurns = conversation
    .slice(0, -1)
    .filter((m) => m.role !== "error")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const system = buildSystemPrompt({
    question: question.content,
    chunks: sources,
    history: priorTurns,
  });

  const streamable = createStreamableValue("");

  (async () => {
    const { textStream } = streamText({
      model: chatModel(),
      system,
      messages: [{ role: "user", content: question.content }],
      async onFinish({ text }) {
        await history.append(sessionId, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: text,
          sources,
        });
      },
    });

    for await (const delta of textStream) {
      streamable.update(delta);
    }
    streamable.done();
  })();

  return { stream: streamable.value, sources };
}
