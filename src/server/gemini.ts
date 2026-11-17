import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ragConfig } from './config.ts';

let cachedClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const status = (error as { status?: number })?.status;
      if (status === 400 || status === 401 || status === 403 || status === 404) {
        throw error;
      }
      if (attempt < maxAttempts) {
        const delayMs = 400 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

async function embedSingleText(ai: GoogleGenAI, text: string): Promise<number[]> {
  const result = await withRetry(() =>
    ai.models.embedContent({
      model: ragConfig.embeddingModel,
      contents: text,
      config: {
        outputDimensionality: ragConfig.embeddingDimensions,
      },
    }),
  );

  const values = result.embeddings?.[0]?.values ?? [];
  if (values.length !== ragConfig.embeddingDimensions) {
    throw new Error(
      `Expected ${ragConfig.embeddingDimensions}-dimensional vector, got ${values.length}.`,
    );
  }
  return values;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getGeminiClient();
  const vectors: number[][] = new Array(texts.length);
  const concurrency = 8;

  for (let i = 0; i < texts.length; i += concurrency) {
    const slice = texts.slice(i, i + concurrency);
    const batchVectors = await Promise.all(
      slice.map((text) => embedSingleText(ai, text)),
    );
    for (let j = 0; j < batchVectors.length; j++) {
      vectors[i + j] = batchVectors[j];
    }
  }

  return vectors;
}

export interface RetrievedChunkContext {
  pageNo: number;
  chunkIndex: number;
  content: string;
  score: number;
}

const SYSTEM_INSTRUCTION =
  'You are a document assistant. Answer the question using only the context provided. ' +
  'If the answer is not in the context, say clearly that you could not find it in the document. ' +
  'Mention page numbers when possible. Do not invent facts outside the supplied passages.';

export function buildGroundedPrompt(
  question: string,
  chunks: RetrievedChunkContext[],
): string {
  const context = chunks
    .map((chunk) => `[Page ${chunk.pageNo}] ${chunk.content}`)
    .join('\n\n');
  return `Context:\n${context}\n\nQuestion: ${question}`;
}

export async function generateGroundedAnswer(
  question: string,
  chunks: RetrievedChunkContext[],
): Promise<string> {
  const ai = getGeminiClient();
  const prompt = buildGroundedPrompt(question, chunks);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: ragConfig.llmModel,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    }),
  );

  const text = response.text?.trim();
  if (!text) {
    throw new Error('The language model returned an empty response.');
  }
  return text;
}
