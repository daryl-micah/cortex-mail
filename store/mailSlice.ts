import { Email, Filters } from '@/types/mail';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ComposeState {
  to: string;
  subject: string;
  body: string;
}

interface MailState {
  emails: Email[];
  sentEmails: Email[];
  filters: Filters;
  loading: boolean;
  error: string | null;
  compose: ComposeState;
}

const initialState: MailState = {
  emails: [],
  sentEmails: [],
  filters: {},
  loading: false,
  error: null,
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
    setEmails(state, action: PayloadAction<Email[]>) {
      state.emails = action.payload;
      state.loading = false;
      state.error = null;
    },
    setSentEmails(state, action: PayloadAction<Email[]>) {
      state.sentEmails = action.payload;
      state.loading = false;
      state.error = null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
    },
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
      // Clear compose state - actual sending handled by API
      state.compose = { to: '', subject: '', body: '' };
    },
  },
});

export const {
  setEmails,
  setSentEmails,
  setLoading,
  setError,
  markAsRead,
  setFilters,
  setCompose,
  clearCompose,
  sendEmail,
} = mailSlice.actions;
export default mailSlice.reducer;
