import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  createDocumentRecord,
  deleteUserDocument,
  getDocumentChunks,
  getUserDocumentById,
  listDocumentMessages,
  listUserDocuments,
  markDocumentFailed,
  saveChatMessage,
  searchSimilarChunks,
  storeChunksAndMarkReady,
} from './src/db/documents.ts';
import type { SourceCitation } from './src/db/schema.ts';
import { AuthRequest, requireAuth } from './src/middleware/auth.ts';
import { ragConfig } from './src/server/config.ts';
import { embedTexts, generateGroundedAnswer } from './src/server/gemini.ts';
import { buildDocumentChunks, extractTextPages } from './src/server/ingestion.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ragConfig.maxUploadBytes,
  },
});

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase().trim();
}

async function processDocumentBuffer(params: {
  userId: number;
  filename: string;
  fileType: 'pdf' | 'txt';
  buffer: Buffer;
}) {
  const extracted = await extractTextPages(params.buffer, params.fileType);
  if (extracted.pages.length === 0) {
    const err = new Error(
      params.fileType === 'pdf'
        ? 'No selectable text was found in this PDF. Scanned image-only PDFs are not supported.'
        : 'The uploaded text file is empty.',
    );
    (err as Error & { statusCode?: number }).statusCode = 422;
    throw err;
  }

  const doc = await createDocumentRecord({
    userId: params.userId,
    filename: params.filename,
    fileType: params.fileType,
    sizeBytes: params.buffer.length,
    pageCount: extracted.totalPages,
  });

  try {
    const textChunks = buildDocumentChunks(
      extracted.pages,
      ragConfig.chunkSize,
      ragConfig.chunkOverlap,
    );

    if (textChunks.length === 0) {
      await markDocumentFailed(doc.id, 'No indexable text chunks could be created.');
      const err = new Error('No indexable text chunks could be created.');
      (err as Error & { statusCode?: number }).statusCode = 422;
      throw err;
    }

    const vectors = await embedTexts(textChunks.map((c) => c.content));
    const readyDoc = await storeChunksAndMarkReady(
      doc.id,
      extracted.totalPages,
      textChunks.map((chunk, i) => ({
        chunkIndex: chunk.chunkIndex,
        pageNo: chunk.pageNo,
        content: chunk.content,
        embedding: vectors[i],
      })),
    );

    return readyDoc;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Document processing failed unexpectedly.';
    await markDocumentFailed(doc.id, message).catch(() => {});
    throw err;
  }
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/api/documents', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const docs = await listUserDocuments(req.dbUserId!);
    res.json({ documents: docs });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Unable to load your documents right now.' });
  }
});

app.post(
  '/api/documents',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: `File exceeds the ${ragConfig.maxUploadMb} MB size limit.`,
          });
        }
        return res.status(400).json({ error: err.message });
      }
      if (err) {
        return res.status(400).json({ error: 'Invalid file upload request.' });
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Please select a PDF or TXT file to upload.' });
      }

      const ext = getFileExtension(file.originalname);
      if (!ragConfig.allowedExtensions.has(ext)) {
        return res.status(400).json({
          error: 'Only PDF and TXT files are supported.',
        });
      }

      if (file.size > ragConfig.maxUploadBytes) {
        return res.status(413).json({
          error: `File exceeds the ${ragConfig.maxUploadMb} MB size limit.`,
        });
      }

      const readyDoc = await processDocumentBuffer({
        userId: req.dbUserId!,
        filename: file.originalname,
        fileType: ext as 'pdf' | 'txt',
        buffer: file.buffer,
      });

      res.status(201).json({ document: readyDoc });
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number })?.statusCode;
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to process and index the uploaded document.';
      console.error('Upload error:', error);
      res.status(statusCode || 500).json({ error: message });
    }
  },
);

app.get('/api/documents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const doc = await getUserDocumentById(req.dbUserId!, docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    res.json({ document: doc });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to retrieve document status.' });
  }
});

app.get(
  '/api/documents/:id/messages',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const docId = Number(req.params.id);
      if (!Number.isInteger(docId) || docId <= 0) {
        return res.status(400).json({ error: 'Invalid document ID.' });
      }

      const doc = await getUserDocumentById(req.dbUserId!, docId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      const messages = await listDocumentMessages(docId);
      res.json({ messages });
    } catch (error) {
      console.error('List messages error:', error);
      res.status(500).json({ error: 'Failed to load conversation history.' });
    }
  },
);

app.get(
  '/api/documents/:id/chunks',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const docId = Number(req.params.id);
      if (!Number.isInteger(docId) || docId <= 0) {
        return res.status(400).json({ error: 'Invalid document ID.' });
      }

      const doc = await getUserDocumentById(req.dbUserId!, docId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      const docChunks = await getDocumentChunks(docId);
      res.json({ chunks: docChunks });
    } catch (error) {
      console.error('List chunks error:', error);
      res.status(500).json({ error: 'Failed to load indexed chunks.' });
    }
  },
);

app.post(
  '/api/documents/:id/ask',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const docId = Number(req.params.id);
      if (!Number.isInteger(docId) || docId <= 0) {
        return res.status(400).json({ error: 'Invalid document ID.' });
      }

      const question =
        typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      if (!question) {
        return res.status(400).json({ error: 'Question cannot be empty.' });
      }

      const doc = await getUserDocumentById(req.dbUserId!, docId);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }
      if (doc.status !== 'ready') {
        return res.status(409).json({
          error: 'This document is not ready for questions yet.',
        });
      }

      const [queryVec] = await embedTexts([question]);
      const retrieved = await searchSimilarChunks(docId, queryVec, ragConfig.topK);

      if (retrieved.length === 0) {
        return res.status(404).json({ error: 'No indexed content found for this document.' });
      }

      const answer = await generateGroundedAnswer(
        question,
        retrieved.map((chunk) => ({
          pageNo: chunk.pageNo,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: Number(chunk.score),
        })),
      );

      const sources: SourceCitation[] = retrieved.map((chunk) => ({
        page: chunk.pageNo,
        chunkIndex: chunk.chunkIndex,
        score: Number(Number(chunk.score).toFixed(4)),
        text: chunk.content.slice(0, 260),
      }));

      const userMessage = await saveChatMessage({
        documentId: docId,
        role: 'user',
        content: question,
      });

      const assistantMessage = await saveChatMessage({
        documentId: docId,
        role: 'assistant',
        content: answer,
        sources,
      });

      res.json({
        answer,
        sources,
        userMessage,
        assistantMessage,
      });
    } catch (error) {
      console.error('Ask endpoint error:', error);
      res.status(502).json({
        error:
          'Unable to generate an answer from the language model right now. Please try again.',
      });
    }
  },
);

app.delete('/api/documents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const docId = Number(req.params.id);
    if (!Number.isInteger(docId) || docId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const deleted = await deleteUserDocument(req.dbUserId!, docId);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    res.json({ deleted: true, id: docId });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pulore DocQA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
