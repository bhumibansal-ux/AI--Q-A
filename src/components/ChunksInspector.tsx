import { Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChunkRecord } from '../types/docqa.ts';

interface ChunksInspectorProps {
  chunks: ChunkRecord[];
  loading: boolean;
  error: string | null;
}

export function ChunksInspector({ chunks, loading, error }: ChunksInspectorProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chunks;
    return chunks.filter(
      (c) =>
        c.content.toLowerCase().includes(q) ||
        `page ${c.pageNo}`.includes(q) ||
        String(c.chunkIndex).includes(q),
    );
  }, [chunks, query]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-700" />
        <span>Loading indexed vector chunks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <div className="text-xs text-slate-600 tabular-nums">
          Showing {filtered.length} of {chunks.length} indexed chunks (800-char window,
          120-char overlap)
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter chunks or page number..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No chunks match your filter.
          </div>
        ) : (
          filtered.map((chunk) => (
            <div key={chunk.id} className="px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                <span className="font-medium text-slate-800">
                  Chunk #{chunk.chunkIndex + 1}
                </span>
                <span aria-hidden="true">·</span>
                <span>Page {chunk.pageNo}</span>
                <span aria-hidden="true">·</span>
                <span>{chunk.content.length} chars</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">
                {chunk.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
