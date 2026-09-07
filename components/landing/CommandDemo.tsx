'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Search, Zap, Clock, Pencil, Inbox, Megaphone, Star, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Scripted scenarios — each is a real thing the agent can do today    */
/* ------------------------------------------------------------------ */

type Scene = 'today' | 'search' | 'draft' | 'newsletters';

interface Scenario {
  id: Scene;
  command: string;
  outcome: string;
  trace: string[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'today',
    command: 'What needs my attention today?',
    outcome: 'Opens the Today briefing',
    trace: ['classify_inbox', 'final_answer'],
  },
  {
    id: 'search',
    command: 'Find everything Sarah asked me to send',
    outcome: 'Semantic search, ranked by meaning',
    trace: ['search_emails', 'final_answer'],
  },
  {
    id: 'draft',
    command: 'Draft a reply to Sarah about the Q4 numbers',
    outcome: 'Fills the compose drawer, waits for you to send',
    trace: ['search_emails', 'get_email_body', 'reply_to_email'],
  },
  {
    id: 'newsletters',
    command: 'Show my newsletters',
    outcome: 'Switches the view and filters the list',
    trace: ['filter_emails'],
  },
];

const ROWS = [
  { from: 'Sarah Chen', subject: 'Q4 partnership numbers', preview: 'Can you send the updated numbers by Friday?', time: '2h', status: 'reply' as const, cat: 'primary' },
  { from: 'John Smith', subject: 'Interview follow-up', preview: 'Just checking whether you had a chance to review…', time: '5h', status: 'reply' as const, cat: 'primary' },
  { from: 'Google Workspace', subject: 'Storage almost full', preview: 'Your account has used 94% of its storage.', time: '7h', status: 'waiting' as const, cat: 'updates' },
  { from: 'Atlassian', subject: 'Loom improvements', preview: 'Improvements are coming to permissions in Loom.', time: '9h', status: null, cat: 'promotions' },
  { from: 'The Pragmatic Engineer', subject: 'Issue 214: platform teams', preview: 'What separates platform teams that ship from…', time: '1d', status: null, cat: 'promotions' },
];

const TYPE_MS = 38;
const HOLD_AFTER_TYPE = 700;
const HOLD_SCENE = 4200;

/* ------------------------------------------------------------------ */

export default function CommandDemo() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<'typing' | 'thinking' | 'done'>('typing');
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  const scenario = SCENARIOS[index];

  // Reduced motion: skip the typing loop and show the first finished state
  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced.current) return;
    const t = setTimeout(() => {
      setTyped(SCENARIOS[0].command);
      setPhase('done');
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // One timeline per scenario: type → think → done → advance
  useEffect(() => {
    if (paused || reduced.current) return;
    let t: ReturnType<typeof setTimeout>;
    const cmd = scenario.command;

    if (phase === 'typing') {
      if (typed.length < cmd.length) {
        t = setTimeout(() => setTyped(cmd.slice(0, typed.length + 1)), TYPE_MS);
      } else {
        t = setTimeout(() => setPhase('thinking'), HOLD_AFTER_TYPE);
      }
    } else if (phase === 'thinking') {
      t = setTimeout(() => setPhase('done'), 900);
    } else {
      t = setTimeout(() => {
        setIndex((i) => (i + 1) % SCENARIOS.length);
        setTyped('');
        setPhase('typing');
      }, HOLD_SCENE);
    }
    return () => clearTimeout(t);
  }, [typed, phase, paused, scenario]);

  const jump = (i: number) => {
    setIndex(i);
    setTyped(SCENARIOS[i].command);
    setPhase('done');
  };

  const scene: Scene | null = phase === 'done' ? scenario.id : null;

  return (
    <div
      className="w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Scenario picker — doubles as the "what you can say" list */}
      <ol className="flex flex-wrap gap-x-5 gap-y-2 mb-4 text-xs font-email" aria-label="Example commands">
        {SCENARIOS.map((s, i) => (
          <li key={s.id}>
            <button
              onClick={() => jump(i)}
              aria-current={i === index}
              className={cn(
                'text-left transition-colors underline-offset-4',
                i === index ? 'text-foreground underline decoration-accent' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              “{s.command}”
            </button>
          </li>
        ))}
      </ol>

      {/* The window */}
      <div className="bevel rounded-lg bg-bg-window shadow-2xl overflow-hidden" aria-live="polite">
        <div className="chrome-surface h-7 flex items-center px-3 gap-1.5 border-b border-border-strong">
          <span className="h-2.5 w-2.5 rounded-full bg-white/50 border border-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/50 border border-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-pink/70 border border-black/10" />
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-[168px_1fr] h-[360px] sm:h-[420px]">
          {/* Sidebar */}
          <aside className="hidden sm:block border-r border-border bg-card p-2.5 space-y-3 text-[11px]">
            <div className="font-display text-[10px] tracking-wide px-1">CORTEX MAIL</div>
            <div className="chrome-surface bevel rounded px-2 py-1 flex items-center gap-1.5 justify-center"><Pencil className="h-3 w-3" /> Compose</div>
            <div className="bevel rounded px-2 py-1 flex items-center gap-1.5 text-muted-foreground bg-surface-2"><Search className="h-3 w-3" /> Search…</div>
            <nav className="space-y-0.5">
              <NavItem icon={<Sparkles />} label="Today" count={3} active={scene === 'today' || scene === null} />
              <NavItem icon={<Inbox />} label="Inbox" count={128} />
              <NavItem icon={<Zap />} label="Needs Reply" count={2} />
              <NavItem icon={<Clock />} label="Waiting On" count={1} />
              <NavItem icon={<Send />} label="Sent" />
              <NavItem icon={<Star />} label="Starred" />
              <NavItem icon={<Megaphone />} label="Newsletters" count={2} active={scene === 'newsletters'} />
            </nav>
          </aside>

          {/* Main */}
          <main className="relative overflow-hidden p-3 sm:p-4">
            {scene === 'newsletters' ? (
              <ListView title="Newsletters" rows={ROWS.filter((r) => r.cat === 'promotions')} />
            ) : scene === 'draft' ? (
              <ListView title="Inbox" rows={ROWS} dim />
            ) : (
              <TodayView />
            )}

            {/* Compose drawer */}
            <div
              className={cn(
                'absolute inset-y-0 right-0 w-[86%] sm:w-[72%] bg-card border-l border-border shadow-2xl transition-transform duration-500 ease-out flex flex-col text-[11px]',
                scene === 'draft' ? 'translate-x-0' : 'translate-x-full'
              )}
              aria-hidden={scene !== 'draft'}
            >
              <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 font-medium"><Pencil className="h-3 w-3 text-accent" /> New message</div>
              <div className="px-3 py-1.5 border-b border-border font-email text-muted-foreground">To <span className="text-foreground">sarah@company.com</span></div>
              <div className="px-3 py-1.5 border-b border-border font-email text-muted-foreground">Subject <span className="text-foreground">Re: Q4 partnership numbers</span></div>
              <p className="px-3 py-2 font-email leading-relaxed text-foreground/90 flex-1">
                Hi Sarah, absolutely — I&apos;ll have the updated Q4 numbers over to you by Friday. Let me know if you need the breakdown by region as well.
              </p>
              <div className="px-3 py-2 border-t border-border flex justify-between items-center">
                <span className="text-muted-foreground font-email">Nothing is sent until you confirm.</span>
                <span className="chrome-surface bevel rounded px-2 py-1">Send</span>
              </div>
            </div>
          </main>

          {/* ⌘K palette */}
          <div
            className={cn(
              'absolute inset-0 flex items-start justify-center pt-10 sm:pt-14 bg-[#1B1826]/20 transition-opacity duration-300',
              scene && scene !== 'search' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            )}
          >
            <div className="w-[88%] max-w-sm bg-card bevel rounded-lg shadow-2xl overflow-hidden text-[12px]">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-email flex-1 min-h-[1em]">
                  {typed}
                  {phase === 'typing' && <span className="inline-block w-px h-[1em] bg-foreground align-middle ml-px animate-pulse" />}
                </span>
                <kbd className="chrome-label text-muted-foreground">⌘K</kbd>
              </div>
              <div className="px-3 py-2 flex items-center gap-2 text-muted-foreground">
                <Sparkles className={cn('h-3.5 w-3.5 text-accent', phase === 'thinking' && 'animate-pulse')} />
                {phase === 'thinking' ? (
                  <span className="font-email">
                    {scenario.trace.map((t, i) => (
                      <span key={t}>
                        {i > 0 && <span className="mx-1 opacity-50">›</span>}
                        <code className="font-mono text-[11px]">{t}</code>
                      </span>
                    ))}
                  </span>
                ) : scene === 'search' ? (
                  <span>Found 2 conversations</span>
                ) : (
                  <span>Ask Cortex</span>
                )}
              </div>
              {scene === 'search' && (
                <div className="border-t border-border">
                  {[
                    { ...ROWS[0], match: 93 },
                    { from: 'Sarah Chen', subject: 'Q4 contract', preview: 'Let me know if you can review and send this back.', time: '4d', status: 'reply' as const, cat: 'primary', match: 86 },
                  ].map((r) => (
                    <div key={r.subject} className="px-3 py-2 border-b border-border last:border-b-0 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <span className="font-email font-semibold truncate">{r.subject}</span>
                        <span className="chrome-label text-[9px] text-muted-foreground">{r.match}% match</span>
                      </div>
                      <div className="font-email text-muted-foreground truncate">{r.from} · {r.preview}</div>
                      <div className="mt-0.5"><Badge status={r.status} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground font-email">
        {scenario.outcome}
        {paused && <span className="ml-2 opacity-70">(paused)</span>}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NavItem({ icon, label, count, active }: { icon: React.ReactNode; label: string; count?: number; active?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-1.5 py-1 rounded border-l-2 transition-colors',
        active ? 'bg-surface-2 border-l-accent text-foreground' : 'border-l-transparent text-muted-foreground'
      )}
    >
      <span className="[&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="chrome-label text-[9px] text-muted-foreground">{count}</span>}
    </div>
  );
}

function Badge({ status }: { status: 'reply' | 'waiting' | null }) {
  if (!status) return null;
  return status === 'reply' ? (
    <span className="inline-flex items-center gap-1 chrome-label text-[9px] text-pink bg-pink/20 px-1 py-px rounded"><Zap className="h-2.5 w-2.5" /> Needs reply</span>
  ) : (
    <span className="inline-flex items-center gap-1 chrome-label text-[9px] text-ice bg-ice/20 px-1 py-px rounded"><Clock className="h-2.5 w-2.5" /> Waiting</span>
  );
}

function Row({ r }: { r: (typeof ROWS)[number] }) {
  return (
    <div className="px-2.5 py-1.5 border-b border-border last:border-b-0 text-[11px]">
      <div className="flex justify-between gap-2">
        <span className="font-email font-semibold truncate">{r.from}</span>
        <span className="chrome-label text-[9px] text-muted-foreground">{r.time}</span>
      </div>
      <div className="font-email truncate">{r.subject}</div>
      <div className="font-email text-muted-foreground truncate">{r.preview}</div>
      {r.status && <div className="mt-0.5"><Badge status={r.status} /></div>}
    </div>
  );
}

function TodayView() {
  const reply = ROWS.filter((r) => r.status === 'reply');
  return (
    <div className="text-[11px]">
      <div className="text-sm font-semibold">Good afternoon, Daryl.</div>
      <div className="text-muted-foreground font-email mb-3">3 emails need your attention.</div>
      <div className="bevel rounded-md bg-card overflow-hidden mb-2.5">
        <div className="flex justify-between px-2.5 py-1.5 bg-pink/15 chrome-label text-[9px]"><span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" /> Needs reply</span><span>2</span></div>
        {reply.map((r) => <Row key={r.subject} r={r} />)}
      </div>
      <div className="bevel rounded-md bg-card overflow-hidden">
        <div className="flex justify-between px-2.5 py-1.5 bg-ice/15 chrome-label text-[9px]"><span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Waiting on</span><span>1</span></div>
        <Row r={ROWS[2]} />
      </div>
    </div>
  );
}

function ListView({ title, rows, dim }: { title: string; rows: typeof ROWS; dim?: boolean }) {
  return (
    <div className={cn('text-[11px] transition-opacity', dim && 'opacity-50')}>
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="bevel rounded-md bg-card overflow-hidden">
        {rows.map((r) => <Row key={r.subject} r={r} />)}
      </div>
    </div>
  );
}
