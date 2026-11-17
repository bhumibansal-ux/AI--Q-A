import { AlertCircle, ArrowRight } from 'lucide-react';

interface SignInViewProps {
  onSignIn: () => void;
  authError: string | null;
}

export function SignInView({ onSignIn, authError }: SignInViewProps) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-medium tracking-wide text-blue-700">
          Pulore Software Consulting and AI Development
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl [text-wrap:balance]">
          AI-Powered Document Q&amp;A Assistant
        </h1>
        <p className="mt-5 text-base leading-relaxed text-slate-600">
          Upload long PDF or plain-text documents, index semantic vector chunks in
          PostgreSQL with pgvector, and ask questions in natural language. Every
          answer is grounded strictly in retrieved passages and paired with page-level
          sources you can inspect and verify.
        </p>

        {authError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{authError}</span>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Sign in with Google</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-500">
            Supports selectable PDF and TXT files up to 10 MB
          </span>
        </div>
      </div>

      <div className="mt-16 grid gap-8 border-t border-slate-200 pt-10 md:grid-cols-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Ingestion and Chunking
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Extracts selectable text page by page while skipping blank pages, then
            splits content into 800-character overlapping chunks at sentence
            boundaries.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            02. pgvector Semantic Search
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Converts chunks and questions into 768-dimensional embeddings and queries
            PostgreSQL using cosine distance to retrieve the top 4 passages.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            03. Grounded Source Verification
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Instructs the language model to answer solely from supplied context and
            attaches expandable passage excerpts with exact page numbers.
          </p>
        </div>
      </div>
    </main>
  );
}
