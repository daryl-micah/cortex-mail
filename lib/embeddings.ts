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
 * Upsert an array of emails into the Pinecone index.
 * Embeddings are generated from subject + preview + bodyText.
 * Batches of 100 to respect Pinecone's recommendation.
 */
export async function upsertEmails(emails: EmailForEmbedding[]): Promise<void> {
  if (emails.length === 0) return;

  const pinecone = getPinecone();
  const index = pinecone.index({ name: INDEX_NAME });

  const texts = emails.map(
    (e) => `${e.subject} ${e.preview} ${e.bodyText ?? ''}`
  );
  const embeddings = await embedTexts(texts);

  const vectors = emails.map((email, i) => ({
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
 * Perform a semantic similarity search against the Pinecone index.
 * The query string is embedded with inputType: 'query' for asymmetric search.
 */
export async function searchEmails(
  query: string,
  topK = 10
): Promise<EmailSearchResult[]> {
  const pinecone = getPinecone();
  const index = pinecone.index({ name: INDEX_NAME });

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
export async function deleteEmails(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const pinecone = getPinecone();
  const index = pinecone.index({ name: INDEX_NAME });
  await index.deleteMany(ids);
}
