'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppDispatch } from '@/store';
import { openEmail, setView } from '@/store/uiSlice';
import { markAsRead } from '@/store/mailSlice';

interface SearchResult {
  id: string;
  score: number;
  from: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
}

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useAppDispatch();

  const handleSearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await fetch('/api/emails/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), topK: 10 }),
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleOpen = (id: string) => {
    dispatch(openEmail(id));
    dispatch(markAsRead(id));
    dispatch(setView('EMAIL_DETAIL'));
  };

  /** Relevance score (0–1) formatted as a percentage */
  const scoreLabel = (score: number) => `${Math.round(score * 100)}% match`;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Semantic Search</h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <Input
          placeholder='Try "emails about budget Q3" or "messages from Sarah"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Results */}
      {!loading && searched && results.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No emails found for &quot;{query}&quot;.
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            {results.length} result{results.length !== 1 ? 's' : ''} — ranked by
            semantic similarity
          </p>
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleOpen(result.id)}
              className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <span
                  className={`text-sm font-medium truncate ${result.unread ? 'font-semibold' : ''}`}
                >
                  {result.subject || '(no subject)'}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 font-mono bg-muted px-1.5 py-0.5 rounded">
                  {scoreLabel(result.score)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground truncate">
                  {result.from}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {result.date}
                </span>
              </div>
              {result.preview && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {result.preview}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
