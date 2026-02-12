import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import mailReducer from './mailSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    mail: mailReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
