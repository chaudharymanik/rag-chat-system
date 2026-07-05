# RAG Chat System

A retrieval-augmented generation (RAG) chat system. Upload a document (`.txt`, `.md`, or `.pdf`) and ask questions about it — answers are grounded only in what you've uploaded, with relevance-score filtering to avoid hallucinating from irrelevant matches, streaming responses, and visible source citations. Each browser session gets its own isolated document scope, so uploads never mix between users.

**Live demo:** _add your deployed Vercel URL here_

## How it works

```
document upload (.txt/.md/.pdf)
   │
   ▼
chunked (~300 words, paragraph-aware) and embedded into a per-session
vector namespace (Upstash Vector) — isolated from every other session
   │
   ▼
question
   │
   ▼
vector similarity search, scoped to that session's namespace ──► top-K candidate chunks
   │
   ▼
relevance-score filter (RAG_MIN_SCORE)     ──► drop chunks below threshold
   │
   ▼
prompt grounded ONLY in surviving chunks (model is instructed not to
fall back on outside/general knowledge)
   │
   ▼
streamed completion (Groq/any OpenAI-compatible LLM + Vercel AI SDK)
   │
   ▼
answer + source citations, persisted to history (Redis / in-memory)
```

The relevance filter matters more than it sounds: without it, a chatbot will confidently answer off-topic questions using whatever the top-K vector matches happen to be, even if none of them are actually relevant. Dropping low-score matches means the system can honestly say "I don't have enough information" instead. The threshold (default `0.65`) was calibrated empirically against real multi-topic document chunks, not toy single-sentence examples — see the comment in `lib/retrieval.ts` for the measured score distribution that motivated it.

## Project layout

- `lib/retrieval.ts` — namespaced vector search/upsert + relevance-score thresholding
- `lib/chunk.ts` — shared text chunking (paragraph-aware, sentence-level fallback for oversized paragraphs)
- `lib/extract-text.ts` — text extraction for `.txt`/`.md`/`.pdf`
- `lib/prompt.ts` — system prompt grounded only in retrieved chunks
- `lib/llm.ts` — LLM client (any OpenAI-compatible endpoint; defaults to Groq)
- `lib/history/` — pluggable chat history (Redis-backed, in-memory fallback)
- `app/actions/` — Server Actions: `chat.ts` (RAG pipeline), `upload.ts` (document ingestion), `history.ts`
- `components/chat-panel.tsx` — chat UI: upload control, streaming answers, expandable source citations
- `scripts/ingest.ts` — CLI variant of upload, for pre-seeding a shared namespace (used by the benchmarks below)
- `benchmarks/` — scripts that measure retrieval quality, streaming latency, and Redis concurrency

## Setup

1. Create accounts (free tier is enough for all of these):
   - [Upstash Vector](https://console.upstash.com/vector) — create a **Dense** index with the **cosine** distance metric and an embedding model attached (not "custom/bring your own vectors")
   - [Upstash Redis](https://console.upstash.com/redis) — optional, enables persistent chat history (falls back to in-memory otherwise)
   - [Groq](https://console.groq.com/) — for LLM inference (free tier, no card required; any OpenAI-compatible provider works via `LLM_BASE_URL`)

2. Copy `.env.example` to `.env` and fill in the values from those dashboards.

3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

4. Open the app, upload a `.txt`/`.md`/`.pdf`, and ask questions about it.

## Ingesting documents from the command line

The UI upload is the primary path, but `scripts/ingest.ts` can pre-seed a shared namespace from the command line — useful for the benchmark suite below, which needs a fixed, known dataset:

```bash
npm run ingest -- path/to/file.md path/to/directory
```

## Benchmarks

Rather than assert numbers, these scripts measure them — rerun any of them any time:

```bash
npm run bench:relevance   # RAG vs. no-context answer quality (LLM-as-judge)
npm run bench:streaming   # time-to-first-token vs. full batch generation
npm run bench:redis       # p50/p95/p99 latency across concurrent sessions
```

`bench:relevance` needs real question/answer pairs in `benchmarks/fixtures/qa-set.json` drawn from whatever you've ingested via `scripts/ingest.ts`.

Measured results (llama-3.1-8b-instant via Groq, `text-embedding-3-small` via Upstash Vector):

| Benchmark | Result |
|---|---|
| Retrieval quality uplift (RAG vs. no context) | **+200%** (RAG avg 3.50/5 vs. no-context avg 1.17/5, LLM-as-judge, 6-question set) |
| Streaming latency reduction (TTFT vs. batch) | **37.8%** (TTFT avg 214ms vs. full batch avg 343ms) |
| Redis latency, 50 concurrent sessions | p50 ≈ 430-630ms (measured from a local machine over the internet, not co-located with the database — expect this to drop substantially once measured from a deployment in the same region as the Redis instance) |

Caveats: LLM-as-judge scores have run-to-run variance — treat the relevance number as directional. The relevance run also surfaced a genuine retrieval miss (one question scored 1/5 because the relevant chunk wasn't retrieved), which is disclosed rather than excluded — real RAG systems miss sometimes, and that's worth being able to talk about.

## Deploying

Deploy to Vercel and set the same environment variables as `.env` in the project's dashboard settings. `next.config.ts` pins `outputFileTracingRoot` so the build traces correctly regardless of where the repo is cloned. If chat responses are cut off by function timeouts, add a `vercel.json`:

```json
{
  "functions": {
    "app/**/*": { "maxDuration": 30 }
  }
}
```

## License

MIT License — see the LICENSE file for details.
