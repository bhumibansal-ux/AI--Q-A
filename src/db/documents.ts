import { and, asc, cosineDistance, desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  chatMessages,
  chunks,
  documents,
  type SourceCitation,
} from './schema.ts';

export interface NewChunkInput {
  chunkIndex: number;
  pageNo: number;
  content: string;
  embedding: number[];
}

export async function createDocumentRecord(params: {
  userId: number;
  filename: string;
  fileType: 'pdf' | 'txt';
  sizeBytes: number;
  pageCount: number;
}) {
  try {
    const [created] = await db
      .insert(documents)
      .values({
        userId: params.userId,
        filename: params.filename,
        fileType: params.fileType,
        sizeBytes: params.sizeBytes,
        pageCount: params.pageCount,
        status: 'processing',
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Failed to create document record:', error);
    throw new Error('Could not create document record.', { cause: error });
  }
}

export async function storeChunksAndMarkReady(
  documentId: number,
  pageCount: number,
  chunkRows: NewChunkInput[],
) {
  try {
    return await db.transaction(async (tx) => {
      if (chunkRows.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < chunkRows.length; i += batchSize) {
          const slice = chunkRows.slice(i, i + batchSize);
          await tx.insert(chunks).values(
            slice.map((row) => ({
              documentId,
              chunkIndex: row.chunkIndex,
              pageNo: row.pageNo,
              content: row.content,
              embedding: row.embedding,
            })),
          );
        }
      }

      const [updated] = await tx
        .update(documents)
        .set({
          status: 'ready',
          pageCount,
          chunkCount: chunkRows.length,
          errorMessage: null,
        })
        .where(eq(documents.id, documentId))
        .returning();

      return updated;
    });
  } catch (error) {
    console.error('Failed to store document chunks:', error);
    throw new Error('Failed to store indexed document chunks.', { cause: error });
  }
}

export async function markDocumentFailed(documentId: number, errorMessage: string) {
  try {
    const [updated] = await db
      .update(documents)
      .set({
        status: 'failed',
        errorMessage,
      })
      .where(eq(documents.id, documentId))
      .returning();
    return updated;
  } catch (error) {
    console.error('Failed to mark document as failed:', error);
    throw new Error('Failed to update document status.', { cause: error });
  }
}

export async function listUserDocuments(userId: number) {
  try {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.uploadedAt), desc(documents.id));
  } catch (error) {
    console.error('Failed to list documents:', error);
    throw new Error('Failed to load document library.', { cause: error });
  }
}

export async function getUserDocumentById(userId: number, documentId: number) {
  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .limit(1);
    return doc ?? null;
  } catch (error) {
    console.error('Failed to get document:', error);
    throw new Error('Failed to load document details.', { cause: error });
  }
}

export async function deleteUserDocument(userId: number, documentId: number) {
  try {
    const deleted = await db
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
      .returning({ id: documents.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Failed to delete document:', error);
    throw new Error('Failed to delete document.', { cause: error });
  }
}

export async function getDocumentChunks(documentId: number) {
  try {
    return await db
      .select({
        id: chunks.id,
        chunkIndex: chunks.chunkIndex,
        pageNo: chunks.pageNo,
        content: chunks.content,
      })
      .from(chunks)
      .where(eq(chunks.documentId, documentId))
      .orderBy(asc(chunks.chunkIndex));
  } catch (error) {
    console.error('Failed to fetch document chunks:', error);
    throw new Error('Failed to load document chunks.', { cause: error });
  }
}

export async function searchSimilarChunks(
  documentId: number,
  queryEmbedding: number[],
  topK: number,
) {
  try {
    const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryEmbedding)})`;
    return await db
      .select({
        id: chunks.id,
        chunkIndex: chunks.chunkIndex,
        pageNo: chunks.pageNo,
        content: chunks.content,
        score: similarity,
      })
      .from(chunks)
      .where(eq(chunks.documentId, documentId))
      .orderBy(desc(similarity))
      .limit(topK);
  } catch (error) {
    console.error('Vector similarity search failed:', error);
    throw new Error('Semantic search query failed.', { cause: error });
  }
}

export async function listDocumentMessages(documentId: number) {
  try {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.documentId, documentId))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
  } catch (error) {
    console.error('Failed to fetch chat messages:', error);
    throw new Error('Failed to load conversation history.', { cause: error });
  }
}

export async function saveChatMessage(params: {
  documentId: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[] | null;
}) {
  try {
    const [created] = await db
      .insert(chatMessages)
      .values({
        documentId: params.documentId,
        role: params.role,
        content: params.content,
        sources: params.sources ?? null,
      })
      .returning();
    return created;
  } catch (error) {
    console.error('Failed to save chat message:', error);
    throw new Error('Failed to save chat message.', { cause: error });
  }
}
