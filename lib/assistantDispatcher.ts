import { store } from '@/store';
import { openCompose, openEmail, setView } from '@/store/uiSlice';
import {
  setFilters,
  setCompose,
  sendEmail,
  markAsRead,
} from '@/store/mailSlice';
import type { AssistantAction } from '@/types/assistant';

/**
 * Central dispatcher that translates AI assistant actions into Redux state updates
 * This is the bridge between AI intent and UI changes
 */
export function dispatchAssistantAction(action: AssistantAction): string {
  const state = store.getState();

  switch (action.type) {
    case 'OPEN_COMPOSE':
      store.dispatch(openCompose());
      return 'Opening compose view...';

    case 'FILL_COMPOSE':
      store.dispatch(setCompose(action.payload));
      return `Filled: ${Object.keys(action.payload).join(', ')}`;

    case 'SEND_EMAIL':
      const compose = state.mail.compose;
      if (!compose.to || !compose.subject) {
        return 'Cannot send: missing recipient or subject';
      }
      store.dispatch(sendEmail());
      store.dispatch(setView('INBOX'));
      return 'Email sent successfully!';

    case 'FILTER_EMAILS':
      store.dispatch(setFilters(action.payload));
      store.dispatch(setView('INBOX'));
      return `Applied filters: ${JSON.stringify(action.payload)}`;

    case 'OPEN_EMAIL':
      const email = state.mail.emails.find((e) => e.id === action.payload.id);
      if (email) {
        store.dispatch(openEmail(action.payload.id));
        store.dispatch(markAsRead(action.payload.id));
        return `Opened email: ${email.subject}`;
      }
      return 'Email not found';

    case 'REPLY_TO_CURRENT':
      const currentEmail = state.mail.emails.find(
        (e) => e.id === state.ui.selectedEmailId
      );
      if (currentEmail) {
        store.dispatch(openCompose());
        store.dispatch(
          setCompose({
            to: currentEmail.from,
            subject: `Re: ${currentEmail.subject}`,
            body: `\n\n---\nOn ${currentEmail.date}, ${currentEmail.from} wrote:\n${currentEmail.body}`,
          })
        );
        return `Replying to: ${currentEmail.subject}`;
      }
      return 'No email selected to reply to';

    default:
      return 'Unknown action';
  }
}
