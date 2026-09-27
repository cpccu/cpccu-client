import { combineReducers } from "@reduxjs/toolkit";
// `@/services/baseApi`, NOT the relative `"../../services/baseApi"` this file
// used to use. `baseApi` is a `createApi` SINGLETON and all nine other importers
// — the seven `features/*/**Api.js` slices, `Profile.jsx`, `admin-sidebar.jsx`
// and now `store.js` — reach it through the `@/` alias. One specifier, one
// instance. Were the module ever to reach this graph twice under two identities,
// `createApi` would run twice and produce two independent query caches and two
// middlewares, so `resetApiState()` or `invalidateTags` dispatched through one
// would silently do nothing to the other. See the identical note in `store.js`.
import { baseApi } from "@/services/baseApi";
import authSlice from "../../features/auth/authSlice";
import usersSlice from "../features/users/usersSlice";
import postsSlice from "../features/posts/postsSlice";

const rootReducer = combineReducers({
  // RTK Query API reducer
  [baseApi.reducerPath]: baseApi.reducer,

  // feature reducers
  auth: authSlice,
  users: usersSlice,
  posts: postsSlice,
});

export default rootReducer;