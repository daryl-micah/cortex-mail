import { store } from '@/store';
import { openCompose, openEmail, setView } from '@/store/uiSlice';
import {
  setFilters,
  setCompose,
  sendEmail,
  markAsRead,
} from '@/store/mailSlice';
import type { AssistantAction } from '@/types/assistant';
import type { AgentAction } from '@/lib/schemas';

/**
 * Central dispatcher that translates AI assistant actions into Redux state updates.
 * Supports both the legacy AssistantAction union (for internal use) and the new
 * AgentAction objects produced by the ReAct tool loop.
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

    case 'SEND_EMAIL': {
      const compose = state.mail.compose;
      if (!compose.to || !compose.subject) {
        return 'Cannot send: missing recipient or subject';
      }
      // Handled by AssistantPanel with confirmation dialog
      return 'SEND_REQUEST_PENDING';
    }

    case 'SEND_EMAIL_CONFIRMED':
      store.dispatch(sendEmail());
      store.dispatch(setView('INBOX'));
      return 'Email sent successfully!';

    case 'FILTER_EMAILS':
      store.dispatch(setFilters(action.payload));
      store.dispatch(setView('INBOX'));
      return `Applied filters: ${JSON.stringify(action.payload)}`;

    case 'OPEN_EMAIL': {
      const email = state.mail.emails.find((e) => e.id === action.payload.id);
      if (email) {
        store.dispatch(openEmail(action.payload.id));
        store.dispatch(markAsRead(action.payload.id));
        return `Opened email: ${email.subject}`;
      }
      return 'Email not found';
    }

    case 'REPLY_TO_CURRENT': {
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
    }

    default:
      return 'Unknown action';
  }
}

/**
 * Dispatch an array of AgentActions returned by the ReAct agent.
 * Returns a summary string and a boolean indicating whether a send confirmation
 * is needed (so the caller can show the ConfirmSendDialog).
 */
export function dispatchAgentActions(actions: AgentAction[]): {
  summary: string;
  needsConfirmation: boolean;
} {
  const state = store.getState();
  const results: string[] = [];
  let needsConfirmation = false;

  for (const agentAction of actions) {
    const payload = agentAction.payload as Record<string, unknown> | undefined;

    switch (agentAction.type) {
      case 'COMPOSE_EMAIL': {
        store.dispatch(openCompose());
        const fields: { to?: string; subject?: string; body?: string } = {};
        if (payload?.to) fields.to = String(payload.to);
        if (payload?.subject) fields.subject = String(payload.subject);
        if (payload?.body) fields.body = String(payload.body);
        if (Object.keys(fields).length > 0) store.dispatch(setCompose(fields));
        results.push('Compose opened');
        break;
      }

      case 'SEND_EMAIL': {
        const compose = state.mail.compose;
        if (compose.to && compose.subject) {
          needsConfirmation = true;
          results.push('Email ready to send. Please confirm.');
        } else {
          results.push('Cannot send: missing recipient or subject');
        }
        break;
      }

      case 'OPEN_EMAIL': {
        const id = payload?.id as string | undefined;
        if (id) {
          const email = state.mail.emails.find((e) => e.id === id);
          store.dispatch(openEmail(id));
          store.dispatch(markAsRead(id));
          results.push(email ? `Opened: ${email.subject}` : 'Opened email');
        }
        break;
      }

      case 'REPLY_TO_EMAIL': {
        const emailId =
          (payload?.emailId as string) ?? state.ui.selectedEmailId;
        const replyBody = payload?.body as string | undefined;
        const target = state.mail.emails.find((e) => e.id === emailId);
        if (target) {
          store.dispatch(openCompose());
          store.dispatch(
            setCompose({
              to: target.from,
              subject: `Re: ${target.subject}`,
              body: replyBody
                ? replyBody +
                  `\n\n---\nOn ${target.date}, ${target.from} wrote:\n${target.body}`
                : `\n\n---\nOn ${target.date}, ${target.from} wrote:\n${target.body}`,
            })
          );
          results.push(`Reply compose opened for: ${target.subject}`);
        } else {
          results.push('No email found to reply to');
        }
        break;
      }

      case 'FILTER_EMAILS': {
        const filters: {
          unread?: boolean;
          sender?: string;
          dateRange?: string;
        } = {};
        if (payload?.unread !== undefined)
          filters.unread = Boolean(payload.unread);
        if (payload?.sender) filters.sender = String(payload.sender);
        if (payload?.dateRange) filters.dateRange = String(payload.dateRange);
        store.dispatch(setFilters(filters));
        store.dispatch(setView('INBOX'));
        results.push(`Filters applied`);
        break;
      }

      // Legacy action types (kept for backward compat)
      case 'OPEN_COMPOSE':
        store.dispatch(openCompose());
        results.push('Compose opened');
        break;
    }
  }

  return {
    summary: results.join('\n'),
    needsConfirmation,
  };
}
