import Groq from 'groq-sdk';
import {
  ClassificationResponseSchema,
  type EmailClassification,
} from './schemas';
import { logLLMCall } from './aiLogger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'openai/gpt-oss-120b';
const MAX_RETRIES = 1;
const BATCH_SIZE = 25;

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

For each email return { id, status, reason, deadline?, summary? }. "reason" is one short sentence explaining the status from the email content. "deadline" is an ISO date only if a specific deadline is mentioned, otherwise omit it. "summary" is an optional one-sentence summary.

Respond with a single JSON object: { "classifications": [ ... ] } — one entry per email, in the same order, using the exact "id" given. Do not wrap in markdown.

Emails:
${list}`;
}

async function classifyBatch(
  emails: ClassifiableEmail[],
  attempt = 0
): Promise<EmailClassification[]> {
  const start = Date.now();

  const response = await groq.chat.completions.create({
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
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content ?? '{}';
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const latencyMs = Date.now() - start;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  const result = ClassificationResponseSchema.safeParse(parsed);

  if (!result.success) {
    logLLMCall({
      model: MODEL,
      inputTokens,
      outputTokens,
      latencyMs,
      success: false,
      retryCount: attempt,
      error: result.error.message,
    });

    if (attempt < MAX_RETRIES) {
      return classifyBatch(emails, attempt + 1);
    }
    return [];
  }

  logLLMCall({
    model: MODEL,
    inputTokens,
    outputTokens,
    latencyMs,
    success: true,
    retryCount: attempt,
  });

  return result.data.classifications;
}

/**
 * Classify a list of emails in batches. Never throws — a batch failure
 * simply omits those emails from the result so the inbox keeps rendering.
 */
export async function classifyEmails(
  emails: ClassifiableEmail[]
): Promise<EmailClassification[]> {
  const batches: ClassifiableEmail[][] = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    batches.push(emails.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      classifyBatch(batch).catch((err) => {
        console.warn('[classifier] batch failed:', err);
        return [] as EmailClassification[];
      })
    )
  );

  return results.flat();
}
