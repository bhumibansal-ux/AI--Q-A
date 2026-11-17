import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ChatWindow } from './components/ChatWindow.tsx';
import { HowItWorksView } from './components/HowItWorksView.tsx';
import { SignInView } from './components/SignInView.tsx';
import { TopBar, type AppSection } from './components/TopBar.tsx';
import { UploadPanel } from './components/UploadPanel.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import type {
  ChatMessageRecord,
  ChunkRecord,
  DocumentRecord,
} from './types/docqa.ts';

function DocQAApp() {
  const { user, loading: authLoading, authError, signIn, signOut, authFetch } =
    useAuth();

  const [activeSection, setActiveSection] = useState<AppSection>('workspace');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [chunks, setChunks] = useState<ChunkRecord[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [chunksError, setChunksError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await authFetch('/api/documents');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load documents.');
      }
      const docs = (data.documents ?? []) as DocumentRecord[];
      setDocuments(docs);
      setSelectedDocId((prev) => {
        if (prev && docs.some((d) => d.id === prev)) return prev;
        return docs.length > 0 ? docs[0].id : null;
      });
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (user) {
      void loadDocuments();
    } else {
      setDocuments([]);
      setSelectedDocId(null);
      setMessages([]);
      setChunks([]);
    }
  }, [user, loadDocuments]);

  const loadMessages = useCallback(
    async (docId: number) => {
      setLoadingMessages(true);
      try {
        const res = await authFetch(`/api/documents/${docId}/messages`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load chat history.');
        }
        setMessages((data.messages ?? []) as ChatMessageRecord[]);
      } catch (error) {
        console.error('Failed to load messages:', error);
        setMessages([
          {
            id: `err-${Date.now()}`,
            documentId: docId,
            role: 'error',
            content: 'Could not load previous chat messages for this document.',
            sources: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (user && selectedDocId) {
      setChunks([]);
      setChunksError(null);
      void loadMessages(selectedDocId);
    } else {
      setMessages([]);
    }
  }, [user, selectedDocId, loadMessages]);

  async function handleUploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document.');
      }
      const created = data.document as DocumentRecord;
      setDocuments((prev) => [created, ...prev]);
      setSelectedDocId(created.id);
      setActiveSection('workspace');
      setMobileMenuOpen(false);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed. Please try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(docId: number) {
    try {
      const res = await authFetch(`/api/documents/${docId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not delete document.');
      }
      setDocuments((prev) => {
        const remaining = prev.filter((d) => d.id !== docId);
        if (selectedDocId === docId) {
          setSelectedDocId(remaining.length > 0 ? remaining[0].id : null);
        }
        return remaining;
      });
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Failed to delete document.',
      );
    }
  }

  async function handleSendQuestion(question: string) {
    if (!selectedDocId) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticUserMsg: ChatMessageRecord = {
      id: optimisticId,
      documentId: selectedDocId,
      role: 'user',
      content: question,
      sources: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setSending(true);

    try {
      const res = await authFetch(`/api/documents/${selectedDocId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get an answer.');
      }

      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutTemp,
          data.userMessage as ChatMessageRecord,
          data.assistantMessage as ChatMessageRecord,
        ];
      });
    } catch (error) {
      const errorText =
        error instanceof Error
          ? error.message
          : 'Something went wrong while answering. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          documentId: selectedDocId,
          role: 'error',
          content: errorText,
          sources: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  const handleRequestChunks = useCallback(
    async (docId: number) => {
      setLoadingChunks(true);
      setChunksError(null);
      try {
        const res = await authFetch(`/api/documents/${docId}/chunks`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not load document chunks.');
        }
        setChunks((data.chunks ?? []) as ChunkRecord[]);
      } catch (error) {
        setChunksError(
          error instanceof Error ? error.message : 'Failed to load chunks.',
        );
      } finally {
        setLoadingChunks(false);
      }
    },
    [authFetch],
  );

  const selectedDocument =
    documents.find((d) => d.id === selectedDocId) ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setMobileMenuOpen(false);
        }}
        isAuthenticated={!!user}
        onPrimaryAction={() => {
          if (user) {
            void signOut();
          } else {
            void signIn();
          }
        }}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((o) => !o)}
      />

      {authLoading ? (
        <div className="flex flex-1 items-center justify-center py-20 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-700" />
          <span>Checking session...</span>
        </div>
      ) : activeSection === 'architecture' ? (
        <HowItWorksView onReturnToWorkspace={() => setActiveSection('workspace')} />
      ) : !user ? (
        <SignInView onSignIn={() => void signIn()} authError={authError} />
      ) : (
        <div className="relative flex h-[calc(100vh-3.5rem)] flex-1 overflow-hidden">
          <div
            className={`${
              mobileMenuOpen ? 'fixed inset-0 top-14 z-20 flex bg-white' : 'hidden'
            } md:static md:flex`}
          >
            <UploadPanel
              documents={documents}
              selectedDocId={selectedDocId}
              loadingDocs={loadingDocs}
              uploading={uploading}
              uploadError={uploadError}
              onClearUploadError={() => setUploadError(null)}
              onUploadFile={handleUploadFile}
              onSelectDocument={(id) => {
                setSelectedDocId(id);
                setMobileMenuOpen(false);
              }}
              onDeleteDocument={handleDeleteDocument}
            />
          </div>

          <ChatWindow
            document={selectedDocument}
            messages={messages}
            loadingMessages={loadingMessages}
            sending={sending}
            chunks={chunks}
            loadingChunks={loadingChunks}
            chunksError={chunksError}
            onSendQuestion={handleSendQuestion}
            onRequestChunks={(docId) => void handleRequestChunks(docId)}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DocQAApp />
    </AuthProvider>
  );
}
