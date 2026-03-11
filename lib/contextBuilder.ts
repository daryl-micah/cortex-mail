import Groq from 'groq-sdk';
import { countTokens, countMessageTokens } from './tokenCounter';

// ---------------------------------------------------------------------------
// Budget constants (tokens)
// ---------------------------------------------------------------------------
const MAX_CONTEXT_TOKENS = 6000; // Reserve ~2000+ for the response
const RAG_BUDGET = 2000;
// Keep the most recent N messages intact even when summarising
const RECENT_TURNS_TO_KEEP = 6;

// Small fast model for summarisation — keeps latency and cost low
const SUMMARY_MODEL = 'llama-3.1-8b-instant';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface BuiltContext {
  system: string;
  ragContext: string;
  conversation: ContextMessage[];
  /** Set when older turns were LLM-summarised to fit the token budget */
  summarised: boolean;
  budgetUsed: number;
}

// ---------------------------------------------------------------------------
// LLM-based conversation summariser
// Condenses an array of older turns into a single concise summary message.
// ---------------------------------------------------------------------------
async function summariseTurns(turns: ContextMessage[]): Promise<string> {
  if (turns.length === 0) return '';

  const transcript = turns
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const response = await groq.chat.completions.create({
    model: SUMMARY_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a concise summariser. Summarise the following email-assistant conversation into 2–4 sentences, preserving key facts: email IDs referenced, actions taken, user intent, and any pending tasks. Output plain text only.',
      },
      { role: 'user', content: transcript },
    ],
    temperature: 0.1,
    max_tokens: 200,
  });

  return (
    response.choices[0]?.message?.content?.trim() ?? transcript.slice(0, 400)
  );
}

/**
 * Assemble all context layers within the token budget.
 *
 * Priority order (highest to lowest):
 *   1. System prompt (fixed — never trimmed)
 *   2. RAG email context (capped at RAG_BUDGET, truncated if necessary)
 *   3. Conversation history (LLM sliding-window summarisation when over budget)
 */
export async function buildContext(
  systemPrompt: string,
  ragResults: string,
  conversationHistory: ContextMessage[]
): Promise<BuiltContext> {
  const systemTokens = countTokens(systemPrompt);

  // --- RAG context ---
  let ragContext = ragResults;
  let ragTokens = countTokens(ragContext);
  if (ragTokens > RAG_BUDGET) {
    ragContext = ragResults.slice(0, RAG_BUDGET * 4); // ~4 chars/token
    ragTokens = RAG_BUDGET;
  }

  // --- Conversation budget ---
  const conversationBudget = MAX_CONTEXT_TOKENS - systemTokens - ragTokens;

  // --- LLM sliding-window summarisation ---
  let conversation = [...conversationHistory];
  let summarised = false;

  if (
    countMessageTokens(conversation) > conversationBudget &&
    conversation.length > RECENT_TURNS_TO_KEEP
  ) {
    // Split: older turns to summarise + recent turns to keep verbatim
    const cutoff = conversation.length - RECENT_TURNS_TO_KEEP;
    const toSummarise = conversation.slice(0, cutoff);
    const recent = conversation.slice(cutoff);

    // Call LLM to generate a meaningful summary of the older turns
    const summaryText = await summariseTurns(toSummarise);

    const summaryMessage: ContextMessage = {
      role: 'assistant',
      content: `[Conversation summary: ${summaryText}]`,
    };

    conversation = [summaryMessage, ...recent];
    summarised = true;

    // Final safety check — if still over budget, trim the summary itself
    if (countMessageTokens(conversation) > conversationBudget) {
      summaryMessage.content = summaryMessage.content.slice(
        0,
        conversationBudget * 3
      );
    }
  }

  const budgetUsed =
    systemTokens + ragTokens + countMessageTokens(conversation);

  return {
    system: systemPrompt,
    ragContext,
    conversation,
    summarised,
    budgetUsed,
  };
}
