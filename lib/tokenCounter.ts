import { get_encoding } from 'js-tiktoken';

// cl100k_base is used by GPT-4 and is the closest publicly available encoder
// to LLaMA 3's tokenizer — good enough for budget estimation
const encoder = get_encoding('cl100k_base');

/**
 * Count tokens in a plain string
 */
export function countTokens(text: string): number {
  return encoder.encode(text).length;
}

/**
 * Count tokens across a full message array (includes per-message overhead)
 */
export function countMessageTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 2; // conversation-level overhead
  for (const msg of messages) {
    total += 4; // role + formatting overhead per message
    total += countTokens(msg.content);
  }
  return total;
}

/**
 * Allocate the token budget across system, tools, RAG, and conversation layers
 */
export interface TokenBudget {
  systemPrompt: number;
  tools: number;
  ragContext: number;
  conversation: number;
  total: number;
  remaining: number;
}

export function calculateBudget(
  systemPrompt: string,
  toolDescriptions: string,
  ragContext: string,
  conversation: Array<{ role: string; content: string }>,
  maxTokens = 8192
): TokenBudget {
  const systemPromptTokens = countTokens(systemPrompt);
  const toolsTokens = countTokens(toolDescriptions);
  const ragContextTokens = countTokens(ragContext);
  const conversationTokens = countMessageTokens(conversation);
  const total =
    systemPromptTokens + toolsTokens + ragContextTokens + conversationTokens;

  return {
    systemPrompt: systemPromptTokens,
    tools: toolsTokens,
    ragContext: ragContextTokens,
    conversation: conversationTokens,
    total,
    remaining: maxTokens - total,
  };
}
