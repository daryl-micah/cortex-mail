import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ActionItem, ActionStatus, UndoEntry } from '@/types/actions';

interface ActionsState {
  open: boolean;
  summary: string;
  items: ActionItem[];
  /** True once "Run approved" has been pressed for the current batch */
  ran: boolean;
  undoStack: UndoEntry[];
}

const initialState: ActionsState = {
  open: false,
  summary: '',
  items: [],
  ran: false,
  undoStack: [],
};

const MAX_UNDO = 5;

const actionsSlice = createSlice({
  name: 'actions',
  initialState,
  reducers: {
    proposeActions(
      state,
      action: PayloadAction<{ summary: string; items: ActionItem[] }>
    ) {
      state.open = true;
      state.ran = false;
      state.summary = action.payload.summary;
      state.items = action.payload.items;
    },
    setItemStatus(
      state,
      action: PayloadAction<{ id: string; status: ActionStatus; error?: string }>
    ) {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item) {
        item.status = action.payload.status;
        item.error = action.payload.error;
      }
    },
    updateReplyBody(state, action: PayloadAction<{ id: string; body: string }>) {
      const item = state.items.find((i) => i.id === action.payload.id);
      if (item && item.action.kind === 'reply') {
        item.action.body = action.payload.body;
      }
    },
    rejectAll(state) {
      for (const item of state.items) {
        if (item.status === 'pending') item.status = 'rejected';
      }
    },
    restoreAll(state) {
      for (const item of state.items) {
        if (item.status === 'rejected') item.status = 'pending';
      }
    },
    markRan(state) {
      state.ran = true;
    },
    closeReview(state) {
      state.open = false;
      state.items = [];
      state.summary = '';
      state.ran = false;
    },
    pushUndo(state, action: PayloadAction<UndoEntry>) {
      state.undoStack = [action.payload, ...state.undoStack].slice(0, MAX_UNDO);
    },
    popUndo(state) {
      state.undoStack = state.undoStack.slice(1);
    },
  },
});

export const {
  proposeActions,
  setItemStatus,
  updateReplyBody,
  rejectAll,
  restoreAll,
  markRan,
  closeReview,
  pushUndo,
  popUndo,
} = actionsSlice.actions;
export default actionsSlice.reducer;
