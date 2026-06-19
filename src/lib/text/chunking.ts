import { estimateTokens } from "@/lib/utils";

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_CHUNK_OVERLAP = 50;

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): TextChunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: TextChunk[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (estimateTokens(trimmed) > chunkSize) {
      if (currentChunk) {
        chunks.push(createChunk(currentChunk, chunkIndex++));
        currentChunk = "";
      }
      const sentences = splitIntoSentences(trimmed);
      let sentenceBuffer = "";

      for (const sentence of sentences) {
        if (estimateTokens(sentenceBuffer + " " + sentence) > chunkSize && sentenceBuffer) {
          chunks.push(createChunk(sentenceBuffer, chunkIndex++));
          const words = sentenceBuffer.split(/\s+/);
          const overlapWords = words.slice(-Math.floor(overlap / 4));
          sentenceBuffer = overlapWords.join(" ") + " " + sentence;
        } else {
          sentenceBuffer = sentenceBuffer ? sentenceBuffer + " " + sentence : sentence;
        }
      }
      if (sentenceBuffer) {
        chunks.push(createChunk(sentenceBuffer, chunkIndex++));
      }
      continue;
    }

    if (estimateTokens(currentChunk + "\n\n" + trimmed) > chunkSize && currentChunk) {
      chunks.push(createChunk(currentChunk, chunkIndex++));
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 4));
      currentChunk = overlapWords.join(" ") + "\n\n" + trimmed;
    } else {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmed : trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk, chunkIndex));
  }

  return chunks;
}

function createChunk(content: string, index: number): TextChunk {
  return {
    content: content.trim(),
    index,
    tokenCount: estimateTokens(content),
  };
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
