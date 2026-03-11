import { z } from 'zod';

// ---------------------------------------------------------------------------
// Agent reasoning step — one iteration of the ReAct loop
// ---------------------------------------------------------------------------
export const AgentThoughtSchema = z.object({
  thought: z.string(),
  action: z.string().optional(),
  action_input: z.record(z.string(), z.unknown()).optional(),
  final_answer: z.string().optional(),
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
