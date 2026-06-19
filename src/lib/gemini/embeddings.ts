import { getGeminiClient, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./client";
import { TaskType, type EmbedContentRequest } from "@google/generative-ai";

type EmbedRequest = EmbedContentRequest & { outputDimensionality: number };

async function embedText(text: string, taskType: TaskType): Promise<number[]> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  const result = await model.embedContent({
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  } as EmbedRequest);

  return result.embedding.values;
}

export async function generateEmbedding(
  text: string,
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT
): Promise<number[]> {
  return embedText(text, taskType);
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  return embedText(text, TaskType.RETRIEVAL_QUERY);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedText(text, TaskType.RETRIEVAL_DOCUMENT));
  }
  return embeddings;
}
