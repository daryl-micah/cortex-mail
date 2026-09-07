import Groq from 'groq-sdk';
import { InsightSchema, type Insight } from './schemas';
import { logLLMCall } from './aiLogger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'openai/gpt-oss-120b';
const MAX_RETRIES = 1;
const MAX_BODY_CHARS = 6000;

export interface InsightInput {
  subject: string;
  fromName: string;
  body: string;
  userName?: string;
}

function buildPrompt({ subject, fromName, body, userName }: InsightInput): string {
  const trimmed =
    body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}\n[…truncated]` : body;

  return `You are reading one email on behalf of ${userName || 'the user'}.

From: ${fromName}
Subject: ${subject}

---
${trimmed}
---

Return a JSON object with:
- "summary": one plain sentence saying what the sender wants or is telling the user. Name the sender.
- "action": (optional) the concrete thing the user is being asked to do, as a short imperative phrase. Omit if nothing is asked of the user.
- "deadline": (optional) ISO 8601 date only if the email states a specific deadline. Omit otherwise.
- "suggestedReply": (optional) a short reply in the user's voice (2–4 sentences, no subject line, no signature) that addresses the ask. Omit if the email is a newsletter, notification, receipt, or otherwise doesn't warrant a reply.

Respond with the JSON object only. Do not wrap in markdown.`;
}

/**
 * Generate a thread-level insight for one email. Never throws — returns null
 * on any failure so the drawer simply omits the card.
 */
export async function generateInsight(
  input: InsightInput,
  attempt = 0
): Promise<Insight | null> {
  const start = Date.now();

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You summarize emails for an AI-native inbox. Always respond with valid JSON only.',
        },
        { role: 'user', content: buildPrompt(input) },
      ],
      temperature: 0.2,
      max_tokens: 600,
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

    const result = InsightSchema.safeParse(parsed);

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
      if (attempt < MAX_RETRIES) return generateInsight(input, attempt + 1);
      return null;
    }

    logLLMCall({
      model: MODEL,
      inputTokens,
      outputTokens,
      latencyMs,
      success: true,
      retryCount: attempt,
    });

    return result.data;
  } catch (err) {
    console.warn('[insight] failed:', err);
    return null;
  }
}
