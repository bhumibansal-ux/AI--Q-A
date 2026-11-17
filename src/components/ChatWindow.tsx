import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Send,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type {
  ChatMessageRecord,
  ChunkRecord,
  DocumentRecord,
} from '../types/docqa.ts';
import { ChunksInspector } from './ChunksInspector.tsx';

interface ChatWindowProps {
  document: DocumentRecord | null;
  messages: ChatMessageRecord[];
  loadingMessages: boolean;
  sending: boolean;
  chunks: ChunkRecord[];
  loadingChunks: boolean;
  chunksError: string | null;
  onSendQuestion: (question: string) => Promise<void>;
  onRequestChunks: (docId: number) => void;
}

const STARTER_PROMPTS = [
  'What problem does this document address and what is its main objective?',
  'Summarize the system architecture, database tables, and API endpoints.',
  'What testing strategies and defects were identified?',
];

export function ChatWindow({
  document,
  messages,
  loadingMessages,
  sending,
  chunks,
  loadingChunks,
  chunksError,
  onSendQuestion,
  onRequestChunks,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'chunks'>('chat');
  const [openSourcesIds, setOpenSourcesIds] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab('chat');
    setOpenSourcesIds({});
  }, [document?.id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, sending, activeTab]);

  function toggleSources(msgId: number | string) {
    const key = String(msgId);
    setOpenSourcesIds((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function submitQuestion(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending || !document || document.status !== 'ready') return;
    setInput('');
    void onSendQuestion(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  }

  if (!document) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-12 text-center">
        <div className="max-w-md">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-4 font-display text-xl font-semibold text-slate-900">
            Select or upload a document
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Choose an indexed PDF or text document from the sidebar, or upload a new
            file to start asking questions.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-slate-50">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold text-slate-900">
            {document.filename}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums">
            <span className="font-mono uppercase">{document.fileType}</span>
            <span aria-hidden="true">·</span>
            <span>
              {document.pageCount} {document.pageCount === 1 ? 'page' : 'pages'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{document.chunkCount} chunks indexed</span>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Q&amp;A Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('chunks');
              onRequestChunks(document.id);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'chunks'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Indexed Chunks
          </button>
        </div>
      </div>

      {activeTab === 'chunks' ? (
        <ChunksInspector
          chunks={chunks}
          loading={loadingChunks}
          error={chunksError}
        />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
              {document.status === 'failed' && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div>
                    <p className="font-medium">Document indexing failed</p>
                    <p className="mt-0.5 text-xs text-red-700">
                      {document.errorMessage ||
                        'Could not extract or embed text from this document.'}
                    </p>
                  </div>
                </div>
              )}

              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-700" />
                  <span>Loading conversation history...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Ask a question about {document.filename}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    Your question is converted into an embedding, matched against the{' '}
                    <span className="font-mono tabular-nums">{document.chunkCount}</span>{' '}
                    stored chunks using cosine similarity, and answered using only the
                    retrieved passages.
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-slate-500">
                      Try an example question:
                    </p>
                    <div className="flex flex-col gap-2">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          disabled={sending || document.status !== 'ready'}
                          onClick={() => void onSendQuestion(prompt)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-900 disabled:opacity-50 cursor-pointer"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] rounded-lg bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white sm:max-w-[75%]">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  if (msg.role === 'error') {
                    return (
                      <div
                        key={msg.id}
                        role="alert"
                        className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <span>{msg.content}</span>
                      </div>
                    );
                  }

                  const hasSources = Array.isArray(msg.sources) && msg.sources.length > 0;
                  const isOpen = !!openSourcesIds[String(msg.id)];

                  return (
                    <div
                      key={msg.id}
                      className="rounded-lg border border-slate-200 bg-white p-5"
                    >
                      <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                        {msg.content}
                      </div>

                      {hasSources && (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => toggleSources(msg.id)}
                            aria-expanded={isOpen}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 transition-colors hover:text-blue-900 cursor-pointer"
                          >
                            <span>
                              Sources ({msg.sources!.length}{' '}
                              {msg.sources!.length === 1 ? 'passage' : 'passages'})
                            </span>
                            {isOpen ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {isOpen && (
                            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                              {msg.sources!.map((src, idx) => (
                                <div
                                  key={`${src.chunkIndex}-${idx}`}
                                  className="rounded-md bg-slate-50 px-3.5 py-2.5"
                                >
                                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-600 tabular-nums">
                                    <span className="font-medium text-slate-900">
                                      Page {src.page}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      {(src.score * 100).toFixed(1)}% match
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>Chunk #{src.chunkIndex + 1}</span>
                                  </div>
                                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                                    {src.text}
                                    {src.text.length >= 260 ? '…' : ''}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {sending && (
                <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
                  <span>
                    Searching semantic chunks and generating grounded answer...
                  </span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <form
            onSubmit={submitQuestion}
            className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6"
          >
            <div className="mx-auto flex max-w-3xl items-end gap-3">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || document.status !== 'ready'}
                placeholder={
                  document.status === 'ready'
                    ? `Ask a question about ${document.filename}...`
                    : 'Document is not ready for questions...'
                }
                aria-label="Ask a question about the selected document"
                className="min-h-[44px] max-h-32 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={
                  !input.trim() || sending || document.status !== 'ready'
                }
                className="inline-flex h-[44px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Send</span>
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
