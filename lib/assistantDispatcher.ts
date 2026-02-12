import { updateDraft } from '@/store/composeSlice';
import { Dispatch } from '@reduxjs/toolkit';

export type AIAction =
  | {
      type: 'COMPOSE_EMAIL';
      payload: {
        subject: string;
        body: string;
      };
    }
  | {
      type: 'REPLY_EMAIL';
      payload: {
        body: string;
      };
    };

export function dispatchAIAction(action: AIAction, dispatch: Dispatch) {
  switch (action.type) {
    case 'COMPOSE_EMAIL':
      dispatch(updateDraft(action.payload));
      break;

    case 'REPLY_EMAIL':
      dispatch(updateDraft({ body: action.payload.body }));
      break;

    default:
      console.warn('Unknown AI action:', action);
  }
}
