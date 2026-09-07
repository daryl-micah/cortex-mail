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

// ---------------------------------------------------------------------------
// Retrieval tuning
// ---------------------------------------------------------------------------

/** How many candidates the dense stage pulls before reranking. */
const CANDIDATE_K = 30;

/** Cross-encoder used to reorder the dense candidates. */
const RERANK_MODEL = process.env.PINECONE_RERANK_MODEL || 'bge-reranker-v2-m3';

/**
 * How much recency is allowed to matter. A brand-new email keeps 100% of its
 * relevance score, an infinitely old one keeps (1 - RECENCY_WEIGHT). Small on
 * purpose: this breaks ties between comparably relevant mail, it does not
 * out-rank a better match.
 */
const RECENCY_WEIGHT = 0.15;

/** Age at which the recency term has decayed to ~37%. */
const RECENCY_DECAY_DAYS = 90;

/** Characters of body kept in metadata for the reranker to read. */
const SNIPPET_CHARS = 900;

export interface EmailForEmbedding {
  id: string;
  /** Raw From header, e.g. `"Sarah Chen" <sarah@acme.com>` */
  from: string;
  /** Display name only, e.g. `Sarah Chen` */
  fromName?: string;
  /** Address only, e.g. `sarah@acme.com` */
  fromEmail?: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
  /** First ~500 characters of the plain-text body */
  bodyText?: string;
}

/**
 * The text that actually gets embedded.
 *
 * Sender and date are included deliberately: they are the two things users
 * most often search by ("the invoice from Sarah", "that thing from last
 * March") and neither is recoverable from subject/body alone. The date is
 * spelled out in words because digits embed poorly.
 */
function buildIndexText(e: EmailForEmbedding): string {
  const name = e.fromName || e.from;
  const parsed = new Date(e.date);
  const when = Number.isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  return [
    `From: ${name}${e.fromEmail && e.fromEmail !== name ? ` <${e.fromEmail}>` : ''}`,
    when ? `Date: ${when}` : '',
    `Subject: ${e.subject}`,
    e.preview,
    e.bodyText ?? '',
  ]
    .filter(Boolean)
    .join('\n');
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
 * Index emails for one user. Embeds sender, date, subject, preview and body.
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
    const embeddings = await embedTexts(fresh.map(buildIndexText));

    const vectors = fresh.map((email, i) => ({
      id: email.id,
      values: embeddings[i],
      metadata: {
        from: email.from,
        fromName: email.fromName ?? email.from,
        subject: email.subject,
        preview: email.preview,
        date: email.date,
        unread: email.unread,
        // Kept so the reranker has real content to score against without a
        // second round-trip to Gmail.
        snippet: (email.bodyText ?? email.preview ?? '').slice(0, SNIPPET_CHARS),
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
  /**
   * Relevance in [0,1]. When `scoreKind` is `rerank` this is a cross-encoder
   * score, which spreads across the full range and is meaningful to show as a
   * percentage. When the reranker is unavailable it falls back to raw cosine
   * similarity, which clusters in a narrow high band.
   */
  score: number;
  scoreKind: 'rerank' | 'cosine';
  from: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
}

interface Candidate {
  id: string;
  cosine: number;
  from: string;
  subject: string;
  preview: string;
  snippet: string;
  date: string;
  unread: boolean;
}

/**
 * Multiplier in [1 - RECENCY_WEIGHT, 1] that decays with age. Applied after
 * reranking so it nudges ordering without inventing relevance.
 */
function recencyFactor(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 1 - RECENCY_WEIGHT;
  const ageDays = Math.max(0, (Date.now() - t) / 86_400_000);
  const decay = Math.exp(-ageDays / RECENCY_DECAY_DAYS);
  return 1 - RECENCY_WEIGHT + RECENCY_WEIGHT * decay;
}

/** What the cross-encoder actually reads for each candidate. */
function buildRerankText(c: Candidate): string {
  return [
    `From: ${c.from}`,
    `Subject: ${c.subject}`,
    c.snippet || c.preview,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);
}

/**
 * Two-stage semantic search within one user's namespace.
 *
 *   1. Dense retrieval pulls CANDIDATE_K candidates (cheap, high recall, but
 *      blurs names, numbers and other exact tokens).
 *   2. A cross-encoder reranks those candidates against the query, which is
 *      what actually fixes "the obvious match is 4th".
 *   3. A mild recency factor breaks ties toward newer mail.
 *
 * If the reranker is unavailable the dense order is returned unchanged and
 * `scoreKind` says so, rather than failing the search.
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
    topK: Math.max(CANDIDATE_K, topK),
    includeMetadata: true,
  });

  const candidates: Candidate[] = (results.matches ?? []).map((match) => ({
    id: match.id,
    cosine: match.score ?? 0,
    from: String(match.metadata?.fromName ?? match.metadata?.from ?? ''),
    subject: String(match.metadata?.subject ?? ''),
    preview: String(match.metadata?.preview ?? ''),
    snippet: String(match.metadata?.snippet ?? ''),
    date: String(match.metadata?.date ?? ''),
    unread: Boolean(match.metadata?.unread ?? false),
  }));

  if (candidates.length === 0) return [];

  const toResult = (
    c: Candidate,
    score: number,
    scoreKind: 'rerank' | 'cosine'
  ): EmailSearchResult => ({
    id: c.id,
    score,
    scoreKind,
    from: c.from,
    subject: c.subject,
    preview: c.preview,
    date: c.date,
    unread: c.unread,
  });

  try {
    const reranked = await getPinecone().inference.rerank({
      model: RERANK_MODEL,
      query,
      documents: candidates.map((c) => ({
        id: c.id,
        text: buildRerankText(c),
      })),
      rankFields: ['text'],
      returnDocuments: false,
      topN: candidates.length,
    });

    return reranked.data
      .map((row) => {
        const c = candidates[row.index];
        if (!c) return null;
        return toResult(c, row.score * recencyFactor(c.date), 'rerank');
      })
      .filter((r): r is EmailSearchResult => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch (error) {
    console.warn('[search] rerank unavailable, using dense order:', error);
    return candidates
      .slice(0, topK)
      .map((c) => toResult(c, c.cosine, 'cosine'));
  }
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
