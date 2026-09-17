# Cortex Mail

An AI-native Gmail client. Every email arrives already read: classified into what needs a reply, what you're waiting on, and what's just noise. A ReAct agent drives the UI, proposes batch actions for you to approve, and answers questions over a semantic index of your mail.

Built with Next.js, the Gmail API, Groq (GPT-OSS 120B), Pinecone, Redux Toolkit and Zod.

**Live Demo**: https://cortex-mail.darylmicah.me

## Features

- **Classified inbox and Today view** — every email is tagged `needs_reply`, `waiting_on`, `follow_up`, `important`, `fyi` or `handled`, with a one-line reason and any deadline the model spotted. The Today view surfaces what needs a reply and what you're waiting on; the sidebar filters the inbox by status.
- **Cortex Insight** — open a thread and get a one-sentence summary, the explicit ask if there is one, its deadline, and a suggested reply you can drop straight into compose.
- **ReAct agent with approval flow** — multi-step tool use over the mailbox. Reads and searches run immediately; anything consequential (archive, star, reply, mark read) comes back as a proposed batch you review, run, and can undo.
- **Semantic search with reranking** — emails are embedded into a per-user Pinecone namespace and retrieved by meaning, then reranked with a cross-encoder. Results open in place and the agent cites the emails it used as clickable rows.
- **Contextual actions** — from an open thread: summarize, draft a reply, find related mail, draft a follow-up. Each is one round-trip through the same agent.
- **Structured output everywhere** — every model response is validated against a Zod schema. Failures are logged with the real reason and surfaced in the UI rather than rendered as an empty result.

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
2. **Name:** `cortex-mail` (or set `PINECONE_INDEX_NAME`)
3. **Dimensions:** `1024` (multilingual-e5-large)
4. **Metric:** `cosine`
5. **Type:** Serverless

Each signed-in user gets their own namespace inside this index, so one account's vectors never appear in another's results.

### 3. Environment Variables

Create `.env.local` in the root:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
GROQ_API_KEY=your_groq_api_key
PINECONE_API_KEY=your_pinecone_api_key

# Optional
PINECONE_INDEX_NAME=cortex-mail
PINECONE_RERANK_MODEL=bge-reranker-v2-m3
```

`GROQ_API_KEY` must also be set in your deployment environment. Without it, classification, insights and the assistant are unavailable, and the app says so rather than failing silently.

### 4. Install & Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and sign in with Google.

## Demo Video

https://www.loom.com/share/c7fbd1cf3400438397c17edee48408a8

## Architecture

### Email Classification (`lib/classifier.ts`)

On each inbox fetch, unclassified emails are sent to GPT-OSS 120B in batches of eight and come back as `{ id, status, reason, deadline? }`, validated against a Zod schema and cached per message id for the life of the server process. The client only asks about emails that have no status yet, so polling doesn't re-send known mail.

The batch size and token ceiling aren't arbitrary. GPT-OSS is a reasoning model and its reasoning tokens count against `max_tokens`. An earlier version sent 25 emails at a 2,000-token ceiling; the model spent 1,405 tokens thinking and got cut off mid-JSON. Worse, the truncated payload sometimes still parsed, so a partial answer passed validation. The classifier now:

- treats `finish_reason: "length"` as a failure regardless of whether the JSON parses
- recovers from truncation by splitting the batch in half and recursing, since an identical retry truncates identically
- returns exactly one entry per input email, marking anything the model omitted as `unclassified` (which renders no badge, rather than a made-up one)
- logs a thrown API call with its real error and propagates a total outage to the UI as a `502` with the reason

### Cortex Insight (`lib/insight.ts`)

A single per-thread call with the full body: one-sentence summary, the ask if present, a deadline only if stated, and a suggested reply. Cached by message id. Returns nothing on failure, and the drawer simply omits the card.

### ReAct Agent Loop (`lib/reactAgent.ts`)

The assistant follows the ReAct pattern (Reason + Act):

1. LLM emits a `thought` + `action` + `action_input`
2. The tool executes and returns an `observation`
3. The observation is fed back into the next LLM call
4. Loop repeats up to 8 iterations until a `final_answer` is produced

Available tools: `search_emails`, `get_email_body`, `summarize_thread`, `compose_email`, `send_email`, `open_email`, `reply_to_email`, `filter_emails`, `propose_actions`. Tools that change the UI return a JSON action payload dispatched to Redux. When an open email exists, its id is placed in the system prompt so "this email" resolves without a search.

### Action Review (`components/review/ActionReview.tsx`, `store/actionsSlice.ts`)

Consequential actions never run straight from the model. `propose_actions` returns a batch of `reply | archive | star | read` items, each with a one-sentence reason drawn from the email, validated as a Zod discriminated union. The review drawer shows the batch, the user runs it, and the result is pushed onto an undo stack. Replies keep Gmail threading via `In-Reply-To`.

### RAG Pipeline (`lib/embeddings.ts`)

On every inbox fetch, new emails are embedded with Pinecone's hosted `multilingual-e5-large` model and upserted into the user's namespace; ids already present are skipped. A query pulls a wider set of dense candidates, then reranks them with `bge-reranker-v2-m3` against sender, subject and a body snippet, falling back to raw cosine if the reranker is unavailable. Sender and date are indexed so "from Sarah last week" works as a filter, not a guess.

### Context Management (`lib/contextBuilder.ts`, `lib/tokenCounter.ts`)

Each request is measured in tokens via `js-tiktoken`. The API accepts a conversation history and summarises older turns with GPT-OSS 20B when the budget is exceeded. The current UI sends single-shot requests through `lib/useAskCortex.ts`, shared by the search palette and the thread drawer.

### Structured Output + Retry Logic (`lib/schemas.ts`)

Every model response is validated against a Zod schema. Agent steps retry up to 2 times with the validation error appended so the model can self-correct. Every LLM call, tool call and agent run is appended to `ai-logs.jsonl` via `lib/aiLogger.ts`, including calls that threw before returning.

> Eval harness (`evals/`) is not included in this repo — the assistant API requires an authenticated Gmail session that can't be bypassed cleanly in a script-based runner.

### Redux + Dispatcher Pattern

`lib/assistantDispatcher.ts` translates agent action payloads into Redux state changes. The agent returns `{ action: "COMPOSE_EMAIL", to: "...", subject: "..." }` and the dispatcher handles the wiring, so adding a UI action touches neither the agent nor the tools. All four Groq clients are constructed lazily through `lib/groqClient.ts` so a missing key fails at request time with a message, not at import time with a 500.

### Groq for Inference

GPT-OSS 120B via Groq, with `reasoning_effort: "low"` for classification. Fast enough that most multi-step agent queries complete in under 3 seconds and a 20-email classification pass in about 2. `response_format: { type: "json_object" }` plus Zod validation removes the need for regex parsing fallbacks. Conversation summarisation uses GPT-OSS 20B.

## What I'd Improve With More Time

**Gmail Push Notifications** — Replace 30-second polling with Pub/Sub. Setup requires domain verification and webhook configuration but eliminates the latency on new email arrival.

**Persistent classification cache** — Statuses and insights live in a process-lifetime `Map`, so a redeploy reclassifies the visible page. A per-user KV store keyed by message id would make them survive restarts and be shared across instances.

**Thread/Conversation View** — Emails aren't grouped by `threadId`. Data is already present; needs UI grouping and a "show conversation" toggle.

**Token-Aware RAG Compression** — RAG results are truncated by character count when over budget. A smarter approach would drop the lowest-reranked chunks first.

**Eval Harness** — No automated accuracy benchmarks for classification or the agent. Would add an LLM-as-judge eval that replays a seed dataset without a live Gmail session.

**OAuth Token Refresh** — Access tokens expire after 1 hour. The refresh token is stored but silent refresh on `401` isn't implemented; users must sign in again.

**Keyboard Shortcuts** — `Ctrl+K` opens the search palette. Gmail-style shortcuts (`c` compose, `r` reply, `j/k` navigation) are missing.
