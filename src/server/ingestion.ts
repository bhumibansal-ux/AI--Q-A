import { extractText } from 'unpdf';

export interface ExtractedPage {
  pageNo: number;
  text: string;
}

export interface TextChunk {
  chunkIndex: number;
  pageNo: number;
  content: string;
}

export async function extractTextPages(
  buffer: Buffer,
  fileType: 'pdf' | 'txt',
): Promise<{ totalPages: number; pages: ExtractedPage[] }> {
  if (fileType === 'pdf') {
    const result = await extractText(new Uint8Array(buffer), {
      mergePages: false,
    });
    const rawPages = Array.isArray(result.text) ? result.text : [String(result.text ?? '')];
    const pages: ExtractedPage[] = [];

    for (let i = 0; i < rawPages.length; i++) {
      const cleaned = rawPages[i].replace(/\s+/g, ' ').trim();
      if (cleaned.length > 0) {
        pages.push({ pageNo: i + 1, text: cleaned });
      }
    }

    return {
      totalPages: result.totalPages || rawPages.length || 1,
      pages,
    };
  }

  const decoded = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
  const pages: ExtractedPage[] = decoded ? [{ pageNo: 1, text: decoded }] : [];
  return {
    totalPages: 1,
    pages,
  };
}

export function chunkText(text: string, size = 800, overlap = 120): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);
    if (end < normalized.length) {
      const sentenceCut = normalized.lastIndexOf('. ', end);
      const newlineCut = normalized.lastIndexOf('\n', end);
      const cut = Math.max(sentenceCut, newlineCut);
      if (cut > start + Math.floor(size / 2)) {
        end = cut + 1;
      }
    }

    const piece = normalized.slice(start, end).trim();
    if (piece.length > 0) {
      chunks.push(piece);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export function buildDocumentChunks(
  pages: ExtractedPage[],
  chunkSize: number,
  chunkOverlap: number,
): TextChunk[] {
  const result: TextChunk[] = [];
  let idx = 0;

  for (const page of pages) {
    const pieces = chunkText(page.text, chunkSize, chunkOverlap);
    for (const piece of pieces) {
      result.push({
        chunkIndex: idx,
        pageNo: page.pageNo,
        content: piece,
      });
      idx += 1;
    }
  }

  return result;
}
