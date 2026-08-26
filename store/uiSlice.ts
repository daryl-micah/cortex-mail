import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ViewMode =
  | 'TODAY'
  | 'INBOX'
  | 'SENT'
  | 'SEARCH'
  | 'NEEDS_REPLY'
  | 'WAITING_ON'
  | 'FOLLOW_UP'
  | 'STARRED';

export interface UIState {
  view: ViewMode;
  detailEmailId: string | null;
  composeOpen: boolean;
  searchQuery: string;
}

const initialState: UIState = {
  view: 'TODAY',
  detailEmailId: null,
  composeOpen: false,
  searchQuery: '',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialState,
  reducers: {
    setView(state, action: PayloadAction<ViewMode>) {
      state.view = action.payload;
    },

    openEmail: (state, action: PayloadAction<string>) => {
      state.detailEmailId = action.payload;
    },

    closeEmail: (state) => {
      state.detailEmailId = null;
    },

    openCompose(state) {
      state.composeOpen = true;
    },

    closeCompose(state) {
      state.composeOpen = false;
    },
  },
});

export const {
  setView,
  openEmail,
  closeEmail,
  openCompose,
  closeCompose,
} = uiSlice.actions;
export default uiSlice.reducer;
