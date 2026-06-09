import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  loading: false,
  error: null,
  hydrated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user } = action.payload;

      state.user = user;
      state.loading = false;
      state.error = null;
      state.hydrated = true;

      // Auth persistence is handled by backend HttpOnly cookies.
      // Do not mirror tokens or sessions into localStorage.
    },

    clearCredentials: (state) => {
      state.user = null;
      state.loading = false;
      state.error = null;
      state.hydrated = true;
    },

    setHydrated: (state) => {
      state.hydrated = true;
    },
  },
});

export const { setCredentials, clearCredentials, setHydrated } =
  authSlice.actions;

export default authSlice.reducer;
