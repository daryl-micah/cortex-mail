import Link from 'next/link';
import Image from 'next/image';
import CommandDemo from './CommandDemo';

const STATUSES = [
  { label: 'Needs reply', tone: 'text-pink bg-pink/20', why: 'The sender is explicitly asking you for something.' },
  { label: 'Waiting', tone: 'text-ice bg-ice/20', why: 'You’re waiting on them — a reminder or status check.' },
  { label: 'Follow up', tone: 'text-accent bg-accent/10', why: 'A thread went quiet and probably needs a nudge.' },
  { label: 'Important', tone: 'text-destructive bg-destructive/10', why: 'High-signal, no reply expected. Account and security notices.' },
  { label: 'FYI', tone: 'text-muted-foreground bg-surface-2', why: 'Newsletters, receipts, notifications.' },
  { label: 'Handled', tone: 'text-mint bg-mint/20', why: 'Already resolved. Nothing left to do.' },
];

export default function LandingPage() {
  return (
    <div className="h-screen overflow-y-auto bg-bg-desktop text-foreground">
      <header className="mx-auto max-w-[1080px] px-5 sm:px-8 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/cortex.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-display text-[13px] tracking-wide">CORTEX MAIL</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="https://github.com/daryl-micah/cortex-mail" target="_blank" rel="noreferrer" aria-label="Source on GitHub" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <Image src="/github.svg" alt="" width={16} height={16} className="h-4 w-4" />
            <span className="hidden sm:inline">Source</span>
          </a>
          <Link href="/login" className="chrome-surface bevel rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap">
            <span className="sm:hidden">Sign in</span>
            <span className="hidden sm:inline">Sign in with Google</span>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1080px] px-5 sm:px-8">
        {/* Hero */}
        <section className="pt-14 sm:pt-20 pb-10">
          <h1 className="font-display text-[26px] sm:text-[40px] leading-[1.15] max-w-[18ch]">
            Tell your inbox what to do.
          </h1>
          <p className="font-email text-base sm:text-lg text-muted-foreground mt-4 max-w-[52ch] leading-relaxed">
            Cortex Mail sits on top of Gmail and reads it for you. Type what you want in plain
            language — the app finds the thread, opens the right view, drafts the reply — and
            nothing goes out until you say so.
          </p>
        </section>

        <section className="pb-16 sm:pb-24">
          <CommandDemo />
        </section>

        {/* What it reads for you */}
        <section className="pb-16 sm:pb-24 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <h2 className="font-display text-lg sm:text-xl leading-snug max-w-[20ch]">
              Every email gets a status before you open it.
            </h2>
            <p className="font-email text-muted-foreground mt-3 max-w-[44ch] leading-relaxed">
              As your inbox syncs, a model classifies each message from the sender&apos;s intent, not
              from a Gmail label. The Today view groups what needs a reply and what you&apos;re still
              waiting on, so the first screen answers “what do I deal with?” instead of listing 128
              messages.
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 self-start">
            {STATUSES.map((s) => (
              <div key={s.label} className="border-t border-border-strong/60 pt-2.5">
                <dt>
                  <span className={`inline-block chrome-label px-1.5 py-0.5 rounded ${s.tone}`}>{s.label}</span>
                </dt>
                <dd className="font-email text-sm text-muted-foreground mt-1.5">{s.why}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Thread insight */}
        <section className="pb-16 sm:pb-24 grid gap-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-start">
          <div className="bevel rounded-lg bg-card p-4 sm:p-5 text-sm order-2 md:order-1">
            <div className="font-email">
              <div className="font-semibold">Q4 partnership numbers</div>
              <div className="text-muted-foreground text-xs mt-0.5">Sarah Chen · sarah@company.com · Today, 11:32</div>
              <p className="mt-3 leading-relaxed text-foreground/90">
                Hey Daryl, following up on our call — can you send the updated numbers by Friday? Finance wants them before the board deck goes out.
              </p>
            </div>
            <div className="border-t border-border mt-4 pt-3">
              <div className="chrome-label text-accent mb-2">✦ Cortex insight</div>
              <div className="bevel rounded-md bg-surface-2 p-3 font-email space-y-2">
                <p>Sarah is asking for the updated Q4 numbers before the board deck.</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="chrome-label text-muted-foreground">Action</dt><dd>Send updated Q4 numbers</dd>
                  <dt className="chrome-label text-muted-foreground">Deadline</dt><dd>Friday</dd>
                </dl>
                <blockquote className="bg-card bevel rounded-md p-2.5 text-foreground/90 text-[13px]">
                  Hi Sarah, absolutely — I&apos;ll have the updated numbers to you by Friday, ahead of the board deck.
                </blockquote>
                <span className="inline-block chrome-surface bevel rounded-md px-2.5 py-1 text-xs font-medium">Use this reply</span>
              </div>
            </div>
            <div className="border-t border-border mt-4 pt-3 flex flex-wrap gap-1.5 text-xs">
              {['Summarize', 'Draft reply', 'Find related', 'Draft follow-up'].map((a) => (
                <span key={a} className="bevel rounded-md px-2 py-1 text-muted-foreground">{a}</span>
              ))}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <h2 className="font-display text-lg sm:text-xl leading-snug max-w-[20ch]">
              Open a thread and the ask is already pulled out.
            </h2>
            <p className="font-email text-muted-foreground mt-3 max-w-[44ch] leading-relaxed">
              Each opened email gets a one-line reading: what they want, by when, and a reply drafted
              in your voice that lands in the compose window with one click. Below it, four
              one-click actions and a free-text box that already knows which email you&apos;re looking at —
              ask “what is she waiting on?” without pasting anything.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-16 sm:pb-24 max-w-[64ch]">
          <h2 className="font-display text-lg sm:text-xl leading-snug">How a sentence becomes a click</h2>
          <ol className="font-email text-muted-foreground mt-4 space-y-3 leading-relaxed list-decimal pl-5 marker:text-foreground marker:font-medium">
            <li>
              Your message goes to a ReAct agent on Groq (GPT-OSS 120B). Relevant emails are pulled
              from a Pinecone index first, so the model reasons over what matters, not your whole inbox.
            </li>
            <li>
              The agent picks from a small set of tools — <code className="font-mono text-xs text-foreground">search_emails</code>,{' '}
              <code className="font-mono text-xs text-foreground">get_email_body</code>,{' '}
              <code className="font-mono text-xs text-foreground">reply_to_email</code>,{' '}
              <code className="font-mono text-xs text-foreground">filter_emails</code> — and every output is validated against a Zod schema before it&apos;s trusted.
            </li>
            <li>
              Tool results become Redux actions. That&apos;s why “draft a reply” opens the actual compose
              drawer instead of printing text into a chat.
            </li>
            <li>
              Anything that leaves your account — sending mail — stops at a confirmation you can edit or cancel.
            </li>
          </ol>
        </section>

        {/* CTA */}
        <section className="pb-20 sm:pb-28 border-t border-border-strong/60 pt-10">
          <h2 className="font-display text-lg sm:text-xl leading-snug">Try it on your own inbox</h2>
          <p className="font-email text-muted-foreground mt-2 max-w-[48ch]">
            Sign in with Google. Cortex asks for permission to read and send mail on your behalf and stores nothing outside your session.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/login" className="chrome-surface bevel rounded-md px-4 py-2 text-sm font-medium">
              Sign in with Google
            </Link>
            <a href="https://github.com/daryl-micah/cortex-mail" target="_blank" rel="noreferrer" className="bevel rounded-md bg-card px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              Read the source
            </a>
          </div>
          <p className="mt-8 text-xs text-muted-foreground font-email">
            <Link href="/policy" className="underline hover:text-foreground">Privacy policy</Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
