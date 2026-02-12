import { ComposeState } from '@/types/mail';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ComposeDraft {
  to: string;
  subject: string;
  body: string;
}

interface ComposeSliceState {
  viewState: ComposeState;
  draft: ComposeDraft;
  error?: string;
}

const initialState: ComposeSliceState = {
  viewState: 'closed',
  draft: {
    to: '',
    subject: '',
    body: '',
  },
};

const composeSlice = createSlice({
  name: 'compose',
  initialState,
  reducers: {
    openCompose(state) {
      state.viewState = 'opening';
    },

    startEditing(state) {
      state.viewState = 'editing';
    },

    closeCompose(state) {
      state.viewState = 'closed';
    },

    updateDraft(state, action: PayloadAction<Partial<ComposeDraft>>) {
      state.draft = { ...state.draft, ...action.payload };
    },

    aiGenerating(state) {
      state.viewState = 'ai_generating';
    },

    sendingMail(state) {
      state.viewState = 'sending';
    },
  },
});

export const {
  openCompose,
  startEditing,
  closeCompose,
  updateDraft,
  aiGenerating,
  sendingMail,
} = composeSlice.actions;

export default composeSlice.reducer;
