'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import MainView from './MainView';
import AssistantPanel from './AssistantPanel';
import { Menu, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col md:grid md:grid-cols-[260px_1fr] lg:grid-cols-[260px_1fr_380px]">
      {/* Mobile Header with Navigation Buttons */}
      <div className="md:hidden flex items-center justify-between border-b p-4 gap-2">
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
        <h1 className="text-base md:text-lg font-semibold flex-1">
          Cortex Mail
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAssistantOpen(!assistantOpen)}
          className="h-10 w-10"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar - Hidden on mobile by default, visible on md+ */}
      <div
        className={`absolute top-16 left-0 right-0 z-40 bg-background md:relative md:top-auto md:col-span-1 ${sidebarOpen ? 'block' : 'hidden'} md:block`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden md:col-span-1 lg:col-span-1">
        <MainView />
      </div>

      {/* Assistant Panel - Hidden on mobile by default, visible on lg+ */}
      <div
        className={`fixed md:absolute bottom-0 left-0 right-0 z-40 bg-background h-[calc(100vh-64px)] md:h-auto md:max-h-none ${assistantOpen ? 'block md:hidden' : 'hidden'} lg:block`}
      >
        <AssistantPanel onClose={() => setAssistantOpen(false)} />
      </div>

      {/* Mobile Overlay */}
      {(sidebarOpen || assistantOpen) && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => {
            setSidebarOpen(false);
            setAssistantOpen(false);
          }}
        />
      )}
    </div>
  );
}
