"use client";

import { Provider } from "react-redux";
import { useEffect } from "react";
import { store } from "./store";
import { useGetCurrentUserQuery } from "@/features/auth/authApi";
import {
  setCredentials,
  clearCredentials,
} from "@/features/auth/authSlice";

function AuthHydrator({ children }) {
  // NO `skip` GATE, AND NO `localStorage` READ. This used to be
  //
  //     const token = localStorage.getItem("token");
  //     useGetCurrentUserQuery(undefined, { skip: !token, … })
  //
  // which was correct only while the server ALSO returned the access token in
  // the login response body. The body token is gone (the credential is an
  // `httpOnly` cookie that no script can read — `auth.controller.js` no longer
  // returns it), so with the gate left in place `localStorage.token` is
  // permanently null, `skip` is permanently true, `GET /users/user` never
  // fires, `data` never arrives, and EVERY PAGE renders logged out. This was the
  // single most dangerous edit in the cutover for exactly that reason.
  //
  // The server is now the only authority on who the caller is: the cookie is
  // sent automatically by the browser, `auth.js` reads it, and a 401 IS the
  // "not logged in" answer. The cost of asking unconditionally is one small
  // 401-shaped request per anonymous page load; the cost of the gate is a site
  // where nobody is ever logged in.
  const {
    data,
    error,
    isLoading,
  } = useGetCurrentUserQuery(undefined, {
    pollingInterval: 0,
  });

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (error || !data?.data) {
      // This is the ONE place a 401 becomes a logged-out UI. `error` covers
      // 401 (no or expired cookie), 403 and any 5xx alike — deliberately, and
      // as before: a 5xx on this probe is not a reason to keep showing a
      // signed-in header for a session the server has not confirmed. The
      // `httpOnly` cookies cannot be cleared from here either; they are cleared
      // by the logout route, or simply expire. `clearCredentials` already sets
      // `hydrated: true`, so this path needs no separate `setHydrated` dispatch.
      store.dispatch(clearCredentials());
    }

    if (data?.data) {
      // No `token` in this payload any more. `setCredentials` stores the user
      // the SERVER returned, which is the only place a session identity now
      // enters the client.
      store.dispatch(setCredentials({ user: data.data }));
    }
  }, [data, error, isLoading]);

  return children;
}

export default function ProviderWrapper({ children }) {
  return (
    <Provider store={store}>
      <AuthHydrator>{children}</AuthHydrator>
    </Provider>
  );
}
