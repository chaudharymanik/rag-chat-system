// Ingests local text/markdown files into the vector index used by
// app/actions/chat.ts, so the chat system can answer questions about
// arbitrary documents (resume, project write-ups, notes, etc.) instead of
// only content added via the Upstash console/SDK.
//
// Usage:
//   npm run ingest -- <path> [path...]
//
// Each path can be a single .md/.txt file or a directory (searched recursively).

import "./load-env";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, basename, join, relative, resolve } from "node:path";
import { upsertChunks } from "../lib/retrieval";
import { chunkText } from "../lib/chunk";

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt"]);

function collectFiles(inputPaths: string[]): string[] {
  const files: string[] = [];

  const walk = (path: string) => {
    const stat = statSync(path);

    if (stat.isDirectory()) {
      const entryName = basename(path);
      if (entryName.startsWith(".") || entryName === "node_modules") return;

      for (const entry of readdirSync(path)) {
        walk(join(path, entry));
      }
      return;
    }

    if (SUPPORTED_EXTENSIONS.has(extname(path).toLowerCase())) {
      files.push(path);
    }
  };

  for (const inputPath of inputPaths) {
    walk(resolve(inputPath));
  }

  return files;
}

function slugify(path: string): string {
  return relative(process.cwd(), path)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const inputPaths = process.argv.slice(2);

  if (inputPaths.length === 0) {
    console.error("Usage: npm run ingest -- <path> [path...]");
    process.exit(1);
  }

  if (!process.env.UPSTASH_VECTOR_REST_URL || !process.env.UPSTASH_VECTOR_REST_TOKEN) {
    console.error(
      "UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN must be set (see .env.example)."
    );
    process.exit(1);
  }

  const files = collectFiles(inputPaths);

  if (files.length === 0) {
    console.error("No .md/.txt files found under the given path(s).");
    process.exit(1);
  }

  let totalChunks = 0;

  for (const file of files) {
    const text = readFileSync(file, "utf-8");
    const chunks = chunkText(text);
    const fileSlug = slugify(file);

    await upsertChunks(
      chunks.map((chunk, i) => ({
        id: `${fileSlug}-${i}`,
        text: chunk,
        metadata: {
          source: basename(file),
          chunkIndex: i,
          ingestedAt: new Date().toISOString(),
        },
      }))
    );

    console.log(`  ${basename(file)} -> ${chunks.length} chunk(s)`);
    totalChunks += chunks.length;
  }

  console.log(
    `\nIngested ${files.length} file(s), ${totalChunks} chunk(s) into ${process.env.UPSTASH_VECTOR_REST_URL}`
  );
}

main();
