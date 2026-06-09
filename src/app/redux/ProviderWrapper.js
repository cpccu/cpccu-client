"use client";

import { Provider } from "react-redux";
import { useEffect } from "react";
import { store } from "./store";
import {
  clearCredentials,
  setCredentials,
  setHydrated,
} from "@/features/auth/authSlice";

function AuthHydrator({ children }) {
  useEffect(() => {
    try {
      const userString = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (userString && userString !== "undefined" && token) {
        const user = JSON.parse(userString);
        if (user) {
          store.dispatch(
            setCredentials({
              user,
              token,
            })
          );
        }
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error);
      localStorage.removeItem("user");
      localStorage.removeItem("token");

      try {
        const response = await store
          .dispatch(
            userApi.endpoints.fetchUsers.initiate(undefined, {
              forceRefetch: true,
            }),
          )
          .unwrap();
        store.dispatch(setCredentials({ user: response.data }));
      } catch (error) {
        store.dispatch(clearCredentials());
      } finally {
        store.dispatch(setHydrated());
      }
    };

    hydrateSession();
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
