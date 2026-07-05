import { Index } from "@upstash/vector";
import type { RetrievedChunk } from "./types";

// Minimum similarity score (0-1, cosine metric) a retrieved chunk must clear
// to be treated as relevant. Chunks below this are dropped rather than
// stuffed into the prompt, so the model can honestly say "I don't know"
// instead of answering from an unrelated match. Tune with RAG_MIN_SCORE.
//
// Calibrated empirically against text-embedding-3-small on realistic,
// multi-topic ~300-word chunks (not single-sentence toy examples): relevant
// queries scored 0.68-0.73, irrelevant ones scored 0.50-0.55. 0.65 sits in
// the gap between them with margin on both sides.
const DEFAULT_MIN_SCORE = 0.65;
const DEFAULT_TOP_K = 5;

// The default (unnamed) namespace, used by the CLI ingestion script for a
// shared knowledge base. Document uploads through the UI get their own
// per-session namespace instead, so uploads never mix between users.
const DEFAULT_NAMESPACE = "";

let index: Index | null = null;

function getIndex(): Index {
  if (!index) {
    index = new Index();
  }
  return index;
}

function minScore(): number {
  const raw = process.env.RAG_MIN_SCORE;
  return raw ? Number(raw) : DEFAULT_MIN_SCORE;
}

export async function retrieveRelevantChunks(
  query: string,
  namespace: string = DEFAULT_NAMESPACE,
  topK: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  const results = await getIndex().namespace(namespace).query({
    data: query,
    topK,
    includeMetadata: true,
    includeData: true,
  });

  const threshold = minScore();

  return results
    .filter((match) => match.score >= threshold)
    .map((match) => ({
      id: String(match.id),
      score: match.score,
      content: typeof match.data === "string" ? match.data : "",
      metadata: match.metadata as Record<string, unknown> | undefined,
    }));
}

export async function upsertChunks(
  chunks: { id: string; text: string; metadata?: Record<string, unknown> }[],
  namespace: string = DEFAULT_NAMESPACE
): Promise<void> {
  await getIndex()
    .namespace(namespace)
    .upsert(
      chunks.map((chunk) => ({
        id: chunk.id,
        data: chunk.text,
        metadata: chunk.metadata,
      }))
    );
}

export async function clearNamespace(namespace: string): Promise<void> {
  if (!namespace) return; // never wipe the shared default namespace this way
  await getIndex().deleteNamespace(namespace).catch(() => {
    // no-op if the namespace never had anything upserted into it
  });
}

// For broad/summary questions ("tell me about this doc"), similarity search
// doesn't help — a generic question has no strong semantic anchor to match
// against, so it scores low against every chunk even though the question is
// perfectly on-topic. Instead, sample chunks directly in upload order, which
// gives the model actual document content to describe. See isBroadQuery.
export async function sampleNamespaceChunks(
  namespace: string,
  limit: number = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  const { vectors } = await getIndex().namespace(namespace).range({
    cursor: "0",
    limit,
    includeMetadata: true,
    includeData: true,
  });

  return vectors.map((v) => ({
    id: String(v.id),
    score: 1, // not a similarity score — a direct sample, not a ranked match
    content: typeof v.data === "string" ? v.data : "",
    metadata: v.metadata as Record<string, unknown> | undefined,
  }));
}
