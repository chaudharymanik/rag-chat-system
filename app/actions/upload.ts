"use server";

import { chunkText } from "@/lib/chunk";
import { extractText, isSupportedExtension } from "@/lib/extract-text";
import { upsertChunks } from "@/lib/retrieval";

export type UploadResult =
  | { success: true; fileName: string; chunkCount: number }
  | { success: false; error: string };

export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const sessionId = formData.get("sessionId");
  const file = formData.get("file");

  if (typeof sessionId !== "string" || !sessionId) {
    return { success: false, error: "Missing session id." };
  }

  if (!(file instanceof File)) {
    return { success: false, error: "No file provided." };
  }

  const extension = file.name.split(".").pop() ?? "";
  if (!isSupportedExtension(extension)) {
    return { success: false, error: "Unsupported file type. Use .txt, .md, or .pdf." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractText(buffer, extension);

  if (!text.trim()) {
    return { success: false, error: "No extractable text found in this file." };
  }

  const chunks = chunkText(text);
  const uploadId = Date.now().toString();

  await upsertChunks(
    chunks.map((chunk, i) => ({
      id: `${uploadId}-${i}`,
      text: chunk,
      metadata: { source: file.name, chunkIndex: i, uploadedAt: new Date().toISOString() },
    })),
    sessionId // each session gets its own isolated namespace, so uploads never mix between users
  );

  return { success: true, fileName: file.name, chunkCount: chunks.length };
}
