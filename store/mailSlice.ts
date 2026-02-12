import { Email, Filters } from '@/types/mail';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MailState {
  emails: Email[];
  filters: Filters;
  loading: boolean;
}

interface ComposeState {
  to: string;
  subject: string;
  body: string;
  isOpen: boolean;
}

const initialState: MailState = {
  emails: [],
  filters: {},
  loading: false,
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
  },
});

export const { markAsRead } = mailSlice.actions;
export default mailSlice.reducer;
