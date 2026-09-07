import { Email, EmailAI, EmailInsight, Filters } from '@/types/mail';
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
  loadingMore: boolean;
  error: string | null;
  compose: ComposeState;
  nextPageToken: string | null;
  hasMore: boolean;
}

const initialState: MailState = {
  emails: [],
  sentEmails: [],
  filters: {},
  loading: false,
  loadingMore: false,
  error: null,
  compose: {
    to: '',
    subject: '',
    body: '',
  },
  nextPageToken: null,
  hasMore: true,
};

const mailSlice = createSlice({
  name: 'mail',
  initialState,
  reducers: {
    setEmails(
      state,
      action: PayloadAction<{ emails: Email[]; nextPageToken?: string }>
    ) {
      state.emails = action.payload.emails;
      state.nextPageToken = action.payload.nextPageToken || null;
      state.hasMore = !!action.payload.nextPageToken;
      state.loading = false;
      state.loadingMore = false;
      state.error = null;
    },
    appendEmails(
      state,
      action: PayloadAction<{ emails: Email[]; nextPageToken?: string }>
    ) {
      state.emails = [...state.emails, ...action.payload.emails];
      state.nextPageToken = action.payload.nextPageToken || null;
      state.hasMore = !!action.payload.nextPageToken;
      state.loadingMore = false;
      state.error = null;
    },
    setLoadingMore(state, action: PayloadAction<boolean>) {
      state.loadingMore = action.payload;
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
    /**
     * Add an email the store has never seen, or refresh one it has.
     * Locally-derived fields (ai, insight) are preserved on merge.
     */
    upsertEmail(state, action: PayloadAction<Email>) {
      const incoming = action.payload;
      const existing = state.emails.find((e) => e.id === incoming.id);
      if (existing) {
        Object.assign(existing, incoming, {
          ai: incoming.ai ?? existing.ai,
          insight: incoming.insight ?? existing.insight,
        });
        return;
      }
      state.emails.push(incoming);
      state.emails.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    markAsRead(state, action: PayloadAction<string>) {
      const email = state.emails.find((e) => e.id === action.payload);
      if (email) {
        email.unread = false;
      }
    },
    setUnread(state, action: PayloadAction<{ id: string; unread: boolean }>) {
      const email = state.emails.find((e) => e.id === action.payload.id);
      if (email) email.unread = action.payload.unread;
    },
    removeEmails(state, action: PayloadAction<string[]>) {
      const ids = new Set(action.payload);
      state.emails = state.emails.filter((e) => !ids.has(e.id));
    },
    /** Put archived emails back (undo). They re-sort on the next poll. */
    restoreEmails(state, action: PayloadAction<Email[]>) {
      const existing = new Set(state.emails.map((e) => e.id));
      const fresh = action.payload.filter((e) => !existing.has(e.id));
      state.emails = [...state.emails, ...fresh].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    toggleStar(state, action: PayloadAction<{ id: string; starred: boolean }>) {
      const email =
        state.emails.find((e) => e.id === action.payload.id) ||
        state.sentEmails.find((e) => e.id === action.payload.id);
      if (email) {
        email.starred = action.payload.starred;
      }
    },
    setClassifications(
      state,
      action: PayloadAction<Record<string, EmailAI>>
    ) {
      for (const email of state.emails) {
        const ai = action.payload[email.id];
        if (ai) email.ai = ai;
      }
    },
    setInsight(
      state,
      action: PayloadAction<{ id: string; insight: EmailInsight }>
    ) {
      const email =
        state.emails.find((e) => e.id === action.payload.id) ??
        state.sentEmails.find((e) => e.id === action.payload.id);
      if (email) email.insight = action.payload.insight;
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
  appendEmails,
  setSentEmails,
  setLoading,
  setLoadingMore,
  setError,
  upsertEmail,
  markAsRead,
  setUnread,
  removeEmails,
  restoreEmails,
  toggleStar,
  setClassifications,
  setInsight,
  setFilters,
  setCompose,
  clearCompose,
  sendEmail,
} = mailSlice.actions;
export default mailSlice.reducer;
