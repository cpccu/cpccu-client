import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../../services/baseApi';
import { publicApi } from '../../features/certificate/certificateApi';
import authSlice from '../../features/auth/authSlice';
import certificateSlice from '../../features/certificate/certificateSlise';
// import { certificateApi } from '../../features/certificate/certificateApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    [publicApi.reducerPath]: publicApi.reducer,
    auth: authSlice,
    certificate: certificateSlice,
  },
  middleware: (getDefault) =>
    getDefault().concat(baseApi.middleware, publicApi.middleware),
});