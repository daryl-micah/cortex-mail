'use client';

import { RootState } from '@/store';
import { useSelector } from 'react-redux';

export default function MainView() {
  const view = useSelector((state: RootState) => state.ui.view);

  return (
    <main className="p-6">
      <div className="text-xl font-semibold">{view}</div>
    </main>
  );
}
