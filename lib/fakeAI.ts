import { AIAction } from './assistantDispatcher';

export function fakeAI(prompt: string): AIAction {
  const lower = prompt.toLowerCase();

  if (lower.includes('reply')) {
    return {
      type: 'REPLY_EMAIL',
      payload: {
        body: 'Thanks for the update. Sounds good to me.',
      },
    };
  }

  return {
    type: 'COMPOSE_EMAIL',
    payload: {
      subject: 'Regarding our discussion',
      body: 'Hi,\n\nJust following up on this.\n\nBest regards,',
    },
  };
}
