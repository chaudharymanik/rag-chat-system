// pdf-parse's main entry (index.js) contains leftover debug code guarded by
// `!module.parent`, which is true (incorrectly) once Next.js's webpack
// bundles it for the server build — causing it to try reading a nonexistent
// test fixture PDF at runtime and crash. Importing the internal
// implementation directly bypasses that broken entry point entirely, but it
// ships no type declarations, hence this ambient module.
declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(dataBuffer: Buffer): Promise<{ text: string }>;
  export default pdfParse;
}
