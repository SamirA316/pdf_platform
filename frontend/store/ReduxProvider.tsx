"use client";

import { Provider } from "react-redux";
import { store } from "./store";
import { hydrateFromStorage } from "./slices/authSlice";
import { ReactNode, useEffect } from "react";

function HydrateAuth() {
  useEffect(() => {
    store.dispatch(hydrateFromStorage());
  }, []);
  return null;
}

export function ReduxProvider({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <HydrateAuth />
      {children}
    </Provider>
  );
}
