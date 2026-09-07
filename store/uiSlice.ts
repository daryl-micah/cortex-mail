import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { EmailCategory } from '@/types/mail';

export type ViewMode =
  | 'TODAY'
  | 'INBOX'
  | 'SENT'
  | 'NEEDS_REPLY'
  | 'WAITING_ON'
  | 'FOLLOW_UP'
  | 'STARRED'
  | 'CATEGORY';

export interface UIState {
  view: ViewMode;
  /** Gmail category shown when view === 'CATEGORY' */
  activeCategory: EmailCategory | null;
  detailEmailId: string | null;
  composeOpen: boolean;
  searchQuery: string;
}

const initialState: UIState = {
  view: 'TODAY',
  activeCategory: null,
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
      if (action.payload !== 'CATEGORY') state.activeCategory = null;
    },

    setCategoryView(state, action: PayloadAction<EmailCategory>) {
      state.view = 'CATEGORY';
      state.activeCategory = action.payload;
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
  setCategoryView,
  openEmail,
  closeEmail,
  openCompose,
  closeCompose,
} = uiSlice.actions;
export default uiSlice.reducer;
