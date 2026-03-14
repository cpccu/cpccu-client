import { createSlice } from "@reduxjs/toolkit";

// Check if we're on the client side before accessing localStorage
const getFromLocalStorage = (key) => {
  if (typeof window !== "undefined" && window.localStorage) {
    return localStorage.getItem(key);
  }
  return null;
};

const userFromStorage = getFromLocalStorage("user") ? JSON.parse(getFromLocalStorage("user")) : null;
const tokenFromStorage = getFromLocalStorage("token") ? getFromLocalStorage("token") : null;

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
      // Save to localStorage on client side
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("token", token);
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      state.loading = false;
      state.error = null;
      // Remove from localStorage on client side
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;

