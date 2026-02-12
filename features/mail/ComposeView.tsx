import { RootState } from '@/store';
import { useSelector } from 'react-redux';
import ComposeForm from './components/ComposeForm';

export default function ComposeView() {
  const { viewState } = useSelector((state: RootState) => state.compose);

  if (viewState === 'closed') {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-0 w-120 h-130 border bg-background shadow-xl">
      <ComposeForm />
    </div>
  );
}
