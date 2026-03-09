import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type LogType = 'llm_call' | 'tool_call' | 'agent_run' | 'error';

interface BaseEntry {
  timestamp: string;
  type: LogType;
  latencyMs: number;
  success: boolean;
  error?: string;
}

interface LLMCallEntry extends BaseEntry {
  type: 'llm_call';
  model: string;
  inputTokens: number;
  outputTokens: number;
  retryCount: number;
}

interface ToolCallEntry extends BaseEntry {
  type: 'tool_call';
  toolName: string;
}

interface AgentRunEntry extends BaseEntry {
  type: 'agent_run';
  steps: number;
  actionsDispatched: number;
}

interface ErrorEntry extends BaseEntry {
  type: 'error';
  context: string;
}

type LogEntry = LLMCallEntry | ToolCallEntry | AgentRunEntry | ErrorEntry;

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------
const LOG_FILE = path.join(process.cwd(), 'ai-logs.jsonl');

function write(entry: LogEntry): void {
  const line = JSON.stringify(entry) + '\n';

  // Non-blocking append — fire and forget
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error('[aiLogger] failed to write log:', err);
  });

  if (process.env.NODE_ENV === 'development') {
    const status = entry.success ? '✓' : '✗';
    const detail =
      entry.type === 'llm_call'
        ? `model=${entry.model} in=${entry.inputTokens} out=${entry.outputTokens} retries=${entry.retryCount}`
        : entry.type === 'tool_call'
          ? `tool=${entry.toolName}`
          : entry.type === 'agent_run'
            ? `steps=${entry.steps} actions=${entry.actionsDispatched}`
            : `context=${entry.context}`;
    console.log(`[AI] ${entry.type} ${status} ${entry.latencyMs}ms ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------
export function logLLMCall({
  model,
  inputTokens,
  outputTokens,
  latencyMs,
  success,
  retryCount = 0,
  error,
}: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  retryCount?: number;
  error?: string;
}): void {
  write({
    timestamp: new Date().toISOString(),
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

export function logToolCall({
  toolName,
  latencyMs,
  success,
  error,
}: {
  toolName: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}): void {
  write({
    timestamp: new Date().toISOString(),
    type: 'tool_call',
    toolName,
    latencyMs,
    success,
    error,
  });
}

export function logAgentRun({
  steps,
  actionsDispatched,
  latencyMs,
  success,
  error,
}: {
  steps: number;
  actionsDispatched: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}): void {
  write({
    timestamp: new Date().toISOString(),
    type: 'agent_run',
    steps,
    actionsDispatched,
    latencyMs,
    success,
    error,
  });
}

export function logError({
  context,
  error,
  latencyMs = 0,
}: {
  context: string;
  error: string;
  latencyMs?: number;
}): void {
  write({
    timestamp: new Date().toISOString(),
    type: 'error',
    context,
    latencyMs,
    success: false,
    error,
  });
}
