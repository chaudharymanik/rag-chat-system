// Measures real time-to-first-token (streaming) vs. full completion time
// (simulated "batch" generation), instead of asserting a latency-reduction
// percentage. Averages over several reps to smooth out network jitter.
//
// Usage: npm run bench:streaming

import "../scripts/load-env";
import { generateText, streamText } from "ai";
import { chatModel } from "../lib/llm";

const PROMPT = "Explain what retrieval-augmented generation is in two sentences.";
const REPS = 5;

async function measureStreamingTTFT(): Promise<number> {
  const start = performance.now();
  const { textStream } = streamText({
    model: chatModel(),
    messages: [{ role: "user", content: PROMPT }],
  });

  for await (const _delta of textStream) {
    return performance.now() - start;
  }
  return performance.now() - start;
}

async function measureBatchTime(): Promise<number> {
  const start = performance.now();
  await generateText({
    model: chatModel(),
    messages: [{ role: "user", content: PROMPT }],
  });
  return performance.now() - start;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const ttftSamples: number[] = [];
  const batchSamples: number[] = [];

  for (let i = 0; i < REPS; i++) {
    ttftSamples.push(await measureStreamingTTFT());
    batchSamples.push(await measureBatchTime());
    console.log(`rep ${i + 1}/${REPS} done`);
  }

  const ttftAvg = avg(ttftSamples);
  const batchAvg = avg(batchSamples);
  const reductionPct = ((batchAvg - ttftAvg) / batchAvg) * 100;

  console.log("\n--- Results (ms) ---");
  console.log(`Time-to-first-token: avg ${ttftAvg.toFixed(0)}, median ${median(ttftSamples).toFixed(0)}`);
  console.log(`Full batch response: avg ${batchAvg.toFixed(0)}, median ${median(batchSamples).toFixed(0)}`);
  console.log(`Perceived latency reduction from streaming: ${reductionPct.toFixed(1)}%`);
}

main();
