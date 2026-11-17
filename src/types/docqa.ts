export interface SourceCitation {
  page: number;
  chunkIndex: number;
  score: number;
  text: string;
}

export interface DocumentRecord {
  id: number;
  userId: number;
  filename: string;
  fileType: 'pdf' | 'txt';
  sizeBytes: number;
  pageCount: number;
  chunkCount: number;
  status: 'processing' | 'ready' | 'failed';
  errorMessage: string | null;
  uploadedAt: string;
}

export interface ChatMessageRecord {
  id: number | string;
  documentId: number;
  role: 'user' | 'assistant' | 'error';
  content: string;
  sources: SourceCitation[] | null;
  createdAt: string;
}

export interface ChunkRecord {
  id: number;
  chunkIndex: number;
  pageNo: number;
  content: string;
}
