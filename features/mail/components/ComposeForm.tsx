import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RootState } from '@/store';
import { closeCompose, sendingMail, updateDraft } from '@/store/composeSlice';
import { useDispatch, useSelector } from 'react-redux';

export default function ComposeForm() {
  const dispatch = useDispatch();
  const { draft, viewState } = useSelector((state: RootState) => state.compose);

  return (
    <div className="flex flex-col h-full">
      <header className="p-3 border-b flex justify-between">
        <span>New Message</span>
        <Button
          className="w-8 h-8 text-black"
          variant="secondary"
          onClick={() => dispatch(closeCompose())}
        >
          X
        </Button>
      </header>

      <div className="p-3 space-y-2">
        <Input
          placeholder="To"
          value={draft.to}
          onChange={(e) => dispatch(updateDraft({ to: e.target.value }))}
        />

        <Input
          placeholder="Subject"
          value={draft.subject}
          onChange={(e) => dispatch(updateDraft({ subject: e.target.value }))}
        />
      </div>

      <Textarea
        className="flex-1 p-2"
        placeholder="Write your message..."
        value={draft.body}
        onChange={(e) => dispatch(updateDraft({ body: e.target.value }))}
      />

      <footer className="p-3 border-t flex justify-between">
        <Button
          disabled={viewState === 'sending'}
          onClick={() => dispatch(sendingMail())}
        >
          Send
        </Button>
      </footer>
    </div>
  );
}
