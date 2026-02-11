import { Input } from '@/components/ui/input';

export default function AssistantPanel() {
  return (
    <aside className="border-l border-border h-full p-4 flex flex-col">
      <h2 className="text-sm font-semibold mb-3">AI Assistant</h2>

      <div className="flex-1 text-sm text-muted-foreground">
        Ask me anything about your emails…
      </div>

      <Input placeholder="Type a command…" />
    </aside>
  );
}
