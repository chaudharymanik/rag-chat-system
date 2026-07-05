// Measures real p50/p95/p99 latency for concurrent Redis history reads and
// writes, instead of asserting a "sub-100ms" figure. Requires a real Redis
// connection (UPSTASH_REDIS_REST_URL/TOKEN) — fails loudly rather than
// silently falling back to the in-memory store, since that would defeat
// the point of the measurement.
//
// Usage: npm run bench:redis

import "../scripts/load-env";
import { RedisHistoryStore } from "../lib/history/redis-store";

const CONCURRENT_SESSIONS = 50;

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function summarize(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  console.log(
    `${label}: avg ${avg.toFixed(1)}ms, p50 ${percentile(sorted, 50).toFixed(1)}ms, ` +
      `p95 ${percentile(sorted, 95).toFixed(1)}ms, p99 ${percentile(sorted, 99).toFixed(1)}ms, ` +
      `min ${sorted[0].toFixed(1)}ms, max ${sorted[sorted.length - 1].toFixed(1)}ms`
  );
}

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set to run this benchmark " +
        "(it specifically measures Redis, so it won't fall back to in-memory)."
    );
    process.exit(1);
  }

  const store = new RedisHistoryStore();
  const sessionIds = Array.from({ length: CONCURRENT_SESSIONS }, (_, i) => `bench-session-${i}`);

  const writeSamples: number[] = [];
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const start = performance.now();
      await store.append(sessionId, { id: `${sessionId}-msg`, role: "user", content: "benchmark message" });
      writeSamples.push(performance.now() - start);
    })
  );

  const readSamples: number[] = [];
  await Promise.all(
    sessionIds.map(async (sessionId) => {
      const start = performance.now();
      await store.list(sessionId);
      readSamples.push(performance.now() - start);
    })
  );

  console.log(`\n--- Results (${CONCURRENT_SESSIONS} concurrent sessions) ---`);
  summarize("Write (append)", writeSamples);
  summarize("Read (list)", readSamples);

  await Promise.all(sessionIds.map((sessionId) => store.clear(sessionId)));
  console.log("\n(cleaned up benchmark sessions)");
}

main();
