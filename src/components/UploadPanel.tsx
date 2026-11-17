import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { DocumentRecord } from '../types/docqa.ts';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

interface UploadPanelProps {
  documents: DocumentRecord[];
  selectedDocId: number | null;
  loadingDocs: boolean;
  uploading: boolean;
  uploadError: string | null;
  onClearUploadError: () => void;
  onUploadFile: (file: File) => Promise<void>;
  onSelectDocument: (docId: number) => void;
  onDeleteDocument: (docId: number) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function UploadPanel({
  documents,
  selectedDocId,
  loadingDocs,
  uploading,
  uploadError,
  onClearUploadError,
  onUploadFile,
  onSelectDocument,
  onDeleteDocument,
}: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const activeError = localValidationError || uploadError;

  function validateAndSubmit(file: File | undefined) {
    if (!file) return;
    setLocalValidationError(null);
    onClearUploadError();

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext !== 'pdf' && ext !== 'txt') {
      setLocalValidationError(
        `Unsupported file type ".${ext || 'unknown'}". Only PDF and TXT files are supported.`,
      );
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setLocalValidationError(
        `File is ${formatBytes(file.size)}. Maximum allowed size is 10 MB.`,
      );
      return;
    }

    if (file.size === 0) {
      setLocalValidationError('The selected file is empty.');
      return;
    }

    void onUploadFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    validateAndSubmit(file);
    e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSubmit(file);
  }

  async function handleDelete(docId: number) {
    setDeletingId(docId);
    try {
      await onDeleteDocument(docId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white md:w-72 lg:w-80 shrink-0">
      <div className="border-b border-slate-200 p-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
            dragActive
              ? 'border-blue-600 bg-blue-50/60'
              : 'border-slate-300 bg-slate-50/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,application/pdf,text/plain"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Select PDF or TXT document"
          />
          <Upload className="mx-auto h-5 w-5 text-slate-500" />
          <p className="mt-2 text-xs font-medium text-slate-800">
            Drop a PDF or TXT file here
          </p>
          <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
            Selectable text up to 10 MB
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Indexing document...</span>
              </>
            ) : (
              <span>Upload Document</span>
            )}
          </button>
        </div>

        {activeError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            <span className="leading-relaxed">{activeError}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="font-display text-xs font-semibold tracking-wide text-slate-700">
          Indexed Documents
        </h2>
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {documents.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loadingDocs ? (
          <div className="space-y-3 p-4">
            <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
            <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
            <div className="h-12 rounded-lg bg-slate-100 animate-pulse" />
          </div>
        ) : documents.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <FileText className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-700">
              No documents indexed yet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Upload a PDF or TXT file above to extract text, index semantic chunks,
              and begin asking questions.
            </p>
          </div>
        ) : (
          documents.map((doc) => {
            const isSelected = doc.id === selectedDocId;
            return (
              <div
                key={doc.id}
                className={`group flex items-start justify-between gap-2 px-4 py-3 transition-colors ${
                  isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectDocument(doc.id)}
                  className="min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-700 rounded"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate text-sm font-medium ${
                        isSelected ? 'text-blue-900' : 'text-slate-900'
                      }`}
                      title={doc.filename}
                    >
                      {doc.filename}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                    <span className="font-mono uppercase">{doc.fileType}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(doc.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(doc.uploadedAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs">
                    {doc.status === 'ready' && (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-medium">
                          Ready ({doc.chunkCount} chunks)
                        </span>
                      </>
                    )}
                    {doc.status === 'processing' && (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                        <span className="text-amber-700 font-medium">Processing</span>
                      </>
                    )}
                    {doc.status === 'failed' && (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-red-700 font-medium">Failed</span>
                      </>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  disabled={deletingId === doc.id}
                  onClick={() => void handleDelete(doc.id)}
                  aria-label={`Delete ${doc.filename}`}
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
