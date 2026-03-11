import fs from 'fs';
import path from 'path';
import cases from './cases.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EvalCase {
  id: string;
  input: string;
  expectedAction?: string;
  expectedFields?: Record<string, unknown>;
  expectedSteps?: string[];
  minSteps?: number;
  shouldContain?: string[];
  context?: Record<string, string>;
}

interface EvalResult {
  id: string;
  passed: boolean;
  expectedAction?: string;
  actualActions: string[];
  steps: number;
  latencyMs: number;
  failures: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Eval runner
// ---------------------------------------------------------------------------
async function runEval(testCase: EvalCase): Promise<EvalResult> {
  const start = Date.now();
  const failures: string[] = [];

  try {
    const response = await fetch('http://localhost:3000/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: testCase.input,
        conversationHistory: [],
        context: testCase.context ?? {},
      }),
    });

    if (!response.ok) {
      return {
        id: testCase.id,
        passed: false,
        expectedAction: testCase.expectedAction,
        actualActions: [],
        steps: 0,
        latencyMs: Date.now() - start,
        failures: [`HTTP ${response.status}: ${response.statusText}`],
      };
    }

    const data = (await response.json()) as {
      actions?: Array<{ type: string; payload?: unknown }>;
      steps?: Array<{ thought: string; action?: string; observation?: string }>;
      message?: string;
    };

    const latencyMs = Date.now() - start;
    const actions: Array<{ type: string; payload?: unknown }> =
      data.actions ?? [];
    const steps = data.steps ?? [];
    const actualActionTypes = actions.map((a) => a.type);

    // --- Check 1: expectedAction is present somewhere in actions or steps ---
    if (testCase.expectedAction) {
      const normalised = testCase.expectedAction.toLowerCase();
      const found =
        actualActionTypes.some((t) => t.toLowerCase().includes(normalised)) ||
        steps.some((s) => s.action?.toLowerCase().includes(normalised));
      if (!found) {
        failures.push(
          `Expected action "${testCase.expectedAction}" not found. Got: [${actualActionTypes.join(', ')}]`
        );
      }
    }

    // --- Check 2: expectedFields present in any matching action payload ---
    if (testCase.expectedFields && actions.length > 0) {
      const primaryPayload = actions[0].payload as Record<string, unknown>;
      for (const [key, value] of Object.entries(testCase.expectedFields)) {
        const actual = primaryPayload?.[key];
        if (actual !== value) {
          failures.push(
            `Field "${key}": expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`
          );
        }
      }
    }

    // --- Check 3: minSteps ---
    if (testCase.minSteps !== undefined && steps.length < testCase.minSteps) {
      failures.push(
        `Expected at least ${testCase.minSteps} steps, got ${steps.length}`
      );
    }

    // --- Check 4: expectedSteps (all tool names appear in steps) ---
    if (testCase.expectedSteps) {
      const stepActions = steps.map((s) => s.action ?? '');
      for (const expected of testCase.expectedSteps) {
        if (
          !stepActions.some((a) =>
            a.toLowerCase().includes(expected.toLowerCase())
          )
        ) {
          failures.push(`Expected step "${expected}" not found in agent steps`);
        }
      }
    }

    // --- Check 5: shouldContain (in final message) ---
    if (testCase.shouldContain && data.message) {
      const lower = data.message.toLowerCase();
      for (const word of testCase.shouldContain) {
        // Also check action payloads for the word
        const inPayload = JSON.stringify(actions)
          .toLowerCase()
          .includes(word.toLowerCase());
        if (!lower.includes(word.toLowerCase()) && !inPayload) {
          failures.push(`Response should contain "${word}"`);
        }
      }
    }

    return {
      id: testCase.id,
      passed: failures.length === 0,
      expectedAction: testCase.expectedAction,
      actualActions: actualActionTypes,
      steps: steps.length,
      latencyMs,
      failures,
    };
  } catch (error) {
    return {
      id: testCase.id,
      passed: false,
      expectedAction: testCase.expectedAction,
      actualActions: [],
      steps: 0,
      latencyMs: Date.now() - start,
      failures: [],
      error: String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const typedCases = cases as EvalCase[];
  console.log(
    `\nRunning ${typedCases.length} eval cases against http://localhost:3000\n`
  );
  console.log('─'.repeat(60));

  const results: EvalResult[] = [];

  for (const testCase of typedCases) {
    const result = await runEval(testCase);
    results.push(result);

    const icon = result.passed ? '✓' : '✗';
    const status = result.error
      ? `ERROR: ${result.error}`
      : result.passed
        ? `steps=${result.steps}`
        : result.failures.join(' | ');

    console.log(`${icon} [${result.id}] (${result.latencyMs}ms)  ${status}`);
  }

  console.log('─'.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const accuracy = ((passed / total) * 100).toFixed(1);
  const avgLatency = Math.round(
    results.reduce((a, r) => a + r.latencyMs, 0) / total
  );

  console.log(`\nAccuracy:    ${accuracy}%  (${passed}/${total})`);
  console.log(`Avg latency: ${avgLatency}ms`);

  // Failed cases detail
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log(`\nFailed cases:`);
    for (const r of failed) {
      console.log(`  • ${r.id}: ${r.error ?? r.failures.join(' | ')}`);
    }
  }

  // Write report
  const reportLines = [
    '# Eval Report',
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Accuracy:** ${accuracy}% (${passed}/${total})`,
    `**Avg latency:** ${avgLatency}ms`,
    '',
    '## Results',
    '',
    '| ID | Passed | Steps | Latency | Notes |',
    '|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.passed ? '✓' : '✗'} | ${r.steps} | ${r.latencyMs}ms | ${(r.error ?? r.failures.join('; ')) || '-'} |`
    ),
  ];

  const reportPath = path.join(process.cwd(), 'evals', 'report.md');
  fs.writeFileSync(reportPath, reportLines.join('\n') + '\n');
  console.log(`\nReport written to evals/report.md`);

  // Exit with non-zero if accuracy below threshold
  if (passed / total < 0.6) {
    console.error(`\nAccuracy below 60% threshold.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Eval runner crashed:', err);
  process.exit(1);
});
