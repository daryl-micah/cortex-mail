import type { Session } from 'next-auth';

/**
 * Stable per-user key for namespacing server-side data (e.g. the Pinecone
 * index). Prefers the Google account id; falls back to email so an older
 * session cookie minted before `userId` existed still resolves.
 */
export function getUserKey(session: Session): string | null {
  return session.userId ?? session.user?.email ?? null;
}
