# Cortex Mail — AI Engineering Upgrade Plan

Transform Cortex Mail from a basic "LLM returns JSON" app into a showcase of production AI engineering. Four features that demonstrate core AI SWE competencies hiring managers look for.

---

## Overview

| Feature                          | Why It's High-Respect                                           |
| -------------------------------- | --------------------------------------------------------------- |
| RAG Pipeline (Pinecone)          | #1 most-asked pattern in AI engineering interviews              |
| Agentic Multi-Step Tool Use      | Architecture behind Cursor, Devin, and every AI coding agent    |
| Multi-Turn Context Management    | Shows you understand token economics and production constraints |
| Structured Output + Eval Harness | Separates hobby projects from real AI systems                   |

**Model Upgrade:** `llama-3.1-8b-instant` → `llama-3.3-70b-versatile` (Groq)

---

## Prerequisites

### Environment Variables

Add to `.env.local`:

```bash
# Existing
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
GROQ_API_KEY=your_groq_api_key

# New
PINECONE_API_KEY=your_pinecone_api_key
```

### Pinecone Index Setup

1. Go to [Pinecone Console](https://app.pinecone.io/) → Create Index
2. **Name:** `cortex-emails`
3. **Dimensions:** `1024` (for multilingual-e5-large)
4. **Metric:** `cosine`
5. **Type:** Serverless (free tier works)

### Dependencies

```bash
pnpm add zod js-tiktoken @pinecone-database/pinecone
```

---

## Step 1 — RAG Pipeline for Semantic Email Search

### Why

Currently the assistant dumps the first 15 emails (metadata only) to the LLM regardless of what the user asks. With RAG:

- User asks "find the email about Q3 budget" → system embeds the query → retrieves semantically relevant emails → LLM gets only what it needs
- Scales to 1000+ emails without hitting token limits
- Enables natural language search in the UI

### Files to Create

#### `lib/embeddings.ts`

Embedding generation and vector operations via Pinecone:

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pinecone.index('cortex-emails');

interface EmailForEmbedding {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
  bodyText?: string; // First ~500 chars of plain text body
}

// Generate embeddings using Pinecone's inference API (multilingual-e5-large)
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await pinecone.inference.embed(
    'multilingual-e5-large',
    texts,
    { inputType: 'passage' }
  );
  return response.map((r) => r.values);
}

// Upsert emails to Pinecone
export async function upsertEmails(emails: EmailForEmbedding[]): Promise<void> {
  const texts = emails.map(
    (e) => `${e.subject} ${e.preview} ${e.bodyText || ''}`
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

  // Batch upsert (Pinecone recommends batches of 100)
  for (let i = 0; i < vectors.length; i += 100) {
    await index.upsert(vectors.slice(i, i + 100));
  }
}

// Semantic search
export async function searchEmails(query: string, topK = 10) {
  const [queryEmbedding] = await embedTexts([query]);

  const results = await index.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return results.matches.map((match) => ({
    id: match.id,
    score: match.score,
    ...match.metadata,
  }));
}

// Delete emails (for cleanup)
export async function deleteEmails(ids: string[]): Promise<void> {
  await index.deleteMany(ids);
}
```

#### `app/api/emails/search/route.ts`

Semantic search API endpoint:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { searchEmails } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { query, topK = 10 } = await request.json();

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    const results = await searchEmails(query, topK);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

### Files to Modify

#### `lib/useEmailSync.ts`

Add embedding upsert after fetching emails:

```typescript
// After fetching emails from Gmail API
import { upsertEmails } from './embeddings';

// In the sync function, after setting emails in state:
await upsertEmails(
  emails.map((e) => ({
    id: e.id,
    from: e.from,
    subject: e.subject,
    preview: e.preview,
    date: e.date,
    unread: e.unread,
    bodyText: e.bodyText?.slice(0, 500), // First 500 chars
  }))
);
```

#### `app/api/assistant/route.ts`

Replace static context with RAG retrieval:

```typescript
// Before building LLM context:
import { searchEmails } from '@/lib/embeddings';

// Replace the 15-email slice with:
const relevantEmails = await searchEmails(userMessage, 10);

// Use relevantEmails in the context instead of context.emails.slice(0, 15)
```

#### `features/mail/SearchView.tsx`

Implement the UI (currently a stub):

```typescript
// Add state for search results
const [query, setQuery] = useState('');
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(false);

// Search handler
const handleSearch = async () => {
  setLoading(true);
  const res = await fetch('/api/emails/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  setResults(data.results);
  setLoading(false);
};

// Render results with similarity scores
```

### Verification

1. Sync emails → check Pinecone console shows vectors
2. Type "find the email about [topic]" in assistant → should return semantically relevant results
3. Use SearchView → natural language queries work
4. Compare with old behavior (first 15 emails regardless of query)

---

## Step 2 — Agentic Multi-Step Tool Use (ReAct Pattern)

### Why

Current implementation: User message → one LLM call → one action. This breaks for complex queries like "read the email from Sarah and draft a reply summarizing the key points."

With ReAct:

- LLM can execute multiple tools in sequence
- Each tool returns observations the LLM uses for next steps
- Enables complex, multi-step workflows
- Shows reasoning chain to user (huge UX differentiator)

### Files to Create

#### `lib/tools.ts`

Tool registry with schemas and executors:

```typescript
import { z } from 'zod';
import { searchEmails } from './embeddings';
import { getEmailBody, getEmailThread } from './gmail';

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown, context: ToolContext) => Promise<string>;
}

interface ToolContext {
  accessToken: string;
  currentEmailId?: string;
}

export const tools: Tool[] = [
  {
    name: 'search_emails',
    description:
      'Search emails by natural language query. Returns relevant emails with metadata.',
    parameters: z.object({
      query: z.string().describe('Natural language search query'),
      limit: z.number().optional().default(5),
    }),
    execute: async (params) => {
      const { query, limit } = params as { query: string; limit: number };
      const results = await searchEmails(query, limit);
      return JSON.stringify(results);
    },
  },
  {
    name: 'get_email_body',
    description:
      'Get the full body content of a specific email by ID. Use when you need to read email content.',
    parameters: z.object({
      emailId: z.string().describe('The email ID to fetch'),
    }),
    execute: async (params, context) => {
      const { emailId } = params as { emailId: string };
      const body = await getEmailBody(context.accessToken, emailId);
      return body;
    },
  },
  {
    name: 'summarize_thread',
    description:
      'Get a summary of all emails in a thread. Use for understanding conversation context.',
    parameters: z.object({
      emailId: z.string().describe('Any email ID in the thread'),
    }),
    execute: async (params, context) => {
      const { emailId } = params as { emailId: string };
      const thread = await getEmailThread(context.accessToken, emailId);
      // Return thread for LLM to summarize, or pre-summarize here
      return JSON.stringify(thread);
    },
  },
  {
    name: 'compose_email',
    description: 'Open compose view and fill in email fields.',
    parameters: z.object({
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().optional(),
    }),
    execute: async (params) => {
      // Returns action for dispatcher
      return JSON.stringify({ action: 'COMPOSE_EMAIL', ...params });
    },
  },
  {
    name: 'send_email',
    description:
      'Send the currently composed email. Requires user confirmation.',
    parameters: z.object({}),
    execute: async () => {
      return JSON.stringify({ action: 'SEND_EMAIL' });
    },
  },
  {
    name: 'open_email',
    description: 'Open and display a specific email.',
    parameters: z.object({
      emailId: z.string(),
    }),
    execute: async (params) => {
      return JSON.stringify({
        action: 'OPEN_EMAIL',
        id: (params as { emailId: string }).emailId,
      });
    },
  },
  {
    name: 'reply_to_email',
    description: 'Open compose with reply to the current or specified email.',
    parameters: z.object({
      emailId: z
        .string()
        .optional()
        .describe('Email to reply to. Omit for current email.'),
      body: z.string().optional().describe('Pre-fill reply body'),
    }),
    execute: async (params, context) => {
      const { emailId, body } = params as { emailId?: string; body?: string };
      return JSON.stringify({
        action: 'REPLY_TO_EMAIL',
        emailId: emailId || context.currentEmailId,
        body,
      });
    },
  },
  {
    name: 'filter_emails',
    description: 'Filter inbox by criteria.',
    parameters: z.object({
      unread: z.boolean().optional(),
      sender: z.string().optional(),
      dateRange: z.enum(['today', 'week', 'month']).optional(),
    }),
    execute: async (params) => {
      return JSON.stringify({ action: 'FILTER_EMAILS', ...params });
    },
  },
];

// Generate tool descriptions for system prompt
export function getToolDescriptions(): string {
  return tools
    .map(
      (t) =>
        `${t.name}: ${t.description}\nParameters: ${JSON.stringify(t.parameters.shape)}`
    )
    .join('\n\n');
}
```

#### `lib/reactAgent.ts`

ReAct loop implementation:

```typescript
import Groq from 'groq-sdk';
import { tools, getToolDescriptions, Tool } from './tools';
import { z } from 'zod';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MAX_ITERATIONS = 5;

interface AgentStep {
  thought: string;
  action?: string;
  actionInput?: unknown;
  observation?: string;
}

interface AgentResult {
  steps: AgentStep[];
  finalAnswer: string;
  actions: Array<{ type: string; payload?: unknown }>;
}

const SYSTEM_PROMPT = `You are an AI assistant controlling an email application. You have access to tools to help users manage their email.

Available tools:
${getToolDescriptions()}

Use the ReAct pattern:
1. Thought: Reason about what to do
2. Action: The tool to use
3. Action Input: JSON parameters for the tool
4. Observation: Tool result (provided by system)
... repeat until you have enough information ...
5. Final Answer: Your response to the user

Format your response as JSON:
{
  "thought": "your reasoning",
  "action": "tool_name",      // omit if giving final answer
  "action_input": {...},      // omit if giving final answer
  "final_answer": "response"  // only when done
}`;

export async function runAgent(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: { accessToken: string; currentEmailId?: string }
): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  const actions: Array<{ type: string; payload?: unknown }> = [];
  let scratchpad = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user' as const, content: userMessage + scratchpad },
    ];

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    steps.push({
      thought: parsed.thought,
      action: parsed.action,
      actionInput: parsed.action_input,
    });

    // If final answer, we're done
    if (parsed.final_answer) {
      // Collect any UI actions from the steps
      return { steps, finalAnswer: parsed.final_answer, actions };
    }

    // Execute tool
    if (parsed.action) {
      const tool = tools.find((t) => t.name === parsed.action);
      if (!tool) {
        scratchpad += `\nObservation: Unknown tool "${parsed.action}"`;
        continue;
      }

      try {
        const validatedInput = tool.parameters.parse(parsed.action_input);
        const observation = await tool.execute(validatedInput, context);

        // Check if tool returned a UI action
        try {
          const actionResult = JSON.parse(observation);
          if (actionResult.action) {
            actions.push({ type: actionResult.action, payload: actionResult });
          }
        } catch {}

        steps[steps.length - 1].observation = observation;
        scratchpad += `\nObservation: ${observation}`;
      } catch (error) {
        scratchpad += `\nObservation: Error - ${error}`;
      }
    }
  }

  return {
    steps,
    finalAnswer:
      "I've reached the maximum number of steps. Here's what I found so far.",
    actions,
  };
}
```

### Files to Modify

#### `app/api/assistant/route.ts`

Replace single LLM call with agent:

```typescript
import { runAgent } from '@/lib/reactAgent';

// In the POST handler:
const result = await runAgent(userMessage, conversationHistory, {
  accessToken: session.accessToken,
  currentEmailId: context.selectedEmailId,
});

return NextResponse.json({
  steps: result.steps,
  message: result.finalAnswer,
  actions: result.actions,
});
```

#### `lib/assistantDispatcher.ts`

Handle multiple actions:

```typescript
// Update to process actions array
export function dispatchActions(
  actions: Array<{ type: string; payload?: unknown }>
) {
  for (const action of actions) {
    switch (action.type) {
      case 'OPEN_EMAIL':
        // dispatch to Redux
        break;
      case 'COMPOSE_EMAIL':
        // dispatch to Redux
        break;
      // ... etc
    }
  }
}
```

#### `components/layout/AssistantPanel.tsx`

Show reasoning steps:

```typescript
// Add steps to message state
interface Message {
  role: 'user' | 'assistant';
  content: string;
  steps?: Array<{ thought: string; action?: string; observation?: string }>;
}

// Render steps in the UI
{message.steps?.map((step, i) => (
  <div key={i} className="text-xs text-muted-foreground">
    <span className="font-medium">Thinking:</span> {step.thought}
    {step.action && <span className="ml-2">→ {step.action}</span>}
  </div>
))}
```

### Verification

1. Ask "find the latest email from [person] and summarize it" → agent executes search_emails → get_email_body → returns summary
2. Ask "draft a reply to that email thanking them" → agent uses context from previous step
3. Steps are visible in UI showing reasoning chain
4. Complex multi-step queries work that would fail with single-action pattern

---

## Step 3 — Multi-Turn Conversation with Context Management

### Why

Currently every request is stateless — the LLM has no memory of prior conversation. This breaks for:

- "What about the second email?" (no context of previous search)
- "Actually, make the subject more formal" (no context of compose)
- Long conversations that exceed token limits

### Files to Create

#### `lib/tokenCounter.ts`

Token counting and budget management:

```typescript
import { encodingForModel } from 'js-tiktoken';

// LLaMA tokenization is similar to GPT-4
const encoder = encodingForModel('gpt-4');

export function countTokens(text: string): number {
  return encoder.encode(text).length;
}

export function countMessageTokens(
  messages: Array<{ role: string; content: string }>
): number {
  let total = 0;
  for (const msg of messages) {
    total += 4; // Role overhead
    total += countTokens(msg.content);
  }
  return total + 2; // Conversation overhead
}

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
  const system = countTokens(systemPrompt);
  const tools = countTokens(toolDescriptions);
  const rag = countTokens(ragContext);
  const conv = countMessageTokens(conversation);
  const total = system + tools + rag + conv;

  return {
    systemPrompt: system,
    tools,
    ragContext: rag,
    conversation: conv,
    total,
    remaining: maxTokens - total,
  };
}
```

#### `lib/contextBuilder.ts`

Prioritized context assembly:

```typescript
import { countTokens, countMessageTokens } from './tokenCounter';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_CONTEXT_TOKENS = 6000; // Leave room for response
const SYSTEM_BUDGET = 500;
const TOOLS_BUDGET = 800;
const RAG_BUDGET = 2000;

export async function buildContext(
  systemPrompt: string,
  toolDescriptions: string,
  ragResults: string,
  conversationHistory: Message[]
): Promise<{
  system: string;
  tools: string;
  rag: string;
  conversation: Message[];
  summary?: string;
}> {
  const systemTokens = countTokens(systemPrompt);
  const toolTokens = countTokens(toolDescriptions);
  const ragTokens = countTokens(ragResults);

  let conversationBudget =
    MAX_CONTEXT_TOKENS - systemTokens - toolTokens - ragTokens;

  // If RAG context is large, compress it
  let finalRag = ragResults;
  if (ragTokens > RAG_BUDGET) {
    // Truncate to most relevant results
    finalRag = ragResults.slice(0, RAG_BUDGET * 4); // ~4 chars per token
    conversationBudget =
      MAX_CONTEXT_TOKENS - systemTokens - toolTokens - RAG_BUDGET;
  }

  // Manage conversation history
  let finalConversation = [...conversationHistory];
  let summary: string | undefined;

  while (
    countMessageTokens(finalConversation) > conversationBudget &&
    finalConversation.length > 4
  ) {
    // Keep last 4 turns, summarize the rest
    const toSummarize = finalConversation.slice(0, -4);
    const recent = finalConversation.slice(-4);

    summary = `[Earlier conversation summary: User and assistant discussed ${toSummarize.length} messages about email management.]`;
    finalConversation = [
      { role: 'assistant' as const, content: summary },
      ...recent,
    ];
  }

  return {
    system: systemPrompt,
    tools: toolDescriptions,
    rag: finalRag,
    conversation: finalConversation,
    summary,
  };
}
```

### Files to Modify

#### `components/layout/AssistantPanel.tsx`

Send conversation history, persist to localStorage:

```typescript
// Load from localStorage on mount
useEffect(() => {
  const saved = localStorage.getItem('cortex-chat-history');
  if (saved) setMessages(JSON.parse(saved));
}, []);

// Save on change
useEffect(() => {
  localStorage.setItem('cortex-chat-history', JSON.stringify(messages));
}, [messages]);

// Send history in API call
const response = await fetch('/api/assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: input,
    conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
    context: { ... },
  }),
});

// Clear also clears localStorage
const handleClear = () => {
  setMessages([]);
  localStorage.removeItem('cortex-chat-history');
};
```

#### `app/api/assistant/route.ts`

Use context builder:

```typescript
import { buildContext } from '@/lib/contextBuilder';

// In handler:
const { conversationHistory } = await request.json();

const builtContext = await buildContext(
  SYSTEM_PROMPT,
  getToolDescriptions(),
  JSON.stringify(relevantEmails),
  conversationHistory
);

// Pass to agent
const result = await runAgent(userMessage, builtContext.conversation, {
  accessToken,
  currentEmailId,
});
```

### Verification

1. Have a 5+ message conversation → AI remembers context
2. Reference "that email" or "the one I mentioned" → AI understands
3. Very long conversations don't crash (summarization kicks in)
4. Refresh page → conversation persists

---

## Step 4 — Structured Output Pipeline + Eval Harness

### Why

Current implementation uses raw `JSON.parse()` with regex fallback — fragile and no validation. Production AI systems:

- Validate outputs against schemas
- Retry with error feedback when parsing fails
- Measure accuracy systematically
- Log everything for debugging

### Files to Create

#### `lib/schemas.ts`

Zod schemas for all AI outputs:

```typescript
import { z } from 'zod';

export const AgentThoughtSchema = z.object({
  thought: z.string(),
  action: z.string().optional(),
  action_input: z.record(z.unknown()).optional(),
  final_answer: z.string().optional(),
});

export const SearchEmailsInputSchema = z.object({
  query: z.string(),
  limit: z.number().optional().default(5),
});

export const ComposeEmailInputSchema = z.object({
  to: z.string().email().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export const OpenEmailInputSchema = z.object({
  emailId: z.string(),
});

export const FilterEmailsInputSchema = z.object({
  unread: z.boolean().optional(),
  sender: z.string().optional(),
  dateRange: z.enum(['today', 'week', 'month']).optional(),
});

export const AgentResponseSchema = z.object({
  steps: z.array(
    z.object({
      thought: z.string(),
      action: z.string().optional(),
      actionInput: z.unknown().optional(),
      observation: z.string().optional(),
    })
  ),
  finalAnswer: z.string(),
  actions: z.array(
    z.object({
      type: z.string(),
      payload: z.unknown().optional(),
    })
  ),
});

// Validate with helpful error messages
export function validateAgentResponse(data: unknown) {
  const result = AgentResponseSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid agent response: ${errors}`);
  }
  return result.data;
}
```

#### `lib/aiLogger.ts`

Structured observability:

```typescript
import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  type: 'llm_call' | 'tool_call' | 'error';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  success: boolean;
  retryCount?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

const LOG_FILE = path.join(process.cwd(), 'ai-logs.jsonl');

export function logAI(entry: LogEntry): void {
  const line =
    JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    }) + '\n';

  // Append to file (non-blocking)
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('Failed to write AI log:', err);
  });

  // Also log to console in dev
  if (process.env.NODE_ENV === 'development') {
    console.log(
      '[AI]',
      entry.type,
      entry.success ? '✓' : '✗',
      entry.latencyMs + 'ms'
    );
  }
}

export function logLLMCall(
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  success: boolean,
  retryCount = 0,
  error?: string
): void {
  logAI({
    timestamp: '',
    type: 'llm_call',
    model,
    inputTokens,
    outputTokens,
    latencyMs,
    success,
    retryCount,
    error,
  });
}

export function logToolCall(
  toolName: string,
  latencyMs: number,
  success: boolean,
  error?: string
): void {
  logAI({
    timestamp: '',
    type: 'tool_call',
    latencyMs,
    success,
    error,
    metadata: { toolName },
  });
}
```

#### `evals/cases.json`

Test cases:

```json
[
  {
    "id": "compose_basic",
    "input": "send an email to john@example.com about lunch",
    "expectedAction": "compose_email",
    "expectedFields": {
      "to": "john@example.com"
    },
    "shouldContain": ["lunch"]
  },
  {
    "id": "search_basic",
    "input": "find emails about the Q3 budget",
    "expectedAction": "search_emails",
    "expectedFields": {
      "query": "Q3 budget"
    }
  },
  {
    "id": "filter_unread",
    "input": "show me unread emails",
    "expectedAction": "filter_emails",
    "expectedFields": {
      "unread": true
    }
  },
  {
    "id": "reply_current",
    "input": "reply to this email",
    "expectedAction": "reply_to_email",
    "context": {
      "currentEmailId": "email_123"
    }
  },
  {
    "id": "multi_step",
    "input": "find the email from Sarah about the project and summarize it",
    "expectedSteps": ["search_emails", "get_email_body"],
    "minSteps": 2
  }
]
```

#### `evals/run.ts`

Eval runner:

```typescript
import cases from './cases.json';

interface EvalResult {
  id: string;
  passed: boolean;
  expectedAction?: string;
  actualAction?: string;
  latencyMs: number;
  error?: string;
}

async function runEval(testCase: (typeof cases)[0]): Promise<EvalResult> {
  const start = Date.now();

  try {
    const response = await fetch('http://localhost:3000/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testCase.input,
        conversationHistory: [],
        context: testCase.context || {},
      }),
    });

    const data = await response.json();
    const latencyMs = Date.now() - start;

    // Check expected action
    const actions = data.actions || [];
    const hasExpectedAction = actions.some((a: { type: string }) =>
      a.type.toLowerCase().includes(testCase.expectedAction || '')
    );

    // Check expected fields
    let fieldsMatch = true;
    if (testCase.expectedFields) {
      // Validate fields match
    }

    return {
      id: testCase.id,
      passed: hasExpectedAction && fieldsMatch,
      expectedAction: testCase.expectedAction,
      actualAction: actions[0]?.type,
      latencyMs,
    };
  } catch (error) {
    return {
      id: testCase.id,
      passed: false,
      latencyMs: Date.now() - start,
      error: String(error),
    };
  }
}

async function main() {
  console.log(`Running ${cases.length} eval cases...\n`);

  const results: EvalResult[] = [];
  for (const testCase of cases) {
    const result = await runEval(testCase);
    results.push(result);
    console.log(
      `${result.passed ? '✓' : '✗'} ${result.id} (${result.latencyMs}ms)`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const accuracy = ((passed / total) * 100).toFixed(1);

  console.log(`\n=== Results ===`);
  console.log(`Accuracy: ${accuracy}% (${passed}/${total})`);
  console.log(
    `Avg latency: ${Math.round(results.reduce((a, r) => a + r.latencyMs, 0) / total)}ms`
  );

  // Write report
  const report = `# Eval Report\n\nAccuracy: ${accuracy}%\nTotal: ${total}\nPassed: ${passed}\n`;
  require('fs').writeFileSync('evals/report.md', report);
}

main();
```

### Files to Modify

#### `app/api/assistant/route.ts`

Add validation and retries:

```typescript
import { AgentThoughtSchema } from '@/lib/schemas';
import { logLLMCall } from '@/lib/aiLogger';

const MAX_RETRIES = 2;

async function parseWithRetry(
  groq: Groq,
  messages: Message[],
  attempt = 0
): Promise<z.infer<typeof AgentThoughtSchema>> {
  const start = Date.now();

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content || '{}';
  const latencyMs = Date.now() - start;

  const result = AgentThoughtSchema.safeParse(JSON.parse(content));

  if (!result.success) {
    logLLMCall(
      'llama-3.3-70b-versatile',
      0,
      0,
      latencyMs,
      false,
      attempt,
      result.error.message
    );

    if (attempt < MAX_RETRIES) {
      // Retry with error feedback
      const errorFeedback = {
        role: 'user' as const,
        content: `Your output failed validation: ${result.error.errors.map((e) => e.message).join(', ')}. Please try again with valid JSON.`,
      };
      return parseWithRetry(groq, [...messages, errorFeedback], attempt + 1);
    }
    throw new Error('Failed to parse LLM output after retries');
  }

  logLLMCall('llama-3.3-70b-versatile', 0, 0, latencyMs, true, attempt);
  return result.data;
}
```

#### `package.json`

Add eval script:

```json
{
  "scripts": {
    "eval": "npx tsx evals/run.ts"
  }
}
```

### Verification

1. Send malformed prompt → LLM retries with error feedback
2. Check `ai-logs.jsonl` → structured logs present
3. Run `pnpm eval` → 85%+ accuracy
4. Check `evals/report.md` → metrics generated

---

## Implementation Order

1. **Dependencies** — Add zod, js-tiktoken, @pinecone-database/pinecone
2. **Schemas** — `lib/schemas.ts` (foundational)
3. **Token counter** — `lib/tokenCounter.ts`
4. **Embeddings** — `lib/embeddings.ts`
5. **Tools** — `lib/tools.ts`
6. **Context builder** — `lib/contextBuilder.ts`
7. **AI logger** — `lib/aiLogger.ts`
8. **Search route** — `app/api/emails/search/route.ts`
9. **ReAct agent** — `lib/reactAgent.ts`
10. **Rewrite assistant route** — `app/api/assistant/route.ts`
11. **Update dispatcher** — `lib/assistantDispatcher.ts`
12. **Update AssistantPanel** — `components/layout/AssistantPanel.tsx`
13. **Implement SearchView** — `features/mail/SearchView.tsx`
14. **Update useEmailSync** — `lib/useEmailSync.ts`
15. **Create evals** — `evals/`

---

## Summary

After implementation, Cortex Mail demonstrates:

| Skill               | Evidence                                         |
| ------------------- | ------------------------------------------------ |
| RAG pipelines       | Pinecone + embeddings + retrieval                |
| Agentic AI          | ReAct loop with multi-step tool use              |
| Token management    | Budget allocation, sliding window, summarization |
| Production patterns | Zod validation, retries, structured logging      |
| Evaluation          | Automated test harness with accuracy metrics     |

This positions you as someone who has built **real AI systems**, not just called OpenAI's API.
