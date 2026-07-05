// Distinguishes "summarize the whole document" style questions from
// specific factual lookups. Similarity search is built for the latter
// (a specific question has semantic content to match against); broad
// questions like "what is this about" carry no such anchor and score low
// against every chunk even on-topic, so they need a different retrieval
// strategy (see sampleNamespaceChunks in lib/retrieval.ts).
const BROAD_QUERY_PATTERN =
  /\b(summar(y|ize)|overview|(tell|talk) me about (this|it)|what('|s| is) (this|it)|describe (this|the) (doc(ument)?|file|content)|what does (this|it) (doc(ument)?|file)? ?(says?|contains?|covers?))\b/i;

export function isBroadQuery(query: string): boolean {
  return BROAD_QUERY_PATTERN.test(query.trim());
}
