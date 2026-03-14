import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../../services/baseApi';
import authSlice from '../../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authSlice,
  },
  middleware: (getDefault) =>
    getDefault().concat(baseApi.middleware),
});

