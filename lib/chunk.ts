const TARGET_CHUNK_WORDS = 300;
const OVERLAP_WORDS = 40;

function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

export function chunkText(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let currentWords: string[] = [];

  const flush = () => {
    if (currentWords.length === 0) return;
    chunks.push(currentWords.join(" "));
  };

  const pushWithOverlap = (nextWords: string[]) => {
    const overlap = currentWords.slice(-OVERLAP_WORDS);
    flush();
    currentWords = [...overlap, ...nextWords];
  };

  for (const paragraph of paragraphs) {
    const paragraphWords = paragraph.split(" ");

    if (paragraphWords.length > TARGET_CHUNK_WORDS * 1.5) {
      // Paragraph too large on its own — split by sentence instead.
      for (const sentence of splitIntoSentences(paragraph)) {
        const sentenceWords = sentence.split(" ");
        if (currentWords.length + sentenceWords.length > TARGET_CHUNK_WORDS) {
          pushWithOverlap(sentenceWords);
        } else {
          currentWords.push(...sentenceWords);
        }
      }
      continue;
    }

    if (currentWords.length + paragraphWords.length > TARGET_CHUNK_WORDS) {
      pushWithOverlap(paragraphWords);
    } else {
      currentWords.push(...paragraphWords);
    }
  }

  flush();
  return chunks;
}
