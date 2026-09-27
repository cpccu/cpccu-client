import { configureStore } from '@reduxjs/toolkit';
// `@/services/baseApi`, NOT the relative `'../../services/baseApi'` this file
// used to use. Every other importer of the api slice — the seven `*Api.js`
// feature modules plus `Profile.jsx` and `admin-sidebar.jsx` — reaches it
// through the `@/` alias, and a shared singleton must be reached through ONE
// specifier so the graph holds exactly one `createApi` instance.
//
// The two forms do resolve to the same file today: a bundler keys modules by
// resolved absolute path, and Turbopack emits only
// `[project]/src/services/baseApi.js [app-client]` and `[… [app-ssr]]`. So this
// line is HYGIENE, not the cure for a live defect. It is normalised anyway
// because the invariant is worth being able to state and check. A second copy
// of the module, a second `@/` mapping, or a bundler keying on the raw
// specifier would each turn this into two `createApi` calls — two caches, two
// middlewares — and the "already-existing endpointName" error would then be a
// real bug rather than a dev-only Fast Refresh artefact.
import { baseApi } from '@/services/baseApi';
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
