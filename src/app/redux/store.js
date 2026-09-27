import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../../services/baseApi';
import authSlice from '../../features/auth/authSlice';
import certificateSlice from '../../features/certificate/certificateSlise';

// `certificateApi` is NOT registered here, and that is correct: it is built by
// `baseApi.injectEndpoints`, so its reducer and middleware are already covered
// by the `baseApi` entries below. The dead second `publicApi` instance this file
// used to register separately is gone — see the note in `certificateApi.js`.
export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authSlice,
    certificate: certificateSlice,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: false,
    }).concat(baseApi.middleware),
});
