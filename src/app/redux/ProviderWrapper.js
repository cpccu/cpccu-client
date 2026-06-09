"use client";

import { Provider } from "react-redux";
import { useEffect } from "react";
import { store } from "./store";
import {
  clearCredentials,
  setCredentials,
  setHydrated,
} from "@/features/auth/authSlice";
import { userApi } from "@/features/users/userApi";

function AuthHydrator({ children }) {
  useEffect(() => {
    const hydrateSession = async () => {
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
