# Cortex Mail

AI-powered mail application where the assistant controls the UI. Built with Next.js, Gmail API, and Groq LLM.

**Live Demo**: https://cortex-mail-azure.vercel.app

## How to Set It Up and Run Locally

### Prerequisites

- Node.js 18+ and pnpm
- Google Cloud project with Gmail API enabled
- Groq API key

### 1. Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add your email as a test user in OAuth consent screen

### 2. Environment Variables

Create `.env.local` in the root:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
GROQ_API_KEY=your_groq_api_key
```

### 3. Install & Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and sign in with Google.

## Architecture Decisions and Trade-offs

### Redux + Dispatcher Pattern

Chose Redux Toolkit over Context API because the assistant needs to dispatch actions from outside React components. The dispatcher pattern keeps things clean—AI outputs JSON actions, dispatcher translates to Redux state changes, UI reacts automatically. This separation made it easy to add the confirmation dialog for email sending without touching the AI logic.

### Groq for AI (Not OpenAI)

Went with Groq's Llama 3.3 70B instead of OpenAI. Faster inference, cheaper, and structured JSON output is more reliable than function calling with open-source models. The assistant doesn't need streaming since actions are atomic—either you open compose or you don't. Also avoided vendor lock-in.

### Polling Over Push Notifications

Implemented 30-second polling instead of Gmail push notifications. Push requires webhook setup, domain verification, Pub/Sub configuration. Polling is naive but works reliably. Silent background refresh keeps it non-intrusive. Real production app would use push.

### Iframe for Email Rendering

HTML emails render in sandboxed iframes instead of using DOMPurify. Handles inline images by mapping CID references to attachment URLs via a proxy endpoint. Iframe sandboxing (`allow-same-origin` only) is simpler and more secure than sanitizing. Auto-resizes to content height.

### No Streaming for Assistant

Assistant responses are non-streaming because the output is structured actions, not conversational text. User doesn't need to watch JSON being generated character by character. Simpler error handling and the UX is actually better—actions execute immediately rather than waiting for stream to finish.

## What I'd Improve With More Time

**Better AI Context Management** - Currently sending all email metadata on every request. For large inboxes (500+ emails), this hits token limits. Would implement summarization or a sliding context window with only recent/relevant emails.

**Semantic Search** - Filtering works but "find that email about the AWS migration" doesn't. Would add embeddings (OpenAI ada-002 or local with Sentence Transformers) + vector search. Store embeddings in Redis or Postgres with pgvector.

**Gmail Push Notifications** - Replace polling with Pub/Sub. The 30s delay is noticeable when testing sends. Setup is annoying but worth it for production. Would also add optimistic updates—mark as read immediately, then sync.

**Thread/Conversation View** - Emails aren't grouped by Gmail's threadId. Data is there, just needs UI grouping and a "show conversation" toggle. Important for understanding context in back-and-forth emails.

**Retry Logic & Error Boundaries** - Happy path works but token refresh on OAuth expiry is missing. Would add exponential backoff for API failures, proper error boundaries, and toast notifications instead of inline errors.

**Tests** - Zero tests currently. Would add Playwright for E2E (especially assistant workflows—"send email to X" → confirm dialog → success), Vitest for utilities, and MSW for mocking Gmail API in tests.

**Assistant Clarification** - Should ask questions when ambiguous. "Which email from John? I see 3." Right now it picks the first match. Would add a clarification step before executing actions.

**Keyboard Shortcuts** - Only Ctrl+K for assistant focus. Would add Gmail-style shortcuts: `c` for compose, `r` for reply, `/` for search, `j/k` for navigation, `e` for archive.

**Offline Support** - No offline capability. Would add service worker for reading cached emails, queue outgoing sends, and sync when back online. IndexedDB for email storage.
