import { z } from 'zod';

// ---------------------------------------------------------------------------
// Agent reasoning step — one iteration of the ReAct loop
// ---------------------------------------------------------------------------
export const AgentThoughtSchema = z.object({
  thought: z.string(),
  action: z.string().optional(),
  action_input: z.record(z.string(), z.unknown()).optional(),
  final_answer: z.string().optional(),
  /**
   * IDs of emails the final answer refers to. The UI renders these as
   * clickable rows, which is why the answer text itself never needs to
   * spell out subjects, senders or IDs.
   */
  email_ids: z.array(z.string()).optional(),
});

export type AgentThought = z.infer<typeof AgentThoughtSchema>;

// ---------------------------------------------------------------------------
// Tool input schemas
// ---------------------------------------------------------------------------
export const SearchEmailsInputSchema = z.object({
  query: z.string(),
  limit: z.number().optional().default(5),
});

export const GetEmailBodyInputSchema = z.object({
  emailId: z.string(),
});

export const SummarizeThreadInputSchema = z.object({
  emailId: z.string(),
});

export const ComposeEmailInputSchema = z.object({
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export const OpenEmailInputSchema = z.object({
  emailId: z.string(),
});

export const ReplyToEmailInputSchema = z.object({
  emailId: z.string().optional(),
  body: z.string().optional(),
});

export const FilterEmailsInputSchema = z.object({
  unread: z.boolean().optional(),
  sender: z.string().optional(),
  dateRange: z.enum(['today', 'week', 'month']).optional(),
});

// ---------------------------------------------------------------------------
// Full agent response (what the POST /api/assistant handler returns to client)
// ---------------------------------------------------------------------------
export const AgentStepSchema = z.object({
  thought: z.string(),
  action: z.string().optional(),
  actionInput: z.unknown().optional(),
  observation: z.string().optional(),
});

export const AgentActionSchema = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
});

export const AgentResponseSchema = z.object({
  steps: z.array(AgentStepSchema),
  message: z.string(),
  actions: z.array(AgentActionSchema),
});

export type AgentStep = z.infer<typeof AgentStepSchema>;
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// ---------------------------------------------------------------------------
// Validation helper — throws a descriptive error on failure
// ---------------------------------------------------------------------------
export function validateAgentResponse(data: unknown): AgentResponse {
  const result = AgentResponseSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
      .join('; ');
    throw new Error(`Invalid agent response: ${errors}`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Email classification — AI-derived inbox status (Today view, Needs Reply, etc.)
// ---------------------------------------------------------------------------
export const EmailClassificationSchema = z.object({
  id: z.string(),
  status: z.enum([
    'needs_reply',
    'waiting_on',
    'follow_up',
    'fyi',
    'important',
    'handled',
    'unclassified',
  ]),
  reason: z.string(),
  deadline: z.string().optional(),
  summary: z.string().optional(),
});

export const ClassificationResponseSchema = z.object({
  classifications: z.array(EmailClassificationSchema),
});

export type EmailClassification = z.infer<typeof EmailClassificationSchema>;

// ---------------------------------------------------------------------------
// Thread insight — one opened email, full body
// ---------------------------------------------------------------------------
export const InsightSchema = z.object({
  summary: z.string().min(1),
  action: z.string().optional(),
  deadline: z.string().optional(),
  suggestedReply: z.string().optional(),
});

export type Insight = z.infer<typeof InsightSchema>;

// ---------------------------------------------------------------------------
// Proposed actions — the agent's batch of consequential changes, reviewed by
// the user before anything runs
// ---------------------------------------------------------------------------
const reasonField = z.string().min(1).describe('One sentence explaining why, from the email content');

export const ProposedActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('reply'),
    emailId: z.string(),
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    reason: reasonField,
  }),
  z.object({ kind: z.literal('archive'), emailId: z.string(), reason: reasonField }),
  z.object({
    kind: z.literal('star'),
    emailId: z.string(),
    starred: z.boolean().default(true),
    reason: reasonField,
  }),
  z.object({
    kind: z.literal('read'),
    emailId: z.string(),
    unread: z.boolean().default(false),
    reason: reasonField,
  }),
]);

export const ProposeActionsInputSchema = z.object({
  summary: z.string().describe('One sentence describing the whole batch'),
  actions: z.array(ProposedActionSchema).min(1),
});

export type ProposedActionWithReason = z.infer<typeof ProposedActionSchema>;
