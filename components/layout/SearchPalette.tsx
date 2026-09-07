'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { useAppDispatch } from '@/store';
import { openEmail } from '@/store/uiSlice';
import { markAsRead } from '@/store/mailSlice';
import { formatMailDate } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmSendDialog from '@/components/ui/ConfirmSendDialog';
import { useAskCortex } from '@/lib/useAskCortex';

interface SearchResult {
  id: string;
  score: number;
  scoreKind?: 'rerank' | 'cosine';
  from: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
}

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchPalette({ open, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const {
    ask,
    asking,
    answer: askAnswer,
    error: askError,
    showConfirmDialog,
    confirmSend,
    cancelSend,
    reset: resetAsk,
    compose,
  } = useAskCortex({ onReview: onClose });

  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setSearched(false);
    setError('');
    resetAsk();
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open, resetAsk]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const runSearch = async () => {
    const q = query.trim();
    if (!q || loading) return;
    resetAsk();
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await fetch('/api/emails/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, topK: 8 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Search failed');
      }

      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAskCortex = () => {
    const q = query.trim();
    if (!q || asking) return;
    setResults([]);
    setSearched(false);
    setError('');
    ask(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runSearch();
  };

  const handleOpen = (id: string) => {
    dispatch(openEmail(id));
    dispatch(markAsRead(id));
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center pt-[12vh] bg-[#1B1826]/25"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search or ask Cortex"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl mx-4 bg-card bevel rounded-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search emails, or ask Cortex to do something…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={handleAskCortex}
          disabled={!query.trim() || asking}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm border-b border-border hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-muted-foreground">
            Ask Cortex:{' '}
            <span className="text-foreground font-medium">
              {query.trim() ? `“${query.trim()}”` : '…'}
            </span>
          </span>
        </button>

        <div className="max-h-[50vh] overflow-y-auto no-scrollbar">
          {/* Ask Cortex response */}
          {asking && (
            <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
              <span className="animate-pulse">Thinking…</span>
            </div>
          )}
          {!asking && askError && (
            <p className="text-sm text-destructive px-4 py-3">{askError}</p>
          )}
          {!asking && askAnswer && (
            <div className="px-4 py-3 text-sm whitespace-pre-wrap">{askAnswer}</div>
          )}

          {/* Search results */}
          {loading && (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-destructive px-4 py-3">{error}</p>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <p className="text-sm text-muted-foreground px-4 py-3">
              No emails found for &quot;{query}&quot;.
            </p>
          )}

          {!loading &&
            results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleOpen(result.id)}
                className="w-full text-left px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors"
              >
                <div className="flex justify-between items-center gap-2">
                  <span
                    className={`text-sm truncate font-email ${result.unread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                  >
                    {result.subject || '(no subject)'}
                  </span>
                  <span className="chrome-label text-muted-foreground shrink-0">
                    {formatMailDate(result.date)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate font-email">
                    {result.from}
                  </span>
                  <span
                    className="chrome-label text-muted-foreground shrink-0"
                    title={
                      result.scoreKind === 'cosine'
                        ? 'Similarity score (reranker unavailable)'
                        : 'Relevance to your query'
                    }
                  >
                    {Math.round(result.score * 100)}% match
                  </span>
                </div>
                {result.preview && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5 font-email">
                    {result.preview}
                  </p>
                )}
              </button>
            ))}
        </div>

        {!searched && !asking && !askAnswer && !askError && (
          <p className="chrome-label text-muted-foreground px-4 py-3">
            Try: &quot;emails about budget Q3&quot; or &quot;handle my emails from today&quot;
          </p>
        )}
      </div>

      {showConfirmDialog && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmSendDialog
            to={compose.to}
            subject={compose.subject}
            body={compose.body}
            onConfirm={confirmSend}
            onCancel={cancelSend}
          />
        </div>
      )}
    </div>
  );
}
