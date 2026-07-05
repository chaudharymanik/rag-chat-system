import pdfParse from "pdf-parse";

const SUPPORTED_EXTENSIONS = new Set(["txt", "md", "pdf"]);

export function isSupportedExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extension.toLowerCase());
}

export async function extractText(buffer: Buffer, extension: string): Promise<string> {
  const ext = extension.toLowerCase();

  if (ext === "pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  // .txt / .md
  return buffer.toString("utf-8");
}
