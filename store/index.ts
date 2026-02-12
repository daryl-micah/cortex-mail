import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import mailReducer from './mailSlice';
import composeReducer from './composeSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    mail: mailReducer,
    compose: composeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
