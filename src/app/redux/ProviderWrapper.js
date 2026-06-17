"use client";

import { Provider } from "react-redux";
import { useEffect } from "react";
import { store } from "./store";
import { useGetCurrentUserQuery } from "@/features/auth/authApi";
import {
  setCredentials,
  clearCredentials,
  setHydrated,
} from "@/features/auth/authSlice";

function AuthHydrator({ children }) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const { data, error, isLoading } = useGetCurrentUserQuery(undefined, {
    skip: !token,
    pollingInterval: 0,
  });

  useEffect(() => {
    if (!token) {
      store.dispatch(setHydrated());
      return;
    }

    if (isLoading) {
      return;
    }

    if (error || !data?.data) {
      store.dispatch(clearCredentials());
      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
      store.dispatch(setHydrated());
    }

    if (data?.data) {
      store.dispatch(
        setCredentials({
          user: data.data,
          token,
        })
      );
    }
  }, [token, data, error, isLoading]);

  return children;
}

export default function ProviderWrapper({ children }) {
  return (
    <Provider store={store}>
      <AuthHydrator>{children}</AuthHydrator>
    </Provider>
  );
}
