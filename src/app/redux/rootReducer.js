import { combineReducers } from "@reduxjs/toolkit";
import { baseApi } from "../../services/baseApi";
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