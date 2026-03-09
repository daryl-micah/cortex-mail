import { countTokens, countMessageTokens } from './tokenCounter';

// ---------------------------------------------------------------------------
// Budget constants (tokens)
// ---------------------------------------------------------------------------
const MAX_CONTEXT_TOKENS = 6000; // Reserve ~2000+ for the response
const RAG_BUDGET = 2000;

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface BuiltContext {
  system: string;
  ragContext: string;
  conversation: ContextMessage[];
  /** Set when older turns were summarised to fit the budget */
  summarised: boolean;
  budgetUsed: number;
}

/**
 * Assemble all context layers within the token budget.
 *
 * Priority order (highest to lowest):
 *   1. System prompt (fixed — never trimmed)
 *   2. Tool descriptions (fixed — never trimmed)
 *   3. RAG email context (capped at RAG_BUDGET, truncated if necessary)
 *   4. Conversation history (sliding window with summarisation)
 */
export function buildContext(
  systemPrompt: string,
  ragResults: string,
  conversationHistory: ContextMessage[]
): BuiltContext {
  const systemTokens = countTokens(systemPrompt);

  // --- RAG context ---
  let ragContext = ragResults;
  let ragTokens = countTokens(ragContext);
  if (ragTokens > RAG_BUDGET) {
    // Trim to approximately RAG_BUDGET tokens (~4 chars/token for English)
    ragContext = ragResults.slice(0, RAG_BUDGET * 4);
    ragTokens = RAG_BUDGET;
  }

  // --- Conversation budget ---
  const conversationBudget = MAX_CONTEXT_TOKENS - systemTokens - ragTokens;

  // --- Sliding-window summarisation ---
  let conversation = [...conversationHistory];
  let summarised = false;

  while (
    countMessageTokens(conversation) > conversationBudget &&
    conversation.length > 4
  ) {
    // Drop the oldest user+assistant pair and replace with a brief summary note
    const dropped = conversation.slice(0, 2);
    conversation = conversation.slice(2);
    const summary: ContextMessage = {
      role: 'assistant',
      content: `[Earlier: discussed "${dropped[0]?.content.slice(0, 80)}..."]`,
    };
    conversation = [summary, ...conversation];
    summarised = true;
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
