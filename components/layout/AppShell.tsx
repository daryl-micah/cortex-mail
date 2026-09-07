'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import MainView from './MainView';
import WindowChrome from './WindowChrome';
import SearchPalette from './SearchPalette';
import { Menu, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <WindowChrome>
      <div className="h-full flex flex-col md:grid md:grid-cols-[248px_1fr] md:grid-rows-[minmax(0,1fr)]">
        {/* Mobile Header with Navigation Buttons */}
        <div className="md:hidden flex items-center justify-between border-b border-border p-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-10 w-10"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <h1 className="text-base font-semibold flex-1 chrome-label text-[11px] tracking-widest">
            Cortex Mail
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="h-10 w-10"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>

        {/* Sidebar - Hidden on mobile by default, visible on md+ */}
        <div
          className={`absolute top-14 left-0 right-0 z-40 bg-background md:relative md:top-auto md:col-span-1 ${sidebarOpen ? 'block' : 'hidden'} md:block`}
        >
          <Sidebar
            onClose={() => setSidebarOpen(false)}
            onOpenSearch={() => setSearchOpen(true)}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden md:col-span-1 min-h-0">
          <MainView />
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </WindowChrome>
  );
}
