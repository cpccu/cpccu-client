import { createSlice } from "@reduxjs/toolkit";
const userFromStorage = localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null;
const tokenFromStorage = localStorage.getItem("token") ? localStorage.getItem("token") : null;

const authSlice = createSlice({
  name: "auth",
  initialState: { user: userFromStorage, token: tokenFromStorage, loading: false, error: null },
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.loading = false;
      state.error = null;
    },
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      state.loading = false;
      state.error = null;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;

