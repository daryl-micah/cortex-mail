'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

function useClock() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString(undefined, { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

export default function WindowChrome({ children }: { children: React.ReactNode }) {
  const time = useClock();

  return (
    <div className="h-screen w-screen bg-bg-desktop flex items-center justify-center p-1 sm:p-2">
      <div className="w-full h-full max-w-[1920px] rounded-lg overflow-hidden bevel shadow-2xl flex flex-col bg-bg-window">
        <div className="chrome-surface h-8 shrink-0 flex items-center justify-between px-3 select-none">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/70 border border-black/10" aria-hidden />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-white/40 rounded px-2 py-0.5 chrome-label text-[9px] text-foreground/80">
            <Sparkles className="h-2.5 w-2.5" />
            AI POWERED. HUMAN APPROVED.
          </div>

          <div className="flex items-center gap-3">
            <span className="chrome-label text-[10px] text-foreground/70 tabular-nums hidden sm:inline">
              {time}
            </span>
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/50 border border-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/50 border border-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-pink/70 border border-black/10" />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
