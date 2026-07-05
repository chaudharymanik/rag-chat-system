// Measures whether retrieval-augmented answers are actually better than the
// same model answering with no context, using an LLM-as-judge rubric.
//
// This produces a REAL, reproducible number instead of an asserted one —
// rerun it any time and paste the output into the README/resume.
//
// Caveat: LLM-as-judge scoring has run-to-run variance even at temperature 0.
// Treat the result as directional evidence, not a precise measurement.
//
// Usage: npm run bench:relevance

import "../scripts/load-env";
import { readFileSync } from "node:fs";
import { generateText } from "ai";
import { chatModel } from "../lib/llm";
import { buildSystemPrompt } from "../lib/prompt";
import { retrieveRelevantChunks } from "../lib/retrieval";

type QAPair = { question: string; goldAnswer: string };

async function answerWithRag(question: string): Promise<string> {
  const chunks = await retrieveRelevantChunks(question);
  const system = buildSystemPrompt({ question, chunks, history: "" });
  const { text } = await generateText({
    model: chatModel(),
    system,
    messages: [{ role: "user", content: question }],
  });
  return text;
}

async function answerWithoutRag(question: string): Promise<string> {
  const { text } = await generateText({
    model: chatModel(),
    system: "Answer the question concisely using only your general knowledge.",
    messages: [{ role: "user", content: question }],
  });
  return text;
}

async function judge(question: string, goldAnswer: string, candidate: string): Promise<number> {
  const { text } = await generateText({
    model: chatModel(),
    temperature: 0,
    system:
      "You are grading an answer against a reference answer. " +
      "Rate how well the CANDIDATE answer captures the key facts in the REFERENCE answer, " +
      "on a scale of 1 (no overlap) to 5 (fully captures it). Respond with ONLY the digit.",
    messages: [
      {
        role: "user",
        content: `Question: ${question}\nReference: ${goldAnswer}\nCandidate: ${candidate}`,
      },
    ],
  });

  const digit = Number(text.trim().match(/[1-5]/)?.[0]);
  return Number.isFinite(digit) ? digit : 0;
}

async function main() {
  const fixturesPath = new URL("./fixtures/qa-set.json", import.meta.url);
  const pairs: QAPair[] = JSON.parse(readFileSync(fixturesPath, "utf-8"));

  if (pairs.some((p) => p.question.startsWith("REPLACE ME"))) {
    console.error(
      "benchmarks/fixtures/qa-set.json still has placeholder questions.\n" +
        "Replace them with real questions/answers drawn from your ingested documents first."
    );
    process.exit(1);
  }

  const ragScores: number[] = [];
  const noRagScores: number[] = [];

  for (const pair of pairs) {
    const [ragAnswer, noRagAnswer] = await Promise.all([
      answerWithRag(pair.question),
      answerWithoutRag(pair.question),
    ]);

    const [ragScore, noRagScore] = await Promise.all([
      judge(pair.question, pair.goldAnswer, ragAnswer),
      judge(pair.question, pair.goldAnswer, noRagAnswer),
    ]);

    ragScores.push(ragScore);
    noRagScores.push(noRagScore);

    console.log(`\nQ: ${pair.question}`);
    console.log(`  RAG answer      (score ${ragScore}/5): ${ragAnswer}`);
    console.log(`  No-context answer (score ${noRagScore}/5): ${noRagAnswer}`);
  }

  const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
  const ragAvg = avg(ragScores);
  const noRagAvg = avg(noRagScores);
  const upliftPct = noRagAvg === 0 ? Infinity : ((ragAvg - noRagAvg) / noRagAvg) * 100;

  console.log("\n--- Results ---");
  console.log(`RAG average score:        ${ragAvg.toFixed(2)}/5`);
  console.log(`No-context average score: ${noRagAvg.toFixed(2)}/5`);
  console.log(`Uplift: ${upliftPct.toFixed(1)}%`);
  console.log(
    "\nCaveat: LLM-as-judge scores vary run to run; treat this as directional, not exact."
  );
}

main();
