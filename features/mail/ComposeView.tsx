'use client';

import { useAppSelector } from '@/store';
import ComposeForm from './components/ComposeForm';

export default function ComposeView() {
  const view = useAppSelector((state) => state.ui.view);

  if (view !== 'OPEN_COMPOSE') {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="border rounded-lg shadow-lg bg-card overflow-hidden">
        <ComposeForm />
      </div>
    </div>
  );
}
