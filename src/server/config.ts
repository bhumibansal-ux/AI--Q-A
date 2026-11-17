export const ragConfig = {
  llmModel: 'gemini-4-hydrogen',
  embeddingModel: 'gemini-embedding-2',
  embeddingDimensions: 768,
  chunkSize: 800,
  chunkOverlap: 120,
  topK: 4,
  maxUploadMb: 10,
  maxUploadBytes: 10 * 1024 * 1024,
  allowedExtensions: new Set(['pdf', 'txt']),
} as const;
