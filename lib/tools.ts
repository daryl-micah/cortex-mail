import { z } from 'zod';
import { searchEmails } from './embeddings';
import { logToolCall } from './aiLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ToolContext {
  accessToken: string;
  currentEmailId?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown, context: ToolContext) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Gmail helpers called by tools — thin wrappers over the Gmail REST API
// using the user's access token directly so tools can run server-side
// without needing a full Session object.
// ---------------------------------------------------------------------------
async function fetchEmailBody(
  accessToken: string,
  emailId: string
): Promise<string> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);

  const msg = await res.json();
  const parts: any[] = msg.payload?.parts ?? [];
  let plain = '';

  const extract = (ps: any[]) => {
    for (const p of ps) {
      if (p.parts) extract(p.parts);
      else if (p.mimeType === 'text/plain' && p.body?.data && !plain) {
        plain = Buffer.from(p.body.data, 'base64').toString('utf-8');
      }
    }
  };

  if (parts.length > 0) {
    extract(parts);
  } else if (msg.payload?.body?.data) {
    plain = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
  }

  return plain || '(no plain-text body)';
}

async function fetchThread(
  accessToken: string,
  emailId: string
): Promise<string> {
  // First get the message to find its threadId
  const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=metadata&metadataHeaders=Subject,From,Date`;
  const msgRes = await fetch(msgUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!msgRes.ok) throw new Error(`Gmail API error: ${msgRes.status}`);
  const msg = await msgRes.json();
  const threadId = msg.threadId;

  // Fetch the thread
  const threadUrl = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=Subject,From,Date`;
  const threadRes = await fetch(threadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!threadRes.ok) throw new Error(`Gmail API error: ${threadRes.status}`);
  const thread = await threadRes.json();

  const messages: string[] = (thread.messages ?? []).map((m: any) => {
    const headers = m.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
        ?.value ?? '';
    return `From: ${get('from')}\nDate: ${get('date')}\nSubject: ${get('subject')}`;
  });

  return `Thread (${messages.length} messages):\n${messages.join('\n---\n')}`;
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------
export const tools: Tool[] = [
  {
    name: 'search_emails',
    description:
      'Search emails by natural language query using semantic similarity. Use this to find emails about a topic, from a person, or matching any natural language description.',
    parameters: z.object({
      query: z.string().describe('Natural language search query'),
      limit: z.number().optional().default(5),
    }),
    execute: async (params) => {
      const { query, limit } = params as { query: string; limit: number };
      const results = await searchEmails(query, limit ?? 5);
      return JSON.stringify(results);
    },
  },

  {
    name: 'get_email_body',
    description:
      'Get the full plain-text body of a specific email by its ID. Use this when you need to read the actual content of an email to summarise, reply, or reason about it.',
    parameters: z.object({
      emailId: z.string().describe('The email ID from search results'),
    }),
    execute: async (params, context) => {
      const { emailId } = params as { emailId: string };
      const body = await fetchEmailBody(context.accessToken, emailId);
      // Truncate very long bodies to keep context lean
      return body.length > 3000 ? body.slice(0, 3000) + '\n[truncated]' : body;
    },
  },

  {
    name: 'summarize_thread',
    description:
      'Get a summary of all messages in the same email thread as the given email. Use when the user wants to understand a conversation or back-and-forth exchange.',
    parameters: z.object({
      emailId: z.string().describe('Any email ID belonging to the thread'),
    }),
    execute: async (params, context) => {
      const { emailId } = params as { emailId: string };
      return await fetchThread(context.accessToken, emailId);
    },
  },

  {
    name: 'compose_email',
    description:
      'Open the compose view and pre-fill the email fields. Use when the user wants to write a new email or you want to draft one.',
    parameters: z.object({
      to: z.string().optional().describe('Recipient email address'),
      subject: z.string().optional().describe('Email subject'),
      body: z.string().optional().describe('Email body text'),
    }),
    execute: async (params) => {
      return JSON.stringify({ action: 'COMPOSE_EMAIL', ...(params as object) });
    },
  },

  {
    name: 'send_email',
    description:
      'Trigger sending of the currently composed email. This will show a confirmation dialog to the user before sending.',
    parameters: z.object({}),
    execute: async () => {
      return JSON.stringify({ action: 'SEND_EMAIL' });
    },
  },

  {
    name: 'open_email',
    description: 'Open and display a specific email in the main view.',
    parameters: z.object({
      emailId: z.string().describe('The email ID to open'),
    }),
    execute: async (params) => {
      const { emailId } = params as { emailId: string };
      return JSON.stringify({ action: 'OPEN_EMAIL', id: emailId });
    },
  },

  {
    name: 'reply_to_email',
    description:
      'Open compose pre-filled as a reply to the given email (or the currently open email if no ID is provided).',
    parameters: z.object({
      emailId: z
        .string()
        .optional()
        .describe('Email to reply to. Omit to reply to the currently open email.'),
      body: z.string().optional().describe('Pre-fill the reply body'),
    }),
    execute: async (params, context) => {
      const { emailId, body } = params as {
        emailId?: string;
        body?: string;
      };
      return JSON.stringify({
        action: 'REPLY_TO_EMAIL',
        emailId: emailId ?? context.currentEmailId,
        body,
      });
    },
  },

  {
    name: 'filter_emails',
    description:
      'Filter the inbox by unread status, sender, or date range. Use when the user asks to view a subset of emails.',
    parameters: z.object({
      unread: z.boolean().optional().describe('Show only unread emails'),
      sender: z.string().optional().describe('Filter by sender email or name'),
      dateRange: z
        .enum(['today', 'week', 'month'])
        .optional()
        .describe('Filter by recency'),
    }),
    execute: async (params) => {
      return JSON.stringify({ action: 'FILTER_EMAILS', ...(params as object) });
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Build the tool list section of a system prompt */
export function getToolDescriptions(): string {
  return tools
    .map((t) => {
      const shape =
        t.parameters instanceof z.ZodObject ? t.parameters.shape : {};
      const params = Object.entries(shape)
        .map(([key, schema]) => {
          const desc = (schema as z.ZodTypeAny)._def?.description ?? '';
          const optional =
            schema instanceof z.ZodOptional ? ' (optional)' : ' (required)';
          return `  - ${key}${optional}: ${desc}`;
        })
        .join('\n');
      return `### ${t.name}\n${t.description}${params ? '\nParameters:\n' + params : ''}`;
    })
    .join('\n\n');
}

/** Execute a tool by name with Zod validation and timing */
export async function executeTool(
  name: string,
  rawInput: unknown,
  context: ToolContext
): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return `Unknown tool: "${name}"`;

  const start = Date.now();
  try {
    const validated = tool.parameters.parse(rawInput ?? {});
    const result = await tool.execute(validated, context);
    logToolCall({ toolName: name, latencyMs: Date.now() - start, success: true });
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logToolCall({ toolName: name, latencyMs: Date.now() - start, success: false, error });
    return `Error running ${name}: ${error}`;
  }
}
