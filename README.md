# Cortex Mail

AI-powered email client where the assistant controls the UI via a ReAct agent loop. Built with Next.js, Gmail API, Groq (Llama 3.3 70B), Pinecone, and Zod.

**Live Demo**: https://cortex-mail-azure.vercel.app

## Features

- **RAG-powered semantic search** — emails are embedded and indexed in Pinecone; the assistant retrieves only relevant emails per query instead of dumping the full inbox into the prompt
- **ReAct agent loop** — multi-step tool use with visible reasoning chain; handles complex requests like "find the email from Sarah about the project and summarize it"
- **Multi-turn conversation** — full conversation history with token-budget management and automatic summarisation of older turns to stay within context limits
- **Structured output + eval harness** — all LLM outputs validated against Zod schemas with automatic retry-on-failure; `pnpm eval` runs an accuracy benchmark against a live server

## How to Set It Up and Run Locally

### Prerequisites

- Node.js 18+ and pnpm
- Google Cloud project with Gmail API enabled
- Groq API key
- Pinecone account (free serverless tier works)

### 1. Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add your email as a test user in OAuth consent screen

### 2. Pinecone Setup

1. Go to [Pinecone Console](https://app.pinecone.io) → Create Index
2. **Name:** `cortex-emails`
3. **Dimensions:** `1024` (multilingual-e5-large)
4. **Metric:** `cosine`
5. **Type:** Serverless

### 3. Environment Variables

Create `.env.local` in the root:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
GROQ_API_KEY=your_groq_api_key
PINECONE_API_KEY=your_pinecone_api_key
```

### 4. Install & Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and sign in with Google.

### 5. Run Eval Harness

With the dev server running:

```bash
pnpm eval
```

Runs 8 test cases against the live assistant API and writes a report to `evals/report.md`.

## Demo Video

https://www.loom.com/share/c7fbd1cf3400438397c17edee48408a8

## Architecture

### RAG Pipeline (`lib/embeddings.ts`)

On every inbox fetch, emails are embedded using Pinecone's `multilingual-e5-large` model and stored as vectors. When the assistant receives a query, it embeds the query and retrieves the top-k semantically similar emails before the first LLM call. This replaces the old approach of dumping the first 15 emails regardless of relevance, scaling cleanly to large inboxes.

### ReAct Agent Loop (`lib/reactAgent.ts`)

The assistant follows the ReAct pattern (Reason + Act):

1. LLM emits a `thought` + `action` + `action_input`
2. The tool executes and returns an `observation`
3. The observation is fed back into the next LLM call
4. Loop repeats up to 5 iterations until a `final_answer` is produced

Available tools: `search_emails`, `get_email_body`, `summarize_thread`, `compose_email`, `send_email`, `open_email`, `reply_to_email`, `filter_emails`. Tools that trigger UI changes return a JSON action payload dispatched to Redux.

### Multi-Turn Context Management (`lib/contextBuilder.ts`, `lib/tokenCounter.ts`)

Each request includes the full conversation history, RAG context, system prompt, and tool descriptions — all measured in tokens via `js-tiktoken`. When the conversation budget is exceeded, older turns are summarised and replaced with a single summary message, preventing crashes on long conversations while preserving recent context.

### Structured Output + Retry Logic (`lib/schemas.ts`, `lib/reactAgent.ts`)

Every LLM response is validated against a Zod schema (`AgentThoughtSchema`). On failure, the agent retries up to 2 times with the validation error appended to the conversation so the model can self-correct. All LLM calls, tool calls, and agent runs are logged to `ai-logs.jsonl` via `lib/aiLogger.ts`.

### Redux + Dispatcher Pattern

The dispatcher translates agent action payloads into Redux state changes. This decouples AI logic from UI — the agent returns `{ action: "COMPOSE_EMAIL", to: "...", subject: "..." }` and the dispatcher handles all Redux wiring. Adding new UI actions requires no changes to the agent or tools.

### Groq for Inference

Llama 3.3 70B via Groq. Fast enough that the ReAct loop completes in under 3 seconds for most multi-step queries. `response_format: { type: 'json_object' }` combined with Zod validation eliminates the need for regex parsing fallbacks.

## What I'd Improve With More Time

**Gmail Push Notifications** — Replace 30-second polling with Pub/Sub. Setup requires domain verification and webhook configuration but eliminates the latency on new email arrival. Would also add optimistic updates for read/unread state.

**Thread/Conversation View** — Emails aren't grouped by `threadId`. Data is already present; needs UI grouping and a "show conversation" toggle.

**Token-Aware RAG Compression** — RAG results are currently truncated by character count when over budget. A smarter approach would re-rank chunks by relevance score and drop the lowest-scoring ones first.

**Semantic Eval Scoring** — The eval harness does exact-match checks on action types and field values. Adding an LLM-as-judge step would catch cases where the agent technically passes but gives a poor response.

**OAuth Token Refresh** — Access tokens expire after 1 hour. Silent refresh on `401` from Gmail API is not implemented; users must sign in again.

**Keyboard Shortcuts** — Gmail-style shortcuts (`c` compose, `r` reply, `/` search, `j/k` navigation) are missing beyond `Ctrl+K` for assistant focus.
