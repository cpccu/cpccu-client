"use client";

import { Provider } from "react-redux";
import { useEffect } from "react";
import { store } from "./store";
import {
  setCredentials,
  setHydrated,
} from "@/features/auth/authSlice";
import { fi } from "date-fns/locale";

function AuthHydrator({ children }) {
  useEffect(() => {
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    try {
      if (user && user !== "undefined" && token) {
        store.dispatch(
          setCredentials({
            user: JSON.parse(user),
            token,
          })
        );
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } finally {
      store.dispatch(setHydrated());
    }
  }, []);

  return children;
}

export default function ProviderWrapper({ children }) {
  return (
    <Provider store={store}>
      <AuthHydrator>{children}</AuthHydrator>
    </Provider>
  );
}