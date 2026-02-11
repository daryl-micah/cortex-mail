import Sidebar from './Sidebar';
import MainView from './MainView';
import AssistantPanel from './AssistantPanel';

export default function AppShell() {
  return (
    <div className="h-screen grid grid-cols-[260px_1fr_380px]">
      <Sidebar />
      <MainView />
      <AssistantPanel />
    </div>
  );
}
