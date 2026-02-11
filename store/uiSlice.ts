import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ViewMode = 'INBOX' | 'EMAIL_DETAIL' | 'COMPOSE' | 'SEARCH';

export interface UIState {
  view: ViewMode;
  selectedEmailId: string | null;
  searchQuery: string;
}

const initialState: UIState = {
  view: 'INBOX',
  selectedEmailId: null,
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
      state.view = 'EMAIL_DETAIL';
      state.selectedEmailId = action.payload;
    },

    composeEmail(state) {
      state.view = 'COMPOSE';
    },
  },
});

export const { setView, openEmail, composeEmail } = uiSlice.actions;
export default uiSlice.reducer;
