interface HowItWorksViewProps {
  onReturnToWorkspace: () => void;
}

export function HowItWorksView({ onReturnToWorkspace }: HowItWorksViewProps) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            System Architecture &amp; RAG Specification
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Three-tier Retrieval-Augmented Generation architecture for grounded
            document question answering with verifiable page-level sources.
          </p>
        </div>
        <button
          type="button"
          onClick={onReturnToWorkspace}
          className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap cursor-pointer"
        >
          Open Workspace
        </button>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            01. Ingestion Module
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Validates PDF and TXT uploads up to 10 MB, extracts text page-by-page while
            skipping blank pages, and splits text into overlapping chunks ending at
            sentence boundaries.
          </p>
          <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 font-mono text-xs tabular-nums">
            <div className="flex justify-between">
              <dt className="text-slate-500">Chunk size</dt>
              <dd className="text-slate-900">800 chars</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Overlap</dt>
              <dd className="text-slate-900">120 chars</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Max file size</dt>
              <dd className="text-slate-900">10 MB</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            02. Retrieval Module
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Embeds the natural-language question with Gemini Embedding 2 and executes
            cosine distance similarity search in PostgreSQL pgvector over the selected
            document.
          </p>
          <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 font-mono text-xs tabular-nums">
            <div className="flex justify-between">
              <dt className="text-slate-500">Embedding model</dt>
              <dd className="text-slate-900">gemini-embedding-2</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Vector dims</dt>
              <dd className="text-slate-900">768</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Top-k passages</dt>
              <dd className="text-slate-900">4</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            03. Generation Module
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Builds a grounded prompt with page-labeled passages and instructs Gemini to
            answer strictly from supplied context, explicitly stating when information
            is absent.
          </p>
          <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 font-mono text-xs tabular-nums">
            <div className="flex justify-between">
              <dt className="text-slate-500">Chat model</dt>
              <dd className="text-slate-900">gemini-4-hydrogen</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Database</dt>
              <dd className="text-slate-900">PostgreSQL + pgvector</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Persistence</dt>
              <dd className="text-slate-900">Cloud SQL + Drizzle</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="mt-10 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          REST API Endpoints &amp; Schema Tables
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Method</th>
                <th className="py-2 pr-4 font-medium">Endpoint</th>
                <th className="py-2 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              <tr>
                <td className="py-2.5 pr-4 text-blue-700">POST</td>
                <td className="py-2.5 pr-4 text-slate-900">/api/documents</td>
                <td className="py-2.5 font-sans text-slate-600">
                  Validate, extract text, chunk, embed, and store document
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-emerald-700">GET</td>
                <td className="py-2.5 pr-4 text-slate-900">/api/documents</td>
                <td className="py-2.5 font-sans text-slate-600">
                  List all indexed documents for the authenticated user
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-emerald-700">GET</td>
                <td className="py-2.5 pr-4 text-slate-900">/api/documents/:id</td>
                <td className="py-2.5 font-sans text-slate-600">
                  Retrieve document processing status and metadata
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-blue-700">POST</td>
                <td className="py-2.5 pr-4 text-slate-900">/api/documents/:id/ask</td>
                <td className="py-2.5 font-sans text-slate-600">
                  Embed question, run pgvector cosine search, return answer and sources
                </td>
              </tr>
              <tr>
                <td className="py-2.5 pr-4 text-red-700">DELETE</td>
                <td className="py-2.5 pr-4 text-slate-900">/api/documents/:id</td>
                <td className="py-2.5 font-sans text-slate-600">
                  Remove a document and cascade-delete chunks and chat history
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
