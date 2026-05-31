import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  hydrated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token = null } = action.payload;

      state.user = user;
      state.token = token;
      state.loading = false;
      state.error = null;
      state.hydrated = true;

      // Auth persistence is handled by backend HttpOnly cookies.
      // Do not mirror tokens or sessions into localStorage.
    },

    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      state.loading = false;
      state.error = null;
      state.hydrated = true;

      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    },

    setHydrated: (state) => {
      state.hydrated = true;
    },
  },
});

export const { setCredentials, clearCredentials, setHydrated } =
  authSlice.actions;

export default authSlice.reducer;
