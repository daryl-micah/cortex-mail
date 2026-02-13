import { MOCK_EMAILS } from '@/lib/mockEmails';
import { Email, Filters } from '@/types/mail';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ComposeState {
  to: string;
  subject: string;
  body: string;
}

interface MailState {
  emails: Email[];
  filters: Filters;
  loading: boolean;
  compose: ComposeState;
}

const initialState: MailState = {
  emails: MOCK_EMAILS,
  filters: {},
  loading: false,
  compose: {
    to: '',
    subject: '',
    body: '',
  },
};

const mailSlice = createSlice({
  name: 'mail',
  initialState,
  reducers: {
    markAsRead(state, action: PayloadAction<string>) {
      const email = state.emails.find((e) => e.id === action.payload);
      if (email) {
        email.unread = false;
      }
    },
    setFilters(state, action: PayloadAction<Filters>) {
      state.filters = action.payload;
    },
    setCompose(state, action: PayloadAction<Partial<ComposeState>>) {
      state.compose = { ...state.compose, ...action.payload };
    },
    clearCompose(state) {
      state.compose = { to: '', subject: '', body: '' };
    },
    sendEmail(state) {
      // Create new email from compose
      const newEmail: Email = {
        id: crypto.randomUUID(),
        from: 'Me',
        subject: state.compose.subject,
        preview: state.compose.body.substring(0, 50) + '...',
        body: state.compose.body,
        date: 'Just now',
        unread: false,
      };
      state.emails.unshift(newEmail);
      state.compose = { to: '', subject: '', body: '' };
    },
  },
});

export const { markAsRead, setFilters, setCompose, clearCompose, sendEmail } =
  mailSlice.actions;
export default mailSlice.reducer;
