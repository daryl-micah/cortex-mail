import {
  ClassificationResponseSchema,
  type EmailClassification,
} from './schemas';
import { logLLMCall } from './aiLogger';
import { getGroq, isGroqConfigured } from './groqClient';

/** Whether classification can run at all. False means the key is missing. */
export const isClassifierConfigured = isGroqConfigured;

const MODEL = 'openai/gpt-oss-120b';
// gpt-oss is a reasoning model and its reasoning tokens count against
// max_tokens. A batch of 25 spent most of the budget thinking and got cut off
// mid-JSON, so keep batches small, thinking short, and the ceiling generous.
const BATCH_SIZE = 8;
const MAX_TOKENS = 4000;
const MIN_SPLIT_SIZE = 2;

export interface ClassifiableEmail {
  id: string;
  fromName: string;
  subject: string;
  preview: string;
  date: string;
}

function buildPrompt(emails: ClassifiableEmail[]): string {
  const list = emails
    .map(
      (e) =>
        `- id: ${e.id}\n  from: ${e.fromName}\n  subject: ${e.subject}\n  preview: ${e.preview}\n  date: ${e.date}`
    )
    .join('\n');

  return `Classify each email below into exactly one status:

- needs_reply: the sender is explicitly asking the user to respond, provide something, or take an action.
- waiting_on: the user is waiting on the sender for something (a follow-up, reminder, or status check with no clear ask of the user).
- follow_up: an earlier conversation that has gone quiet and may need the user to check back in.
- important: high-signal but no reply expected (e.g. an account/security notice).
- fyi: informational, no action needed (newsletters, notifications, receipts).
- handled: already resolved / no further action implied.

For each email return { id, status, reason, deadline? }. "reason" is one short sentence explaining the status from the email content. "deadline" is an ISO date only if a specific deadline is mentioned, otherwise omit it. Keep every "reason" under 15 words.

Respond with a single JSON object: { "classifications": [ ... ] } — one entry per email, in the same order, using the exact "id" given. Do not wrap in markdown.

Emails:
${list}`;
}

async function classifyBatch(
  emails: ClassifiableEmail[]
): Promise<EmailClassification[]> {
  if (emails.length === 0) return [];
  const start = Date.now();

  let response;
  try {
    response = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You classify emails for an AI-native inbox. Always respond with valid JSON only.',
        },
        { role: 'user', content: buildPrompt(emails) },
      ],
      temperature: 0.1,
      max_tokens: MAX_TOKENS,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    });
  } catch (err) {
    // A throw here — bad key, rate limit, network — used to skip both logging
    // branches below, so a total outage left no trace anywhere.
    logLLMCall({
      model: MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      success: false,
      retryCount: 0,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  const choice = response.choices[0];
  const content = choice?.message?.content ?? '{}';
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const latencyMs = Date.now() - start;

  // Hitting the token ceiling truncates the JSON mid-object. Retrying the
  // same batch would truncate identically, so split it instead.
  const truncated = choice?.finish_reason === 'length';

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  const result = ClassificationResponseSchema.safeParse(parsed);

  if (!result.success || truncated) {
    const error = truncated
      ? `truncated at ${outputTokens} tokens (finish_reason=length)`
      : result.error!.message;

    logLLMCall({
      model: MODEL,
      inputTokens,
      outputTokens,
      latencyMs,
      success: false,
      retryCount: 0,
      error,
    });

    if (emails.length >= MIN_SPLIT_SIZE * 2) {
      const mid = Math.ceil(emails.length / 2);
      const [a, b] = await Promise.all([
        classifyBatch(emails.slice(0, mid)).catch(() => []),
        classifyBatch(emails.slice(mid)).catch(() => []),
      ]);
      return [...a, ...b];
    }

    // Too small to split — keep whatever parsed cleanly, if anything.
    return result.success ? result.data.classifications : [];
  }

  logLLMCall({
    model: MODEL,
    inputTokens,
    outputTokens,
    latencyMs,
    success: true,
    retryCount: 0,
  });

  return result.data.classifications;
}

/**
 * Classify a list of emails in batches, returning one entry per input email —
 * anything the model omitted comes back as `unclassified` so the caller can
 * cache it and stop asking. Without that the inbox re-requested the same
 * failing emails on every 30s poll and the Today view sat on its skeleton
 * forever.
 *
 * Throws only when every batch threw. A total outage is a different thing from
 * "the model read your mail and had no opinion", and reporting it as the latter
 * is what made this bug invisible twice.
 */
export async function classifyEmails(
  emails: ClassifiableEmail[]
): Promise<EmailClassification[]> {
  const batches: ClassifiableEmail[][] = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE));
  }

  const errors: unknown[] = [];
  const results = await Promise.all(
    batches.map((batch) =>
      classifyBatch(batch).catch((err) => {
        console.warn('[classifier] batch failed:', err);
        errors.push(err);
        return [] as EmailClassification[];
      })
    )
  );

  if (errors.length === batches.length && batches.length > 0) {
    const first = errors[0];
    throw new Error(
      first instanceof Error ? first.message : String(first)
    );
  }

  const byId = new Map<string, EmailClassification>();
  for (const c of results.flat()) {
    byId.set(c.id, c);
  }

  return emails.map(
    (e) =>
      byId.get(e.id) ?? {
        id: e.id,
        status: 'unclassified' as const,
        reason: 'Cortex could not read this one.',
      }
  );
}
