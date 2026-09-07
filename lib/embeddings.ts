import { Pinecone } from '@pinecone-database/pinecone';

// Lazy-initialised singleton so the module can be imported in edge/server
// contexts where process.env is available but without running at module level
let _pinecone: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!_pinecone) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    _pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return _pinecone;
}

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'cortex-mail';

/**
 * Each user gets their own Pinecone namespace so searches never cross
 * accounts. The key is the Google account id (see lib/session.ts).
 */
function namespaceFor(userKey: string): string {
  return `user-${userKey.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
}

function getNamespace(userKey: string) {
  return getPinecone().index({ name: INDEX_NAME }).namespace(namespaceFor(userKey));
}

// ---------------------------------------------------------------------------
// Indexed-id cache
//
// The inbox route calls upsertEmails on every poll with the same page of
// emails. Embedding is a paid inference call, so remember what this process
// has already indexed (per namespace) and only embed genuinely new ids.
// When only the `unread` flag changed, patch the metadata without
// re-embedding. Process-lifetime: a cold start re-embeds one page, then
// settles.
// ---------------------------------------------------------------------------
const MAX_CACHED_IDS_PER_USER = 5000;
const indexedCache = new Map<string, Map<string, boolean>>(); // ns -> id -> unread

function cacheFor(ns: string): Map<string, boolean> {
  let m = indexedCache.get(ns);
  if (!m) {
    m = new Map();
    indexedCache.set(ns, m);
  }
  if (m.size > MAX_CACHED_IDS_PER_USER) m.clear();
  return m;
}

export interface EmailForEmbedding {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
  /** First ~500 characters of the plain-text body */
  bodyText?: string;
}

/**
 * Generate embeddings for an array of texts using Pinecone's
 * hosted multilingual-e5-large model (1024-dim, cosine metric)
 */
export async function embedTexts(
  texts: string[],
  inputType: 'passage' | 'query' = 'passage'
): Promise<number[][]> {
  const pinecone = getPinecone();
  const response = await pinecone.inference.embed({
    model: 'multilingual-e5-large',
    inputs: texts,
    parameters: { inputType, truncate: 'END' },
  });
  return response.data.map((r) => {
    const dense = r as unknown as { values: number[] };
    return Array.from(dense.values);
  });
}

/**
 * Index emails for one user. Embeds subject + preview + bodyText.
 * Skips ids already indexed by this process; if only `unread` changed,
 * updates metadata in place (no embedding call). Batches of 100.
 *
 * @returns counts of what actually hit Pinecone
 */
export async function upsertEmails(
  userKey: string,
  emails: EmailForEmbedding[]
): Promise<{ embedded: number; updated: number; skipped: number }> {
  const result = { embedded: 0, updated: 0, skipped: 0 };
  if (emails.length === 0) return result;

  const ns = namespaceFor(userKey);
  const cache = cacheFor(ns);
  const index = getNamespace(userKey);

  const fresh: EmailForEmbedding[] = [];
  const unreadChanged: EmailForEmbedding[] = [];
  for (const e of emails) {
    if (!cache.has(e.id)) fresh.push(e);
    else if (cache.get(e.id) !== e.unread) unreadChanged.push(e);
    else result.skipped++;
  }

  if (fresh.length > 0) {
    const texts = fresh.map(
      (e) => `${e.subject} ${e.preview} ${e.bodyText ?? ''}`
    );
    const embeddings = await embedTexts(texts);

    const vectors = fresh.map((email, i) => ({
      id: email.id,
      values: embeddings[i],
      metadata: {
        from: email.from,
        subject: email.subject,
        preview: email.preview,
        date: email.date,
        unread: email.unread,
      },
    }));

    for (let i = 0; i < vectors.length; i += 100) {
      await index.upsert({ records: vectors.slice(i, i + 100) });
    }
    for (const e of fresh) cache.set(e.id, e.unread);
    result.embedded = fresh.length;
  }

  for (const e of unreadChanged) {
    await index.update({ id: e.id, metadata: { unread: e.unread } });
    cache.set(e.id, e.unread);
    result.updated++;
  }

  return result;
}

export interface EmailSearchResult {
  id: string;
  score: number;
  from: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
}

/**
 * Semantic similarity search within one user's namespace.
 * The query string is embedded with inputType: 'query' for asymmetric search.
 */
export async function searchEmails(
  userKey: string,
  query: string,
  topK = 10
): Promise<EmailSearchResult[]> {
  const index = getNamespace(userKey);

  // Use 'query' inputType for asymmetric passage retrieval
  const [queryVector] = await embedTexts([query], 'query');

  const results = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  return (results.matches ?? []).map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    from: String(match.metadata?.from ?? ''),
    subject: String(match.metadata?.subject ?? ''),
    preview: String(match.metadata?.preview ?? ''),
    date: String(match.metadata?.date ?? ''),
    unread: Boolean(match.metadata?.unread ?? false),
  }));
}

/**
 * Remove specific emails from the index (e.g., after deletion from Gmail)
 */
export async function deleteEmails(
  userKey: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await getNamespace(userKey).deleteMany({ ids });
  const cache = indexedCache.get(namespaceFor(userKey));
  for (const id of ids) cache?.delete(id);
}
