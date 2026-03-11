import Groq from 'groq-sdk';
import {
  AgentThoughtSchema,
  type AgentStep,
  type AgentAction,
} from './schemas';
import { executeTool, getToolDescriptions, type ToolContext } from './tools';
import { buildContext, type ContextMessage } from './contextBuilder';
import { searchEmails } from './embeddings';
import { logLLMCall, logAgentRun } from './aiLogger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';
const MAX_ITERATIONS = 5;
const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
function buildSystemPrompt(): string {
  return `You are Cortex, an AI assistant embedded in an email application. Your job is to help users manage their email by reasoning through requests and using tools.

You follow the ReAct pattern (Reason + Act):
1. Think about what the user needs
2. Choose and call a tool if more information is needed
3. Observe the tool result
4. Repeat until you can give a final answer

## Available Tools

${getToolDescriptions()}

## Response Format

Always respond with a single JSON object. Do NOT wrap in markdown code blocks.

If you need to call a tool:
{
  "thought": "Your reasoning here",
  "action": "tool_name",
  "action_input": { ...tool parameters... }
}

When you have enough information to respond to the user:
{
  "thought": "Your final reasoning",
  "final_answer": "Your response to the user"
}

## Rules
- Always include "thought" in every response
- Match email IDs exactly from tool results — never invent IDs
- For SEND actions, always use the send_email tool so the user can confirm
- Be concise in final_answer — the user sees this text directly
- If a tool returns an error, try a different approach or explain the limitation`;
}

// ---------------------------------------------------------------------------
// Parse one LLM response with retry-on-schema-failure
// ---------------------------------------------------------------------------
async function callLLM(
  messages: Groq.Chat.ChatCompletionMessageParam[],
  attempt = 0
): Promise<{
  thought: string;
  action?: string;
  action_input?: unknown;
  final_answer?: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const start = Date.now();

  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
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

  const result = AgentThoughtSchema.safeParse(parsed);

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
      const errorMsg = result.error.issues
        .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
        .join('; ');
      const retryMessages: Groq.Chat.ChatCompletionMessageParam[] = [
        ...messages,
        { role: 'assistant', content },
        {
          role: 'user',
          content: `Your JSON failed schema validation: ${errorMsg}. Please respond again with a valid JSON object containing "thought" and either "action"+"action_input" or "final_answer".`,
        },
      ];
      return callLLM(retryMessages, attempt + 1);
    }

    // Last resort: return a graceful final answer
    logLLMCall({
      model: MODEL,
      inputTokens,
      outputTokens,
      latencyMs,
      success: false,
      retryCount: attempt,
    });
    return {
      thought: 'Failed to parse LLM output',
      final_answer:
        'I ran into a formatting issue. Could you rephrase your request?',
      inputTokens,
      outputTokens,
    };
  }

  logLLMCall({
    model: MODEL,
    inputTokens,
    outputTokens,
    latencyMs,
    success: true,
    retryCount: attempt,
  });
  return { ...result.data, inputTokens, outputTokens };
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------
export interface AgentResult {
  steps: AgentStep[];
  message: string;
  actions: AgentAction[];
}

/**
 * Run the ReAct agent loop.
 *
 * @param userMessage   The current user input
 * @param history       Prior conversation turns (multi-turn memory)
 * @param context       Runtime context (accessToken, currently open email)
 */
export async function runAgent(
  userMessage: string,
  history: ContextMessage[],
  context: ToolContext
): Promise<AgentResult> {
  const agentStart = Date.now();
  const steps: AgentStep[] = [];
  const actions: AgentAction[] = [];

  // RAG: retrieve relevant emails before the first LLM call
  let ragResults: string;
  try {
    const hits = await searchEmails(userMessage, 8);
    ragResults =
      hits.length > 0
        ? `Relevant emails (semantic search):\n${JSON.stringify(hits, null, 2)}`
        : 'No emails found in the index yet.';
  } catch {
    ragResults = 'Email search unavailable (Pinecone not configured yet).';
  }

  const systemPrompt = buildSystemPrompt();
  const builtCtx = buildContext(systemPrompt, ragResults, history);

  // Build initial message array
  let messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `${builtCtx.system}\n\n## Email Context\n${builtCtx.ragContext}`,
    },
    ...builtCtx.conversation.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const llmOut = await callLLM(messages);

    const step: AgentStep = {
      thought: llmOut.thought,
      action: llmOut.action,
      actionInput: llmOut.action_input,
    };

    // Final answer — done
    if (llmOut.final_answer) {
      steps.push(step);
      logAgentRun({
        steps: steps.length,
        actionsDispatched: actions.length,
        latencyMs: Date.now() - agentStart,
        success: true,
      });
      return { steps, message: llmOut.final_answer, actions };
    }

    // Tool call
    if (llmOut.action) {
      const observation = await executeTool(
        llmOut.action,
        llmOut.action_input,
        context
      );
      step.observation = observation;
      steps.push(step);

      // Check if tool produced a UI action for the dispatcher
      try {
        const parsed = JSON.parse(observation);
        if (parsed?.action) {
          actions.push({ type: parsed.action, payload: parsed });
        }
      } catch {
        /* not a JSON action result */
      }

      // Feed observation back to LLM
      messages = [
        ...messages,
        {
          role: 'assistant',
          content: JSON.stringify({
            thought: llmOut.thought,
            action: llmOut.action,
            action_input: llmOut.action_input,
          }),
        },
        { role: 'user', content: `Observation: ${observation}` },
      ];
    } else {
      // LLM returned neither action nor final_answer — force a conclusion
      steps.push(step);
      break;
    }
  }

  // Exceeded MAX_ITERATIONS or malformed response
  logAgentRun({
    steps: steps.length,
    actionsDispatched: actions.length,
    latencyMs: Date.now() - agentStart,
    success: false,
  });
  return {
    steps,
    message:
      "I've completed my analysis. Here's what I found based on your request.",
    actions,
  };
}
